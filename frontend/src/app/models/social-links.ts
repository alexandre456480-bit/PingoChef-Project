import catalog from '../constants/social-platforms.json';

export type SocialPlatform = 'instagram' | 'tiktok' | 'ifood' | '99' | 'whatsapp' | 'other';
export interface SocialLink {
  platform: SocialPlatform;
  url: string;
  label?: string;
}
export const SOCIAL_PLATFORMS = catalog as {
  key: SocialPlatform;
  label: string;
  domains: string[];
  color: string;
}[];
export const socialLabel = (link: SocialLink): string =>
  link.platform === 'other'
    ? link.label || 'Outro link'
    : SOCIAL_PLATFORMS.find((platform) => platform.key === link.platform)?.label || '';

export function validSocialUrl(platform: SocialPlatform, value: string): boolean {
  const choice = SOCIAL_PLATFORMS.find((entry) => entry.key === platform);
  if (
    !choice ||
    value.length > 2048 ||
    !/^https:\/\/(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(?::443)?(?:[/?#]|$)/i.test(
      value,
    ) ||
    /[\s\\\x00-\x1f\x7f]/.test(value)
  )
    return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443') &&
      /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(host) &&
      !/\.(?:localhost|local|internal|test|invalid|example)$/i.test(host) &&
      (!choice.domains.length ||
        choice.domains.some((domain) => host === domain || host.endsWith('.' + domain)))
    );
  } catch {
    return false;
  }
}

export function safeSocialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 10)
    .filter(
      (entry): entry is SocialLink =>
        entry &&
        typeof entry.url === 'string' &&
        validSocialUrl(entry.platform, entry.url) &&
        (entry.label === undefined ||
          (typeof entry.label === 'string' &&
            entry.label.trim().length > 0 &&
            entry.label.length <= 40 &&
            !/[<>\x00-\x1f\x7f]/.test(entry.label))),
    );
}
