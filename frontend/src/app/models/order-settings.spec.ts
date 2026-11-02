import { defaultOrderSettings, orderDestination, safeOrderSettings } from './order-settings';
import { CartService } from '../services/cart.service';
import { MenuItem } from '../services/menu.service';

const settings = { ...defaultOrderSettings(), enabled: true, url: 'https://wa.me/5511999999999?text=Antigo' };
const catalog = [{ id: 'food', name: 'Açaí & frutas', price: 30, promotionalPrice: 25, isAvailable: true },
  { id: 'drink', name: 'Água', price: 5, isAvailable: true }] as MenuItem[];
const cart = [{ itemId: 'food', name: 'Nome adulterado', price: 1, quantity: 2 }, { itemId: 'drink', name: 'Velho', price: 1, quantity: 1 }];
describe('order handoff', () => {
  it('sends only the greeting and current item names with quantities', () => {
    const url = new URL(orderDestination(settings, cart, catalog, 'Café da Praça')!);
    expect(url.origin + url.pathname).toBe('https://wa.me/5511999999999');
    const text = url.searchParams.get('text')!;
    expect(text).toBe('Olá! Gostaria de fazer um pedido em Café da Praça:\n\n2x Açaí & frutas\n1x Água');
  });
  it('never reveals hidden prices and blocks removed items, invalid quantities and empty carts', () => {
    const text = new URL(orderDestination(settings, cart, catalog.map(item => ({ ...item, showPrice: false })), 'Pingo')!).searchParams.get('text')!;
    expect(text).toBe('Olá! Gostaria de fazer um pedido em Pingo:\n\n2x Açaí & frutas\n1x Água');
    expect(orderDestination(settings, cart, catalog.slice(1), 'Pingo')).toBeNull();
    expect(orderDestination(settings, [{ ...cart[0], quantity: -1 }], catalog, 'Pingo')).toBeNull();
    expect(orderDestination(settings, [], catalog, 'Pingo')).toBeNull();
  });
  it('opens custom links as configured, and filters unsafe or disabled public settings', () => {
    const external = { ...settings, channel: 'website' as const, url: 'https://pedido.com.br/order?store=1' };
    expect(orderDestination(external, cart, catalog, 'Pingo')).toBe(external.url);
    expect(orderDestination({ ...settings, enabled: false }, cart, catalog, 'Pingo')).toBeNull();
    expect(safeOrderSettings({ ...settings, url: 'javascript:alert(1)' })).toEqual(defaultOrderSettings());
  });
  it('does not carry a cart across establishments without saved selections', () => {
    localStorage.clear();
    const service = new CartService(); service.setSlug('first');
    service.addItem({ id: 'food', name: 'Prato', price: 25 });
    service.setSlug('second'); expect(service.cartItems()).toEqual([]);
    service.setSlug('first'); expect(service.totalItems()).toBe(1);
    localStorage.clear();
  });
  it('refreshes displayed cart prices and hides prices withheld by the current catalog', () => {
    localStorage.clear();
    const service = new CartService();
    service.addItem({ id: 'food', name: 'Old name', price: 1 }, 2);
    service.refreshFromCatalog(catalog);
    expect(service.cartItems()[0].name).toBe('Açaí & frutas');
    expect(service.totalPrice()).toBe(50);
    service.refreshFromCatalog(catalog.map(item => ({ ...item, showPrice: false })));
    expect(service.cartItems()[0].showPrice).toBe(false);
    expect(service.totalPrice()).toBe(0);
    localStorage.clear();
  });
});
