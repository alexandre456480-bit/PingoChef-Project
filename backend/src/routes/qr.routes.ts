import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  authenticateJwt,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import { sharedRateLimit } from "../middleware/shared-rate-limit.middleware";
import {
  qrService,
  qrCreateSchema,
  qrUpdateSchema,
  qrPublicUrl,
  renderQr,
} from "../services/qr.service";
import { ownerError } from "../services/owner-session.service";

const router = Router();
const handle =
  (action: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void action(req, res).catch(next);
  };
const tenant = (req: Request) =>
  `business:${(req as AuthenticatedRequest).businessId!}`;
router.use(authenticateJwt);
router.use((req: AuthenticatedRequest, _res, next) => {
  void qrService.authorize(req.businessId!).then(() => next(), next);
});
router.use(sharedRateLimit("qr-owner", 60, 60, tenant));
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});
router.get(
  "/",
  handle(async (req, res) => {
    if (Object.keys(req.query).length)
      throw ownerError(400, "INVALID_QR_QUERY");
    return res.json({
      success: true,
      data: await qrService.list(req.businessId!),
    });
  }),
);
router.post(
  "/",
  sharedRateLimit("qr-write", 10, 60, tenant),
  handle(async (req, res) => {
    if (Object.keys(req.query).length)
      throw ownerError(400, "INVALID_QR_QUERY");
    return res
      .status(201)
      .json({
        success: true,
        data: await qrService.save(
          req.businessId!,
          null,
          qrCreateSchema.parse(req.body),
        ),
      });
  }),
);
router.put(
  "/:id",
  sharedRateLimit("qr-write", 10, 60, tenant),
  handle(async (req, res) => {
    if (Object.keys(req.query).length)
      throw ownerError(400, "INVALID_QR_QUERY");
    const id = z.string().uuid().parse(req.params.id);
    return res.json({
      success: true,
      data: await qrService.save(
        req.businessId!,
        id,
        qrUpdateSchema.parse(req.body),
      ),
    });
  }),
);
router.get(
  "/:id/image",
  sharedRateLimit("qr-render", 20, 60, tenant),
  handle(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { format } = z
      .object({ format: z.enum(["png", "svg"]).default("png") })
      .strict()
      .parse(req.query);
    const row = await qrService.get(req.businessId!, id);
    const image = renderQr(
      qrPublicUrl(row.public_identifier),
      row.configuration,
      format,
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="pingochef-qr-${row.id}.${format}"`,
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; img-src data:; style-src 'none'; sandbox",
    );
    return res
      .type(format === "png" ? "image/png" : "image/svg+xml")
      .send(image);
  }),
);
export default router;
