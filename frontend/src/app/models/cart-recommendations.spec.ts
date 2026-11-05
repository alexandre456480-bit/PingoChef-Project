import { selectCartRecommendation, recommendationMap } from './cart-recommendations';
import { CartService } from '../services/cart.service';
import type { CartItem } from '../services/cart.service';
import type { MenuItem } from '../services/menu.service';

describe('Cart recommendations', () => {
  const product = (id: string, patch: Partial<MenuItem> = {}): MenuItem => ({ id, categoryId: 'cat', name: id, price: 20, isAvailable: true, isHighlighted: false, ...patch });
  const row = (itemId: string): CartItem => ({ itemId, name: itemId, price: 20, quantity: 1 });
  const unitPrice = (item: MenuItem) => CartService.prototype.unitPrice(item);
  const products = new Map(['burger', 'pizza', 'fries', 'drink', 'sauce'].map(id => [id, product(id)]));
  const relations = recommendationMap([{ triggerProductId: 'burger', recommendedProductIds: ['fries', 'drink'] }, { triggerProductId: 'pizza', recommendedProductIds: ['sauce', 'drink'] }]);
  const categories = new Set(['cat']);
  it('uses most recently added trigger, then complement priority and older triggers', () => {
    expect(selectCartRecommendation([row('burger'), row('pizza')], relations, products, categories, unitPrice)?.id).toBe('sauce');
    expect(selectCartRecommendation([row('burger'), row('sauce'), row('drink'), row('pizza')], relations, products, categories, unitPrice)?.id).toBe('fries');
    expect(selectCartRecommendation([], relations, products, categories, unitPrice)).toBeNull();
  });
  it('skips products already in the cart, unavailable, hidden, absent or unpriced', () => {
    for (const patch of [{ isAvailable: false }, { showPrice: false }, { price: 0 }, { price: NaN }, { categoryId: 'hidden' }]) {
      const changed = new Map(products); changed.set('fries', product('fries', patch));
      expect(selectCartRecommendation([row('burger')], relations, changed, categories, unitPrice)?.id).toBe('drink');
    }
    expect(selectCartRecommendation([row('burger'), row('fries')], relations, products, categories, unitPrice)?.id).toBe('drink');
    const missing = new Map(products); missing.delete('fries');
    expect(selectCartRecommendation([row('burger')], relations, missing, categories, unitPrice)?.id).toBe('drink');
  });
  it('uses the existing current-price rule, including promotions, and ignores stale triggers', () => {
    const changed = new Map(products); changed.set('fries', product('fries', { promotionalPrice: 12 }));
    const selected = selectCartRecommendation([row('burger')], relations, changed, categories, unitPrice)!;
    expect(unitPrice(selected)).toBe(12);
    changed.set('burger', product('burger', { isAvailable: false }));
    expect(selectCartRecommendation([row('burger')], relations, changed, categories, unitPrice)).toBeNull();
  });
  it('records repeat additions as most recent and changes the dismissal revision on every cart edit', () => {
    localStorage.clear(); const cart = new CartService(); cart.setSlug('recommendation-test');
    cart.addItem(product('burger')); cart.addItem(product('pizza'));
    const before = cart.changeVersion(); cart.addItem(product('burger'));
    expect(cart.cartItems().map(row => row.itemId)).toEqual(['pizza', 'burger']);
    expect(cart.getItemQuantity('burger')).toBe(2); expect(cart.changeVersion()).toBeGreaterThan(before);
    const latest = cart.changeVersion(); cart.updateQuantity('burger', -1);
    expect(cart.changeVersion()).toBeGreaterThan(latest);
    cart.setSlug('other-business'); expect(cart.cartItems()).toEqual([]);
  });
});
