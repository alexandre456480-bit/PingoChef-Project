import express from 'express';
import request from 'supertest';
import itemRoutes from '../routes/item.routes';
import { supabaseAdmin } from '../config/supabase';
import { publicProductRecommendations } from '../services/product-recommendations.service';
import { publicCustomConfig } from '../services/public-menu-presentation';
jest.mock('../config/supabase', () => ({ isSupabaseConfigured: true, supabaseAdmin: { rpc: jest.fn(), from: jest.fn() }, createUserClient: jest.fn() }));
jest.mock('../middleware/auth.middleware', () => ({ authenticateJwt: (req: any, res: any, next: any) => {
  if (!req.get('x-owner')) return res.sendStatus(401); req.businessId = 'tenant-a'; req.userId = 'owner-a'; next();
} }));
const trigger = '11111111-1111-4111-8111-111111111111', target = '22222222-2222-4222-8222-222222222222';
const eq = jest.fn();
function app() {
  const api = express(); api.use(express.json({ limit: '2kb' })); api.use('/items', itemRoutes);
  api.use((error: any, _req: any, res: any, _next: any) => res.status(error.name === 'ZodError' ? 400 : error.status || 500).json({ code: error.code }));
  return api;
}
beforeEach(() => {
  jest.clearAllMocks();
  const chain: any = { select: () => chain, eq, maybeSingle: async () => ({ data: { id: trigger }, error: null }) };
  eq.mockReturnValue(chain); (supabaseAdmin.from as jest.Mock).mockReturnValue(chain);
  (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({ data: { triggerProductId: trigger, recommendedProductIds: [target] }, error: null });
});
it('authenticates writes and binds the transaction to the owner session', async () => {
  expect((await request(app()).put(`/items/${trigger}/recommendations`).send({ recommendedProductIds: [target] })).status).toBe(401);
  const response = await request(app()).put(`/items/${trigger}/recommendations`).set('x-owner', 'yes').send({ recommendedProductIds: [target] });
  expect(response.status).toBe(200);
  expect(supabaseAdmin.rpc).toHaveBeenCalledWith('replace_product_recommendations', { p_business_id: 'tenant-a', p_owner_id: 'owner-a', p_trigger: trigger, p_recommended: [target] });
});
it.each([{ recommendedProductIds: [trigger] }, { recommendedProductIds: [target, target] },
  { recommendedProductIds: Array(4).fill(target) }, { recommendedProductIds: ['invalid'] },
  { recommendedProductIds: [target], business_id: 'victim' }])('rejects malformed/forged input without writes: %j', async body => {
  expect((await request(app()).put(`/items/${trigger}/recommendations`).set('x-owner', 'yes').send(body)).status).toBe(400);
  expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
});
it('reads only owned products and maps cross-tenant database failures without partial writes', async () => {
  (supabaseAdmin.rpc as jest.Mock).mockResolvedValueOnce({ data: [{ triggerProductId: trigger, recommendedProductIds: [target] }], error: null });
  expect((await request(app()).get(`/items/${trigger}/recommendations`).set('x-owner', 'yes')).body.data.recommendedProductIds).toEqual([target]);
  expect(eq).toHaveBeenCalledWith('business_id', 'tenant-a'); expect(eq).toHaveBeenCalledWith('id', trigger);
  (supabaseAdmin.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: { message: 'INVALID_RESOURCE_RELATIONSHIP' } });
  expect((await request(app()).put(`/items/${trigger}/recommendations`).set('x-owner', 'yes').send({ recommendedProductIds: [target] })).status).toBe(400);
});
it('only projects publicly eligible relationships and defaults the global flag off', () => {
  const items = [{ id: trigger, categoryId: 'visible', price: 20 }, { id: target, categoryId: 'visible', price: 10, promotionalPrice: 8 },
    { id: 'hidden', categoryId: 'hidden', price: 20 }, { id: 'unpriced', categoryId: 'visible', price: 10, showPrice: false }];
  expect(publicProductRecommendations([{ triggerProductId: trigger, recommendedProductIds: ['hidden', 'unpriced', target] },
    { triggerProductId: 'hidden', recommendedProductIds: [target] }], items, [{ id: 'visible' }])).toEqual([{ triggerProductId: trigger, recommendedProductIds: [target] }]);
  expect(publicCustomConfig({}).cart_recommendations_enabled).not.toBe(true);
  expect(publicCustomConfig({ cart_recommendations_enabled: 'true' }).cart_recommendations_enabled).not.toBe(true);
  expect(publicCustomConfig({ cart_recommendations_enabled: true }).cart_recommendations_enabled).toBe(true);
});
