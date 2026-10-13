import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogFocusDirective } from '../../../../components/dialog-focus.directive';
import { QrLogoSource, QR_LOGO_SIZE, logoPlacement, openQrLogo } from './qr-logo-file';

@Component({
  selector: 'app-qr-logo-editor',
  standalone: true,
  imports: [FormsModule, DialogFocusDirective],
  templateUrl: './qr-logo-editor.component.html',
  styleUrl: './qr-logo-editor.component.css',
})
export class QrLogoEditorComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) file!: File;
  @Output() confirmed = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();
  @ViewChild('preview', { static: true }) preview!: ElementRef<HTMLCanvasElement>;
  loading = signal(true);
  error = signal('');
  pages = signal(1);
  page = 1;
  zoom = 1;
  x = 0;
  y = 0;
  rotation = 0;
  fill = false;
  private controller = new AbortController();
  private source?: QrLogoSource;
  private image?: HTMLCanvasElement;
  private drag?: { id: number; clientX: number; clientY: number; x: number; y: number };

  async ngAfterViewInit() {
    const timeout = setTimeout(() => this.controller.abort(), 30000);
    try {
      const source = await openQrLogo(this.file, this.controller.signal);
      if (this.controller.signal.aborted) { source.close(); return; }
      this.source = source;
      this.pages.set(source.pageCount);
      await this.changePage(1);
    } catch (error) {
      this.error.set(this.controller.signal.aborted ? 'O arquivo demorou demais para abrir. Tente uma versão mais simples.' : (error as Error).message);
    } finally { clearTimeout(timeout); this.loading.set(false); }
  }

  async changePage(page: number) {
    if (!this.source || !Number.isInteger(page) || page < 1 || page > this.pages()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      this.image = await this.source.render(page);
      this.page = page;
      this.reset();
    } catch { this.error.set('Não foi possível ler esta página. Escolha outra página ou outro arquivo.'); }
    finally { this.loading.set(false); }
  }

  reset(fill = this.fill) {
    this.fill = fill;
    this.zoom = 1;
    this.x = this.y = this.rotation = 0;
    this.draw();
  }
  rotate() { this.rotation = (this.rotation + 90) % 360; this.x = this.y = 0; this.draw(); }

  private placement(side: number) {
    const swap = this.rotation % 180 !== 0;
    return logoPlacement(swap ? this.image!.height : this.image!.width, swap ? this.image!.width : this.image!.height, side, this.zoom, this.x, this.y, this.fill);
  }

  draw(canvas = this.preview.nativeElement) {
    const context = canvas.getContext('2d');
    if (!context || !this.image) return;
    const side = canvas.width, p = this.placement(side);
    context.clearRect(0, 0, side, side);
    context.save();
    context.imageSmoothingQuality = 'high';
    context.translate(p.left + p.width / 2, p.top + p.height / 2);
    context.rotate(this.rotation * Math.PI / 180);
    const swap = this.rotation % 180 !== 0;
    context.drawImage(this.image, -(swap ? p.height : p.width) / 2, -(swap ? p.width : p.height) / 2, swap ? p.height : p.width, swap ? p.width : p.height);
    context.restore();
  }

  startDrag(event: PointerEvent) {
    if (this.loading() || this.error() || (event.pointerType === 'mouse' && event.button !== 0)) return;
    this.drag = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: this.x, y: this.y };
    this.preview.nativeElement.setPointerCapture(event.pointerId);
  }
  moveDrag(event: PointerEvent) {
    if (!this.drag || this.drag.id !== event.pointerId || !this.image) return;
    const side = this.preview.nativeElement.getBoundingClientRect().width;
    const p = this.placement(side);
    const move = (previous: number, delta: number, size: number) => Math.max(-100, Math.min(100, previous + delta * 200 / Math.max(1, Math.abs(side - size))));
    this.x = move(this.drag.x, event.clientX - this.drag.clientX, p.width);
    this.y = move(this.drag.y, event.clientY - this.drag.clientY, p.height);
    this.draw();
  }
  endDrag() { this.drag = undefined; }

  confirm() {
    if (this.loading() || this.error() || !this.image) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = QR_LOGO_SIZE;
      this.draw(canvas);
      const result = canvas.toDataURL('image/png');
      if (result.length > 140000) throw new Error();
      this.confirmed.emit(result);
    } catch { this.error.set('Não foi possível preparar o logo. Tente outra imagem.'); }
  }
  ngOnDestroy() { this.controller.abort(); this.source?.close(); this.image = undefined; }
}
