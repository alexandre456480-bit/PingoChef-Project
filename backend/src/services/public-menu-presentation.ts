/** Public DTO helpers. No arbitrary administrative custom_config is serialized. */
export function publicImage(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 6_000_000) return null;
  const source = value.trim();
  if (
    /^data:image\/(png|jpe?g|webp|avif|gif);base64,[a-z\d+/=\s]+$/i.test(source)
  )
    return source;
  if (/^\/(?!\/)[^\s\\]*$/.test(source)) return source;
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (
      url.hostname.endsWith(".supabase.co") &&
      /\/storage\/v1\/(object|render\/image)\/sign\//.test(url.pathname)
    )
      return null;
    if (
      [...url.searchParams.keys()].some((key) =>
        /^(access_token|authorization|service_role)$/i.test(key),
      )
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function publicBanners(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .slice(0, 5)
        .map(publicImage)
        .filter((url): url is string => !!url)
    : [];
}
export function publicCategoryHeroes(
  value: unknown,
): Record<string, { enabled: boolean; banners: string[] }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 200)
      .filter(
        ([key, config]) =>
          /^[a-z\d_-]{1,100}$/i.test(key) &&
          !["__proto__", "constructor", "prototype"].includes(key) &&
          config &&
          typeof config === "object",
      )
      .map(([key, config]) => [
        key,
        {
          enabled: (config as any).enabled !== false,
          banners: publicBanners((config as any).banners),
        },
      ]),
  );
}
export function publicCustomConfig(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const config = value as Record<string, unknown>,
    result: Record<string, unknown> = {};
  for (const flag of ["enable_likes", "enable_cart"])
    if (typeof config[flag] === "boolean") result[flag] = config[flag];
  if (typeof config.welcome_tagline === "string")
    result.welcome_tagline = config.welcome_tagline.slice(0, 300);
  if (
    config.intro_card &&
    typeof config.intro_card === "object" &&
    !Array.isArray(config.intro_card)
  ) {
    const intro = config.intro_card as Record<string, unknown>;
    result.intro_card = {
      enabled: intro.enabled !== false,
      title: typeof intro.title === "string" ? intro.title.slice(0, 150) : "",
      description:
        typeof intro.description === "string"
          ? intro.description.slice(0, 1200)
          : "",
    };
  }
  return result;
}
