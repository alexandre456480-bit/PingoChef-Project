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

  constructor(private http: HttpClient) {
    this.loadLikedItemsFromStorage();
  }

  loadPublicMenu(slug: string): Observable<any> {
    this.loading.set(true);
    this.error.set(null);

    return this.http.get<{ success: boolean; data: PublicMenuResponse }>(`${this.apiUrl}/menu/${slug}`).pipe(
      tap((res) => {
        this.loading.set(false);
        if (res && res.success && res.data) {
          this.menuData.set(res.data);
        } else {
          this.menuData.set(null);
          this.error.set('Este cardápio não está disponível.');
        }
      }),
      catchError((err) => {
        this.menuData.set(null);
        this.error.set(
          err?.status === 404
            ? 'Este cardápio não foi encontrado ou está temporariamente inativo.'
            : 'Não foi possível carregar o cardápio agora. Tente novamente em instantes.'
        );
        this.loading.set(false);
        return of(null);
      })
    );
  }

  private useFallbackData(slug: string): void {
    const defaultData: PublicMenuResponse = {
      business: {
        name: 'Sapatolândia Gourmet',
        slug: slug || 'sapatolandia-gourmet',
        description: 'Sua melhor escolha em gastronomia artesanal e sabor inigualável.',
        logoUrl: '/logo_img.webp',
        coverImageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
        phone: '11999999999',
        whatsapp: '11999999999'
      },
      design: {
        templateKey: 'modern',
        palette: {
          key: 'gourmet_royal',
          name: 'Gourmet Royal',
          colors: {
            primary: '#8B1A3A',
            secondary: '#D26E2D',
            accent: '#F47B20',
            background: '#FAF5F0',
            surface: '#FFFFFF',
            textPrimary: '#2D1822',
            textSecondary: '#6E5D65'
          }
        },
        fontHeading: 'Outfit',
        fontBody: 'Inter',
        fontPair: 'modern_clean',
        categoryStyle: 'icon_name',
        motion: 'fade',
        heroBanners: [
          'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=1200&q=80'
        ],
        homeBlocks: [
          { id: 'block_hero', type: 'hero', label: 'Hero / Capa', enabled: true, position: 0, required: true },
          { id: 'block_categories', type: 'categories', label: 'Categorias', enabled: true, position: 1 },
          { id: 'block_promotion', type: 'promotion', label: 'Promoções & Ofertas', enabled: true, position: 2 },
          { id: 'block_most_liked', type: 'most_liked', label: 'Mais Curtidos', enabled: true, position: 3 },
          { id: 'block_featured', type: 'featured_product', label: 'Pratos do Chef', enabled: true, position: 4 },
          { id: 'block_combos', type: 'combo', label: 'Combos Especiais', enabled: true, position: 5 },
          { id: 'block_best_sellers', type: 'best_seller', label: 'Mais Vendidos', enabled: true, position: 6 }
        ],
        introCard: {
          enabled: true,
          title: 'Gastronomia Autoral & Ingredientes Nobres',
          description: 'Seja muito bem-vindo ao nosso espaço gastronômico! Nossos pratos e burgers são elaborados com carnes nobres grelhadas no fogo e pães artesanais de fermentação natural. Escolha abaixo suas opções favoritas e bom apetite.'
        },
        customConfig: {
          welcome_tagline: 'Experiência gastronômica artesanal e inesquecível',
          enable_likes: true,
          enable_cart: true
        }
      },
      categories: [
        { id: 'cat_hamburgueres', name: 'Hambúrgueres', description: 'Hambúrgueres artesanais na grelha', icon: 'burger', iconType: '2d', iconKey: 'burger', displayOrder: 1, isActive: true },
        { id: 'cat_porcoes', name: 'Porções', description: 'Porções generosas para compartilhar', icon: 'fries', iconType: '2d', iconKey: 'fries', displayOrder: 2, isActive: true },
        { id: 'cat_bebidas', name: 'Bebidas', description: 'Refrigerantes e sucos naturais', icon: 'drink', iconType: '2d', iconKey: 'drink', displayOrder: 3, isActive: true },
        { id: 'cat_sobremesas', name: 'Sobremesas', description: 'Doces e sobremesas da casa', icon: 'dessert', iconType: '2d', iconKey: 'dessert', displayOrder: 4, isActive: true }
      ],
      subcategories: [
        { id: 'sub_artesanais', categoryId: 'cat_hamburgueres', name: 'Artesanais Clássicos', displayOrder: 1 },
        { id: 'sub_smash', categoryId: 'cat_hamburgueres', name: 'Smash Burgers', displayOrder: 2 },
        { id: 'sub_chopps', categoryId: 'cat_bebidas', name: 'Chopps & Cervejas', displayOrder: 1 },
        { id: 'sub_sucos', categoryId: 'cat_bebidas', name: 'Sucos & Refrigerantes', displayOrder: 2 }
      ],
      items: [
        { id: 'itm_bacon_supreme', categoryId: 'cat_hamburgueres', subcategoryId: 'sub_artesanais', name: 'Bacon Supreme Burger', description: 'Hambúrguer de 180g blend wagyu, queijo cheddar inglês derretido, tiras de bacon crocante marinadas em melaço e molho barbecue artesanal da casa.', price: 38.90, promotionalPrice: 32.90, imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80', isAvailable: true, isHighlighted: true, highlightType: 'promotion', displayOrder: 1, likesCount: 42 },
        { id: 'itm_super_combo', categoryId: 'cat_hamburgueres', subcategoryId: 'sub_artesanais', name: 'Super Combo Artesanal (Burger + Fritas + Bebida)', description: 'Bacon Supreme Burger artesanal, porção média de batata rústica crocante e Coca-Cola Zero 350ml trincando.', price: 54.90, promotionalPrice: 46.90, imageUrl: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=800&q=80', isAvailable: true, isHighlighted: true, highlightType: 'combo', displayOrder: 2, likesCount: 78 },
        { id: 'itm_monster_bbq', categoryId: 'cat_hamburgueres', subcategoryId: 'sub_artesanais', name: 'Monster Cheddar BBQ (O Mais Pedido)', description: 'Blend angus 200g grelhado na brasa, cebola crispy caramelizada, molho barbecue artesanal e piscina de queijo cheddar.', price: 39.90, promotionalPrice: null, imageUrl: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=800&q=80', isAvailable: true, isHighlighted: true, highlightType: 'best_seller', displayOrder: 3, likesCount: 95 },
        { id: 'itm_truffle_gourmet', categoryId: 'cat_hamburgueres', subcategoryId: 'sub_artesanais', name: 'Truffle Gourmet Burger', description: 'Blend especial 200g, queijo brie maçaricado, maionese de trufas negras e cogumelos shimeji salteados na manteiga no pão brioche amanteigado.', price: 44.90, promotionalPrice: null, imageUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=800&q=80', isAvailable: true, isHighlighted: true, highlightType: 'chef', displayOrder: 4, likesCount: 38 },
        { id: 'itm_smash_double', categoryId: 'cat_hamburgueres', subcategoryId: 'sub_smash', name: 'Double Smash Classic', description: 'Dois discos de 90g prensa dupla com crosta crocante, queijo americano derretido, picles artesanal de pepino e molho secreto no pão de batata.', price: 29.90, promotionalPrice: 25.90, imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80', isAvailable: true, isHighlighted: false, highlightType: 'none', displayOrder: 5, likesCount: 29 },
        { id: 'itm_fries_cheddar', categoryId: 'cat_porcoes', name: 'Batata Rústica Cheddar & Bacon', description: 'Batatas rústicas douradas e crocantes, cobertas com molho cremoso de queijo cheddar e farofa de bacon crocante.', price: 28.90, promotionalPrice: 23.90, imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80', isAvailable: true, isHighlighted: true, highlightType: 'most_liked', displayOrder: 1, likesCount: 56 },
        { id: 'itm_onion_rings', categoryId: 'cat_porcoes', name: 'Onion Rings Crocantes', description: 'Anéis de cebola empanados com farinha panko temperada, acompanhados de maionese verde de ervas frescas.', price: 24.90, promotionalPrice: null, imageUrl: 'https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&w=800&q=80', isAvailable: true, isHighlighted: false, highlightType: 'none', displayOrder: 2, likesCount: 19 },
        { id: 'itm_coca_zero', categoryId: 'cat_bebidas', subcategoryId: 'sub_sucos', name: 'Coca-Cola Zero 350ml', description: 'Lata 350ml trincando de gelada com fatia de limão opcional.', price: 7.90, promotionalPrice: null, imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80', isAvailable: true, isHighlighted: false, highlightType: 'none', displayOrder: 1, likesCount: 15 },
        { id: 'itm_pink_lemonade', categoryId: 'cat_bebidas', subcategoryId: 'sub_sucos', name: 'Pink Lemonade Artesanal 500ml', description: 'Suco de limão siciliano fresco com xarope natural de frutas vermelhas e água com gás.', price: 14.90, promotionalPrice: 11.90, imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80', isAvailable: true, isHighlighted: true, highlightType: 'promotion', displayOrder: 2, likesCount: 47 },
        { id: 'itm_brownie_ice', categoryId: 'cat_sobremesas', name: 'Brownie de Chocolate com Sorvete', description: 'Brownie quente de chocolate belga 70%, servido com uma bola de sorvete de baunilha e calda morna de fudge.', price: 22.90, promotionalPrice: 18.90, imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80', isAvailable: true, isHighlighted: true, highlightType: 'most_liked', displayOrder: 1, likesCount: 64 }
      ]
    };
    this.menuData.set(defaultData);
    this.loading.set(false);
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

    return this.http.post<LikeApiResponse>(`${this.apiUrl}/menu/${slug}/like/${itemId}`, {}).pipe(
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
