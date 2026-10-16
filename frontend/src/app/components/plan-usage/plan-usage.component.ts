import { Component, Input, Output, EventEmitter } from '@angular/core';
import { AuthService } from '../../services/auth.service';
@Component({
  selector: 'app-plan-usage',
  standalone: true,
  template: ` <section
    class="usage-card"
    [class.usage-card--compact]="compact"
    aria-label="Plano e uso"
  >
    <div class="usage-heading">
      @if (compact) {
        <span class="plan-icon" aria-hidden="true"
          ><svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linejoin="round"
          >
            <path d="m2 7 5 4 5-7 5 7 5-4-3 13H5L2 7Z" />
            <path d="M6 17h12" /></svg
        ></span>
        <div class="plan-copy">
          <h2>Plano {{ auth.account()?.plan?.name || 'atual' }}</h2>
          <p>Seu cardápio com mais recursos e possibilidades.</p>
        </div>
      } @else {
        <h2>{{ auth.account()?.plan?.name || 'Seu plano' }} · uso atual</h2>
      }
      <button type="button" (click)="compare.emit()">Comparar planos</button>
    </div>
    @if (!auth.account()) {
      <p role="status">Atualizando os limites da sua conta…</p>
    } @else {
      @for (row of rows; track row.resource) {
        <div class="usage-row">
          <div class="usage-label">
            <span>{{ row.label }}</span
            ><span>{{
              compact && limit(row.key) === 0
                ? 'Não incluído'
                : used(row.resource) + ' / ' + (limit(row.key) ?? '—')
            }}</span>
          </div>
          <div
            class="meter"
            role="progressbar"
            [attr.aria-label]="row.label"
            [attr.aria-valuenow]="limit(row.key) === null ? null : used(row.resource)"
            [attr.aria-valuemin]="0"
            [attr.aria-valuemax]="max(limit(row.key) ?? 0, used(row.resource), compact ? 1 : 0)"
            [attr.aria-valuetext]="
              !compact
                ? null
                : limit(row.key) === 0
                  ? 'Não incluído no plano'
                  : limit(row.key) === null
                    ? 'Limite indisponível'
                    : used(row.resource) + ' de ' + limit(row.key)
            "
          >
            <span
              [class.full]="
                limit(row.key) !== null &&
                (!compact || limit(row.key)! > 0) &&
                used(row.resource) >= limit(row.key)!
              "
              [style.transform]="'scaleX(' + ratio(row.resource, row.key) + ')'"
            ></span>
          </div>
          @if (compact && limit(row.key) === null) {
            <p class="limit-note">Limite indisponível.</p>
          } @else if (compact && limit(row.key) === 0) {
            <p class="limit-note">Não incluído no plano.</p>
          } @else if (used(row.resource) >= limit(row.key)!) {
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
      /* Opt-in Home composition; the settings layout retains its original form. */
      .usage-card--compact {
        margin: 0;
        padding: 20px 22px;
        background: var(--panel-surface, #202023);
        color: var(--panel-text, #fff8e6);
        border-color: var(--panel-border, #ffffff14);
        border-radius: 18px;
        box-shadow: 0 3px 12px #0000000c;
        display: grid;
        grid-template-columns: minmax(0, 1.8fr) repeat(3, minmax(0, 1fr));
        gap: 20px;
      }
      .usage-card--compact .usage-heading {
        grid-column: 1;
        gap: 12px;
        flex-wrap: nowrap;
        margin: 0;
      }
      .usage-card--compact .plan-icon {
        display: grid;
        place-items: center;
        width: 54px;
        height: 60px;
        flex-shrink: 0;
        border-radius: 14px;
        background: #f47b201a;
        color: var(--panel-accent);
      }
      .usage-card--compact .plan-copy {
        min-width: 0;
      }
      .usage-card--compact h2 {
        margin: 0;
        color: var(--panel-accent) !important;
        font-size: 22px;
      }
      .usage-card--compact .plan-copy p {
        margin-top: 5px;
        color: var(--panel-text-soft);
        font-size: 13px;
        line-height: 1.5;
      }
      .usage-card--compact .usage-heading > button {
        border: 1px solid var(--panel-accent);
        border-radius: 24px;
        padding: 8px 14px;
        min-height: 40px;
        text-decoration: none;
        white-space: nowrap;
        color: var(--panel-accent);
      }
      .usage-card--compact .usage-heading > button:hover {
        background: var(--panel-fill-hover);
      }
      .usage-card--compact .usage-row {
        min-width: 0;
        margin: 0;
        padding-left: 20px;
        border-left: 1px solid var(--panel-border-strong);
        align-self: center;
      }
      .usage-card--compact .usage-label {
        flex-direction: column;
        gap: 5px;
        font-size: 13px;
        color: var(--panel-text-soft);
      }
      .usage-card--compact .usage-label > span:last-child {
        color: var(--panel-text);
        font-weight: 600;
        font-size: 15px;
        font-variant-numeric: tabular-nums;
      }
      .usage-card--compact .meter {
        background: var(--panel-surface-strong);
        height: 6px;
      }
      .usage-card--compact .meter span {
        background: var(--panel-accent);
        border-radius: inherit;
      }
      .usage-card--compact .meter span.full {
        background: #e85b70;
      }
      .usage-card--compact .limit-note,
      .usage-card--compact .near-note {
        color: var(--panel-text-soft);
        font-size: 12px;
      }
      @container home (max-width: 1150px) {
        .usage-card--compact {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }
        .usage-card--compact .usage-heading {
          grid-column: 1 / -1;
        }
        .usage-card--compact .usage-heading > button {
          margin-left: auto;
        }
        .usage-card--compact .usage-row:nth-child(2) {
          padding-left: 0;
          border-left: 0;
        }
      }
      @container home (max-width: 640px) {
        .usage-card--compact {
          grid-template-columns: minmax(0, 1fr);
          padding: 20px;
          gap: 18px;
        }
        .usage-card--compact .usage-heading {
          flex-wrap: wrap;
        }
        .usage-card--compact .plan-icon {
          width: 44px;
          height: 48px;
        }
        .usage-card--compact .plan-copy {
          flex: 1;
        }
        .usage-card--compact h2 {
          font-size: 22px;
        }
        .usage-card--compact .usage-heading > button {
          width: 100%;
          margin: 2px 0 0;
        }
        .usage-card--compact .usage-row {
          padding: 0;
          border: 0;
          width: 100%;
        }
        .usage-card--compact .usage-label {
          flex-direction: row;
          justify-content: space-between;
        }
      }
    `,
  ],
})
export class PlanUsageComponent {
  @Input() compact = false;
  @Output() compare = new EventEmitter<void>();
  max = Math.max;
  rows = [
    { resource: 'products', label: 'Produtos', key: 'MAX_PRODUCTS' },
    { resource: 'categories', label: 'Categorias', key: 'MAX_CATEGORIES' },
    { resource: 'videos', label: 'Vídeos', key: 'MAX_VIDEOS' },
  ];
  constructor(public auth: AuthService) {}
  used(resource: string) {
    const value = this.auth.account()?.usage?.[resource];
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
  }
  limit(key: string) {
    const value = this.auth.account()?.entitlements?.[key];
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, value)
      : this.compact
        ? null
        : 0;
  }
  ratio(resource: string, key: string) {
    return Math.min(1, this.used(resource) / Math.max(1, this.limit(key) ?? 0));
  }
}
