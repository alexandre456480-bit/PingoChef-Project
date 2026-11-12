import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductFlavor } from '../../../../models/product-flavors';

@Component({
  selector: 'app-product-flavors-editor', standalone: true, imports: [FormsModule],
  template: `
    <section class="flavors-editor" aria-labelledby="flavors-editor-title">
      <header><h4 id="flavors-editor-title">Sabores e opções</h4><span>{{ flavors.length }}/30</span></header>
      <p>O cliente escolhe um sabor antes de adicionar. Deixe vazio para vender o produto sem opções.</p>
      @for (flavor of flavors; track flavor.id; let i = $index) {
        <div class="flavor-row" role="group" [attr.aria-label]="'Sabor ' + (i + 1)">
          <label>Nome do sabor<input type="text" maxlength="80" [ngModel]="flavor.name" (ngModelChange)="change(i, {name: $event})" [ngModelOptions]="{standalone:true}" placeholder="Ex.: Frango" /></label>
          <label>Preço próprio (opcional)<input type="number" min="0.01" max="999999.99" step="0.01" [ngModel]="flavor.price" (ngModelChange)="change(i, {price: $event})" [ngModelOptions]="{standalone:true}" placeholder="Preço do produto" /></label>
          <div class="flavor-actions"><label class="available"><input type="checkbox" [ngModel]="flavor.isAvailable" (ngModelChange)="change(i, {isAvailable: $event})" [ngModelOptions]="{standalone:true}" /> Disponível</label><button type="button" [attr.aria-label]="'Remover sabor ' + (flavor.name || (i + 1))" (click)="remove(i)">Remover</button></div>
        </div>
      }
      <button type="button" class="add-flavor" (click)="add()" [disabled]="flavors.length >= 30">+ Adicionar sabor</button>
      @if (flavors.length) { <p>Sem preço próprio, vale o preço ou promoção do produto. Com preço próprio, vale somente o preço do sabor.</p> }
    </section>
  `,
  styles: [`
    :host { display:block; } .flavors-editor { padding-top:16px;border-top:1px solid var(--panel-border); } header { display:flex;justify-content:space-between;gap:12px;align-items:center; } h4 { margin:0;color:var(--panel-text);font-size:14px; } header span,p { font-size:12px;color:var(--panel-text-muted); } p { line-height:1.5; } .flavor-row { display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;padding:14px;margin:10px 0;border:1px solid var(--panel-border);border-radius:14px;background:var(--panel-surface-inset); } label { display:grid;gap:7px;font-size:11px;color:var(--panel-text-soft); } input:not([type=checkbox]) { box-sizing:border-box;width:100%;min-width:0;min-height:44px;padding:10px;border:1px solid var(--panel-border-strong);border-radius:10px;background:var(--panel-surface);color:var(--panel-text);font:inherit;font-size:13px; } .flavor-actions { grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:10px; } .available { display:flex;align-items:center;min-height:44px; } button { min-height:44px;padding:8px 12px;border:1px solid var(--panel-border-strong);border-radius:10px;background:var(--panel-surface);color:var(--panel-text);font:600 12px Inter,sans-serif;cursor:pointer; } button:disabled { opacity:.5; } .add-flavor { color:var(--panel-accent); } :is(input,button):focus-visible { outline:2px solid var(--panel-accent);outline-offset:2px; } @media(max-width:400px) { .flavor-row { grid-template-columns:1fr; } }
  `]
})
export class ProductFlavorsEditorComponent {
  @Input() flavors: ProductFlavor[] = [];
  @Output() flavorsChange = new EventEmitter<ProductFlavor[]>();
  add() { if (this.flavors.length < 30) this.flavorsChange.emit([...this.flavors, { id: crypto.randomUUID(), name: '', price: null, isAvailable: true }]); }
  change(i: number, patch: Partial<ProductFlavor>) { this.flavorsChange.emit(this.flavors.map((row, n) => n === i ? { ...row, ...patch } : row)); }
  remove(i: number) { this.flavorsChange.emit(this.flavors.filter((_, n) => n !== i)); }
}
