import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DesignService,
  AVAILABLE_TEMPLATES,
  AVAILABLE_PALETTES,
  AVAILABLE_HEADING_FONTS,
  AVAILABLE_BODY_FONTS,
  AVAILABLE_FONT_PAIRS,
  TemplateConfig,
  PaletteConfig,
  PaletteColors,
  FontOption,
  FontPairPreset,
  HomeBlock,
  DesignSettings
} from '../../../../services/design.service';
import { MenuService } from '../../../../services/menu.service';

@Component({
  selector: 'app-design-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="design-container">

      <!-- ═════════════════════════════════════════════════════ -->
      <!-- ── 1. TEMPLATES DO CARDÁPIO (APENAS ESTRUTURA) ── -->
      <!-- ═════════════════════════════════════════════════════ -->
      <section class="design-section" style="--i:0">
        <div class="section-head">
          <div class="head-icon tmpl">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="18" height="7" x="3" y="3" rx="1"/>
              <rect width="7" height="10" x="3" y="14" rx="1"/>
              <rect width="7" height="10" x="14" y="14" rx="1"/>
            </svg>
          </div>
          <div>
            <div class="title-with-pill">
              <h2 class="section-title">Estrutura & Template</h2>
              <span class="safe-badge">Cores e fontes preservadas</span>
            </div>
            <p class="section-sub">Define a posição dos elementos, estilo visual (Claymorphism, Glassmorphism, Flat) e formato da Hero Section.</p>
          </div>
        </div>

        <div class="templates-grid">
          @for (tmpl of templates; track tmpl.key; let i = $index) {
            <div
              class="template-card"
              [class.selected]="designService.draft().templateKey === tmpl.key"
              (click)="selectTemplate(tmpl.key)"
              [style.--ti]="i">

              <!-- Mini Mockup Estrutural Visual -->
              <div class="tmpl-preview" [attr.data-tmpl]="tmpl.key">
                <!-- Topbar Mockup -->
                <div class="tmpl-mini-header" [attr.data-logo-pos]="tmpl.logoPosition">
                  @if (tmpl.logoPosition === 'above-hero' || tmpl.logoPosition === 'top-center') {
                    <div class="tmpl-mini-logo top-center-logo"></div>
                  } @else {
                    <div class="tmpl-mini-logo"></div>
                    <div class="tmpl-mini-nav"></div>
                  }
                </div>

                <!-- Hero Section Mockup -->
                <div class="tmpl-mini-hero" [attr.data-hero]="tmpl.heroStyle">
                  @if (tmpl.logoPosition === 'hero-bottom-center') {
                    <div class="tmpl-hero-overlap-logo"></div>
                  }
                  <div class="tmpl-hero-badge"></div>
                </div>

                <!-- Categories Mockup -->
                <div class="tmpl-mini-cats" [attr.data-layout]="tmpl.categoryLayout">
                  <span></span><span></span><span></span>
                </div>

                <!-- Products Grid Mockup -->
                <div class="tmpl-mini-grid" [attr.data-cards]="tmpl.itemCardStyle" [attr.data-surface]="tmpl.surfaceStyle">
                  <div class="mini-card-sample"></div>
                  <div class="mini-card-sample"></div>
                </div>
              </div>

              <!-- Template Info -->
              <div class="tmpl-info">
                <div class="tmpl-header-row">
                  <h3 class="tmpl-name">{{ tmpl.name }}</h3>
                  <span class="tmpl-surface-pill">{{ tmpl.surfaceStyle }}</span>
                </div>
                <p class="tmpl-desc">{{ tmpl.description }}</p>
                <span class="tmpl-ideal">{{ tmpl.idealFor }}</span>
              </div>

              @if (designService.draft().templateKey === tmpl.key) {
                <div class="tmpl-check">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              }
            </div>
          }
        </div>
      </section>

      <!-- ═════════════════════════════════════════════════════ -->
      <!-- ── 2. PALETA DE CORES (7 PALETAS + CUSTOMIZÁVEL) ── -->
      <!-- ═════════════════════════════════════════════════════ -->
      <section class="design-section" style="--i:1">
        <div class="section-head">
          <div class="head-icon palette">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
              <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
              <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
              <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
            </svg>
          </div>
          <div>
            <h2 class="section-title">Paleta de Cores</h2>
            <p class="section-sub">7 paletas harmônicas com alto contraste ou personalize cada uma das 7 cores individualmente.</p>
          </div>
        </div>

        <!-- Grade de Paletas Curadas -->
        <div class="palettes-grid">
          @for (pal of palettes; track pal.key; let i = $index) {
            <div
              class="palette-card"
              [class.selected]="!designService.draft().palette.isCustom && designService.draft().palette.key === pal.key"
              (click)="selectPalette(pal)"
              [style.--pi]="i">

              <div class="palette-swatches-7">
                <span [style.background]="pal.colors.primary" title="Primária"></span>
                <span [style.background]="pal.colors.secondary" title="Secundária"></span>
                <span [style.background]="pal.colors.accent" title="Destaque / Preço"></span>
                <span [style.background]="pal.colors.background" title="Fundo da Página"></span>
                <span [style.background]="pal.colors.surface" title="Fundo dos Cards"></span>
                <span [style.background]="pal.colors.textPrimary" title="Texto Principal"></span>
                <span [style.background]="pal.colors.textSecondary" title="Texto Secundário"></span>
              </div>

              <div class="pal-info-row">
                <span class="palette-name">{{ pal.name }}</span>
                @if (isDarkPalette(pal)) {
                  <span class="theme-chip dark-chip">Dark</span>
                } @else {
                  <span class="theme-chip light-chip">Light</span>
                }
              </div>
            </div>
          }

          <!-- Card de Paleta Personalizada -->
          <div
            class="palette-card custom-card"
            [class.selected]="designService.draft().palette.isCustom"
            (click)="enableCustomPalette()">
            <div class="palette-swatches-7">
              <span [style.background]="designService.draft().palette.colors.primary"></span>
              <span [style.background]="designService.draft().palette.colors.secondary"></span>
              <span [style.background]="designService.draft().palette.colors.accent"></span>
              <span [style.background]="designService.draft().palette.colors.background"></span>
              <span [style.background]="designService.draft().palette.colors.surface"></span>
              <span [style.background]="designService.draft().palette.colors.textPrimary"></span>
              <span [style.background]="designService.draft().palette.colors.textSecondary"></span>
            </div>
            <div class="pal-info-row">
              <span class="palette-name">Personalizada ✨</span>
              <span class="theme-chip custom-chip">7 Cores</span>
            </div>
          </div>
        </div>

        <!-- Painel Interativo de Personalização das 7 Cores -->
        @if (designService.draft().palette.isCustom) {
          <div class="custom-palette-panel">
            <div class="panel-header">
              <div class="panel-badge">Editor Customizado</div>
              <h4 class="panel-title">Ajuste fino das 7 cores do seu cardápio</h4>
              <p class="panel-desc">Escolha cada tom com seletor visual ou código HEX. As mudanças refletem imediatamente no preview.</p>
            </div>

            <div class="color-tokens-grid">
              @for (token of colorTokenList; track token.key) {
                <div class="color-token-item">
                  <div class="token-left">
                    <label class="color-picker-trigger" [style.background]="designService.draft().palette.colors[token.key]">
                      <input
                        type="color"
                        [value]="designService.draft().palette.colors[token.key]"
                        (input)="onColorChange(token.key, $event)"
                        class="hidden-color-input" />
                    </label>
                    <div class="token-text">
                      <span class="token-label">{{ token.label }}</span>
                      <span class="token-sub">{{ token.description }}</span>
                    </div>
                  </div>

                  <div class="token-right">
                    <span class="hash-tag">#</span>
                    <input
                      type="text"
                      [value]="designService.draft().palette.colors[token.key].replace('#', '')"
                      (change)="onHexInputChange(token.key, $event)"
                      maxlength="6"
                      class="hex-text-input" />
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </section>

      <!-- ═════════════════════════════════════════════════════ -->
      <!-- ── 3. TIPOGRAFIA (ESCOLHA DE ATÉ 2 FONTES) ── -->
      <!-- ═════════════════════════════════════════════════════ -->
      <section class="design-section" style="--i:2">
        <div class="section-head">
          <div class="head-icon fonts">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 7 4 4 20 4 20 7"/>
              <line x1="9" y1="20" x2="15" y2="20"/>
              <line x1="12" y1="4" x2="12" y2="20"/>
            </svg>
          </div>
          <div>
            <div class="title-with-pill">
              <h2 class="section-title">Tipografia</h2>
              <span class="safe-badge">Até 2 fontes distintas</span>
            </div>
            <p class="section-sub">Personalize uma fonte com personalidade para os Títulos e outra ergonômica para o Corpo.</p>
          </div>
        </div>

        <!-- 3.1 Presets Rápidos Recomendados (1 Clique) -->
        <div class="font-presets-row">
          <span class="presets-kicker">Combinações Harmoniosas:</span>
          <div class="presets-scroll">
            @for (pair of fontPairs; track pair.key) {
              <button
                type="button"
                class="btn-preset-pill"
                [class.active]="designService.draft().fontHeading === pair.heading && designService.draft().fontBody === pair.body"
                (click)="applyPreset(pair)">
                <strong>{{ pair.name }}</strong> ({{ pair.heading }} + {{ pair.body }})
              </button>
            }
          </div>
        </div>

        <!-- 3.2 Seletor da Fonte de Títulos -->
        <div class="typography-category-block">
          <div class="typo-block-header">
            <span class="typo-step">1</span>
            <div>
              <h3 class="typo-block-title">Fonte para Títulos & Destaques</h3>
              <p class="typo-block-desc">Aplicada no nome do negócio, títulos de seções, modais e nomes dos pratos.</p>
            </div>
            <span class="current-font-pill">{{ designService.draft().fontHeading }}</span>
          </div>

          <div class="fonts-selection-grid">
            @for (f of headingFonts; track f.key) {
              <div
                class="font-select-card"
                [class.selected]="designService.draft().fontHeading === f.family"
                (click)="selectHeadingFont(f.family)">
                <div class="font-preview-heading">
                  <span class="font-big-sample" [style.font-family]="f.family + ', sans-serif'">
                    {{ f.name }}
                  </span>
                  <span class="font-sub-sample" [style.font-family]="f.family + ', sans-serif'">
                    {{ f.sample }}
                  </span>
                </div>
                <div class="font-card-footer">
                  <span class="font-tag">{{ f.category }}</span>
                  @if (designService.draft().fontHeading === f.family) {
                    <span class="active-check">✓ Ativa</span>
                  }
                </div>
              </div>
            }
          </div>
        </div>

        <!-- 3.3 Seletor da Fonte de Corpo -->
        <div class="typography-category-block" style="margin-top: 28px;">
          <div class="typo-block-header">
            <span class="typo-step">2</span>
            <div>
              <h3 class="typo-block-title">Fonte para Corpo de Texto & Leitura</h3>
              <p class="typo-block-desc">Aplicada nas descrições de produtos, preços, botões e textos informativos.</p>
            </div>
            <span class="current-font-pill">{{ designService.draft().fontBody }}</span>
          </div>

          <div class="fonts-selection-grid">
            @for (f of bodyFonts; track f.key) {
              <div
                class="font-select-card"
                [class.selected]="designService.draft().fontBody === f.family"
                (click)="selectBodyFont(f.family)">
                <div class="font-preview-body">
                  <span class="font-body-title" [style.font-family]="f.family + ', sans-serif'">
                    {{ f.name }}
                  </span>
                  <p class="font-body-sample" [style.font-family]="f.family + ', sans-serif'">
                    {{ f.sample }}
                  </p>
                </div>
                <div class="font-card-footer">
                  <span class="font-tag">{{ f.category }}</span>
                  @if (designService.draft().fontBody === f.family) {
                    <span class="active-check">✓ Ativa</span>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- ═════════════════════════════════════════════════════ -->
      <!-- ── 4. ANIMAÇÕES & TRANSIÇÕES ── -->
      <!-- ═════════════════════════════════════════════════════ -->
      <section class="design-section" style="--i:3">
        <div class="section-head">
          <div class="head-icon motion">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            </svg>
          </div>
          <div>
            <h2 class="section-title">Animações</h2>
            <p class="section-sub">Transições visuais ao navegar e interagir com o cardápio.</p>
          </div>
        </div>

        <div class="motion-grid">
          @for (m of motionOptions; track m.key) {
            <button class="motion-option" [class.selected]="designService.draft().motion === m.key" (click)="selectMotion(m.key)">
              <div class="motion-demo" [attr.data-motion]="m.key">
                <div class="motion-bar"></div>
              </div>
              <span class="motion-label">{{ m.label }}</span>
            </button>
          }
        </div>
      </section>

      <!-- ═════════════════════════════════════════════════════ -->
      <!-- ── 5. BLOCOS DA PÁGINA INICIAL ── -->
      <!-- ═════════════════════════════════════════════════════ -->
      <section class="design-section" style="--i:4">
        <div class="section-head">
          <div class="head-icon blocks">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="7" height="7" x="3" y="3" rx="1"/>
              <rect width="7" height="7" x="14" y="3" rx="1"/>
              <rect width="7" height="7" x="3" y="14" rx="1"/>
              <rect width="7" height="7" x="14" y="14" rx="1"/>
            </svg>
          </div>
          <div>
            <h2 class="section-title">Blocos da Página</h2>
            <p class="section-sub">Ative ou desative seções e organize a ordem exata das vitrines de produtos na página principal.</p>
          </div>
        </div>

        <!-- 1. Estrutura Fixa da Página -->
        <div class="blocks-subgroup">
          <span class="blocks-subgroup-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Estrutura Superior Fixa
          </span>
          <div class="blocks-list fixed-list">
            @for (block of fixedBlocks; track block.id) {
              <div class="block-item fixed-item" [class.disabled]="!block.enabled">
                <div class="block-left">
                  <div class="block-icon" [ngClass]="block.type">
                    @if (block.type === 'hero') {
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    } @else {
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                    }
                  </div>
                  <div class="block-info">
                    <span class="block-label">{{ block.label }}</span>
                    <span class="block-fixed-badge">Fixo no Topo</span>
                  </div>
                </div>
                <div class="block-right-actions">
                  <button
                    type="button"
                    class="toggle-switch"
                    [class.active]="block.enabled"
                    (click)="toggleBlock(block.id)"
                    [title]="block.enabled ? 'Desativar este bloco' : 'Ativar este bloco'">
                    <div class="toggle-thumb"></div>
                  </button>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- 2. Vitrines de Destaques Reordenáveis -->
        <div class="blocks-subgroup" style="margin-top: 18px;">
          <span class="blocks-subgroup-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
            Vitrines Reordenáveis (Mais Curtidos, Combos, Pratos do Chef, Promoções)
          </span>
          <p class="blocks-subgroup-hint">Arraste os blocos ou use as setas para definir a hierarquia de exibição na vitrine inicial:</p>

          <div class="blocks-list" (dragover)="onListDragOver($event)">
            @for (block of showcaseBlocks; track block.id; let i = $index) {
              <div
                class="block-item"
                [class.disabled]="!block.enabled"
                [class.dragging]="draggedBlockIndex === i"
                [class.drag-target]="dragOverBlockIndex === i && draggedBlockIndex !== i"
                draggable="true"
                (dragstart)="onShowcaseDragStart($event, i)"
                (dragover)="onBlockDragOver($event, i)"
                (dragleave)="onBlockDragLeave($event, i)"
                (drop)="onShowcaseDrop($event, i)"
                (dragend)="onBlockDragEnd()"
                [style.--bi]="i">
                
                <div class="block-left">
                  <!-- Grip Handle para Arrastar -->
                  <div class="block-drag-grip" title="Arraste para mudar a ordem">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                      <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                      <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                    </svg>
                  </div>

                  <div class="block-icon" [ngClass]="block.type">
                    @switch (block.type) {
                      @case ('promotion') {
                        <span class="block-emoji">🔥</span>
                      }
                      @case ('most_liked') {
                        <span class="block-emoji">❤️</span>
                      }
                      @case ('featured_product') {
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      }
                      @case ('combo') {
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="m7.5 4.27 9 5.15"/>
                          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                          <path d="m3.3 7 8.7 5 8.7-5"/>
                          <path d="M12 22V12"/>
                        </svg>
                      }
                      @case ('best_seller') {
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/>
                          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                        </svg>
                      }
                      @default {
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                      }
                    }
                  </div>
                  <div class="block-info">
                    <span class="block-label">{{ block.label }}</span>
                    <span class="block-order-pill">Vitrine #{{ i + 1 }}</span>
                  </div>
                </div>

                <div class="block-right-actions">
                  <!-- Botões de Subir / Descer exclusivos da lista de vitrines -->
                  <div class="order-arrows">
                    <button
                      type="button"
                      class="btn-arrow"
                      [disabled]="i === 0"
                      (click)="moveShowcaseBlockUp(i)"
                      title="Mover para cima">▲</button>
                    <button
                      type="button"
                      class="btn-arrow"
                      [disabled]="i === showcaseBlocks.length - 1"
                      (click)="moveShowcaseBlockDown(i)"
                      title="Mover para baixo">▼</button>
                  </div>

                  <button
                    type="button"
                    class="toggle-switch"
                    [class.active]="block.enabled"
                    (click)="toggleBlock(block.id)"
                    [title]="block.enabled ? 'Desativar este bloco' : 'Ativar este bloco'">
                    <div class="toggle-thumb"></div>
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- ═════════════════════════════════════════════════════ -->
      <!-- ── 5.5 RECURSOS DO CARDÁPIO (CURTIDAS & CARRINHO) ── -->
      <!-- ═════════════════════════════════════════════════════ -->
      <section class="design-section" style="--i:4.5">
        <div class="section-head">
          <div class="head-icon features">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <div>
            <h2 class="section-title">Recursos do Cardápio</h2>
            <p class="section-sub">Personalize se os clientes podem curtir produtos e fazer pedidos via carrinho.</p>
          </div>
        </div>

        <div class="features-cards-grid">
          <!-- Recurso 1: Curtidas -->
          <div class="feature-config-card" [class.active]="designService.enableLikes()">
            <div class="feature-top-row">
              <div class="feature-icon likes">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                </svg>
              </div>
              <button
                type="button"
                class="toggle-switch"
                [class.active]="designService.enableLikes()"
                (click)="designService.setEnableLikes(!designService.enableLikes())">
                <div class="toggle-thumb"></div>
              </button>
            </div>
            <div class="feature-info">
              <h3 class="feature-title">Sistema de Curtidas (Likes)</h3>
              <p class="feature-description">
                Quando ativado, os clientes podem curtir os pratos e você visualiza o ranking dos itens mais amados. Se desativado, nada terá botão ou contadores de curtidas.
              </p>
              <span class="feature-badge" [class.on]="designService.enableLikes()">
                {{ designService.enableLikes() ? 'Ativado no Cardápio' : 'Desativado' }}
              </span>
            </div>
          </div>

          <!-- Recurso 2: Carrinho -->
          <div class="feature-config-card" [class.active]="designService.enableCart()">
            <div class="feature-top-row">
              <div class="feature-icon cart">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              </div>
              <button
                type="button"
                class="toggle-switch"
                [class.active]="designService.enableCart()"
                (click)="designService.setEnableCart(!designService.enableCart())">
                <div class="toggle-thumb"></div>
              </button>
            </div>
            <div class="feature-info">
              <h3 class="feature-title">Sistema de Carrinho</h3>
              <p class="feature-description">
                Quando ativado, exibe a sacola flutuante e permite ao cliente montar o pedido com quantidades e total. Se desativado, funciona como cardápio consultivo.
              </p>
              <span class="feature-badge" [class.on]="designService.enableCart()">
                {{ designService.enableCart() ? 'Ativado no Cardápio' : 'Desativado' }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- ═════════════════════════════════════════════════════ -->
      <!-- ── 6. DESCRIÇÃO DE APRESENTAÇÃO (TOPO DO CARDÁPIO) ── -->
      <!-- ═════════════════════════════════════════════════════ -->
      <section class="design-section" style="--i:5">
        <div class="section-head">
          <div class="head-icon intro">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <line x1="10" y1="9" x2="8" y2="9"/>
            </svg>
          </div>
          <div>
            <div class="title-with-pill">
              <h2 class="section-title">Descrição de Apresentação</h2>
              <span class="safe-badge">Fixo no Topo · Início</span>
            </div>
            <p class="section-sub">Uma caixa elegante translúcida (Glassmorphism) com bordas arredondadas exibida no topo do cardápio inicial, acima da Hero Section. Acompanha a paleta de cores e tipografia selecionadas e se oculta automaticamente nas categorias.</p>
          </div>
        </div>

        <div class="intro-editor-grid">
          <!-- Coluna 1: Campos de Edição -->
          <div class="intro-inputs-panel">
            <!-- Toggle de ativação -->
            <div class="intro-toggle-row">
              <div class="toggle-info">
                <span class="toggle-label">Exibir Bloco de Apresentação</span>
                <span class="toggle-desc">Ative para destacar um texto autoral ou boas-vindas</span>
              </div>
              <button
                type="button"
                class="toggle-switch"
                [class.active]="designService.introCard().enabled"
                (click)="toggleIntroCardEnabled()">
                <div class="toggle-thumb"></div>
              </button>
            </div>

            <!-- Campo Título -->
            <div class="intro-field-wrap">
              <div class="field-label-row">
                <label class="field-label">Título da Apresentação</label>
                <span class="char-pill">{{ (designService.introCard().title || '').length }}/120</span>
              </div>
              <input
                type="text"
                [value]="designService.introCard().title"
                (input)="onIntroTitleChange($event)"
                placeholder="Ex: Gastronomia Autoral & Ingredientes Nobres"
                maxlength="120"
                class="intro-text-input" />
            </div>

            <!-- Campo Descrição -->
            <div class="intro-field-wrap">
              <div class="field-label-row">
                <label class="field-label">Breve Descrição / Mensagem</label>
                <span class="char-pill">{{ (designService.introCard().description || '').length }}/800</span>
              </div>
              <textarea
                rows="4"
                [value]="designService.introCard().description"
                (input)="onIntroDescChange($event)"
                placeholder="Conte brevemente sobre o conceito da casa, preparo artesanal, convite especial aos clientes..."
                maxlength="800"
                class="intro-textarea"></textarea>
            </div>

            <div class="intro-behavior-hint">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <span>Esta mensagem permanece fixa no topo da página inicial do cardápio e é recolhida quando o cliente filtra por qualquer categoria.</span>
            </div>
          </div>

          <!-- Coluna 2: Live Preview Translúcido Dinâmico -->
          <div class="intro-live-preview-box">
            <div class="preview-header">
              <span class="preview-badge">Pré-visualização Dinâmica</span>
              <span class="preview-palette-tag" [style.color]="designService.draft().palette.colors.accent">
                {{ designService.draft().palette.name }} · {{ designService.draft().fontHeading }}
              </span>
            </div>

            <div class="intro-preview-stage" [style.background]="designService.draft().palette.colors.background">
              <!-- Mock Hero decorativo de fundo para demonstrar o efeito de transparência real -->
              <div class="preview-mock-hero">
                <span class="mock-hero-tag">Hero Section / Capa</span>
              </div>

              <!-- Card Glassmorphism Preview -->
              <div
                class="intro-preview-card"
                [class.preview-disabled]="!designService.introCard().enabled"
                [style.background]="designService.draft().palette.colors.surface + '18'"
                [style.border-color]="designService.draft().palette.colors.surface + '35'">

                <div class="preview-card-texts">
                  <h4
                    class="preview-card-title"
                    [style.font-family]="designService.draft().fontHeading + ', sans-serif'"
                    [style.color]="designService.draft().palette.colors.textPrimary">
                    {{ designService.introCard().title || 'Título da Apresentação' }}
                  </h4>
                  <p
                    class="preview-card-desc"
                    [style.font-family]="designService.draft().fontBody + ', sans-serif'"
                    [style.color]="designService.draft().palette.colors.textSecondary">
                    {{ designService.introCard().description || 'Sua descrição de apresentação aparecerá aqui com efeito translúcido e elegante.' }}
                  </p>
                </div>
              </div>

              @if (!designService.introCard().enabled) {
                <div class="preview-disabled-badge">
                  <span>Bloco Desativado (Oculto no Cardápio)</span>
                </div>
              }
            </div>
          </div>
        </div>
      </section>

      <!-- ═════════════════════════════════════════════════════ -->
      <!-- ── 7. BANNERS DA HERO SECTION (CARROSSEL DINÂMICO) ── -->
      <!-- ═════════════════════════════════════════════════════ -->
      <section class="design-section" style="--i:5.5">
        <div class="section-head">
          <div class="head-icon banners">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
          </div>
          <div>
            <div class="title-with-pill">
              <h2 class="section-title">Banners da Hero Section</h2>
              <span class="safe-badge">{{ (designService.draft().heroBanners || []).length }}/5 Imagens</span>
            </div>
            <p class="section-sub">Configure até 5 banners que alternam com transição automática a cada 4.5 segundos no topo do cardápio.</p>
          </div>
        </div>

        <!-- Bento Card: Dicas de Resolução e Proporção -->
        <div class="banner-tips-bento">
          <div class="tip-card">
            <div class="tip-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>
            </div>
            <div class="tip-content">
              <strong>Resolução Recomendada</strong>
              <p>Utilize imagens de no mínimo <code>1200 x 500 px</code> para visualização nítida em telas Retina e Desktop.</p>
            </div>
          </div>

          <div class="tip-card">
            <div class="tip-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="12" x="2" y="6" rx="2"/><path d="M12 12h.01"/></svg>
            </div>
            <div class="tip-content">
              <strong>Proporção Ideal</strong>
              <p>Formato horizontal <code>16:9</code> ou <code>21:9</code> (panorâmica). Evita cortes indesejados nas laterais no mobile.</p>
            </div>
          </div>

          <div class="tip-card">
            <div class="tip-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="tip-content">
              <strong>Carrossel Automático</strong>
              <p>Transições suaves com indicador de bolinhas e suporte a navegação por toque dos clientes.</p>
            </div>
          </div>
        </div>

        <!-- Seletor de Categoria para a Hero Section -->
        <div class="hero-target-selector-box">
          <div class="target-selector-header">
            <span class="target-selector-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 9 6 6m0-6-6 6"/></svg>
              Escolha onde configurar a Hero Section:
            </span>
            <span class="target-current-badge">Configurando: <strong>{{ activeHeroCategoryName }}</strong></span>
          </div>

          <div class="hero-targets-scroll">
            <button
              type="button"
              class="hero-target-chip"
              [class.active]="selectedHeroCategory === 'home'"
              (click)="selectHeroCategory('home')">
              <span class="target-chip-icon">🏠</span>
              <span class="target-chip-label">Início / Geral</span>
              <span class="target-chip-count">{{ (designService.draft().heroBanners || []).length }}/5</span>
            </button>

            @for (cat of menuService.categories(); track cat.id) {
              <button
                type="button"
                class="hero-target-chip"
                [class.active]="selectedHeroCategory === cat.id"
                (click)="selectHeroCategory(cat.id)">
                <span class="target-chip-icon">📁</span>
                <span class="target-chip-label">{{ cat.name }}</span>
                <span class="target-chip-count" [class.has-banners]="(designService.getCategoryHeroConfig(cat.id).banners || []).length > 0">
                  {{ (designService.getCategoryHeroConfig(cat.id).banners || []).length }}/3
                </span>
              </button>
            }
          </div>
        </div>

        <!-- Seletor de Escopo da Hero Section (Todas as categorias vs Apenas Início) -->
        @if (selectedHeroCategory === 'home') {
          <div class="hero-scope-selector-card">
            <div class="hero-scope-header">
              <span class="scope-title">Alcance da Hero Section</span>
              <span class="scope-subtitle">Defina se esta capa se aplica a todo o cardápio ou se as outras categorias terão capas próprias</span>
            </div>
            
            <div class="hero-scope-options">
              <button
                type="button"
                class="hero-scope-btn"
                [class.active]="designService.heroScope() === 'all'"
                (click)="designService.setHeroScope('all'); onToast.emit('Hero Section configurada para todas as categorias')">
                <div class="scope-btn-indicator">
                  <span class="radio-dot"></span>
                </div>
                <div class="scope-btn-content">
                  <div class="scope-btn-title-row">
                    <span class="scope-btn-icon">🌐</span>
                    <strong class="scope-btn-title">Vale para todas as categorias</strong>
                  </div>
                  <p class="scope-btn-desc">A mesma capa e banners do Início serão exibidos em todas as abas e categorias do cardápio.</p>
                </div>
              </button>

              <button
                type="button"
                class="hero-scope-btn"
                [class.active]="designService.heroScope() === 'home_only'"
                (click)="designService.setHeroScope('home_only'); onToast.emit('Hero Section configurada apenas para o Início')">
                <div class="scope-btn-indicator">
                  <span class="radio-dot"></span>
                </div>
                <div class="scope-btn-content">
                  <div class="scope-btn-title-row">
                    <span class="scope-btn-icon">🏠</span>
                    <strong class="scope-btn-title">Vale apenas para a categoria Início</strong>
                  </div>
                  <p class="scope-btn-desc">Esta capa aparece só no Início. As outras categorias terão capas independentes configuradas nas abas acima.</p>
                </div>
              </button>
            </div>
          </div>
        } @else if (designService.heroScope() === 'all') {
          <div class="hero-scope-notice">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>A Hero Section está definida para <strong>todas as categorias</strong>. Se desejar capas independentes por categoria, selecione <em>"Início / Geral"</em> e marque <em>"Vale apenas para a categoria Início"</em>.</span>
          </div>
        }

        <!-- Toggle de Ativar/Desativar Hero nesta Categoria/Início -->
        <div class="category-hero-toggle-card">
          <div class="toggle-info">
            <span class="toggle-title">Exibir Hero Section em {{ activeHeroCategoryName }}</span>
            <span class="toggle-subtitle">
              {{ isCurrentHeroEnabled ? 'Hero Section ativa e visível para os clientes ao abrir esta seção.' : 'Hero Section desativada nesta seção (oculta para o cliente).' }}
            </span>
          </div>
          <button
            type="button"
            class="toggle-switch"
            [class.active]="isCurrentHeroEnabled"
            (click)="toggleCurrentHero()">
            <div class="toggle-thumb"></div>
          </button>
        </div>

        <!-- Adicionar Novo Banner (se < currentMaxBanners) -->
        @if (currentHeroBanners.length < currentMaxBanners) {
          <div class="add-banner-box">
            <div class="banner-mode-selector">
              <button type="button" class="mode-tab-btn" [class.active]="bannerInputMode === 'upload'" (click)="bannerInputMode = 'upload'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload do Dispositivo
              </button>
              <button type="button" class="mode-tab-btn" [class.active]="bannerInputMode === 'url'" (click)="bannerInputMode = 'url'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                Inserir Link / URL
              </button>
            </div>

            @if (bannerInputMode === 'upload') {
              <div class="banner-dropzone" (click)="bannerFileInput.click()">
                <input #bannerFileInput type="file" accept="image/png, image/jpeg, image/webp, image/jpg" (change)="onBannerFileSelected($event)" style="display: none" />
                <div class="banner-drop-info">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span class="drop-title">Clique para selecionar imagem para a capa ({{ activeHeroCategoryName }})</span>
                  <span class="drop-sub">JPG, PNG ou WebP de até 5MB</span>
                </div>
              </div>
            } @else {
              <div class="banner-url-row">
                <input
                  type="url"
                  [(ngModel)]="newBannerUrl"
                  placeholder="https://images.unsplash.com/photo-... (URL da imagem)"
                  class="banner-url-input"
                  (keyup.enter)="addBannerFromUrl()" />
                <button type="button" class="btn-add-banner" (click)="addBannerFromUrl()" [disabled]="!newBannerUrl.trim()">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Adicionar
                </button>
              </div>
            }
          </div>
        } @else {
          <div class="banner-limit-notice">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>Limite máximo de {{ currentMaxBanners }} banners atingido para {{ activeHeroCategoryName }}. Remova um banner existente para adicionar outro.</span>
          </div>
        }

        <!-- Miniaturas dos Banners Configurados -->
        <div class="banners-current-grid">
          @for (banner of currentHeroBanners; track banner; let idx = $index) {
            <div class="banner-thumb-card">
              <div class="thumb-img-wrap">
                <img [src]="banner" [alt]="'Banner ' + (idx + 1)" class="banner-img-thumb" />
                <div class="thumb-overlay">
                  <button type="button" class="btn-del-banner" (click)="removeBanner(idx)" title="Remover este banner">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
                    Excluir
                  </button>
                </div>
              </div>
              <div class="thumb-info">
                <span class="thumb-index-tag">{{ idx === 0 ? '1 · Capa Principal' : (idx + 1) + ' · Slide ' + (idx + 1) }}</span>
              </div>
            </div>
          } @empty {
            <div class="banner-empty">
              <p>Nenhum banner cadastrado para {{ activeHeroCategoryName }}. O cardápio usará o degradê padrão ou banner geral.</p>
            </div>
          }
        </div>
      </section>

      <!-- ═════════════════════════════════════════════════════ -->
      <!-- ── BARRA FIXA DE AÇÕES INFERIOR ── -->
      <!-- ═════════════════════════════════════════════════════ -->
      <footer class="design-footer">
        <div class="footer-left">
          @if (designService.hasUnsavedChanges()) {
            <span class="unsaved-badge">
              <span class="pulse-amber"></span> Alterações não salvas
            </span>
          } @else {
            <span class="saved-badge">✓ Todas as alterações salvas</span>
          }
        </div>

        <div class="footer-actions">
          <button type="button" class="btn-reset" (click)="resetDraft()" [disabled]="!designService.hasUnsavedChanges()">
            Descartar
          </button>
          <button type="button" class="btn-save" (click)="saveDraft()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Salvar Alterações
          </button>
        </div>
      </footer>

    </div>
  `,
  styles: [`
    :host { display: block; }

    .design-container {
      display: flex;
      flex-direction: column;
      gap: 36px;
      padding-bottom: 90px;
    }

    /* ── Sections ── */
    .design-section {
      background: #141418;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 20px;
      padding: 24px;
      animation: sectionIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
      animation-delay: calc(var(--i) * 60ms);
    }

    .section-head {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 22px;
    }

    .title-with-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .safe-badge {
      font-size: 0.7rem;
      font-weight: 700;
      color: #22C55E;
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid rgba(34, 197, 94, 0.25);
      padding: 2px 8px;
      border-radius: 12px;
      letter-spacing: 0.02em;
    }

    .head-icon {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .head-icon.tmpl { background: rgba(244, 123, 32, 0.12); color: #F47B20; }
    .head-icon.palette { background: rgba(139, 92, 246, 0.12); color: #A78BFA; }
    .head-icon.fonts { background: rgba(59, 130, 246, 0.12); color: #60A5FA; }
    .head-icon.motion { background: rgba(236, 72, 153, 0.12); color: #F472B6; }
    .head-icon.blocks { background: rgba(16, 185, 129, 0.12); color: #34D399; }
    .head-icon.intro { background: rgba(244, 123, 32, 0.14); color: #F47B20; }

    .section-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.15rem;
      font-weight: 700;
      color: #FFF;
      margin: 0 0 4px 0;
    }

    .section-sub {
      font-size: 0.84rem;
      color: #71717A;
      margin: 0;
      line-height: 1.4;
    }

    /* ══════════════════════════════════════════════════ */
    /* ── 1. TEMPLATES GRID ── */
    /* ══════════════════════════════════════════════════ */
    .templates-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .template-card {
      background: #18181D;
      border: 2px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 16px;
      cursor: pointer;
      position: relative;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .template-card:hover {
      border-color: rgba(244, 123, 32, 0.4);
      transform: translateY(-2px);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
    }
    .template-card.selected {
      border-color: #F47B20;
      background: #1D1815;
      box-shadow: 0 0 0 1px #F47B20, 0 8px 24px rgba(244, 123, 32, 0.2);
    }

    .tmpl-preview {
      background: #0D0D10;
      border-radius: 12px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      border: 1px solid rgba(255, 255, 255, 0.04);
      min-height: 110px;
    }

    .tmpl-mini-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 12px;
    }
    .tmpl-mini-header[data-logo-pos="above-hero"] {
      justify-content: center;
    }
    .tmpl-mini-logo {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #F47B20;
    }
    .top-center-logo {
      width: 18px;
      height: 18px;
      box-shadow: 0 0 6px rgba(244, 123, 32, 0.4);
    }
    .tmpl-mini-nav {
      width: 20px;
      height: 6px;
      border-radius: 3px;
      background: rgba(255,255,255,0.2);
    }

    .tmpl-mini-hero {
      height: 38px;
      border-radius: 6px;
      background: linear-gradient(135deg, #27272A, #18181B);
      position: relative;
      display: flex;
      align-items: center;
      padding: 0 8px;
    }
    .tmpl-preview[data-tmpl="modern"] .tmpl-mini-hero {
      border-radius: 12px;
      box-shadow: inset 1px 1px 2px rgba(255,255,255,0.2), 2px 2px 6px rgba(0,0,0,0.3);
    }
    .tmpl-preview[data-tmpl="premium"] .tmpl-mini-hero {
      border-radius: 0;
      margin: -4px -12px 0;
      height: 42px;
      background: linear-gradient(180deg, #3F3F46 0%, #18181B 100%);
    }
    .tmpl-preview[data-tmpl="dark"] .tmpl-mini-hero {
      border: 1px solid rgba(139, 92, 246, 0.4);
      box-shadow: 0 0 10px rgba(139, 92, 246, 0.25);
    }

    .tmpl-hero-overlap-logo {
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #D4AF37;
      border: 1.5px solid #18181B;
      box-shadow: 0 0 6px rgba(212, 175, 55, 0.6);
      z-index: 2;
    }

    .tmpl-mini-cats {
      display: flex;
      gap: 4px;
    }
    .tmpl-mini-cats span {
      height: 6px;
      width: 24px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.15);
    }

    .tmpl-mini-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .mini-card-sample {
      height: 24px;
      border-radius: 6px;
      background: #27272A;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .tmpl-mini-grid[data-surface="claymorphism"] .mini-card-sample {
      border-radius: 10px;
      box-shadow: 2px 2px 4px rgba(0,0,0,0.4), inset 1px 1px 2px rgba(255,255,255,0.15);
    }
    .tmpl-mini-grid[data-surface="glassmorphism"] .mini-card-sample {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(6, 182, 212, 0.4);
      box-shadow: 0 0 6px rgba(6, 182, 212, 0.15);
    }

    .tmpl-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .tmpl-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .tmpl-name {
      font-family: 'Outfit', sans-serif;
      font-size: 0.95rem;
      font-weight: 700;
      color: #FFF;
      margin: 0;
    }
    .tmpl-surface-pill {
      font-size: 0.68rem;
      font-weight: 600;
      text-transform: capitalize;
      color: #A1A1AA;
      background: rgba(255,255,255,0.06);
      padding: 1px 6px;
      border-radius: 6px;
    }
    .tmpl-desc {
      font-size: 0.78rem;
      color: #8E8E93;
      margin: 0;
      line-height: 1.35;
    }
    .tmpl-ideal {
      font-size: 0.72rem;
      color: #F47B20;
      margin-top: 2px;
      font-weight: 600;
    }

    .tmpl-check {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #F47B20;
      color: #FFF;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(244, 123, 32, 0.4);
    }

    /* ══════════════════════════════════════════════════ */
    /* ── 2. PALETA DE CORES ── */
    /* ══════════════════════════════════════════════════ */
    .palettes-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }

    .palette-card {
      background: #18181D;
      border: 1.5px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 12px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .palette-card:hover {
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
    }
    .palette-card.selected {
      border-color: #A78BFA;
      background: #1C1824;
      box-shadow: 0 0 0 1px #A78BFA, 0 6px 20px rgba(167, 139, 250, 0.2);
    }
    .palette-card.custom-card {
      border-style: dashed;
    }
    .palette-card.custom-card.selected {
      border-style: solid;
      border-color: #F47B20;
      background: #1F1915;
      box-shadow: 0 0 0 1px #F47B20, 0 6px 20px rgba(244, 123, 32, 0.2);
    }

    .palette-swatches-7 {
      display: flex;
      height: 22px;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .palette-swatches-7 span {
      flex: 1;
      height: 100%;
    }

    .pal-info-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .palette-name {
      font-size: 0.82rem;
      font-weight: 700;
      color: #E4E4E7;
    }
    .theme-chip {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .dark-chip { background: #27272A; color: #A1A1AA; }
    .light-chip { background: #FEF3C7; color: #92400E; }
    .custom-chip { background: rgba(244, 123, 32, 0.15); color: #F47B20; }

    /* Painel do Customizador de 7 Cores */
    .custom-palette-panel {
      margin-top: 20px;
      background: #18181E;
      border: 1px solid rgba(244, 123, 32, 0.25);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      animation: panelIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    @keyframes panelIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .panel-badge {
      display: inline-block;
      font-size: 0.68rem;
      font-weight: 800;
      color: #F47B20;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 4px;
    }
    .panel-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #FFF;
      margin: 0 0 4px 0;
    }
    .panel-desc {
      font-size: 0.8rem;
      color: #A1A1AA;
      margin: 0;
    }

    .color-tokens-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .color-token-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #111115;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 8px 12px;
    }

    .token-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .color-picker-trigger {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      cursor: pointer;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .hidden-color-input {
      position: absolute;
      opacity: 0;
      width: 100%;
      height: 100%;
      cursor: pointer;
    }
    .token-text {
      display: flex;
      flex-direction: column;
    }
    .token-label {
      font-size: 0.82rem;
      font-weight: 700;
      color: #FFF;
    }
    .token-sub {
      font-size: 0.72rem;
      color: #71717A;
    }

    .token-right {
      display: flex;
      align-items: center;
      background: #1E1E24;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 3px 6px;
    }
    .hash-tag {
      font-size: 0.75rem;
      font-weight: 700;
      color: #71717A;
    }
    .hex-text-input {
      width: 60px;
      background: none;
      border: none;
      color: #FFF;
      font-family: monospace;
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
      outline: none;
    }

    /* ══════════════════════════════════════════════════ */
    /* ── 3. TIPOGRAFIA ── */
    /* ══════════════════════════════════════════════════ */
    .font-presets-row {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 24px;
      padding: 14px;
      background: #18181E;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .presets-kicker {
      font-size: 0.75rem;
      font-weight: 700;
      color: #A1A1AA;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .presets-scroll {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
    }
    .btn-preset-pill {
      background: #27272A;
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #D4D4D8;
      font-size: 0.78rem;
      padding: 6px 12px;
      border-radius: 20px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
    }
    .btn-preset-pill:hover {
      background: #3F3F46;
      color: #FFF;
    }
    .btn-preset-pill.active {
      background: #F47B20;
      border-color: #F47B20;
      color: #FFF;
      font-weight: 700;
      box-shadow: 0 2px 10px rgba(244, 123, 32, 0.35);
    }

    .typography-category-block {
      background: #18181E;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 18px;
    }

    .typo-block-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .typo-step {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #F47B20;
      color: #FFF;
      font-size: 0.85rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .typo-block-title {
      font-size: 0.96rem;
      font-weight: 700;
      color: #FFF;
      margin: 0;
    }
    .typo-block-desc {
      font-size: 0.78rem;
      color: #8E8E93;
      margin: 0;
    }
    .current-font-pill {
      margin-left: auto;
      font-size: 0.75rem;
      font-weight: 700;
      color: #F47B20;
      background: rgba(244, 123, 32, 0.12);
      border: 1px solid rgba(244, 123, 32, 0.3);
      padding: 3px 10px;
      border-radius: 12px;
    }

    .fonts-selection-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .font-select-card {
      background: #111115;
      border: 1.5px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 14px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 10px;
      min-height: 86px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .font-select-card:hover {
      border-color: rgba(244, 123, 32, 0.35);
      background: #15151B;
      transform: translateY(-2px);
    }
    .font-select-card.selected {
      border-color: #F47B20;
      background: #1D1815;
      box-shadow: 0 0 0 1px #F47B20, 0 6px 20px rgba(244, 123, 32, 0.2);
    }

    .font-big-sample {
      display: block;
      font-size: 1.15rem;
      font-weight: 700;
      color: #FFF;
      line-height: 1.2;
    }
    .font-sub-sample {
      display: block;
      font-size: 0.76rem;
      color: #A1A1AA;
      margin-top: 3px;
    }

    .font-body-title {
      display: block;
      font-size: 0.95rem;
      font-weight: 700;
      color: #FFF;
    }
    .font-body-sample {
      font-size: 0.78rem;
      color: #9E9EB2;
      margin: 4px 0 0 0;
      line-height: 1.35;
    }

    .font-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 4px;
    }
    .font-tag {
      font-size: 0.68rem;
      color: #71717A;
      background: rgba(255, 255, 255, 0.05);
      padding: 1px 6px;
      border-radius: 4px;
    }
    .active-check {
      font-size: 0.72rem;
      font-weight: 700;
      color: #F47B20;
    }

    /* ══════════════════════════════════════════════════ */
    /* ── 4. ANIMAÇÕES & BLOCOS ── */
    /* ══════════════════════════════════════════════════ */
    .motion-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .motion-option {
      background: #18181D;
      border: 1.5px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 14px;
      cursor: pointer;
      color: #FFF;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      transition: all 0.2s ease;
    }
    .motion-option:hover {
      border-color: rgba(244, 123, 32, 0.35);
    }
    .motion-option.selected {
      border-color: #F47B20;
      background: #1D1815;
    }
    .motion-demo {
      width: 44px;
      height: 28px;
      background: #27272A;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .motion-bar {
      width: 20px;
      height: 12px;
      background: #F47B20;
      border-radius: 3px;
    }
    .motion-demo[data-motion="fade"] .motion-bar { animation: motionFade 2s infinite; }
    .motion-demo[data-motion="slide"] .motion-bar { animation: motionSlide 2s infinite; }
    .motion-demo[data-motion="scale"] .motion-bar { animation: motionScale 2s infinite; }

    .blocks-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .block-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #18181D;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 12px 16px;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: grab;
      user-select: none;
    }
    .block-item:active {
      cursor: grabbing;
    }
    .block-item.dragging {
      opacity: 0.4;
      background: #23232A;
      border: 1px dashed #F47B20;
      transform: scale(0.98);
    }
    .block-item.drag-target {
      border-color: #F47B20;
      box-shadow: 0 0 16px rgba(244, 123, 32, 0.35);
      background: rgba(244, 123, 32, 0.06);
    }
    .block-item.disabled {
      opacity: 0.55;
      background: #131316;
    }
    .block-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .block-drag-grip {
      color: #52525B;
      cursor: grab;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border-radius: 6px;
      transition: color 0.15s;
    }
    .block-item:hover .block-drag-grip {
      color: #A1A1AA;
    }
    .block-icon {
      font-size: 1.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.04);
      color: #F47B20;
    }
    .block-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .block-label {
      font-size: 0.92rem;
      font-weight: 600;
      color: #FFF;
    }
    .block-order-pill {
      font-size: 0.68rem;
      font-weight: 800;
      color: #71717A;
      background: rgba(255, 255, 255, 0.04);
      padding: 2px 7px;
      border-radius: 6px;
    }
    .block-right-actions {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .order-arrows {
      display: flex;
      gap: 4px;
    }
    .btn-arrow {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #A1A1AA;
      width: 26px;
      height: 26px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-arrow:hover:not(:disabled) {
      background: rgba(244, 123, 32, 0.15);
      border-color: rgba(244, 123, 32, 0.4);
      color: #F47B20;
    }
    .btn-arrow:disabled {
      opacity: 0.25;
      cursor: not-allowed;
    }

    /* ── Blocos Subgrupos & Badges ── */
    .blocks-subgroup-title {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 0.82rem;
      font-weight: 700;
      color: #D4D4D8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .blocks-subgroup-title svg {
      color: #F47B20;
    }
    .blocks-subgroup-hint {
      font-size: 0.8rem;
      color: #71717A;
      margin: 0 0 10px;
      line-height: 1.4;
    }
    .block-item.fixed-item {
      cursor: default;
      background: rgba(255, 255, 255, 0.02);
      border-color: rgba(255, 255, 255, 0.04);
    }
    .block-fixed-badge {
      font-size: 0.65rem;
      font-weight: 700;
      color: #71717A;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 2px 7px;
      border-radius: 6px;
    }
    .block-emoji {
      font-size: 1.1rem;
      line-height: 1;
    }
    .block-icon.combo {
      background: rgba(139, 92, 246, 0.12);
      color: #A78BFA;
    }
    .block-icon.best_seller {
      background: rgba(234, 179, 8, 0.12);
      color: #EAB308;
    }
    .block-icon.promotion {
      background: rgba(249, 115, 22, 0.12);
      color: #F97316;
    }
    .block-icon.featured_product {
      background: rgba(234, 179, 8, 0.12);
      color: #FACC15;
    }
    .block-icon.most_liked {
      background: rgba(244, 63, 94, 0.12);
      color: #F43F5E;
    }

    /* ── Features Cards Grid ── */
    .head-icon.features {
      background: rgba(244, 123, 32, 0.12);
      color: #F47B20;
    }
    .features-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }
    .feature-config-card {
      background: #18181D;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      transition: all 0.25s ease;
    }
    .feature-config-card.active {
      border-color: rgba(244, 123, 32, 0.3);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }
    .feature-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .feature-icon {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .feature-icon.likes {
      background: rgba(236, 72, 153, 0.12);
      color: #EC4899;
    }
    .feature-icon.cart {
      background: rgba(56, 189, 248, 0.12);
      color: #38BDF8;
    }
    .feature-info {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .feature-title {
      font-size: 1rem;
      font-weight: 700;
      color: #FFF;
      margin: 0;
    }
    .feature-description {
      font-size: 0.8rem;
      color: #A1A1AA;
      line-height: 1.45;
      margin: 0;
    }
    .feature-badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      align-self: flex-start;
      background: rgba(255, 255, 255, 0.06);
      color: #71717A;
    }
    .feature-badge.on {
      background: rgba(34, 197, 94, 0.15);
      color: #22C55E;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    /* Toggle Switch */
    .toggle-switch {
      width: 44px;
      height: 24px;
      border-radius: 12px;
      background: #27272A;
      border: none;
      cursor: pointer;
      position: relative;
      padding: 2px;
      transition: background 0.25s ease;
    }
    .toggle-switch.active {
      background: #F47B20;
    }
    .toggle-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #FFF;
      transition: transform 0.25s ease;
    }
    .toggle-switch.active .toggle-thumb {
      transform: translateX(20px);
    }

    /* ══════════════════════════════════════════════════ */
    /* ── FOOTER FIXO ── */
    /* ══════════════════════════════════════════════════ */
    .design-footer {
      position: sticky;
      bottom: 16px;
      background: rgba(20, 20, 24, 0.92);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
      z-index: 40;
    }

    .unsaved-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.84rem;
      font-weight: 600;
      color: #F59E0B;
    }
    .pulse-amber {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #F59E0B;
      box-shadow: 0 0 8px #F59E0B;
    }
    .saved-badge {
      font-size: 0.84rem;
      font-weight: 600;
      color: #22C55E;
    }

    .footer-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn-reset {
      background: none;
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #D4D4D8;
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-reset:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.08);
      color: #FFF;
    }
    .btn-reset:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .btn-save {
      background: linear-gradient(135deg, #F47B20, #D26E2D);
      border: none;
      color: #FFF;
      padding: 10px 22px;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(244, 123, 32, 0.35);
      transition: all 0.2s ease;
    }
    .btn-save:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 22px rgba(244, 123, 32, 0.5);
    }

    /* Keyframes */
    @keyframes sectionIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes motionFade { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
    @keyframes motionSlide { 0%, 100% { transform: translateX(-6px); } 50% { transform: translateX(6px); } }
    @keyframes motionScale { 0%, 100% { transform: scale(0.85); } 50% { transform: scale(1.1); } }

    /* ── Hero Banners & Tips Bento ── */
    .head-icon.banners {
      background: rgba(59, 130, 246, 0.15);
      color: #3B82F6;
    }
    .banner-tips-bento {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .tip-card {
      display: flex;
      gap: 14px;
      padding: 16px 18px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      align-items: flex-start;
    }
    .tip-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: rgba(244, 123, 32, 0.1);
      color: #F47B20;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .tip-content strong {
      display: block;
      font-size: 0.86rem;
      font-weight: 700;
      color: #EDEDED;
      margin-bottom: 4px;
    }
    .tip-content p {
      font-size: 0.78rem;
      color: #A1A1AA;
      line-height: 1.45;
      margin: 0;
    }
    .tip-content code {
      background: rgba(255, 255, 255, 0.06);
      color: #F47B20;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.74rem;
      font-family: monospace;
    }

    /* ══════════════════════════════════════════════════ */
    /* ── 6. DESCRIÇÃO DE APRESENTAÇÃO (ESTILOS) ── */
    /* ══════════════════════════════════════════════════ */
    .intro-editor-grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 22px;
      align-items: stretch;
    }
    .intro-inputs-panel {
      display: flex;
      flex-direction: column;
      gap: 16px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 20px;
    }
    .intro-toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .toggle-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .toggle-label {
      font-size: 0.92rem;
      font-weight: 700;
      color: #FFF;
    }
    .toggle-desc {
      font-size: 0.78rem;
      color: #71717A;
    }
    .intro-field-wrap {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .field-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .field-label {
      font-size: 0.82rem;
      font-weight: 600;
      color: #A1A1AA;
    }
    .char-pill {
      font-size: 0.72rem;
      font-weight: 600;
      color: #71717A;
      background: rgba(255, 255, 255, 0.04);
      padding: 2px 6px;
      border-radius: 6px;
    }
    .intro-text-input {
      width: 100%;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px 14px;
      color: #FFF;
      font-size: 0.9rem;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      box-sizing: border-box;
    }
    .intro-text-input:focus {
      outline: none;
      border-color: #F47B20;
      box-shadow: 0 0 0 2px rgba(244, 123, 32, 0.2);
    }
    .intro-textarea {
      width: 100%;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px 14px;
      color: #FFF;
      font-size: 0.88rem;
      line-height: 1.5;
      resize: vertical;
      min-height: 105px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      box-sizing: border-box;
    }
    .intro-textarea:focus {
      outline: none;
      border-color: #F47B20;
      box-shadow: 0 0 0 2px rgba(244, 123, 32, 0.2);
    }
    .intro-behavior-hint {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 12px;
      background: rgba(244, 123, 32, 0.06);
      border: 1px solid rgba(244, 123, 32, 0.15);
      border-radius: 10px;
      color: #D26E2D;
      font-size: 0.76rem;
      line-height: 1.4;
    }
    .intro-behavior-hint svg {
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* Live Preview Box */
    .intro-live-preview-box {
      display: flex;
      flex-direction: column;
      background: #0D0D10;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      overflow: hidden;
    }
    .preview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.03);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .preview-badge {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #A1A1AA;
    }
    .preview-palette-tag {
      font-size: 0.74rem;
      font-weight: 600;
    }
    .intro-preview-stage {
      position: relative;
      padding: 24px 20px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 220px;
      overflow: hidden;
    }
    .preview-mock-hero {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.7) 100%), url('https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=50');
      background-size: cover;
      background-position: center;
      opacity: 0.45;
      filter: blur(1px);
      display: flex;
      align-items: flex-end;
      padding: 10px;
    }
    .mock-hero-tag {
      font-size: 0.65rem;
      font-weight: 700;
      color: rgba(255,255,255,0.7);
      background: rgba(0,0,0,0.6);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .intro-preview-card {
      position: relative;
      z-index: 2;
      background: rgba(255, 255, 255, 0.07);
      backdrop-filter: blur(24px) saturate(190%);
      -webkit-backdrop-filter: blur(24px) saturate(190%);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 20px;
      padding: 18px 20px;
      box-shadow: 
        0 8px 32px 0 rgba(0, 0, 0, 0.08),
        inset 0 1px 1px 0 rgba(255, 255, 255, 0.2);
      transition: all 0.3s ease;
    }
    .intro-preview-card.preview-disabled {
      opacity: 0.35;
      filter: grayscale(0.8);
    }
    .preview-card-texts {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
    }
    .preview-card-title {
      font-size: 0.98rem;
      font-weight: 700;
      margin: 0;
      line-height: 1.3;
    }
    .preview-card-desc {
      font-size: 0.82rem;
      margin: 0;
      line-height: 1.5;
    }
    .preview-disabled-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 3;
      background: rgba(239, 68, 68, 0.85);
      color: #FFF;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 20px;
    }

    @media (max-width: 900px) {
      .intro-editor-grid {
        grid-template-columns: 1fr;
      }
    }

    .hero-target-selector-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 14px;
    }
    .target-selector-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .target-selector-title {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.84rem;
      font-weight: 700;
      color: #E4E4E7;
    }
    .target-current-badge {
      font-size: 0.74rem;
      color: #A1A1AA;
    }
    .target-current-badge strong {
      color: #F47B20;
    }
    .hero-targets-scroll {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: thin;
    }
    .hero-target-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #D4D4D8;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
    }
    .hero-target-chip:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(244, 123, 32, 0.4);
    }
    .hero-target-chip.active {
      background: #F47B20;
      border-color: #F47B20;
      color: #FFF;
      box-shadow: 0 4px 14px rgba(244, 123, 32, 0.35);
    }
    .target-chip-count {
      font-size: 0.68rem;
      padding: 1px 5px;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.3);
      color: #D4D4D8;
    }
    .target-chip-count.has-banners {
      background: rgba(34, 197, 94, 0.2);
      color: #4ADE80;
    }
    .hero-scope-selector-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 16px 18px;
      margin-bottom: 20px;
    }
    .hero-scope-header {
      margin-bottom: 14px;
    }
    .scope-title {
      font-size: 0.92rem;
      font-weight: 700;
      color: #FFF;
      display: block;
      margin-bottom: 2px;
    }
    .scope-subtitle {
      font-size: 0.76rem;
      color: #A1A1AA;
      display: block;
      line-height: 1.35;
    }
    .hero-scope-options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    @media (max-width: 640px) {
      .hero-scope-options {
        grid-template-columns: 1fr;
      }
    }
    .hero-scope-btn {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1.5px solid rgba(255, 255, 255, 0.08);
      color: #D4D4D8;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s ease;
    }
    .hero-scope-btn:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.16);
    }
    .hero-scope-btn.active {
      background: rgba(244, 123, 32, 0.1);
      border-color: #F47B20;
      color: #FFF;
      box-shadow: 0 0 16px rgba(244, 123, 32, 0.15);
    }
    .scope-btn-indicator {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.3);
      margin-top: 2px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    .hero-scope-btn.active .scope-btn-indicator {
      border-color: #F47B20;
    }
    .radio-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #F47B20;
      transform: scale(0);
      transition: transform 0.2s ease;
    }
    .hero-scope-btn.active .radio-dot {
      transform: scale(1);
    }
    .scope-btn-content {
      flex: 1;
      min-width: 0;
    }
    .scope-btn-title-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .scope-btn-icon {
      font-size: 1rem;
    }
    .scope-btn-title {
      font-size: 0.85rem;
      font-weight: 700;
    }
    .scope-btn-desc {
      font-size: 0.74rem;
      color: #A1A1AA;
      line-height: 1.35;
      margin: 0;
    }
    .hero-scope-notice {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.25);
      border-radius: 10px;
      color: #93C5FD;
      font-size: 0.76rem;
      margin-bottom: 16px;
      line-height: 1.4;
    }
    .category-hero-toggle-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 18px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      margin-bottom: 20px;
    }
    .toggle-title {
      font-size: 0.88rem;
      font-weight: 700;
      color: #FFF;
      display: block;
      margin-bottom: 2px;
    }
    .toggle-subtitle {
      font-size: 0.76rem;
      color: #A1A1AA;
      display: block;
      line-height: 1.35;
    }

    .add-banner-box {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .banner-mode-selector {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    .mode-tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #A1A1AA;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .mode-tab-btn.active {
      background: #F47B20;
      border-color: #F47B20;
      color: #FFF;
      box-shadow: 0 4px 12px rgba(244, 123, 32, 0.3);
    }
    .banner-dropzone {
      border: 2px dashed rgba(255, 255, 255, 0.15);
      border-radius: 14px;
      padding: 28px 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background: rgba(255, 255, 255, 0.01);
    }
    .banner-dropzone:hover {
      border-color: #F47B20;
      background: rgba(244, 123, 32, 0.04);
    }
    .banner-drop-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .banner-drop-info svg {
      color: #F47B20;
    }
    .drop-title {
      font-size: 0.88rem;
      font-weight: 600;
      color: #EDEDED;
    }
    .drop-sub {
      font-size: 0.74rem;
      color: #71717A;
    }
    .banner-url-row {
      display: flex;
      gap: 10px;
    }
    .banner-url-input {
      flex: 1;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 10px 14px;
      color: #FFF;
      font-size: 0.86rem;
    }
    .banner-url-input:focus {
      outline: none;
      border-color: #F47B20;
    }
    .btn-add-banner {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      border-radius: 10px;
      background: #F47B20;
      border: none;
      color: #FFF;
      font-weight: 600;
      font-size: 0.82rem;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .btn-add-banner:hover:not(:disabled) {
      background: #E06010;
    }
    .btn-add-banner:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .banner-limit-notice {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
      background: rgba(244, 123, 32, 0.1);
      border: 1px solid rgba(244, 123, 32, 0.25);
      border-radius: 12px;
      color: #F47B20;
      font-size: 0.84rem;
      font-weight: 600;
      margin-bottom: 24px;
    }
    .banners-current-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px;
    }
    .banner-thumb-card {
      border-radius: 14px;
      overflow: hidden;
      background: #1A1A1E;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
      transition: transform 0.2s ease, border-color 0.2s ease;
    }
    .banner-thumb-card:hover {
      transform: translateY(-3px);
      border-color: rgba(244, 123, 32, 0.4);
    }
    .thumb-img-wrap {
      position: relative;
      width: 100%;
      height: 120px;
      background: #111;
      overflow: hidden;
    }
    .banner-img-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .thumb-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .banner-thumb-card:hover .thumb-overlay {
      opacity: 1;
    }
    .btn-del-banner {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 8px;
      background: rgba(239, 68, 68, 0.9);
      border: none;
      color: #FFF;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
      transition: background 0.15s ease;
    }
    .btn-del-banner:hover {
      background: #DC2626;
    }
    .thumb-info {
      padding: 10px 14px;
      background: #16161A;
    }
    .thumb-index-tag {
      font-size: 0.74rem;
      font-weight: 700;
      color: #A1A1AA;
    }
    .banner-empty {
      grid-column: 1 / -1;
      padding: 24px;
      text-align: center;
      color: #71717A;
      font-size: 0.86rem;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 12px;
      border: 1px dashed rgba(255, 255, 255, 0.08);
    }

    /* Responsive */
    @media (max-width: 1100px) {
      .palettes-grid { grid-template-columns: repeat(2, 1fr); }
      .fonts-selection-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 680px) {
      .templates-grid { grid-template-columns: 1fr; }
      .palettes-grid { grid-template-columns: 1fr; }
      .color-tokens-grid { grid-template-columns: 1fr; }
      .fonts-selection-grid { grid-template-columns: 1fr; }
      .motion-grid { grid-template-columns: repeat(2, 1fr); }
      .banners-current-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class DesignEditorComponent {
  @Output() onToast = new EventEmitter<string>();

  templates = AVAILABLE_TEMPLATES;
  palettes = AVAILABLE_PALETTES;
  headingFonts = AVAILABLE_HEADING_FONTS;
  bodyFonts = AVAILABLE_BODY_FONTS;
  fontPairs = AVAILABLE_FONT_PAIRS;

  colorTokenList: { key: keyof PaletteColors; label: string; description: string }[] = [
    { key: 'primary', label: 'Cor Primária', description: 'Botões de ação e identidade' },
    { key: 'secondary', label: 'Cor Secundária', description: 'Bordas e detalhes secundários' },
    { key: 'accent', label: 'Destaque & Preços', description: 'Preços, ofertas e badges de foco' },
    { key: 'background', label: 'Fundo da Página', description: 'Fundo geral do cardápio' },
    { key: 'surface', label: 'Fundo dos Cards', description: 'Superfície dos produtos e modais' },
    { key: 'textPrimary', label: 'Texto Principal', description: 'Nomes dos pratos e títulos' },
    { key: 'textSecondary', label: 'Texto Secundário', description: 'Descrições e textos de apoio' }
  ];

  motionOptions = [
    { key: 'fade' as const, label: 'Fade Suave' },
    { key: 'slide' as const, label: 'Slide Lateral' },
    { key: 'scale' as const, label: 'Scale Pop' },
    { key: 'none' as const, label: 'Instantâneo' }
  ];

  constructor(
    public designService: DesignService,
    public menuService: MenuService
  ) { }

  selectTemplate(key: string): void {
    this.designService.setTemplate(key);
    this.onToast.emit('Estrutura do template atualizada. Suas cores e fontes continuam salvas!');
  }

  selectPalette(pal: PaletteConfig): void {
    this.designService.setPalette(pal);
  }

  enableCustomPalette(): void {
    const current = this.designService.draft().palette;
    if (!current.isCustom) {
      this.designService.setPalette({
        key: 'custom',
        name: 'Personalizada',
        isCustom: true,
        colors: { ...current.colors }
      });
    }
  }

  onColorChange(tokenKey: keyof PaletteColors, event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.designService.setCustomColor(tokenKey, val);
  }

  onHexInputChange(tokenKey: keyof PaletteColors, event: Event): void {
    let val = (event.target as HTMLInputElement).value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(val)) {
      this.designService.setCustomColor(tokenKey, val);
    }
  }

  selectHeadingFont(family: string): void {
    this.designService.setHeadingFont(family);
  }

  selectBodyFont(family: string): void {
    this.designService.setBodyFont(family);
  }

  applyPreset(preset: FontPairPreset): void {
    this.designService.setFontPair(preset.key);
    this.onToast.emit(`Combinação aplicada: ${preset.heading} + ${preset.body}`);
  }

  selectMotion(key: 'fade' | 'slide' | 'scale' | 'none'): void {
    this.designService.setMotion(key);
  }

  toggleBlock(blockId: string): void {
    this.designService.toggleHomeBlock(blockId);
  }

  // ── Drag & Drop de Blocos ──
  draggedBlockIndex: number | null = null;
  dragOverBlockIndex: number | null = null;

  onBlockDragStart(event: DragEvent, index: number): void {
    this.draggedBlockIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index.toString());
    }
  }

  onListDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onBlockDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverBlockIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onBlockDragLeave(event: DragEvent, index: number): void {
    if (this.dragOverBlockIndex === index) {
      this.dragOverBlockIndex = null;
    }
  }

  onBlockDrop(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.draggedBlockIndex !== null && this.draggedBlockIndex !== targetIndex) {
      this.designService.moveBlock(this.draggedBlockIndex, targetIndex);
      this.onToast.emit('Hierarquia dos blocos atualizada com sucesso!');
    }
    this.draggedBlockIndex = null;
    this.dragOverBlockIndex = null;
  }

  // ── Gestão de Blocos da Vitrine & Estrutura ──

  get fixedBlocks(): HomeBlock[] {
    return this.designService.draft().homeBlocks.filter(b => b.type === 'hero' || b.type === 'categories');
  }

  get showcaseBlocks(): HomeBlock[] {
    return this.designService.draft().homeBlocks.filter(b => b.type !== 'hero' && b.type !== 'categories');
  }

  moveShowcaseBlockUp(index: number): void {
    if (index > 0) {
      const list = [...this.showcaseBlocks];
      const [moved] = list.splice(index, 1);
      list.splice(index - 1, 0, moved);
      this.reorderShowcase(list);
      this.onToast.emit('Bloco movido para cima');
    }
  }

  moveShowcaseBlockDown(index: number): void {
    const list = [...this.showcaseBlocks];
    if (index < list.length - 1) {
      const [moved] = list.splice(index, 1);
      list.splice(index + 1, 0, moved);
      this.reorderShowcase(list);
      this.onToast.emit('Bloco movido para baixo');
    }
  }

  onShowcaseDragStart(event: DragEvent, index: number): void {
    this.draggedBlockIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index.toString());
    }
  }

  onShowcaseDrop(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.draggedBlockIndex !== null && this.draggedBlockIndex !== targetIndex) {
      const list = [...this.showcaseBlocks];
      const [moved] = list.splice(this.draggedBlockIndex, 1);
      list.splice(targetIndex, 0, moved);
      this.reorderShowcase(list);
      this.onToast.emit('Ordem dos blocos de destaque atualizada!');
    }
    this.draggedBlockIndex = null;
    this.dragOverBlockIndex = null;
  }

  private reorderShowcase(reordered: HomeBlock[]): void {
    const fixed = this.fixedBlocks;
    const combined = [
      ...fixed.map((b, i) => ({ ...b, position: i })),
      ...reordered.map((b, i) => ({ ...b, position: fixed.length + i }))
    ];
    this.designService.reorderHomeBlocks(combined);
  }

  onBlockDragEnd(): void {
    this.draggedBlockIndex = null;
    this.dragOverBlockIndex = null;
  }

  moveBlockUp(index: number): void {
    if (index > 0) {
      this.designService.moveBlock(index, index - 1);
      this.onToast.emit('Bloco movido para cima');
    }
  }

  moveBlockDown(index: number): void {
    const total = this.designService.draft().homeBlocks.length;
    if (index < total - 1) {
      this.designService.moveBlock(index, index + 1);
      this.onToast.emit('Bloco movido para baixo');
    }
  }

  resetDraft(): void {
    this.designService.resetDraft();
    this.onToast.emit('Alterações descartadas. Retornado ao último estado salvo.');
  }

  saveDraft(): void {
    this.designService.saveDesign().subscribe({
      next: () => this.onToast.emit('Configurações de design salvas com sucesso!'),
      error: () => this.onToast.emit('Design salvo localmente.')
    });
  }

  newBannerUrl = '';
  bannerInputMode: 'upload' | 'url' = 'upload';
  selectedHeroCategory: 'home' | string = 'home';

  selectHeroCategory(target: 'home' | string): void {
    this.selectedHeroCategory = target;
    this.designService.setPreviewCategory(target === 'home' ? null : target);
  }

  get activeHeroCategoryName(): string {
    if (this.selectedHeroCategory === 'home') return 'Início / Geral';
    const cat = this.menuService.categories().find(c => c.id === this.selectedHeroCategory);
    return cat ? cat.name : 'Categoria';
  }

  get isCurrentHeroEnabled(): boolean {
    if (this.selectedHeroCategory === 'home') {
      const heroBlock = this.designService.draft().homeBlocks.find(b => b.type === 'hero');
      return heroBlock ? heroBlock.enabled : true;
    }
    return this.designService.getCategoryHeroConfig(this.selectedHeroCategory).enabled !== false;
  }

  toggleCurrentHero(): void {
    if (this.selectedHeroCategory === 'home') {
      this.designService.toggleHomeBlock('block_hero');
    } else {
      const current = this.isCurrentHeroEnabled;
      this.designService.setCategoryHeroEnabled(this.selectedHeroCategory, !current);
    }
    this.onToast.emit(`Hero Section ${this.isCurrentHeroEnabled ? 'ativada' : 'desativada'} em ${this.activeHeroCategoryName}`);
  }

  get currentHeroBanners(): string[] {
    if (this.selectedHeroCategory === 'home') {
      return this.designService.draft().heroBanners || [];
    }
    return this.designService.getCategoryHeroConfig(this.selectedHeroCategory).banners || [];
  }

  get currentMaxBanners(): number {
    return this.selectedHeroCategory === 'home' ? 5 : 3;
  }

  addBannerFromUrl(): void {
    const url = this.newBannerUrl.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:image/')) {
      this.onToast.emit('Insira uma URL de imagem válida (começando com https://).');
      return;
    }
    if (this.selectedHeroCategory === 'home') {
      this.designService.addHeroBanner(url);
    } else {
      this.designService.addCategoryHeroBanner(this.selectedHeroCategory, url);
    }
    this.newBannerUrl = '';
    this.onToast.emit(`Banner adicionado a ${this.activeHeroCategoryName}!`);
  }

  onBannerFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      this.onToast.emit('Formato inválido. Selecione uma imagem JPG, PNG ou WebP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.onToast.emit('A imagem do banner excede o limite de 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      if (this.selectedHeroCategory === 'home') {
        this.designService.addHeroBanner(url);
      } else {
        this.designService.addCategoryHeroBanner(this.selectedHeroCategory, url);
      }
      this.onToast.emit(`Banner carregado e adicionado a ${this.activeHeroCategoryName}!`);
    };
    reader.readAsDataURL(file);
  }

  removeBanner(index: number): void {
    if (this.selectedHeroCategory === 'home') {
      this.designService.removeHeroBanner(index);
    } else {
      this.designService.removeCategoryHeroBanner(this.selectedHeroCategory, index);
    }
    this.onToast.emit('Banner removido.');
  }

  isDarkPalette(pal: PaletteConfig): boolean {
    const bg = pal.colors.background.toLowerCase();
    return bg.startsWith('#0') || bg.startsWith('#1');
  }

  // ── Controle do Bloco de Apresentação ──
  toggleIntroCardEnabled(): void {
    const current = this.designService.introCard();
    this.designService.setIntroCard({ enabled: !current.enabled });
    this.onToast.emit(current.enabled ? 'Bloco de apresentação desativado' : 'Bloco de apresentação ativado');
  }

  onIntroTitleChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.designService.setIntroCard({ title: value });
  }

  onIntroDescChange(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.designService.setIntroCard({ description: value });
  }
}
