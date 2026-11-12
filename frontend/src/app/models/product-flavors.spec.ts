import { CartService } from '../services/cart.service';
import { orderDestination, OrderSettings } from './order-settings';
import { MenuItem } from '../services/menu.service';

const chicken = { id: '11111111-1111-4111-8111-111111111111', name: 'Frango', price: null, isAvailable: true };
const beef = { id: '22222222-2222-4222-8222-222222222222', name: 'Picanha', price: 18, isAvailable: true };
const product: MenuItem = { id: 'skewer', categoryId: 'food', name: 'Espetinho', price: 12, promotionalPrice: 10, isAvailable: true, isHighlighted: false, flavors: [chicken, beef] };
const settings: OrderSettings = { enabled: true, channel: 'whatsapp', url: 'https://wa.me/5511999999999', button_text: 'Pedir' };

describe('product flavors across cart and checkout', () => {
  beforeEach(() => localStorage.clear()); afterEach(() => localStorage.clear());
  it('requires a choice and keeps quantities, prices and removal independent by flavor', () => {
    const cart = new CartService(); cart.addItem(product); expect(cart.cartItems()).toEqual([]);
    cart.addItem(product, 2, chicken.id); cart.addItem(product, 1, beef.id); cart.addItem(product, 1, chicken.id);
    expect(cart.cartItems()).toHaveLength(2); expect(cart.totalPrice()).toBe(48);
    cart.updateQuantity(product.id, 1, beef.id); expect(cart.totalPrice()).toBe(66);
    cart.removeItem(product.id, chicken.id); expect(cart.cartItems()[0].flavorName).toBe('Picanha'); expect(cart.totalPrice()).toBe(36);
  });
  it('restores chosen flavors, refreshes prices and ignores forged cart names and prices for WhatsApp', () => {
    const cart = new CartService(); cart.addItem(product, 2, beef.id);
    const restored = new CartService(); restored.refreshFromCatalog([product]); expect(restored.totalPrice()).toBe(36);
    const forged = restored.cartItems().map(row => ({ ...row, name: 'Forged', flavorName: 'Forged flavor', price: .01 }));
    const link = orderDestination(settings, forged, [product], 'Casa');
    const message = new URL(link!).searchParams.get('text')!;
    expect(message).toContain('2x Espetinho'); expect(message).toContain('Sabor: Picanha'); expect(message).not.toContain('Forged');
    restored.refreshFromCatalog([{ ...product, flavors: [{ ...beef, price: 20 }] }]); expect(restored.totalPrice()).toBe(40);
  });
  it('blocks removed, unavailable, newly required or forged choices instead of silently switching them', () => {
    const cart = new CartService(); cart.addItem(product, 1, beef.id);
    const unavailable = [{ ...product, flavors: [{ ...beef, isAvailable: false }] }];
    cart.refreshFromCatalog(unavailable); expect(cart.cartItems()[0].unavailable).toBe(true);
    expect(orderDestination(settings, cart.cartItems(), unavailable, 'Casa')).toBeNull();
    expect(orderDestination(settings, cart.cartItems(), [{ ...product, flavors: [] }], 'Casa')).toBeNull();
    expect(orderDestination(settings, [{ ...cart.cartItems()[0], flavorId: 'forged' }], [product], 'Casa')).toBeNull();
    expect(orderDestination(settings, [{ ...cart.cartItems()[0], flavorId: undefined }], [product], 'Casa')).toBeNull();
  });
});
