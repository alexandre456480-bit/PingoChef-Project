export interface HomeSideImageConfig { enabled: boolean; imageUrl: string | null; }
export function homeSideImage(config: Record<string, unknown> | undefined): HomeSideImageConfig {
  const value = config?.['first_block_image'];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {enabled:false,imageUrl:null};
  const image = value as Record<string,unknown>;
  return {enabled:image['enabled'] === true, imageUrl:typeof image['imageUrl'] === 'string' ? image['imageUrl'] : null};
}
