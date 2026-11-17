import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { DesignService } from '../../../../services/design.service';
import { ImageCropService } from '../../../../services/image-crop.service';
import { MenuImageDirective } from '../../../../components/public-menu-view/menu-image.directive';

@Component({
  selector:'app-home-side-image-editor', standalone:true, imports:[MenuImageDirective],
  template:`<section class="side-image-editor" aria-labelledby="side-image-title">
    <div class="side-image-heading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="3"/><circle cx="10" cy="8" r="1.5"/><path d="m5 17 5-5 4 4 3-3 2 2"/></svg><div><h3 id="side-image-title">Imagem lateral do Início</h3><p>Formato 9:16, ao lado direito dos itens da primeira seção de produtos: promoções, pratos do chef, combos, mais vendidos ou mais curtidos. Acompanha a ordem dos blocos e tem cantos arredondados.</p></div></div>
    <div class="side-image-controls">
      @if(design.firstBlockImage().imageUrl; as image) { <img class="side-image-preview" [appMenuImage]="image" width="72" height="128" alt="Prévia da imagem lateral" /> }
      <div class="side-image-options">
        @if(design.firstBlockImage().imageUrl) { <label><input type="checkbox" [checked]="design.firstBlockImage().enabled" (change)="toggle($event)" /> Exibir imagem no Início</label> }
        <div class="side-image-actions"><button type="button" (click)="fileInput.click()" [disabled]="busy">{{ design.firstBlockImage().imageUrl ? 'Trocar imagem' : 'Adicionar imagem 9:16' }}</button>
        @if(design.firstBlockImage().imageUrl) { <button type="button" (click)="design.setFirstBlockImage({enabled:false,imageUrl:null})" [disabled]="busy">Remover</button> }</div>
        <p class="side-image-note">JPG, PNG, WebP ou AVIF. Ajuste o enquadramento antes de usar.</p>
        <p role="status">{{ status }}</p>
      </div>
    </div>
    <input #fileInput type="file" accept="image/jpeg,image/png,image/webp,image/avif" (change)="selectImage($event)" hidden />
  </section>`,
  styles:[`:host{display:block;margin-bottom:24px}.side-image-editor{padding:18px;border:1px solid var(--panel-border);border-radius:16px;background:var(--panel-surface-inset)}.side-image-heading{display:flex;align-items:flex-start;gap:10px}.side-image-heading svg{width:24px;height:24px;flex-shrink:0;color:var(--panel-accent)}h3{margin:0;color:var(--panel-text);font:650 15px/1.4 Outfit,Inter,sans-serif}p{margin:5px 0;font:12px/1.5 Inter,sans-serif;color:var(--panel-text-muted)}.side-image-controls{display:flex;align-items:flex-start;gap:14px;margin-top:14px}.side-image-preview{width:72px;height:96px;aspect-ratio:9/16;object-fit:cover;border-radius:12px;flex-shrink:0}.side-image-options{min-width:0}.side-image-options label{display:flex;align-items:center;gap:8px;min-height:44px;font-size:12px;color:var(--panel-text)}.side-image-actions{display:flex;flex-wrap:wrap;gap:8px}button{min-height:44px;padding:9px 12px;border:1px solid var(--panel-border-strong);border-radius:10px;background:var(--panel-surface);color:var(--panel-text);font:600 12px Inter,sans-serif;cursor:pointer}button:disabled{opacity:.5;cursor:wait}button:focus-visible,input:focus-visible{outline:2px solid var(--panel-accent);outline-offset:3px}.side-image-note{font-size:11px}@media(max-width:380px){.side-image-controls{gap:10px}.side-image-editor{padding:14px}.side-image-preview{width:60px;height:auto}}`]
})
export class HomeSideImageEditorComponent {
  readonly design=inject(DesignService);
  private crop=inject(ImageCropService);
  private cdr=inject(ChangeDetectorRef);
  busy=false; status='';
  toggle(event:Event){this.design.setFirstBlockImage({...this.design.firstBlockImage(),enabled:(event.target as HTMLInputElement).checked});}
  selectImage(event:Event){
    const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';
    if(!file||this.busy)return;
    this.busy=true;this.status='';
    this.crop.open(file,{title:'Imagem lateral do Início',ratio:9/16}).subscribe({
      next:image=>{if(image)this.design.setFirstBlockImage({enabled:true,imageUrl:image});this.busy=false;this.cdr.markForCheck();},
      error:error=>{this.busy=false;this.status=error?.message||'Não foi possível carregar a imagem.';this.cdr.markForCheck();}
    });
  }
}
