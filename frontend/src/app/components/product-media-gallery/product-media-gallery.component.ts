import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import {
  PlaybackSession,
  ProductGalleryMedia,
  ProductPlaybackService
} from '../../services/product-playback.service';
import { MuxPlayerLoaderService } from '../../services/mux-player-loader.service';

type GallerySlide =
  | { key: string; kind: 'image'; imageUrl: string }
  | { key: string; kind: 'video'; media: ProductGalleryMedia };

@Component({
  selector: 'app-product-media-gallery',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    @if (slides.length > 0) {
      <section
        class="media-gallery"
        tabindex="0"
        aria-label="Galeria do produto"
        (keydown.arrowLeft)="previous()"
        (keydown.arrowRight)="next()"
        (touchstart)="onTouchStart($event)"
        (touchend)="onTouchEnd($event)">
        <div class="media-stage">
          @if (activeSlide.kind === 'image') {
            <img [src]="activeSlide.imageUrl" [alt]="productName" class="media-image" />
          } @else if (session && activeMediaId === activeSlide.media.id) {
            <mux-player
              #player
              class="mux-player"
              [attr.playback-id]="session.playbackId"
              [attr.playback-token]="session.playbackToken"
              [attr.metadata-video-id]="activeSlide.media.id"
              [attr.metadata-video-title]="session.videoTitle"
              [attr.poster]="imageUrl || null"
              preload="none"
              autoplay
              playsinline>
            </mux-player>
          } @else {
            <div class="video-poster" [style.background-image]="imageUrl ? 'url(' + imageUrl + ')' : 'none'">
              <div class="poster-shade"></div>
              <button
                type="button"
                class="play-button"
                [disabled]="loading"
                [attr.aria-label]="loading ? 'Preparando vídeo' : 'Reproduzir vídeo de ' + productName"
                (click)="play(activeSlide.media)">
                @if (loading) {
                  <span class="loading-ring" aria-hidden="true"></span>
                  <span>Preparando</span>
                } @else {
                  <span class="play-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  </span>
                  <span>Assistir vídeo</span>
                }
              </button>
            </div>
          }

          @if (slides.length > 1) {
            <button type="button" class="nav-button previous" aria-label="Mídia anterior" (click)="previous()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button type="button" class="nav-button next" aria-label="Próxima mídia" (click)="next()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          }
        </div>

        @if (errorMessage) {
          <div class="playback-error" role="alert">
            <span>{{ errorMessage }}</span>
            <button type="button" (click)="retry()">Tentar novamente</button>
          </div>
        }

        @if (slides.length > 1) {
          <div class="gallery-dots" role="tablist" aria-label="Selecionar mídia">
            @for (slide of slides; track slide.key; let index = $index) {
              <button
                type="button"
                role="tab"
                class="gallery-dot"
                [class.active]="index === activeIndex"
                [attr.aria-selected]="index === activeIndex"
                [attr.aria-label]="(slide.kind === 'video' ? 'Vídeo' : 'Foto') + ' ' + (index + 1)"
                (click)="select(index)">
              </button>
            }
          </div>
        }
      </section>
    }
  `,
  styles: [`
    :host { display: block; }
    .media-gallery { outline: none; }
    .media-gallery:focus-visible { box-shadow: inset 0 0 0 3px var(--accent-color); }
    .media-stage {
      position: relative;
      aspect-ratio: 16 / 10;
      overflow: hidden;
      background: color-mix(in srgb, var(--surface-color) 82%, #000);
    }
    .media-image, .mux-player { display: block; width: 100%; height: 100%; object-fit: cover; }
    .mux-player { --media-object-fit: cover; }
    .video-poster {
      position: relative;
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      background-position: center;
      background-size: cover;
      background-color: #211B1E;
    }
    .poster-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(17,12,14,.16), rgba(17,12,14,.64)); }
    .play-button {
      position: relative;
      z-index: 1;
      min-height: 48px;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 9px 16px 9px 9px;
      border: 1px solid rgba(255,255,255,.5);
      border-radius: 999px;
      color: #fff;
      background: rgba(20, 14, 17, .78);
      backdrop-filter: blur(12px);
      font: inherit;
      font-weight: 750;
      cursor: pointer;
      box-shadow: 0 10px 26px rgba(0,0,0,.28);
      transition: transform 180ms ease, background 180ms ease;
    }
    .play-button:focus-visible, .nav-button:focus-visible, .gallery-dot:focus-visible, .playback-error button:focus-visible {
      outline: 3px solid color-mix(in srgb, var(--accent-color) 75%, white);
      outline-offset: 2px;
    }
    .play-button:disabled { cursor: wait; opacity: .86; }
    .play-icon { width: 31px; height: 31px; display: grid; place-items: center; border-radius: 50%; background: var(--accent-color); }
    .play-icon svg { width: 18px; height: 18px; margin-left: 2px; }
    .loading-ring { width: 24px; height: 24px; border: 2px solid rgba(255,255,255,.28); border-top-color: #fff; border-radius: 50%; animation: spin .8s linear infinite; }
    .nav-button {
      position: absolute;
      z-index: 3;
      top: 50%;
      transform: translateY(-50%);
      width: 38px;
      height: 38px;
      border: 1px solid rgba(255,255,255,.35);
      border-radius: 50%;
      display: grid;
      place-items: center;
      color: #fff;
      background: rgba(20,14,17,.65);
      backdrop-filter: blur(8px);
      cursor: pointer;
    }
    .nav-button svg { width: 20px; height: 20px; }
    .nav-button.previous { left: 12px; }
    .nav-button.next { right: 12px; }
    .gallery-dots { display: flex; justify-content: center; gap: 7px; padding: 10px 12px 4px; }
    .gallery-dot { width: 8px; height: 8px; padding: 0; border: 0; border-radius: 99px; background: color-mix(in srgb, var(--text-secondary) 35%, transparent); cursor: pointer; transition: width 180ms ease, background 180ms ease; }
    .gallery-dot.active { width: 24px; background: var(--accent-color); }
    .playback-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; background: #FFF3F3; color: #8B1A3A; font-size: .8rem; }
    .playback-error button { border: 1px solid currentColor; border-radius: 8px; padding: 6px 9px; background: transparent; color: inherit; font: inherit; font-weight: 700; cursor: pointer; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (hover: hover) { .play-button:hover { transform: translateY(-2px); background: rgba(20,14,17,.9); } }
    @media (max-width: 640px) {
      .media-stage { aspect-ratio: 4 / 3; touch-action: pan-y; }
      .nav-button { display: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .play-button, .gallery-dot { transition: none; }
      .loading-ring { animation-duration: 1.4s; }
    }
  `]
})
export class ProductMediaGalleryComponent implements OnDestroy {
  @Input({ required: true }) itemId = '';
  @Input({ required: true }) productName = '';
  @Input() imageUrl: string | null = null;
  @Input() media: ProductGalleryMedia[] = [];
  @Input() publicSlug: string | null = null;
  @Input() previewMode = false;
  @ViewChild('player') player?: ElementRef<HTMLElement & { pause?: () => void }>;

  activeIndex = 0;
  activeMediaId: string | null = null;
  session: PlaybackSession | null = null;
  loading = false;
  errorMessage: string | null = null;
  private touchStartX: number | null = null;

  constructor(
    private readonly playback: ProductPlaybackService,
    private readonly playerLoader: MuxPlayerLoaderService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get slides(): GallerySlide[] {
    const result: GallerySlide[] = [];
    if (this.imageUrl) result.push({ key: 'primary-image', kind: 'image', imageUrl: this.imageUrl });
    for (const media of this.media.filter(item => item.mediaType === 'video' && item.source === 'mux')) {
      result.push({ key: media.id, kind: 'video', media });
    }
    return result;
  }

  get activeSlide(): GallerySlide {
    return this.slides[Math.min(this.activeIndex, this.slides.length - 1)];
  }

  async play(media: ProductGalleryMedia): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.errorMessage = null;
    try {
      const response = await firstValueFrom(this.playback.requestPlayback(
        this.itemId,
        media.id,
        this.publicSlug,
        this.previewMode
      ));
      await this.playerLoader.load();
      this.activeMediaId = media.id;
      this.session = response.data;
    } catch {
      this.errorMessage = 'Não foi possível carregar o vídeo agora.';
      this.activeMediaId = null;
      this.session = null;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  retry(): void {
    if (this.activeSlide.kind === 'video') void this.play(this.activeSlide.media);
  }

  previous(): void { this.select((this.activeIndex - 1 + this.slides.length) % this.slides.length); }
  next(): void { this.select((this.activeIndex + 1) % this.slides.length); }

  select(index: number): void {
    if (index === this.activeIndex || index < 0 || index >= this.slides.length) return;
    this.stopPlayback();
    this.activeIndex = index;
  }

  onTouchStart(event: TouchEvent): void { this.touchStartX = event.changedTouches[0]?.clientX ?? null; }
  onTouchEnd(event: TouchEvent): void {
    if (this.touchStartX === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? this.touchStartX) - this.touchStartX;
    this.touchStartX = null;
    if (Math.abs(delta) < 44) return;
    delta < 0 ? this.next() : this.previous();
  }

  ngOnDestroy(): void { this.stopPlayback(); }

  private stopPlayback(): void {
    this.player?.nativeElement.pause?.();
    this.session = null;
    this.activeMediaId = null;
    this.errorMessage = null;
  }
}
