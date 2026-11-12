export interface ProductFlavor { id: string; name: string; price: number | null; isAvailable: boolean }
export interface FlavorProduct { price: number; promotionalPrice?: number | null; flavors?: ProductFlavor[] }

export function resolveFlavor(product: FlavorProduct, flavorId?: string): ProductFlavor | null | undefined {
  if (!product.flavors?.length) return flavorId ? undefined : null;
  return product.flavors.find(flavor => flavor.id === flavorId && flavor.isAvailable);
}
export function flavorPrices(product: FlavorProduct, flavor: ProductFlavor | null) {
  return flavor?.price != null ? { price: flavor.price, promotionalPrice: null } : { price: product.price, promotionalPrice: product.promotionalPrice ?? null };
}
