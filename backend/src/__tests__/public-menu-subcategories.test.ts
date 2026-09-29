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
    expect(response.body.data.subcategories).toEqual([{ id: 'test_sub', categoryId: 'test_cat', name: 'Artesanais', displayOrder: 0 }]);
    expect(response.body.data.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'test_item', subcategoryId: 'test_sub' })]));
  });
});
