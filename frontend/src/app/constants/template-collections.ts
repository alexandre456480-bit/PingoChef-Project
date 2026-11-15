import { AVAILABLE_TEMPLATES } from './menu-templates';

/** Browsing groups only. The simple/thematic entitlement classification stays independent. */
export const TEMPLATE_COLLECTIONS = [
  { key: 'essentials', name: 'Essenciais', description: 'Layouts diretos, com foco na leitura e na organização do cardápio.', templates: ['default', 'compact-menu', 'editorial-menu'] },
  { key: 'covers', name: 'Capas e identidade', description: 'Composições que valorizam a capa e a apresentação da empresa.', templates: ['centered-cover', 'arched-cover', 'brand-hero', 'signature-cover', 'immersive-cover'] },
  { key: 'showcases', name: 'Vitrines de produtos', description: 'Fotos e cards em destaque para explorar o catálogo.', templates: ['product-gallery', 'rounded-showcase', 'soft-showcase', 'double-showcase'] },
  { key: 'digital', name: 'Modernos e digitais', description: 'Vidro, pixels, circuitos e efeitos inspirados no universo digital.', templates: ['liquid-glass', 'pixel', 'circuit-tech', 'neon-arcade'] },
  { key: 'elegant', name: 'Delicados e elegantes', description: 'Formas suaves e detalhes decorativos, do acolhedor ao sofisticado.', templates: ['soft-wave', 'sweet-boutique', 'royal-palace'] },
  { key: 'settings', name: 'Culturas e ambientes', description: 'Referências culturais e atmosferas marcantes para a sua vitrine.', templates: ['retro-diner', 'nordic-tavern', 'japanese-izakaya', 'tropical-bamboo', 'mexican-fiesta'] }
] as const;
export type TemplateAccessFilter = 'all' | 'simple' | 'thematic';
export function templateCollections(access: TemplateAccessFilter = 'all', collection = 'all') {
  return TEMPLATE_COLLECTIONS.filter(group => collection === 'all' || group.key === collection).map(group => ({
    ...group,
    templates: group.templates.flatMap(key => {
      const template = AVAILABLE_TEMPLATES.find(row => row.key === key);
      return template && (access === 'all' || (template.category ?? 'simple') === access) ? [template] : [];
    })
  })).filter(group => group.templates.length > 0);
}
