import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { MenuItem } from '../../services/menu.service';
import { formatOrderMoney } from '../../models/order-settings';
import { MenuImageDirective } from '../public-menu-view/menu-image.directive';

@Component({
  selector: 'app-cart-recommendation', standalone: true, imports: [MenuImageDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="suggestion" aria-label="Sugestão para acompanhar">
    <header>
      <span class="notification-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4M12 2V1"/></svg></span>
      <div class="notification-heading"><span class="eyebrow">Uma combinação para você</span><h4>Complete seu pedido</h4></div>
      <button type="button" class="dismiss" aria-label="Dispensar sugestão" (click)="dismiss.emit()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
    </header>
    <div class="suggestion-content">
      <button type="button" class="details" [attr.aria-label]="'Ver detalhes de ' + item.name" (click)="details.emit(item)">
        @if (item.imageUrl) { <img [appMenuImage]="item.imageUrl" [alt]="item.name" width="56" height="56" loading="lazy" /> }
        @else { <span class="placeholder" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 12h16M5 12a7 7 0 0 1 14 0M3 16h18M12 5V3"/></svg></span> }
        <span><strong>{{ item.name }}</strong><span class="price">{{ money(price) }}</span></span>
      </button>
      <button type="button" class="add" [attr.aria-label]="'Adicionar ' + item.name + ' ao carrinho'" (click)="add.emit(item)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Adicionar</button>
    </div>
  </section>`,
  styles: [`
    :host { display: block; min-width: 0; margin: 4px 16px 12px; animation: suggestion-arrive .42s cubic-bezier(.16,1,.3,1) both; }
    .suggestion {
      padding: 10px 12px 14px; border: 1px solid color-mix(in srgb,var(--accent-color) 26%,var(--surface-color)); border-radius: 20px;
      background: linear-gradient(130deg,color-mix(in srgb,var(--surface-color) 94%,var(--accent-color)),var(--surface-color));
      box-shadow: 0 6px 20px color-mix(in srgb,var(--text-primary) 9%,transparent),inset 0 1px 0 color-mix(in srgb,var(--surface-color) 80%,white);
      color: var(--text-primary); font-family: var(--body-font);
    }
    header { display: flex; align-items: center; gap: 9px; margin-bottom: 9px; }
    .notification-icon { display: grid; place-items: center; flex: 0 0 30px; height: 30px; border-radius: 10px; color: var(--primary-color); background: color-mix(in srgb,var(--primary-color) 10%,var(--surface-color)); animation: suggestion-bell .6s ease-out .18s both; }
    .notification-heading { flex: 1; min-width: 0; }
    .eyebrow { display: block; margin-bottom: 3px; font-size: 10px; line-height: 1.3; color: var(--text-secondary); }
    h4 { margin: 0; font: 650 14px/1.3 var(--heading-font); }
    button { font: inherit; cursor: pointer; }
    .dismiss { display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; margin-right: -5px; border: 0; border-radius: 50%; background: transparent; color: var(--text-secondary); }
    svg { width: 18px; height: 18px; }
    .suggestion-content { display: flex; align-items: center; gap: 10px; }
    .details { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; min-height: 56px; text-align: left; border: 0; background: transparent; color: inherit; padding: 0; }
    .details img,.placeholder { width: 56px; height: 56px; flex: 0 0 56px; object-fit: cover; border-radius: 14px; }
    .placeholder { display: grid; place-items: center; background: var(--bg-color); color: var(--text-secondary); }
    .details>span:last-child { display: grid; gap: 5px; min-width: 0; }
    strong { font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; }
    .price { font-size: 13px; font-weight: 650; color: var(--text-primary); }
    .add { display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 44px; padding: 9px 11px; border: 0; border-radius: 14px; background: var(--primary-color); color: var(--on-primary); font-size: 12px; font-weight: 650; flex-shrink: 0; }
    button:focus-visible { outline: 2px solid var(--accent-color); outline-offset: 3px; }
    @media (hover:hover) { .add:hover { filter: brightness(1.08); } .dismiss:hover { background: color-mix(in srgb,var(--text-primary) 6%,transparent); } }
    @keyframes suggestion-arrive { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes suggestion-bell { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-12deg); } 55% { transform: rotate(9deg); } 80% { transform: rotate(-4deg); } }
    @media (prefers-reduced-motion:reduce) { :host,.notification-icon { animation: none; } }
  `]
})
export class CartRecommendationComponent {
  @Input({ required: true }) item!: MenuItem;
  @Input({ required: true }) price = 0;
  @Output() add = new EventEmitter<MenuItem>();
  @Output() details = new EventEmitter<MenuItem>();
  @Output() dismiss = new EventEmitter<void>();
  readonly money = formatOrderMoney;
}
