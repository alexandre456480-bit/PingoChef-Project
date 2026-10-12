export const PUBLIC_MENU_BASE_URL = 'https://pingochef-web-drab.vercel.app/m';
export const PUBLIC_MENU_PATH_LABEL = 'pingochef-web-drab.vercel.app/m/';

export function buildPublicMenuUrl(slug: string): string {
  return `${PUBLIC_MENU_BASE_URL}/${encodeURIComponent(slug)}`;
}
