import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MenuService, Category, MenuItem, Subcategory } from '../../../../services/menu.service';
import { ICON_CATALOG, ICON_GROUPS, CatalogIcon, findCatalogIcon } from '../../../../constants/icon-catalog';
import { ProductVideoUploaderComponent } from '../../../../features/product-video/product-video-uploader.component';

@Component({
  selector: 'app-menu-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductVideoUploaderComponent],
  template: `
    <div class="menu-container">
      <!-- 1. Categories Section -->
      <section class="section-block" style="--i:0">
        <div class="section-header">
          <div>
            <h2 class="section-title">Categorias</h2>
            <p class="section-subtitle">{{ menuService.categories().length }} categorias configuradas</p>
          </div>
          <button class="btn-cta" (click)="openCategoryModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova Categoria
          </button>
        </div>

        <div class="categories-scroll">
          <!-- All filter -->
          <button class="cat-chip" [class.active]="!selectedCategoryId" (click)="filterBy(null)">
            <div class="chip-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            </div>
            <span class="chip-label">Todas</span>
            <span class="chip-count">{{ menuService.items().length }}</span>
          </button>

          @for (cat of menuService.categories(); track cat.id; let i = $index) {
            <button class="cat-chip" [class.active]="selectedCategoryId === cat.id" (click)="filterBy(cat.id)" [style.animation-delay]="(i * 50 + 100) + 'ms'">
              @if (cat.iconType === 'image' && cat.imageUrl) {
                <div class="chip-icon img-wrap">
                  <img [src]="cat.imageUrl" [alt]="cat.name" class="chip-custom-img" />
                </div>
              } @else if (cat.iconType !== 'none' && getCategoryIconSvg(cat)) {
                <div class="chip-icon svg-wrap" [innerHTML]="getCategoryIconSvg(cat)"></div>
              }
              <span class="chip-label">{{ cat.name }}</span>
              <div class="chip-actions" (click)="$event.stopPropagation()">
                <button class="chip-action-btn" (click)="openCategoryModal(cat)" title="Editar">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                </button>
                <button class="chip-action-btn danger" (click)="deleteCategory(cat.id)" title="Excluir">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
                </button>
              </div>
            </button>
          }
        </div>
      </section>

      <!-- 1.5 Subcategories Management -->
      @if (selectedCategoryId && categorySubcategories.length > 0 || selectedCategoryId) {
        <section class="section-block subcategories-section" style="--i:0.5">
          <div class="section-header">
            <div>
              <h2 class="section-title">Subcategorias</h2>
              <p class="section-subtitle">{{ categorySubcategories.length }} subcategorias nesta categoria</p>
            </div>
          </div>

          <!-- Add new subcategory -->
          <div class="subcat-add-row">
            <input
              type="text"
              [(ngModel)]="newSubcategoryName"
              placeholder="Nome da nova subcategoria..."
              class="field-input subcat-input"
              (keydown.enter)="addSubcategory()" />
            <button class="btn-cta" (click)="addSubcategory()" [disabled]="!newSubcategoryName.trim()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Adicionar
            </button>
          </div>

          <!-- Subcategory list -->
          @if (categorySubcategories.length > 0) {
            <div class="subcat-list">
              @for (sub of categorySubcategories; track sub.id; let i = $index; let first = $first; let last = $last) {
                <div class="subcat-item">
                  <div class="subcat-order">{{ i + 1 }}</div>
                  @if (editingSubcategoryId === sub.id) {
                    <input
                      type="text"
                      [(ngModel)]="editingSubcategoryName"
                      class="field-input subcat-edit-input"
                      (keydown.enter)="saveEditSubcategory(sub)"
                      (keydown.escape)="cancelEditSubcategory()" />
                    <button class="subcat-action-btn save" (click)="saveEditSubcategory(sub)" title="Salvar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    <button class="subcat-action-btn" (click)="cancelEditSubcategory()" title="Cancelar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  } @else {
                    <span class="subcat-name">{{ sub.name }}</span>
                    <div class="subcat-actions">
                      <button class="subcat-action-btn" (click)="moveSubcategory(sub, 'up')" [disabled]="first" title="Mover para cima">▲</button>
                      <button class="subcat-action-btn" (click)="moveSubcategory(sub, 'down')" [disabled]="last" title="Mover para baixo">▼</button>
                      <button class="subcat-action-btn" (click)="startEditSubcategory(sub)" title="Editar">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                      </button>
                      <button class="subcat-action-btn danger" (click)="deleteSubcategory(sub.id)" title="Excluir">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </section>
      }

      <!-- 2. Products Grid -->
      <section class="section-block" style="--i:1">
        <div class="section-header">
          <div>
            <h2 class="section-title">Produtos do Cardápio</h2>
            <p class="section-subtitle">{{ filteredItems.length }} itens</p>
          </div>
          <button class="btn-cta primary" (click)="openItemModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo Produto
          </button>
        </div>

        <div class="products-grid">
          @for (item of filteredItems; track item.id; let i = $index) {
            <div class="product-card" [class.paused]="!item.isAvailable" [style.--pi]="i">
              <!-- Badge Highlight Type -->
              @if (item.highlightType && item.highlightType !== 'none') {
                <div class="product-badge" [attr.data-hl]="item.highlightType">
                  {{ getHighlightLabel(item.highlightType) }}
                </div>
              } @else if (item.isHighlighted) {
                <div class="product-badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  Destaque
                </div>
              }

              <!-- Avatar -->
              <div class="product-avatar clickable" (click)="openViewItemModal(item)" title="Clique para ver detalhes do item">
                @if (item.imageUrl) {
                  <img [src]="item.imageUrl" [alt]="item.name" class="product-img" />
                } @else {
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 2a9 9 0 0 0-9 9c0 4.17 2.84 7.67 6.69 8.69L12 22l2.31-2.31C18.16 18.67 21 15.17 21 11a9 9 0 0 0-9-9Z"/>
                    <circle cx="12" cy="11" r="3"/>
                  </svg>
                }
              </div>

              <!-- Info -->
              <div class="product-info">
                <h3 class="product-name">{{ item.name }}</h3>
                <span class="product-category">{{ item.categoryName || 'Sem Categoria' }}@if (item.subcategoryId) { · {{ getSubcategoryName(item.subcategoryId) }}}</span>
                <p class="product-desc">{{ item.description || 'Sem descrição.' }}</p>

                <!-- Pricing -->
                <div class="product-pricing">
                  @if (item.showPrice === false) {
                    <span class="price-main" style="color: #F59E0B; font-style: italic; font-size: 0.9rem;">Consulte...</span>
                  } @else {
                    <span class="price-main">R$ {{ item.price.toFixed(2) }}</span>
                    @if (item.promotionalPrice) {
                      <span class="price-promo">R$ {{ item.promotionalPrice.toFixed(2) }}</span>
                    }
                  }
                </div>

                <!-- Actions bar -->
                <div class="product-actions-bar">
                  <button class="status-tag" [class.active]="item.isAvailable" (click)="toggleAvailability(item.id)">
                    {{ item.isAvailable ? 'Ativo' : 'Pausado' }}
                  </button>
                  <div class="action-btns">
                    <button class="action-btn reorder-btn" (click)="moveItem(item, 'up')" title="Mover para cima">▲</button>
                    <button class="action-btn reorder-btn" (click)="moveItem(item, 'down')" title="Mover para baixo">▼</button>
                    <button class="action-btn" (click)="openViewItemModal(item)" title="Ver Detalhes do Produto">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button class="action-btn" (click)="openItemModal(item)" title="Editar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button class="action-btn danger" (click)="deleteItem(item.id)" title="Excluir">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          } @empty {
            <div class="empty-state">
              <div class="empty-icon">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                  <rect width="18" height="18" x="3" y="3" rx="2"/>
                  <line x1="12" y1="8" x2="12" y2="16"/>
                  <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
              </div>
              <p class="empty-text">Nenhum produto cadastrado.</p>
              <button class="btn-cta primary" (click)="openItemModal()">Criar Primeiro Produto</button>
            </div>
          }
        </div>
      </section>
    </div>

    <!-- Modal: Category -->
    @if (showCategoryModal) {
      <div class="modal-overlay" (click)="showCategoryModal = false">
        <div class="modal-card category-modal" (click)="$event.stopPropagation()">
          <div class="modal-top">
            <h3 class="modal-title">{{ editingCategoryId ? 'Editar Categoria' : 'Nova Categoria' }}</h3>
            <button class="modal-close" (click)="showCategoryModal = false">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <form (ngSubmit)="saveCategory()" class="category-form">
            <!-- 1. Campo Nome (Apenas Nome) -->
            <div class="form-field">
              <label class="field-label">Nome da Categoria <span class="req">*</span></label>
              <input type="text" [(ngModel)]="catForm.name" name="catName" placeholder="Ex: Hambúrgueres Artesanais" required class="field-input" autofocus />
            </div>

            <!-- 2. Seletor do Ícone / Imagem -->
            <div class="icon-selector-section">
              <label class="field-label">Ícone ou Imagem da Categoria</label>
              <div class="mode-tabs">
                <button type="button" class="mode-tab" [class.active]="catForm.mode === 'catalog'" (click)="setCategoryMode('catalog')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                  Catálogo de Ícones
                </button>
                <button type="button" class="mode-tab" [class.active]="catForm.mode === 'image'" (click)="setCategoryMode('image')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                  Colocar Imagem
                </button>
                <button type="button" class="mode-tab" [class.active]="catForm.mode === 'none'" (click)="setCategoryMode('none')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  Sem Ícone
                </button>
              </div>

              <!-- MODO: CATÁLOGO DE ÍCONES (2D e 3D) -->
              @if (catForm.mode === 'catalog') {
                <div class="catalog-picker-box">
                  <div class="catalog-toolbar">
                    <div class="search-input-wrap">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      <input type="text" [(ngModel)]="iconSearchQuery" name="iconSearch" placeholder="Pesquisar por nome ou tag (ex: burger, chopp, pizza)..." class="catalog-search-input" />
                      @if (iconSearchQuery) {
                        <button type="button" class="clear-search-btn" (click)="iconSearchQuery = ''">✕</button>
                      }
                    </div>

                    <div class="type-filter-group">
                      <button type="button" class="type-btn" [class.active]="iconFilterType === 'all'" (click)="iconFilterType = 'all'">
                        Todos
                      </button>
                      <button type="button" class="type-btn" [class.active]="iconFilterType === '2d'" (click)="iconFilterType = '2d'">
                        Ícones 2D
                      </button>
                      <button type="button" class="type-btn" [class.active]="iconFilterType === '3d'" (click)="iconFilterType = '3d'">
                        Ícones 3D
                      </button>
                    </div>
                  </div>

                  <!-- Grupos de ícones -->
                  <div class="groups-filter-scroll">
                    <button type="button" class="grp-chip" [class.active]="selectedIconGroup === 'all'" (click)="selectedIconGroup = 'all'">Todos</button>
                    @for (grp of iconGroups; track grp) {
                      <button type="button" class="grp-chip" [class.active]="selectedIconGroup === grp" (click)="selectedIconGroup = grp">{{ grp }}</button>
                    }
                  </div>

                  <!-- Grid de Ícones com Scroll -->
                  <div class="icons-grid-container">
                    @for (icon of filteredIcons; track icon.id) {
                      <button
                        type="button"
                        class="icon-select-card"
                        [class.selected]="catForm.iconKey === icon.id"
                        (click)="selectCatalogIcon(icon)"
                        [title]="icon.name">
                        <div class="icon-visual" [innerHTML]="getSafeSvg(icon.svg)"></div>
                        <span class="icon-name-label">{{ icon.name }}</span>
                        <span class="icon-kind-badge" [class.is-3d]="icon.type === '3d'">{{ icon.type === '3d' ? '3D' : '2D' }}</span>
                        @if (catForm.iconKey === icon.id) {
                          <div class="selected-indicator">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                        }
                      </button>
                    } @empty {
                      <div class="empty-icons-msg">
                        Nenhum ícone encontrado para "{{ iconSearchQuery }}". Tente outro termo.
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- MODO: IMAGEM PERSONALIZADA -->
              @if (catForm.mode === 'image') {
                <div class="custom-image-box">
                  <div class="form-field">
                    <label class="field-label-sm">URL da Imagem da Categoria</label>
                    <input type="url" [(ngModel)]="catForm.imageUrl" name="catImageUrl" placeholder="https://exemplo.com/minha-categoria.png" class="field-input" />
                  </div>
                  @if (catForm.imageUrl) {
                    <div class="custom-image-preview">
                      <img [src]="catForm.imageUrl" alt="Preview da Categoria" class="preview-img-thumb" (error)="onImageError($event)" />
                      <span class="preview-img-note">Prévia da imagem carregada</span>
                    </div>
                  }
                </div>
              }

              <!-- MODO: SEM ÍCONE -->
              @if (catForm.mode === 'none') {
                <div class="no-icon-box">
                  <div class="no-icon-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  </div>
                  <div class="no-icon-text">
                    <strong>Modo Somente Nome Ativo</strong>
                    <p>Esta categoria será exibida na vitrine e no cardápio público apenas com o texto de seu nome.</p>
                  </div>
                </div>
              }
            </div>

            <!-- FORMATO DE EXIBIÇÃO DA CATEGORIA -->
            <div class="form-field" style="margin-top: 14px;">
              <label class="field-label">Formato de Exibição no Cardápio</label>
              <div class="display-mode-selector">
                <button
                  type="button"
                  class="display-mode-btn"
                  [class.active]="catForm.displayMode === 'icon_text_side'"
                  (click)="catForm.displayMode = 'icon_text_side'">
                  <div class="display-mode-icon side">
                    <span class="mock-icon"></span>
                    <span class="mock-text"></span>
                  </div>
                  <span>Lado a Lado</span>
                </button>
                <button
                  type="button"
                  class="display-mode-btn"
                  [class.active]="catForm.displayMode === 'icon_text_stacked'"
                  (click)="catForm.displayMode = 'icon_text_stacked'">
                  <div class="display-mode-icon stacked">
                    <span class="mock-icon"></span>
                    <span class="mock-text"></span>
                  </div>
                  <span>Empilhado</span>
                </button>
                <button
                  type="button"
                  class="display-mode-btn"
                  [class.active]="catForm.displayMode === 'icon_only'"
                  (click)="catForm.displayMode = 'icon_only'">
                  <div class="display-mode-icon only">
                    <span class="mock-icon"></span>
                  </div>
                  <span>Apenas Ícone</span>
                </button>
              </div>
            </div>

            <!-- PRÉVIA AO VIVO DA CATEGORIA -->
            <div class="category-chip-live-preview">
              <span class="preview-header-label">Prévia de como aparecerá no Cardápio:</span>
              <div class="chip-preview-sample" [attr.data-display-mode]="catForm.displayMode">
                @if (catForm.displayMode !== 'icon_only' || catForm.mode !== 'none') {
                  @if (catForm.mode === 'catalog' && selectedIconSvg) {
                    <div class="sample-icon-svg" [innerHTML]="selectedIconSvg"></div>
                  } @else if (catForm.mode === 'image' && catForm.imageUrl) {
                    <img [src]="catForm.imageUrl" alt="Chip Icon" class="sample-icon-img" />
                  }
                }
                @if (catForm.displayMode !== 'icon_only') {
                  <span class="sample-chip-text">{{ catForm.name || 'Nome da Categoria' }}</span>
                }
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-ghost" (click)="showCategoryModal = false">Cancelar</button>
              <button type="submit" class="btn-cta primary">Salvar Categoria</button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Modal: Item -->
    @if (showItemModal) {
      <div class="modal-overlay" (click)="closeItemModal()">
        <div class="modal-card large" (click)="$event.stopPropagation()">
          <div class="modal-top">
            <h3 class="modal-title">{{ editingItemId ? 'Editar Produto' : 'Novo Produto' }}</h3>
            <button class="modal-close" (click)="closeItemModal()" aria-label="Fechar editor de produto">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <form (ngSubmit)="saveItem()">
            <div class="form-field">
              <label>Categoria</label>
              <select [(ngModel)]="itemForm.categoryId" name="itemCat" required class="field-input" (ngModelChange)="itemForm.subcategoryId = null">
                <option value="">Selecione...</option>
                @for (c of menuService.categories(); track c.id) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              </select>
            </div>
            @if (itemFormSubcategories.length > 0) {
              <div class="form-field">
                <label>Subcategoria</label>
                <select [(ngModel)]="itemForm.subcategoryId" name="itemSubcat" class="field-input">
                  <option [ngValue]="null">Nenhuma (raiz da categoria)</option>
                  @for (s of itemFormSubcategories; track s.id) {
                    <option [value]="s.id">{{ s.name }}</option>
                  }
                </select>
              </div>
            }
            <div class="form-field">
              <label>Nome do Produto</label>
              <input type="text" [(ngModel)]="itemForm.name" name="itemName" placeholder="Ex: Bacon Supreme Burger" required class="field-input" />
            </div>
            <div class="form-field">
              <label>Descrição</label>
              <textarea [(ngModel)]="itemForm.description" name="itemDesc" placeholder="Ingredientes, modo de preparo..." class="field-input field-textarea"></textarea>
            </div>
            <!-- Ativar / Desativar Preço -->
            <label class="checkbox-field" style="margin: 12px 0 6px 0;">
              <input type="checkbox" [(ngModel)]="itemForm.showPrice" name="itemShowPrice" />
              <span>Exibir preço no cardápio</span>
            </label>
            @if (!itemForm.showPrice) {
              <p style="font-size: 0.8rem; color: #F59E0B; margin: 0 0 14px 26px; line-height: 1.3;">
                Quando desativado, o produto exibirá "Consulte..." para os clientes.
              </p>
            }

            <div class="form-row" [style.opacity]="itemForm.showPrice ? '1' : '0.45'" [style.pointer-events]="itemForm.showPrice ? 'auto' : 'none'">
              <div class="form-field">
                <label>Preço Regular (R$)</label>
                <input type="number" step="0.01" [(ngModel)]="itemForm.price" name="itemPrice" [required]="itemForm.showPrice" class="field-input" />
              </div>
              <div class="form-field">
                <label>Preço Promocional (R$)</label>
                <input type="number" step="0.01" [(ngModel)]="itemForm.promotionalPrice" name="itemPromo" placeholder="Opcional" class="field-input" />
              </div>
            </div>

            <!-- Seção de Foto do Produto (Upload ou URL) -->
            <div class="form-field">
              <label class="field-label">Foto do Produto</label>
              <div class="mode-tabs">
                <button type="button" class="mode-tab" [class.active]="itemImageMode === 'upload'" (click)="itemImageMode = 'upload'">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Upload de Foto
                </button>
                <button type="button" class="mode-tab" [class.active]="itemImageMode === 'url'" (click)="itemImageMode = 'url'">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  Inserir Link / URL
                </button>
              </div>

              @if (itemImageMode === 'upload') {
                <div class="file-dropzone" (click)="productFileInput.click()">
                  <input #productFileInput type="file" accept="image/png, image/jpeg, image/webp, image/jpg" (change)="onItemFileSelected($event)" style="display: none" />
                  <div class="dropzone-content">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span class="dropzone-title">Clique para escolher uma imagem do seu dispositivo</span>
                    <span class="dropzone-subtitle">Formatos: JPG, PNG ou WebP (Máx. 5MB)</span>
                  </div>
                </div>
              } @else {
                <div class="url-input-wrap">
                  <input type="url" [(ngModel)]="itemForm.imageUrl" name="itemImageUrl" placeholder="https://images.unsplash.com/photo-..." class="field-input" />
                </div>
              }

              @if (itemForm.imageUrl) {
                <div class="item-img-preview-box">
                  <img [src]="itemForm.imageUrl" alt="Preview da Foto" class="item-img-preview" (error)="onImageError($event)" />
                  <div class="preview-info">
                    <span class="preview-status">Foto selecionada para o prato</span>
                    <button type="button" class="btn-remove-img" (click)="removeItemImage()">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      Remover Imagem
                    </button>
                  </div>
                </div>
              }
            </div>

            <app-product-video-uploader
              [itemId]="editingItemId"
              (busyChange)="videoUploadBlocksSave = $event"
              (onToast)="onToast.emit($event)">
            </app-product-video-uploader>

            <!-- Tipo de Destaque -->
            <div class="form-field">
              <label class="field-label">Tipo de Destaque</label>
              <div class="highlight-type-grid">
                <button type="button" class="highlight-card" [class.selected]="itemForm.highlightType === 'none'" (click)="itemForm.highlightType = 'none'">
                  <span class="hl-icon">—</span>
                  <span class="hl-label">Padrão</span>
                </button>
                <button type="button" class="highlight-card promo" [class.selected]="itemForm.highlightType === 'promotion'" (click)="itemForm.highlightType = 'promotion'">
                  <span class="hl-icon">🔥</span>
                  <span class="hl-label">Promoção</span>
                </button>
                <button type="button" class="highlight-card liked" [class.selected]="itemForm.highlightType === 'most_liked'" (click)="itemForm.highlightType = 'most_liked'">
                  <span class="hl-icon">❤️</span>
                  <span class="hl-label">+Curtidos</span>
                </button>
                <button type="button" class="highlight-card chef" [class.selected]="itemForm.highlightType === 'chef'" (click)="itemForm.highlightType = 'chef'">
                  <span class="hl-icon">⭐</span>
                  <span class="hl-label">Prato Chefe</span>
                </button>
                <button type="button" class="highlight-card combo" [class.selected]="itemForm.highlightType === 'combo'" (click)="itemForm.highlightType = 'combo'">
                  <span class="hl-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17 9l1 11a1.5 1.5 0 0 0 1.5 1.4h.8a1.5 1.5 0 0 0 1.5-1.4L23 9H17z"/>
                      <path d="M16.5 9h7"/><path d="M20 9V5l2-2"/>
                      <path d="M2 11c0-2.8 2.2-5 5-5s5 2.2 5 5H2z"/>
                      <path d="M1.5 14h11"/>
                      <path d="M2.5 17h9c0 1.8-1.5 3-3.2 3H5.7C4 20 2.5 18.8 2.5 17z"/>
                    </svg>
                  </span>
                  <span class="hl-label">Combo</span>
                </button>
                <button type="button" class="highlight-card best-seller" [class.selected]="itemForm.highlightType === 'best_seller'" (click)="itemForm.highlightType = 'best_seller'">
                  <span class="hl-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>
                    </svg>
                  </span>
                  <span class="hl-label">Mais Vendido</span>
                </button>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-ghost" (click)="closeItemModal()">Cancelar</button>
              <button type="submit" class="btn-cta primary" [disabled]="videoUploadBlocksSave">
                {{ videoUploadBlocksSave ? 'Finalize o vídeo' : 'Salvar Produto' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Modal: Ver Item (Visualização do Produto) -->
    @if (showViewItemModal && viewingItem) {
      <div class="modal-overlay" (click)="closeViewItemModal()">
        <div class="modal-card view-item-modal" (click)="$event.stopPropagation()">
          <div class="view-item-hero">
            @if (viewingItem.imageUrl) {
              <img [src]="viewingItem.imageUrl" [alt]="viewingItem.name" class="view-item-cover" />
            } @else {
              <div class="view-item-placeholder">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M12 2a9 9 0 0 0-9 9c0 4.17 2.84 7.67 6.69 8.69L12 22l2.31-2.31C18.16 18.67 21 15.17 21 11a9 9 0 0 0-9-9Z"/><circle cx="12" cy="11" r="3"/></svg>
                <span>Sem foto cadastrada</span>
              </div>
            }
            <button class="view-close-btn" (click)="closeViewItemModal()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            @if (viewingItem.isHighlighted) {
              <div class="view-badge-highlight">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Destaque
              </div>
            }
          </div>

          <div class="view-item-body">
            <div class="view-item-meta">
              <span class="view-item-cat">{{ viewingItem.categoryName || 'Sem Categoria' }}</span>
              <div class="view-status-pill" [class.active]="viewingItem.isAvailable">
                {{ viewingItem.isAvailable ? 'Ativo no Cardápio' : 'Pausado' }}
              </div>
            </div>

            <h2 class="view-item-title">{{ viewingItem.name }}</h2>
            <p class="view-item-desc">{{ viewingItem.description || 'Nenhum detalhe ou ingrediente informado para este produto.' }}</p>

            <div class="view-item-price-card">
              <span class="price-label">Preço:</span>
              <div class="prices-wrap">
                @if (viewingItem.showPrice === false) {
                  <span class="price-current" style="color: #F59E0B; font-style: italic;">Consulte...</span>
                } @else {
                  <span class="price-current">R$ {{ (viewingItem.promotionalPrice || viewingItem.price).toFixed(2) }}</span>
                  @if (viewingItem.promotionalPrice) {
                    <span class="price-original">R$ {{ viewingItem.price.toFixed(2) }}</span>
                    <span class="promo-badge">PROMOÇÃO</span>
                  }
                }
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-ghost" (click)="closeViewItemModal()">Fechar</button>
              <button type="button" class="btn-cta primary" (click)="openItemModal(viewingItem); closeViewItemModal()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                Editar Produto
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .menu-container {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .section-block {
      animation: sectionIn 0.5s calc(var(--i, 0) * 120ms) cubic-bezier(0.4, 0, 0.2, 1) both;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 18px;
    }
    .section-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.2rem;
      font-weight: 700;
      color: #FFFFFF;
      margin: 0;
    }
    .section-subtitle {
      font-size: 0.82rem;
      color: #71717A;
      margin: 4px 0 0 0;
    }

    /* ── Buttons ── */
    .btn-cta {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: transparent;
      border: 1px solid rgba(244, 123, 32, 0.35);
      color: #F47B20;
      padding: 9px 18px;
      border-radius: 12px;
      font-family: 'Inter', sans-serif;
      font-size: 0.84rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .btn-cta:hover {
      background: rgba(244, 123, 32, 0.08);
      border-color: #F47B20;
      transform: translateY(-1px);
    }
    .btn-cta.primary {
      background: linear-gradient(135deg, #F47B20 0%, #D26E2D 100%);
      border: none;
      color: #FFF;
      box-shadow: 0 4px 14px rgba(244, 123, 32, 0.25);
    }
    .btn-cta.primary:hover {
      box-shadow: 0 6px 20px rgba(244, 123, 32, 0.4);
      transform: translateY(-2px);
    }
    .btn-cta:disabled {
      opacity: 0.48;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }

    /* ── Category Chips ── */
    .categories-scroll {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding-bottom: 6px;
      scrollbar-width: thin;
      scrollbar-color: #3F3F46 transparent;
    }
    .categories-scroll::-webkit-scrollbar { height: 4px; }
    .categories-scroll::-webkit-scrollbar-thumb { background: #3F3F46; border-radius: 4px; }

    .cat-chip {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #1A1A1E;
      border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 9px 14px;
      border-radius: 14px;
      cursor: pointer;
      white-space: nowrap;
      font-family: 'Inter', sans-serif;
      color: #A1A1AA;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      animation: chipIn 0.35s cubic-bezier(0.4, 0, 0.2, 1) both;
      box-shadow: 4px 4px 10px rgba(0, 0, 0, 0.25), -2px -2px 6px rgba(255, 255, 255, 0.02);
    }
    .cat-chip:hover {
      background: #222226;
      border-color: rgba(244, 123, 32, 0.2);
    }
    .cat-chip.active {
      background: linear-gradient(135deg, rgba(244, 123, 32, 0.12), rgba(244, 123, 32, 0.06));
      border-color: rgba(244, 123, 32, 0.4);
      color: #F47B20;
      box-shadow: 0 0 16px rgba(244, 123, 32, 0.12), 4px 4px 10px rgba(0, 0, 0, 0.25);
    }

    .chip-icon {
      width: 30px;
      height: 30px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.04);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cat-chip.active .chip-icon {
      background: rgba(244, 123, 32, 0.2);
      color: #F47B20;
    }

    .chip-label {
      font-size: 0.86rem;
      font-weight: 600;
    }
    .chip-count {
      font-size: 0.72rem;
      background: rgba(255, 255, 255, 0.05);
      padding: 2px 7px;
      border-radius: 8px;
    }

    .chip-actions {
      display: flex;
      gap: 4px;
      margin-left: 4px;
    }
    .chip-action-btn {
      background: transparent;
      border: none;
      color: #52525B;
      cursor: pointer;
      padding: 3px;
      border-radius: 4px;
      display: flex;
      transition: color 0.15s;
    }
    .chip-action-btn:hover { color: #F47B20; }
    .chip-action-btn.danger:hover { color: #EF4444; }

    /* ── Products Grid ── */
    .products-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 16px;
    }

    .product-card {
      background: #1A1A1E;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 20px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      position: relative;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      animation: productIn 0.4s calc(var(--pi, 0) * 60ms + 200ms) cubic-bezier(0.4, 0, 0.2, 1) both;
      box-shadow:
        6px 6px 14px rgba(0, 0, 0, 0.35),
        -3px -3px 10px rgba(255, 255, 255, 0.02),
        inset 1px 1px 2px rgba(255, 255, 255, 0.04);
    }
    .product-card:hover {
      transform: translateY(-4px);
      border-color: rgba(244, 123, 32, 0.2);
      box-shadow:
        8px 8px 20px rgba(0, 0, 0, 0.45),
        -4px -4px 12px rgba(255, 255, 255, 0.03),
        inset 1px 1px 2px rgba(255, 255, 255, 0.05);
    }
    .product-card.paused {
      opacity: 0.5;
    }

    .product-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(244, 123, 32, 0.12);
      color: #F47B20;
      font-size: 0.68rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 10px;
    }

    .product-avatar {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(244, 123, 32, 0.08), rgba(244, 123, 32, 0.03));
      color: #F47B20;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 8px 0 16px 0;
      overflow: hidden;
      box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    .product-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .product-info {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .product-name {
      font-family: 'Outfit', sans-serif;
      font-size: 1rem;
      font-weight: 700;
      color: #FFF;
      margin: 0;
    }
    .product-category {
      font-size: 0.74rem;
      color: #52525B;
      margin-top: 3px;
    }
    .product-desc {
      font-size: 0.78rem;
      color: #71717A;
      margin: 8px 0 14px 0;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 32px;
    }

    .product-pricing {
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .price-main {
      font-family: 'Outfit', sans-serif;
      font-size: 1.15rem;
      font-weight: 700;
      color: #F47B20;
    }
    .price-promo {
      font-size: 0.82rem;
      text-decoration: line-through;
      color: #52525B;
    }

    .product-actions-bar {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 12px;
    }

    .status-tag {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      transition: all 0.2s;
      background: rgba(239, 68, 68, 0.12);
      color: #EF4444;
    }
    .status-tag.active {
      background: rgba(34, 197, 94, 0.12);
      color: #22C55E;
    }

    .action-btns {
      display: flex;
      gap: 6px;
    }
    .action-btn {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
      color: #71717A;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }
    .action-btn:hover {
      color: #FFF;
      background: rgba(255, 255, 255, 0.08);
    }
    .action-btn.danger:hover {
      background: rgba(239, 68, 68, 0.15);
      color: #EF4444;
    }

    /* ── Empty State ── */
    .empty-state {
      grid-column: 1 / -1;
      padding: 48px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      background: #1A1A1E;
      border: 1px dashed rgba(255, 255, 255, 0.08);
      border-radius: 20px;
    }
    .empty-icon { color: #3F3F46; }
    .empty-text { font-size: 0.88rem; color: #52525B; margin: 0; }

    /* ── Modals (Deslizante & Responsivo) ── */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease;
      padding: 24px 16px;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .modal-card {
      background: #1E1E22;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 22px;
      padding: 26px 24px 20px;
      width: 100%;
      max-width: 480px;
      max-height: min(90vh, 840px);
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7);
      animation: modalIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      margin: auto;
      overflow: hidden;
    }
    .modal-card.large { max-width: 600px; }
    .modal-card.category-modal { max-width: 540px; }

    .modal-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-shrink: 0;
    }

    .modal-card form {
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      flex: 1;
      padding-right: 6px;
      scrollbar-width: thin;
      scrollbar-color: rgba(244, 123, 32, 0.35) transparent;
    }
    .modal-card form::-webkit-scrollbar {
      width: 6px;
    }
    .modal-card form::-webkit-scrollbar-track {
      background: transparent;
    }
    .modal-card form::-webkit-scrollbar-thumb {
      background: rgba(244, 123, 32, 0.35);
      border-radius: 4px;
    }
    .modal-card form::-webkit-scrollbar-thumb:hover {
      background: rgba(244, 123, 32, 0.7);
    }
    .modal-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.2rem;
      font-weight: 700;
      color: #FFF;
      margin: 0;
    }
    .modal-close {
      background: none;
      border: none;
      color: #52525B;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      transition: color 0.15s;
    }
    .modal-close:hover { color: #F47B20; }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 16px;
    }
    .form-field label {
      font-size: 0.82rem;
      font-weight: 600;
      color: #A1A1AA;
      font-family: 'Inter', sans-serif;
    }
    .field-input {
      background: #141416;
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 12px;
      padding: 11px 14px;
      color: #FFF;
      font-family: 'Inter', sans-serif;
      font-size: 0.9rem;
      outline: none;
      transition: all 0.2s;
      width: 100%;
      box-sizing: border-box;
    }
    .field-input:focus {
      border-color: rgba(244, 123, 32, 0.5);
      box-shadow: 0 0 0 3px rgba(244, 123, 32, 0.1);
    }
    .field-input::placeholder { color: #3F3F46; }
    select.field-input { cursor: pointer; }
    .field-textarea {
      resize: vertical;
      min-height: 80px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .checkbox-field {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 16px 0;
      font-size: 0.88rem;
      color: #D4D4D8;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
    }
    .checkbox-field input[type="checkbox"] {
      accent-color: #F47B20;
      width: 16px;
      height: 16px;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 20px;
      padding-top: 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      flex-shrink: 0;
    }
    .btn-ghost {
      background: rgba(255, 255, 255, 0.05);
      border: none;
      color: #A1A1AA;
      padding: 10px 18px;
      border-radius: 12px;
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      font-size: 0.86rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-ghost:hover { background: rgba(255, 255, 255, 0.08); color: #FFF; }

    /* ── Animations ── */
    @keyframes sectionIn {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes chipIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes productIn {
      from { opacity: 0; transform: translateY(20px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.95) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    /* ── Responsive ── */
    @media (max-width: 640px) {
      .products-grid {
        grid-template-columns: 1fr;
      }
      .section-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }
      .form-row {
        grid-template-columns: 1fr;
      }
    }

    /* ── Category Modal & Icon Selector ── */
    .category-modal {
      max-width: 620px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 24px;
    }
    .category-form {
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      gap: 16px;
      padding-right: 4px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
    .field-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #D4D4D8;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 6px;
    }
    .req { color: #F47B20; }
    .mode-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      background: #121214;
      padding: 4px;
      border-radius: 12px;
      margin-bottom: 12px;
    }
    .mode-tab {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: none;
      border: none;
      color: #71717A;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 8px 10px;
      border-radius: 9px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .mode-tab:hover { color: #E4E4E7; }
    .mode-tab.active {
      background: rgba(244, 123, 32, 0.15);
      color: #F47B20;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .catalog-picker-box {
      background: #141417;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .catalog-toolbar {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .search-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .search-input-wrap svg {
      position: absolute;
      left: 12px;
      color: #71717A;
    }
    .catalog-search-input {
      width: 100%;
      background: #1A1A1E;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 8px 32px 8px 36px;
      color: #FFF;
      font-size: 0.82rem;
      outline: none;
      box-sizing: border-box;
    }
    .catalog-search-input:focus {
      border-color: #F47B20;
    }
    .clear-search-btn {
      position: absolute;
      right: 10px;
      background: none;
      border: none;
      color: #71717A;
      cursor: pointer;
      font-size: 0.8rem;
    }
    .type-filter-group {
      display: flex;
      gap: 6px;
    }
    .type-btn {
      flex: 1;
      background: #1E1E22;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      color: #A1A1AA;
      font-size: 0.76rem;
      font-weight: 600;
      padding: 6px 10px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .type-btn.active {
      background: #F47B20;
      color: #FFF;
      border-color: #F47B20;
    }
    .groups-filter-scroll {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: none;
    }
    .grp-chip {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 20px;
      color: #A1A1AA;
      font-size: 0.72rem;
      padding: 3px 10px;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.15s;
    }
    .grp-chip.active {
      background: rgba(244, 123, 32, 0.2);
      border-color: rgba(244, 123, 32, 0.4);
      color: #F47B20;
    }
    .icons-grid-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 10px;
      max-height: 220px;
      overflow-y: auto;
      padding: 4px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
    }
    .icon-select-card {
      background: #1C1C20;
      border: 1.5px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 10px 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      position: relative;
      transition: all 0.2s;
    }
    .icon-select-card:hover {
      border-color: rgba(244, 123, 32, 0.4);
      transform: translateY(-2px);
      background: #24242A;
    }
    .icon-select-card.selected {
      border-color: #F47B20;
      background: rgba(244, 123, 32, 0.1);
      box-shadow: 0 0 12px rgba(244, 123, 32, 0.2);
    }
    .icon-visual {
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon-visual svg {
      width: 100%;
      height: 100%;
    }
    .icon-name-label {
      font-size: 0.68rem;
      color: #D4D4D8;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 90px;
    }
    .icon-kind-badge {
      font-size: 0.58rem;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.08);
      color: #A1A1AA;
    }
    .icon-kind-badge.is-3d {
      background: linear-gradient(135deg, #F47B20, #E11D48);
      color: #FFF;
    }
    .selected-indicator {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 16px;
      height: 16px;
      background: #F47B20;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFF;
    }
    .empty-icons-msg {
      grid-column: 1 / -1;
      padding: 24px;
      text-align: center;
      color: #71717A;
      font-size: 0.8rem;
    }
    .custom-image-box {
      background: #141417;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 16px;
    }
    .custom-image-preview {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 10px;
    }
    .preview-img-thumb {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      object-fit: cover;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .preview-img-note {
      font-size: 0.78rem;
      color: #A1A1AA;
    }
    .no-icon-box {
      display: flex;
      align-items: center;
      gap: 14px;
      background: #141417;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 16px;
    }
    .no-icon-icon {
      color: #F47B20;
    }
    .no-icon-text strong {
      display: block;
      font-size: 0.85rem;
      color: #FFF;
      margin-bottom: 2px;
    }
    .no-icon-text p {
      font-size: 0.78rem;
      color: #71717A;
      margin: 0;
    }
    .category-chip-live-preview {
      background: rgba(255, 255, 255, 0.02);
      border: 1px dashed rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .preview-header-label {
      font-size: 0.74rem;
      color: #71717A;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .chip-preview-sample {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      align-self: flex-start;
      background: rgba(244, 123, 32, 0.1);
      border: 1px solid rgba(244, 123, 32, 0.3);
      padding: 6px 14px;
      border-radius: 20px;
    }
    .sample-icon-svg {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sample-icon-svg svg {
      width: 100%;
      height: 100%;
    }
    .sample-icon-img {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      object-fit: cover;
    }
    .sample-chip-text {
      font-size: 0.86rem;
      font-weight: 700;
      color: #FFF;
    }
    .chip-preview-sample[data-display-mode="icon_text_stacked"] {
      flex-direction: column;
      padding: 8px 12px;
      border-radius: 14px;
      text-align: center;
      gap: 4px;
    }
    .chip-preview-sample[data-display-mode="icon_only"] {
      padding: 8px;
      border-radius: 50%;
    }
    .display-mode-selector {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 6px;
    }
    .display-mode-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 10px 8px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      color: #A1A1AA;
      font-size: 0.78rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .display-mode-btn:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.15);
      color: #FFF;
    }
    .display-mode-btn.active {
      background: rgba(244, 123, 32, 0.12);
      border-color: #F47B20;
      color: #F47B20;
      font-weight: 600;
    }
    .display-mode-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 20px;
      gap: 4px;
    }
    .display-mode-icon.stacked {
      flex-direction: column;
      gap: 2px;
    }
    .mock-icon {
      width: 12px;
      height: 12px;
      border-radius: 3px;
      background: currentColor;
      opacity: 0.8;
    }
    .mock-text {
      width: 18px;
      height: 4px;
      border-radius: 2px;
      background: currentColor;
      opacity: 0.5;
    }
    .chip-icon.svg-wrap {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .chip-icon.svg-wrap svg {
      width: 100%;
      height: 100%;
    }
    .chip-custom-img {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      object-fit: cover;
    }

    .product-avatar.clickable {
      cursor: pointer;
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease;
    }
    .product-avatar.clickable:hover {
      transform: scale(1.08);
      box-shadow: 0 0 16px rgba(244, 123, 32, 0.4);
    }

    /* ── Item Image Upload & Preview ── */
    .file-dropzone {
      border: 2px dashed rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      padding: 24px 16px;
      text-align: center;
      background: rgba(255, 255, 255, 0.02);
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 8px;
    }
    .file-dropzone:hover {
      border-color: #F47B20;
      background: rgba(244, 123, 32, 0.04);
    }
    .dropzone-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: #71717A;
    }
    .dropzone-content svg {
      color: #F47B20;
    }
    .dropzone-title {
      font-size: 0.88rem;
      font-weight: 600;
      color: #EDEDED;
    }
    .dropzone-subtitle {
      font-size: 0.74rem;
      color: #71717A;
    }
    .url-input-wrap {
      margin-top: 8px;
    }
    .item-img-preview-box {
      margin-top: 12px;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 14px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
    }
    .item-img-preview {
      width: 58px;
      height: 58px;
      border-radius: 10px;
      object-fit: cover;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    .preview-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }
    .preview-status {
      font-size: 0.78rem;
      font-weight: 600;
      color: #A1A1AA;
    }
    .btn-remove-img {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 6px;
      color: #EF4444;
      font-size: 0.74rem;
      font-weight: 600;
      cursor: pointer;
      width: fit-content;
      transition: background 0.15s ease;
    }
    .btn-remove-img:hover {
      background: rgba(239, 68, 68, 0.22);
    }

    /* ── View Item Modal ── */
    .view-item-modal {
      max-width: 480px;
      padding: 0;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.7);
    }
    .view-item-hero {
      position: relative;
      width: 100%;
      height: 220px;
      background: #121214;
      overflow: hidden;
    }
    .view-item-cover {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .view-item-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #52525B;
      font-size: 0.8rem;
    }
    .view-close-btn {
      position: absolute;
      top: 14px;
      right: 14px;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #FFF;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.15s ease, background 0.15s ease;
      z-index: 2;
    }
    .view-close-btn:hover {
      background: rgba(0, 0, 0, 0.85);
      transform: scale(1.05);
    }
    .view-badge-highlight {
      position: absolute;
      bottom: 14px;
      left: 14px;
      background: linear-gradient(135deg, #F47B20, #E06010);
      color: #FFF;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 5px;
      box-shadow: 0 4px 12px rgba(244, 123, 32, 0.4);
      z-index: 2;
    }
    .view-item-body {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .view-item-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .view-item-cat {
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #F47B20;
    }
    .view-status-pill {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(239, 68, 68, 0.12);
      color: #EF4444;
      border: 1px solid rgba(239, 68, 68, 0.25);
    }
    .view-status-pill.active {
      background: rgba(34, 197, 94, 0.12);
      color: #22C55E;
      border-color: rgba(34, 197, 94, 0.25);
    }
    .view-item-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.4rem;
      font-weight: 700;
      color: #EDEDED;
      margin: 0;
      line-height: 1.3;
    }
    .view-item-desc {
      font-size: 0.88rem;
      color: #A1A1AA;
      line-height: 1.55;
      margin: 0;
    }
    .view-item-price-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .price-label {
      font-size: 0.82rem;
      color: #71717A;
      font-weight: 600;
    }
    .prices-wrap {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .price-current {
      font-family: 'Outfit', sans-serif;
      font-size: 1.25rem;
      font-weight: 800;
      color: #22C55E;
    }
    .price-original {
      font-size: 0.88rem;
      color: #71717A;
      text-decoration: line-through;
    }
    .promo-badge {
      font-size: 0.65rem;
      font-weight: 800;
      background: rgba(244, 123, 32, 0.15);
      color: #F47B20;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid rgba(244, 123, 32, 0.3);
    }

    /* Subcategories Section */
    .subcategories-section {
      background: rgba(24, 24, 27, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 20px;
      backdrop-filter: blur(12px);
      margin-bottom: 24px;
    }
    .subcat-add-row {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-bottom: 12px;
    }
    .subcat-input {
      flex: 1;
      height: 42px;
    }
    .subcat-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .subcat-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      transition: border-color 0.2s, background 0.2s;
    }
    .subcat-item:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.12);
    }
    .subcat-order {
      font-size: 0.75rem;
      font-weight: 800;
      color: #71717A;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .subcat-name {
      font-weight: 600;
      font-size: 0.92rem;
      color: #F4F4F5;
      flex: 1;
    }
    .subcat-edit-input {
      flex: 1;
      height: 36px;
      padding: 4px 10px;
      font-size: 0.88rem;
    }
    .subcat-actions {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .subcat-action-btn {
      width: 30px;
      height: 30px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.04);
      color: #A1A1AA;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      transition: all 0.2s;
    }
    .subcat-action-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
      color: #FFF;
      border-color: rgba(255, 255, 255, 0.2);
    }
    .subcat-action-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .subcat-action-btn.save {
      background: rgba(34, 197, 94, 0.15);
      border-color: rgba(34, 197, 94, 0.3);
      color: #22C55E;
    }
    .subcat-action-btn.save:hover {
      background: rgba(34, 197, 94, 0.25);
    }
    .subcat-action-btn.danger:hover {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.3);
      color: #EF4444;
    }

    /* Highlight Types Grid */
    .highlight-type-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 6px;
    }
    @media (max-width: 640px) {
      .highlight-type-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    .highlight-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 12px 8px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      cursor: pointer;
      transition: all 0.2s ease;
      user-select: none;
    }
    .highlight-card:hover {
      border-color: rgba(255, 255, 255, 0.18);
      background: rgba(255, 255, 255, 0.06);
    }
    .highlight-card .hl-icon {
      font-size: 1.35rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .highlight-card .hl-label {
      font-size: 0.76rem;
      font-weight: 600;
      color: #A1A1AA;
      text-align: center;
    }
    .highlight-card.selected {
      border-color: #71717A;
      background: rgba(255, 255, 255, 0.08);
    }
    .highlight-card.selected .hl-label {
      color: #FFF;
    }
    .highlight-card.selected.promo {
      border-color: #F97316;
      background: rgba(249, 115, 22, 0.15);
      box-shadow: 0 0 12px rgba(249, 115, 22, 0.25);
    }
    .highlight-card.selected.promo .hl-label {
      color: #FB923C;
    }
    .highlight-card.selected.liked {
      border-color: #EC4899;
      background: rgba(236, 72, 153, 0.15);
      box-shadow: 0 0 12px rgba(236, 72, 153, 0.25);
    }
    .highlight-card.selected.liked .hl-label {
      color: #F472B6;
    }
    .highlight-card.selected.chef {
      border-color: #EAB308;
      background: rgba(234, 179, 8, 0.15);
      box-shadow: 0 0 12px rgba(234, 179, 8, 0.25);
    }
    .highlight-card.selected.chef .hl-label {
      color: #FACC15;
    }
    .highlight-card.selected.combo {
      border-color: #38BDF8;
      background: rgba(56, 189, 248, 0.15);
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.25);
      color: #38BDF8;
    }
    .highlight-card.selected.combo .hl-label {
      color: #38BDF8;
    }
    .highlight-card.selected.best-seller {
      border-color: #10B981;
      background: rgba(16, 185, 129, 0.15);
      box-shadow: 0 0 12px rgba(16, 185, 129, 0.25);
      color: #10B981;
    }
    .highlight-card.selected.best-seller .hl-label {
      color: #34D399;
    }

    /* Highlight Badges on Product Card */
    .product-badge[data-hl="promotion"] {
      background: rgba(249, 115, 22, 0.18);
      border-color: rgba(249, 115, 22, 0.4);
      color: #FB923C;
    }
    .product-badge[data-hl="most_liked"] {
      background: rgba(236, 72, 153, 0.18);
      border-color: rgba(236, 72, 153, 0.4);
      color: #F472B6;
    }
    .product-badge[data-hl="chef"] {
      background: rgba(234, 179, 8, 0.18);
      border-color: rgba(234, 179, 8, 0.4);
      color: #FACC15;
    }
    .product-badge[data-hl="combo"] {
      background: rgba(56, 189, 248, 0.18);
      border-color: rgba(56, 189, 248, 0.4);
      color: #38BDF8;
    }
    .product-badge[data-hl="best_seller"] {
      background: rgba(16, 185, 129, 0.18);
      border-color: rgba(16, 185, 129, 0.4);
      color: #34D399;
    }

    .reorder-btn {
      font-size: 0.65rem;
      font-weight: 800;
    }

    @media (prefers-reduced-motion: reduce) {
      .section-block, .cat-chip, .product-card, .modal-overlay, .modal-card {
        animation: none !important;
      }
    }
  `]
})
export class MenuEditorComponent implements OnInit {
  @Output() onToast = new EventEmitter<string>();

  selectedCategoryId: string | null = null;
  searchQuery = '';

  // Icon catalog
  iconGroups = ICON_GROUPS;
  iconFilterType: 'all' | '2d' | '3d' = 'all';
  iconSearchQuery = '';
  selectedIconGroup = 'all';

  // Modal state
  showCategoryModal = false;
  editingCategoryId: string | null = null;
  catForm = {
    name: '',
    mode: 'catalog' as 'catalog' | 'image' | 'none',
    iconType: '2d' as '2d' | '3d',
    iconKey: '2d-burger' as string | null,
    imageUrl: '',
    displayMode: 'icon_text_side' as 'icon_text_side' | 'icon_text_stacked' | 'icon_only'
  };

  showViewItemModal = false;
  viewingItem: MenuItem | null = null;
  itemImageMode: 'upload' | 'url' = 'upload';

  // Subcategories
  newSubcategoryName = '';
  editingSubcategoryId: string | null = null;
  editingSubcategoryName = '';

  showItemModal = false;
  editingItemId: string | null = null;
  videoUploadBlocksSave = false;
  itemForm = {
    categoryId: '',
    subcategoryId: null as string | null,
    name: '',
    description: '',
    price: 0,
    promotionalPrice: null as number | null,
    imageUrl: null as string | null,
    isHighlighted: false,
    highlightType: 'none' as 'none' | 'promotion' | 'most_liked' | 'chef' | 'combo' | 'best_seller',
    showPrice: true
  };

  constructor(
    public menuService: MenuService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.menuService.loadSubcategories().subscribe();
  }

  get filteredIcons(): CatalogIcon[] {
    let list = ICON_CATALOG;
    if (this.iconFilterType !== 'all') {
      list = list.filter(i => i.type === this.iconFilterType);
    }
    if (this.selectedIconGroup !== 'all') {
      list = list.filter(i => i.group === this.selectedIconGroup);
    }
    if (this.iconSearchQuery.trim()) {
      const q = this.iconSearchQuery.toLowerCase().trim();
      list = list.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  }

  get selectedIconSvg(): SafeHtml | null {
    if (!this.catForm.iconKey) return null;
    const icon = findCatalogIcon(this.catForm.iconKey);
    return icon ? this.sanitizer.bypassSecurityTrustHtml(icon.svg) : null;
  }

  getSafeSvg(svgStr: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svgStr);
  }

  getCategoryIconSvg(cat: Category): SafeHtml | null {
    if (cat.iconType === 'none') return null;
    const icon = findCatalogIcon(cat.iconKey || cat.icon);
    return icon ? this.sanitizer.bypassSecurityTrustHtml(icon.svg) : null;
  }

  setCategoryMode(mode: 'catalog' | 'image' | 'none'): void {
    this.catForm.mode = mode;
  }

  selectCatalogIcon(icon: CatalogIcon): void {
    this.catForm.iconKey = icon.id;
    this.catForm.iconType = icon.type;
  }

  onImageError(event: Event): void {
    (event.target as HTMLElement).style.display = 'none';
  }

  get filteredItems(): MenuItem[] {
    let list = this.menuService.items();
    if (this.selectedCategoryId) {
      list = list.filter(i => i.categoryId === this.selectedCategoryId);
    }
    return [...list].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  get categorySubcategories(): Subcategory[] {
    if (!this.selectedCategoryId) return [];
    return this.menuService.subcategories()
      .filter(s => s.categoryId === this.selectedCategoryId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  get itemFormSubcategories(): Subcategory[] {
    if (!this.itemForm.categoryId) return [];
    return this.menuService.subcategories()
      .filter(s => s.categoryId === this.itemForm.categoryId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  getHighlightLabel(type?: string): string {
    switch (type) {
      case 'promotion': return '🔥 Promoção';
      case 'most_liked': return '❤️ +Curtidos';
      case 'chef': return '⭐ Prato Chefe';
      case 'combo': return 'Combo';
      case 'best_seller': return 'Mais Vendido';
      default: return '';
    }
  }

  getSubcategoryName(subId: string): string {
    const sub = this.menuService.subcategories().find(s => s.id === subId);
    return sub ? sub.name : '';
  }

  filterBy(catId: string | null): void {
    this.selectedCategoryId = catId;
  }

  // ── Categories ──
  openCategoryModal(cat?: Category): void {
    this.editingCategoryId = cat?.id || null;
    this.iconSearchQuery = '';
    this.iconFilterType = 'all';
    this.selectedIconGroup = 'all';

    if (cat) {
      let mode: 'catalog' | 'image' | 'none' = 'catalog';
      if (cat.iconType === 'none') mode = 'none';
      else if (cat.iconType === 'image') mode = 'image';

      this.catForm = {
        name: cat.name || '',
        mode,
        iconType: cat.iconType === '3d' ? '3d' : '2d',
        iconKey: cat.iconKey || cat.icon || '2d-burger',
        imageUrl: cat.imageUrl || '',
        displayMode: cat.displayMode || 'icon_text_side'
      };
    } else {
      this.catForm = {
        name: '',
        mode: 'catalog',
        iconType: '3d',
        iconKey: '3d-burger',
        imageUrl: '',
        displayMode: 'icon_text_side'
      };
    }
    this.showCategoryModal = true;
  }

  saveCategory(): void {
    if (!this.catForm.name || !this.catForm.name.trim()) {
      this.onToast.emit('Informe o nome da categoria.');
      return;
    }

    const payload: Partial<Category> = {
      name: this.catForm.name.trim(),
      iconType: this.catForm.mode === 'none' ? 'none' : (this.catForm.mode === 'image' ? 'image' : this.catForm.iconType),
      iconKey: this.catForm.mode === 'catalog' ? this.catForm.iconKey : null,
      imageUrl: this.catForm.mode === 'image' ? (this.catForm.imageUrl || null) : null,
      displayMode: this.catForm.displayMode,
      isActive: true
    };

    if (this.editingCategoryId) {
      this.menuService.updateCategory(this.editingCategoryId, payload).subscribe(() => {
        this.menuService.loadCategories().subscribe();
        this.showCategoryModal = false;
        this.onToast.emit('Categoria atualizada com sucesso!');
      });
    } else {
      this.menuService.createCategory(payload).subscribe(() => {
        this.menuService.loadCategories().subscribe();
        this.showCategoryModal = false;
        this.onToast.emit('Categoria criada com sucesso!');
      });
    }
  }

  deleteCategory(id: string): void {
    if (confirm('Deseja excluir esta categoria?')) {
      this.menuService.deleteCategory(id).subscribe(() => {
        this.menuService.loadCategories().subscribe();
        this.menuService.loadItems().subscribe();
        this.onToast.emit('Categoria excluída.');
      });
    }
  }

  // ── Items ──
  openViewItemModal(item: MenuItem): void {
    this.viewingItem = item;
    this.showViewItemModal = true;
  }

  closeViewItemModal(): void {
    this.showViewItemModal = false;
    this.viewingItem = null;
  }

  onItemFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      this.onToast.emit('Formato inválido. Selecione uma imagem JPG, PNG ou WebP.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.onToast.emit('A imagem selecionada excede o limite de 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDimension = 1200;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          this.itemForm.imageUrl = canvas.toDataURL('image/jpeg', 0.85);
          this.onToast.emit('Foto carregada e otimizada com sucesso!');
        } else {
          this.itemForm.imageUrl = reader.result as string;
          this.onToast.emit('Foto carregada com sucesso!');
        }
      };
      img.onerror = () => {
        this.itemForm.imageUrl = reader.result as string;
        this.onToast.emit('Foto carregada com sucesso!');
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeItemImage(): void {
    this.itemForm.imageUrl = null;
  }

  openItemModal(item?: MenuItem): void {
    this.videoUploadBlocksSave = false;
    if (item) {
      this.editingItemId = item.id;
      this.itemImageMode = item.imageUrl && item.imageUrl.startsWith('data:') ? 'upload' : (item.imageUrl ? 'url' : 'upload');
      this.itemForm = {
        categoryId: item.categoryId,
        subcategoryId: item.subcategoryId || null,
        name: item.name,
        description: item.description || '',
        price: item.price,
        promotionalPrice: item.promotionalPrice || null,
        imageUrl: item.imageUrl || null,
        isHighlighted: item.isHighlighted,
        highlightType: item.highlightType || 'none',
        showPrice: item.showPrice !== false
      };
    } else {
      this.editingItemId = null;
      this.itemImageMode = 'upload';
      this.itemForm = {
        categoryId: this.selectedCategoryId || this.menuService.categories()[0]?.id || '',
        subcategoryId: null,
        name: '',
        description: '',
        price: 0,
        promotionalPrice: null,
        imageUrl: null,
        isHighlighted: false,
        highlightType: 'none',
        showPrice: true
      };
    }
    this.showItemModal = true;
  }

  closeItemModal(): void {
    if (this.videoUploadBlocksSave) {
      this.onToast.emit('Conclua ou cancele o envio do vídeo antes de fechar.');
      return;
    }
    this.showItemModal = false;
  }

  saveItem(): void {
    if (this.videoUploadBlocksSave) {
      this.onToast.emit('Conclua ou cancele o envio do vídeo antes de salvar.');
      return;
    }
    if (!this.itemForm.name || !this.itemForm.categoryId || (this.itemForm.showPrice && this.itemForm.price <= 0)) {
      this.onToast.emit('Preencha nome, categoria e preço válido.');
      return;
    }
    this.itemForm.isHighlighted = this.itemForm.highlightType !== 'none';
    if (this.editingItemId) {
      this.menuService.updateItem(this.editingItemId, this.itemForm).subscribe({
        next: () => {
          this.menuService.loadItems().subscribe();
          this.showItemModal = false;
          this.onToast.emit('Produto atualizado com sucesso!');
        },
        error: (err) => {
          console.error('[MenuEditor] Erro ao atualizar produto:', err);
          const msg = err?.error?.error?.message || 'Erro ao atualizar produto. Verifique a imagem ou conexão.';
          this.onToast.emit(msg);
        }
      });
    } else {
      this.menuService.createItem(this.itemForm).subscribe({
        next: () => {
          this.menuService.loadItems().subscribe();
          this.showItemModal = false;
          this.onToast.emit('Produto adicionado com sucesso!');
        },
        error: (err) => {
          console.error('[MenuEditor] Erro ao criar produto:', err);
          const msg = err?.error?.error?.message || 'Erro ao adicionar produto. Verifique a imagem ou conexão.';
          this.onToast.emit(msg);
        }
      });
    }
  }

  toggleAvailability(id: string): void {
    this.menuService.toggleItemAvailability(id).subscribe(() => {
      this.menuService.loadItems().subscribe();
      this.onToast.emit('Disponibilidade atualizada!');
    });
  }

  deleteItem(id: string): void {
    if (confirm('Remover este produto do cardápio?')) {
      this.menuService.deleteItem(id).subscribe(() => {
        this.menuService.loadItems().subscribe();
        this.onToast.emit('Produto removido.');
      });
    }
  }

  // ── Subcategories ──
  addSubcategory(): void {
    if (!this.newSubcategoryName.trim() || !this.selectedCategoryId) return;
    const maxOrder = this.categorySubcategories.reduce((max, s) => Math.max(max, s.displayOrder), 0);
    this.menuService.createSubcategory({
      categoryId: this.selectedCategoryId,
      name: this.newSubcategoryName.trim(),
      displayOrder: maxOrder + 1
    }).subscribe(() => {
      this.menuService.loadSubcategories().subscribe();
      this.newSubcategoryName = '';
      this.onToast.emit('Subcategoria criada!');
    });
  }

  startEditSubcategory(sub: Subcategory): void {
    this.editingSubcategoryId = sub.id;
    this.editingSubcategoryName = sub.name;
  }

  saveEditSubcategory(sub: Subcategory): void {
    if (!this.editingSubcategoryName.trim()) return;
    this.menuService.updateSubcategory(sub.id, { name: this.editingSubcategoryName.trim() }).subscribe(() => {
      this.menuService.loadSubcategories().subscribe();
      this.editingSubcategoryId = null;
      this.onToast.emit('Subcategoria atualizada!');
    });
  }

  cancelEditSubcategory(): void {
    this.editingSubcategoryId = null;
  }

  deleteSubcategory(id: string): void {
    if (confirm('Excluir esta subcategoria? Os itens dela ficarão sem subcategoria.')) {
      this.menuService.deleteSubcategory(id).subscribe(() => {
        this.menuService.loadSubcategories().subscribe();
        this.menuService.loadItems().subscribe();
        this.onToast.emit('Subcategoria excluída.');
      });
    }
  }

  moveSubcategory(sub: Subcategory, direction: 'up' | 'down'): void {
    const subs = [...this.categorySubcategories];
    const idx = subs.findIndex(s => s.id === sub.id);
    if (direction === 'up' && idx > 0) {
      [subs[idx], subs[idx - 1]] = [subs[idx - 1], subs[idx]];
    } else if (direction === 'down' && idx < subs.length - 1) {
      [subs[idx], subs[idx + 1]] = [subs[idx + 1], subs[idx]];
    } else {
      return;
    }
    const orders = subs.map((s, i) => ({ id: s.id, displayOrder: i + 1 }));
    this.menuService.reorderSubcategories(orders).subscribe(() => {
      this.menuService.loadSubcategories().subscribe();
    });
  }

  moveItem(item: MenuItem, direction: 'up' | 'down'): void {
    const items = [...this.filteredItems];
    const idx = items.findIndex(i => i.id === item.id);
    if (direction === 'up' && idx > 0) {
      [items[idx], items[idx - 1]] = [items[idx - 1], items[idx]];
    } else if (direction === 'down' && idx < items.length - 1) {
      [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
    } else {
      return;
    }
    const orders = items.map((it, i) => ({ id: it.id, displayOrder: i + 1 }));
    this.menuService.reorderItems(orders).subscribe(() => {
      this.menuService.loadItems().subscribe();
    });
  }
}
