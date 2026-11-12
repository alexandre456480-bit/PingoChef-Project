import { resolveFlavor, flavorPrices } from '../models/product-flavors';
import { Injectable, signal, computed } from '@angular/core';
import type { MenuItem } from './menu.service';

export interface CartItem {
  itemId: string;
  flavorId?: string;
  flavorName?: string;
  unavailable?: boolean;
  name: string;
  price: number;
  promotionalPrice?: number | null;
  imageUrl?: string | null;
  quantity: number;
  showPrice?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  cartItems = signal<CartItem[]>([]);
  readonly changeVersion = signal(0);
  isCartOpen = signal<boolean>(false);
  currentSlug = signal<string>('sapatolandia-gourmet');

  // Computed totals for reactive UI
  totalItems = computed(() => {
    return this.cartItems().reduce((acc, item) => acc + item.quantity, 0);
  });

  totalPrice = computed(() => {
    return this.cartItems().reduce((acc, item) => {
      return acc + (item.showPrice === false ? 0 : this.unitPrice(item) * item.quantity);
    }, 0);
  });

  constructor() {
    this.loadFromStorage();
  }

  setSlug(slug: string): void {
    if (this.currentSlug() !== slug) {
      this.currentSlug.set(slug);
      this.loadFromStorage();
    }
  }

  toggleCart(): void {
    this.isCartOpen.set(!this.isCartOpen());
  }

  openCart(): void {
    this.isCartOpen.set(true);
  }

  closeCart(): void {
    this.isCartOpen.set(false);
  }

  unitPrice(item: Pick<CartItem, 'price' | 'promotionalPrice'>): number {
    if ('unavailable' in item && item.unavailable) return 0;
    return item.promotionalPrice != null && item.promotionalPrice >= 0 && item.promotionalPrice < item.price ? item.promotionalPrice : item.price;
  }

  lineKey(row: Pick<CartItem, 'itemId' | 'flavorId'>): string { return `${row.itemId}:${row.flavorId || ''}`; }

  refreshFromCatalog(catalog: MenuItem[]): void {
    let changed = false;
    const rows = this.cartItems().map(row => {
      const item = catalog.find(item => item.id === row.itemId);
      const flavor = item ? resolveFlavor(item, row.flavorId) : undefined;
      const patch = item && flavor !== undefined
        ? { name: item.name, ...flavorPrices(item, flavor), showPrice: item.showPrice, imageUrl: item.imageUrl, flavorName: flavor?.name, unavailable: item.isAvailable === false }
        : { unavailable: true };
      const next = { ...row, ...patch };
      if (JSON.stringify(next) !== JSON.stringify(row)) changed = true;
      return next;
    });
    if (changed) { this.cartItems.set(rows); this.saveToStorage(); }
  }

  addItem(item: MenuItem | { id: string; name: string; price: number; promotionalPrice?: number | null; imageUrl?: string | null; showPrice?: boolean; flavors?: MenuItem['flavors'] }, quantity = 1, flavorId?: string): void {
    const flavor = resolveFlavor(item, flavorId);
    if (flavor === undefined || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 9999) return;
    const current = [...this.cartItems()];
    const index = current.findIndex(row => row.itemId === item.id && row.flavorId === flavorId);
    const row: CartItem = { itemId: item.id, name: item.name, ...flavorPrices(item, flavor), imageUrl: item.imageUrl, showPrice: item.showPrice, flavorId, flavorName: flavor?.name, unavailable: false, quantity };
    if (index > -1) row.quantity = Math.min(9999, current.splice(index, 1)[0].quantity + quantity);
    current.push(row);
    this.cartItems.set(current); this.saveToStorage();
  }

  updateQuantity(itemId: string, delta: number, flavorId?: string): void {
    const current = [...this.cartItems()];
    const index = current.findIndex(i => i.itemId === itemId && i.flavorId === flavorId);

    if (index > -1) {
      if (!Number.isSafeInteger(delta) || (delta > 0 && current[index].unavailable)) return;
      current[index] = { ...current[index], quantity: Math.min(9999, current[index].quantity + delta) };
      if (current[index].quantity <= 0) {
        current.splice(index, 1);
      }
      this.cartItems.set(current);
      this.saveToStorage();
    }
  }

  removeItem(itemId: string, flavorId?: string): void {
    const filtered = this.cartItems().filter(i => i.itemId !== itemId || i.flavorId !== flavorId);
    this.cartItems.set(filtered);
    this.saveToStorage();
  }

  clearCart(): void {
    this.cartItems.set([]);
    this.saveToStorage();
  }

  getItemQuantity(itemId: string): number {
    return this.cartItems().filter(row => row.itemId === itemId).reduce((sum, row) => sum + row.quantity, 0);
  }

  private saveToStorage(): void {
    this.changeVersion.update(version => version + 1);
    try {
      localStorage.setItem(`cart_${this.currentSlug()}`, JSON.stringify(this.cartItems()));
    } catch {
      // LocalStorage safety wrapper
    }
  }

  private loadFromStorage(): void {
    this.changeVersion.update(version => version + 1);
    this.cartItems.set([]);
    try {
      const saved = localStorage.getItem(`cart_${this.currentSlug()}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.cartItems.set(parsed.slice(0, 500).filter(row => row && typeof row.itemId === 'string' && row.itemId.length <= 100
            && Number.isSafeInteger(row.quantity) && row.quantity > 0 && row.quantity <= 9999
            && typeof row.name === 'string' && row.name.length <= 200 && Number.isFinite(row.price) && row.price >= 0
            && (row.flavorId === undefined || (typeof row.flavorId === 'string' && row.flavorId.length <= 100))));
        }
      }
    } catch {
      // LocalStorage safety wrapper
    }
  }
}
