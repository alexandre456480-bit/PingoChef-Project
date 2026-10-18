import express from 'express';
import request from 'supertest';
import businessRoutes from '../routes/business.routes';
import { supabaseAdmin } from '../config/supabase';
jest.mock('../config/supabase', () => ({ isSupabaseConfigured: true, supabaseAdmin: { from: jest.fn() } }));
jest.mock('../middleware/auth.middleware', () => ({
  authenticateJwt: (req: any, res: any, next: any) => {
    if (!req.get('x-test-owner')) return res.sendStatus(401);
    req.userId = req.get('x-test-owner'); req.businessId = 'owned-business'; next();
  },
}));
let rows: Record<string, any>, filters: Array<[string, unknown]>, fail: boolean;
const empty = () => ({ tutorial_status: 'NOT_STARTED', tutorial_version: 1, tutorial_step: 'welcome',
  tutorial_started_at: null, tutorial_finished_at: null });
const app = express();
app.use(express.json()); app.use('/business', businessRoutes);
app.use((error: any, _req: any, res: any, _next: any) => res.status(error.name === 'ZodError' ? 400 : error.status || 500).json({ error: error.code }));
beforeEach(() => {
  process.env.APP_MODE = 'production';
  rows = { alice: empty(), bob: empty() }; filters = []; fail = false;
  (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
    expect(table).toBe('profiles');
    let update: any, user = '', status: string | undefined;
    const chain: any = {
      select: () => chain,
      eq: (key: string, value: any) => { filters.push([key, value]); if (key === 'id') user = value; else status = value; return chain; },
      update: (data: any) => { update = data; return chain; },
      maybeSingle: async () => {
        if (fail) return { error: { message: 'database unavailable' } };
        if (update && rows[user]?.tutorial_status !== status) return { data: null, error: null };
        if (update) rows[user] = { ...rows[user], ...update };
        return { data: rows[user] ? { ...rows[user] } : null, error: null };
      },
    }; return chain;
  });
});
const patch = (action: string, step = 'welcome', extra = {}) => request(app).patch('/business/tutorial')
  .set('x-test-owner', 'alice').send({ action, step, version: 1, ...extra });
it('requires owner authentication for reads and writes', async () => {
  expect((await request(app).get('/business/tutorial')).status).toBe(401);
  expect((await request(app).patch('/business/tutorial').send({})).status).toBe(401);
});
it('starts once, resumes the saved step and preserves the original start timestamp', async () => {
  expect((await request(app).get('/business/tutorial').set('x-test-owner', 'alice')).body.data.tutorial_status).toBe('NOT_STARTED');
  await patch('start'); const started = rows.alice.tutorial_started_at;
  await patch('progress', 'products');
  const resumed = await patch('start');
  expect(resumed.body.data).toMatchObject({ tutorial_status: 'IN_PROGRESS', tutorial_step: 'products', tutorial_started_at: started });
});
it.each(['complete', 'skip'])('keeps %s terminal until an explicit restart', async action => {
  await patch('start'); await patch(action, action === 'complete' ? 'finish' : 'home');
  const finished = { ...rows.alice };
  await patch('start'); await patch('progress', 'company');
  expect(rows.alice).toEqual(finished);
  expect(finished.tutorial_finished_at).toBeTruthy();
  expect((await patch('restart')).body.data).toMatchObject({ tutorial_status: 'IN_PROGRESS', tutorial_step: 'welcome', tutorial_finished_at: null });
});
it('isolates profiles using authenticated identity and rejects tenant/id injection', async () => {
  await patch('start');
  expect(rows.bob).toEqual(empty());
  expect(filters).toContainEqual(['id', 'alice']);
  expect((await patch('progress', 'company', { userId: 'bob', businessId: 'other' })).status).toBe(400);
});
it('validates transitions, step ids, versions and completion', async () => {
  expect((await patch('progress', 'company')).status).toBe(409);
  expect((await patch('start', 'arbitrary-selector')).status).toBe(400);
  expect((await patch('start', 'welcome', { version: 99 })).status).toBe(400);
  await patch('start'); expect((await patch('complete', 'home')).status).toBe(400);
});
it('fails closed if profile persistence is unavailable', async () => {
  fail = true;
  const response = await patch('start');
  expect(response.status).toBe(503); expect(response.body.error).toBe('TUTORIAL_UNAVAILABLE');
  expect(rows.alice).toEqual(empty());
});
