import { AfterViewInit, Component, ElementRef, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PublicMenuViewComponent } from '../../../../components/public-menu-view/public-menu-view.component';
import { DesignService } from '../../../../services/design.service';

@Component({
  selector: 'app-phone-preview',
  standalone: true,
  imports: [CommonModule, PublicMenuViewComponent],
  template: `
    <div class="phone-wrapper">
      <!-- Phone Frame (Smartphone Mockup) -->
      <div class="phone-frame" [style.width.px]="390 * scale() + 8">
        <!-- Dynamic Island / Notch -->
        <div class="phone-notch">
          <div class="notch-camera"></div>
          <div class="notch-sensor"></div>
        </div>

        <!-- Status Bar -->
        <div class="phone-status-bar">
          <span class="status-time">12:30</span>
          <div class="status-icons">
            <!-- Wi-Fi -->
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.24 4.24 0 0 0-6 0zm-4-4l2 2a7.07 7.07 0 0 1 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
            </svg>
            <!-- Signal -->
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="1" y="14" width="3" height="6" rx="1"/>
              <rect x="6" y="10" width="3" height="10" rx="1"/>
              <rect x="11" y="6" width="3" height="14" rx="1"/>
              <rect x="16" y="2" width="3" height="18" rx="1"/>
            </svg>
            <!-- Battery -->
            <div class="status-battery">
              <div class="battery-fill"></div>
            </div>
          </div>
        </div>

        <!-- Phone Screen Content (EXATAMENTE A MESMA EXPERIÊNCIA DO CLIENTE FINAL) -->
        <div class="phone-screen-container" [style.height.px]="740 * scale()">
          <div class="phone-screen-viewport" [style.transform]="'scale(' + scale() + ')'">
            <app-public-menu-view #menu [isPhonePreview]="true"></app-public-menu-view>
          </div>
        </div>

        <!-- Home indicator -->
        <div class="phone-home-indicator"></div>
      </div>

      <!-- Preview Live Badge -->
      <div class="preview-info">
        <span class="info-label">390 × 740 px</span>
        <button type="button" class="restart-preview" (click)="menu.resetToWelcome()">Reiniciar prévia</button>
        <div class="sync-indicator">
          <span class="sync-dot"></span>
          <span>Sincronizado em tempo real</span>
        </div>
        <span class="info-label">Template: <strong>{{ templateName }}</strong> · Paleta: <strong>{{ paletteName }}</strong></span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; max-width: 320px; }

    .phone-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 4px 0;
      animation: phoneIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
    }

    /* ── Phone Frame ── */
    .phone-frame {
      box-sizing: border-box;
      flex-shrink: 0;
      background: #18181B;
      border-radius: 40px;
      border: 4px solid #27272A;
      box-shadow:
        0 24px 70px rgba(0, 0, 0, 0.7),
        0 0 0 1px rgba(255, 255, 255, 0.08),
        inset 0 0 0 1px rgba(255, 255, 255, 0.04);
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    /* Notch / Dynamic Island */
    .phone-notch {
      position: absolute;
      top: 6px;
      left: 50%;
      transform: translateX(-50%);
      width: 90px;
      height: 18px;
      background: #000000;
      border-radius: 20px;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      box-sizing: border-box;
      pointer-events: none;
    }
    .notch-camera {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #111827;
      border: 1.5px solid #1F2937;
    }
    .notch-sensor {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #0F172A;
    }

    /* Status Bar */
    .phone-status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 18px 2px;
      font-size: 0.65rem;
      font-weight: 700;
      color: #FFF;
      position: relative;
      z-index: 90;
      background: rgba(0,0,0,0.25);
      backdrop-filter: blur(8px);
      pointer-events: none;
    }
    .status-time { font-family: system-ui, -apple-system, sans-serif; font-weight: 700; }
    .status-icons {
      display: flex;
      align-items: center;
      gap: 5px;
      color: #FFF;
    }
    .status-battery {
      width: 18px;
      height: 8.5px;
      border: 1.2px solid #FFF;
      border-radius: 2px;
      padding: 1px;
      position: relative;
    }
    .status-battery::after {
      content: '';
      position: absolute;
      right: -3.5px;
      top: 50%;
      transform: translateY(-50%);
      width: 1.8px;
      height: 4px;
      background: #FFF;
      border-radius: 0 1px 1px 0;
    }
    .battery-fill {
      width: 85%;
      height: 100%;
      background: #22C55E;
      border-radius: 1px;
    }

    /* Phone Screen Container */
    .phone-screen-container {
      flex-shrink: 0;
      width: 100%;
      overflow: hidden;
      position: relative;
    }

    .phone-screen-viewport {
      width: 390px; height: 740px; transform-origin: top left;
      position: relative; overflow: hidden; contain: layout paint;
    }
    .restart-preview {
      border: 0; background: transparent; color: var(--panel-accent, #F47B20);
      font: inherit; font-size: .72rem; padding: 4px 8px; cursor: pointer;
    }
    .restart-preview:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }

    /* Home Indicator */
    .phone-home-indicator {
      width: 100px;
      height: 4px;
      background: #52525B;
      border-radius: 2px;
      margin: 6px auto 6px;
      z-index: 90;
      pointer-events: none;
    }

    /* Preview Info below Phone */
    .preview-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .sync-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.72rem;
      font-weight: 600;
      color: #22C55E;
    }
    .sync-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #22C55E;
      box-shadow: 0 0 6px #22C55E;
    }
    .info-label {
      font-size: 0.72rem;
      color: #71717A;
    }
    .info-label strong {
      color: #D4D4D8;
    }

    @keyframes phoneIn {
      from { opacity: 0; transform: translateY(20px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .phone-wrapper { animation: none !important; }
    }
  `]
})
export class PhonePreviewComponent implements AfterViewInit, OnDestroy {
  readonly scale = signal(312 / 390);
  private resizeObserver?: ResizeObserver;

  constructor(private designService: DesignService, private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const element = this.host.nativeElement;
    const stage = element.parentElement;
    if (!stage) return;
    this.resizeObserver = new ResizeObserver(() => {
      const style = getComputedStyle(stage);
      const availableHeight = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const widthScale = Math.max(0, element.clientWidth - 8) / 390;
      // Reserve space for the frame, system bars and preview controls.
      const heightScale = Math.max(0, availableHeight - 124) / 740;
      // Keep the menu readable; shorter panels can scroll instead of shrinking it further.
      if (widthScale > 0 && heightScale > 0) this.scale.set(Math.min(widthScale, Math.max(heightScale, .76), 1));
    });
    this.resizeObserver.observe(stage);
    this.resizeObserver.observe(element);
  }

  ngOnDestroy(): void { this.resizeObserver?.disconnect(); }

  get templateName(): string {
    return this.designService.currentTemplate().name;
  }

  get paletteName(): string {
    return this.designService.currentPalette().name;
  }
}
