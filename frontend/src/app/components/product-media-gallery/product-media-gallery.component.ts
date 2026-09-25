import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
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

        @if (session && activeMediaId && activeSlide.kind === 'video') {
          <div
            class="video-lightbox"
            role="dialog"
            aria-modal="true"
            [attr.aria-label]="'VÃ­deo de ' + productName"
            (click)="closeExpanded()">
            <div
              class="expanded-player-shell"
              [style.width]="expandedPlayerWidth"
              [style.aspect-ratio]="playerAspectRatio"
              (click)="$event.stopPropagation()">
              <div class="expanded-player-topbar">
                <span>{{ productName }}</span>
                <span class="muted-label" aria-label="ReproduÃ§Ã£o sem Ã¡udio">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6M16 9l6 6"/></svg>
                  Sem Ã¡udio
                </span>
              </div>
              <mux-player
                #player
                class="mux-player expanded-player"
                [attr.playback-id]="session.playbackId"
                [attr.playback-token]="session.playbackToken"
                [attr.metadata-video-id]="activeSlide.media.id"
                [attr.metadata-video-title]="session.videoTitle"
                [attr.poster]="imageUrl || null"
                preload="none"
                muted
                autoplay
                playsinline
                (loadedmetadata)="onPlayerMetadata($event)">
              </mux-player>
              <button type="button" class="close-video-button" aria-label="Fechar vÃ­deo" (click)="closeExpanded()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
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
    .video-lightbox {
      position: fixed;
      inset: 0;
      z-index: 300;
      display: grid;
      place-items: center;
      padding: 24px;
      background: rgba(12, 8, 10, .9);
      backdrop-filter: blur(16px) saturate(120%);
      -webkit-backdrop-filter: blur(16px) saturate(120%);
      animation: lightboxFade 220ms ease-out;
    }
    .expanded-player-shell {
      position: relative;
      max-width: 94vw;
      max-height: 84vh;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 22px;
      background: #0E0B0D;
      box-shadow: 0 28px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04);
      animation: playerZoom 280ms cubic-bezier(.16, 1, .3, 1);
    }
    .expanded-player { width: 100%; height: 100%; --media-object-fit: contain; }
    .expanded-player-topbar {
      position: absolute;
      z-index: 4;
      top: 0;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 58px 24px 16px;
      color: #fff;
      font-size: .82rem;
      font-weight: 750;
      pointer-events: none;
      background: linear-gradient(180deg, rgba(0,0,0,.72), transparent);
    }
    .expanded-player-topbar > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .muted-label { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; color: rgba(255,255,255,.78); font-size: .7rem; }
    .muted-label svg { width: 15px; height: 15px; }
    .close-video-button {
      position: absolute;
      z-index: 6;
      top: 11px;
      right: 11px;
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(255,255,255,.28);
      border-radius: 50%;
      color: #fff;
      background: rgba(18,12,15,.7);
      backdrop-filter: blur(10px);
      cursor: pointer;
      transition: transform 180ms ease, background 180ms ease;
    }
    .close-video-button svg { width: 19px; height: 19px; }
    .close-video-button:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent-color) 75%, white); outline-offset: 3px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes lightboxFade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes playerZoom { from { opacity: 0; transform: translateY(12px) scale(.86); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @media (hover: hover) {
      .play-button:hover { transform: translateY(-2px); background: rgba(20,14,17,.9); }
      .close-video-button:hover { transform: scale(1.06); background: rgba(35,22,28,.9); }
    }
    @media (max-width: 640px) {
      .media-stage { aspect-ratio: 4 / 3; touch-action: pan-y; }
      .nav-button { display: none; }
      .video-lightbox { padding: 14px; }
      .expanded-player-shell { max-width: 96vw; max-height: 82vh; border-radius: 18px; }
      .expanded-player-topbar { padding-left: 13px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .play-button, .gallery-dot { transition: none; }
      .loading-ring { animation-duration: 1.4s; }
      .video-lightbox, .expanded-player-shell { animation: none; }
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
  @Output() expandedChange = new EventEmitter<boolean>();
  @ViewChild('player') player?: ElementRef<HTMLElement & { pause?: () => void; videoWidth?: number; videoHeight?: number }>;

  activeIndex = 0;
  activeMediaId: string | null = null;
  session: PlaybackSession | null = null;
  loading = false;
  errorMessage: string | null = null;
  playerAspectRatio = '16 / 9';
  expandedPlayerWidth = 'min(92vw, 960px)';
  private touchStartX: number | null = null;

  constructor(
    private readonly playback: ProductPlaybackService,
    private readonly playerLoader: MuxPlayerLoaderService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get slides(): GallerySlide[] {
    const result: GallerySlide[] = [];
    const videos = this.media
      .filter(item => item.mediaType === 'video' && item.source === 'mux')
      .sort((a, b) => a.position - b.position);
    for (const media of videos) {
      result.push({ key: media.id, kind: 'video', media });
    }
    if (this.imageUrl) result.push({ key: 'primary-image', kind: 'image', imageUrl: this.imageUrl });
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
      this.expandedChange.emit(true);
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

  closeExpanded(): void {
    this.stopPlayback();
  }

  onPlayerMetadata(event: Event): void {
    const player = event.currentTarget as HTMLElement & { videoWidth?: number; videoHeight?: number };
    const width = Number(player.videoWidth);
    const height = Number(player.videoHeight);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;

    const ratio = width / height;
    const maxWidth = Math.min(window.innerWidth * .94, window.innerHeight * .84 * ratio, 960);
    this.playerAspectRatio = `${width} / ${height}`;
    this.expandedPlayerWidth = `${Math.max(220, Math.round(maxWidth))}px`;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.session) this.closeExpanded();
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
    this.playerAspectRatio = '16 / 9';
    this.expandedPlayerWidth = 'min(92vw, 960px)';
    this.expandedChange.emit(false);
  }
}
