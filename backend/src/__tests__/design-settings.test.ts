import express from 'express';
import request from 'supertest';
import { createUserClient } from '../config/supabase';
import designRoutes from '../routes/design.routes';

jest.mock('../config/supabase', () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: { from: jest.fn() },
  createUserClient: jest.fn()
}));
jest.mock('../middleware/auth.middleware', () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    req.businessId = 'owner-business';
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
function app() {
  const api = express();
  api.use(express.json());
  api.use('/design', designRoutes);
  api.use((error: any, _req: any, res: any, _next: any) => res.status(error.name === 'ZodError' ? 400 : 500).json({ error: error.name }));
  return api;
}
beforeEach(() => {
  upsert.mockResolvedValue({ error: null });
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
