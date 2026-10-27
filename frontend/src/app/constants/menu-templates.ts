/** Templates own presentation only. Customer content, branding and feature flags live in DesignSettings. */
export interface TemplateConfig {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly idealFor: string;
  readonly heroRatio: string;
  readonly heroRadius: number;
  readonly brandPosition: 'below-hero' | 'inside-hero';
  readonly logoSize: number;
  readonly logoRadius: number;
  readonly descriptionAlign: 'left' | 'center';
  readonly descriptionPosition: 'before-hero' | 'after-hero';
  readonly categoryRadius: number;
  readonly buttonRadius: number;
  readonly itemRadius: number;
  readonly itemImageSize: number;
}

export const DEFAULT_TEMPLATE_KEY = 'default';

export const AVAILABLE_TEMPLATES: readonly TemplateConfig[] = [{
  key: DEFAULT_TEMPLATE_KEY,
  name: 'Padrão',
  description: 'Capa arredondada, logo em destaque e apresentação com leitura confortável. Categorias acessíveis e produtos em cards horizontais.',
  idealFor: 'Sua identidade, com uma estrutura simples e organizada.',
  heroRatio: '16 / 7',
  heroRadius: 20,
  brandPosition: 'below-hero',
  logoSize: 80,
  logoRadius: 20,
  descriptionAlign: 'left',
  descriptionPosition: 'after-hero',
  categoryRadius: 12,
  buttonRadius: 12,
  itemRadius: 16,
  itemImageSize: 84
}, {
  key: 'centered-cover',
  name: 'Capa Central',
  description: 'Capa de margem a margem, logo circular centralizada e apresentação alinhada ao centro. Sua identidade em destaque.',
  idealFor: 'Uma entrada visual marcante, com navegação simples.',
  heroRatio: '2.55 / 1',
  heroRadius: 26,
  brandPosition: 'below-hero',
  logoSize: 96,
  logoRadius: 48,
  descriptionAlign: 'center',
  descriptionPosition: 'before-hero',
  categoryRadius: 24,
  buttonRadius: 12,
  itemRadius: 16,
  itemImageSize: 84
}, {
  key: 'arched-cover',
  name: 'Capa em Arco',
  description: 'Capa com recorte curvo, logo circular centralizada e categorias em pílulas. Apresentação com efeito de vidro.',
  idealFor: 'Uma vitrine acolhedora com destaque para a marca.',
  heroRatio: '1.95 / 1',
  heroRadius: 0,
  brandPosition: 'below-hero',
  logoSize: 96,
  logoRadius: 48,
  descriptionAlign: 'center',
  descriptionPosition: 'after-hero',
  categoryRadius: 999,
  buttonRadius: 12,
  itemRadius: 16,
  itemImageSize: 84
}, {
  key: 'brand-hero',
  name: 'Marca na Capa',
  description: 'Logo e nome dentro da capa, apresentação acima e cards com fotos amplas ao lado das informações.',
  idealFor: 'Sua marca e seus produtos em destaque.',
  heroRatio: '2.1 / 1',
  heroRadius: 20,
  brandPosition: 'inside-hero',
  logoSize: 64,
  logoRadius: 16,
  descriptionAlign: 'center',
  descriptionPosition: 'before-hero',
  categoryRadius: 24,
  buttonRadius: 12,
  itemRadius: 16,
  itemImageSize: 84
}, {
  key: 'signature-cover',
  name: 'Capa Assinatura',
  description: 'Capa com recorte suave, logo centralizada e nome entre linhas decorativas. Apresentação abaixo e fotos amplas nos cards.',
  idealFor: 'Uma vitrine elegante com destaque para a identidade da casa.',
  heroRatio: '1.7 / 1',
  heroRadius: 0,
  brandPosition: 'below-hero',
  logoSize: 64,
  logoRadius: 32,
  descriptionAlign: 'center',
  descriptionPosition: 'after-hero',
  categoryRadius: 16,
  buttonRadius: 12,
  itemRadius: 16,
  itemImageSize: 84
}];

/** Removed/unknown keys resolve safely while existing menus transition to the new catalog. */
export function resolveMenuTemplate(design?: { templateKey?: string } | null): TemplateConfig {
  return AVAILABLE_TEMPLATES.find(template => template.key === design?.templateKey) || AVAILABLE_TEMPLATES[0];
}
