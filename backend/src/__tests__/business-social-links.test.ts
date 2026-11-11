import express from "express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import platforms from "../constants/social-platforms.json";
import request from "supertest";
import { createUserClient } from "../config/supabase";
import businessRoutes from "../routes/business.routes";
import { publicSocialLinks, socialLinksSchema } from "../utils/social-links";

jest.mock("../config/supabase", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: {},
  createUserClient: jest.fn(),
}));
jest.mock("../middleware/auth.middleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    req.businessId = "tenant";
    req.userId = "owner";
    req.accessToken = "owner-token";
    next();
  },
}));

const instagram = {
  platform: "instagram",
  url: "https://www.instagram.com/pingochef/",
};
it("keeps independently deployable frontend and backend platform catalogs in sync", () => {
  const frontend = JSON.parse(readFileSync(resolve(__dirname, "../../../frontend/src/app/constants/social-platforms.json"), "utf8"));
  expect(frontend).toEqual(platforms);
});
const update = jest.fn(),
  eq = jest.fn(),
  select = jest.fn();
function app() {
  const api = express();
  api.use(express.json());
  api.use("/business", businessRoutes);
  api.use((error: any, _req: any, res: any, _next: any) =>
    res
      .status(error.name === "ZodError" ? 400 : 500)
      .json({ error: error.name }),
  );
  return api;
}
beforeEach(() => {
  jest.clearAllMocks();
  const query = {
    select,
    update,
    eq,
    neq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  select.mockReturnValue(query);
  update.mockReturnValue(query);
  eq.mockReturnValue(query);
  (createUserClient as jest.Mock).mockReturnValue({ from: () => query });
});

it("persists links through the existing owner-scoped update, preserving old-client omission", async () => {
  const api = app();
  let response = await request(api)
    .put("/business")
    .send({ name: "Pingo", slug: "pingo", social_links: [instagram] });
  expect(response.status).toBe(200);
  expect(update).toHaveBeenLastCalledWith(
    expect.objectContaining({ social_links: [instagram] }),
  );
  expect(eq).toHaveBeenCalledWith("id", "tenant");
  expect(eq).toHaveBeenCalledWith("owner_user_id", "owner");
  expect(createUserClient).toHaveBeenCalledWith("owner-token");
  response = await request(api)
    .put("/business")
    .send({ name: "Pingo", slug: "pingo" });
  expect(response.status).toBe(200);
  expect(update.mock.calls.at(-1)[0]).not.toHaveProperty("social_links");
  response = await request(api)
    .put("/business")
    .send({ name: "Pingo", slug: "pingo", social_links: [] });
  expect(response.status).toBe(200);
  expect(update.mock.calls.at(-1)[0].social_links).toEqual([]);
});

it("includes persisted links when the company is reloaded", async () => {
  expect((await request(app()).get("/business")).status).toBe(404);
  expect(select.mock.calls[0][0]).toContain("social_links");
  expect(select.mock.calls[0][0]).toContain("welcome_bg_accent_color");
});

it("persists the welcome accent for the owner and preserves omitted values", async () => {
  const api = app();
  expect((await request(api).put('/business').send({ name: 'Pingo', slug: 'pingo', welcome_bg_accent_color: '#FFB800' })).status).toBe(200);
  expect(update.mock.calls.at(-1)[0].welcome_bg_accent_color).toBe('#FFB800');
  expect((await request(api).put('/business').send({ name: 'Pingo', slug: 'pingo' })).status).toBe(200);
  expect(update.mock.calls.at(-1)[0]).not.toHaveProperty('welcome_bg_accent_color');
});

it.each(['red', '#12345', 'url(https://example.com)', '#ffffff;display:none'])("rejects invalid welcome accent %s before writing", async (color) => {
  expect((await request(app()).put('/business').send({ name: 'Pingo', slug: 'pingo', welcome_bg_accent_color: color })).status).toBe(400);
  expect(update).not.toHaveBeenCalled();
});

it.each([
  "javascript:alert(1)",
  "data:text/html,test",
  "http://instagram.com/pingo",
  "https://instagram.com.evil.com/pingo",
  "https://instagram.com@evil.com/pingo",
  "https://user:password@instagram.com/pingo",
  "https://instagram.com:444/pingo",
  "https://instagram.com\\@evil.com",
  "https://instagram.com/\nfoo",
  "https://instagram.com%2fevil.com",
  "https://instagram.com/" + "a".repeat(2048),
])("rejects unsafe or mismatched social URL %s before writing", async (url) => {
  const response = await request(app())
    .put("/business")
    .send({
      name: "Pingo",
      slug: "pingo",
      social_links: [{ ...instagram, url }],
    });
  expect(response.status).toBe(400);
  expect(update).not.toHaveBeenCalled();
});

it.each([
  "https://127.0.0.1/",
  "https://[::1]/",
  "https://localhost/",
  "https://intranet.local/",
  "https://2130706433/",
])("rejects non-public custom link %s", (url) => {
  expect(
    socialLinksSchema.safeParse([{ platform: "other", url }]).success,
  ).toBe(false);
});
it("accepts supported branded links and custom sites; rejects duplicate, excess and unknown fields", () => {
  const links = [
    instagram,
    { platform: "tiktok", url: "https://vm.tiktok.com/abcd/" },
    { platform: "ifood", url: "https://www.ifood.com.br/delivery/pingo" },
    { platform: "99", url: "https://99app.com/99food/" },
    { platform: "whatsapp", url: "https://wa.me/5511999999999?text=Oi" },
    { platform: "other", label: "Nosso site", url: "https://pingochef.com.br" },
  ];
  expect(socialLinksSchema.parse(links)).toEqual(links);
  expect(socialLinksSchema.safeParse([instagram, instagram]).success).toBe(
    false,
  );
  expect(socialLinksSchema.safeParse(Array(11).fill(instagram)).success).toBe(
    false,
  );
  expect(
    socialLinksSchema.safeParse([
      { ...instagram, business_id: "another-tenant" },
    ]).success,
  ).toBe(false);
  expect(
    socialLinksSchema.safeParse([
      {
        platform: "other",
        url: "https://pingochef.com.br",
        label: "<svg onload=alert(1)>",
      },
    ]).success,
  ).toBe(false);
  expect(
    publicSocialLinks([
      instagram,
      { platform: "other", url: "javascript:alert(1)" },
    ]),
  ).toEqual([instagram]);
});
