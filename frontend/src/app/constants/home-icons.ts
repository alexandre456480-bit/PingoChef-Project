import { findCatalogIcon } from './icon-catalog';

export const HOME_ICON_SECTIONS = [
  { key: 'home', label: 'Início', description: 'Botão que volta à página inicial.' },
  { key: 'promotion', label: 'Promoções & Ofertas', description: 'Título da vitrine de promoções.' },
  { key: 'most_liked', label: 'Mais Curtidos', description: 'Título da vitrine de curtidas.' },
  { key: 'featured_product', label: 'Pratos do Chef', description: 'Título dos pratos e especialidades da casa.' },
  { key: 'combo', label: 'Combos Especiais', description: 'Título da vitrine de combos.' },
  { key: 'best_seller', label: 'Mais Vendidos', description: 'Título da vitrine de mais vendidos.' },
] as const;
export type HomeIconSection = typeof HOME_ICON_SECTIONS[number]['key'];
// Absent = original appearance; null = explicitly no icon; string = catalog ID.
export type HomeIconChoice = string | null | undefined;
export type HomeIcons = Partial<Record<HomeIconSection, string | null>>;
export function homeIconChoice(config: unknown, section: HomeIconSection): HomeIconChoice {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return undefined;
  const icons = (config as Record<string, unknown>)['home_icons'];
  if (!icons || typeof icons !== 'object' || Array.isArray(icons) || !Object.hasOwn(icons, section)) return undefined;
  const choice = (icons as Record<string, unknown>)[section];
  return choice === null ? null : typeof choice === 'string' && findCatalogIcon(choice) ? choice : undefined;
}
