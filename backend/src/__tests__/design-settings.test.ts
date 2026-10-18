import express from 'express';
import request from 'supertest';
import { createUserClient, supabaseAdmin } from '../config/supabase';
import designRoutes from '../routes/design.routes';
import businessRoutes from '../routes/business.routes';

jest.mock('../config/supabase', () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: { from: jest.fn(), rpc: jest.fn() },
  createUserClient: jest.fn()
}));
jest.mock('../middleware/auth.middleware', () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    req.businessId = 'owner-business';
    req.userId = 'owner-user';
    req.accessToken = 'owner-token';
    next();
  }
}));

const palette = {
  key: 'graphite_copper', name: 'Grafite & Cobre',
  colors: {
    primary: '#E8AE8C', secondary: '#62626C', accent: '#F8D3B1',
    background: '#202024', surface: '#303036', textPrimary: '#F9F5F1', textSecondary: '#C0B9B3'
  }
};
const upsert = jest.fn();
it.each(['emoji-2764-fe0f', 'emoji-1f44b-1f3fd', 'emoji-1f1e7-1f1f7', '3d-fluent-trophy', '2d-phosphor-trophy'])(
  'persists safe expanded catalog choice %s without changing tenant ownership', async home => {
    const response = await request(app()).put('/design').send({ palette, custom_config: { home_icons: { home } } });
    expect(response.status).toBe(200);
    expect(upsert.mock.calls[0][0]).toMatchObject({ business_id: 'owner-business', custom_config: { home_icons: { home } } });
  });
it('persists independent home icon choices including explicit absence', async () => {
  const response = await request(app()).put('/design').send({ palette,
    custom_config: { enable_cart: false, home_icons: { home: '2d-star', most_liked: null, featured_product: '3d-fire' } } });
  expect(response.status).toBe(200);
  expect(upsert.mock.calls[0][0]).toMatchObject({ business_id: 'owner-business',
    custom_config: { enable_cart: false, home_icons: { home: '2d-star', most_liked: null, featured_product: '3d-fire' } } });
});
it.each([
  { home: '<svg onload="alert(1)">' }, { home: 'https://example.test/icon.svg' },
  { home: false }, { privateField: '2d-star' }, { combo: '2d-' + 'a'.repeat(61) },
  { home: 'emoji-d800' }, { home: 'emoji-110000' }, { home: 'emoji-3c' }, { home: 'emoji-1f600-1f600' },
])('rejects invalid home icon config %j', async home_icons => {
  const response = await request(app()).put('/design').send({ palette, custom_config: { home_icons } });
  expect(response.status).toBe(400); expect(upsert).not.toHaveBeenCalled();
});
function app() {
  const api = express();
  api.use(express.json());
  api.use('/design', designRoutes);
  api.use('/business', businessRoutes);
  api.use((error: any, _req: any, res: any, _next: any) => res.status(error.name === 'ZodError' ? 400 : 500).json({ error: error.name }));
  return api;
}
beforeEach(() => {
  upsert.mockResolvedValue({ error: null });
  (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });
  (createUserClient as jest.Mock).mockReturnValue({ from: () => ({ upsert }) });
});

it.each([undefined, 'slide'])('saves new palette/fonts without motion, accepting legacy value %s', async motion => {
  const response = await request(app()).put('/design').send({
    palette, font_heading: 'Oswald', font_body: 'Source Sans 3', font_pair: 'bold_street',
    motion, custom_config: { hero_banners: ['https://example.test/banner.webp'], enable_cart: false }
  });
  expect(response.status).toBe(200);
  expect(createUserClient).toHaveBeenCalledWith('owner-token');
  const saved = upsert.mock.calls[0][0];
  expect(saved).toMatchObject({
    business_id: 'owner-business', palette, font_heading: 'Oswald', font_body: 'Source Sans 3',
    custom_config: { hero_banners: ['https://example.test/banner.webp'], enable_cart: false }
  });
  expect(saved).not.toHaveProperty('motion');
  expect(response.body.data).not.toHaveProperty('motion');
});

it('saves the compact showcase template and publishes the owner menu', async () => {
  const api = app();
  const response = await request(api).put('/design').send({
    template_key: 'showcase', palette, font_heading: 'Oswald', font_body: 'Source Sans 3'
  });
  expect(response.status).toBe(200);
  expect(upsert.mock.calls[0][0]).toMatchObject({
    template_key: 'showcase', palette, font_heading: 'Oswald', font_body: 'Source Sans 3'
  });
  const published = await request(api).post('/business/publish').send({});
  expect(published.status).toBe(200);
  expect(published.body).toMatchObject({ success: true, data: { published: true } });
  expect(supabaseAdmin.rpc).toHaveBeenCalledWith('publish_business_menu', {
    p_business_id: 'owner-business', p_owner_id: 'owner-user'
  });
});

it.each([
  { font_heading: 'Inter; background:url(https://example.test)' },
  { palette: { ...palette, colors: { ...palette.colors, primary: 'url(javascript:alert(1))' } } },
  { business_id: 'another-business' },
  { paletteFilter: 'dark' }
])('rejects unsafe styles, tenant overrides and UI-only fields before writing: %j', async extra => {
  const response = await request(app()).put('/design').send({ palette, ...extra });
  expect(response.status).toBe(400);
  expect(upsert).not.toHaveBeenCalled();
});
