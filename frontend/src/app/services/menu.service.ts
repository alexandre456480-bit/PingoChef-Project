import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { ProductGalleryMedia } from './product-playback.service';
import { API_BASE_URL } from '../constants/api';

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  iconType?: '2d' | '3d' | 'image' | 'none';
  iconKey?: string | null;
  imageUrl?: string | null;
  displayMode?: 'icon_only' | 'icon_text_side' | 'icon_text_stacked';
  displayOrder: number;
  isActive: boolean;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  displayOrder: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  categoryName?: string | null;
  subcategoryId?: string | null;
  subcategoryName?: string | null;
  name: string;
  description?: string | null;
  price: number;
  promotionalPrice?: number | null;
  imageUrl?: string | null;
  isAvailable: boolean;
  isHighlighted: boolean;
  highlightType?: 'none' | 'promotion' | 'most_liked' | 'chef' | 'combo' | 'best_seller';
  showPrice?: boolean;
  displayOrder?: number;
  likesCount?: number;
  media?: ProductGalleryMedia[];
}
export interface ProductRecommendation { triggerProductId: string; recommendedProductIds: string[] }

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private apiUrl = API_BASE_URL;

  categories = signal<Category[]>([]);
  subcategories = signal<Subcategory[]>([]);
  items = signal<MenuItem[]>([]);
  productRecommendations = signal<ProductRecommendation[]>([]);

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): { headers: HttpHeaders } {
    return { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) };
  }

  // --- CATEGORIAS ---
  loadCategories(): Observable<any> {
    return this.http.get(`${this.apiUrl}/categories`, this.getAuthHeaders()).pipe(
      tap((res: any) => {
        if (res.success) {
          this.categories.set(res.data);
        }
      })
    );
  }

  createCategory(data: Partial<Category>): Observable<any> {
    return this.http.post(`${this.apiUrl}/categories`, data, this.getAuthHeaders());
  }

  updateCategory(id: string, data: Partial<Category>): Observable<any> {
    return this.http.put(`${this.apiUrl}/categories/${id}`, data, this.getAuthHeaders());
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/categories/${id}`, this.getAuthHeaders());
  }

  // --- SUBCATEGORIAS ---
  loadSubcategories(categoryId?: string): Observable<any> {
    let url = `${this.apiUrl}/subcategories`;
    if (categoryId) {
      url += `?categoryId=${categoryId}`;
    }
    return this.http.get(url, this.getAuthHeaders()).pipe(
      tap((res: any) => {
        if (res.success) {
          this.subcategories.set(res.data);
        }
      })
    );
  }

  createSubcategory(data: { categoryId: string; name: string; displayOrder?: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/subcategories`, data, this.getAuthHeaders());
  }

  updateSubcategory(id: string, data: { name: string; displayOrder?: number }): Observable<any> {
    return this.http.put(`${this.apiUrl}/subcategories/${id}`, data, this.getAuthHeaders());
  }

  deleteSubcategory(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/subcategories/${id}`, this.getAuthHeaders());
  }

  reorderSubcategories(orders: { id: string; displayOrder: number }[]): Observable<any> {
    return this.http.patch(`${this.apiUrl}/subcategories/reorder`, { orders }, this.getAuthHeaders());
  }

  // --- PRODUTOS / ITENS ---
  loadItems(categoryId?: string): Observable<any> {
    let url = `${this.apiUrl}/items`;
    if (categoryId) {
      url += `?categoryId=${categoryId}`;
    }
    return this.http.get(url, this.getAuthHeaders()).pipe(
      tap((res: any) => {
        if (res.success) {
          this.items.set(res.data);
          this.productRecommendations.set(res.productRecommendations || []);
        }
      })
    );
  }

  createItem(data: Partial<MenuItem>): Observable<any> {
    return this.http.post(`${this.apiUrl}/items`, data, this.getAuthHeaders());
  }
  loadRecommendations(id: string): Observable<any> { return this.http.get(`${this.apiUrl}/items/${id}/recommendations`); }
  saveRecommendations(id: string, recommendedProductIds: string[]): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/items/${id}/recommendations`, { recommendedProductIds }).pipe(tap(res => {
      if (res.success) this.productRecommendations.update(rows => [...rows.filter(row => row.triggerProductId !== id), res.data]);
    }));
  }

  updateItem(id: string, data: Partial<MenuItem>): Observable<any> {
    return this.http.put(`${this.apiUrl}/items/${id}`, data, this.getAuthHeaders());
  }

  toggleItemAvailability(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/items/${id}/toggle-availability`, {}, this.getAuthHeaders());
  }

  deleteItem(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/items/${id}`, this.getAuthHeaders());
  }

  reorderItems(orders: { id: string; displayOrder: number }[]): Observable<any> {
    return this.http.patch(`${this.apiUrl}/items/reorder`, { orders }, this.getAuthHeaders());
  }
}
