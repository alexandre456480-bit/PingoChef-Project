import { createHmac } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase";
import { entitlements, EntitlementSnapshot } from "./entitlement.service";
import { ownerError } from "./owner-session.service";
import {
  analyticsComparison,
  analyticsDelta,
  analyticsToday,
  shiftAnalyticsDate,
  validateAnalyticsRange,
} from "./analytics-range.service";

export const analyticsSources = [
  "direct",
  "qr",
  "instagram",
  "facebook",
  "google",
  "whatsapp",
  "other",
] as const;
export const analyticsBatchSchema = z
  .object({
    visitorId: z.string().uuid(),
    pageId: z.string().uuid(),
    source: z.enum(analyticsSources),
    qrId: z.string().uuid().optional(),
    events: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            eventName: z.enum([
              "MENU_VIEW",
              "CATEGORY_VIEW",
              "PRODUCT_VIEW",
              "VIDEO_PLAY",
              "VIDEO_25",
              "VIDEO_50",
              "VIDEO_100",
              "QR_ENTRY",
            ]),
            itemId: z.string().uuid().optional(),
            categoryId: z.string().uuid().optional(),
            mediaId: z.string().uuid().optional(),
            playId: z.string().uuid().optional(),
          })
          .strict()
          .superRefine((e, ctx) => {
            const video = e.eventName.startsWith("VIDEO_");
            const product = video || e.eventName === "PRODUCT_VIEW";
            if (
              !!e.itemId !== product ||
              !!e.categoryId !== (e.eventName === "CATEGORY_VIEW") ||
              !!e.mediaId !== video ||
              !!e.playId !== video
            )
              ctx.addIssue({
                code: "custom",
                message: "Campos incompatíveis com o evento.",
              });
          }),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .superRefine((b, ctx) => {
    if (
      (b.qrId && b.source !== "qr") ||
      (b.events.some((e) => e.eventName === "QR_ENTRY") && b.source !== "qr")
    )
      ctx.addIssue({ code: "custom", message: "Origem de QR inválida." });
  });

export const analyticsQuerySchema = z
  .object({
    start: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    end: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    comparison: z.enum(["none", "previous", "year", "custom"]).default("none"),
    comparisonStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    comparisonEnd: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    source: z.enum([...analyticsSources, "unattributed"]).optional(),
    qrId: z.string().uuid().optional(),
    metric: z
      .enum(["product_views", "likes", "video_plays", "categories"])
      .default("product_views"),
    page: z.coerce.number().int().min(1).max(2001).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(5),
    itemId: z.string().uuid().optional(),
    section: z
      .enum(["series", "products", "likes", "categories", "sources", "qr"])
      .default("series"),
  })
  .strict();
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
interface AnalyticsSettings {
  timezone: string;
  raw_retention_days: number;
  aggregate_retention_days: number;
  basic_history_days: number;
  advanced_history_days: number;
  complete_history_days: number;
  collection_started_at: string;
}
interface Context {
  business: string;
  snapshot: EntitlementSnapshot;
  settings: AnalyticsSettings;
  advanced: boolean;
  complete: boolean;
  range: ReturnType<typeof validateAnalyticsRange>;
  comparison: ReturnType<typeof validateAnalyticsRange> | null;
  query: AnalyticsQuery;
}

export function analyticsHash(purpose: "visitor" | "ip", value: string) {
  const configured = process.env.ANALYTICS_HASH_SECRET;
  if (configured && configured.length < 32)
    throw ownerError(503, "ANALYTICS_UNAVAILABLE");
  const key =
    configured && configured.length >= 32
      ? Buffer.from(configured)
      : Buffer.from(process.env.OWNER_SESSION_ENCRYPTION_KEY || "", "base64");
  if (key.length < 32)
    throw ownerError(
      503,
      "ANALYTICS_UNAVAILABLE",
      "Coleta temporariamente indisponível.",
    );
  return createHmac("sha256", key)
    .update(`menu-analytics:${purpose}:${value}`)
    .digest("hex");
}
export function analyticsLimit(name: string, fallback: number, max: number) {
  const value = Number(process.env[name] || fallback);
  return Number.isSafeInteger(value) && value >= 20 && value <= max
    ? value
    : fallback;
}
function databaseError(error: { message?: string }) {
  const code = error.message || "";
  if (code === "ANALYTICS_FORBIDDEN")
    return ownerError(
      403,
      code,
      "Seu plano não permite este recurso de Analytics.",
    );
  if (code === "ANALYTICS_MENU_UNAVAILABLE")
    return ownerError(404, code, "Cardápio indisponível.");
  if (
    [
      "INVALID_ANALYTICS_RANGE",
      "INVALID_ANALYTICS_QUERY",
      "INVALID_ANALYTICS_RESOURCE",
      "INVALID_ANALYTICS_EVENT",
    ].includes(code)
  )
    return ownerError(400, code, "Período, filtro ou evento inválido.");
  return ownerError(
    503,
    "ANALYTICS_UNAVAILABLE",
    "Analytics temporariamente indisponível.",
  );
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))
    text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export class MenuAnalyticsService {
  private settingsCache?: { value: AnalyticsSettings; expires: number };
  private cache = new Map<string, { value: any; expires: number }>();
  async settings() {
    if (this.settingsCache && this.settingsCache.expires > Date.now())
      return this.settingsCache.value;
    const { data, error } = await supabaseAdmin
      .from("analytics_settings")
      .select("*")
      .eq("singleton", true)
      .single();
    if (error || !data) throw ownerError(503, "ANALYTICS_UNAVAILABLE");
    this.settingsCache = { value: data, expires: Date.now() + 10_000 };
    return data as AnalyticsSettings;
  }
  async options(business: string) {
    const snapshot = await entitlements.getEntitlements(business);
    this.require(snapshot, "ANALYTICS_BASIC");
    const cfg = await this.settings();
    const advanced = snapshot.entitlements.ANALYTICS_ADVANCED === true,
      complete = snapshot.entitlements.ANALYTICS_EXPORT === true;
    const historyDays = complete
      ? cfg.complete_history_days
      : advanced
        ? cfg.advanced_history_days
        : cfg.basic_history_days;
    const today = analyticsToday(cfg.timezone);
    return {
      timezone: cfg.timezone,
      today,
      minDate: shiftAnalyticsDate(today, 1 - historyDays),
      historyDays,
      collectionStartedAt: cfg.collection_started_at,
      rawRetentionDays: cfg.raw_retention_days,
      aggregateRetentionDays: cfg.aggregate_retention_days,
      advanced,
      complete,
      tier: complete ? "Completo" : advanced ? "Avançado" : "Essencial",
    };
  }
  private require(snapshot: EntitlementSnapshot, flag: string) {
    if (snapshot.entitlements[flag] !== true)
      throw ownerError(
        403,
        "ANALYTICS_FORBIDDEN",
        "Seu plano não permite este recurso de Analytics.",
      );
  }
  async context(
    business: string,
    query: AnalyticsQuery,
    feature?: string,
  ): Promise<Context> {
    const snapshot = await entitlements.getEntitlements(business);
    this.require(snapshot, "ANALYTICS_BASIC");
    if (feature) this.require(snapshot, feature);
    const advanced = snapshot.entitlements.ANALYTICS_ADVANCED === true,
      complete = snapshot.entitlements.ANALYTICS_EXPORT === true;
    if (
      (query.source ||
        query.comparison !== "none" ||
        query.metric === "categories") &&
      !advanced
    )
      this.require(snapshot, "ANALYTICS_ADVANCED");
    if (
      (query.qrId || ["year", "custom"].includes(query.comparison)) &&
      !complete
    )
      this.require(snapshot, "ANALYTICS_EXPORT");
    if (
      !!query.start !== !!query.end ||
      (query.comparison === "custom" &&
        (!query.comparisonStart || !query.comparisonEnd)) ||
      (query.comparison !== "custom" &&
        (query.comparisonStart || query.comparisonEnd))
    )
      throw ownerError(
        400,
        "INVALID_ANALYTICS_RANGE",
        "Complete o período de comparação.",
      );
    const settings = await this.settings(),
      today = analyticsToday(settings.timezone);
    const history = complete
      ? settings.complete_history_days
      : advanced
        ? settings.advanced_history_days
        : settings.basic_history_days;
    const range = validateAnalyticsRange(
      query.start || shiftAnalyticsDate(today, -6),
      query.end || today,
      today,
      history,
    );
    const previous = analyticsComparison(
      range.start,
      range.end,
      query.comparison,
      query.comparisonStart,
      query.comparisonEnd,
    );
    const comparison = previous
      ? validateAnalyticsRange(previous.start, previous.end, today, history)
      : null;
    return {
      business,
      snapshot,
      settings,
      advanced,
      complete,
      range,
      comparison,
      query,
    };
  }
  async rpc(
    c: Context,
    kind: string,
    extra: Record<string, unknown> = {},
    previous = false,
  ): Promise<any> {
    const range = previous ? c.comparison! : c.range;
    const args = {
      p_business: c.business,
      p_start: range.start,
      p_end: range.end,
      p_kind: kind,
      p_bucket: range.bucket,
      p_source: c.query.source || null,
      p_qr: c.query.qrId || null,
      ...extra,
    };
    const key = JSON.stringify([args, c.snapshot.entitlements, c.settings]);
    const entry = this.cache.get(key);
    if (entry && entry.expires > Date.now()) return entry.value;
    const { data, error } = await supabaseAdmin.rpc("analytics_query", args);
    if (error) throw databaseError(error);
    // Keep large CSV rankings/QR results out of process memory caches.
    if (Buffer.byteLength(JSON.stringify(data), "utf8") <= 65_536) {
      if (this.cache.size >= 256)
        this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { value: data, expires: Date.now() + 10_000 });
    }
    return data;
  }
  async report(c: Context) {
    const [
      summary,
      series,
      viewed,
      liked,
      categories,
      sources,
      hours,
      qr,
      previous,
    ] = await Promise.all([
      this.rpc(c, "summary"),
      this.rpc(c, "series"),
      this.rpc(c, "ranking", { p_metric: "product_views", p_limit: 5 }),
      this.rpc(c, "ranking", { p_metric: "likes", p_limit: 5 }),
      c.advanced
        ? this.rpc(c, "ranking", { p_metric: "categories", p_limit: 5 })
        : null,
      c.advanced ? this.rpc(c, "sources") : null,
      c.advanced ? this.rpc(c, "hours") : null,
      c.complete ? this.rpc(c, "qr") : null,
      c.comparison ? this.rpc(c, "summary", {}, true) : null,
    ]);
    const deltas = previous
      ? Object.fromEntries(
          ["menuViews", "visitors", "productViews", "videoPlays"].map((k) => [
            k,
            analyticsDelta(summary[k], previous[k]),
          ]),
        )
      : null;
    return {
      range: c.range,
      timezone: c.settings.timezone,
      summary: c.advanced
        ? summary
        : {
            menuViews: summary.menuViews,
            visitors: summary.visitors,
            productViews: summary.productViews,
            videoPlays: summary.videoPlays,
            likes: summary.likes,
          },
      series,
      viewed,
      liked,
      categories,
      sources,
      hours,
      qr,
      comparison: c.comparison
        ? { range: c.comparison, summary: previous, deltas }
        : null,
      collectionStartedAt: c.settings.collection_started_at,
      likesAttributed: !c.query.source && !c.query.qrId,
    };
  }
  async ingest(
    business: string,
    batch: z.infer<typeof analyticsBatchSchema>,
    ip: string,
  ) {
    const { data, error } = await supabaseAdmin.rpc("analytics_ingest", {
      p_business: business,
      p_visitor: analyticsHash("visitor", `${business}:${batch.visitorId}`),
      p_page: batch.pageId,
      p_ip_hash: analyticsHash(
        "ip",
        `${new Date().toISOString().slice(0, 10)}:${ip}`,
      ),
      p_events: batch.events,
      p_source: batch.source,
      p_qr: batch.qrId || null,
      p_ip_limit: analyticsLimit(
        "ANALYTICS_IP_EVENTS_PER_MINUTE",
        1500,
        100000,
      ),
      p_visitor_limit: analyticsLimit(
        "ANALYTICS_SESSION_EVENTS_PER_MINUTE",
        180,
        2000,
      ),
    });
    if (error) throw databaseError(error);
    if (data === -1)
      throw ownerError(
        429,
        "ANALYTICS_RATE_LIMITED",
        "Muitos eventos. Aguarde um instante.",
      );
    return Number(data);
  }
  async exportCsv(c: Context) {
    const section = c.query.section;
    if (["categories", "sources"].includes(section))
      this.require(c.snapshot, "ANALYTICS_ADVANCED");
    let header: string[], rows: any[][];
    if (section === "series") {
      header = [
        "Data",
        "Hora",
        "Visualizações do cardápio",
        "Sessões únicas",
        "Visualizações de produtos",
        "Reproduções de vídeo",
      ];
      const data = await this.rpc(c, "series");
      rows = data.map((r: any) => [
        r.date,
        r.hour ?? "",
        r.menuViews,
        r.visitors,
        r.productViews,
        r.videoPlays,
      ]);
    } else if (section === "sources" || section === "qr") {
      header = [
        section === "sources" ? "Origem" : "QR",
        section === "sources" ? "Visualizações" : "Entradas",
      ];
      rows = (await this.rpc(c, section)).map((r: any) => [r.name, r.value]);
    } else {
      const metric =
        section === "likes"
          ? "likes"
          : section === "categories"
            ? "categories"
            : "product_views";
      const data = await this.rpc(c, "ranking", {
        p_metric: metric,
        p_limit: 5000,
      });
      if (data.total > 5000)
        throw ownerError(
          413,
          "EXPORT_TOO_LARGE",
          "Reduza o período ou os filtros para exportar até 5.000 posições.",
        );
      header = [
        "Nome",
        section === "likes" ? "Curtidas confirmadas" : "Visualizações",
        "Removido",
      ];
      rows = data.rows.map((r: any) => [
        r.name,
        r.value,
        r.removed ? "sim" : "não",
      ]);
    }
    const metadata = [
      ["Período", c.range.start, c.range.end],
      ["Timezone", c.settings.timezone],
      ["Origem", c.query.source || "todas"],
      ["QR selecionado", c.query.qrId ? "sim" : "não"],
      ["Curtidas", "Sem atribuição de origem/QR"],
      [
        "Visitantes",
        "Sessões anônimas únicas por intervalo; não somar os pontos da série",
      ],
    ];
    return (
      "\uFEFF" +
      [...metadata, header, ...rows]
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n") +
      "\r\n"
    );
  }
}
export const menuAnalytics = new MenuAnalyticsService();
