import { TemplateConfig, resolveMenuTemplate } from '../../constants/menu-templates';
import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, ViewChild, ChangeDetectionStrategy, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Category, MenuItem, MenuService, Subcategory } from '../../services/menu.service';
import {
  DesignService,
  DesignSettings,
  AVAILABLE_PALETTES,
  AVAILABLE_FONT_PAIRS,
  contrastTextColor,
  HomeBlock
} from '../../services/design.service';
import { PublicMenuService, PublicBusiness } from '../../services/public-menu.service';
import { PublicAnalyticsService } from '../../services/public-analytics.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { findCatalogIcon } from '../../constants/icon-catalog';
import { ProductMediaGalleryComponent } from '../product-media-gallery/product-media-gallery.component';
import { MenuRevealDirective } from './menu-reveal.directive';
import { MenuImageDirective, safeMenuImage } from './menu-image.directive';
import { MenuFontsService, menuFont } from '../../services/menu-fonts.service';
import { DialogFocusDirective } from '../dialog-focus.directive';
import { MenuHomeIconComponent } from '../menu-home-icon/menu-home-icon.component';
import { HomeIconSection, homeIconChoice } from '../../constants/home-icons';

export const normalizeMenuSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

@Component({
  selector: 'app-public-menu-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ProductMediaGalleryComponent, MenuRevealDirective, MenuImageDirective, DialogFocusDirective, MenuHomeIconComponent],
  template: `
    <div
      class="menu-viewport"
      [class.in-phone]="isPhonePreview"
      [attr.data-template]="templateKey"
      [style.--template-hero-ratio]="currentTemplate.heroRatio"
      [style.--template-hero-radius.px]="currentTemplate.heroRadius"
      [style.--template-logo-size.px]="currentTemplate.logoSize"
      [style.--template-logo-radius.px]="currentTemplate.logoRadius"
      [style.--template-description-align]="currentTemplate.descriptionAlign"
      [style.--template-category-radius.px]="currentTemplate.categoryRadius"
      [style.--template-button-radius.px]="currentTemplate.buttonRadius"
      [style.--template-item-radius.px]="currentTemplate.itemRadius"
      [style.--template-item-image-size.px]="currentTemplate.itemImageSize"
      [style.--bg-color]="screenBg"
      [style.--surface-color]="surfaceColor"
      [style.--primary-color]="primaryColor"
      [style.--secondary-color]="secondaryColor"
      [style.--accent-color]="accentColor"
      [style.--on-primary]="primaryContrast"
      [style.--on-accent]="accentContrast"
      [style.--on-action]="actionContrast"
      [style.--text-primary]="textPrimary"
      [style.--text-secondary]="textSecondary"
      [style.--heading-font]="headingFont + ', sans-serif'"
      [style.--body-font]="bodyFont + ', sans-serif'"
      [style.font-family]="bodyFont + ', sans-serif'">

      <!-- ══════════════════════════════════════════════════ -->
      <!-- ── 1. WELCOME SCREEN (TELA DE ENTRADA) ── -->
      <!-- ══════════════════════════════════════════════════ -->
      @if (viewState === 'welcome' || viewState === 'transitioning') {
        <div
          class="welcome-screen"
          [class.anim-exit]="viewState === 'transitioning'"

          [style.background-color]="welcomeBgColor">

          @if (welcomeBgType === 'image' && welcomeBgImage) {
            <img class="welcome-cover" [appMenuImage]="welcomeBgImage" menuImageKind="hero" menuImagePriority="high" alt="" />
          }
          <!-- Dynamic Glass Gradient Overlay -->
          <div
            class="welcome-overlay"
            [style.background]="'radial-gradient(circle at 50% 30%, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.85) 75%, ' + (welcomeBgType === 'color' ? welcomeBgColor : screenBg) + ' 100%)'">
          </div>

          <!-- Ambient Lighting Pulses -->
          <div class="ambient-glow" [style.background]="accentColor"></div>

          <!-- Welcome Center Content -->
          <div class="welcome-content">
            <!-- Floating Logo with Glowing Ring -->
            <div class="welcome-logo-wrap">
              <img [appMenuImage]="logoUrl" menuImageKind="logo" [alt]="businessName" class="welcome-logo-img" [menuImagePriority]="welcomeBgType === 'image' && welcomeBgImage ? 'auto' : 'high'" />
            </div>

            <!-- Business Typography -->
            <div class="welcome-texts">
              <span class="welcome-kicker" [style.color]="accentColor">BEM-VINDO AO</span>
              <h1 class="welcome-title" [style.font-family]="headingFont + ', sans-serif'">
                {{ businessName }}
              </h1>
              @if (businessDescription.trim()) {
                <p class="welcome-tagline welcome-desc-custom">
                  {{ businessDescription }}
                </p>
              }
            </div>

            <!-- CINEMATIC CTA BUTTON -->
            <div class="cta-action-area">
              <button
                type="button"
                class="btn-enter-menu"
                [style.background]="'linear-gradient(135deg, ' + accentColor + ', ' + primaryColor + ')'"
                (click)="openMenuWithAnimation()">
                <span class="btn-shimmer"></span>
                <span class="btn-text">Ver o Cardápio</span>
                <div class="btn-icon-circle">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </div>
              </button>
              <span class="cta-sub-hint">Toque para explorar</span>
            </div>
          </div>
        </div>
      }

      <!-- ══════════════════════════════════════════════════ -->
      <!-- ── 2. VITRINE & MENU PRINCIPAL ── -->
      <!-- ══════════════════════════════════════════════════ -->
      @if (viewState === 'menu' || viewState === 'transitioning') {
        <div
          class="menu-main-shell"
          [attr.inert]="selectedProduct ? '' : null"
          [class.anim-enter]="viewState === 'transitioning'"
          [class.menu-opening]="menuOpening"
          [style.background]="screenBg">

          <!-- Floating Control Capsule (Search, Cart & Reset) -->
          <ng-template #controlsTemplate>
          <div class="floating-controls-capsule" [style.background]="surfaceColor + 'D9'">
            <button
              type="button"
              class="capsule-btn"
              [class.active]="searchActive"
              (click)="toggleSearch()"
              title="Buscar prato ou bebida" aria-label="Buscar prato ou bebida" [attr.aria-expanded]="searchActive" aria-controls="public-menu-search">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>

            <!-- Cart Capsule Button -->
            @if (enableCart) {
              <div class="capsule-divider"></div>
              <button
                type="button"
                class="capsule-btn cart-capsule-btn"
                [class.active]="cartService.isCartOpen()"
                (click)="cartService.toggleCart()"
                title="Ver Carrinho de Compras">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
                @if (cartService.totalItems() > 0) {
                  <span class="cart-badge-count" [style.background]="accentColor">{{ cartService.totalItems() }}</span>
                }
              </button>
            }


          </div>
          </ng-template>
          @if (!heroControlsInside) {
            <ng-container *ngTemplateOutlet="controlsTemplate"></ng-container>
          }

          <!-- Search Expandable Bar -->
          @if (searchActive) {
            <div id="public-menu-search" class="search-drawer" [style.padding-right.px]="82 + (enableCart ? 48 : 0)" [style.background]="surfaceColor + 'F2'">
              <div class="search-field-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text"
                  [value]="searchFilter"
                  (input)="updateSearch($event)"
                  (compositionend)="updateSearch($event)"
                  aria-label="Buscar produtos" placeholder="Buscar pelo nome do prato ou bebida..."
                  class="search-input"
                  autofocus />
                @if (searchFilter) {
                  <button type="button" class="clear-btn" aria-label="Limpar busca" (click)="searchFilter = ''">✕</button>
                }
              </div>
            </div>
          }

          <!-- Scrollable Showcase Body -->
          <div class="showcase-scrollable" #showcaseScroller>

            @if (!(activeCatId ? isCategoryHeroEnabled : showHeroBlock) && !searchFilter) {
              <div class="no-hero-header" [style.background]="surfaceColor" [style.border-bottom]="'1px solid ' + surfaceColor + '30'">
                <div class="no-hero-brand">
                  <div class="no-hero-logo-wrap">
                    <img [appMenuImage]="logoUrl" menuImageKind="logo" [alt]="businessName" class="no-hero-logo-img" />
                  </div>
                  <div class="no-hero-texts">
                    <h2 class="no-hero-title" [style.font-family]="headingFont + ', sans-serif'" [style.color]="textPrimary">{{ businessName }}</h2>
                    <span class="no-hero-tagline" [style.color]="textSecondary">{{ businessDescription || welcomeTagline }}</span>
                  </div>
                </div>
              </div>
            }

            <!-- TEMPLATE REUTILIZÁVEL: HERO BANNER SECTION (Exibido no Início e nas Categorias) -->
            <ng-template #brandIdentityTemplate>
              <div class="template-brand-header">
                <div class="template-logo-wrap">
                  <img [appMenuImage]="logoUrl" menuImageKind="logo" [alt]="businessName" class="template-logo" />
                </div>
                <div class="template-brand-copy">
                  <h2>{{ businessName }}</h2>
                  @if (businessDescription.trim()) {
                    <p>{{ businessDescription }}</p>
                  }
                </div>
              </div>
            </ng-template>

            <ng-template #heroBannerTemplate>
              <div
                class="showcase-hero-banner"
                appMenuReveal
                (mouseenter)="stopBannerTimer()"
                (mouseleave)="startBannerTimer()">
                <div class="hero-carousel-track">
                  @for (banner of heroBanners; track $index; let bIdx = $index) {
                    <div
                      class="hero-carousel-slide"
                      [class.active]="currentBannerIndex === bIdx"
                      >
                      @if (currentBannerIndex === bIdx) {
                        <img class="hero-slide-image" [appMenuImage]="banner" menuImageKind="hero" alt="" />
                      }
                    </div>
                  }
                </div>

                @if (heroControlsInside) {
                  <ng-container *ngTemplateOutlet="controlsTemplate"></ng-container>
                }
                @if (currentTemplate.brandPosition === 'inside-hero') {
                  <ng-container *ngTemplateOutlet="brandIdentityTemplate"></ng-container>
                }

                <div class="hero-banner-overlay">
                  @if (heroBanners.length > 1) {
                    <div class="carousel-dots-wrap">
                      @for (banner of heroBanners; track $index; let dIdx = $index) {
                        <button
                          type="button"
                          class="carousel-dot"
                          [class.active]="currentBannerIndex === dIdx"
                          [style.--dot-accent]="accentColor"
                          (click)="selectBanner(dIdx)"
                          [attr.aria-label]="'Banner ' + (dIdx + 1)">
                        </button>
                      }
                    </div>
                  }
                </div>

              </div>
              @if (currentTemplate.brandPosition === 'below-hero') {
                <ng-container *ngTemplateOutlet="brandIdentityTemplate"></ng-container>
              }
            </ng-template>

            <ng-template #introDescriptionTemplate>
              @if (hasIntroCard) {
                <div class="intro-description-wrapper">
                  <div
                    class="intro-description-card"
                    appMenuReveal>

                    <div class="intro-card-body">
                      @if (introCard.title) {
                        <h3
                          class="intro-card-title"
                          [style.font-family]="headingFont + ', sans-serif'"
                          [style.color]="textPrimary">
                          {{ introCard.title }}
                        </h3>
                      }
                      @if (introCard.description) {
                        <p
                          class="intro-card-desc"
                          [style.font-family]="bodyFont + ', sans-serif'"
                          [style.color]="textSecondary"
                          [textContent]="introCard.description"></p>
                      }
                    </div>
                  </div>
                </div>
              }
            </ng-template>

            <!-- Home block order and enabled flags belong to the customer. -->
            @if (!searchFilter && !activeCatId) {
              @if (!showHeroBlock) {
                <ng-container *ngTemplateOutlet="introDescriptionTemplate"></ng-container>
              }

              @for (block of orderedHomeBlocks; track block.id) {
                <!-- BLOCO HERO / BANNER -->
                @if (block.type === 'hero') {
                  @if (showHeroBlock) {
                    @if (currentTemplate.descriptionPosition === 'before-hero') {
                      <ng-container *ngTemplateOutlet="introDescriptionTemplate"></ng-container>
                    }
                    <ng-container *ngTemplateOutlet="heroBannerTemplate"></ng-container>
                    @if (currentTemplate.descriptionPosition === 'after-hero') {
                      <ng-container *ngTemplateOutlet="introDescriptionTemplate"></ng-container>
                    }
                  }
                }

                <!-- BLOCO DE CATEGORIAS -->
                @else if (block.type === 'categories' && showCategoriesBlock) {
                  <div class="categories-nav-section" appMenuReveal>
                    <div class="cat-nav-scroll">
                      <!-- Botão Início com Ícone Personalizado de Bistrô/Fachada Gastronômica -->
                      <button
                        type="button"
                        class="category-nav-pill"
                        [class.active]="!activeCatId" [attr.aria-current]="!activeCatId ? 'page' : null"
                        [style.--active-color]="accentColor"
                        (click)="filterCategory(null)">
                        @if (homeIcon('home') === undefined) {
                          <div class="cat-pill-icon svg-3d">
                            @if (homeBistroSvg) {
                              <div class="cat-pill-svg" [innerHTML]="homeBistroSvg"></div>
                            } @else {
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                                <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
                                <path d="M2 7h20"/>
                                <path d="M22 7a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0"/>
                              </svg>
                            }
                          </div>
                        } @else if (homeIcon('home') !== null) {
                          <div class="cat-pill-icon svg-3d"><app-menu-home-icon class="cat-pill-svg" section="home" [choice]="homeIcon('home')" /></div>
                        }
                          <span class="cat-pill-label">Início</span>
                        </button>

                      @for (cat of visibleCategories; track cat.id) {
                        <button
                          type="button"
                          class="category-nav-pill"
                          [class.active]="activeCatId === cat.id" [attr.aria-current]="activeCatId === cat.id ? 'page' : null" [attr.aria-label]="cat.name"
                          [attr.data-display-mode]="cat.displayMode || 'icon_text_side'"
                          [style.--active-color]="accentColor"
                          (click)="filterCategory(cat.id)">
                          @if (cat.displayMode !== 'icon_only' || cat.iconType !== 'none') {
                            @if (cat.iconType === 'image' && cat.imageUrl) {
                              <img [appMenuImage]="cat.imageUrl" [alt]="cat.name" class="cat-pill-img" />
                            } @else if (cat.iconType !== 'none' && getCatSvg(cat)) {
                              <div class="cat-pill-svg" [innerHTML]="getCatSvg(cat)"></div>
                            }
                          }
                          @if (cat.displayMode !== 'icon_only') {
                            <span class="cat-pill-label">{{ cat.name }}</span>
                          }
                        </button>
                      }
                    </div>
                  </div>
                }

                <!-- BLOCO DE PROMOÇÕES -->
                @else if (block.type === 'promotion' && showPromoBlock && promoItems.length > 0) {
                  <div class="showcase-block promo-block" appMenuReveal>
                    <div class="block-header">
                      <div class="block-title-row">

                        <h3 class="block-title" [style.font-family]="headingFont + ', sans-serif'" [style.color]="textPrimary">@if (homeIcon('promotion') === undefined) { <span class="block-title-icon" aria-hidden="true">🔥</span> } @else if (homeIcon('promotion') !== null) { <app-menu-home-icon class="block-title-icon" section="promotion" [choice]="homeIcon('promotion')" /> }Promoções & Ofertas</h3>
                      </div>
                    </div>

                    <div class="promo-items-scroll">
                      @for (item of promoItems; track item.id) {
                        <div class="promo-item-card" [style.background]="surfaceColor" (click)="openProductDetail(item)">
                          <button type="button" class="product-card-trigger" [attr.aria-label]="'Ver detalhes de ' + item.name" (click)="openProductDetail(item); $event.stopPropagation()"></button>

                          <div class="promo-img-wrap">
                            @if (item.imageUrl) {
                              <img [appMenuImage]="item.imageUrl" [alt]="item.name" class="card-photo" />
                            } @else {
                              <div class="photo-placeholder" [style.color]="accentColor">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                  <rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                                </svg>
                              </div>
                            }
                          </div>

                          <div class="promo-card-content">
                            <h4 class="card-name" [style.color]="textPrimary">{{ item.name }}</h4>
                            <div class="card-pricing">
                              @if (item.showPrice === false) {
                                <span class="active-price" style="font-size: 0.85rem; font-style: italic;" [style.color]="accentColor">Consulte...</span>
                              } @else if (item.promotionalPrice) {
                                <span class="old-price" [style.color]="textSecondary">R$ {{ item.price.toFixed(2) }}</span>
                                <span class="active-price" [style.color]="accentColor">R$ {{ item.promotionalPrice.toFixed(2) }}</span>
                              } @else {
                                <span class="active-price" [style.color]="accentColor">R$ {{ item.price.toFixed(2) }}</span>
                              }
                            </div>
                          @if (enableLikes) {
                            <button
                              type="button"
                              class="card-like-btn"
                              [class.liked]="isLiked(item.id)"
                              [disabled]="isLikePending(item.id)"
                              [attr.aria-pressed]="isLiked(item.id)"
                              [attr.aria-label]="isLiked(item.id) ? 'Item já curtido' : 'Curtir item'"
                              (click)="onLikeClick($event, item.id)">
                              <svg width="16" height="16" viewBox="0 0 24 24" [attr.fill]="isLiked(item.id) ? '#E11D48' : 'none'" stroke="currentColor" stroke-width="2">
                                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                              </svg>
                            </button>
                          }
                          </div>

                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- BLOCO MAIS CURTIDOS -->
                @else if (block.type === 'most_liked' && showMostLikedBlock && enableLikes && mostLikedItems.length > 0) {
                  <div class="showcase-block" appMenuReveal>
                    <div class="block-header">
                      <div class="block-title-row">

                        <h3 class="block-title" [style.font-family]="headingFont + ', sans-serif'" [style.color]="textPrimary">@if (homeIcon('most_liked') === undefined) { <span class="block-title-icon" aria-hidden="true">❤️</span> } @else if (homeIcon('most_liked') !== null) { <app-menu-home-icon class="block-title-icon" section="most_liked" [choice]="homeIcon('most_liked')" /> }Os Mais Curtidos</h3>
                      </div>
                    </div>

                    <div class="liked-ranking-list">
                      @for (item of mostLikedItems; track item.id) {
                        <div class="ranking-item-row" [style.background]="surfaceColor" (click)="openProductDetail(item)">
                          <button type="button" class="product-card-trigger" [attr.aria-label]="'Ver detalhes de ' + item.name" (click)="openProductDetail(item); $event.stopPropagation()"></button>

                          <div class="ranking-img-wrap">
                            @if (item.imageUrl) {
                              <img [appMenuImage]="item.imageUrl" [alt]="item.name" class="row-thumb" />
                            } @else {
                              <div class="thumb-fallback" [style.color]="accentColor">★</div>
                            }
                          </div>
                          <div class="row-info">
                            <span class="row-name" [style.color]="textPrimary">{{ item.name }}</span>
                            <span class="row-price" [style.color]="accentColor">
                              {{ item.showPrice === false ? 'Consulte...' : 'R$ ' + (item.promotionalPrice || item.price).toFixed(2) }}
                            </span>
                          </div>

                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- BLOCO PRATOS DO CHEF / ESPECIALIDADES -->
                @else if (block.type === 'featured_product' && showFeaturedBlock && featuredItems.length > 0) {
                  <div class="showcase-block featured-chef-block" appMenuReveal>
                    <div class="block-header">
                      <div class="block-title-row">

                        <h3 class="block-title" [style.font-family]="headingFont + ', sans-serif'" [style.color]="textPrimary">@if (homeIcon('featured_product') === undefined) { <img class="block-title-icon" src="/icons_chef_hat.webp" alt="" /> } @else if (homeIcon('featured_product') !== null) { <app-menu-home-icon class="block-title-icon" section="featured_product" [choice]="homeIcon('featured_product')" /> }Pratos do Chef & Especialidades</h3>
                      </div>
                    </div>

                    @defer (on viewport) {
                    <div class="featured-chef-grid">
                      @for (item of featuredItems; track item.id) {
                        <div class="featured-chef-card" [style.background]="surfaceColor" (click)="openProductDetail(item)">
                          <button type="button" class="product-card-trigger" [attr.aria-label]="'Ver detalhes de ' + item.name" (click)="openProductDetail(item); $event.stopPropagation()"></button>
                          <div class="chef-card-photo-wrap">
                            @if (item.imageUrl) {
                              <img [appMenuImage]="item.imageUrl" [alt]="item.name" class="chef-photo" />
                            } @else {
                              <div class="chef-fallback" [style.color]="accentColor">★</div>
                            }

                          </div>
                          <div class="chef-card-content">
                            <h4 class="chef-card-name" [style.color]="textPrimary">{{ item.name }}</h4>
                            <p class="chef-card-desc" [style.color]="textSecondary">{{ item.description || 'Preparo artesanal com receita exclusiva da casa.' }}</p>
                            <div class="chef-card-pricing">
                              <span class="chef-price" [style.color]="accentColor">
                                {{ item.showPrice === false ? 'Consulte...' : 'R$ ' + (item.promotionalPrice || item.price).toFixed(2) }}
                              </span>
                              <span class="btn-chef-view" [style.background]="accentColor + '20'" [style.color]="accentColor">Ver Prato</span>
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                    } @placeholder {
                      <div class="featured-chef-grid module-skeleton" role="status" aria-label="Preparando produtos">
                        @for (item of featuredItems; track item.id) {
                          <div class="featured-chef-card module-skeleton-card" [style.background]="surfaceColor" aria-hidden="true">
                            <div class="chef-card-photo-wrap skeleton-photo"></div>
                            <div class="chef-card-content"><span class="skeleton-copy"></span><span class="skeleton-copy short"></span><span class="skeleton-copy"></span></div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }

                <!-- BLOCO COMBOS ESPECIAIS -->
                @else if (block.type === 'combo' && showCombosBlock && comboItems.length > 0) {
                  <div class="showcase-block combos-block" appMenuReveal>
                    <div class="block-header">
                      <div class="block-title-row">

                        <h3 class="block-title" [style.font-family]="headingFont + ', sans-serif'" [style.color]="textPrimary">@if (homeIcon('combo') === undefined) { <span class="block-title-icon" aria-hidden="true" [innerHTML]="highlightTitleIcon('3d-combo')"></span> } @else if (homeIcon('combo') !== null) { <app-menu-home-icon class="block-title-icon" section="combo" [choice]="homeIcon('combo')" /> }Combos Especiais</h3>
                      </div>
                    </div>

                    @defer (on viewport) {
                    <div class="combos-scroll-track">
                      @for (item of comboItems; track item.id) {
                        <div class="combo-card" [style.background]="surfaceColor" (click)="openProductDetail(item)">
                          <button type="button" class="product-card-trigger" [attr.aria-label]="'Ver detalhes de ' + item.name" (click)="openProductDetail(item); $event.stopPropagation()"></button>

                          <div class="combo-img-wrap">
                            @if (item.imageUrl) {
                              <img [appMenuImage]="item.imageUrl" [alt]="item.name" class="combo-card-img" />
                            } @else {
                              <div class="photo-placeholder" [style.color]="accentColor">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                  <rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                                </svg>
                              </div>
                            }

                          </div>

                          <div class="combo-card-content">
                            <h4 class="card-name" [style.color]="textPrimary">{{ item.name }}</h4>
                            <p class="combo-desc" [style.color]="textSecondary">{{ item.description || 'Combo especial com excelente custo-benefício.' }}</p>
                            <div class="combo-pricing-row">
                              <div class="combo-prices">
                                @if (item.showPrice === false) {
                                  <span class="active-price" style="font-size: 0.85rem; font-style: italic;" [style.color]="accentColor">Consulte...</span>
                                } @else if (item.promotionalPrice) {
                                  <span class="old-price" [style.color]="textSecondary">R$ {{ item.price.toFixed(2) }}</span>
                                  <span class="active-price" [style.color]="accentColor">R$ {{ item.promotionalPrice.toFixed(2) }}</span>
                                } @else {
                                  <span class="active-price" [style.color]="accentColor">R$ {{ item.price.toFixed(2) }}</span>
                                }
                              </div>
                              <span class="btn-combo-view" [style.background]="accentColor + '18'" [style.color]="accentColor">Ver Combo</span>
                            @if (enableLikes) {
                              <button
                                type="button"
                                class="card-like-btn"
                                [class.liked]="isLiked(item.id)"
                                [disabled]="isLikePending(item.id)"
                                [attr.aria-pressed]="isLiked(item.id)"
                                [attr.aria-label]="isLiked(item.id) ? 'Item já curtido' : 'Curtir item'"
                                (click)="onLikeClick($event, item.id)">
                                <svg width="16" height="16" viewBox="0 0 24 24" [attr.fill]="isLiked(item.id) ? '#E11D48' : 'none'" stroke="currentColor" stroke-width="2">
                                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                                </svg>
                              </button>
                            }
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                    } @placeholder {
                      <div class="combos-scroll-track module-skeleton" role="status" aria-label="Preparando produtos">
                        @for (item of comboItems; track item.id) {
                          <div class="combo-card module-skeleton-card" [style.background]="surfaceColor" aria-hidden="true">
                            <div class="combo-img-wrap skeleton-photo"></div>
                            <div class="combo-card-content"><span class="skeleton-copy"></span><span class="skeleton-copy short"></span><span class="skeleton-copy"></span></div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }

                <!-- BLOCO MAIS VENDIDOS -->
                @else if (block.type === 'best_seller' && showBestSellersBlock && bestSellerItems.length > 0) {
                  <div class="showcase-block best-sellers-block" appMenuReveal>
                    <div class="block-header">
                      <div class="block-title-row">

                        <h3 class="block-title" [style.font-family]="headingFont + ', sans-serif'" [style.color]="textPrimary">@if (homeIcon('best_seller') === undefined) { <span class="block-title-icon" aria-hidden="true" [innerHTML]="highlightTitleIcon('3d-bestseller')"></span> } @else if (homeIcon('best_seller') !== null) { <app-menu-home-icon class="block-title-icon" section="best_seller" [choice]="homeIcon('best_seller')" /> }Mais Vendidos</h3>
                      </div>

                    </div>

                    @defer (on viewport) {
                    <div class="best-sellers-grid">
                      @for (item of bestSellerItems; track item.id) {
                        <div class="best-seller-card" [style.background]="surfaceColor" (click)="openProductDetail(item)">
                          <button type="button" class="product-card-trigger" [attr.aria-label]="'Ver detalhes de ' + item.name" (click)="openProductDetail(item); $event.stopPropagation()"></button>

                          <div class="best-seller-img-wrap">
                            @if (item.imageUrl) {
                              <img [appMenuImage]="item.imageUrl" [alt]="item.name" class="best-seller-thumb" />
                            } @else {
                              <div class="thumb-fallback" [style.color]="accentColor">★</div>
                            }

                          </div>
                          <div class="best-seller-info">
                            <h4 class="best-seller-name" [style.color]="textPrimary">{{ item.name }}</h4>
                            <span class="best-seller-price" [style.color]="accentColor">
                              {{ item.showPrice === false ? 'Consulte...' : 'R$ ' + (item.promotionalPrice || item.price).toFixed(2) }}
                            </span>
                          </div>
                          <div class="best-seller-action-wrap">
                            <button type="button" class="btn-best-seller-view" [style.background]="accentColor + '18'" [style.color]="accentColor">
                              Ver
                            </button>
                          @if (enableLikes) {
                              <button
                                type="button"
                                class="card-like-btn"
                                [class.liked]="isLiked(item.id)"
                                [disabled]="isLikePending(item.id)"
                                [attr.aria-pressed]="isLiked(item.id)"
                                [attr.aria-label]="isLiked(item.id) ? 'Item já curtido' : 'Curtir item'"
                                (click)="onLikeClick($event, item.id)">
                                <svg width="16" height="16" viewBox="0 0 24 24" [attr.fill]="isLiked(item.id) ? '#E11D48' : 'none'" stroke="currentColor" stroke-width="2">
                                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                                </svg>
                              </button>
                            }
                            </div>
                        </div>
                      }
                    </div>
                    } @placeholder {
                      <div class="best-sellers-grid module-skeleton" role="status" aria-label="Preparando produtos">
                        @for (item of bestSellerItems; track item.id) {
                          <div class="best-seller-card module-skeleton-card" [style.background]="surfaceColor" aria-hidden="true">
                            <div class="best-seller-img-wrap skeleton-photo"></div>
                            <div class="best-seller-info"><span class="skeleton-copy"></span><span class="skeleton-copy short"></span><span class="skeleton-copy"></span></div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              }
            } @else if (!searchFilter) {
              <!-- Hero Section nas outras categorias (mantendo a descrição/intro card oculta) -->
              @if (isCategoryHeroEnabled) {
                <ng-container *ngTemplateOutlet="heroBannerTemplate"></ng-container>
              }

              <!-- Barra de Categorias fixa se estiver navegando por categoria -->
              @if (showCategoriesBlock) {
                <div class="categories-nav-section">
                  <div class="cat-nav-scroll">
                    <!-- Botão Início com Ícone Personalizado de Bistrô/Fachada Gastronômica -->
                    <button
                      type="button"
                      class="category-nav-pill"
                      [class.active]="!activeCatId" [attr.aria-current]="!activeCatId ? 'page' : null"
                      [style.--active-color]="accentColor"
                      (click)="filterCategory(null)">
                      @if (homeIcon('home') === undefined) {
                            <div class="cat-pill-icon svg-3d">
                          @if (homeBistroSvg) {
                            <div class="cat-pill-svg" [innerHTML]="homeBistroSvg"></div>
                          } @else {
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
                              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                              <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
                              <path d="M2 7h20"/>
                              <path d="M22 7a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0"/>
                            </svg>
                          }
                        </div>
                          } @else if (homeIcon('home') !== null) {
                            <div class="cat-pill-icon svg-3d"><app-menu-home-icon class="cat-pill-svg" section="home" [choice]="homeIcon('home')" /></div>
                          }
                        <span class="cat-pill-label">Início</span>
                      </button>

                    @for (cat of visibleCategories; track cat.id) {
                      <button
                        type="button"
                        class="category-nav-pill"
                        [class.active]="activeCatId === cat.id" [attr.aria-current]="activeCatId === cat.id ? 'page' : null" [attr.aria-label]="cat.name"
                        [attr.data-display-mode]="cat.displayMode || 'icon_text_side'"
                        [style.--active-color]="accentColor"
                        (click)="filterCategory(cat.id)">
                        @if (cat.displayMode !== 'icon_only' || cat.iconType !== 'none') {
                          @if (cat.iconType === 'image' && cat.imageUrl) {
                            <img [appMenuImage]="cat.imageUrl" [alt]="cat.name" class="cat-pill-img" />
                          } @else if (cat.iconType !== 'none' && getCatSvg(cat)) {
                            <div class="cat-pill-svg" [innerHTML]="getCatSvg(cat)"></div>
                          }
                        }
                        @if (cat.displayMode !== 'icon_only') {
                          <span class="cat-pill-label">{{ cat.name }}</span>
                        }
                      </button>
                    }
                  </div>
                </div>
              }
            }

            <!-- 5. CATÁLOGO DE PRODUTOS POR CATEGORIA OU RESULTADO DA BUSCA -->
            @if (activeCatId || searchFilter) {
              <div class="catalog-section" #catalogSection [class.category-enter]="categoryTransitioning">
                <div class="catalog-header-row">
                  <div>
                    <h3 class="section-heading" [style.font-family]="headingFont + ', sans-serif'" [style.color]="textPrimary">
                      {{ currentCategoryName }}
                    </h3>
                    <span class="catalog-count" [style.color]="textSecondary">{{ displayItems.length }} itens encontrados</span>
                  </div>
                  @if (activeCatId) {
                    <button type="button" class="btn-back-home" (click)="filterCategory(null)" [style.color]="accentColor">
                      ← Voltar ao Início
                    </button>
                  }
                </div>

                <!-- Items rendering: Subcategories grouping or flat list -->
                @if (activeCategorySubcategories.length > 0 && !searchFilter) {
                  @for (sub of activeCategorySubcategories; track sub.id) {
                    @if (getItemsBySubcategory(sub.id).length > 0) {
                      <div class="subcategory-group">
                        <div
                          class="subcategory-header-collapsible"
                          appMenuReveal
                          (click)="toggleSubcategory(sub.id)"
                          (keydown.enter)="toggleSubcategory(sub.id)"
                          (keydown.space)="$event.preventDefault(); toggleSubcategory(sub.id)"
                          role="button"
                          tabindex="0"
                          [attr.aria-expanded]="!isSubcategoryCollapsed(sub.id)">
                          <div class="subcat-title-wrap">
                            <span class="subcat-indicator" [style.background]="accentColor"></span>
                            <h4 class="subcategory-title" [style.color]="textPrimary">{{ sub.name }}</h4>
                            <span class="subcat-badge-count" [style.color]="textSecondary">({{ getItemsBySubcategory(sub.id).length }})</span>
                          </div>
                          <div class="subcat-chevron-wrap" [class.collapsed]="isSubcategoryCollapsed(sub.id)" [style.color]="textSecondary">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </div>
                        </div>

                        @if (!isSubcategoryCollapsed(sub.id)) {
                          <div class="items-grid">
                            @for (item of getItemsBySubcategory(sub.id); track item.id; let idx = $index) {
                              <div
                                class="product-item-card"
                                appMenuReveal
                                [style.background]="surfaceColor"
                                [style.--card-idx]="idx"
                                (click)="openProductDetail(item)">

                                <!-- Photo Wrap -->
                                <div class="product-card-photo">
                                  @if (item.imageUrl) {
                                    <img [appMenuImage]="item.imageUrl" [alt]="item.name" class="product-photo-img" loading="lazy" />
                                  } @else {
                                    <div class="photo-placeholder-box" [style.color]="accentColor">
                                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
                                        <rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                                      </svg>
                                    </div>
                                  }

                                </div>

                                <!-- Details -->
                                <div class="product-card-body">
                                  <div class="card-title-row">
                                    <h4 class="card-item-title" [style.font-family]="headingFont + ', sans-serif'" [style.color]="textPrimary">{{ item.name }}</h4>
                                    @if (enableLikes) {
                                    <button
                                      type="button"
                                      class="item-like-btn"
                                      [class.liked]="isLiked(item.id)"
                                      [disabled]="isLikePending(item.id)"
                                      [attr.aria-pressed]="isLiked(item.id)"
                                      [attr.aria-label]="isLiked(item.id) ? 'Item já curtido' : 'Curtir item'"
                                      (click)="onLikeClick($event, item.id)"
                                      title="Curtir">
                                      <svg width="14" height="14" viewBox="0 0 24 24" [attr.fill]="isLiked(item.id) ? '#E11D48' : 'none'" stroke="currentColor" stroke-width="2">
                                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                                      </svg>
                                      @if ((item.likesCount || 0) > 0) {
                                        <span class="like-counter-val">{{ item.likesCount }}</span>
                                      }
                                    </button>
                                  }
                                  </div>
                                  <p class="card-item-desc" [style.color]="textSecondary">{{ item.description || 'Preparo artesanal com os melhores ingredientes selecionados.' }}</p>

                                  <div class="card-bottom-row">
                                    <div class="pricing-box" [class.has-promo]="item.promotionalPrice">
                                      @if (item.showPrice === false) {
                                        <span class="price-consult" [style.color]="accentColor">Consulte...</span>
                                      } @else if (item.promotionalPrice) {
                                        <span class="price-highlight" [style.color]="accentColor">R$ {{ item.promotionalPrice.toFixed(2) }}</span>
                                        <span class="price-strikethrough" [style.color]="textSecondary">R$ {{ item.price.toFixed(2) }}</span>
                                      } @else {
                                        <span class="price-regular" [style.color]="accentColor">R$ {{ item.price.toFixed(2) }}</span>
                                      }
                                    </div>

                                    <div class="card-action-btns">
                                      <button
                                        type="button"
                                        class="btn-view-item"
                                        [style.color]="accentColor"
                                        [attr.aria-label]="'Ver detalhes de ' + item.name"
                                        (click)="openProductDetail(item); $event.stopPropagation()">
                                        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                          <path d="M7 17 17 7M7 7h10v10"/>
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            }
                          </div>
                        }
                      </div>
                    }
                  }
                  @if (getItemsWithoutSubcategory().length > 0) {
                    <div class="subcategory-group">
                      <div
                        class="subcategory-header-collapsible"
                        appMenuReveal
                        (click)="toggleSubcategory('__other__')"
                        (keydown.enter)="toggleSubcategory('__other__')"
                        (keydown.space)="$event.preventDefault(); toggleSubcategory('__other__')"
                        role="button"
                        tabindex="0"
                        [attr.aria-expanded]="!isSubcategoryCollapsed('__other__')">
                        <div class="subcat-title-wrap">
                          <span class="subcat-indicator" [style.background]="accentColor"></span>
                          <h4 class="subcategory-title" [style.color]="textPrimary">Outros</h4>
                          <span class="subcat-badge-count" [style.color]="textSecondary">({{ getItemsWithoutSubcategory().length }})</span>
                        </div>
                        <div class="subcat-chevron-wrap" [class.collapsed]="isSubcategoryCollapsed('__other__')" [style.color]="textSecondary">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </div>
                      </div>

                      @if (!isSubcategoryCollapsed('__other__')) {
                        <div class="items-grid">
                          @for (item of getItemsWithoutSubcategory(); track item.id; let idx = $index) {
                            <div
                              class="product-item-card"
                              appMenuReveal
                              [style.background]="surfaceColor"
                              [style.--card-idx]="idx"
                              (click)="openProductDetail(item)">

                              <!-- Photo Wrap -->
                              <div class="product-card-photo">
                                @if (item.imageUrl) {
                                  <img [appMenuImage]="item.imageUrl" [alt]="item.name" class="product-photo-img" loading="lazy" />
                                } @else {
                                  <div class="photo-placeholder-box" [style.color]="accentColor">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
                                      <rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                                    </svg>
                                  </div>
                                }

                              </div>

                              <div class="product-card-body">
                                <div class="card-title-row">
                                  <h4 class="card-item-title" [style.font-family]="headingFont + ', sans-serif'" [style.color]="textPrimary">{{ item.name }}</h4>
                                  @if (enableLikes) {
                                  <button
                                    type="button"
                                    class="item-like-btn"
                                    [class.liked]="isLiked(item.id)"
                                    [disabled]="isLikePending(item.id)"
                                    [attr.aria-pressed]="isLiked(item.id)"
                                    [attr.aria-label]="isLiked(item.id) ? 'Item já curtido' : 'Curtir item'"
                                    (click)="onLikeClick($event, item.id)"
                                    title="Curtir">
                                    <svg width="14" height="14" viewBox="0 0 24 24" [attr.fill]="isLiked(item.id) ? '#E11D48' : 'none'" stroke="currentColor" stroke-width="2">
                                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                                    </svg>
                                    @if ((item.likesCount || 0) > 0) {
                                      <span class="like-counter-val">{{ item.likesCount }}</span>
                                    }
                                  </button>
                                }
                                </div>
                                <p class="card-item-desc" [style.color]="textSecondary">{{ item.description || 'Preparo artesanal com os melhores ingredientes selecionados.' }}</p>

                                <div class="card-bottom-row">
                                  <div class="pricing-box" [class.has-promo]="item.promotionalPrice">
                                    @if (item.showPrice === false) {
                                      <span class="price-consult" [style.color]="accentColor">Consulte...</span>
                                    } @else if (item.promotionalPrice) {
                                      <span class="price-highlight" [style.color]="accentColor">R$ {{ item.promotionalPrice.toFixed(2) }}</span>
                                      <span class="price-strikethrough" [style.color]="textSecondary">R$ {{ item.price.toFixed(2) }}</span>
                                    } @else {
                                      <span class="price-regular" [style.color]="accentColor">R$ {{ item.price.toFixed(2) }}</span>
                                    }
                                  </div>

                                  <div class="card-action-btns">
                                    <button
                                      type="button"
                                      class="btn-view-item"
                                      [style.color]="accentColor"
                                      [attr.aria-label]="'Ver detalhes de ' + item.name"
                                      (click)="openProductDetail(item); $event.stopPropagation()">
                                      <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M7 17 17 7M7 7h10v10"/>
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  }
                } @else {
                  <div class="items-grid">
                    @for (item of displayItems; track item.id; let idx = $index) {
                      <div
                        class="product-item-card"
                        appMenuReveal
                        [style.background]="surfaceColor"
                        [style.--card-idx]="idx"
                        (click)="openProductDetail(item)">

                        <!-- Photo Wrap -->
                        <div class="product-card-photo">
                          @if (item.imageUrl) {
                            <img [appMenuImage]="item.imageUrl" [alt]="item.name" class="product-photo-img" loading="lazy" />
                          } @else {
                            <div class="photo-placeholder-box" [style.color]="accentColor">
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
                                <rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                              </svg>
                            </div>
                          }

                        </div>

                        <!-- Details -->
                        <div class="product-card-body">
                          <div class="card-title-row">
                            <h4 class="card-item-title" [style.font-family]="headingFont + ', sans-serif'" [style.color]="textPrimary">{{ item.name }}</h4>
                            @if (enableLikes) {
                            <button
                              type="button"
                              class="item-like-btn"
                              [class.liked]="isLiked(item.id)"
                              [disabled]="isLikePending(item.id)"
                              [attr.aria-pressed]="isLiked(item.id)"
                              [attr.aria-label]="isLiked(item.id) ? 'Item já curtido' : 'Curtir item'"
                              (click)="onLikeClick($event, item.id)"
                              title="Curtir">
                              <svg width="14" height="14" viewBox="0 0 24 24" [attr.fill]="isLiked(item.id) ? '#E11D48' : 'none'" stroke="currentColor" stroke-width="2">
                                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                              </svg>
                              @if ((item.likesCount || 0) > 0) {
                                <span class="like-counter-val">{{ item.likesCount }}</span>
                              }
                            </button>
                          }
                          </div>
                          <p class="card-item-desc" [style.color]="textSecondary">{{ item.description || 'Preparo artesanal com os melhores ingredientes selecionados.' }}</p>

                          <div class="card-bottom-row">
                            <div class="pricing-box" [class.has-promo]="item.promotionalPrice">
                              @if (item.showPrice === false) {
                                <span class="price-consult" [style.color]="accentColor">Consulte...</span>
                              } @else if (item.promotionalPrice) {
                                <span class="price-highlight" [style.color]="accentColor">R$ {{ item.promotionalPrice.toFixed(2) }}</span>
                                <span class="price-strikethrough" [style.color]="textSecondary">R$ {{ item.price.toFixed(2) }}</span>
                              } @else {
                                <span class="price-regular" [style.color]="accentColor">R$ {{ item.price.toFixed(2) }}</span>
                              }
                            </div>

                            <div class="card-action-btns">
                              <button
                                type="button"
                                class="btn-view-item"
                                [style.color]="accentColor"
                                [attr.aria-label]="'Ver detalhes de ' + item.name"
                                (click)="openProductDetail(item); $event.stopPropagation()">
                                <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                  <path d="M7 17 17 7M7 7h10v10"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    } @empty {
                      <div class="empty-products-msg">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/></svg>
                        <p [style.color]="textSecondary">Nenhum item encontrado nesta categoria.</p>
                      </div>
                    }
                  </div>
                }
              </div>
            }

            @if (!items.length) {
              <section class="empty-products-msg" [style.color]="textSecondary">
                <h2>Cardápio em preparação</h2><p>O estabelecimento está atualizando as opções. Volte em breve.</p>
              </section>
            }
            @if (likeMessage()) { <p class="like-feedback" role="status">{{ likeMessage() }}</p> }
            <!-- Footer info -->
            <footer class="public-menu-footer">
              <img [appMenuImage]="logoUrl" menuImageKind="logo" [alt]="businessName" class="footer-mini-logo" />
              <span class="footer-powered">Cardápio Digital</span>
            </footer>

          </div>
        </div>
      }

      <!-- ══════════════════════════════════════════════════ -->
      <!-- ── 3. MODAL DETALHES DO PRODUTO ── -->
      <!-- ══════════════════════════════════════════════════ -->
      @if (selectedProduct) {
        <div class="product-modal-backdrop" (click)="closeProductDetail()">
          <div class="product-modal-sheet" role="dialog" [attr.aria-modal]="productVideoExpanded ? null : 'true'" aria-labelledby="product-detail-title" tabindex="-1" appDialogFocus [dialogFocusEnabled]="!productVideoExpanded" (dialogEscape)="closeProductDetail()" [class.video-expanded]="productVideoExpanded" (click)="$event.stopPropagation()" [style.background]="surfaceColor">
            <button type="button" class="sheet-close-btn" aria-label="Fechar detalhes" [disabled]="productVideoExpanded" (click)="closeProductDetail()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>

            <app-product-media-gallery
              [itemId]="selectedProduct.id"
              [productName]="selectedProduct.name"
              [imageUrl]="selectedProduct.imageUrl || null"
              [media]="selectedProduct.media || []"
              [publicSlug]="publicSlug"
              [previewMode]="isPhonePreview"
              (expandedChange)="productVideoExpanded = $event">
            </app-product-media-gallery>

            <div class="modal-sheet-content" [attr.inert]="productVideoExpanded ? '' : null">
              <div class="sheet-header">
                <h3 id="product-detail-title" class="sheet-product-title" [style.font-family]="headingFont + ', sans-serif'" [style.color]="textPrimary">
                  {{ selectedProduct.name }}
                </h3>
                @if (enableLikes) {
                  <button
                    type="button"
                    class="sheet-like-action"
                    [class.liked]="isLiked(selectedProduct.id)"
                    [disabled]="isLikePending(selectedProduct.id)"
                    [attr.aria-pressed]="isLiked(selectedProduct.id)"
                    [attr.aria-label]="isLiked(selectedProduct.id) ? 'Item já curtido' : 'Curtir item'"
                    (click)="onLikeClick($event, selectedProduct.id)">
                    <svg width="20" height="20" viewBox="0 0 24 24" [attr.fill]="isLiked(selectedProduct.id) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" aria-hidden="true">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                    </svg>
                    <span>{{ selectedProductLikesCount }} curtidas</span>
                  </button>
                }
              </div>

              <p class="sheet-desc" [style.color]="textSecondary">{{ selectedProduct.description || 'Produto fresco e artesanal preparado na hora especialmente para você.' }}</p>

              <div class="sheet-price-row">
                <span class="sheet-price-label" [style.color]="textSecondary">Preço:</span>
                @if (selectedProduct.showPrice === false) {
                  <span class="sheet-current" style="font-style: italic; font-size: 0.95rem;" [style.color]="accentColor">Consulte com o atendente</span>
                } @else if (selectedProduct.promotionalPrice) {
                  <div class="sheet-pricing-dual">
                    <span class="sheet-old" [style.color]="textSecondary">R$ {{ selectedProduct.price.toFixed(2) }}</span>
                    <span class="sheet-current" [style.color]="accentColor">R$ {{ selectedProduct.promotionalPrice.toFixed(2) }}</span>
                  </div>
                } @else {
                  <span class="sheet-current" [style.color]="accentColor">R$ {{ selectedProduct.price.toFixed(2) }}</span>
                }
              </div>

              @if (enableCart) {
                <div class="sheet-modal-actions">
                  <div class="modal-qty-selector" [style.background]="screenBg">
                    <button type="button" class="m-qty-btn" (click)="decreaseModalQty()">-</button>
                    <span class="m-qty-val" [style.color]="textPrimary">{{ modalItemQuantity }}</span>
                    <button type="button" class="m-qty-btn" (click)="increaseModalQty()">+</button>
                  </div>

                  <button
                    type="button"
                    class="btn-sheet-add-cart"
                    [style.background]="'linear-gradient(135deg, ' + accentColor + ', ' + primaryColor + ')'"
                    (click)="confirmAddToCart(selectedProduct); closeProductDetail()">
                    {{ selectedProduct.showPrice === false ? 'Adicionar ao Pedido' : 'Adicionar • R$ ' + getModalTotal(selectedProduct).toFixed(2) }}
                  </button>
                </div>
              } @else {
                <div class="sheet-modal-actions no-cart-actions">
                  <button
                    type="button"
                    class="btn-sheet-close-action"
                    [style.background]="accentColor + '18'"
                    [style.color]="accentColor"
                    [style.border-color]="accentColor + '40'"
                    (click)="closeProductDetail()">
                    Fechar
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- ══════════════════════════════════════════════════ -->
      <!-- ── 4. CARRINHO FLUTUANTE LOCAL DA SESSÃO ── -->
      <!-- ══════════════════════════════════════════════════ -->
      @if (enableCart && cartService.isCartOpen()) {
        <div class="cart-modal-backdrop" (click)="cartService.closeCart()">
          <div class="cart-drawer-sheet" (click)="$event.stopPropagation()" [style.background]="surfaceColor">

            <!-- Drawer Header -->
            <div class="cart-drawer-header" [style.border-bottom-color]="screenBg">
              <div class="cart-header-title">
                <div class="cart-icon-bg" [style.background]="accentColor + '20'" [style.color]="accentColor">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
                  </svg>
                </div>
                <div>
                  <h3 class="cart-title" [style.font-family]="headingFont + ', sans-serif'" [style.color]="textPrimary">Seu Carrinho</h3>
                  <span class="cart-subtitle" [style.color]="textSecondary">
                    {{ cartService.totalItems() }} {{ cartService.totalItems() === 1 ? 'item selecionado' : 'itens selecionados' }}
                  </span>
                </div>
              </div>
              <button type="button" class="drawer-close-btn" (click)="cartService.closeCart()" [style.color]="textSecondary">✕</button>
            </div>

            <!-- Cart Mandatory Cybersecurity Notice -->
            <div class="cart-security-notice" [style.background]="accentColor + '12'" [style.border-color]="accentColor + '30'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" [style.color]="accentColor">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <p class="notice-text" [style.color]="textPrimary">
                Esta lista ajuda você a acompanhar os itens desejados e <strong>não envia o pedido</strong> ao estabelecimento.
              </p>
            </div>

            <!-- Cart Items Body -->
            <div class="cart-items-body">
              @if (cartService.cartItems().length === 0) {
                <div class="cart-empty-state">
                  <div class="empty-icon-wrap" [style.color]="textSecondary">
                    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
                    </svg>
                  </div>
                  <h4 class="empty-title" [style.color]="textPrimary">Seu carrinho está vazio</h4>
                  <p class="empty-sub" [style.color]="textSecondary">Toque no ícone "+" nos produtos do cardápio para adicioná-los aqui.</p>
                </div>
              } @else {
                <div class="cart-list">
                  @for (cItem of cartService.cartItems(); track cItem.itemId) {
                    <div class="cart-item-row" [style.border-bottom-color]="screenBg">
                      <div class="cart-item-thumb">
                        @if (cItem.imageUrl) {
                          <img [src]="cItem.imageUrl" [alt]="cItem.name" class="c-thumb-img" />
                        } @else {
                          <div class="c-thumb-fallback" [style.color]="accentColor">★</div>
                        }
                      </div>

                      <div class="cart-item-info">
                        <h4 class="c-item-name" [style.color]="textPrimary">{{ cItem.name }}</h4>
                        <span class="c-item-unit-price" [style.color]="textSecondary">
                          R$ {{ (cItem.promotionalPrice || cItem.price).toFixed(2) }} un.
                        </span>
                      </div>

                      <div class="cart-item-actions">
                        <div class="cart-qty-ctrl" [style.background]="screenBg">
                          <button type="button" class="c-qty-btn" (click)="cartService.updateQuantity(cItem.itemId, -1)">-</button>
                          <span class="c-qty-val" [style.color]="textPrimary">{{ cItem.quantity }}</span>
                          <button type="button" class="c-qty-btn" (click)="cartService.updateQuantity(cItem.itemId, 1)">+</button>
                        </div>
                        <button type="button" class="c-remove-btn" (click)="cartService.removeItem(cItem.itemId)" title="Remover item">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Cart Drawer Footer -->
            @if (cartService.cartItems().length > 0) {
              <div class="cart-drawer-footer" [style.border-top-color]="screenBg">
                <div class="cart-totals-row">
                  <span class="total-label" [style.color]="textSecondary">Total Estimado</span>
                  <span class="total-val" [style.color]="accentColor">R$ {{ cartService.totalPrice().toFixed(2) }}</span>
                </div>

                <div class="cart-footer-btns">
                  <button type="button" class="btn-clear-cart" (click)="cartService.clearCart()" [style.color]="textSecondary">
                    Limpar tudo
                  </button>
                  <button
                    type="button"
                    class="btn-continue-nav"
                    [style.background]="'linear-gradient(135deg, ' + accentColor + ', ' + primaryColor + ')'"
                    (click)="cartService.closeCart()">
                    Continuar Vendo
                  </button>
                </div>
              </div>
            }

          </div>
        </div>
      }

    </div>
  `,
  styleUrls: ['./public-menu-template-base.css', './public-menu-centered-templates.css', './public-menu-arched-cover-template.css', './public-menu-brand-hero-template.css', './public-menu-photo-cards.css', './public-menu-signature-cover-template.css'],
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    /* ── Viewport Container ── */
    .menu-viewport {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--bg-color, #FAF5F0);
      color: var(--text-primary, #2D1822);
    }

    .welcome-cover, .hero-slide-image { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
    img[appMenuImage] { transition:opacity 180ms ease; background:color-mix(in srgb,var(--surface-color) 80%,#8a8075 20%); }
    .menu-image-loading { opacity:0; }
    .menu-image-ready, .menu-image-priority { opacity:1; }
    .menu-image-priority { transition:none !important; }
    .menu-image-failed { object-fit:contain !important; }
    .promo-item-card,.ranking-item-row,.featured-chef-card,.combo-card,.best-seller-card { position:relative; }
    .product-card-trigger { position:absolute; inset:0; z-index:1; width:100%; height:100%; padding:0; border:0; border-radius:inherit; background:transparent; cursor:pointer; }
    .card-like-btn,.row-like-btn,.chef-card-like,.combo-like-btn,.item-like-btn,.like-btn { position:relative; z-index:2; }
    button:focus-visible, [role=button]:focus-visible { outline:3px solid var(--accent-color); outline-offset:3px; }
    .capsule-btn,.clear-btn,.sheet-close-btn,.item-like-btn,.card-like-btn,.row-like-btn,.sheet-like-action,.btn-view-item { min-width:44px; min-height:44px; }
    .category-nav-pill { min-height:44px; }
    .btn-back-home,.subcategory-header-collapsible { min-height:44px; box-sizing:border-box; }
    .module-skeleton-card { pointer-events:none; }
    /* Preserve progressive DOM placeholders while letting the browser skip
       layout/paint for distant sections until they approach the scrollport. */
    .showcase-block { content-visibility:auto; contain-intrinsic-block-size:auto 320px; }
    .featured-chef-block,.best-sellers-block { contain-intrinsic-block-size:auto 900px; }
    .module-skeleton .featured-chef-card { min-height:224px; }
    .module-skeleton .combo-card { min-height:276px; }
    .module-skeleton .best-seller-card { min-height:195px; }
    .skeleton-photo,.skeleton-copy { background:color-mix(in srgb,var(--surface-color) 80%,var(--text-secondary) 20%); animation:moduleBreathe 1.8s ease-in-out infinite alternate; }
    .skeleton-copy { display:block; height:14px; border-radius:5px; margin:4px 0; width:88%; }
    .skeleton-copy.short { width:65%; }
    @keyframes moduleBreathe { from{opacity:.45}to{opacity:.8} }
    @media(prefers-reduced-motion:reduce) { .skeleton-photo,.skeleton-copy{animation:none} }
    .search-input { min-height:44px; font-size:16px; }
    button:active { transform:scale(.98); }
    .showcase-scrollable { scroll-padding-top:74px; padding-bottom:max(32px,env(safe-area-inset-bottom)); }
    .search-drawer { z-index:30; }
    @media(prefers-reduced-motion:reduce) { img[appMenuImage],button { transition:none !important; } .menu-main-shell { animation:none !important; } button:active { transform:none; } }

    /* Phone preview embedded mode */
    .menu-viewport.in-phone {
      height: 100%;
      --menu-title-responsive-size: 11.7px;
    }

    /* ══════════════════════════════════════════════════ */
    /* ── 1. WELCOME SCREEN ── */
    /* ══════════════════════════════════════════════════ */
    .welcome-screen {
      position: absolute;
      inset: 0;
      z-index: 50;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background-size: cover;
      background-position: center;
      padding: 24px 20px;
      text-align: center;
    }

    .welcome-overlay {
      position: absolute;
      inset: 0;
      z-index: 1;
      backdrop-filter: blur(2px);
    }

    .ambient-glow {
      position: absolute;
      width: 220px;
      height: 220px;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.28;
      z-index: 2;
      animation: pulseGlow 4s ease-in-out infinite alternate;
    }

    @keyframes pulseGlow {
      0% { transform: scale(0.8); opacity: 0.2; }
      100% { transform: scale(1.3); opacity: 0.38; }
    }

    .welcome-content {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      width: 100%;
      max-width: 320px;
    }

    /* Floating Logo */
    .welcome-logo-wrap {
      position: relative;
      width: 88px;
      height: 88px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: floatLogo 3.5s ease-in-out infinite;
    }

    .logo-luminous-ring {
      display: none;
    }

    @keyframes ringSpin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    @keyframes floatLogo {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }

    .welcome-logo-img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }

    .welcome-texts {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .welcome-kicker {
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    .welcome-title {
      font-size: 1.65rem;
      font-weight: 800;
      color: #FFF;
      margin: 0;
      line-height: 1.15;
      text-shadow: 0 4px 16px rgba(0,0,0,0.6);
    }
    .welcome-tagline {
      font-size: 0.84rem;
      color: #E4E4E7;
      margin: 0;
      line-height: 1.35;
      max-width: 260px;
      text-shadow: 0 2px 8px rgba(0,0,0,0.5);
    }
    .welcome-desc-custom {
      max-width: 290px;
      line-height: 1.45;
      font-size: 0.82rem;
      color: #F4F4F5;
    }

    /* Cinema Button */
    .cta-action-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
      width: 100%;
    }

    .btn-enter-menu {
      width: 100%;
      max-width: 240px;
      padding: 14px 20px;
      border: none;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #FFF;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      box-shadow:
        0 8px 25px rgba(244, 123, 32, 0.4),
        inset 0 1px 2px rgba(255, 255, 255, 0.4);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .btn-enter-menu:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 12px 32px rgba(244, 123, 32, 0.6);
    }

    .btn-shimmer {
      position: absolute;
      top: 0; left: -100%; width: 50%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
      animation: shimmerPass 2.8s infinite;
    }

    @keyframes shimmerPass {
      0% { left: -100%; }
      50%, 100% { left: 150%; }
    }

    .btn-icon-circle {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cta-sub-hint {
      font-size: 0.7rem;
      color: #D4D4D8;
      letter-spacing: 0.04em;
    }

    /* ══════════════════════════════════════════════════ */
    /* ── 2. MENU MAIN SHELL ── */
    /* ══════════════════════════════════════════════════ */
    .menu-main-shell {
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
    }

    /* Floating Controls Capsule (Minimalist Glass Design) */
    .floating-controls-capsule {
      position: absolute;
      top: 14px;
      right: 14px;
      z-index: 50;
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 4px 6px;
      border-radius: 30px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.18);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
    }
    .capsule-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: transparent;
      border: none;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s ease;
    }
    .capsule-btn:hover, .capsule-btn.active {
      background: rgba(244, 123, 32, 0.18);
      color: var(--accent-color);
      transform: scale(1.06);
    }
    .capsule-btn.reset:hover {
      color: #3B82F6;
      background: rgba(59, 130, 246, 0.18);
    }
    .capsule-divider {
      width: 1px;
      height: 16px;
      background: rgba(255, 255, 255, 0.18);
      margin: 0 2px;
    }

    /* Search drawer */
    .search-drawer {
      padding: 8px 12px;
      background: var(--surface-color);
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }
    .search-field-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .search-field-wrap svg {
      position: absolute;
      left: 10px;
      color: var(--text-secondary);
    }
    .search-input {
      width: 100%;
      background: var(--bg-color);
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 10px;
      padding: 6px 52px 6px 32px;
      color: var(--text-primary);
      font-size: 16px;
      outline: none;
      box-sizing: border-box;
    }
    .search-input:focus { border-color: var(--accent-color); }
    .clear-btn {
      position: absolute;
      right: 8px;
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 0.75rem;
    }

    /* Scrollable body */
    .showcase-scrollable {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 10px 12px 32px;
      scrollbar-width: none;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .showcase-scrollable::-webkit-scrollbar { display: none; }

    /* Cada seção se abre como uma página; só transform e opacity são animados. */
    .menu-reveal-pending {
      opacity: 0;
      transform: translate3d(0, 14px, 0) rotate(-0.7deg);
    }
    .menu-reveal-visible {
      animation: menuPageReveal 200ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
    }

    .items-grid > .menu-reveal-visible:nth-child(4n + 2) { animation-delay: 45ms; }
    .items-grid > .menu-reveal-visible:nth-child(4n + 3) { animation-delay: 90ms; }
    .items-grid > .menu-reveal-visible:nth-child(4n + 4) { animation-delay: 135ms; }
    @keyframes menuPageReveal {
      from { opacity: 0; transform: translate3d(0, 14px, 0) rotate(-0.7deg); }
      to { opacity: 1; transform: none; }
    }
    .catalog-section.category-enter {
      animation: categoryPageIn 200ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
    }
    @keyframes categoryPageIn {
      from { opacity: 0.65; transform: translate3d(10px, 0, 0); }
      to { opacity: 1; transform: none; }
    }

    /* ══════════════════════════════════════════════════ */
    /* ── BLOCO DE APRESENTAÇÃO / DESCRIÇÃO INICIAL ── */
    /* ══════════════════════════════════════════════════ */
    .intro-description-wrapper {
      width: 100%;
      box-sizing: border-box;
      padding: 4px 2px 2px 2px;
      animation: introFadeSlideIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .intro-description-card {
      position: relative;
      background: rgba(255, 255, 255, 0.07);
      backdrop-filter: blur(24px) saturate(190%);
      -webkit-backdrop-filter: blur(24px) saturate(190%);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 20px;
      padding: 18px 20px;
      box-shadow:
        0 8px 32px 0 rgba(0, 0, 0, 0.08),
        inset 0 1px 1px 0 rgba(255, 255, 255, 0.2);
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease;
    }
    .intro-card-body {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
    }
    .intro-card-title {
      font-size: 1.02rem;
      font-weight: 700;
      margin: 0;
      line-height: 1.35;
      letter-spacing: -0.01em;
      word-break: break-word;
      white-space: pre-line;
    }
    .intro-card-desc {
      font-size: 0.84rem;
      margin: 0;
      line-height: 1.55;
      word-break: break-word;
      opacity: 0.95;
      white-space: break-spaces;
    }
    @keyframes introFadeSlideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ══════════════════════════════════════════════════ */
    /* ── ESTRUTURAS ESPECÍFICAS DOS TEMPLATES ── */
    /* ══════════════════════════════════════════════════ */

    /* Hero Banner Geral com Carrossel Suave */
    .showcase-hero-banner {
      border-radius: 16px;
      overflow: hidden;
      position: relative;
      min-height: 125px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.18);
    }
    .hero-carousel-track {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .hero-carousel-slide {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      background-size: cover;
      background-position: center;
      opacity: 0;
      transform: scale(1.04);
      transition: opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1), transform 1.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1;
      pointer-events: none;
    }
    .hero-carousel-slide.active {
      opacity: 1;
      transform: scale(1);
      z-index: 2;
      pointer-events: auto;
    }
    .hero-banner-overlay {
      position: relative;
      z-index: 3;
      padding: 14px 16px 12px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      height: 100%;
      min-height: 125px;
      box-sizing: border-box;
    }
    .carousel-dots-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
    }
    .carousel-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.45);
      border: none;
      padding: 0;
      cursor: pointer;
      transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .carousel-dot.active {
      width: 22px;
      border-radius: 999px;
      background: var(--dot-accent, #F47B20);
      box-shadow: 0 0 10px var(--dot-accent, #F47B20);
    }

    .categories-nav-section {
      margin: 2px 0 6px;
    }
    .cat-nav-scroll {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding: 12px;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .cat-nav-scroll::-webkit-scrollbar { display: none; }

    .category-nav-pill {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 8px 16px;
      border-radius: 24px;
      background: var(--surface-color);
      border: 1px solid rgba(0, 0, 0, 0.08);
      color: var(--text-primary);
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      min-height: 38px;
    }
    .category-nav-pill:hover {
      border-color: var(--accent-color);
      transform: translateY(-1px);
    }
    .category-nav-pill.active {
      background: var(--primary-color);
      color: #FFF;
      border-color: var(--primary-color);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    }
    .category-nav-pill[data-display-mode="icon_text_stacked"] {
      flex-direction: column;
      gap: 4px;
      padding: 8px 14px;
      border-radius: 16px;
      min-width: 62px;
      text-align: center;
    }
    .category-nav-pill[data-display-mode="icon_text_stacked"] .cat-pill-svg,
    .category-nav-pill[data-display-mode="icon_text_stacked"] .cat-pill-img {
      width: 26px;
      height: 26px;
    }
    .category-nav-pill[data-display-mode="icon_only"] {
      padding: 9px 12px;
      border-radius: 50%;
      min-width: 42px;
      min-height: 42px;
      justify-content: center;
    }
    .category-nav-pill[data-display-mode="icon_only"] .cat-pill-svg,
    .category-nav-pill[data-display-mode="icon_only"] .cat-pill-img {
      width: 24px;
      height: 24px;
    }
    .cat-pill-icon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .cat-pill-icon.svg-3d {
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .cat-pill-icon.svg-3d .cat-pill-svg {
      width: 26px;
      height: 26px;
    }
    .cat-pill-icon.svg-3d svg {
      width: 100%;
      height: 100%;
      overflow: visible;
      display: block;
    }
    .cat-pill-img { width: 22px; height: 22px; border-radius: 5px; object-fit: cover; flex-shrink: 0; }
    .cat-pill-svg {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .cat-pill-svg svg {
      width: 100%;
      height: 100%;
      overflow: visible;
      display: block;
    }
    .cat-pill-label { font-size: 0.78rem; font-weight: 700; line-height: 1.2; }

    /* Promo Section */
    .showcase-block {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .block-title-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .block-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.95rem;
      font-weight: 800;
      margin: 0;
    }
    .block-title-icon { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; font: 24px/1 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif; object-fit: contain; }
    .block-sub-badge {
      font-size: 0.68rem;
      font-weight: 700;
    }

    .promo-items-scroll {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding: 4px 0 8px;
      scrollbar-width: none;
    }
    .promo-items-scroll::-webkit-scrollbar { display: none; }

    .promo-item-card {
      width: 140px;
      flex-shrink: 0;
      border-radius: 14px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      overflow: hidden;
      cursor: pointer;
      position: relative;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
      transition: transform 0.2s ease;
    }
    .promo-item-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
    }
    .promo-img-wrap {
      width: 100%;
      height: 90px;
      background: rgba(0, 0, 0, 0.04);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .card-photo { width: 100%; height: 100%; object-fit: cover; }
    .promo-card-content {
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .card-name {
      font-size: 0.76rem;
      font-weight: 700;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-pricing {
      display: flex;
      align-items: baseline;
      gap: 4px;
      margin-top: 2px;
    }
    .old-price {
      font-size: 0.65rem;
      text-decoration: line-through;
    }
    .active-price {
      font-size: 0.84rem;
      font-weight: 800;
    }
    .card-like-btn {
      background: var(--surface-color);
      border: 1px solid var(--text-secondary);
      color: var(--text-secondary);
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.15s;
    }

    /* Liked ranking */
    .liked-ranking-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .ranking-item-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.06);
      cursor: pointer;
      transition: background 0.15s;
    }
    .ranking-item-row:hover { filter: brightness(0.97); }
    .ranking-img-wrap {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      overflow: hidden;
      background: rgba(0,0,0,0.05);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .row-thumb { width: 100%; height: 100%; object-fit: cover; }
    .row-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .row-name { font-size: 0.76rem; font-weight: 700; }
    .row-price { font-size: 0.72rem; font-weight: 800; }

    /* Featured Chef Specials Block */
    .featured-chef-block {
      margin-top: 4px;
    }
    .featured-chef-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 12px;
    }
    .featured-chef-card {
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.12);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .featured-chef-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.18);
    }
    .chef-card-photo-wrap {
      position: relative;
      width: 100%;
      height: 105px;
      overflow: hidden;
      background: #111;
    }
    .chef-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .chef-fallback {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      background: rgba(0,0,0,0.1);
    }
    .chef-card-content {
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      justify-content: space-between;
    }
    .chef-card-name {
      font-size: 0.86rem;
      font-weight: 700;
      margin: 0;
      line-height: 1.25;
    }
    .chef-card-desc {
      font-size: 0.72rem;
      line-height: 1.35;
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .chef-card-pricing {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 6px;
    }
    .chef-price {
      font-size: 0.88rem;
      font-weight: 800;
    }
    .btn-chef-view {
      font-size: 0.68rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      transition: opacity 0.15s ease;
    }
    .btn-chef-view:hover {
      opacity: 0.85;
    }

    /* ── Combos Especiais & Mais Vendidos Badges (Ícones Soltos) ── */

    /* ── Combos Especiais Block ── */
    .combos-block {
      margin-top: 4px;
    }
    .combos-scroll-track {
      display: flex;
      gap: 14px;
      overflow-x: auto;
      padding: 4px 2px 14px;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .combos-scroll-track::-webkit-scrollbar {
      display: none;
    }
    .combo-card {
      flex: 0 0 240px;
      scroll-snap-align: start;
      border-radius: 18px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.14);
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease;
      border: 1px solid rgba(255, 255, 255, 0.06);
      position: relative;
    }
    .combo-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.22);
    }
    .combo-img-wrap {
      position: relative;
      width: 100%;
      height: 125px;
      overflow: hidden;
      background: #18181B;
    }
    .combo-card-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }
    .combo-card:hover .combo-card-img {
      transform: scale(1.04);
    }
    .combo-card-content {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      justify-content: space-between;
    }
    .combo-desc {
      font-size: 0.74rem;
      line-height: 1.35;
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .combo-pricing-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 8px;
    }
    .combo-prices {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    .btn-combo-view {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 8px;
      transition: opacity 0.15s ease;
    }
    .btn-combo-view:hover {
      opacity: 0.85;
    }

    /* ── Mais Vendidos Block ── */
    .best-sellers-block {
      margin-top: 4px;
    }
    .best-sellers-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .best-seller-card {
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.12);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      border: 1px solid rgba(255, 255, 255, 0.06);
      position: relative;
      box-sizing: border-box;
      min-width: 0;
    }
    .best-seller-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(0,0,0,0.18);
    }
    .best-seller-img-wrap {
      position: relative;
      width: 100%;
      height: 85px;
      overflow: hidden;
      background: #18181B;
    }
    .best-seller-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .best-seller-info {
      padding: 8px 10px 4px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      flex: 1;
      min-width: 0;
    }
    .best-seller-name {
      font-size: 0.80rem;
      font-weight: 700;
      margin: 0;
      line-height: 1.2;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
    }
    .best-seller-price {
      font-size: 0.82rem;
      font-weight: 800;
      margin-top: auto;
    }
    .best-seller-action-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 8px 8px;
      width: 100%;
      box-sizing: border-box;
    }
    .btn-best-seller-view {
      flex: 1;
      width: 100%;
      margin: 0;
      padding: 5px 0;
      border: none;
      border-radius: 8px;
      font-size: 0.72rem;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
      transition: opacity 0.15s, transform 0.15s;
      box-sizing: border-box;
      display: block;
    }
    .btn-best-seller-view:hover {
      opacity: 0.85;
      transform: translateY(-1px);
    }

    /* ── Modal No-Cart Action ── */
    .sheet-modal-actions.no-cart-actions {
      display: flex;
      justify-content: flex-end;
    }
    .btn-sheet-close-action {
      width: 100%;
      padding: 14px 20px;
      border-radius: 14px;
      font-size: 0.92rem;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid;
      text-align: center;
      transition: transform 0.2s ease;
    }
    .btn-sheet-close-action:hover {
      opacity: 0.85;
      transform: translateY(-1px);
    }

    /* Catalog Section */
    .catalog-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 4px;
    }
    .catalog-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      padding-bottom: 6px;
    }
    .btn-back-home {
      background: none;
      border: none;
      font-size: 0.74rem;
      font-weight: 700;
      cursor: pointer;
      padding: 3px 6px;
      border-radius: 6px;
      transition: opacity 0.15s ease;
    }
    .btn-back-home:hover {
      opacity: 0.8;
      text-decoration: underline;
    }
    .section-heading {
      font-size: 0.98rem;
      font-weight: 800;
      margin: 0;
    }
    .catalog-count {
      font-size: 0.7rem;
      font-weight: 600;
    }

    /* Product Grid */
    .items-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .product-item-card {
      display: grid;
      grid-template-columns: 104px minmax(0, 1fr);
      min-height: 116px;
      height: auto;
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      align-items: center;
      box-sizing: border-box;
    }
    .product-card-photo {
      position:relative; width:104px; height:104px; min-width:104px;
      aspect-ratio:1; background:rgba(0,0,0,.05); overflow:hidden;
      display:flex; align-items:center; justify-content:center; align-self:center;
    }
    .product-photo-img {
      width: 100%;
      height: 100%;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      object-position: center;
      display: block;
    }
    .photo-placeholder-box {
      width: 100%;
      height: 100%;
      aspect-ratio: 1 / 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .item-like-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      min-height: 44px;
      flex-shrink: 0;
      border-radius: 10px;
      padding: 2px 5px;
      display: flex;
      align-items: center;
      gap: 2px;
      cursor: pointer;
      z-index: 3;
    }
    .like-counter-val {
      font-size: 0.75rem;
      font-weight: 700;
    }

    .card-title-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
    .card-title-row .card-item-title { flex: 1; min-width: 0; }
    .card-like-btn:focus-visible, .item-like-btn:focus-visible { outline: 2px solid var(--accent-color); outline-offset: 2px; }

    .product-card-body {
      padding: 6px 10px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-width: 0;
      gap: 4px;
      box-sizing: border-box;
      overflow: hidden;
    }
    .card-item-title {
      font-size: 0.875rem;
      font-weight: 700;
      margin: 0;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-item-desc {
      font-size: 0.8125rem;
      margin: 0;
      line-height: 1.25;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-bottom-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      margin-top: auto;
      min-height: 28px;
      flex-shrink: 0;
      overflow: hidden;
    }
    .pricing-box {
      display: inline-flex;
      align-items: baseline;
      gap: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      min-width: 0;
      flex: 1 1 auto;
    }
    .pricing-box.has-promo {
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: 1px;
    }
    .price-regular {
      font-size: 0.82rem;
      font-weight: 800;
      line-height: 1;
      letter-spacing: -0.01em;
    }
    .price-highlight {
      font-size: 0.82rem;
      font-weight: 900;
      line-height: 1.05;
      letter-spacing: -0.01em;
      display: inline-block;
      text-shadow: 0 1px 2px rgba(0,0,0,0.12);
    }
    .pricing-box.has-promo .price-highlight {
      font-size: 0.80rem;
      transform: none;
    }
    .price-strikethrough {
      font-size: 0.60rem;
      text-decoration: line-through;
      opacity: 0.65;
      line-height: 1;
      margin: 0;
      font-weight: 500;
    }
    .price-consult {
      font-size: 0.78rem;
      font-weight: 700;
      font-style: italic;
      line-height: 1;
      opacity: 0.95;
    }
    .card-action-btns {
      flex-shrink: 0;
      margin-left: auto;
      display: flex;
      align-items: center;
      z-index: 2;
    }

    .empty-products-msg {
      text-align: center;
      padding: 36px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      opacity: 0.7;
    }

    /* Footer */
    .public-menu-footer {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 24px 0 10px;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
      margin-top: 12px;
    }
    .footer-mini-logo { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; opacity: 0.7; }
    .footer-brand { font-size: 0.74rem; font-weight: 700; }
    .footer-powered { font-size: 0.6rem; opacity: 0.6; }

    /* Modal Product Detail */
    .product-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.75);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 100;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      animation: fadeIn 0.2s ease;
    }
    .product-modal-sheet {
      width: 100%;
      max-width: 440px;
      max-height: min(92dvh, 760px);
      border-radius: 24px 24px 0 0;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      border: 1px solid rgba(255, 255, 255, 0.1);
      position: relative;
      animation: sheetUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .product-modal-sheet.video-expanded { overflow: visible; }
    .menu-viewport.in-phone .product-modal-backdrop,
    .menu-viewport.in-phone .cart-modal-backdrop { position: absolute; }
    .menu-viewport.in-phone .product-modal-sheet { max-height: min(92%, 760px); }
    .menu-viewport.in-phone .cart-drawer-sheet { max-height: 85%; }
    @keyframes sheetUp {
      from { transform: translateY(12px); opacity:0; }
      to { transform: translateY(0); }
    }
    .sheet-close-btn {
      position: absolute;
      top: 12px; right: 12px;
      background: rgba(0,0,0,0.6);
      border: none;
      color: #FFF;
      width: 32px; height: 32px;
      border-radius: 50%;
      cursor: pointer;
      z-index: 10;
      font-size: 0.9rem;
    }
    .sheet-close-btn svg { width: 17px; height: 17px; display: block; margin: auto; }
    .modal-cover-wrap { width: 100%; height: 180px; background: #161619; }
    .modal-cover-img { width: 100%; height: 100%; object-fit: cover; }
    .modal-sheet-content {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .sheet-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .sheet-product-title {
      font-size: 1.18rem;
      font-weight: 800;
      margin: 0;
    }
    .sheet-like-action {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
      min-height: 44px;
      color: #9F1239;
      background: #FFF1F2;
      border: 1px solid #FDA4AF;
      border-radius: 20px;
      padding: 6px 12px;
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
      transition: background-color 180ms ease, border-color 180ms ease;
    }
    .sheet-like-action:hover:not(:disabled), .sheet-like-action.liked { color: #BE123C; background: #FFE4E6; border-color: #FB7185; }
    .sheet-like-action:focus-visible { outline: 2px solid #BE123C; outline-offset: 3px; }
    .sheet-like-action:disabled { cursor: wait; }
    @media (prefers-reduced-motion: reduce) { .sheet-like-action { transition: none; } }
    .sheet-desc { font-size: 0.82rem; line-height: 1.45; margin: 0; }
    .sheet-price-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
    }
    .sheet-price-label { font-size: 0.85rem; }
    .sheet-current { font-size: 1.28rem; font-weight: 800; }
    .sheet-old { font-size: 0.85rem; text-decoration: line-through; margin-right: 6px; }
    .btn-sheet-close {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 14px;
      color: #FFF;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    }

    /* Cart Capsule Button & Badge */
    .cart-capsule-btn {
      position: relative;
    }
    .cart-badge-count {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 10px;
      color: #FFF;
      font-size: 0.65rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    }

    /* Product Card Action Buttons */
    .card-action-btns {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-add-cart-circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      transition: transform 0.15s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    .btn-add-cart-circle:active {
      transform: scale(0.9);
    }
    .card-qty-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #111114;
      color: #FFF;
      font-size: 0.62rem;
      font-weight: 800;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    /* Subcategories Accordion Grouping */
    .subcategory-group {
      margin-bottom: 20px;
    }
    .subcategory-header-collapsible {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 6px;
      margin: 12px 0 8px 0;
      cursor: pointer;
      user-select: none;
      border-radius: 8px;
      transition: background 0.2s ease;
    }
    .subcategory-header-collapsible:hover {
      background: rgba(0, 0, 0, 0.03);
    }
    .subcat-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .subcategory-title {
      font-size: 0.92rem;
      font-weight: 700;
      margin: 0;
    }
    .subcat-badge-count {
      font-size: 0.72rem;
      font-weight: 600;
      opacity: 0.65;
    }
    .subcat-chevron-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .subcat-chevron-wrap.collapsed {
      transform: rotate(-90deg);
    }
    .subcat-indicator {
      width: 4px;
      height: 16px;
      border-radius: 2px;
      display: inline-block;
    }

    /* Highlight Badges on Cards */

    /* Topo Sem Hero Section */
    .no-hero-header {
      padding: 14px 14px 10px;
      margin-bottom: 8px;
      border-radius: 0 0 16px 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }
    .no-hero-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .no-hero-logo-wrap {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
    }
    .no-hero-logo-img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }
    .no-hero-texts {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .no-hero-title {
      font-size: 1.05rem;
      font-weight: 800;
      margin: 0;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .no-hero-tagline {
      font-size: 0.68rem;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Bloco Combos Especiais */
    .combos-block { margin-bottom: 20px; }
    .badge-combo-icon { font-size: 1rem; }
    .combos-scroll-track {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding-bottom: 6px;
      scrollbar-width: none;
    }
    .combos-scroll-track::-webkit-scrollbar { display: none; }
    .combo-card {
      position: relative;
      flex: 0 0 200px;
      border-radius: 14px;
      overflow: hidden;
      cursor: pointer;
      box-shadow: 0 3px 12px rgba(0, 0, 0, 0.06);
      transition: transform 0.2s ease;
    }
    .combo-card:hover { transform: translateY(-2px); }
    .combo-img-wrap {
      width: 100%;
      height: 95px;
      overflow: hidden;
      background: rgba(0, 0, 0, 0.05);
    }
    .combo-card-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .combo-card-content {
      padding: 8px 10px;
    }
    .combo-desc {
      font-size: 0.65rem;
      margin: 2px 0 6px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.25;
    }
    .combo-pricing-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Product Sheet Actions */
    .sheet-modal-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 16px;
    }
    .modal-qty-selector {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 14px;
      border-radius: 14px;
      border: 1px solid rgba(0,0,0,0.08);
    }
    .m-qty-btn {
      background: none;
      border: none;
      font-size: 1.1rem;
      font-weight: 700;
      cursor: pointer;
      padding: 0 4px;
      opacity: 0.8;
    }
    .m-qty-val {
      font-size: 0.95rem;
      font-weight: 800;
    }
    .btn-sheet-add-cart {
      flex: 1;
      padding: 14px;
      border: none;
      border-radius: 14px;
      color: #FFF;
      font-weight: 700;
      font-size: 0.92rem;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    }

    /* Cart Drawer Modal Sheet */
    .cart-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.75);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 200;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      animation: fadeIn 0.2s ease;
    }
    .cart-drawer-sheet {
      width: 100%;
      max-width: 480px;
      max-height: 85vh;
      border-radius: 24px 24px 0 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 -10px 40px rgba(0,0,0,0.5);
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .cart-drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px;
      border-bottom: 1px solid rgba(0,0,0,0.06);
    }
    .cart-header-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .cart-icon-bg {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cart-title {
      font-size: 1.1rem;
      font-weight: 800;
      margin: 0;
      line-height: 1.2;
    }
    .cart-subtitle {
      font-size: 0.75rem;
      opacity: 0.8;
    }
    .drawer-close-btn {
      background: none;
      border: none;
      font-size: 1.2rem;
      cursor: pointer;
      padding: 4px;
      opacity: 0.6;
    }

    /* Cart Security Notice Alert */
    .cart-security-notice {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 16px;
      margin: 12px 20px 0;
      border-radius: 12px;
      border: 1px solid;
    }
    .notice-text {
      font-size: 0.76rem;
      margin: 0;
      line-height: 1.35;
      opacity: 0.9;
    }

    /* Cart Items List Body */
    .cart-items-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
    }
    .cart-empty-state {
      text-align: center;
      padding: 40px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .empty-title { font-size: 1rem; font-weight: 700; margin: 0; }
    .empty-sub { font-size: 0.8rem; margin: 0; opacity: 0.7; }

    .cart-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .cart-item-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(0,0,0,0.06);
    }
    .cart-item-thumb {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      overflow: hidden;
      flex-shrink: 0;
      background: rgba(0,0,0,0.05);
    }
    .c-thumb-img { width: 100%; height: 100%; object-fit: cover; }
    .c-thumb-fallback { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }

    .cart-item-info { flex: 1; }
    .c-item-name { font-size: 0.88rem; font-weight: 700; margin: 0 0 2px; }
    .c-item-unit-price { font-size: 0.76rem; opacity: 0.8; }

    .cart-item-actions { display: flex; align-items: center; gap: 8px; }
    .cart-qty-ctrl {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      border-radius: 10px;
      border: 1px solid rgba(0,0,0,0.08);
    }
    .c-qty-btn { background: none; border: none; font-size: 0.95rem; font-weight: 700; cursor: pointer; padding: 0 2px; }
    .c-qty-val { font-size: 0.82rem; font-weight: 800; min-width: 14px; text-align: center; }
    .c-remove-btn { background: none; border: none; cursor: pointer; padding: 4px; opacity: 0.7; }

    /* Cart Footer */
    .cart-drawer-footer {
      padding: 16px 20px 24px;
      border-top: 1px solid rgba(0,0,0,0.06);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .cart-totals-row { display: flex; justify-content: space-between; align-items: center; }
    .total-label { font-size: 0.88rem; font-weight: 600; }
    .total-val { font-size: 1.3rem; font-weight: 800; }
    .cart-footer-btns { display: flex; align-items: center; gap: 10px; }
    .btn-clear-cart { background: none; border: none; font-size: 0.78rem; font-weight: 600; cursor: pointer; opacity: 0.7; padding: 10px; }
    .btn-continue-nav {
      flex: 1;
      padding: 12px;
      border: none;
      border-radius: 12px;
      color: #FFF;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      text-align: center;
    }

    .category-nav-pill.active { color: var(--on-primary); }
    .cart-badge-count { color: var(--on-accent); }
    .btn-enter-menu, .btn-sheet-add-cart, .btn-continue-nav { color: var(--on-action); }

    @media (prefers-reduced-motion: reduce) {
      .welcome-screen, .welcome-screen.anim-exit, .menu-main-shell.anim-enter, .welcome-logo-wrap, .ambient-glow, .btn-shimmer {
        animation: none !important;
        transition: none !important;
      }
      .menu-reveal-pending, .menu-reveal-visible, .catalog-section.category-enter {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
      .entry-transition-layer { display: none !important; }
      .welcome-screen.anim-exit { display: none !important; }
    }
  `]
})
export class PublicMenuViewComponent implements OnInit, OnDestroy {
  @ViewChild('showcaseScroller') private showcaseScroller?: ElementRef<HTMLElement>;
  @ViewChild('catalogSection') private catalogSection?: ElementRef<HTMLElement>;
  /** Se for true, consome os signals em tempo real do painel (DesignService, MenuService, AuthService) */
  private previewMode = signal(false);
  @Input() set isPhonePreview(value: boolean) { this.previewMode.set(value); }
  get isPhonePreview(): boolean { return this.previewMode(); }

  /** Se for false (rota pública), recebe os dados carregados da API */
  @Input() publicSlug: string | null = null;

  // View state: 'welcome' -> 'transitioning' -> 'menu'
  viewState: 'welcome' | 'transitioning' | 'menu' = 'welcome';
  menuOpening = false;
  private openingTimers: ReturnType<typeof setTimeout>[] = [];

  // Filters & selection
  private category = signal<string | null>(null);
  get activeCatId(): string | null { return this.category(); }
  set activeCatId(value: string | null) { this.category.set(value); }
  categoryTransitioning = false;
  private categoryFrame = 0;
  searchActive = false;
  private search = signal('');
  get searchFilter(): string { return this.search(); }
  set searchFilter(value: string) { this.search.set(value); }
  selectedProduct: MenuItem | null = null;
  readonly likeMessage = signal('');
  productVideoExpanded = false;
  modalItemQuantity = 1;
  private previewLikedItemIds = new Set<string>();

  // Carousel state
  activeBannerIndex = 0;
  private bannerTimer: any = null;
  private previewSyncTimer: any = null;
  private lastSyncedPreviewCat: string | null = null;

  // Subcategories Accordion State
  collapsedSubcategories = new Set<string>();
  private readonly iconCache = new Map<string, SafeHtml | null>();
  private readonly catalogItems = computed(() => this.isPhonePreview
    ? this.menuService.items().filter(item => item.isAvailable)
    : this.publicMenuService.menuData()?.items || []);
  private readonly categoryList = computed(() => this.isPhonePreview
    ? this.menuService.categories().filter(category => category.isActive)
    : this.publicMenuService.menuData()?.categories || []);
  private readonly subcategoryList = computed(() => this.isPhonePreview
    ? this.menuService.subcategories() : this.publicMenuService.menuData()?.subcategories || []);
  private readonly searchIndex = computed(() => new Map(this.items.map(item =>
    [item.id, normalizeMenuSearch(item.name + ' ' + (item.description || ''))])));
  private readonly visibleItems = computed(() => {
    const query = normalizeMenuSearch(this.searchFilter), category = this.activeCatId;
    const index = this.searchIndex();
    return this.items.filter(item => (!category || item.categoryId === category) &&
      (!query || index.get(item.id)?.includes(query)))
      .sort((a,b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  });
  private readonly groupedItems = computed(() => {
    const subcategories = this.activeCatId ? this.subcategories.filter(sub => sub.categoryId === this.activeCatId)
      .sort((a,b) => (a.displayOrder || 0) - (b.displayOrder || 0)) : [];
    const ids = new Set(subcategories.map(sub => sub.id));
    const groups = new Map<string, MenuItem[]>(), ungrouped: MenuItem[] = [];
    for (const item of this.displayItems) {
      if (item.subcategoryId && ids.has(item.subcategoryId)) {
        const rows = groups.get(item.subcategoryId) || []; rows.push(item); groups.set(item.subcategoryId, rows);
      } else ungrouped.push(item);
    }
    return { subcategories, groups, ungrouped };
  });
  private readonly highlights = computed(() => {
    const items = this.items;
    const explicit = items.filter(item => item.highlightType === 'most_liked');
    const organic = items.filter(item => item.highlightType !== 'most_liked' && (item.likesCount || 0) > 0)
      .sort((a,b) => (b.likesCount || 0) - (a.likesCount || 0));
    return {
      promotion: items.filter(item => item.highlightType === 'promotion' || (item.promotionalPrice && item.promotionalPrice < item.price)),
      liked: [...explicit, ...organic].slice(0,4),
      featured: items.filter(item => item.highlightType === 'chef' || (item.isHighlighted && (!item.highlightType || item.highlightType === 'none'))),
      combo: items.filter(item => item.highlightType === 'combo'),
      bestseller: items.filter(item => item.highlightType === 'best_seller'),
    };
  });

  toggleSubcategory(subcategoryId: string): void {
    if (this.collapsedSubcategories.has(subcategoryId)) {
      this.collapsedSubcategories.delete(subcategoryId);
    } else {
      this.collapsedSubcategories.add(subcategoryId);
    }
  }

  isSubcategoryCollapsed(subcategoryId: string): boolean {
    return this.collapsedSubcategories.has(subcategoryId);
  }

  constructor(
    private designService: DesignService,
    private menuService: MenuService,
    private authService: AuthService,
    private publicMenuService: PublicMenuService,
    public cartService: CartService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private analytics: PublicAnalyticsService,
    private fonts: MenuFontsService
  ) {
    effect(() => {
      const design = this.isPhonePreview ? this.designService.draft() : this.publicMenuService.menuData()?.design;
      if (design) this.fonts.selected(this.headingFont, this.bodyFont);
    });
  }

  ngOnInit(): void {
    if (this.publicSlug) {
      this.cartService.setSlug(this.publicSlug);
    }
    this.startBannerTimer();

    // Sincronização em tempo real da categoria no preview do celular com o editor
    if (this.isPhonePreview) {
      this.previewSyncTimer = setInterval(() => {
        const pCat = this.designService.previewCategory();
        if (pCat !== this.lastSyncedPreviewCat) {
          this.lastSyncedPreviewCat = pCat;
          this.activeCatId = pCat;
          this.activeBannerIndex = 0;
          this.startBannerTimer();
          this.cdr.markForCheck();
        }
      }, 80);
    }
  }

  ngOnDestroy(): void {
    this.stopBannerTimer();
    if (this.categoryFrame) cancelAnimationFrame(this.categoryFrame);
    this.openingTimers.forEach(clearTimeout);
    if (this.previewSyncTimer) {
      clearInterval(this.previewSyncTimer);
      this.previewSyncTimer = null;
    }
  }

  startBannerTimer(): void {
    this.stopBannerTimer();
    if (this.viewState === 'welcome' || this.heroBanners.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.bannerTimer = setInterval(() => {
      this.nextBanner();
    }, 6000); // 6 segundos para cada slide da hero section
  }

  stopBannerTimer(): void {
    if (this.bannerTimer) {
      clearInterval(this.bannerTimer);
      this.bannerTimer = null;
    }
  }

  nextBanner(): void {
    const count = this.heroBanners.length;
    if (count > 1) {
      this.activeBannerIndex = (this.activeBannerIndex + 1) % count;
      this.cdr.markForCheck();
    } else {
      this.activeBannerIndex = 0;
    }
  }

  selectBanner(index: number): void {
    const count = this.heroBanners.length;
    if (index >= 0 && index < count) {
      this.activeBannerIndex = index;
    } else {
      this.activeBannerIndex = 0;
    }
    this.startBannerTimer();
    this.cdr.markForCheck();
  }

  // ── COMPUTED DATA DEPENDING ON MODE ──

  get business(): Partial<PublicBusiness> {
    if (this.isPhonePreview) {
      const b = this.authService.currentBusiness();
      return {
        name: b?.name || 'Sapatolândia Gourmet',
        slug: b?.slug || 'sapatolandia-gourmet',
        logoUrl: b?.logo_url || '/logo_img.webp',
        coverImageUrl: b?.welcome_bg_image || b?.cover_image_url || 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
        description: b?.description || '',
        welcomeBgType: b?.welcome_bg_type || 'image',
        welcomeBgImage: b?.welcome_bg_image || b?.cover_image_url || 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
        welcomeBgColor: b?.welcome_bg_color || '#0F0F12'
      };
    }
    const pb = this.publicMenuService.menuData()?.business;
    return pb || {
      name: 'Estabelecimento',
      slug: '',
      logoUrl: '/logo_img.webp',
      coverImageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
      description: '',
      welcomeBgType: 'image',
      welcomeBgImage: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
      welcomeBgColor: '#0F0F12'
    };
  }

  get businessName(): string {
    return this.business.name || 'Cardápio Digital';
  }

  get businessDescription(): string {
    return this.business.description || '';
  }

  get logoUrl(): string {
    return this.business.logoUrl || '/logo_img.webp';
  }

  get coverImageUrl(): string {
    return this.business.coverImageUrl || (this.isPhonePreview ? 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80' : '');
  }

  get welcomeBgType(): 'image' | 'color' {
    return (this.business as any)?.welcomeBgType || (this.business as any)?.welcome_bg_type || 'image';
  }

  get welcomeBgImage(): string {
    return (this.business as any)?.welcomeBgImage || (this.business as any)?.welcome_bg_image || this.coverImageUrl;
  }

  get welcomeBgColor(): string {
    return (this.business as any)?.welcomeBgColor || (this.business as any)?.welcome_bg_color || '#0F0F12';
  }

  get categoryHeroConfigs(): Record<string, { enabled: boolean; banners: string[] }> {
    if (this.isPhonePreview) {
      const draft = this.designService.draft();
      return draft.categoryHeroConfigs || (draft.customConfig as any)?.category_hero_configs || {};
    }
    const designData = this.publicMenuService.menuData()?.design;
    return designData?.categoryHeroConfigs ||
           (designData?.customConfig as any)?.category_hero_configs ||
           (designData?.customConfig as any)?.categoryHeroConfigs ||
           this.designService.draft().categoryHeroConfigs ||
           {};
  }

  get heroScope(): 'all' | 'home_only' {
    if (this.isPhonePreview) {
      const draft = this.designService.draft();
      return draft.heroScope || (draft.customConfig as any)?.hero_scope || 'all';
    }
    const designData = this.publicMenuService.menuData()?.design;
    return designData?.heroScope ||
           (designData?.customConfig as any)?.hero_scope ||
           (designData?.customConfig as any)?.heroScope ||
           'all';
  }

  /**
   * Busca a configuração da Hero Section de uma categoria específica (por ID ou Slug)
   */
  getCategoryHeroConfig(catId: string | null): { enabled: boolean; banners: string[] } | null {
    if (!catId) return null;
    const configs = this.categoryHeroConfigs;
    if (configs[catId]) {
      return configs[catId];
    }
    const cat = this.categories.find(c => c.id === catId || (c as any).slug === catId);
    if (cat) {
      if (configs[cat.id]) return configs[cat.id];
      if ((cat as any).slug && configs[(cat as any).slug]) return configs[(cat as any).slug];
    }
    return null;
  }

  get isCategoryHeroEnabled(): boolean {
    if (!this.showHeroBlock) return false;
    // Se estiver na aba Início (sem categoria ativa), sempre exibe a Hero
    if (!this.activeCatId) return true;

    // Se a categoria ativa possuir configuração própria:
    const catConfig = this.getCategoryHeroConfig(this.activeCatId);
    if (catConfig) {
      // Se o lojista explicitamente desativou a Hero Section desta categoria no switch:
      if (catConfig.enabled === false) {
        return false;
      }
      // Se tiver banners próprios cadastrados, ela SEMPRE exibe!
      if (Array.isArray(catConfig.banners) && catConfig.banners.length > 0) {
        return true;
      }
    }

    // Se a categoria não possui banners próprios cadastrados:
    // Se o escopo for 'all', ela herda a Hero Section da Home
    if (this.heroScope === 'all') {
      return true;
    }

    // Se o escopo for 'home_only' e a categoria não tem imagem própria, oculta a hero
    return false;
  }

  get heroBanners(): string[] {
    if (this.activeCatId) {
      const catConfig = this.getCategoryHeroConfig(this.activeCatId);
      // Se a categoria tem banners próprios cadastrados e habilitados, exibe os banners dela
      if (catConfig && catConfig.enabled !== false && Array.isArray(catConfig.banners) && catConfig.banners.length > 0) {
        return catConfig.banners;
      }
      // Se o escopo for 'home_only' e a categoria não tem banners próprios:
      if (this.heroScope === 'home_only') {
        return [];
      }
    }

    // Retorna banners gerais da Home
    const banners = this.design?.heroBanners || (this.design?.customConfig as any)?.hero_banners;
    if (banners && Array.isArray(banners) && banners.length > 0) {
      return banners;
    }
    return this.coverImageUrl ? [this.coverImageUrl] : [];
  }

  get currentBannerIndex(): number {
    const len = this.heroBanners.length;
    if (len <= 0) return 0;
    if (this.activeBannerIndex >= len) {
      this.activeBannerIndex = 0;
    }
    return this.activeBannerIndex;
  }

  sanitizeBannerUrl(url: string | null | undefined): string {
    return safeMenuImage(url);
  }

  get homeBistroSvg(): SafeHtml | null { return this.cachedIcon('3d-bistro'); }

  homeIcon(section: HomeIconSection) { return homeIconChoice(this.design?.customConfig, section); }

  highlightTitleIcon(key: '3d-combo' | '3d-bestseller'): SafeHtml | null {
    return this.cachedIcon(key);
  }

  get welcomeTagline(): string {
    if (this.isPhonePreview) {
      return (this.designService.draft().customConfig as any)?.welcome_tagline || 'Experiência gastronômica artesanal e inesquecível';
    }
    return (this.publicMenuService.menuData()?.design?.customConfig as any)?.welcome_tagline || 'Experiência gastronômica artesanal e inesquecível';
  }

  get introCard(): { enabled: boolean; title: string; description: string } {
    if (this.isPhonePreview) {
      return this.designService.introCard();
    }
    const designData = this.publicMenuService.menuData()?.design;
    const fromCustom = (designData?.customConfig as any)?.intro_card;
    const fromDirect = (designData as any)?.introCard;
    const cfg = fromCustom || fromDirect || this.designService.introCard();
    return {
      enabled: cfg?.enabled !== false,
      title: cfg?.title || '',
      description: cfg?.description || ''
    };
  }

  get hasIntroCard(): boolean {
    const card = this.introCard;
    return Boolean(card.enabled && (card.title?.trim() || card.description?.trim()));
  }

  get design(): DesignSettings {
    if (this.isPhonePreview) {
      return this.designService.draft();
    }
    return this.publicMenuService.menuData()?.design || this.designService.draft();
  }

  get templateKey(): string { return this.currentTemplate.key; }

  get heroControlsInside(): boolean {
    return this.currentTemplate.brandPosition === 'inside-hero' && !this.searchActive && !this.searchFilter && this.isCategoryHeroEnabled;
  }

  get currentTemplate(): TemplateConfig {
    return resolveMenuTemplate(this.design);
  }

  get categories(): Category[] { return this.categoryList(); }

  get subcategories(): Subcategory[] { return this.subcategoryList(); }

  get activeCategorySubcategories(): Subcategory[] { return this.groupedItems().subcategories; }

  getItemsBySubcategory(subcategoryId: string): MenuItem[] {
    return this.groupedItems().groups.get(subcategoryId) || [];
  }

  getItemsWithoutSubcategory(): MenuItem[] {
    return this.groupedItems().ungrouped;
  }

  get visibleCategories(): Category[] {
    return this.categories;
  }

  get items(): MenuItem[] { return this.catalogItems(); }

  // ── DESIGN TOKENS (7 CORES + 2 FONTES) ──

  get primaryColor(): string {
    return this.design?.palette?.colors?.primary || '#8B1A3A';
  }

  get secondaryColor(): string {
    return this.design?.palette?.colors?.secondary || '#D26E2D';
  }

  get primaryContrast(): string { return contrastTextColor(this.primaryColor); }
  get accentContrast(): string { return contrastTextColor(this.accentColor); }
  get actionContrast(): string { return contrastTextColor(this.primaryColor, this.accentColor); }

  get accentColor(): string {
    return this.design?.palette?.colors?.accent || '#F47B20';
  }

  get screenBg(): string {
    return this.design?.palette?.colors?.background || '#FAF5F0';
  }

  get surfaceColor(): string {
    return this.design?.palette?.colors?.surface || '#FFFFFF';
  }

  get textPrimary(): string {
    return this.design?.palette?.colors?.textPrimary || '#2D1822';
  }

  get textSecondary(): string {
    return this.design?.palette?.colors?.textSecondary || '#6E5D65';
  }

  get headingFont(): string {
    if (this.design?.fontHeading) return menuFont(this.design.fontHeading, 'Outfit');
    const pair = AVAILABLE_FONT_PAIRS.find(f => f.key === this.design?.fontPair);
    return pair ? pair.heading : 'Outfit';
  }

  get bodyFont(): string {
    if (this.design?.fontBody) return menuFont(this.design.fontBody, 'Inter');
    const pair = AVAILABLE_FONT_PAIRS.find(f => f.key === this.design?.fontPair);
    return pair ? pair.body : 'Inter';
  }

  // ── HOME BLOCKS & RECURSOS ──

  get orderedHomeBlocks(): HomeBlock[] {
    return (this.design?.homeBlocks || [])
      .filter(b => b.enabled)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  get showHeroBlock(): boolean {
    return (this.design?.homeBlocks || []).some(b => b.type === 'hero' && b.enabled) && this.heroBanners.length > 0;
  }

  get showCategoriesBlock(): boolean {
    return (this.design?.homeBlocks || []).some(b => b.type === 'categories' && b.enabled);
  }

  get showPromoBlock(): boolean {
    return (this.design?.homeBlocks || []).some(b => b.type === 'promotion' && b.enabled);
  }

  get showMostLikedBlock(): boolean {
    return (this.design?.homeBlocks || []).some(b => b.type === 'most_liked' && b.enabled);
  }

  get showFeaturedBlock(): boolean {
    return (this.design?.homeBlocks || []).some(b => b.type === 'featured_product' && b.enabled);
  }

  get showCombosBlock(): boolean {
    return (this.design?.homeBlocks || []).some(b => b.type === 'combo' && b.enabled);
  }

  get showBestSellersBlock(): boolean {
    return (this.design?.homeBlocks || []).some(b => b.type === 'best_seller' && b.enabled);
  }

  get enableLikes(): boolean {
    if (this.isPhonePreview) {
      return this.designService.enableLikes();
    }
    const cfg = (this.publicMenuService.menuData()?.design?.customConfig as any);
    if (cfg?.enable_likes !== undefined) {
      return cfg.enable_likes === true || cfg.enable_likes === 'true';
    }
    return this.designService.enableLikes();
  }

  get enableCart(): boolean {
    if (this.isPhonePreview) {
      return this.designService.enableCart();
    }
    const cfg = (this.publicMenuService.menuData()?.design?.customConfig as any);
    if (cfg?.enable_cart !== undefined) {
      return cfg.enable_cart === true || cfg.enable_cart === 'true';
    }
    return this.designService.enableCart();
  }

  // ── FILTERED DATA ──

  get promoItems(): MenuItem[] { return this.highlights().promotion; }

  get mostLikedItems(): MenuItem[] { return this.highlights().liked; }

  get featuredItems(): MenuItem[] { return this.highlights().featured; }

  get comboItems(): MenuItem[] { return this.highlights().combo; }

  get bestSellerItems(): MenuItem[] { return this.highlights().bestseller; }

  get currentCategoryName(): string {
    if (this.searchFilter) return 'Resultados da Busca';
    if (!this.activeCatId) return 'Início';
    const cat = this.categories.find(c => c.id === this.activeCatId);
    return cat ? cat.name : 'Cardápio';
  }

  get displayItems(): MenuItem[] { return this.visibleItems(); }

  get userLikesCount(): number {
    return this.publicMenuService.likedItemIds().size;
  }

  // ── INTERAÇÕES & ANIMAÇÃO ──

  openMenuWithAnimation(): void {
    this.viewState = 'menu';
    this.menuOpening = false;
    this.startBannerTimer();
  }

  resetToWelcome(): void {
    this.viewState = 'welcome';
    this.activeCatId = null;
    this.searchActive = false;
    this.searchFilter = '';
    this.activeBannerIndex = 0;
    this.startBannerTimer();
    this.cdr.markForCheck();
  }

  toggleSearch(): void {
    this.searchActive = !this.searchActive;
    if (!this.searchActive) this.searchFilter = '';
  }

  updateSearch(event: Event): void {
    if ((event as InputEvent).isComposing) return;
    this.searchFilter = (event.target as HTMLInputElement).value;
  }

  filterCategory(catId: string | null): void {
    if (this.activeCatId === catId && !this.searchFilter) return;
    if (!this.isPhonePreview && catId) this.analytics.record(this.publicSlug, 'CATEGORY_VIEW', { categoryId: catId });
    if (this.categoryFrame) cancelAnimationFrame(this.categoryFrame);
    this.categoryTransitioning = false;
    this.activeCatId = catId;
    this.searchFilter = '';
    this.activeBannerIndex = 0;
    this.startBannerTimer();
    this.cdr.markForCheck();
    this.categoryFrame = requestAnimationFrame(() => {
      this.showcaseScroller?.nativeElement.scrollTo({ top: 0, behavior: 'auto' });
      this.categoryFrame = 0;
    });
  }

  openProductDetail(item: MenuItem): void {
    if (!this.isPhonePreview) this.analytics.record(this.publicSlug, 'PRODUCT_VIEW', { itemId: item.id });
    this.selectedProduct = item;
    this.productVideoExpanded = false;
    this.modalItemQuantity = 1;
  }

  closeProductDetail(): void {
    this.productVideoExpanded = false;
    this.selectedProduct = null;
  }

  increaseModalQty(): void {
    this.modalItemQuantity++;
  }

  decreaseModalQty(): void {
    if (this.modalItemQuantity > 1) {
      this.modalItemQuantity--;
    }
  }

  getModalTotal(item: MenuItem): number {
    const activePrice = item.promotionalPrice && item.promotionalPrice < item.price ? item.promotionalPrice : item.price;
    return activePrice * this.modalItemQuantity;
  }

  confirmAddToCart(item: MenuItem): void {
    if (!this.enableCart) return;
    this.cartService.addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      promotionalPrice: item.promotionalPrice,
      imageUrl: item.imageUrl
    }, this.modalItemQuantity);
  }

  get selectedProductLikesCount(): number {
    return this.items.find(item => item.id === this.selectedProduct?.id)?.likesCount ?? this.selectedProduct?.likesCount ?? 0;
  }

  onLikeClick(event: Event, itemId: string): void {
    event.stopPropagation();
    if (!this.enableLikes) return;

    if (this.isPhonePreview) {
      if (this.previewLikedItemIds.has(itemId)) return;
      this.previewLikedItemIds.add(itemId);
      const it = this.items.find(i => i.id === itemId);
      if (it) {
        this.menuService.items.update(rows => rows.map(row => row.id === itemId ? {...row, likesCount:(row.likesCount || 0) + 1} : row));
      }
      return;
    }

    if (this.publicMenuService.isLikePending(itemId)) return;
    const slug = this.business.slug || 'sapatolandia-gourmet';
    this.likeMessage.set('');
    this.publicMenuService.likeItem(slug, itemId).subscribe(response => {
      if (!response && !this.isLiked(itemId)) this.likeMessage.set('Não foi possível registrar sua curtida. Tente novamente.');
    });
  }

  onAddToCartClick(event: Event, item: MenuItem): void {
    event.stopPropagation();
    if (!this.enableCart) return;
    this.cartService.addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      promotionalPrice: item.promotionalPrice,
      imageUrl: item.imageUrl
    });
  }

  isLiked(itemId: string): boolean {
    return this.isPhonePreview
      ? this.previewLikedItemIds.has(itemId)
      : this.publicMenuService.isItemLiked(itemId);
  }

  isLikePending(itemId: string): boolean {
    return !this.isPhonePreview && this.publicMenuService.isLikePending(itemId);
  }

  getCatSvg(cat: Category): SafeHtml | null {
    return cat.iconType === 'none' ? null : this.cachedIcon(cat.iconKey || cat.icon || '');
  }

  private cachedIcon(key: string): SafeHtml | null {
    if (!this.iconCache.has(key)) {
      const icon = findCatalogIcon(key);
      this.iconCache.set(key, icon ? this.sanitizer.bypassSecurityTrustHtml(icon.svg.replace('<svg ', '<svg width="28" height="28" ')) : null);
    }
    return this.iconCache.get(key) || null;
  }

  onLogoError(event: Event): void {
    (event.target as HTMLImageElement).src = '/logo_img.webp';
  }
                        }
