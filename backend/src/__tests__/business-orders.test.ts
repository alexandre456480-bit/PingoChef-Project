import express from 'express';
import request from 'supertest';
import { createUserClient } from '../config/supabase';
import businessRoutes from '../routes/business.routes';
import { disabledOrders, orderSettingsSchema, publicOrderSettings } from '../utils/order-settings';

jest.mock('../config/supabase', () => ({ isSupabaseConfigured: true, supabaseAdmin: {}, createUserClient: jest.fn() }));
jest.mock('../middleware/auth.middleware', () => ({ authenticateJwt: (req: any, _res: any, next: any) => {
  req.businessId = 'tenant'; req.userId = 'owner'; req.accessToken = 'owner-token'; next();
} }));
const update = jest.fn(), eq = jest.fn(), select = jest.fn();
const orders = { enabled: true, channel: 'whatsapp', url: 'https://wa.me/5511999999999', button_text: 'Pedir agora' };
function app() {
  const api = express(); api.use(express.json()); api.use('/business', businessRoutes);
  api.use((error: any, _req: any, res: any, _next: any) => res.status(error.name === 'ZodError' ? 400 : 500).json({ error: error.name }));
  return api;
}
beforeEach(() => {
  jest.clearAllMocks();
  const query = { select, update, eq, neq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) };
  select.mockReturnValue(query); update.mockReturnValue(query); eq.mockReturnValue(query);
  (createUserClient as jest.Mock).mockReturnValue({ from: () => query });
});
it('saves owner-scoped orders, reloads them, supports disabling and preserves omitted settings', async () => {
  const api = app();
  for (const settings of [orders, { ...orders, enabled: false }]) {
    expect((await request(api).put('/business').send({ name: 'Pingo', slug: 'pingo', order_settings: settings })).status).toBe(200);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ order_settings: settings }));
    expect(eq).toHaveBeenCalledWith('id', 'tenant');
    expect(eq).toHaveBeenCalledWith('owner_user_id', 'owner');
    expect(createUserClient).toHaveBeenCalledWith('owner-token');
  }
  await request(api).get('/business');
  expect(select.mock.calls.some(call => String(call[0]).includes('order_settings'))).toBe(true);
  expect((await request(api).put('/business').send({ name: 'Pingo', slug: 'pingo' })).status).toBe(200);
  expect(update.mock.calls.at(-1)[0]).not.toHaveProperty('order_settings');
});
it.each([
  { url: 'javascript:alert(1)' }, { url: 'http://wa.me/5511999999999' }, { url: 'https://wa.me.evil.com/5511999999999' },
  { url: 'https://user@wa.me/5511999999999' }, { url: 'https://wa.me/message/ABC' }, { url: 'https://chat.whatsapp.com/group' },
  { url: 'https://api.whatsapp.com/send?phone=5511999999999&phone=5511888888888' },
  { url: '' }, { channel: 'ifood', url: 'https://ifood.com.br.evil.com/' },
  { channel: 'other', url: 'https://127.0.0.1/' }, { channel: 'other', url: 'https://intranet.local/' },
  { button_text: '<svg onload=alert(1)>' }, { button_text: '' }, { button_text: 'a'.repeat(41) },
  { enabled: 'true' }, { channel: 'unknown' }, { business_id: 'other-tenant' },
])('rejects unsafe or malformed settings before saving: %j', async patch => {
  expect((await request(app()).put('/business').send({ name: 'Pingo', slug: 'pingo', order_settings: { ...orders, ...patch } })).status).toBe(400);
  expect(update).not.toHaveBeenCalled();
});
it('accepts supported destinations and fails closed for malformed public settings', () => {
  for (const [channel, url] of [['whatsapp', orders.url], ['whatsapp', 'https://api.whatsapp.com/send?phone=5511999999999&text=Oi'],
    ['ifood', 'https://www.ifood.com.br/delivery/pingo'], ['website', 'https://pingochef.com.br/pedido'], ['delivery', 'https://delivery.com.br'], ['other', 'https://pedido.com.br']]) {
    expect(orderSettingsSchema.safeParse({ ...orders, channel, url }).success).toBe(true);
  }
  for (const value of [null, {}, { ...orders, url: 'javascript:alert(1)' }, { ...orders, enabled: false }])
    expect(publicOrderSettings(value)).toEqual(disabledOrders);
});
