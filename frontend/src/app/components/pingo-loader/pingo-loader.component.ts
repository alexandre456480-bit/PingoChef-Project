import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, SimpleChanges, signal } from '@angular/core';

export type PingoLoaderSize = 'small' | 'medium' | 'large';

@Component({
  selector: 'app-pingo-loader',
  standalone: true,
  template: `
    <div
      class="pingo-loader"
      [class.pingo-loader--visible]="visible"
      [class.pingo-loader--leaving]="leaving"
      [class.pingo-loader--fullscreen]="fullscreen"
      [class.pingo-loader--small]="size === 'small'"
      [class.pingo-loader--large]="size === 'large'"
      role="status"
      aria-live="polite"
      [attr.aria-busy]="active"
      [attr.aria-hidden]="active ? null : 'true'">
      <div class="pingo-loader__content">
        <div class="pingo-loader__stage" aria-hidden="true">
          <div class="pingo-loader__character">
            <img
              class="pingo-loader__frame"
              [src]="frames[currentFrame()]"
              alt=""
              width="1280"
              height="1280"
              loading="eager"
              decoding="sync">
            @for (frame of frames; track frame) {
              <img
                class="pingo-loader__preload-frame"
                [src]="frame"
                alt=""
                width="1280"
                height="1280"
                loading="eager"
                decoding="async">
            }
          </div>
          <span class="pingo-loader__shadow"></span>
        </div>
        <p class="pingo-loader__message">{{ message }}</p>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: contents;
    }

    .pingo-loader {
      --loader-size: clamp(7rem, 12vw, 9.5rem);
      display: grid;
      place-items: center;
      min-height: calc(var(--loader-size) + 4.5rem);
      padding: 1.5rem;
      color: var(--panel-text, #fff8e6);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 160ms ease, visibility 0s linear 160ms;
    }

    .pingo-loader--visible {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transition: opacity 180ms ease;
    }

    .pingo-loader--leaving {
      pointer-events: none;
    }

    .pingo-loader--fullscreen {
      position: fixed;
      inset: 0;
      z-index: 2000;
      min-height: 100dvh;
      background:
        radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--panel-accent, #ff862b) 10%, transparent) 0, transparent 28%),
        var(--panel-bg, #171219);
    }

    .pingo-loader--small {
      --loader-size: 5.5rem;
    }

    .pingo-loader--large {
      --loader-size: clamp(8rem, 16vw, 11.5rem);
    }

    .pingo-loader__content {
      display: grid;
      justify-items: center;
      gap: 0.8rem;
    }

    .pingo-loader__stage {
      position: relative;
      width: var(--loader-size);
      height: var(--loader-size);
      isolation: isolate;
    }

    .pingo-loader__character {
      position: absolute;
      inset: 0;
      z-index: 1;
      animation: pingo-bob 500ms ease-in-out infinite;
      will-change: transform;
    }

    .pingo-loader__frame {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      user-select: none;
      -webkit-user-drag: none;
    }

    .pingo-loader__preload-frame {
      display: none;
    }

    .pingo-loader__shadow {
      position: absolute;
      z-index: 0;
      left: 31%;
      right: 28%;
      bottom: 13%;
      height: 7%;
      border-radius: 50%;
      background: rgba(13, 8, 15, 0.32);
      filter: blur(5px);
      animation: pingo-shadow 500ms ease-in-out infinite;
      transform-origin: center;
    }

    .pingo-loader__message {
      margin: 0;
      max-width: min(26rem, 80vw);
      color: var(--panel-text-soft, #d8cad5);
      font-size: clamp(0.82rem, 1.5vw, 0.94rem);
      font-weight: 600;
      line-height: 1.45;
      letter-spacing: 0.01em;
      text-align: center;
    }

    @keyframes pingo-bob {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-2px); }
    }

    @keyframes pingo-shadow {
      0%, 100% { opacity: 0.62; transform: scaleX(1); }
      50% { opacity: 0.42; transform: scaleX(0.9); }
    }

    @media (max-width: 560px) {
      .pingo-loader {
        --loader-size: 7rem;
        padding: 1.25rem;
      }

      .pingo-loader--small {
        --loader-size: 5rem;
      }

      .pingo-loader--large {
        --loader-size: 8.5rem;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .pingo-loader,
      .pingo-loader--visible {
        transition-duration: 1ms;
      }

      .pingo-loader__character,
      .pingo-loader__shadow {
        animation: none !important;
      }
    }
  `]
})
export class PingoLoaderComponent implements OnChanges, OnDestroy {
  @Input() active = false;
  @Input() fullscreen = false;
  @Input() size: PingoLoaderSize = 'medium';
  @Input() message = 'Carregando...';
  @Input() showDelay = 140;

  readonly frames = Array.from(
    { length: 6 },
    (_, index) => `/assets/mascots/loading/pingo-run-${String(index + 1).padStart(2, '0')}.webp`
  );
  readonly currentFrame = signal(0);

  visible = false;
  leaving = false;

  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private frameTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['active']) {
      this.syncVisibility();
    }
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.stopFrameLoop();
  }

  private syncVisibility(): void {
    if (this.active) {
      this.clearTimer('hide');
      this.leaving = false;

      if (this.visible) {
        this.startFrameLoop();
        return;
      }
      if (this.showTimer) return;

      this.showTimer = setTimeout(() => {
        this.showTimer = null;
        if (this.active) {
          this.visible = true;
          this.startFrameLoop();
          this.cdr.markForCheck();
        }
      }, Math.max(0, this.showDelay));
      return;
    }

    this.clearTimer('show');
    this.stopFrameLoop();
    if (!this.visible) return;

    this.leaving = true;
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.visible = false;
      this.leaving = false;
      this.cdr.markForCheck();
    }, 160);
  }

  private clearTimers(): void {
    this.clearTimer('show');
    this.clearTimer('hide');
  }

  private startFrameLoop(): void {
    if (this.frameTimer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.frameTimer = setInterval(() => {
      this.currentFrame.update(frame => (frame + 1) % this.frames.length);
    }, 83);
  }

  private stopFrameLoop(): void {
    if (this.frameTimer) clearInterval(this.frameTimer);
    this.frameTimer = null;
    this.currentFrame.set(0);
  }

  private clearTimer(timer: 'show' | 'hide'): void {
    const current = timer === 'show' ? this.showTimer : this.hideTimer;
    if (current) clearTimeout(current);
    if (timer === 'show') this.showTimer = null;
    else this.hideTimer = null;
  }
}
