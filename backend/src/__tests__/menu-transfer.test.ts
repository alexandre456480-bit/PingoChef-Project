import { validateMenuArchive, remapMenuArchive } from '../services/menu-transfer.schema';

import { archiveFixture } from './fixtures/menu-archive';
describe('Portable menu contract', () => {
  it('accepts AVIF and discards unused banners left behind after deleting a category', () => {
    const doc = archiveFixture();
    doc.items[0].imageUrl = 'data:image/avif;base64,aGVsbG8=';
    doc.design.custom_config.category_hero_configs['55555555-5555-4555-8555-555555555555'] = { enabled: true, banners: [] };
    const validated = validateMenuArchive(doc);
    expect(Object.keys((validated.design!.custom_config as any).category_hero_configs)).toEqual([doc.categories[0].id]);
  });
  it('preserves customer customization and remaps every relationship without accepting ownership', () => {
    const doc = validateMenuArchive(archiveFixture()), mapped = remapMenuArchive(doc);
    expect(mapped.business).toEqual(doc.business);
    expect(mapped.categories[0].id).not.toBe(doc.categories[0].id);
    expect(mapped.subcategories[0].categoryId).toBe(mapped.categories[0].id);
    expect(mapped.items[0].categoryId).toBe(mapped.categories[0].id);
    expect(mapped.items[0].subcategoryId).toBe(mapped.subcategories[0].id);
    expect(Object.keys((mapped.design!.custom_config as any).category_hero_configs)).toEqual([mapped.categories[0].id]);
    expect(mapped.design!.palette).toEqual(doc.design!.palette);
  });
  it.each(['owner_user_id', 'id', 'slug', 'status', 'plan'])('rejects protected business field %s', key => {
    const doc = archiveFixture(); doc.business[key] = 'forged'; expect(() => validateMenuArchive(doc)).toThrow();
  });
  it.each(['javascript:alert(1)', 'data:image/svg+xml;base64,AAAA', 'https://user:pass@example.com/a.png', '//example.com/a.png', '<img src=x onerror=alert(1)>'])('rejects unsafe image %s', image => {
    const doc = archiveFixture(); doc.business.logo_url = image; expect(() => validateMenuArchive(doc)).toThrow();
  });
  it('rejects broken references, duplicates, invalid promotions, prototype keys and unsupported versions', () => {
    for (const mutate of [
      (d: any) => d.items[0].subcategoryId = d.categories[0].id,
      (d: any) => d.categories.push(d.categories[0]),
      (d: any) => d.items[0].promotionalPrice = 30,
      (d: any) => d.design.custom_config.constructor = { pollute: true },
      (d: any) => d.version = 2,
      (d: any) => d.design.template_key = 'unregistered-template',
      (d: any) => d.design.custom_config.category_hero_configs.foreign = { enabled: true, banners: [] }
    ]) { const doc = archiveFixture(); mutate(doc); expect(() => validateMenuArchive(doc)).toThrow(); }
  });
});
