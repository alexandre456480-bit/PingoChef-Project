import { Component, Output, EventEmitter } from '@angular/core';
import { AuthService } from '../../services/auth.service';
@Component({
  selector: 'app-plan-usage',
  standalone: true,
  template: ` <section class="usage-card" aria-label="Plano e uso">
    <div class="usage-heading">
      <h2>{{ auth.account()?.plan?.name || 'Seu plano' }} · uso atual</h2>
      <button type="button" (click)="compare.emit()">Comparar planos</button>
    </div>
    @if (!auth.account()) {
      <p role="status">Atualizando os limites da sua conta…</p>
    } @else {
      @for (row of rows; track row.resource) {
        <div class="usage-row">
          <div class="usage-label">
            <span>{{ row.label }}</span
            ><span>{{ used(row.resource) }} / {{ limit(row.key) }}</span>
          </div>
          <div
            class="meter"
            role="progressbar"
            [attr.aria-label]="row.label"
            [attr.aria-valuenow]="used(row.resource)"
            [attr.aria-valuemin]="0"
            [attr.aria-valuemax]="max(limit(row.key), used(row.resource))"
          >
            <span
              [class.full]="used(row.resource) >= limit(row.key)"
              [style.transform]="'scaleX(' + ratio(row.resource, row.key) + ')'"
            ></span>
          </div>
          @if (used(row.resource) >= limit(row.key)) {
            <p class="limit-note">
              Limite atingido. Seus itens existentes continuam disponíveis para edição.
              <button (click)="compare.emit()">Ver opções de plano</button>
            </p>
          } @else if (ratio(row.resource, row.key) >= 0.8) {
            <p class="near-note">Você está próximo do limite de {{ row.label.toLowerCase() }}.</p>
          }
        </div>
      }
    }
  </section>`,
  styles: [
    `
      :host {
        display: block;
      }
      .usage-card {
        background: var(--pc-surface, #fff9f4);
        color: var(--pc-text, #2d1b2e);
        border: 1px solid var(--pc-border, #ddcccf);
        border-radius: 20px;
        padding: 22px;
        margin: 0 0 24px;
        box-shadow: 0 8px 24px #2c10240c;
      }
      .usage-heading {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }
      h2 {
        font:
          600 19px Outfit,
          sans-serif;
      }
      button {
        color: var(--pc-link, #691525);
        background: none;
        border: none;
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 3px;
        font:
          600 13px Inter,
          sans-serif;
        min-height: 32px;
      }
      .usage-row {
        margin: 16px 0;
      }
      .usage-label {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 14px;
        margin-bottom: 8px;
      }
      .meter {
        height: 7px;
        overflow: hidden;
        background: var(--pc-track, #eadbdc);
        border-radius: 99px;
      }
      .meter span {
        height: 100%;
        display: block;
        background: #8a2338;
        transform-origin: left;
        transition: transform 180ms;
      }
      .meter span.full {
        background: #c94a55;
      }
      .limit-note,
      .near-note {
        font-size: 13px;
        line-height: 1.6;
        margin-top: 8px;
        color: var(--pc-muted, #725f68);
      }
      :focus-visible {
        outline: 3px solid #f47b2080;
        outline-offset: 2px;
      }
      @media (prefers-reduced-motion: reduce) {
        .meter span {
          transition: none;
        }
      }
    `,
  ],
})
export class PlanUsageComponent {
  @Output() compare = new EventEmitter<void>();
  max = Math.max;
  rows = [
    { resource: 'products', label: 'Produtos', key: 'MAX_PRODUCTS' },
    { resource: 'categories', label: 'Categorias', key: 'MAX_CATEGORIES' },
    { resource: 'videos', label: 'Vídeos', key: 'MAX_VIDEOS' },
  ];
  constructor(public auth: AuthService) {}
  used(resource: string) {
    return this.auth.account()?.usage?.[resource] ?? 0;
  }
  limit(key: string) {
    return this.auth.account()?.entitlements?.[key] ?? 0;
  }
  ratio(resource: string, key: string) {
    return Math.min(1, this.used(resource) / Math.max(1, this.limit(key)));
  }
}
