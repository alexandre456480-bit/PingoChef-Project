import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import {
  authenticateJwt,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import {
  analyticsQuerySchema,
  menuAnalytics,
} from "../services/menu-analytics.service";
import { ownerError } from "../services/owner-session.service";
import { sharedRateLimit } from '../middleware/shared-rate-limit.middleware';

const router = Router();
router.use(authenticateJwt);
router.use(sharedRateLimit('analytics-read', 60, 60, req => `business:${(req as AuthenticatedRequest).businessId!}`));
router.use(
  rateLimit({
    windowMs: 60_000,
    limit: 90,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});
const handle =
  (action: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    action(req, res).catch(next);
  };
router.get(
  "/options",
  handle(async (req, res) => {
    if (Object.keys(req.query).length)
      throw ownerError(400, "INVALID_ANALYTICS_QUERY");
    return res.json({
      success: true,
      data: await menuAnalytics.options(req.businessId!),
    });
  }),
);
router.get(
  "/",
  handle(async (req, res) => {
    const c = await menuAnalytics.context(
      req.businessId!,
      analyticsQuerySchema.parse(req.query),
    );
    return res.json({ success: true, data: await menuAnalytics.report(c) });
  }),
);
router.get(
  "/rankings",
  handle(async (req, res) => {
    const c = await menuAnalytics.context(
      req.businessId!,
      analyticsQuerySchema.parse(req.query),
    );
    const data = await menuAnalytics.rpc(c, "ranking", {
      p_metric: c.query.metric,
      p_offset: (c.query.page - 1) * c.query.pageSize,
      p_limit: c.query.pageSize,
    });
    return res.json({
      success: true,
      data: { ...data, page: c.query.page, pageSize: c.query.pageSize },
    });
  }),
);
router.get(
  "/product-trends",
  handle(async (req, res) => {
    const c = await menuAnalytics.context(
      req.businessId!,
      analyticsQuerySchema.parse(req.query),
      "ANALYTICS_ADVANCED",
    );
    if (!c.query.itemId) throw ownerError(400, "INVALID_ANALYTICS_QUERY");
    return res.json({
      success: true,
      data: await menuAnalytics.rpc(c, "product-trend", {
        p_item: c.query.itemId,
      }),
    });
  }),
);
router.get(
  "/qr",
  handle(async (req, res) => {
    const c = await menuAnalytics.context(
      req.businessId!,
      analyticsQuerySchema.parse(req.query),
      "ANALYTICS_EXPORT",
    );
    return res.json({ success: true, data: await menuAnalytics.rpc(c, "qr") });
  }),
);
router.get(
  "/export.csv",
  sharedRateLimit('analytics-export', 4, 60, req => `business:${(req as AuthenticatedRequest).businessId!}`),
  handle(async (req, res) => {
    const c = await menuAnalytics.context(
      req.businessId!,
      analyticsQuerySchema.parse(req.query),
      "ANALYTICS_EXPORT",
    );
    const csv = await menuAnalytics.exportCsv(c);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="pingochef-analytics-${c.range.start}-${c.range.end}.csv"`,
    );
    return res.type("text/csv; charset=utf-8").send(csv);
  }),
);
export default router;
