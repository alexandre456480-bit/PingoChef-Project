import { ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Input, OnChanges, Output, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { MenuService } from '../../../../services/menu.service';
import { MenuImageDirective } from '../../../../components/public-menu-view/menu-image.directive';

@Component({
  selector: 'app-product-recommendations-editor', standalone: true, imports: [FormsModule, MenuImageDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="recommendations-editor" aria-label="Sugestões para acompanhar">
    <header><span class="section-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"/></svg></span><div><h4>Sugestões para acompanhar</h4><p>Configure até 3 produtos para recomendar no carrinho.</p></div><span class="count">{{ ids().length }}/3</span></header>
    @if (loading()) { <p role="status">Carregando sugestões…</p> }
    @if (error()) { <p class="error" role="alert">{{ error() }}</p>@if (!loaded()) { <button type="button" (click)="load()">Tentar novamente</button> } }
    @if (loaded()) {
      <ol>
        @for (id of ids(); track id; let index = $index) {
          <li><span class="product-avatar">@if (productImage(id); as url) { <img [appMenuImage]="url" width="36" height="36" alt="" loading="lazy" /> }<span class="position">{{ index + 1 }}</span></span><span class="product-name">{{ productName(id) }}</span>
            <button type="button" [disabled]="busy() || index === 0" (click)="move(index,-1)" [attr.aria-label]="'Aumentar prioridade de ' + productName(id)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg></button>
            <button type="button" [disabled]="busy() || index === ids().length-1" (click)="move(index,1)" [attr.aria-label]="'Diminuir prioridade de ' + productName(id)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 10 6 6 6-6"/></svg></button>
            <button type="button" class="remove" [disabled]="busy()" (click)="remove(id)" [attr.aria-label]="'Remover sugestão ' + productName(id)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
          </li>
        } @empty { <li class="empty">Adicione complementos que combinem com este produto.</li> }
      </ol>
      @if (ids().length < 3) {
        <label>Adicionar complemento<input type="search" placeholder="Buscar por produto ou categoria" [ngModel]="query()" (ngModelChange)="query.set($event)" [ngModelOptions]="{standalone:true}" [disabled]="busy()" /></label>
        <div class="results" role="group" aria-label="Produtos complementares">
          @for (item of candidates(); track item.id) {
            <button type="button" class="candidate" [disabled]="busy()" (click)="append(item.id)" [attr.aria-label]="'Recomendar ' + item.name">
              @if (item.imageUrl) { <img [appMenuImage]="item.imageUrl" width="38" height="38" alt="" loading="lazy" /> }
              <span><strong>{{ item.name }}</strong><small>{{ item.categoryName || categoryName(item.categoryId) }}{{ item.isAvailable ? '' : ' · Indisponível' }}</small></span><span aria-hidden="true">+</span>
            </button>
          } @empty { <p>Nenhum produto encontrado.</p> }
        </div>
      }
      <p class="hint" role="status">{{ busy() ? 'Salvando sugestões…' : 'Alterações salvas automaticamente. Ative o recurso em Design → Recursos.' }}</p>
    }
  </section>`,
  styles: [`
    :host{display:block;margin:0;min-width:0}.recommendations-editor{padding:20px;border:1px solid var(--panel-border);border-radius:18px;background:var(--panel-surface);color:var(--panel-text);font-family:Inter,sans-serif}
    header{display:flex;align-items:flex-start;gap:10px}header>div{flex:1;min-width:0}.section-icon{display:grid;place-items:center;flex:0 0 34px;height:34px;border-radius:11px;background:var(--panel-surface-inset);color:var(--panel-accent)}
    .count{padding:6px 9px;font-size:11px;font-weight:650;white-space:nowrap;border-radius:8px;color:var(--panel-text-soft);background:var(--panel-surface-inset)}h4{margin:0;font:650 15px/1.4 Outfit,Inter,sans-serif}p{margin:5px 0;font-size:11px;line-height:1.6;color:var(--panel-text-muted)}
    ol{padding:0;list-style:none;margin:16px 0}li{display:flex;gap:8px;align-items:center;padding:8px 10px;margin:7px 0;border:1px solid var(--panel-border);border-radius:12px;background:var(--panel-fill)}
    .product-avatar{position:relative;display:block;width:36px;height:36px;flex:0 0 36px;border-radius:10px;background:var(--panel-surface-inset)}.position{position:absolute;right:-3px;bottom:-3px;display:grid;place-items:center;width:17px;height:17px;border-radius:6px;background:var(--panel-surface-strong);border:1px solid var(--panel-border);font-size:10px;color:var(--panel-text-muted)}
    .product-name{flex:1;min-width:0;overflow-wrap:anywhere;font-size:12px;font-weight:550}button{display:inline-grid;place-items:center;min-width:44px;min-height:44px;border:1px solid var(--panel-border);border-radius:10px;background:var(--panel-surface);color:var(--panel-text-soft);font:inherit;cursor:pointer}button:disabled{opacity:.35;cursor:default}button:not(:disabled):hover{border-color:var(--panel-border-strong);background:var(--panel-fill-hover)}svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.remove:not(:disabled):hover{color:#cf543a}
    input{display:block;width:100%;box-sizing:border-box;margin:8px 0 12px;padding:12px;border:1px solid var(--panel-border-strong);border-radius:11px;background:var(--panel-surface-inset);color:var(--panel-text);font:inherit;font-size:13px}label{font-size:12px;font-weight:550}.results{max-height:190px;overflow:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.candidate{display:flex;align-items:center;gap:10px;text-align:left;padding:9px 10px;width:100%}.candidate>span:first-of-type{display:grid;gap:4px;flex:1;min-width:0}.candidate strong{font-size:12px;overflow-wrap:anywhere}.candidate small{font-size:10px;color:var(--panel-text-muted)}img{border-radius:9px;object-fit:cover;flex-shrink:0}
    .hint{margin:14px 0 0;padding-top:12px;border-top:1px solid var(--panel-border)}.error{color:#cf543a}.empty{padding:14px;color:var(--panel-text-muted);font-size:12px;border-style:dashed}button:focus-visible,input:focus-visible{outline:2px solid var(--panel-accent);outline-offset:2px}
    @media(max-width:600px){.recommendations-editor{padding:16px}.results{grid-template-columns:minmax(0,1fr)}input{font-size:16px}li{padding:8px 6px;gap:5px}.product-avatar{width:30px;height:30px;flex-basis:30px}.product-avatar img{width:30px;height:30px}}
  `]
})
export class ProductRecommendationsEditorComponent implements OnChanges {
  @Input({ required: true }) itemId!: string;
  @Output() busyChange = new EventEmitter<boolean>();
  readonly menu = inject(MenuService);
  private readonly destroyRef = inject(DestroyRef);
  readonly ids = signal<string[]>([]);
  readonly query = signal('');
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  private version = 0;
  private readonly products = computed(() => new Map(this.menu.items().map(item => [item.id, item])));
  readonly candidates = computed(() => {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const terms = normalize(this.query()).trim().split(/\s+/).filter(Boolean);
    return this.menu.items().filter(item => item.id !== this.itemId && !this.ids().includes(item.id)
      && terms.every(term => normalize(item.name + ' ' + this.categoryName(item.categoryId)).includes(term))).slice(0, 30);
  });
  ngOnChanges() { this.load(); }
  categoryName(id: string) { return this.menu.categories().find(row => row.id === id)?.name || ''; }
  productName(id: string) { return this.products().get(id)?.name || 'Produto removido'; }
  productImage(id: string) { return this.products().get(id)?.imageUrl; }
  remove(id: string) { this.save(this.ids().filter(value => value !== id)); }
  append(id: string) { this.save([...this.ids(), id]); }
  load() {
    if (!this.itemId) return;
    const version = ++this.version;
    this.loading.set(true); this.loaded.set(false); this.error.set(''); this.ids.set([]); this.busyChange.emit(true);
    this.menu.loadRecommendations(this.itemId).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      if (version === this.version) { this.loading.set(false); this.busyChange.emit(false); }
    })).subscribe({ next: res => { if (version === this.version) { this.ids.set(res.data.recommendedProductIds); this.loaded.set(true); } },
      error: () => { if (version === this.version) this.error.set('Não foi possível carregar as sugestões. Tente novamente.'); } });
  }
  move(index: number, delta: number) {
    const next = [...this.ids()], destination = index + delta;
    if (destination < 0 || destination >= next.length) return;
    [next[index], next[destination]] = [next[destination], next[index]]; this.save(next);
  }
  save(ids: string[]) {
    if (this.busy() || !this.loaded()) return;
    this.busy.set(true); this.busyChange.emit(true); this.error.set('');
    this.menu.saveRecommendations(this.itemId, ids).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      this.busy.set(false); this.busyChange.emit(false);
    })).subscribe({ next: res => { this.ids.set(res.data.recommendedProductIds); this.query.set(''); },
      error: () => this.error.set('Não foi possível salvar. Confira se os produtos ainda existem e tente novamente.') });
  }
}
