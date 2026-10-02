import express from "express";
import request from "supertest";
import { supabaseAdmin } from "../config/supabase";
import { requireAdmin, sha256 } from "../middleware/admin.middleware";
import { securityAudit } from "../services/security-audit.service";
jest.mock("../config/supabase", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: { from: jest.fn() },
}));
const cookie = `pc_admin_session=${"a".repeat(64)}`,
  csrf = "c".repeat(64),
  origin = "http://localhost:4300";
let revoked: boolean,
  identity: any,
  touched: boolean,
  calls: Array<[string, ...any[]]>;
beforeEach(() => {
  process.env.ADMIN_ORIGINS = origin;
  process.env.NODE_ENV = "test";
  revoked = false;
  touched = true;
  identity = { active: true, require_mfa: false, revoked_at: null };
  calls = [];
  (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
    let update = false;
    const chain: any = {
      select: () => chain,
      eq: (...args: any[]) => {
        calls.push(["eq", ...args]);
        return chain;
      },
      is: (...args: any[]) => {
        calls.push(["is", ...args]);
        return chain;
      },
      gt: (...args: any[]) => {
        calls.push(["gt", ...args]);
        return chain;
      },
      update: () => {
        update = true;
        return chain;
      },
      maybeSingle: async () => ({
        data:
          table === "admin_identities"
            ? identity
            : update
              ? touched
                ? { session_hash: sha256("a".repeat(64)) }
                : null
              : {
                  user_id: "admin-a",
                  csrf_hash: sha256(csrf),
                  mfa_verified: false,
                  expires_at: new Date(Date.now() + 60000).toISOString(),
                  last_seen_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  revoked_at: revoked ? new Date().toISOString() : null,
                },
        error: null,
      }),
    };
    return chain;
  });
});
function app() {
  const api = express();
  api.all("/admin", requireAdmin, (req: any, res) =>
    res.json({ admin: req.adminUserId }),
  );
  return api;
}
it("valid admin mutation requires origin + session-bound CSRF and a final live row", async () => {
  const r = await request(app())
    .post("/admin")
    .set("Origin", origin)
    .set("Cookie", cookie)
    .set("X-CSRF-Token", csrf);
  expect(r.status).toBe(200);
  expect(r.body.admin).toBe("admin-a");
  expect(calls).toContainEqual(["is", "revoked_at", null]);
  expect(calls.some((c) => c[0] === "gt" && c[1] === "expires_at")).toBe(true);
});
it("revocation during identity lookup cannot pass the final conditional session touch", async () => {
  touched = false;
  const r = await request(app()).get("/admin").set("Cookie", cookie);
  expect(r.status).toBe(401);
  expect(r.body.error.code).toBe("ADMIN_SESSION_REVOKED");
});
it("rejects duplicate/tampered cookies before database access", async () => {
  const api = app();
  expect(
    (await request(api).get("/admin").set("Cookie", `${cookie}; ${cookie}`))
      .status,
  ).toBe(401);
  expect(
    (
      await request(api)
        .get("/admin")
        .set("Cookie", "pc_admin_session=tampered")
    ).status,
  ).toBe(401);
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
});
it("rejects revoked identities, expired/revoked sessions and missing MFA", async () => {
  const api = app();
  revoked = true;
  expect((await request(api).get("/admin").set("Cookie", cookie)).status).toBe(
    401,
  );
  revoked = false;
  identity.revoked_at = new Date().toISOString();
  expect((await request(api).get("/admin").set("Cookie", cookie)).status).toBe(
    403,
  );
  identity.revoked_at = null;
  identity.require_mfa = true;
  expect(
    (await request(api).get("/admin").set("Cookie", cookie)).body.error.code,
  ).toBe("ADMIN_MFA_REQUIRED");
});
it("rejects owner origin, cross-site Fetch Metadata and absent/incorrect CSRF", async () => {
  const api = app();
  expect(
    (
      await request(api)
        .get("/admin")
        .set("Cookie", cookie)
        .set("Origin", "http://localhost:4200")
    ).status,
  ).toBe(403);
  expect(
    (
      await request(api)
        .get("/admin")
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set("Sec-Fetch-Site", "cross-site")
    ).status,
  ).toBe(403);
  for (const token of ["", "b".repeat(64)])
    expect(
      (
        await request(api)
          .post("/admin")
          .set("Cookie", cookie)
          .set("Origin", origin)
          .set("X-CSRF-Token", token)
      ).body.error.code,
    ).toBe("ADMIN_CSRF_DENIED");
});
it("structured audit whitelist drops passwords, cookies, bearer headers and token fields", () => {
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  securityAudit("error", {
    event: "request_failed",
    requestId: "request-a",
    code: "QR_NOT_ENTITLED",
    status: 403,
    password: "private-password",
    cookie: "private-cookie",
    Authorization: "Bearer private-bearer",
    refreshToken: "private-refresh",
  } as any);
  const output = spy.mock.calls[0][0];
  expect(JSON.parse(output)).toMatchObject({
    event: "request_failed",
    requestId: "request-a",
    code: "QR_NOT_ENTITLED",
    status: 403,
  });
  expect(output).not.toContain("private-");
  spy.mockRestore();
});
