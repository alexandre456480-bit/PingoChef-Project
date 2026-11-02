export const DEFAULT_TEMPLATE_KEY = 'default';

// Accept cached clients during rollout, but never persist removed templates again.
export const ACCEPTED_TEMPLATE_KEYS = [DEFAULT_TEMPLATE_KEY, 'centered-cover', 'arched-cover', 'brand-hero', 'signature-cover', 'pixel', 'retro-diner', 'circuit-tech', 'soft-wave', 'immersive-cover', 'nordic-tavern', 'japanese-izakaya', 'neon-arcade', 'tropical-bamboo', 'mexican-fiesta', 'editorial-menu', 'product-gallery', 'compact-menu', 'sweet-boutique', 'minimal', 'modern', 'premium', 'dark',
  'showcase', 'brand-cover', 'editorial-arc', 'curve-panels'] as const;

export function normalizeTemplateKey(key: unknown): 'default' | 'centered-cover' | 'arched-cover' | 'brand-hero' | 'signature-cover' | 'pixel' | 'retro-diner' | 'circuit-tech' | 'soft-wave' | 'immersive-cover' | 'nordic-tavern' | 'japanese-izakaya' | 'neon-arcade' | 'tropical-bamboo' | 'mexican-fiesta' | 'editorial-menu' | 'product-gallery' | 'compact-menu' | 'sweet-boutique' {
  return key === 'centered-cover' || key === 'arched-cover' || key === 'brand-hero' || key === 'signature-cover' || key === 'pixel' || key === 'retro-diner' || key === 'circuit-tech' || key === 'soft-wave' || key === 'immersive-cover' || key === 'nordic-tavern' || key === 'japanese-izakaya' || key === 'neon-arcade' || key === 'tropical-bamboo' || key === 'mexican-fiesta' || key === 'editorial-menu' || key === 'product-gallery' || key === 'compact-menu' || key === 'sweet-boutique' ? key : DEFAULT_TEMPLATE_KEY;
}

export function withoutTemplateVariant(config: Record<string, unknown> = {}): Record<string, unknown> {
  const { template_variant: _removed, ...personalization } = config;
  return personalization;
}

export function withoutTemplateBlocks<T extends { type: string }>(blocks: T[]): T[] {
  return blocks.filter(block => block.type !== 'template_variant');
}
