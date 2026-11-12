import type { CartItem } from '../services/cart.service';
import type { MenuItem, ProductRecommendation } from '../services/menu.service';

export function recommendationMap(rows: ProductRecommendation[]): Map<string, string[]> {
  return new Map(rows.map(row => [row.triggerProductId, row.recommendedProductIds]));
}

/** The cart's insertion order records recency. No prices are copied into relations. */
export function selectCartRecommendation(
  cart: CartItem[], relations: Map<string, string[]>, products: Map<string, MenuItem>,
  categories: Set<string>, unitPrice: (item: MenuItem) => number
): MenuItem | null {
  const present = new Set(cart.map(row => row.itemId));
  const eligible = (item: MenuItem | undefined): item is MenuItem => !!item && categories.has(item.categoryId)
    && (!item.flavors?.length || item.flavors.some(flavor => flavor.isAvailable))
    && item.isAvailable !== false && item.showPrice !== false && Number.isFinite(item.price) && item.price > 0
    && Number.isFinite(unitPrice(item)) && unitPrice(item) > 0;
  for (let index = cart.length - 1; index >= 0; index--) {
    const trigger = cart[index];
    if (!(trigger.quantity > 0) || !eligible(products.get(trigger.itemId))) continue;
    for (const id of relations.get(trigger.itemId) || []) {
      if (present.has(id)) continue;
      const product = products.get(id);
      if (eligible(product)) return product;
    }
  }
  return null;
}
