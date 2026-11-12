import { Component, ElementRef, ViewChild, ChangeDetectorRef, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImagePayloadService } from '../../services/image-payload.service';
import { CropFit, cropGeometry } from './image-crop.geometry';

export interface ImageCropOptions { title: string; ratio: number; fit?: CropFit }

@Component({
  selector: 'app-image-crop', standalone: true, imports: [FormsModule],
  template: `
    <dialog #dialog aria-labelledby="crop-title" (cancel)="$event.preventDefault(); cancel()">
      <header><div><small>AJUSTAR IMAGEM</small><h2 id="crop-title">{{ options.title }}</h2></div><button type="button" aria-label="Cancelar enquadramento" (click)="cancel()" [disabled]="busy">×</button></header>
      <p>Arraste a imagem e ajuste o zoom. Apenas a área dentro da moldura será utilizada.</p>
      <div class="frame-area">
        <div #frame class="crop-frame" tabindex="0" role="group" aria-label="Enquadramento: arraste ou use as setas do teclado"
          [style.aspect-ratio]="ratio" [style.max-width.px]="280 * ratio"
          (pointerdown)="startDrag($event)" (pointermove)="drag($event)" (pointerup)="stopDrag()" (pointercancel)="stopDrag()" (keydown)="moveWithKeys($event)">
          <img #image [src]="source" alt="Imagem para enquadrar" draggable="false" (load)="loaded()" (error)="error = 'Não foi possível abrir esta imagem.'"
            [style.width.px]="geometry.width" [style.height.px]="geometry.height" [style.left.px]="geometry.left" [style.top.px]="geometry.top" />
          <span class="grid" aria-hidden="true"></span>
        </div>
      </div>
      <div class="controls"><label for="crop-zoom">Zoom <output>{{ zoom.toFixed(1) }}×</output></label><input id="crop-zoom" type="range" min="1" max="4" step="0.05" [(ngModel)]="zoom" [disabled]="!ready || busy" />
        <div class="fit-options"><button type="button" [attr.aria-pressed]="fit === 'cover'" (click)="setFit('cover')" [disabled]="busy">Preencher moldura</button><button type="button" [attr.aria-pressed]="fit === 'contain'" (click)="setFit('contain')" [disabled]="busy">Imagem inteira</button><button type="button" (click)="reset()" [disabled]="busy">Centralizar</button></div>
      </div>
      @if (error) { <p class="error" role="alert">{{ error }}</p> }
      <footer><button type="button" (click)="cancel()" [disabled]="busy">Cancelar</button><button type="button" class="apply" (click)="apply()" [disabled]="!ready || busy">{{ busy ? 'Preparando…' : 'Usar imagem' }}</button></footer>
    </dialog>
  `,
  styleUrl: './image-crop.component.css'
})
export class ImageCropComponent implements OnDestroy {
  @ViewChild('dialog', { static: true }) dialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('frame', { static: true }) frame!: ElementRef<HTMLElement>;
  @ViewChild('image', { static: true }) image!: ElementRef<HTMLImageElement>;
  source = ''; options: ImageCropOptions = { title: 'Enquadrar imagem', ratio: 1 };
  finish: (value: string | null) => void = () => {};
  zoom = 1; x = 0; y = 0; fit: CropFit = 'cover'; ready = false; busy = false; error = '';
  private size = { width: 1, height: 1 };
  private pointer?: { id: number; x: number; y: number };
  private observer?: ResizeObserver;
  private destroyed = false;
  private payload = inject(ImagePayloadService);
  private cdr = inject(ChangeDetectorRef);
  get ratio() { return Number.isFinite(this.options.ratio) ? Math.max(.25, Math.min(5, this.options.ratio)) : 1; }
  get geometry() { const img = this.image?.nativeElement; return cropGeometry(img?.naturalWidth || 1, img?.naturalHeight || 1, this.size.width, this.size.height, this.zoom, this.x, this.y, this.fit); }
  open() {
    this.fit = this.options.fit || 'cover';
    this.dialog.nativeElement.showModal();
    this.observer = new ResizeObserver(() => { if (!this.destroyed) { this.measure(); this.cdr.detectChanges(); } });
    this.observer.observe(this.frame.nativeElement);
    this.measure(); this.cdr.detectChanges();
  }
  private measure() { const f = this.frame.nativeElement; this.size = { width: f.clientWidth || 1, height: f.clientHeight || 1 }; }
  loaded() {
    const img = this.image.nativeElement;
    this.ready = img.naturalWidth > 0 && img.naturalWidth * img.naturalHeight <= 32_000_000;
    if (!this.ready) this.error = 'A imagem deve ter no máximo 32 megapixels. Escolha uma versão menor.';
    this.measure();
  }
  setFit(fit: CropFit) { this.fit = fit; this.reset(); }
  reset() { this.zoom = 1; this.x = 0; this.y = 0; }
  startDrag(e: PointerEvent) {
    if (!this.ready || this.busy || (e.pointerType === 'mouse' && e.button !== 0)) return;
    this.frame.nativeElement.setPointerCapture(e.pointerId); this.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY }; e.preventDefault();
  }
  drag(e: PointerEvent) {
    if (!this.pointer || this.pointer.id !== e.pointerId) return;
    const g = this.geometry;
    if (g.travelX) this.x = Math.max(-1, Math.min(1, this.x + (e.clientX - this.pointer.x) / g.travelX));
    if (g.travelY) this.y = Math.max(-1, Math.min(1, this.y + (e.clientY - this.pointer.y) / g.travelY));
    this.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }
  stopDrag() { this.pointer = undefined; }
  moveWithKeys(e: KeyboardEvent) {
    if (this.busy || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'Home') this.reset();
    else { this.x = Math.max(-1, Math.min(1, this.x + (e.key === 'ArrowRight' ? .1 : e.key === 'ArrowLeft' ? -.1 : 0))); this.y = Math.max(-1, Math.min(1, this.y + (e.key === 'ArrowDown' ? .1 : e.key === 'ArrowUp' ? -.1 : 0))); }
  }
  cancel() { if (!this.busy) this.finish(null); }
  apply() {
    if (!this.ready || this.busy) return;
    this.busy = true; this.error = '';
    const canvas = document.createElement('canvas'), g = this.geometry, image = this.image.nativeElement;
    const outputScale = Math.min(1200 / Math.max(this.size.width, this.size.height), image.naturalWidth / g.width, image.naturalHeight / g.height);
    canvas.width = Math.max(1, Math.round(this.size.width * outputScale));
    canvas.height = Math.max(1, Math.round(canvas.width / this.ratio));
    const ctx = canvas.getContext('2d'), scale = canvas.width / this.size.width;
    if (!ctx) { this.fail(); return; }
    ctx.drawImage(this.image.nativeElement, g.left * scale, g.top * scale, g.width * scale, g.height * scale);
    canvas.toBlob(blob => {
      if (this.destroyed) return;
      if (!blob) { this.fail(); return; }
      this.payload.readFile(new File([blob], 'imagem.webp', { type: blob.type })).subscribe({ next: image => this.finish(image), error: () => this.fail() });
    }, 'image/webp', .9);
  }
  private fail() { if (this.destroyed) return; this.busy = false; this.error = 'Não foi possível preparar a imagem. Tente novamente.'; this.cdr.markForCheck(); }
  ngOnDestroy() { this.destroyed = true; this.observer?.disconnect(); this.dialog.nativeElement.close(); }
}
