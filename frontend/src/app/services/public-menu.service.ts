import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, finalize, of } from 'rxjs';
import { Category, MenuItem, Subcategory } from './menu.service';
import { DesignSettings } from './design.service';
import { API_BASE_URL } from '../constants/api';

export interface PublicBusiness {
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  coverImageUrl: string;
  welcomeBgType?: 'image' | 'color';
  welcomeBgImage?: string;
  welcomeBgColor?: string;
  phone?: string | null;
  whatsapp?: string | null;
}

export interface PublicMenuResponse {
  business: PublicBusiness;
  design: DesignSettings;
  categories: Category[];
  subcategories?: Subcategory[];
  items: MenuItem[];
}

interface LikeApiResponse {
  success: boolean;
  data: {
    itemId: string;
    likesCount: number;
    created: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PublicMenuService {
  private apiUrl = `${API_BASE_URL}/public`;

  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  menuData = signal<PublicMenuResponse | null>(null);
  likedItemIds = signal<Set<string>>(new Set());
  pendingLikeIds = signal<Set<string>>(new Set());
  private loadVersion = 0;

  constructor(private http: HttpClient) {
    this.loadLikedItemsFromStorage();
  }

  loadPublicMenu(slug: string): Observable<any> {
    const version = ++this.loadVersion;
    this.loading.set(true);
    this.error.set(null);
    this.menuData.set(null);

    return this.http.get<{ success: boolean; data: PublicMenuResponse }>(`${this.apiUrl}/menu/${encodeURIComponent(slug)}`).pipe(
      tap((res) => {
        if (version !== this.loadVersion) return;
        this.loading.set(false);
        if (res?.success && res.data?.business && res.data?.design && Array.isArray(res.data.categories) && Array.isArray(res.data.items)) {
          this.menuData.set(res.data);
        } else {
          this.menuData.set(null);
          this.error.set('Este cardápio não está disponível.');
        }
      }),
      catchError((err) => {
        if (version !== this.loadVersion) return of(null);
        this.menuData.set(null);
        this.error.set(
          err?.status === 404
            ? 'Este cardápio não foi encontrado ou está temporariamente inativo.'
            : 'Não foi possível carregar o cardápio agora. Tente novamente em instantes.'
        );
        this.loading.set(false);
        return of(null);
      }),
      finalize(() => { if (version === this.loadVersion) this.loading.set(false); }),
    );
  }

  likeItem(slug: string, itemId: string): Observable<LikeApiResponse | null> {
    const currentLikes = new Set(this.likedItemIds());
    if (currentLikes.has(itemId) || this.pendingLikeIds().has(itemId)) {
      return of(null);
    }

    const previousCount = this.menuData()?.items.find(item => item.id === itemId)?.likesCount || 0;
    currentLikes.add(itemId);
    this.likedItemIds.set(currentLikes);
    this.saveLikedItemsToStorage();
    this.pendingLikeIds.set(new Set([...this.pendingLikeIds(), itemId]));
    this.setItemLikesCount(itemId, previousCount + 1);

    return this.http.post<LikeApiResponse>(`${this.apiUrl}/menu/${encodeURIComponent(slug)}/like/${encodeURIComponent(itemId)}`, {}).pipe(
      tap((response) => this.setItemLikesCount(itemId, response.data.likesCount)),
      catchError((err) => {
        console.warn('Erro ao sincronizar like no servidor:', err);
        const rolledBackLikes = new Set(this.likedItemIds());
        rolledBackLikes.delete(itemId);
        this.likedItemIds.set(rolledBackLikes);
        this.saveLikedItemsToStorage();
        this.setItemLikesCount(itemId, previousCount);
        return of(null);
      }),
      finalize(() => {
        const pending = new Set(this.pendingLikeIds());
        pending.delete(itemId);
        this.pendingLikeIds.set(pending);
      })
    );
  }

  isItemLiked(itemId: string): boolean {
    return this.likedItemIds().has(itemId);
  }

  isLikePending(itemId: string): boolean {
    return this.pendingLikeIds().has(itemId);
  }

  private setItemLikesCount(itemId: string, likesCount: number): void {
    const currentData = this.menuData();
    if (!currentData) return;
    this.menuData.set({
      ...currentData,
      items: currentData.items.map(item => item.id === itemId ? { ...item, likesCount } : item)
    });
  }

  private loadLikedItemsFromStorage(): void {
    try {
      const saved = localStorage.getItem('guest_liked_items');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          this.likedItemIds.set(new Set(arr));
        }
      }
    } catch {
      // Ignora erro
    }
  }

  private saveLikedItemsToStorage(): void {
    try {
      const arr = Array.from(this.likedItemIds());
      localStorage.setItem('guest_liked_items', JSON.stringify(arr));
    } catch {
      // Ignora erro
    }
  }
}
