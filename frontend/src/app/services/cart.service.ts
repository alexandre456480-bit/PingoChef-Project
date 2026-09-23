import { Injectable, signal, computed } from '@angular/core';

export interface CartItem {
  itemId: string;
  name: string;
  price: number;
  promotionalPrice?: number | null;
  imageUrl?: string | null;
  quantity: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  cartItems = signal<CartItem[]>([]);
  isCartOpen = signal<boolean>(false);
  currentSlug = signal<string>('sapatolandia-gourmet');

  // Computed totals for reactive UI
  totalItems = computed(() => {
    return this.cartItems().reduce((acc, item) => acc + item.quantity, 0);
  });

  totalPrice = computed(() => {
    return this.cartItems().reduce((acc, item) => {
      const activePrice = item.promotionalPrice && item.promotionalPrice < item.price ? item.promotionalPrice : item.price;
      return acc + (activePrice * item.quantity);
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

  addItem(item: { id: string; name: string; price: number; promotionalPrice?: number | null; imageUrl?: string | null }, quantity: number = 1): void {
    const current = [...this.cartItems()];
    const index = current.findIndex(i => i.itemId === item.id);

    if (index > -1) {
      current[index].quantity += quantity;
    } else {
      current.push({
        itemId: item.id,
        name: item.name,
        price: item.price,
        promotionalPrice: item.promotionalPrice,
        imageUrl: item.imageUrl,
        quantity: Math.max(1, quantity)
      });
    }

    this.cartItems.set(current);
    this.saveToStorage();
  }

  updateQuantity(itemId: string, delta: number): void {
    const current = [...this.cartItems()];
    const index = current.findIndex(i => i.itemId === itemId);

    if (index > -1) {
      current[index].quantity += delta;
      if (current[index].quantity <= 0) {
        current.splice(index, 1);
      }
      this.cartItems.set(current);
      this.saveToStorage();
    }
  }

  removeItem(itemId: string): void {
    const filtered = this.cartItems().filter(i => i.itemId !== itemId);
    this.cartItems.set(filtered);
    this.saveToStorage();
  }

  clearCart(): void {
    this.cartItems.set([]);
    this.saveToStorage();
  }

  getItemQuantity(itemId: string): number {
    const item = this.cartItems().find(i => i.itemId === itemId);
    return item ? item.quantity : 0;
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(`cart_${this.currentSlug()}`, JSON.stringify(this.cartItems()));
    } catch {
      // LocalStorage safety wrapper
    }
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem(`cart_${this.currentSlug()}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.cartItems.set(parsed);
        }
      }
    } catch {
      // LocalStorage safety wrapper
    }
  }
}
