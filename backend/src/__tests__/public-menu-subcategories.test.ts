import request from 'supertest';
import app from '../server';
import { localDb } from '../config/localDb';

jest.mock('../config/supabase', () => ({
  ...jest.requireActual('../config/supabase'),
  isSupabaseConfigured: false
}));

describe('Cardápio público com subconjuntos', () => {
  const businessId = 'test_public_subcategories';
  const previousMode = process.env.APP_MODE;

  afterAll(() => {
    if (previousMode === undefined) delete process.env.APP_MODE;
    else process.env.APP_MODE = previousMode;
    localDb.businesses = localDb.businesses.filter(row => row.id !== businessId);
    localDb.categories = localDb.categories.filter(row => row.business_id !== businessId);
    localDb.subcategories = localDb.subcategories.filter(row => row.business_id !== businessId);
    localDb.items = localDb.items.filter(row => row.business_id !== businessId);
    delete localDb.designSettings[businessId];
  });

  it('envia subconjuntos e seus produtos na resposta pública', async () => {
    process.env.APP_MODE = 'demo';
    localDb.businesses.push({ id: businessId, owner_user_id: 'test_owner', name: 'Teste', slug: 'teste-subconjuntos', status: 'ACTIVE' });
    localDb.categories.push({ id: 'test_cat', business_id: businessId, name: 'Pratos', icon_type: 'none', display_order: 0, is_active: true, created_at: new Date().toISOString() });
    localDb.subcategories.push({ id: 'test_sub', business_id: businessId, category_id: 'test_cat', name: 'Artesanais', display_order: 0, created_at: new Date().toISOString() });
    localDb.items.push({ id: 'test_item', business_id: businessId, category_id: 'test_cat', subcategory_id: 'test_sub', name: 'Prato', price: 20, is_available: true, is_highlighted: false, display_order: 0, created_at: new Date().toISOString() });

    const response = await request(app).get('/api/v1/public/menu/teste-subconjuntos');

    expect(response.status).toBe(200);
    expect(response.body.data.design.templateKey).toBe('default');
    expect(response.body.data.subcategories).toEqual([{ id: 'test_sub', categoryId: 'test_cat', name: 'Artesanais', displayOrder: 0 }]);
    expect(response.body.data.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'test_item', subcategoryId: 'test_sub' })]));

    localDb.designSettings[businessId] = {
      template_key: 'showcase', font_heading: 'Oswald', font_body: 'Lora',
      home_blocks: [{ id: 'hero', type: 'hero', enabled: false, position: 3 },
        { id: 'curve-panels', type: 'template_variant', enabled: false, position: 9 }],
      custom_config: { template_variant: 'curve-panels', enable_cart: false, home_icons: { home: null },
        intro_card: { enabled: true, title: 'Cliente', description: 'Original' } }
    };
    const migrated = await request(app).get('/api/v1/public/menu/teste-subconjuntos');
    expect(migrated.status).toBe(200);
    expect(migrated.body.data.design).toMatchObject({ templateKey: 'default', fontHeading: 'Oswald', fontBody: 'Lora',
      customConfig: { enable_cart: false, home_icons: { home: null }, intro_card: { title: 'Cliente', description: 'Original' } } });
    expect(migrated.body.data.design.homeBlocks).toContainEqual({ id: 'hero', type: 'hero', enabled: false, position: 3 });
    expect(migrated.body.data.design.homeBlocks.some((block: any) => block.type === 'template_variant')).toBe(false);
    expect(migrated.body.data.design.customConfig).not.toHaveProperty('template_variant');
    localDb.designSettings[businessId].template_key = 'centered-cover';
    const centered = await request(app).get('/api/v1/public/menu/teste-subconjuntos');
    expect(centered.body.data.design.templateKey).toBe('centered-cover');
    localDb.designSettings[businessId].template_key = 'brand-hero';
    const branded = await request(app).get('/api/v1/public/menu/teste-subconjuntos');
    expect(branded.body.data.design.templateKey).toBe('brand-hero');
    expect(branded.body.data.design.customConfig).toEqual(centered.body.data.design.customConfig);
  });
});
