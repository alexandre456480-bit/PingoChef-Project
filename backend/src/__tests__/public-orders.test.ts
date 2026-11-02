import request from 'supertest';
import app from '../server';
import { localDb } from '../config/localDb';
import { disabledOrders } from '../utils/order-settings';

jest.mock('../config/supabase', () => ({ ...jest.requireActual('../config/supabase'), isSupabaseConfigured: false }));
const id = 'orders-public-test', previousMode = process.env.APP_MODE;
beforeAll(() => {
  process.env.APP_MODE = 'demo';
  localDb.businesses.push({ id, owner_user_id: 'owner-orders-test', name: 'Orders', slug: 'orders-public-test', status: 'ACTIVE' });
});
afterAll(() => {
  if (previousMode === undefined) delete process.env.APP_MODE; else process.env.APP_MODE = previousMode;
  localDb.businesses = localDb.businesses.filter(business => business.id !== id);
});
it('publishes validated settings, omits disabled destinations and never exposes owner data', async () => {
  const business = localDb.businesses.find(business => business.id === id)!;
  const settings = { enabled: true, channel: 'whatsapp' as const, url: 'https://wa.me/5511999999999', button_text: 'Pedir agora' };
  for (const [stored, expected] of [[undefined, disabledOrders], [settings, settings],
    [{ ...settings, enabled: false }, disabledOrders], [{ ...settings, url: 'javascript:alert(1)' }, disabledOrders]]) {
    business.order_settings = stored as any;
    const response = await request(app).get('/api/v1/public/menu/orders-public-test');
    expect(response.status).toBe(200);
    expect(response.body.data.business.orderSettings).toEqual(expected);
    expect(response.body.data.business).not.toHaveProperty('owner_user_id');
  }
});
