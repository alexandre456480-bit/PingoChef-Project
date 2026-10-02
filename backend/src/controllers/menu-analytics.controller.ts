import { Request, Response, NextFunction } from "express";
import {
  analyticsBatchSchema,
  menuAnalytics,
} from "../services/menu-analytics.service";
import { businessEligibility } from "../services/business-eligibility.service";
import { ownerError } from "../services/owner-session.service";
import { isDemoMode } from "../config/localDb";

export async function collectMenuAnalytics(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  res.setHeader("Cache-Control", "no-store");
  try {
    requireAnalyticsJson(req, res, () => {});
    const origins = (
      process.env.FRONTEND_ORIGINS ||
      "http://localhost:4200,http://127.0.0.1:4200"
    )
      .split(",")
      .map((v) => v.trim());
    const origin = req.get("origin");
    if (!origin || !origins.includes(origin) || origin === "*")
      throw ownerError(403, "ORIGIN_FORBIDDEN");
    const batch = analyticsBatchSchema.parse(req.body);
    if (
      req.get("dnt") === "1" ||
      req.get("sec-gpc") === "1" ||
      /bot\b|crawler|spider|slurp|facebookexternalhit/i.test(
        req.get("user-agent") || "",
      )
    )
      return res
        .status(202)
        .json({ success: true, data: { accepted: 0, collection: "ignored" } });
    if (process.env.ANALYTICS_COLLECTION_ENABLED === "false" || isDemoMode())
      return res
        .status(202)
        .json({ success: true, data: { accepted: 0, collection: "disabled" } });
    const slug = String(req.params.slug);
    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug))
      throw ownerError(400, "INVALID_MENU_SLUG");
    const business = await businessEligibility.findPublicBusinessBySlug(
      slug,
      "id",
    );
    if (!business) throw ownerError(404, "ANALYTICS_MENU_UNAVAILABLE");
    const accepted = await menuAnalytics.ingest(
      business.id,
      batch,
      req.ip || req.socket.remoteAddress || "unknown",
    );
    return res.status(202).json({ success: true, data: { accepted } });
  } catch (error) {
    next(error);
  }
}

// Mounted before the global upload parsers, so form bodies cannot bypass the 16 KiB JSON budget.
export function requireAnalyticsJson(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (req.method === "POST" && !req.is("application/json"))
    throw ownerError(
      415,
      "ANALYTICS_JSON_REQUIRED",
      "Envie eventos como JSON.",
    );
  next();
}
