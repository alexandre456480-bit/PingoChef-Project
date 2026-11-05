import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { designSchema } from '../controllers/design.controller';
import { categorySchema } from '../controllers/category.controller';
import { itemSchema } from '../controllers/item.controller';
import { isSafeSocialUrl, socialLinksSchema } from '../utils/social-links';
import { orderSettingsSchema } from '../utils/order-settings';
import { ownerError } from './owner-session.service';

export const TRANSFER_MAX_BYTES = 32 * 1024 * 1024;
export const TRANSFER_CHUNK_CHARS = 500_000;
export const TRANSFER_MAX_PARTS = 68;
const position = z.number().int().min(0).max(100_000);
const id = z.string().uuid();
const image = z.string().max(11_000_000).nullable();
export const menuArchiveSchema = z.object({
  format: z.literal('pingochef-menu'),
  version: z.literal(1),
  exportedAt: z.string().datetime({ offset: true }),
  // Video provider credentials/playback identifiers and analytics are never portable.
  excludedVideos: z.number().int().min(0).max(100_000).default(0),
  productRecommendations: z.array(z.object({ triggerProductId: id, recommendedProductIds: z.array(id).max(3) }).strict()).max(1000).default([]),
  business: z.object({
    name: z.string().trim().min(1).max(100), description: z.string().max(500).nullable(),
    logo_url: image, banner_url: image, phone: z.string().max(30).nullable(), whatsapp: z.string().max(30).nullable(),
    welcome_bg_type: z.enum(['image', 'color']), welcome_bg_image: image,
    welcome_bg_color: z.string().regex(/^#(?:[a-f\d]{3}|[a-f\d]{6}|[a-f\d]{8})$/i).nullable(),
    social_links: socialLinksSchema, order_settings: orderSettingsSchema
  }).strict(),
  design: designSchema.nullable(),
  categories: z.array(categorySchema.extend({ id, displayOrder: position }).strict()).max(200),
  subcategories: z.array(z.object({ id, categoryId: id, name: z.string().trim().min(2).max(100), displayOrder: position }).strict()).max(1000),
  items: z.array(z.object({
    id, categoryId: id, subcategoryId: id.nullable(), name: z.string(), description: z.string().nullable(),
    price: z.number().finite(), promotionalPrice: z.number().finite().nullable(), imageUrl: image,
    isAvailable: z.boolean(), isHighlighted: z.boolean(), highlightType: z.enum(['none', 'promotion', 'most_liked', 'chef', 'combo', 'best_seller']),
    showPrice: z.boolean(), displayOrder: position
  }).strict()).max(1000)
}).strict();
export type MenuArchive = z.infer<typeof menuArchiveSchema>;

// No remote fetching: this prevents SSRF and preserves external image references.
function safeImage(value: string) {
  return !value || /^data:image\/(png|jpe?g|webp|gif|avif);base64,[a-z\d+/=\r\n]+$/i.test(value)
    || /^\/(?!\/)[a-z\d_./%-]+$/i.test(value)
    || /^assets\/[a-z\d_./%-]+$/i.test(value)
    || (() => { try { return value.length <= 8192 && isSafeSocialUrl(value) && !/\.svg$/i.test(new URL(value).pathname); } catch { return false; } })();
}

export function validateMenuArchive(value: unknown): MenuArchive {
  let nodes = 0;
  const inspect = (node: unknown, depth = 0): void => {
    if (++nodes > 50_000 || depth > 16) throw ownerError(400, 'INVALID_MENU_ARCHIVE');
    if (typeof node === 'string') {
      if (node.length > 11_000_000 || /(?:javascript|vbscript|file|blob):|data:(?!image\/(?:png|jpe?g|webp|gif|avif);base64,)|<\/?[a-z!]/i.test(node))
        throw ownerError(400, 'UNSAFE_MENU_ARCHIVE');
    } else if (node && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw ownerError(400, 'UNSAFE_MENU_ARCHIVE');
        inspect(child, depth + 1);
      }
    }
  };
  inspect(value);
  if (Buffer.byteLength(JSON.stringify(value) || '') > TRANSFER_MAX_BYTES) throw ownerError(413, 'MENU_ARCHIVE_TOO_LARGE');
  const doc = menuArchiveSchema.parse(value);
  const unique = (rows: { id: string }[]) => { if (new Set(rows.map(row => row.id)).size !== rows.length) throw ownerError(400, 'DUPLICATE_MENU_REFERENCE'); };
  unique(doc.categories); unique(doc.subcategories); unique(doc.items);
  const itemIds = new Set(doc.items.map(row => row.id)), triggers = new Set<string>();
  for (const row of doc.productRecommendations) {
    if (!itemIds.has(row.triggerProductId) || triggers.has(row.triggerProductId)
      || new Set(row.recommendedProductIds).size !== row.recommendedProductIds.length
      || row.recommendedProductIds.some(id => id === row.triggerProductId || !itemIds.has(id))) throw ownerError(400, 'INVALID_RESOURCE_RELATIONSHIP');
    triggers.add(row.triggerProductId);
  }
  const categories = new Set(doc.categories.map(row => row.id));
  const subs = new Map(doc.subcategories.map(row => [row.id, row.categoryId]));
  for (const sub of doc.subcategories) if (!categories.has(sub.categoryId)) throw ownerError(400, 'INVALID_RESOURCE_RELATIONSHIP');
  for (const item of doc.items) {
    // Reuse the ordinary product business rules, including promotional pricing.
    itemSchema.parse({ ...item, imageUrl: null }); // Raster images are checked below, including AVIF.
    if (!categories.has(item.categoryId) || (item.subcategoryId && subs.get(item.subcategoryId) !== item.categoryId))
      throw ownerError(400, 'INVALID_RESOURCE_RELATIONSHIP');
  }
  const images = [doc.business.logo_url, doc.business.banner_url, doc.business.welcome_bg_image,
    ...doc.categories.map(row => row.imageUrl), ...doc.items.map(row => row.imageUrl)];
  const config = doc.design?.custom_config as any;
  if (config?.hero_banners) {
    if (!Array.isArray(config.hero_banners) || config.hero_banners.length > 10) throw ownerError(400, 'INVALID_MENU_ARCHIVE');
    images.push(...config.hero_banners);
  }
  if (config?.category_hero_configs) {
    const heroes = z.record(z.string().uuid(), z.object({ enabled: z.boolean(), banners: z.array(z.string()).max(10) }).strict()).parse(config.category_hero_configs);
    // Older editors retain banner settings for deleted categories. They have no
    // rendered effect and must not make an otherwise valid backup unrestorable.
    config.category_hero_configs = Object.fromEntries(Object.entries(heroes).filter(([key]) => categories.has(key)));
    for (const settings of Object.values(config.category_hero_configs) as { banners: string[] }[]) images.push(...settings.banners);
  }
  if (images.some(value => value != null && (typeof value !== 'string' || !safeImage(value)))) throw ownerError(400, 'UNSAFE_MENU_IMAGE');
  return doc;
}

// Every imported identifier is new. Never accept tenant or record ownership from a file.
export function remapMenuArchive(doc: MenuArchive): MenuArchive {
  const categories = new Map(doc.categories.map(row => [row.id, randomUUID()]));
  const subcategories = new Map(doc.subcategories.map(row => [row.id, randomUUID()]));
  const items = new Map(doc.items.map(row => [row.id, randomUUID()]));
  const clone: MenuArchive = structuredClone(doc);
  clone.categories = doc.categories.map(row => ({ ...row, id: categories.get(row.id)! }));
  clone.subcategories = doc.subcategories.map(row => ({ ...row, id: subcategories.get(row.id)!, categoryId: categories.get(row.categoryId)! }));
  clone.items = doc.items.map(row => ({ ...row, id: items.get(row.id)!, categoryId: categories.get(row.categoryId)!, subcategoryId: row.subcategoryId ? subcategories.get(row.subcategoryId)! : null }));
  clone.productRecommendations = doc.productRecommendations.map(row => ({ triggerProductId: items.get(row.triggerProductId)!, recommendedProductIds: row.recommendedProductIds.map(id => items.get(id)!) }));
  const config = clone.design?.custom_config as any;
  if (config?.category_hero_configs) config.category_hero_configs = Object.fromEntries(
    Object.entries(config.category_hero_configs).map(([key, settings]) => [categories.get(key)!, settings]));
  return clone;
}
