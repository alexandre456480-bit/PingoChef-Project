import express from "express";
import request from "supertest";
import { createUserClient, supabaseAdmin } from "../config/supabase";
import businessRoutes from "../routes/business.routes";
import designRoutes from "../routes/design.routes";
jest.mock("../config/supabase", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: { from: jest.fn() },
  createUserClient: jest.fn(),
}));
jest.mock("../middleware/auth.middleware", () => ({
  authenticateJwt: (req: any, res: any, next: any) => {
    if (!req.get("x-test-owner")) return res.status(401).end();
    req.businessId = "business-a";
    req.userId = "owner-a";
    req.accessToken = "private-owner-a-token";
    next();
  },
}));
const selected: Array<[string, any[]]> = [];
beforeEach(() => {
  selected.length = 0;
  (createUserClient as jest.Mock).mockImplementation(() => ({
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: (...args: any[]) => {
          selected.push([table, args]);
          return chain;
        },
        maybeSingle: async () => ({
          data: {
            id: "business-a",
            owner_user_id: "owner-a",
            name: "A",
            slug: "a",
          },
          error: null,
        }),
      };
      return chain;
    },
  }));
});
function app() {
  const api = express();
  api.use(express.json());
  api.use("/business", businessRoutes);
  api.use("/design", designRoutes);
  api.use((e: any, _req: any, res: any, _next: any) =>
    res
      .status(e.name === "ZodError" ? 400 : e.status || 500)
      .json({ error: { code: e.code || "VALIDATION_ERROR" } }),
  );
  return api;
}
it("query tenant/plan identifiers cannot select business B; server uses owner A JWT and tenant", async () => {
  const r = await request(app())
    .get("/business?business_id=business-b&planCode=PRO")
    .set("x-test-owner", "owner-a");
  expect(r.status).toBe(200);
  expect(r.body.data.id).toBe("business-a");
  expect(selected).toContainEqual(["businesses", ["id", "business-a"]]);
  expect(createUserClient).toHaveBeenCalledWith("private-owner-a-token");
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
});
it.each([
  { business_id: "business-b" },
  { owner_user_id: "owner-b" },
  { plan_id: "pro-plan" },
  { status: "ACTIVE" },
])(
  "business update rejects mass assignment %j before a write",
  async (extra) => {
    const r = await request(app())
      .put("/business")
      .set("x-test-owner", "owner-a")
      .send({ name: "A", slug: "tenant-a", ...extra });
    expect(r.status).toBe(400);
    expect(createUserClient).not.toHaveBeenCalled();
  },
);
it("design settings cannot accept another tenant identifier even with an otherwise valid palette", async () => {
  const r = await request(app())
    .put("/design")
    .set("x-test-owner", "owner-a")
    .send({
      business_id: "business-b",
      palette: {
        key: "test",
        name: "Test",
        colors: {
          primary: "#000000",
          secondary: "#111111",
          accent: "#222222",
          background: "#FFFFFF",
          surface: "#FFFFFF",
          textPrimary: "#000000",
          textSecondary: "#111111",
        },
      },
    });
  expect(r.status).toBe(400);
  expect(createUserClient).not.toHaveBeenCalled();
});
