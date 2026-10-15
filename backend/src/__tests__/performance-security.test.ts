import express from 'express';
import request from 'supertest';
import { apiRouteGroup, apiTelemetry, performanceEndpoint } from '../middleware/api-telemetry.middleware';
import { measureAuth, measuredFetch, requestPerformance } from '../services/request-performance.service';
import { reorderMenu } from '../services/menu-order.service';
import { MenuAnalyticsService } from '../services/menu-analytics.service';
import { supabaseAdmin } from '../config/supabase';
import productVideoRoutes from '../routes/product-video.routes';

jest.mock('../config/supabase', () => ({ isSupabaseConfigured: true, supabaseAdmin: { rpc: jest.fn() } }));

afterEach(() => { jest.restoreAllMocks(); delete process.env.PERFORMANCE_BATCH_RPC_ENABLED; delete process.env.PERFORMANCE_REORDER_RPC_ENABLED; delete process.env.PERFORMANCE_ANALYTICS_BATCH_RPC_ENABLED; delete process.env.API_TELEMETRY_ENABLED; });

test('performance route labels have bounded cardinality and omit IDs, query strings and slugs', () => {
  expect(performanceEndpoint('/api/v1/auth/me?access_token=secret')).toBe('/api/v1/auth/me');
  expect(performanceEndpoint('/api/v1/public/menu/private-business')).toBe('/api/v1/public/menu/:slug');
  expect(apiRouteGroup('/api/v1/attacker-controlled')).toBe('/api/v1/other');
  expect(performanceEndpoint('/api/v1/__proto__/me?secret=hidden')).toBe('/api/v1/other');
  expect(performanceEndpoint('/api/v1/constructor/me')).toBe('/api/v1/other');
});

test('concurrent requests have separate counters; logs never contain provider URLs, cookies or bodies', async () => {
  process.env.API_TELEMETRY_ENABLED = 'true';
  const log = jest.spyOn(console, 'info').mockImplementation(() => {});
  (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });
  jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('provider-private-result'));
  const app = express(); app.use(express.json()); app.use(apiTelemetry);
  app.get('/api/v1/items', async (_req,res) => {
    await measureAuth(() => Promise.all([
      measuredFetch('supabase')('https://private.example/rest/v1/items?secret=private-query'),
      measuredFetch('external')('https://provider.example/private-token')
    ]));
    res.json({ ok: true });
  });
  await Promise.all([1,2,3].map(() => request(app).get('/api/v1/items?token=browser-secret').set('Cookie','secret-cookie')));
  expect(log).toHaveBeenCalledTimes(3);
  for (const [name, args] of (supabaseAdmin.rpc as jest.Mock).mock.calls) {
    expect(name).toBe('record_api_request_metric');
    expect(Number.isInteger(args.p_duration_ms)).toBe(true);
  }
  for (const [line] of log.mock.calls) {
    const entry = JSON.parse(line);
    expect(entry.database_calls).toBe(1); expect(entry.external_calls).toBe(1);
    expect(entry.auth_ms).toBeGreaterThanOrEqual(0); expect(entry.duration_ms).toBeGreaterThanOrEqual(0);
    expect(line).not.toMatch(/private|secret|Cookie|Authorization|provider\.example/);
  }
  expect(requestPerformance.getStore()).toBeUndefined();
});

test('batch reorder uses the supplied owner/RLS client, preserves tenant binding and propagates failure', async () => {
  process.env.PERFORMANCE_REORDER_RPC_ENABLED = 'true';
  const client: any = { rpc: jest.fn().mockResolvedValue({ data:1, error: null }), from: jest.fn() };
  const orders = [{ id: 'a', displayOrder: 1 }];
  await reorderMenu(client,'trusted-tenant','products',orders);
  expect(client.rpc).toHaveBeenCalledWith('reorder_business_menu',{p_business:'trusted-tenant',p_resource:'products',p_orders:orders});
  expect(client.from).not.toHaveBeenCalled();
  client.rpc.mockResolvedValue({ data:null, error:null });
  await expect(reorderMenu(client,'trusted-tenant','products',orders)).rejects.toMatchObject({status:503,code:'MENU_ORDER_UNCONFIRMED'});
  client.rpc.mockResolvedValue({ error: { message: 'REORDER_RESOURCE_NOT_FOUND' } });
  await expect(reorderMenu(client,'trusted-tenant','products',orders)).rejects.toMatchObject({ status:404 });
  client.rpc.mockResolvedValue({ error: { code:'42501', message:'permission denied' } });
  await expect(reorderMenu(client,'trusted-tenant','products',orders)).rejects.toMatchObject({ code:'42501' });
});

test('batched analytics cache is tenant scoped and cannot mask a fresh authorization denial', async () => {
  process.env.PERFORMANCE_ANALYTICS_BATCH_RPC_ENABLED = 'true';
  const service = new MenuAnalyticsService();
  const c: any = { business:'tenant-a', snapshot:{entitlements:{ANALYTICS_BASIC:true}}, settings:{}, advanced:false, complete:false,
    range:{start:'2026-10-01',end:'2026-10-02',bucket:'day'},query:{},comparison:null };
  (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({ data:{summary:{menuViews:1},series:[],viewed:{rows:[]},liked:{rows:[]}}, error:null });
  await service.report(c); await service.report(c);
  expect(supabaseAdmin.rpc).toHaveBeenCalledTimes(1);
  await service.report({...c,business:'tenant-b'});
  expect(supabaseAdmin.rpc).toHaveBeenCalledTimes(2);
  // Every HTTP report builds a fresh context before consulting the result cache.
  (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({data:{entitlements:{}},error:null});
  await expect(service.context('tenant-a',{comparison:'none',metric:'product_views',page:1,pageSize:5,section:'series'})).rejects.toMatchObject({status:403});
});

test.each([undefined, 'false'])('reorder legacy path stays available with independent flag %s', async flag => {
  process.env.PERFORMANCE_ANALYTICS_BATCH_RPC_ENABLED = 'true';
  process.env.PERFORMANCE_BATCH_RPC_ENABLED = 'true'; // retired flag must not activate either path
  if (flag !== undefined) process.env.PERFORMANCE_REORDER_RPC_ENABLED = flag;
  const builder: any = { update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: (resolve:any) => resolve({error:null}) };
  const client:any = {from:jest.fn().mockReturnValue(builder),rpc:jest.fn()};
  await reorderMenu(client,'trusted-tenant','products',[{id:'one',displayOrder:1}]);
  expect(client.rpc).not.toHaveBeenCalled();
  expect(builder.eq).toHaveBeenCalledWith('business_id','trusted-tenant');
});

test('reorder and retired flag cannot enable analytics batch', async () => {
  process.env.PERFORMANCE_REORDER_RPC_ENABLED = 'true';
  process.env.PERFORMANCE_BATCH_RPC_ENABLED = 'true';
  const service = new MenuAnalyticsService();
  const c:any = {business:'independent',snapshot:{entitlements:{}},settings:{},advanced:false,complete:false,
    range:{start:'2026-10-01',end:'2026-10-02',bucket:'day'},query:{},comparison:null};
  (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({data:{},error:null});
  await service.report(c);
  expect((supabaseAdmin.rpc as jest.Mock).mock.calls.some(([name])=>name==='analytics_report')).toBe(false);
});

test.each([
  ['post','/media/publish-ready'], ['get','/11111111-1111-4111-8111-111111111111/media'],
  ['post','/11111111-1111-4111-8111-111111111111/media/video/upload-intent'],
  ['post','/11111111-1111-4111-8111-111111111111/media/22222222-2222-4222-8222-222222222222/playback'],
  ['delete','/11111111-1111-4111-8111-111111111111/media/22222222-2222-4222-8222-222222222222']
])('matched media endpoint %s %s still requires a real session', async (method,path) => {
  const app=express();app.use('/api/v1/items',productVideoRoutes);
  app.use((error:any,_req:any,res:any,_next:any)=>res.status(error.status||500).json({code:error.code}));
  const result=await (request(app) as any)[method]('/api/v1/items'+path);
  expect(result.status).toBe(401); expect(result.body.code).toBe('UNAUTHORIZED');
});
