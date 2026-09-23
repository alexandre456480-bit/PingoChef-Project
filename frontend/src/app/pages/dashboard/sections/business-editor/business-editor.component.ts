import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-business-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="business-container">
      <!-- Card Principal de Informações do Estabelecimento -->
      <div class="business-card clay-card" style="--i:0">
        <div class="card-header">
          <div class="header-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div>
            <h2 class="card-title">Identidade do Estabelecimento</h2>
            <p class="card-subtitle">Sincronizado automaticamente no painel administrativo, tela de Welcome e em todas as páginas do cardápio digital</p>
          </div>
        </div>

        <form (ngSubmit)="save()" class="form-layout">
          <!-- ── 1. Upload da Logo Oficial ── -->
          <div class="section-block" style="--i:1">
            <div class="block-title-row">
              <label class="block-title">Logo da Empresa</label>
              <span class="badge-sync">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                Visível em todo o cardápio e Welcome
              </span>
            </div>

            <div class="upload-zone">
              <div class="upload-preview">
                @if (logoPreview) {
                  <img [src]="logoPreview" alt="Logo" class="logo-img" />
                } @else {
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect width="18" height="18" x="3" y="3" rx="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                }
              </div>

              <div class="upload-info">
                <span class="upload-label">Imagem da Marca</span>
                <span class="upload-hint">PNG transparente, WebP ou JPEG · Máx. 8MB</span>
                <div class="upload-actions">
                  <label class="upload-btn">
                    <input type="file" accept="image/jpeg,image/png,image/webp" (change)="onLogoSelect($event)" hidden />
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                    Selecionar Logo
                  </label>
                  @if (logoPreview) {
                    <button type="button" class="btn-remove-file" (click)="removeLogo()" title="Remover logo personalizada">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      Remover
                    </button>
                  }
                </div>
              </div>
            </div>
          </div>

          <!-- ── 2. Campos de Texto Básicos ── -->
          <div class="fields-grid">
            <div class="form-field" style="--i:2">
              <div class="label-row">
                <label>Nome do Estabelecimento <span class="required-star">*</span></label>
                <span class="field-badge">Unificado</span>
              </div>
              <input
                type="text"
                [(ngModel)]="form.name"
                name="bName"
                placeholder="Ex: Hamburgueria & Chopp Artesanal"
                required
                class="field-input"
                (ngModelChange)="onLiveNameChange($event)"
              />
              <span class="field-hint">Aparece na barra superior, na tela Welcome e nos cabeçalhos</span>
            </div>

            <div class="form-field" style="--i:3">
              <div class="label-row">
                <label>Slug da URL Pública <span class="required-star">*</span></label>
              </div>
              <div class="input-addon">
                <span class="addon-prefix">cardapio.app/m/</span>
                <input
                  type="text"
                  [(ngModel)]="form.slug"
                  name="bSlug"
                  placeholder="meu-restaurante"
                  required
                  class="field-input addon-field"
                />
              </div>
              <span class="field-hint">Endereço direto do seu cardápio para os clientes</span>
            </div>

            <div class="form-field full" style="--i:4">
              <div class="label-row">
                <label>Descrição do Negócio <span class="badge-optional">Opcional</span></label>
                <span class="char-count">{{ (form.description || '').length }}/500</span>
              </div>
              <textarea
                [(ngModel)]="form.description"
                name="bDesc"
                maxlength="500"
                placeholder="Apresentação do seu espaço gastronômico, especialidades da casa, proposta culinária..."
                class="field-input field-textarea"
                (ngModelChange)="onLiveDescriptionChange($event)">
              </textarea>
              <span class="field-hint">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -1px; margin-right: 3px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                Texto de acolhimento exibido no centro da tela de entrada (Welcome) do cardápio digital
              </span>
            </div>
          </div>

          <!-- ── 3. Configuração de Background da Página Welcome ── -->
          <div class="welcome-bg-section" style="--i:5">
            <div class="section-title-box">
              <div class="section-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect width="18" height="18" x="3" y="3" rx="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
              </div>
              <div>
                <h3 class="section-heading">Fundo da Página de Entrada (Welcome)</h3>
                <p class="section-desc">Personalize o fundo da tela de abertura. Os efeitos dinâmicos de luz, vinheta e ambient glow permanecem ativos em ambos os modos.</p>
              </div>
            </div>

            <!-- Seletor de Tipo: Com Imagem vs Cor Sólida -->
            <div class="bg-mode-selector">
              <button
                type="button"
                class="mode-btn"
                [class.active]="form.welcome_bg_type === 'image'"
                (click)="setBgType('image')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                Com Imagem de Fundo
              </button>

              <button
                type="button"
                class="mode-btn"
                [class.active]="form.welcome_bg_type === 'color'"
                (click)="setBgType('color')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
                Cor Sólida Personalizada
              </button>
            </div>

            <!-- Conteúdo de Background: Imagem -->
            @if (form.welcome_bg_type === 'image') {
              <div class="bg-image-box">
                <div class="bg-preview-wrap" [style.background-image]="form.welcome_bg_image ? 'url(' + form.welcome_bg_image + ')' : 'none'">
                  <div class="bg-preview-overlay">
                    <span class="preview-badge">Pré-visualização do Fundo</span>
                  </div>
                </div>

                <div class="bg-controls">
                  <span class="bg-info-title">Imagem de Alta Resolução</span>
                  <span class="bg-info-hint">Recomendado: 1200x800 ou superior · Máx. 8MB</span>
                  
                  <div class="upload-actions">
                    <label class="upload-btn">
                      <input type="file" accept="image/jpeg,image/png,image/webp" (change)="onBgImageSelect($event)" hidden />
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                      Trocar Imagem de Fundo
                    </label>
                    <button
                      type="button"
                      class="btn-reset-bg"
                      (click)="resetDefaultBgImage()"
                      title="Restaurar imagem padrão gastronômica">
                      Restaurar Padrão
                    </button>
                  </div>
                </div>
              </div>
            }

            <!-- Conteúdo de Background: Cor Sólida -->
            @if (form.welcome_bg_type === 'color') {
              <div class="bg-color-box">
                <div class="color-picker-row">
                  <div class="color-input-wrap">
                    <input
                      type="color"
                      [(ngModel)]="form.welcome_bg_color"
                      name="wColor"
                      (ngModelChange)="onLiveColorChange($event)"
                      class="native-color-picker"
                      id="welcomeColorPicker"
                    />
                    <label for="welcomeColorPicker" class="color-swatch-display" [style.background-color]="form.welcome_bg_color"></label>
                  </div>

                  <div class="hex-input-group">
                    <span class="hex-label">Código HEX</span>
                    <input
                      type="text"
                      [(ngModel)]="form.welcome_bg_color"
                      name="wColorHex"
                      (ngModelChange)="onLiveColorChange($event)"
                      placeholder="#0F0F12"
                      maxlength="7"
                      class="field-input hex-field"
                    />
                  </div>
                </div>

                <!-- Paleta de Atalhos Sofisticados -->
                <div class="presets-section">
                  <span class="presets-label">Sugestões de Tons Gastronômicos:</span>
                  <div class="presets-grid">
                    @for (preset of colorPresets; track preset.color) {
                      <button
                        type="button"
                        class="preset-pill"
                        [class.active]="form.welcome_bg_color?.toUpperCase() === preset.color.toUpperCase()"
                        (click)="selectColorPreset(preset.color)">
                        <span class="preset-dot" [style.background-color]="preset.color"></span>
                        <span class="preset-name">{{ preset.name }}</span>
                      </button>
                    }
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- ── 4. Ações do Formulário ── -->
          <div class="form-actions" style="--i:6">
            <button type="submit" class="btn-save" [disabled]="isSaving">
              @if (isSaving) {
                <span class="spinner"></span>
                <span>Salvando...</span>
              } @else {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Salvar e Sincronizar</span>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .business-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .clay-card {
      background: #1A1A1E;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 22px;
      padding: 28px;
      box-shadow:
        8px 8px 18px rgba(0, 0, 0, 0.35),
        -4px -4px 12px rgba(255, 255, 255, 0.02),
        inset 1px 1px 2px rgba(255, 255, 255, 0.04);
      animation: cardIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 28px;
    }
    .header-icon {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: rgba(244, 123, 32, 0.1);
      color: #F47B20;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .card-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.2rem;
      font-weight: 700;
      color: #FFF;
      margin: 0;
    }
    .card-subtitle {
      font-size: 0.82rem;
      color: #71717A;
      margin: 4px 0 0 0;
      line-height: 1.4;
    }

    /* ── Seção de Upload da Logo ── */
    .section-block {
      margin-bottom: 24px;
      animation: fieldIn 0.4s calc(var(--i, 0) * 80ms + 100ms) cubic-bezier(0.4, 0, 0.2, 1) both;
    }
    .block-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .block-title {
      font-size: 0.86rem;
      font-weight: 600;
      color: #D4D4D8;
      font-family: 'Inter', sans-serif;
    }
    .badge-sync {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(34, 197, 94, 0.1);
      color: #4ADE80;
      border: 1px solid rgba(34, 197, 94, 0.2);
      padding: 3px 9px;
      border-radius: 12px;
      font-size: 0.72rem;
      font-weight: 600;
    }

    .upload-zone {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 18px 20px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px dashed rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      transition: border-color 0.2s;
    }
    .upload-zone:hover {
      border-color: rgba(244, 123, 32, 0.35);
    }
    .upload-preview {
      width: 82px;
      height: 82px;
      border-radius: 16px;
      background: #141416;
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #3F3F46;
      overflow: hidden;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    .logo-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .upload-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }
    .upload-label {
      font-size: 0.92rem;
      font-weight: 600;
      color: #E4E4E7;
    }
    .upload-hint {
      font-size: 0.76rem;
      color: #71717A;
    }
    .upload-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 8px;
    }
    .upload-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: rgba(244, 123, 32, 0.12);
      border: 1px solid rgba(244, 123, 32, 0.3);
      color: #F47B20;
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .upload-btn:hover {
      background: rgba(244, 123, 32, 0.22);
      border-color: rgba(244, 123, 32, 0.5);
    }
    .btn-remove-file {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: #F87171;
      padding: 8px 14px;
      border-radius: 10px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-remove-file:hover {
      background: rgba(239, 68, 68, 0.2);
    }

    /* ── Campos do Formulário ── */
    .fields-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-bottom: 24px;
    }
    .fields-grid .full {
      grid-column: 1 / -1;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      animation: fieldIn 0.4s calc(var(--i, 0) * 80ms + 100ms) cubic-bezier(0.4, 0, 0.2, 1) both;
    }
    .label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .label-row label {
      font-size: 0.82rem;
      font-weight: 600;
      color: #A1A1AA;
      font-family: 'Inter', sans-serif;
    }
    .required-star {
      color: #F47B20;
    }
    .field-badge {
      font-size: 0.7rem;
      color: #71717A;
      background: rgba(255, 255, 255, 0.04);
      padding: 2px 7px;
      border-radius: 6px;
    }
    .badge-optional {
      font-size: 0.72rem;
      color: #A1A1AA;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 2px 8px;
      border-radius: 8px;
    }
    .field-input {
      background: #141416;
      border: 1px solid rgba(255, 255, 255, 0.08);
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
    .field-hint {
      font-size: 0.75rem;
      color: #71717A;
      margin-top: 2px;
    }
    .field-textarea {
      resize: vertical;
      min-height: 90px;
      line-height: 1.45;
    }

    .input-addon {
      display: flex;
      background: #141416;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      overflow: hidden;
      transition: all 0.2s;
    }
    .input-addon:focus-within {
      border-color: rgba(244, 123, 32, 0.5);
      box-shadow: 0 0 0 3px rgba(244, 123, 32, 0.1);
    }
    .addon-prefix {
      padding: 11px 12px;
      background: rgba(255, 255, 255, 0.03);
      color: #52525B;
      font-size: 0.84rem;
      white-space: nowrap;
      border-right: 1px solid rgba(255, 255, 255, 0.05);
    }
    .addon-field {
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }
    .char-count {
      font-size: 0.72rem;
      color: #52525B;
    }

    /* ── Configuração de Background da Welcome Page ── */
    .welcome-bg-section {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 18px;
      padding: 22px;
      margin-bottom: 24px;
      animation: fieldIn 0.4s calc(var(--i, 0) * 80ms + 100ms) cubic-bezier(0.4, 0, 0.2, 1) both;
    }
    .section-title-box {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 18px;
    }
    .section-icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(244, 123, 32, 0.1);
      color: #F47B20;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .section-heading {
      font-family: 'Outfit', sans-serif;
      font-size: 1.05rem;
      font-weight: 700;
      color: #FFF;
      margin: 0;
    }
    .section-desc {
      font-size: 0.78rem;
      color: #71717A;
      margin: 4px 0 0 0;
      line-height: 1.4;
    }

    .bg-mode-selector {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      background: #141416;
      padding: 6px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      width: fit-content;
    }
    .mode-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 18px;
      border-radius: 10px;
      border: none;
      background: transparent;
      color: #71717A;
      font-size: 0.84rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .mode-btn.active {
      background: rgba(244, 123, 32, 0.15);
      color: #F47B20;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .mode-btn:hover:not(.active) {
      color: #D4D4D8;
    }

    /* Sub-box: Imagem */
    .bg-image-box {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 16px;
      background: #141416;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .bg-preview-wrap {
      width: 140px;
      height: 90px;
      border-radius: 12px;
      background-size: cover;
      background-position: center;
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 14px rgba(0,0,0,0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
      flex-shrink: 0;
    }
    .bg-preview-overlay {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 50% 30%, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.7) 100%);
      display: flex;
      align-items: flex-end;
      padding: 6px;
    }
    .preview-badge {
      font-size: 0.62rem;
      font-weight: 700;
      color: #FFF;
      background: rgba(0,0,0,0.6);
      padding: 2px 6px;
      border-radius: 4px;
      backdrop-filter: blur(4px);
    }
    .bg-controls {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }
    .bg-info-title {
      font-size: 0.88rem;
      font-weight: 600;
      color: #E4E4E7;
    }
    .bg-info-hint {
      font-size: 0.74rem;
      color: #71717A;
    }
    .btn-reset-bg {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #A1A1AA;
      padding: 8px 14px;
      border-radius: 10px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-reset-bg:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #FFF;
    }

    /* Sub-box: Cor */
    .bg-color-box {
      padding: 18px;
      background: #141416;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .color-picker-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .color-input-wrap {
      position: relative;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      border: 2px solid rgba(255, 255, 255, 0.15);
      cursor: pointer;
    }
    .native-color-picker {
      position: absolute;
      opacity: 0;
      width: 100%;
      height: 100%;
      cursor: pointer;
    }
    .color-swatch-display {
      display: block;
      width: 100%;
      height: 100%;
      cursor: pointer;
    }
    .hex-input-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .hex-label {
      font-size: 0.74rem;
      font-weight: 600;
      color: #71717A;
    }
    .hex-field {
      width: 140px;
      font-family: monospace;
      font-weight: 600;
      letter-spacing: 0.5px;
      padding: 8px 12px;
    }

    .presets-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .presets-label {
      font-size: 0.76rem;
      font-weight: 600;
      color: #A1A1AA;
    }
    .presets-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .preset-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 12px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #D4D4D8;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .preset-pill:hover {
      background: rgba(255, 255, 255, 0.07);
      border-color: rgba(255, 255, 255, 0.18);
    }
    .preset-pill.active {
      border-color: #F47B20;
      background: rgba(244, 123, 32, 0.12);
      color: #FFF;
    }
    .preset-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    /* ── Botão Salvar ── */
    .form-actions {
      margin-top: 10px;
      animation: fieldIn 0.4s calc(var(--i, 0) * 80ms + 100ms) cubic-bezier(0.4, 0, 0.2, 1) both;
    }
    .btn-save {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: linear-gradient(135deg, #F47B20 0%, #D26E2D 100%);
      border: none;
      color: #FFF;
      padding: 13px 26px;
      border-radius: 14px;
      font-family: 'Inter', sans-serif;
      font-size: 0.92rem;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(244, 123, 32, 0.3);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .btn-save:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 22px rgba(244, 123, 32, 0.45);
    }
    .btn-save:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #FFF;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes cardIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fieldIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 640px) {
      .fields-grid { grid-template-columns: 1fr; }
      .upload-zone { flex-direction: column; text-align: center; }
      .bg-image-box { flex-direction: column; text-align: center; }
      .bg-preview-wrap { width: 100%; height: 120px; }
      .upload-actions { justify-content: center; }
      .bg-mode-selector { width: 100%; flex-direction: column; }
    }
    @media (prefers-reduced-motion: reduce) {
      .clay-card, .form-field, .upload-zone, .form-actions, .welcome-bg-section { animation: none !important; }
    }
  `]
})
export class BusinessEditorComponent implements OnInit {
  @Output() onToast = new EventEmitter<string>();

  form = {
    name: '',
    slug: '',
    description: '',
    welcome_bg_type: 'image' as 'image' | 'color',
    welcome_bg_image: '',
    welcome_bg_color: '#0F0F12'
  };

  logoPreview: string | null = null;
  isSaving = false;

  readonly defaultCoverImage = 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80';

  readonly colorPresets = [
    { name: 'Carvão Escuro', color: '#0F0F12' },
    { name: 'Vinho Nobre', color: '#1F0A12' },
    { name: 'Café & Malte', color: '#1A110B' },
    { name: 'Azul Meia-Noite', color: '#0A111E' },
    { name: 'Verde Oliva', color: '#0B1A12' },
    { name: 'Preto Absoluto', color: '#000000' }
  ];

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    const biz = this.authService.currentBusiness();
    if (biz) {
      this.populateForm(biz);
    } else {
      // Carrega dados da empresa do servidor
      this.authService.getBusiness().subscribe({
        next: (res: any) => {
          if (res?.data) {
            this.populateForm(res.data);
          }
        },
        error: () => {
          // Fallback caso não esteja logado ou offline
        }
      });
    }
  }

  private populateForm(biz: any): void {
    this.form.name = biz.name || '';
    this.form.slug = biz.slug || '';
    this.form.description = biz.description || '';
    this.logoPreview = biz.logo_url || null;
    this.form.welcome_bg_type = biz.welcome_bg_type || 'image';
    this.form.welcome_bg_image = biz.welcome_bg_image || biz.cover_image_url || this.defaultCoverImage;
    this.form.welcome_bg_color = biz.welcome_bg_color || '#0F0F12';
  }

  onLogoSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      this.onToast.emit('Arquivo muito grande. Limite de 8MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.logoPreview = reader.result as string;
      // Atualiza o preview reativo imediato
      this.syncLiveDraft();
    };
    reader.readAsDataURL(file);
  }

  removeLogo(): void {
    this.logoPreview = null;
    this.syncLiveDraft();
    this.onToast.emit('Logo removida. Salve para confirmar.');
  }

  setBgType(type: 'image' | 'color'): void {
    this.form.welcome_bg_type = type;
    if (type === 'image' && !this.form.welcome_bg_image) {
      this.form.welcome_bg_image = this.defaultCoverImage;
    }
    this.syncLiveDraft();
  }

  onBgImageSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      this.onToast.emit('Imagem muito grande. Limite de 8MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.form.welcome_bg_image = reader.result as string;
      this.syncLiveDraft();
    };
    reader.readAsDataURL(file);
  }

  resetDefaultBgImage(): void {
    this.form.welcome_bg_image = this.defaultCoverImage;
    this.syncLiveDraft();
    this.onToast.emit('Imagem de fundo restaurada para o padrão.');
  }

  selectColorPreset(colorHex: string): void {
    this.form.welcome_bg_color = colorHex;
    this.syncLiveDraft();
  }

  onLiveColorChange(color: string): void {
    this.form.welcome_bg_color = color;
    this.syncLiveDraft();
  }

  onLiveNameChange(name: string): void {
    this.syncLiveDraft();
  }

  onLiveDescriptionChange(desc: string): void {
    this.syncLiveDraft();
  }

  /**
   * Atualiza o signal do currentBusiness em tempo real para alimentar o Phone Preview imediatamente
   */
  private syncLiveDraft(): void {
    const current = this.authService.currentBusiness() || {};
    this.authService.currentBusiness.set({
      ...current,
      name: this.form.name,
      slug: this.form.slug,
      description: this.form.description,
      logo_url: this.logoPreview,
      welcome_bg_type: this.form.welcome_bg_type,
      welcome_bg_image: this.form.welcome_bg_image,
      welcome_bg_color: this.form.welcome_bg_color,
      cover_image_url: this.form.welcome_bg_type === 'image' ? this.form.welcome_bg_image : current.cover_image_url
    });
  }

  save(): void {
    if (!this.form.name || !this.form.name.trim()) {
      this.onToast.emit('O nome do estabelecimento é obrigatório.');
      return;
    }

    if (!this.form.slug || !this.form.slug.trim()) {
      this.onToast.emit('O slug da URL pública é obrigatório.');
      return;
    }

    this.isSaving = true;

    const payload: any = {
      name: this.form.name.trim(),
      slug: this.form.slug.trim().toLowerCase(),
      description: this.form.description?.trim() || '',
      logo_url: this.logoPreview,
      welcome_bg_type: this.form.welcome_bg_type,
      welcome_bg_image: this.form.welcome_bg_image,
      welcome_bg_color: this.form.welcome_bg_color
    };

    // Verificar tamanho estimado do payload para evitar erro de body too large
    const estimatedSize = new Blob([JSON.stringify(payload)]).size;
    const maxPayloadMB = 14; // limite do express.json é 15mb, deixamos margem
    if (estimatedSize > maxPayloadMB * 1024 * 1024) {
      this.isSaving = false;
      this.onToast.emit('A imagem selecionada é muito grande. Tente uma imagem menor (máx. 8MB).');
      return;
    }

    this.authService.updateBusiness(payload).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        if (res.success) {
          this.onToast.emit('Dados da empresa sincronizados e salvos com sucesso!');
        } else {
          this.onToast.emit('Informações salvas localmente.');
        }
      },
      error: (err: any) => {
        this.isSaving = false;
        console.error('[BusinessEditor] Erro ao salvar:', err);

        // Erros de validação do Zod vêm com details
        if (err.error?.error?.code === 'VALIDATION_ERROR' && err.error?.error?.details) {
          const firstError = err.error.error.details[0];
          this.onToast.emit(firstError?.message || 'Dados inválidos. Verifique os campos.');
          return;
        }

        const msg = err.error?.error?.message || 'Erro ao conectar ao servidor. Tente novamente.';
        this.onToast.emit(msg);
      }
    });
  }
}
