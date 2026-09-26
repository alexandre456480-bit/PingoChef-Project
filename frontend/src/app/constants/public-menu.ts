export const PUBLIC_MENU_BASE_URL = 'https://pingochef-web-alexandre456480-bits-projects.vercel.app/m';
export const PUBLIC_MENU_PATH_LABEL = 'pingochef-web-alexandre456480-bits-projects.vercel.app/m/';

export function buildPublicMenuUrl(slug: string): string {
  return `${PUBLIC_MENU_BASE_URL}/${encodeURIComponent(slug)}`;
}
