import express from "express";
import request from "supertest";
import {
  publicBanners,
  publicCategoryHeroes,
  publicCustomConfig,
  publicImage,
} from "../services/public-menu-presentation";
import { collectPublicVitals } from "../controllers/public-vitals.controller";
import { businessEligibility } from "../services/business-eligibility.service";

jest.mock("../services/business-eligibility.service", () => ({
  businessEligibility: { findPublicBusinessBySlug: jest.fn() },
}));
afterEach(() => jest.restoreAllMocks());
test('public emoji choices preserve valid Unicode sequences and discard invented codepoints', () => {
  expect(publicCustomConfig({ home_icons: { home: 'emoji-2764-fe0f', promotion: 'emoji-3c',
    combo: '3d-fluent-trophy', most_liked: 'emoji-1f44b-1f3fd' } })).toEqual({ home_icons: {
      home: 'emoji-2764-fe0f', combo: '3d-fluent-trophy', most_liked: 'emoji-1f44b-1f3fd'
    } });
});
test('public home icons preserve absence and expose only safe icon identifiers', () => {
  expect(publicCustomConfig({ home_icons: { home: null, combo: '3d-combo', promotion: '<svg onload=alert(1)>',
    featured_product: 'javascript:alert(1)', privateToken: 'secret', best_seller: '3d-bestseller' } })).toEqual({
      home_icons: { home: null, combo: '3d-combo', best_seller: '3d-bestseller' }
    });
});
test("public presentation preserves consumer settings and strips administrative or redundant config", () => {
  expect(
    publicCustomConfig({
      enable_likes: false,
      enable_cart: true,
      welcome_tagline: "Da casa",
      intro_card: {
        enabled: true,
        title: "Olá",
        description: "Ingredientes frescos",
        privateNote: "secret",
      },
      hero_banners: ["https://example.test/banner.webp"],
      internalToken: "secret",
      owner_user_id: "owner",
      privateMetadata: { a: 1 },
    }),
  ).toEqual({
    enable_likes: false,
    enable_cart: true,
    welcome_tagline: "Da casa",
    intro_card: {
      enabled: true,
      title: "Olá",
      description: "Ingredientes frescos",
    },
  });
});
test.each([
  "javascript:alert(1)",
  "data:image/svg+xml;base64,AAAA",
  "https://user:password@example.test/photo.webp",
  "https://project.supabase.co/storage/v1/object/sign/private/photo.webp?token=private",
  "https://example.test/photo.webp?access_token=secret",
  "//example.test/photo.webp",
])("rejects active/private image source %s", (value) => {
  expect(publicImage(value)).toBeNull();
});
test("supports existing raster uploads and bounded public responsive sources without a storage migration", () => {
  expect(publicImage("data:image/jpeg;base64,YWJj")).toBe(
    "data:image/jpeg;base64,YWJj",
  );
  expect(publicImage("https://images.unsplash.com/photo?width=800")).toBe(
    "https://images.unsplash.com/photo?width=800",
  );
  expect(publicBanners(["javascript:bad", "/logo_img.webp"])).toEqual([
    "/logo_img.webp",
  ]);
  expect(
    publicCategoryHeroes(
      JSON.parse(
        '{"__proto__":{"enabled":true},"cat-1":{"enabled":false,"banners":["/hero.webp"]}}',
      ),
    ),
  ).toEqual({ "cat-1": { enabled: false, banners: ["/hero.webp"] } });
});
const app = express();
app.use(express.json());
app.post("/menu/:slug/vitals", collectPublicVitals);
app.use((error: any, _req: any, res: any, _next: any) =>
  res.status(error.name === "ZodError" ? 400 : 503).json({ success: false }),
);
const body = {
  templateCode: "modern",
  deviceClass: "mobile",
  metrics: [
    { name: "LCP", value: 2100 },
    { name: "CLS", value: 0.04 },
    { name: "INP", value: 120 },
  ],
};
test("vitals authorize freshly and emit bounded anonymous aggregates, without identifiers or request details", async () => {
  (businessEligibility.findPublicBusinessBySlug as jest.Mock).mockResolvedValue(
    { id: "tenant-private" },
  );
  const log = jest.spyOn(console, "info").mockImplementation(() => {});
  const response = await request(app)
    .post("/menu/secret-business/vitals")
    .set("Authorization", "Bearer private-token")
    .set("Cookie", "private-cookie")
    .send(body);
  expect(response.status).toBe(202);
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(businessEligibility.findPublicBusinessBySlug).toHaveBeenCalledWith(
    "secret-business",
    "id",
  );
  const record = JSON.parse(log.mock.calls[0][0]);
  expect(record.metrics.LCP).toEqual({
    count: 1,
    sum: 2100,
    good: 1,
    needsImprovement: 0,
    poor: 0,
  });
  expect(JSON.stringify(record)).not.toMatch(
    /secret|tenant-private|token|Cookie|visitorId|pageId|referrer|userAgent|127\.0\.0\.1/,
  );
});
test("a suspended tenant never submits metrics through a cached eligibility decision", async () => {
  const log = jest.spyOn(console, "info").mockImplementation(() => {});
  (businessEligibility.findPublicBusinessBySlug as jest.Mock).mockResolvedValue(
    null,
  );
  expect(
    (await request(app).post("/menu/inactive/vitals").send(body)).status,
  ).toBe(404);
  expect(log).not.toHaveBeenCalled();
});
test.each([
  { ...body, url: "https://sensitive.example/path" },
  { ...body, metrics: [{ name: "LCP", value: -1 }] },
  {
    ...body,
    metrics: [
      { name: "LCP", value: 1 },
      { name: "LCP", value: 2 },
    ],
  },
  { ...body, templateCode: "arbitrary-high-cardinality-value" },
  {
    ...body,
    metrics: [{ name: "INP", value: 12, selector: "#customer-email" }],
  },
])(
  "rejects sensitive, invalid or unbounded vital payloads",
  async (invalid) => {
    expect(
      (await request(app).post("/menu/tenant/vitals").send(invalid)).status,
    ).toBe(400);
  },
);
