import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { Resvg } from "@resvg/resvg-js";
import { supabaseAdmin } from "../config/supabase";
import qrRoutes from "../routes/qr.routes";
import publicRoutes from "../routes/public.routes";
import { businessEligibility } from "../services/business-eligibility.service";
import {
  defaultQrConfiguration,
  qrContrast,
  renderQr,
  sanitizeQrConfiguration,
  qrPublicUrl,
} from "../services/qr.service";
import { quotaHash } from "../middleware/shared-rate-limit.middleware";

jest.mock("../config/supabase", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: { from: jest.fn(), rpc: jest.fn() },
}));
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
  businessEligibility: { isPublicEligible: jest.fn() },
}));
const business = randomUUID(),
  other = randomUUID(),
  qr = randomUUID(),
  otherQr = randomUUID(),
  identifier = randomUUID();
let tier: string, quota: boolean, unavailable: boolean, eligible: boolean;
let rows: any[], calls: Array<{ name: string; args: any }>;
const origin = "http://localhost:4200";
const body = () => ({
  name: "QR Mesa 1",
  configuration: { ...defaultQrConfiguration },
});
function row(id = qr, tenant = business) {
  return {
    id,
    business_id: tenant,
    label: "QR Mesa 1",
    public_identifier: identifier,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    revision: 1,
    configuration: { ...defaultQrConfiguration },
  };
}
function app() {
  const api = express();
  api.use(express.json({ limit: "64kb" }));
  api.use("/qr", qrRoutes);
  api.use("/public", publicRoutes);
  api.use((e: any, _req: any, res: any, _next: any) =>
    res
      .status(e.status || (e.name === "ZodError" ? 400 : 500))
      .json({ error: { code: e.code || "VALIDATION_ERROR" } }),
  );
  return api;
}
beforeEach(() => {
  tier = "MEDIUM";
  quota = true;
  unavailable = false;
  eligible = true;
  rows = [row(), row(otherQr, other)];
  calls = [];
  process.env.OWNER_SESSION_ENCRYPTION_KEY = Buffer.alloc(32, 17).toString(
    "base64",
  );
  process.env.FRONTEND_ORIGINS = origin;
  process.env.PUBLIC_MENU_ORIGIN = origin;
  delete process.env.APP_MODE;
  (businessEligibility.isPublicEligible as jest.Mock).mockImplementation(
    async () => eligible,
  );
  (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
    const filters: Record<string, any> = {};
    const chain: any = {
      select: () => chain,
      eq: (k: string, v: any) => {
        filters[k] = v;
        return chain;
      },
      order: () => chain,
      limit: () => chain,
    };
    const result = () => ({
      data:
        table === "qr_settings"
          ? { max_codes_per_business: 20 }
          : table === "businesses"
            ? { slug: "novo-bistro" }
            : rows.filter((r) =>
                Object.entries(filters).every(([key, v]) => r[key] === v),
              ),
      error: null,
    });
    chain.single = async () => result();
    chain.maybeSingle = async () => {
      const r = result();
      return { ...r, data: Array.isArray(r.data) ? r.data[0] || null : r.data };
    };
    chain.then = (accept: any, reject: any) =>
      Promise.resolve(result()).then(accept, reject);
    return chain;
  });
  (supabaseAdmin.rpc as jest.Mock).mockImplementation(
    async (name: string, args: any) => {
      calls.push({ name, args });
      if (name === "reserve_shared_request")
        return {
          data: quota,
          error: unavailable ? { message: "private database error" } : null,
        };
      if (name === "business_entitlement_snapshot")
        return {
          data: {
            entitlements: {
              QR_GENERATOR: ["MEDIUM", "PRO"].includes(tier),
              QR_CUSTOMIZATION: true,
            },
          },
          error: null,
        };
      if (name === "manage_business_qr") {
        const found = args.p_id
          ? rows.find(
              (r) => r.id === args.p_id && r.business_id === args.p_business,
            )
          : row();
        if (!found) return { data: null, error: { message: "QR_NOT_FOUND" } };
        return {
          data: {
            ...found,
            label: args.p_label,
            configuration: args.p_configuration,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
  );
});
it.each(["FREE", "BASIC"])(
  "%s rejects real list/create/update/render and never reads QR rows",
  async (plan) => {
    tier = plan;
    const api = app();
    for (const [method, path, payload] of [
      ["get", "/qr", null],
      ["post", "/qr", body()],
      ["put", `/qr/${qr}`, { ...body(), active: true, revision: 1 }],
      ["get", `/qr/${qr}/image`, null],
    ] as const) {
      const r = await request(api)
        [method](path)
        .set("x-test-actor", business)
        .send(payload || undefined);
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe("QR_NOT_ENTITLED");
    }
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
    expect(
      calls.some(
        (c) =>
          c.name === "manage_business_qr" ||
          c.name === "reserve_shared_request",
      ),
    ).toBe(false);
  },
);
it.each(["MEDIUM", "PRO"])(
  "%s generates only a canonical QR URL without receiving a tenant/plan/URL",
  async (plan) => {
    tier = plan;
    const r = await request(app())
      .post("/qr")
      .set("x-test-actor", business)
      .send(body());
    expect(r.status).toBe(201);
    expect(r.body.data.publicUrl).toBe(`${origin}/q/${identifier}`);
    expect(r.body.data.business_id).toBeUndefined();
    expect(
      calls.find((c) => c.name === "manage_business_qr")?.args.p_business,
    ).toBe(business);
  },
);
it("rejects mass assignment, arbitrary redirects, query tenant, script names and invalid IDs", async () => {
  const api = app();
  for (const extra of [
    { business_id: other },
    { plan_id: "PRO" },
    { planCode: "PRO" },
    { url: "https://evil.test" },
    { publicIdentifier: otherQr },
  ]) {
    expect(
      (
        await request(api)
          .post("/qr")
          .set("x-test-actor", business)
          .send({ ...body(), ...extra })
      ).status,
    ).toBe(400);
  }
  expect(
    (
      await request(api)
        .post("/qr")
        .set("x-test-actor", business)
        .send({ ...body(), name: "<img src=x onerror=alert(1)>" })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(api)
        .get(`/qr?businessId=${other}`)
        .set("x-test-actor", business)
    ).status,
  ).toBe(400);
  expect(
    (
      await request(api)
        .get("/qr/not-a-uuid/image")
        .set("x-test-actor", business)
    ).status,
  ).toBe(400);
  expect(
    (
      await request(api)
        .get(`/qr/${qr}/image?url=https://evil.test`)
        .set("x-test-actor", business)
    ).status,
  ).toBe(400);
});
it("tenant A lists only A and cannot render/update B by its UUID", async () => {
  const api = app();
  const list = await request(api).get("/qr").set("x-test-actor", business);
  expect(list.body.data.rows.map((r: any) => r.id)).toEqual([qr]);
  expect(
    (
      await request(api)
        .get(`/qr/${otherQr}/image`)
        .set("x-test-actor", business)
    ).status,
  ).toBe(404);
  expect(
    (
      await request(api)
        .put(`/qr/${otherQr}`)
        .set("x-test-actor", business)
        .send({ ...body(), active: true, revision: 1 })
    ).status,
  ).toBe(404);
});
it("shared quota denies before expensive render; database failure is closed and sanitized", async () => {
  quota = false;
  let r = await request(app())
    .get(`/qr/${qr}/image`)
    .set("x-test-actor", business);
  expect(r.status).toBe(429);
  expect(r.headers["retry-after"]).toBe("60");
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
  unavailable = true;
  r = await request(app())
    .post("/qr")
    .set("x-test-actor", business)
    .send(body());
  expect(r.status).toBe(503);
  expect(r.body.error.code).toBe("SHARED_QUOTA_UNAVAILABLE");
});
it("public resolver returns a legitimate current slug, never a redirect, and refuses paused/ineligible codes", async () => {
  const api = app();
  let r = await request(api).get(`/public/qr/${identifier}`);
  expect(r.status).toBe(200);
  expect(r.body.data).toEqual({ slug: "novo-bistro", qrId: qr });
  expect(r.headers.location).toBeUndefined();
  expect(
    (await request(api).get(`/public/qr/${identifier}?next=https://evil.test`))
      .status,
  ).toBe(400);
  rows = rows.map((r) => ({ ...r, active: false }));
  expect((await request(api).get(`/public/qr/${identifier}`)).status).toBe(404);
  rows = [row()];
  eligible = false;
  expect((await request(api).get(`/public/qr/${identifier}`)).status).toBe(404);
});
it("enforces contrast, rejects remote/SVG logos and checks image dimensions before inflation", () => {
  expect(qrContrast("#FFFFFF")).toBe(1);
  expect(() =>
    sanitizeQrConfiguration({ ...defaultQrConfiguration, color: "#F47B20" }),
  ).toThrow(/contraste/);
  for (const logoPng of [
    "https://169.254.169.254/metadata",
    'data:image/svg+xml,<svg onload="alert(1)"/>',
    "data:image/png;base64,dGVzdA==",
  ])
    expect(() =>
      sanitizeQrConfiguration({ ...defaultQrConfiguration, logoPng }),
    ).toThrow();
  const bomb = Buffer.alloc(33);
  Buffer.from("89504e470d0a1a0a", "hex").copy(bomb);
  bomb.writeUInt32BE(13, 8);
  bomb.write("IHDR", 12);
  bomb.writeUInt32BE(0x7fffffff, 16);
  expect(() =>
    sanitizeQrConfiguration({
      ...defaultQrConfiguration,
      logoPng: `data:image/png;base64,${bomb.toString("base64")}`,
    }),
  ).toThrow();
});
it("origin is fixed and hashes hide subjects with separated scopes", () => {
  expect(qrPublicUrl(identifier)).toBe(`${origin}/q/${identifier}`);
  process.env.PUBLIC_MENU_ORIGIN = "https://evil.test";
  expect(() => qrPublicUrl(identifier)).toThrow();
  process.env.PUBLIC_MENU_ORIGIN = `${origin}/redirect?url=x`;
  expect(() => qrPublicUrl(identifier)).toThrow();
  expect(quotaHash("qr-owner", business)).toMatch(/^[a-f0-9]{64}$/);
  expect(quotaHash("qr-owner", business)).not.toBe(
    quotaHash("qr-render", business),
  );
});
it.each(["png", "svg"] as const)(
  "%s renders with safe headers and a downloadable opaque filename",
  async (format) => {
    const r = await request(app())
      .get(`/qr/${qr}/image?format=${format}`)
      .set("x-test-actor", business);
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toContain(
      format === "png" ? "image/png" : "image/svg+xml",
    );
    expect(r.headers["content-disposition"]).toContain(`${qr}.${format}`);
    expect(r.headers["cache-control"]).toBe("private, no-store");
    expect(r.headers["content-security-policy"]).toContain("sandbox");
  },
);
it("real PNG and SVG variants decode to the exact canonical URL with logo, frame and Portuguese text", () => {
  const logo = new PNG({ width: 64, height: 64 });
  for (let i = 0; i < logo.data.length; i += 4) {
    logo.data[i] = 105;
    logo.data[i + 1] = 21;
    logo.data[i + 2] = 37;
    logo.data[i + 3] = 255;
  }
  const logoPng = `data:image/png;base64,${PNG.sync.write(logo).toString("base64")}`;
  for (const color of ["#2C1024", "#595959"])
    for (const frame of ["none", "card"] as const)
      for (const image of [null, logoPng]) {
        const config = {
          color,
          frame,
          caption: "Cardápio à sua mesa & bom apetite",
          logoPng: image,
        };
        for (const format of ["png", "svg"] as const) {
          const url = qrPublicUrl(identifier);
          const result = renderQr(url, config, format);
          if (format === "svg") {
            expect(result.toString()).not.toMatch(
              /<script|<text|onload=|https?:\/\/evil/,
            );
          }
          const png = PNG.sync.read(
            format === "png"
              ? result
              : new Resvg(result, { font: { loadSystemFonts: false } })
                  .render()
                  .asPng(),
          );
          const decoded = jsQR(
            new Uint8ClampedArray(png.data),
            png.width,
            png.height,
          );
          expect(decoded?.data).toBe(url);
        }
      }
});
