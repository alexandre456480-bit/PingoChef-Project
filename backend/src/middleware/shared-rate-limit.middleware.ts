import { createHmac } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { supabaseAdmin } from "../config/supabase";
import { isDemoMode } from "../config/localDb";
import { ownerError } from "../services/owner-session.service";
import { securityAudit } from "../services/security-audit.service";

export function quotaHash(scope: string, subject: string): string {
  const key = process.env.OWNER_SESSION_ENCRYPTION_KEY || "";
  if (
    !/^[A-Za-z0-9+/]{43}=$/.test(key) ||
    Buffer.from(key, "base64").length !== 32
  )
    throw ownerError(503, "SHARED_QUOTA_CONFIGURATION_ERROR");
  return createHmac("sha256", Buffer.from(key, "base64"))
    .update(`request-quota:v1:${scope}:${subject}`)
    .digest("hex");
}

// Express memory counters remain a cheap first filter. This RPC is the shared authority.
export function sharedRateLimit(
  scope: string,
  limit: number,
  seconds = 60,
  subject: (req: Request) => string = (req) =>
    `ip:${req.ip || req.socket.remoteAddress || "unknown"}`,
): RequestHandler {
  return (req, res, next) => {
    if (isDemoMode()) return next(); // Explicitly isolated demo; never enabled in production.
    void (async () => {
      const { data, error } = await supabaseAdmin.rpc(
        "reserve_shared_request",
        {
          p_scope: scope,
          p_subject_hash: quotaHash(scope, subject(req)),
          p_limit: limit,
          p_window_seconds: seconds,
        },
      );
      if (error || typeof data !== "boolean")
        throw ownerError(503, "SHARED_QUOTA_UNAVAILABLE");
      if (!data) {
        securityAudit("warn", {
          event: "shared_quota_denied",
          requestId: res.locals?.requestId,
          code: "SHARED_RATE_LIMITED",
          status: 429,
          method: req.method,
        });
        res.setHeader("Retry-After", String(seconds));
        throw ownerError(
          429,
          "SHARED_RATE_LIMITED",
          "Muitas solicitações. Aguarde antes de tentar novamente.",
        );
      }
      next();
    })().catch(next);
  };
}

export async function enforceSharedRequest(
  scope: string,
  subject: string,
  limit: number,
  seconds = 60,
): Promise<void> {
  if (isDemoMode()) return;
  const { data, error } = await supabaseAdmin.rpc("reserve_shared_request", {
    p_scope: scope,
    p_subject_hash: quotaHash(scope, subject),
    p_limit: limit,
    p_window_seconds: seconds,
  });
  if (error || typeof data !== "boolean")
    throw ownerError(503, "SHARED_QUOTA_UNAVAILABLE");
  if (!data)
    throw ownerError(
      429,
      "SHARED_RATE_LIMITED",
      "Muitas solicitações. Aguarde antes de tentar novamente.",
    );
}
