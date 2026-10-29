export const DEFAULT_TEMPLATE_KEY = 'default';

// Accept cached clients during rollout, but never persist removed templates again.
export const ACCEPTED_TEMPLATE_KEYS = [DEFAULT_TEMPLATE_KEY, 'centered-cover', 'arched-cover', 'brand-hero', 'signature-cover', 'pixel', 'minimal', 'modern', 'premium', 'dark',
  'showcase', 'brand-cover', 'editorial-arc', 'curve-panels'] as const;

export function normalizeTemplateKey(key: unknown): 'default' | 'centered-cover' | 'arched-cover' | 'brand-hero' | 'signature-cover' | 'pixel' {
  return key === 'centered-cover' || key === 'arched-cover' || key === 'brand-hero' || key === 'signature-cover' || key === 'pixel' ? key : DEFAULT_TEMPLATE_KEY;
}

export function withoutTemplateVariant(config: Record<string, unknown> = {}): Record<string, unknown> {
  const { template_variant: _removed, ...personalization } = config;
  return personalization;
}

export function withoutTemplateBlocks<T extends { type: string }>(blocks: T[]): T[] {
  return blocks.filter(block => block.type !== 'template_variant');
}
