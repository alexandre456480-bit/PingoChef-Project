import request from 'supertest';
import app from '../server';
import { businessEligibility } from '../services/business-eligibility.service';

// Exercise the actual parser, router and limiter without customer data/network.
jest.mock('../config/supabase', () => ({ isSupabaseConfigured: false,
  supabaseAdmin: { rpc: jest.fn(), from: jest.fn() } }));
jest.mock('../services/business-eligibility.service', () => ({ businessEligibility: {
  findPublicBusinessBySlug: jest.fn(), isPublicEligible: jest.fn(), isAccountActive: jest.fn(),
} }));
const path = '/api/v1/public/menu/vitals-test/vitals';
const body = { templateCode: 'modern', deviceClass: 'mobile', metrics: [{ name: 'LCP', value: 1200 }] };
beforeEach(() => {
  (businessEligibility.findPublicBusinessBySlug as jest.Mock).mockResolvedValue({ id: 'eligible-tenant' });
});
afterEach(() => jest.restoreAllMocks());
test('rejects non-JSON and oversized vitals before eligibility or aggregation', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  expect((await request(app).post(path).type('text').send('private text')).status).toBe(415);
  expect((await request(app).post(path).send({ ...body, extra: 'x'.repeat(3000) })).status).toBe(413);
  expect(businessEligibility.findPublicBusinessBySlug).not.toHaveBeenCalled();
});
test('rate-limits accepted metrics and checks fresh eligibility on every accepted request', async () => {
  const log = jest.spyOn(console, 'info').mockImplementation(() => {});
  for (let i = 0; i < 30; i++) {
    const response = await request(app).post(path).send(body);
    expect(response.status).toBe(202);
    expect(response.headers['cache-control']).toBe('no-store');
  }
  expect((await request(app).post(path).send(body)).status).toBe(429);
  expect(businessEligibility.findPublicBusinessBySlug).toHaveBeenCalledTimes(30);
  expect(log).toHaveBeenCalledTimes(30);
});
