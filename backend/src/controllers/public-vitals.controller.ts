import { ACCEPTED_TEMPLATE_KEYS, normalizeTemplateKey } from '../constants/menu-template';
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { businessEligibility } from "../services/business-eligibility.service";

const thresholds = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};
const vitalsSchema = z
  .object({
    templateCode: z.enum(ACCEPTED_TEMPLATE_KEYS).transform(normalizeTemplateKey),
    deviceClass: z.enum(["mobile", "tablet", "desktop"]),
    metrics: z
      .array(
        z
          .object({
            name: z.enum(["LCP", "CLS", "INP", "FCP", "TTFB"]),
            value: z.number().finite().min(0).max(600_000),
          })
          .strict(),
      )
      .min(1)
      .max(5)
      .refine(
        (rows) => new Set(rows.map((row) => row.name)).size === rows.length,
      ),
  })
  .strict();
export async function collectPublicVitals(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const slug = z
      .string()
      .max(100)
      .regex(/^[a-z0-9-]+$/)
      .parse(req.params.slug);
    const body = vitalsSchema.parse(req.body);
    const business = await businessEligibility.findPublicBusinessBySlug(
      slug,
      "id",
    );
    if (!business) {
      res.sendStatus(404);
      return;
    }
    // Bounded, anonymous aggregate records: no visitor/page IDs, slug, URL, IP,
    // referrer, headers, element selectors or tokens in this log payload.
    const metrics = Object.fromEntries(
      body.metrics.map((metric) => {
        const [good, poor] = thresholds[metric.name];
        return [
          metric.name,
          {
            count: 1,
            sum: metric.value,
            good: metric.value <= good ? 1 : 0,
            needsImprovement:
              metric.value > good && metric.value <= poor ? 1 : 0,
            poor: metric.value > poor ? 1 : 0,
          },
        ];
      }),
    );
    console.info(
      JSON.stringify({
        event: "public_menu_vitals",
        templateCode: body.templateCode,
        deviceClass: body.deviceClass,
        metrics,
      }),
    );
    res.status(202).json({ success: true });
  } catch (error) {
    next(error);
  }
}
