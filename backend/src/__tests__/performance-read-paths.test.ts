// Opt-in, isolated benchmark. No network/provider credentials or production data.
import request from 'supertest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { supabaseAdmin } from '../config/supabase';
import { encryptOwnerTokens, ownerCsrf, sessionHash } from '../services/owner-session.service';
import { menuAnalytics } from '../services/menu-analytics.service';
import app from '../server';

jest.mock('../config/localDb', () => ({ isDemoMode: () => false, localDb: {} }));
jest.mock('../config/supabase', () => {
  const client = { from: jest.fn(), rpc: jest.fn(), auth: { getUser: jest.fn() } };
  return { isSupabaseConfigured: true, supabaseAdmin: client, createUserClient: () => client };
});

const run = process.env.PERF_BENCHMARK_OUTPUT ? test : test.skip;
run('benchmark actual HTTP read paths with deterministic simulated provider latency', async () => {
  delete process.env.VERCEL;
  delete process.env.APP_MODE;
  process.env.API_TELEMETRY_ENABLED = 'false';
  process.env.OWNER_SESSION_ENCRYPTION_KEY = Buffer.alloc(32, 27).toString('base64');
  const root = resolve(__dirname, '../../..');
  const output = resolve(root, process.env.PERF_BENCHMARK_OUTPUT!);
  if (!output.startsWith(resolve(root, '.tools') + sep)) throw new Error('Benchmark output must be in .tools');
  mkdirSync(resolve(root, '.tools'), { recursive: true });
  const samples = Number(process.env.PERF_SAMPLES || 30);
  const rtt = Number(process.env.PERF_RTT_MS || 10);
  if (!Number.isInteger(samples) || samples < 5 || samples > 1000 || rtt < 0 || rtt > 100) throw new Error('Invalid benchmark budget');
  const user = '10000000-0000-4000-8000-000000000001';
  const business = '20000000-0000-4000-8000-000000000002';
  const token = 'a'.repeat(64), hash = sessionHash(token);
  const now = Date.now();
  const snapshot = {
    plan: { code: 'PRO', name: 'Pro' }, subscription: { status: 'active' },
    entitlements: { ANALYTICS_BASIC: true, ANALYTICS_ADVANCED: true, ANALYTICS_EXPORT: true, QR_GENERATOR: true, QR_CUSTOMIZATION: true },
    usage: { products: 1, categories: 1, videos: 0 },
  };
  const summary = { menuViews: 1, visitors: 1, productViews: 1, videoPlays: 0, likes: 0, qrEntries: 0, video25: 0, video50: 0, video100: 0 };
  const fixtures: Record<string, any> = {
    owner_sessions: { session_hash: hash, user_id: user, scope: 'owner', encrypted_tokens: encryptOwnerTokens({ accessToken: 'benchmark-only', refreshToken: '' }, hash), token_expires_at: new Date(now + 3600000).toISOString(), expires_at: new Date(now + 3600000).toISOString(), last_seen_at: new Date(now).toISOString(), created_at: new Date(now).toISOString(), revoked_at: null },
    admin_identities: null,
    businesses: { id: business, owner_user_id: user, name: 'Benchmark', slug: 'benchmark', status: 'ACTIVE' },
    profiles: { full_name: 'Benchmark' }, business_account_state: { is_published: true }, platform_events: [],
    categories: [{ id: '30000000-0000-4000-8000-000000000003', name: 'Category', display_order: 0, is_active: true }],
    menu_items: [{ id: '40000000-0000-4000-8000-000000000004', name: 'Product', price: 10, is_available: true, display_order: 0, categories: { name: 'Category' } }],
    subcategories: [], product_media: [], analytics_qr_refs: [], qr_settings: { max_codes_per_business: 100 },
    design_settings: { template_key: 'modern', home_blocks: [], custom_config: {}, palette: {} },
    analytics_settings: { timezone: 'America/Sao_Paulo', basic_history_days: 31, advanced_history_days: 730, complete_history_days: 3650, raw_retention_days: 90, aggregate_retention_days: 3650, collection_started_at: new Date(now - 86400000).toISOString() },
  };
  let db = 0, external = 0, inFlight = 0, peak = 0, dbBytes = 0;
  const delayed = async (data: any, provider = false) => {
    if (provider) external++; else { db++; dbBytes += Buffer.byteLength(JSON.stringify(data)); }
    inFlight++; peak = Math.max(peak, inFlight);
    await new Promise((accept) => setTimeout(accept, rtt));
    inFlight--;
    return { data, error: null };
  };
  (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
    const builder: any = {};
    for (const method of ['select', 'eq', 'is', 'in', 'gt', 'order', 'limit', 'maybeSingle', 'single', 'update', 'range']) builder[method] = () => builder;
    builder.then = (accept: any, reject: any) => delayed(Object.hasOwn(fixtures, table) ? fixtures[table] : []).then(accept, reject);
    return builder;
  });
  (supabaseAdmin.auth.getUser as jest.Mock).mockImplementation(async () => {
    await delayed(null, true); return { data: { user: { id: user, email: 'benchmark@example.invalid' } }, error: null };
  });
  (supabaseAdmin.rpc as jest.Mock).mockImplementation((name: string, args: any) => {
    if (name === 'business_entitlement_snapshot') return delayed(snapshot);
    if (name === 'reorder_business_menu') return delayed(args.p_orders.length);
    if (name === 'analytics_query') return delayed(args.p_kind === 'summary' ? summary : args.p_kind === 'ranking' ? { total: 0, rows: [] } : []);
    // The batch endpoint is measured after migration-backed implementation; same data contract.
    if (name === 'analytics_report') return delayed({ summary, series: [], viewed: { total: 0, rows: [] }, liked: { total: 0, rows: [] }, categories: { total: 0, rows: [] }, sources: [], hours: [], qr: [], previous: null });
    return delayed(true);
  });
  const paths = process.env.PERF_ONLY_REORDER === 'true' ? ['/api/v1/items/reorder'] : ['/api/v1/auth/me', '/api/v1/items', '/api/v1/categories', '/api/v1/design', '/api/v1/public/menu/benchmark', '/api/v1/analytics', '/api/v1/qr', '/api/v1/items/reorder'];
  const rows = [];
  for (const path of paths) {
    const durations: number[] = [], counts: { db: number; external: number }[] = [], peaks: number[] = [], sizes: number[] = [];
    for (let i = 0; i < samples; i++) {
      // Cold report-cache scenario, not a claim about production hit rate.
      (menuAnalytics as any).cache.clear(); (menuAnalytics as any).settingsCache = undefined;
      db = external = inFlight = peak = dbBytes = 0;
      const started = performance.now();
      const call = path.endsWith('/reorder')
        ? request(app).patch(path).set('Origin', 'http://localhost:4200').set('X-CSRF-Token', ownerCsrf(token))
          .send({ orders: Array.from({ length: 20 }, (_, n) => ({ id: `40000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`, displayOrder: n })) })
        : request(app).get(path);
      const result = await call.set('Cookie', `pc_owner_session=${token}`);
      if (result.status !== 200) throw new Error(`${path}: ${result.status} ${result.body?.error?.code}`);
      durations.push(performance.now() - started); counts.push({ db, external }); peaks.push(peak); sizes.push(Buffer.byteLength(result.text));
    }
    durations.sort((a, b) => a - b);
    const percentile = (p: number) => +durations[Math.ceil(samples * p) - 1].toFixed(2);
    rows.push({ endpoint: path, samples, p50_ms: percentile(.5), p95_ms: percentile(.95), p99_ms: percentile(.99), db_round_trips: counts[0].db, external_calls: counts[0].external, max_concurrent_calls: Math.max(...peaks), http_bytes: sizes[0] });
  }
  writeFileSync(output, JSON.stringify({ scenario: 'Local HTTP + mocked database/Auth, cold report cache; not production latency', reorder_rpc_enabled: process.env.PERFORMANCE_REORDER_RPC_ENABLED === 'true', analytics_batch_rpc_enabled: process.env.PERFORMANCE_ANALYTICS_BATCH_RPC_ENABLED === 'true', simulated_rtt_ms: rtt, node: process.version, rows }, null, 2));
  console.log(JSON.stringify(rows));
}, 180000);
