import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../config/supabase";
import analyticsRoutes from "../routes/analytics.routes";
import publicRoutes from "../routes/public.routes";
import {
  menuAnalytics,
  analyticsBatchSchema,
  analyticsHash,
  csvCell,
} from "../services/menu-analytics.service";
import {
  analyticsToday,
  analyticsComparison,
  analyticsDelta,
  parseAnalyticsDate,
  validateAnalyticsRange,
} from "../services/analytics-range.service";
import { businessEligibility } from "../services/business-eligibility.service";
import { requireAnalyticsJson } from "../controllers/menu-analytics.controller";

jest.mock("../config/supabase", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: { from: jest.fn(), rpc: jest.fn() },
}));
// Session-cookie validation is covered by owner-phase1-auth; here only bind the resolved actor's tenant.
jest.mock("../middleware/auth.middleware", () => ({
  authenticateJwt: (req: any, res: any, next: any) => {
    const actor = req.get("x-test-actor");
    if (!actor)
      return res.status(401).json({ error: { code: "AUTH_REQUIRED" } });
    req.businessId = actor;
    next();
  },
}));
jest.mock("../services/business-eligibility.service", () => ({
  businessEligibility: {
    findPublicBusinessBySlug: jest.fn(async () => ({ id: "public-tenant" })),
  },
}));
let business: string, tier: string;
let calls: Array<{ name: string; args: any }>;
const origin = "http://localhost:4200";
const today = analyticsToday("America/Sao_Paulo");
function snapshot() {
  return {
    plan: { code: tier },
    entitlements: {
      ANALYTICS_BASIC: tier !== "FREE",
      ANALYTICS_ADVANCED: ["MEDIUM", "PRO"].includes(tier),
      ANALYTICS_EXPORT: tier === "PRO",
    },
  };
}
const batch = () => ({
  visitorId: randomUUID(),
  pageId: randomUUID(),
  source: "direct",
  events: [{ id: randomUUID(), eventName: "MENU_VIEW" }],
});
function app() {
  const api = express();
  api.use("/api/v1/public/menu/:slug/events", requireAnalyticsJson);
  api.use(express.json({ limit: "16kb" }));
  api.use("/api/v1/analytics", analyticsRoutes);
  api.use("/api/v1/public", publicRoutes);
  api.use((error: any, _req: any, res: any, _next: any) =>
    res
      .status(error.status || (error.name === "ZodError" ? 400 : 500))
      .json({ error: { code: error.code || "VALIDATION_ERROR" } }),
  );
  return api;
}
beforeEach(() => {
  tier = "PRO";
  business = randomUUID();
  calls = [];
  delete process.env.APP_MODE;
  delete process.env.ANALYTICS_COLLECTION_ENABLED;
  process.env.FRONTEND_ORIGINS = origin;
  process.env.ANALYTICS_HASH_SECRET = "analytics-local-test-key-".repeat(3);
  process.env.OWNER_SESSION_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString('base64');
  (businessEligibility.findPublicBusinessBySlug as jest.Mock).mockResolvedValue(
    { id: "public-tenant" },
  );
  (menuAnalytics as any).cache.clear();
  (menuAnalytics as any).settingsCache = undefined;
  (supabaseAdmin.from as jest.Mock).mockImplementation(() => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      single: async () => ({
        data: {
          timezone: "America/Sao_Paulo",
          raw_retention_days: 90,
          aggregate_retention_days: 3650,
          basic_history_days: 31,
          advanced_history_days: 730,
          complete_history_days: 3650,
          collection_started_at: new Date().toISOString(),
        },
        error: null,
      }),
    };
    return chain;
  });
  (supabaseAdmin.rpc as jest.Mock).mockImplementation(
    async (name: string, args: any) => {
      calls.push({ name, args });
      if (name === 'reserve_shared_request') return {data:true,error:null};
      if (name === "business_entitlement_snapshot")
        return { data: snapshot(), error: null };
      if (name === "analytics_ingest") return { data: 1, error: null };
      const kind = args.p_kind;
      if (kind === "summary")
        return {
          data: {
            menuViews: 12,
            visitors: 3,
            productViews: 5,
            videoPlays: 2,
            likes: 1,
            video25: 1,
            video50: 1,
            video100: 1,
            qrEntries: 1,
          },
          error: null,
        };
      if (kind === "ranking")
        return {
          data: {
            total: 1,
            rows: [
              {
                id: randomUUID(),
                name: '=HYPERLINK("bad")',
                value: 2,
                removed: false,
              },
            ],
          },
          error: null,
        };
      if (kind === "series")
        return {
          data: [
            {
              date: today,
              menuViews: 12,
              visitors: 3,
              productViews: 5,
              videoPlays: 2,
            },
          ],
          error: null,
        };
      return { data: [], error: null };
    },
  );
});
test("Free manually requesting reports/options/rankings/export receives 403 before aggregate query", async () => {
  tier = "FREE";
  for (const path of [
    "",
    "/options",
    "/rankings",
    "/export.csv",
    "/qr",
    "/product-trends",
  ])
    expect(
      (
        await request(app())
          .get("/api/v1/analytics" + path)
          .set("x-test-actor", business)
      ).status,
    ).toBe(403);
  expect(calls.some((c) => c.name === "analytics_query")).toBe(false);
});
test("unauthenticated analytics request is rejected", async () => {
  expect((await request(app()).get("/api/v1/analytics")).status).toBe(401);
});
test("Basic returns essential metrics, with no advanced queries", async () => {
  tier = "BASIC";
  const response = await request(app())
    .get("/api/v1/analytics")
    .set("x-test-actor", business);
  expect(response.status).toBe(200);
  expect(response.body.data.summary.visitors).toBe(3);
  expect(response.body.data.summary).not.toHaveProperty("qrEntries");
  expect(response.body.data.summary).not.toHaveProperty("video100");
  expect(response.body.data.categories).toBeNull();
  expect(
    calls.filter((c) => c.name === "analytics_query").map((c) => c.args.p_kind),
  ).toEqual(["summary", "series", "ranking", "ranking"]);
  expect(response.headers["cache-control"]).toBe("private, no-store");
});
test.each([
  "/export.csv",
  "/qr",
  "?source=qr",
  "?comparison=previous",
  "/rankings?metric=categories",
  "?qrId=11111111-1111-4111-8111-111111111111",
])("Basic cannot unlock resource through URL: %s", async (path) => {
  tier = "BASIC";
  expect(
    (
      await request(app())
        .get("/api/v1/analytics" + path)
        .set("x-test-actor", business)
    ).status,
  ).toBe(403);
});
test("Medium compares actual previous inclusive interval, sources/hours; Pro-only comparisons/QR/export denied", async () => {
  tier = "MEDIUM";
  const response = await request(app())
    .get("/api/v1/analytics?comparison=previous")
    .set("x-test-actor", business);
  expect(response.status).toBe(200);
  expect(response.body.data.comparison.range.days).toBe(7);
  expect(response.body.data.comparison.deltas.menuViews.percent).toBe(0);
  expect(calls.some((c) => c.args?.p_kind === "sources")).toBe(true);
  expect(calls.some((c) => c.args?.p_kind === "qr")).toBe(false);
  for (const path of [
    "/export.csv",
    "/qr",
    "?comparison=year",
    "?comparison=custom&comparisonStart=" + today + "&comparisonEnd=" + today,
  ])
    expect(
      (
        await request(app())
          .get("/api/v1/analytics" + path)
          .set("x-test-actor", business)
      ).status,
    ).toBe(403);
});
test("Pro CSV is bound to tenant and filters, escapes formulas and omits identifiers/PII", async () => {
  const qr = randomUUID();
  const r = await request(app())
    .get(
      `/api/v1/analytics/export.csv?section=products&start=${today}&end=${today}&source=qr&qrId=${qr}`,
    )
    .set("x-test-actor", business);
  expect(r.status).toBe(200);
  expect(r.headers["content-type"]).toContain("text/csv");
  expect(r.text).toContain("'=HYPERLINK");
  expect(r.text).not.toContain(business);
  expect(r.text).not.toContain(qr);
  expect(r.text).not.toMatch(/visitor_id|ip_hash|csrf|access_token/);
  const query = calls.find((c) => c.name === "analytics_query")!.args;
  expect(query.p_business).toBe(business);
  expect(query.p_qr).toBe(qr);
  expect(query.p_source).toBe("qr");
  expect(query.p_start).toBe(today);
});
test("strict params reject tenant override, impossible dates, inverted/future ranges and unknown params", async () => {
  for (const params of [
    "businessId=" + randomUUID(),
    "start=2026-02-30&end=" + today,
    "start=" + today + "&end=2020-01-01",
    "start=" + today + "&end=2099-01-01",
    "start=" + today,
    "start=&end=",
    "admin=true",
  ]) {
    expect(
      (
        await request(app())
          .get("/api/v1/analytics?" + params)
          .set("x-test-actor", business)
      ).status,
    ).toBe(400);
  }
});
test("tenant A and B use separate aggregate cache; entitlement downgrade is checked before cache", async () => {
  const b = randomUUID();
  await request(app()).get("/api/v1/analytics").set("x-test-actor", business);
  await request(app()).get("/api/v1/analytics").set("x-test-actor", b);
  expect(
    calls
      .filter((c) => c.args?.p_kind === "summary")
      .map((c) => c.args.p_business),
  ).toEqual([business, b]);
  tier = "FREE";
  expect(
    (
      await request(app())
        .get("/api/v1/analytics")
        .set("x-test-actor", business)
    ).status,
  ).toBe(403);
});
test("public collection requires trusted Origin; hashes random identity with tenant and IP without storing either raw", async () => {
  const payload = batch();
  expect(
    (
      await request(app())
        .post("/api/v1/public/menu/bistro/events")
        .send(payload)
    ).status,
  ).toBe(403);
  const response = await request(app())
    .post("/api/v1/public/menu/bistro/events")
    .set("Origin", origin)
    .send(payload);
  expect(response.status).toBe(202);
  expect(response.body.data.accepted).toBe(1);
  const args = calls.find((c) => c.name === "analytics_ingest")!.args;
  expect(args.p_visitor).toMatch(/^[a-f0-9]{64}$/);
  expect(args.p_ip_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(args)).not.toContain(payload.visitorId);
  expect(args.p_business).toBe("public-tenant");
  expect(args).not.toHaveProperty("occurred_at");
});
test("public schema refuses LIKE, arbitrary metadata/time/IP, resource mismatch, oversized batches/body", async () => {
  const payload = batch();
  for (const bad of [
    { ...payload, ip: "1.2.3.4" },
    { ...payload, occurredAt: "2020-01-01" },
    { ...payload, events: [{ ...payload.events[0], eventName: "LIKE" }] },
    {
      ...payload,
      events: [{ ...payload.events[0], metadata: { email: "private" } }],
    },
    { ...payload, events: [{ ...payload.events[0], itemId: randomUUID() }] },
    { ...payload, events: Array(21).fill(payload.events[0]) },
  ])
    expect(
      (
        await request(app())
          .post("/api/v1/public/menu/bistro/events")
          .set("Origin", origin)
          .send(bad)
      ).status,
    ).toBe(400);
  expect(
    (
      await request(app())
        .post("/api/v1/public/menu/bistro/events")
        .set("Origin", origin)
        .send({ ...payload, large: "x".repeat(20000) })
    ).status,
  ).toBe(413);
  expect(
    (
      await request(app())
        .post("/api/v1/public/menu/bistro/events")
        .set("Origin", origin)
        .type("form")
        .send({ event: "MENU_VIEW" })
    ).status,
  ).toBe(415);
  expect(calls.some((c) => c.name === "analytics_ingest")).toBe(false);
});
test("privacy signals and known bots are ignored; durable quota denial maps to 429", async () => {
  for (const [header, content] of [
    ["DNT", "1"],
    ["Sec-GPC", "1"],
    ["User-Agent", "ExampleCrawler/1.0"],
  ])
    expect(
      (
        await request(app())
          .post("/api/v1/public/menu/bistro/events")
          .set("Origin", origin)
          .set(header, content)
          .send(batch())
      ).body.data.collection,
    ).toBe("ignored");
  (supabaseAdmin.rpc as jest.Mock).mockResolvedValueOnce({
    data: -1,
    error: null,
  });
  expect(
    (
      await request(app())
        .post("/api/v1/public/menu/bistro/events")
        .set("Origin", origin)
        .send(batch())
    ).status,
  ).toBe(429);
});
test("public request spam hits HTTP rate limit independently of durable event quota", async () => {
  const api = app();
  let limited = false;
  for (let i = 0; i < 65; i++) {
    const r = await request(api)
      .post("/api/v1/public/menu/bistro/events")
      .set("Origin", origin)
      .send(batch());
    if (r.status === 429) {
      limited = true;
      break;
    }
  }
  expect(limited).toBe(true);
});
test("calendar timezone, leap years, inclusive periods and zero-denominator deltas", () => {
  expect(
    analyticsToday("America/Sao_Paulo", new Date("2026-10-02T02:30:00Z")),
  ).toBe("2026-10-01");
  expect(() => parseAnalyticsDate("2026-02-29")).toThrow();
  expect(Number.isFinite(parseAnalyticsDate("2024-02-29"))).toBe(true);
  expect(analyticsComparison("2026-09-01", "2026-09-30", "previous")).toEqual({
    start: "2026-08-02",
    end: "2026-08-31",
  });
  expect(analyticsComparison("2024-02-29", "2024-02-29", "year")).toEqual({
    start: "2023-02-28",
    end: "2023-02-28",
  });
  expect(analyticsDelta(12, 0)).toEqual({
    current: 12,
    previous: 0,
    absolute: 12,
    percent: null,
  });
  expect(validateAnalyticsRange(today, today, today, 31).bucket).toBe("hour");
  expect(csvCell(" \t=1+1")).toBe('"\' \t=1+1"');
  expect(analyticsHash("visitor", "A:id")).not.toBe(
    analyticsHash("visitor", "B:id"),
  );
  expect(
    analyticsBatchSchema.safeParse({ ...batch(), qrId: randomUUID() }).success,
  ).toBe(false);
});
