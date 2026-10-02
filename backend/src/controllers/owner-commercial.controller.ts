import type { Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { createPasswordAuthClient, supabaseAdmin } from "../config/supabase";
import { isDemoMode } from "../config/localDb";
import {
  enforceOwnerAttempts,
  ownerCookieName,
  ownerCookieOptions,
  ownerError,
  resolveOwnerSession,
  revokeOwnerSession,
} from "../services/owner-session.service";

const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    fn(req, res).catch(next);
  };
// Presentation prices only. No payment integration or price-based authorization is enabled.
const cards = [
  {
    code: "FREE",
    name: "Free",
    priceCents: 0,
    products: 10,
    categories: 4,
    videos: 1,
    profile: "Para experimentar",
    features: [],
    available: true,
  },
  {
    code: "BASIC",
    name: "Basic",
    priceCents: 2990,
    products: 30,
    categories: 10,
    videos: 7,
    profile: "Para pequenos negócios",
    features: ["Analytics essencial"],
    available: false,
  },
  {
    code: "MEDIUM",
    name: "Medium",
    priceCents: 5990,
    products: 70,
    categories: 25,
    videos: 25,
    profile: "Para crescer",
    features: ["Analytics avançado", "QR Code personalizado"],
    available: false,
  },
  {
    code: "PRO",
    name: "Pro",
    priceCents: 9990,
    products: 150,
    categories: 40,
    videos: 40,
    profile: "Para operações maiores",
    features: ["Analytics completo", "QR Code premium"],
    available: false,
  },
];
export const ownerPlans = handle(async (_req, res) =>
  res.json({
    success: true,
    data: { plans: cards, pricesProvisional: true, billingAvailable: false },
  }),
);
export const ownerCreatePlanIntent = handle(async (req, res) => {
  const { planCode } = z
    .object({ planCode: z.enum(["FREE", "BASIC", "MEDIUM", "PRO"]) })
    .strict()
    .parse(req.body);
  if (planCode !== "FREE")
    throw ownerError(
      409,
      "PAID_PLAN_UNAVAILABLE",
      "Os planos pagos estarão disponíveis em breve.",
    );
  if (isDemoMode()) throw ownerError(503, "REGISTRATION_UNAVAILABLE");
  const { data, error } = await supabaseAdmin
    .from("owner_plan_intents")
    .insert({ plan_code: planCode })
    .select("id,plan_code,expires_at")
    .single();
  if (error || !data) throw ownerError(503, "REGISTRATION_UNAVAILABLE");
  return res
    .status(201)
    .json({
      success: true,
      data: {
        id: data.id,
        plan: { code: data.plan_code, name: "Free" },
        expiresAt: data.expires_at,
      },
    });
});
export const ownerReadPlanIntent = handle(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const { data, error } = await supabaseAdmin
    .from("owner_plan_intents")
    .select("id,plan_code,expires_at")
    .eq("id", id)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw ownerError(503, "REGISTRATION_UNAVAILABLE");
  if (!data)
    throw ownerError(
      410,
      "PLAN_INTENT_EXPIRED",
      "Escolha seu plano novamente para continuar.",
    );
  return res.json({
    success: true,
    data: {
      id: data.id,
      plan: { code: data.plan_code, name: "Free" },
      expiresAt: data.expires_at,
    },
  });
});
async function reauthenticate(req: Request, password: string) {
  const session = await resolveOwnerSession(req);
  if (!session.user.email || isDemoMode())
    throw ownerError(503, "ACCOUNT_OPERATION_UNAVAILABLE");
  await enforceOwnerAttempts(req, "login", session.user.email);
  const client = createPasswordAuthClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: session.user.email,
    password,
  });
  if (error || !data.session || data.user?.id !== session.user.id)
    throw ownerError(
      400,
      "CURRENT_PASSWORD_INVALID",
      "A senha atual não confere.",
    );
  return { session, client };
}
export const ownerChangePassword = handle(async (req, res) => {
  const body = z
    .object({
      currentPassword: z.string().min(1).max(128),
      password: z.string().min(8).max(128),
    })
    .strict()
    .parse(req.body);
  if (body.password === body.currentPassword)
    throw ownerError(
      400,
      "PASSWORD_UNCHANGED",
      "Escolha uma senha diferente da atual.",
    );
  const { session, client } = await reauthenticate(req, body.currentPassword);
  const { error } = await client.auth.updateUser({ password: body.password });
  if (error) {
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
    throw ownerError(
      400,
      "PASSWORD_UPDATE_FAILED",
      "Não foi possível alterar a senha.",
    );
  }
  await revokeOwnerSession(session.user.id, null);
  await client.auth.signOut({ scope: "global" }).catch(() => undefined);
  res.clearCookie(ownerCookieName(), ownerCookieOptions(0));
  return res.status(204).send();
});
export const ownerDeleteAccount = handle(async (req, res) => {
  const body = z
    .object({
      currentPassword: z.string().min(1).max(128),
      confirmBusinessId: z.string().uuid(),
      confirmation: z.literal("EXCLUIR"),
    })
    .strict()
    .parse(req.body);
  const { session, client } = await reauthenticate(req, body.currentPassword);
  try {
    const { data, error } = await supabaseAdmin.rpc(
      "owner_schedule_account_deletion",
      {
        p_user_id: session.user.id,
        p_confirm_business_id: body.confirmBusinessId,
      },
    );
    if (error || !data)
      throw ownerError(
        409,
        "DELETION_UNAVAILABLE",
        "Não foi possível agendar a exclusão. Entre em contato com o suporte.",
      );
    await client.auth.signOut({ scope: "global" }).catch(() => undefined);
    res.clearCookie(ownerCookieName(), ownerCookieOptions(0));
    return res.json({
      success: true,
      data: { status: "PENDING_DELETION", scheduledAt: data },
    });
  } finally {
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
});
