import express from 'express';
import request from 'supertest';
import router from '../routes/menu-transfer.routes';
import { supabaseAdmin } from '../config/supabase';
import { archiveFixture } from './fixtures/menu-archive';

jest.mock('../config/supabase', () => ({ isSupabaseConfigured: true, supabaseAdmin: { rpc: jest.fn(), from: jest.fn() }, createUserClient: jest.fn() }));
jest.mock('../middleware/auth.middleware', () => ({ authenticateJwt: (req: any, res: any, next: any) => {
  if (!req.get('x-owner')) return res.sendStatus(401);
  req.businessId = 'tenant-a'; req.userId = 'owner-a'; next();
} }));
jest.mock('../middleware/shared-rate-limit.middleware', () => ({ sharedRateLimit: () => (_req: any, _res: any, next: any) => next() }));
jest.mock('../services/entitlement.service', () => ({ entitlements: { getEntitlements: async () => ({ entitlements: { MAX_CATEGORIES: 10, MAX_PRODUCTS: 30 } }) } }));
const id = '44444444-4444-4444-8444-444444444444';
const eq = jest.fn(), gt = jest.fn(), select = jest.fn(), remove = jest.fn();
let stage: any;
function app() {
  const api = express(); api.use(express.json({ limit: '3mb' })); api.use('/transfer', router);
  api.use((error: any, _req: any, res: any, _next: any) => res.status(error.name === 'ZodError' ? 400 : error.status || 500).json({ code: error.code }));
  return api;
}
beforeEach(() => {
  jest.clearAllMocks(); stage = { parts: [JSON.stringify(archiveFixture())], expected_parts: 1, completed: false };
  const chain: any = { select, eq, gt, delete: remove, maybeSingle: async () => ({ data: stage, error: null }),
    then: (resolve: any) => Promise.resolve({ count: 0, error: null }).then(resolve) };
  for (const method of [eq, gt, select, remove]) method.mockReturnValue(chain);
  (supabaseAdmin.from as jest.Mock).mockReturnValue(chain);
  (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({ data: { imported: true }, error: null });
});
it('requires authentication and derives ownership from the session, never the file or request', async () => {
  expect((await request(app()).post('/transfer').send({ kind: 'export' })).status).toBe(401);
  expect((await request(app()).post('/transfer').set('x-owner', 'yes').send({ kind: 'export', businessId: 'victim' })).status).toBe(400);
  expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  expect((await request(app()).post('/transfer').set('x-owner', 'yes').send({ kind: 'export' })).status).toBe(200);
  expect(supabaseAdmin.rpc).toHaveBeenCalledWith('menu_transfer_start', expect.objectContaining({ p_business_id: 'tenant-a', p_owner_id: 'owner-a' }));
});
it('previews without changing the menu and requires explicit confirmation to apply', async () => {
  const api = app();
  const preview = await request(api).post(`/transfer/${id}/preview`).set('x-owner', 'yes').send({});
  expect(preview.status).toBe(200); expect(preview.body.data.items).toBe(1);
  expect(eq).toHaveBeenCalledWith('business_id', 'tenant-a'); expect(eq).toHaveBeenCalledWith('owner_id', 'owner-a');
  expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  expect((await request(api).post(`/transfer/${id}/apply`).set('x-owner', 'yes').send({ catalog: true, confirmed: false })).status).toBe(400);
  expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  expect((await request(api).post(`/transfer/${id}/apply`).set('x-owner', 'yes').send({ catalog: true, confirmed: true })).status).toBe(200);
  const payload = (supabaseAdmin.rpc as jest.Mock).mock.calls.at(-1)[1];
  expect(payload.p_business_id).toBe('tenant-a'); expect(payload.p_owner_id).toBe('owner-a');
  expect(payload.p_document.categories[0].id).not.toBe(archiveFixture().categories[0].id);
});
it('rejects invalid archives, expired transfers, oversized chunks and incomplete uploads without writes', async () => {
  const api = app();
  stage.parts = ['{"format":"foreign"}'];
  expect((await request(api).post(`/transfer/${id}/apply`).set('x-owner', 'yes').send({ catalog: true, confirmed: true })).status).toBe(400);
  stage = { parts: [], expected_parts: 1 };
  expect((await request(api).post(`/transfer/${id}/preview`).set('x-owner', 'yes').send({})).status).toBe(409);
  stage = null;
  expect((await request(api).post(`/transfer/${id}/preview`).set('x-owner', 'yes').send({})).status).toBe(404);
  expect((await request(api).put(`/transfer/${id}/parts/0`).set('x-owner', 'yes').send({ content: 'A'.repeat(500001) })).status).toBe(400);
  expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
});
