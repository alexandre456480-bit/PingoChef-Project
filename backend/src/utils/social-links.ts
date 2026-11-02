import { z } from "zod";
import platforms from "../constants/social-platforms.json";

export const socialLinkSchema = z
  .object({
    platform: z.enum([
      "instagram",
      "tiktok",
      "ifood",
      "99",
      "whatsapp",
      "other",
    ]),
    label: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[^<>\x00-\x1f\x7f]+$/)
      .optional(),
    url: z
      .string()
      .trim()
      .max(2048)
      .refine(
        isSafeSocialUrl,
        "Informe um link HTTPS público válido, sem usuário ou senha.",
      ),
  })
  .strict()
  .superRefine((link, context) => {
    const domains = platforms.find(
      (platform) => platform.key === link.platform,
    )!.domains;
    if (domains.length && isSafeSocialUrl(link.url)) {
      const host = new URL(link.url).hostname.toLowerCase();
      if (
        !domains.some(
          (domain) => host === domain || host.endsWith("." + domain),
        )
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["url"],
          message: "O link não pertence à rede social escolhida.",
        });
      }
    }
  });

export type SocialLink = z.infer<typeof socialLinkSchema>;
export const socialLinksSchema = z
  .array(socialLinkSchema)
  .max(10, "Adicione no máximo 10 links.")
  .superRefine((links, context) => {
    const keys = links.map((link) =>
      link.platform === "other" ? link.url : link.platform,
    );
    if (new Set(keys).size !== keys.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Esta rede social ou link já foi adicionado.",
      });
  });

export function isSafeSocialUrl(value: string): boolean {
  if (
    !/^https:\/\/(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(?::443)?(?:[/?#]|$)/i.test(
      value,
    ) ||
    /[\s\\\x00-\x1f\x7f]/.test(value)
  )
    return false;
  try {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(
        url.hostname,
      ) &&
      !/\.(?:localhost|local|internal|test|invalid|example)$/i.test(
        url.hostname,
      )
    );
  } catch {
    return false;
  }
}

/** Public reads also filter malformed data, including legacy/direct database writes. */
export function publicSocialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).flatMap((entry) => {
    const parsed = socialLinkSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}
