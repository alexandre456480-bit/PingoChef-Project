import { z } from "zod";
import QRCode from "qrcode";
import { PNG } from "pngjs";
import { Resvg } from "@resvg/resvg-js";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { supabaseAdmin } from "../config/supabase";
import { entitlements } from "./entitlement.service";
import { businessEligibility } from "./business-eligibility.service";
import { ownerError, ownerOrigins } from "./owner-session.service";

const plainText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (v) => !/[<>\x00-\x1f\x7f]/.test(v),
      "Use texto simples, sem marcação.",
    );
export const qrConfigurationSchema = z
  .object({
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    frame: z.enum(["none", "card"]),
    caption: plainText(40).refine(
      (v) =>
        /^[\u0020-\u007e\u00a0-\u017f\u2013\u2014\u2018\u2019\u201c\u201d]*$/.test(
          v,
        ),
      "Use letras latinas, acentos e pontuação comum.",
    ),
    logoPng: z.string().max(44000).nullable(),
  })
  .strict();
export const qrCreateSchema = z
  .object({
    name: plainText(120).pipe(z.string().min(1)),
    configuration: qrConfigurationSchema,
  })
  .strict();
export const qrUpdateSchema = qrCreateSchema.extend({
  active: z.boolean(),
  revision: z.number().int().min(1).max(2147483646),
});
export type QrConfiguration = z.infer<typeof qrConfigurationSchema>;
interface QrRow {
  id: string;
  business_id: string;
  label: string;
  public_identifier: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  revision: number;
  configuration: QrConfiguration;
}
const fields =
  "id,business_id,label,public_identifier,active,created_at,updated_at,revision,configuration";
export const defaultQrConfiguration: QrConfiguration = {
  color: "#2C1024",
  frame: "card",
  caption: "Acesse nosso cardápio",
  logoPng: null,
};

export function publicMenuOrigin(): string {
  let url: URL;
  try {
    url = new URL(
      process.env.PUBLIC_MENU_ORIGIN ||
        (process.env.NODE_ENV !== "production" ? ownerOrigins()[0] : ""),
    );
  } catch {
    throw ownerError(503, "QR_ORIGIN_CONFIGURATION_ERROR");
  }
  if (
    !ownerOrigins().includes(url.origin) ||
    url.href !== `${url.origin}/` ||
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )) ||
    url.origin.length > 140
  )
    throw ownerError(503, "QR_ORIGIN_CONFIGURATION_ERROR");
  return url.origin;
}
export function qrPublicUrl(identifier: string): string {
  return `${publicMenuOrigin()}/q/${z.string().uuid().parse(identifier)}`;
}
export function qrContrast(color: string): number {
  const rgb = [1, 3, 5]
    .map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 1.05 / (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] + 0.05);
}
export function sanitizeQrConfiguration(
  input: QrConfiguration,
): QrConfiguration {
  const c = qrConfigurationSchema.parse(input);
  if (qrContrast(c.color) < 7)
    throw ownerError(
      400,
      "QR_LOW_CONTRAST",
      "Escolha uma cor escura com contraste mínimo de 7:1 sobre branco.",
    );
  c.color = c.color.toUpperCase();
  c.caption = c.caption.normalize("NFC");
  if (c.logoPng !== null) {
    if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(c.logoPng))
      throw ownerError(400, "QR_INVALID_LOGO");
    const bytes = Buffer.from(c.logoPng.slice(22), "base64");
    // Check the IHDR BEFORE inflation: bounded pixels and bytes, no SVG, remote URL, APNG or interlacing.
    if (
      bytes.length < 33 ||
      bytes.length > 24576 ||
      !bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) ||
      bytes.readUInt32BE(8) !== 13 ||
      bytes.toString("ascii", 12, 16) !== "IHDR" ||
      bytes.readUInt32BE(16) < 16 ||
      bytes.readUInt32BE(16) > 128 ||
      bytes.readUInt32BE(20) < 16 ||
      bytes.readUInt32BE(20) > 128 ||
      bytes[24] !== 8 ||
      ![2, 6].includes(bytes[25]) ||
      bytes[26] !== 0 ||
      bytes[27] !== 0 ||
      bytes[28] !== 0
    )
      throw ownerError(
        400,
        "QR_INVALID_LOGO",
        "Use PNG RGB/RGBA, 8 bits, de 16 a 128 pixels, até 24 KB.",
      );
    try {
      for (let offset = 8; offset + 12 <= bytes.length;) {
        const length = bytes.readUInt32BE(offset),
          type = bytes.toString("ascii", offset + 4, offset + 8);
        if (
          offset + length + 12 > bytes.length ||
          ["acTL", "fcTL", "fdAT"].includes(type)
        )
          throw new Error();
        offset += length + 12;
      }
      const decoded = PNG.sync.read(bytes, { checkCRC: true });
      const normalized = PNG.sync.write(decoded, { colorType: 6 });
      if (normalized.length > 24576) throw new Error();
      c.logoPng = `data:image/png;base64,${normalized.toString("base64")}`;
    } catch {
      throw ownerError(
        400,
        "QR_INVALID_LOGO",
        "O logo PNG é inválido ou excede o tamanho permitido.",
      );
    }
  }
  return c;
}
const xml = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[ch]!,
  );

// Structured renderer interface permits a future PDF adapter without accepting arbitrary SVG or URLs.
export function renderQr(
  url: string,
  input: QrConfiguration,
  format: "png" | "svg",
): Buffer {
  const c = sanitizeQrConfiguration(input),
    code = QRCode.create(url, { errorCorrectionLevel: "H" });
  const n = code.modules.size,
    scale = 8,
    padding = 24,
    quiet = 4;
  const width = (n + quiet * 2) * scale + padding * 2,
    height = width + (c.caption ? 48 : 0);
  const xy = (v: number) => padding + (quiet + v) * scale;
  let modules = "",
    reserved = "";
  const logoSide = Math.max(3, Math.floor(n * 0.15)),
    logoStart = Math.floor((n - logoSide) / 2),
    logoEnd = logoStart + logoSide;
  for (let row = 0; row < n; row++)
    for (let col = 0; col < n; col++) {
      const dark = code.modules.get(row, col);
      if (dark)
        modules += `M${xy(col)} ${xy(row)}h${scale}v${scale}h-${scale}z`;
      if (
        c.logoPng &&
        row >= logoStart &&
        row < logoEnd &&
        col >= logoStart &&
        col < logoEnd &&
        code.modules.isReserved(row, col)
      )
        reserved += `<rect x="${xy(col)}" y="${xy(row)}" width="${scale}" height="${scale}" fill="${dark ? c.color : "#FFFFFF"}"/>`;
    }
  const image = c.logoPng
    ? `<rect x="${xy(logoStart)}" y="${xy(logoStart)}" width="${logoSide * scale}" height="${logoSide * scale}" fill="#FFFFFF"/><image href="${c.logoPng}" x="${xy(logoStart) + 4}" y="${xy(logoStart) + 4}" width="${logoSide * scale - 8}" height="${logoSide * scale - 8}"/>${reserved}`
    : "";
  const fontSize = Math.min(
    22,
    (width - 48) / Math.max(1, c.caption.length * 0.65),
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#FFFFFF"/>${c.frame === "card" ? `<rect x="4" y="4" width="${width - 8}" height="${height - 8}" rx="20" fill="none" stroke="${c.color}" stroke-width="3"/>` : ""}<path d="${modules}" fill="${c.color}"/>${image}${c.caption ? `<text x="${width / 2}" y="${width + 16}" text-anchor="middle" font-family="Outfit" font-size="${fontSize}" fill="${c.color}">${xml(c.caption)}</text>` : ""}</svg>`;
  const fontPath = resolve(__dirname, "../../assets/fonts/Outfit.ttf");
  if (!existsSync(fontPath)) throw ownerError(503, "QR_FONT_UNAVAILABLE");
  const renderer = new Resvg(svg, {
    font: {
      loadSystemFonts: false,
      fontFiles: [fontPath],
      defaultFontFamily: "Outfit",
    },
  });
  if (renderer.imagesToResolve().length)
    throw ownerError(400, "QR_INVALID_LOGO");
  // Converts text to paths; downloadable SVG needs no external font or scripts.
  return format === "png"
    ? renderer.render().asPng()
    : Buffer.from(renderer.toString(), "utf8");
}

function qrDatabaseError(error: { message?: string } | null) {
  if (!error) return;
  const status: Record<string, number> = {
    QR_NOT_ENTITLED: 403,
    QR_CUSTOMIZATION_NOT_ENTITLED: 403,
    QR_NOT_FOUND: 404,
    QR_VERSION_CONFLICT: 409,
    QR_CAPACITY_REACHED: 409,
    INVALID_QR_CONFIGURATION: 400,
  };
  throw ownerError(
    status[error.message || ""] || 503,
    status[error.message || ""] ? error.message! : "QR_SERVICE_UNAVAILABLE",
  );
}
function dto(row: QrRow) {
  return {
    id: row.id,
    name: row.label,
    publicIdentifier: row.public_identifier,
    publicUrl: qrPublicUrl(row.public_identifier),
    status: row.active ? "ACTIVE" : "PAUSED",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revision: row.revision,
    configuration: row.configuration,
  };
}
export const qrService = {
  async authorize(business: string) {
    const snapshot = await entitlements.getEntitlements(business);
    if (snapshot.entitlements.QR_GENERATOR !== true)
      throw ownerError(
        403,
        "QR_NOT_ENTITLED",
        "QR Code está disponível nos planos Medium e Pro.",
      );
    return snapshot;
  },
  async list(business: string) {
    const snapshot = await this.authorize(business);
    const [{ data, error }, settings] = await Promise.all([
      supabaseAdmin
        .from("analytics_qr_refs")
        .select(fields)
        .eq("business_id", business)
        .order("created_at")
        .limit(100),
      supabaseAdmin
        .from("qr_settings")
        .select("max_codes_per_business")
        .eq("singleton", true)
        .single(),
    ]);
    qrDatabaseError(error);
    qrDatabaseError(settings.error);
    return {
      rows: (data || []).map((row) => dto(row as QrRow)),
      limit: settings.data!.max_codes_per_business,
      customization: snapshot.entitlements.QR_CUSTOMIZATION === true,
      publicAvailable: await businessEligibility.isPublicEligible(business),
    };
  },
  async get(business: string, id: string): Promise<QrRow> {
    await this.authorize(business);
    const { data, error } = await supabaseAdmin
      .from("analytics_qr_refs")
      .select(fields)
      .eq("business_id", business)
      .eq("id", id)
      .maybeSingle();
    qrDatabaseError(error);
    if (!data) throw ownerError(404, "QR_NOT_FOUND");
    return data as QrRow;
  },
  async save(
    business: string,
    id: string | null,
    input: z.infer<typeof qrCreateSchema> | z.infer<typeof qrUpdateSchema>,
  ) {
    await this.authorize(business);
    const configuration = sanitizeQrConfiguration(input.configuration);
    const { data, error } = await supabaseAdmin.rpc("manage_business_qr", {
      p_business: business,
      p_id: id,
      p_label: input.name.normalize("NFC"),
      p_configuration: configuration,
      p_active: "active" in input ? input.active : true,
      p_revision: "revision" in input ? input.revision : null,
    });
    qrDatabaseError(error);
    if (!data) throw ownerError(503, "QR_SERVICE_UNAVAILABLE");
    return dto(data as QrRow);
  },
  async resolve(identifier: string) {
    const { data, error } = await supabaseAdmin
      .from("analytics_qr_refs")
      .select("id,business_id")
      .eq("public_identifier", identifier)
      .eq("active", true)
      .maybeSingle();
    qrDatabaseError(error);
    if (
      !data ||
      !(await businessEligibility.isPublicEligible(data.business_id))
    )
      throw ownerError(
        404,
        "QR_UNAVAILABLE",
        "Este QR Code não está disponível.",
      );
    const business = await supabaseAdmin
      .from("businesses")
      .select("slug")
      .eq("id", data.business_id)
      .maybeSingle();
    qrDatabaseError(business.error);
    if (!business.data || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(business.data.slug))
      throw ownerError(404, "QR_UNAVAILABLE");
    return { slug: business.data.slug, qrId: data.id };
  },
};
