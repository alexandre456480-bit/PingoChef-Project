import { Component } from '@angular/core';
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
      <div class="phone-frame">
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
        <div class="phone-screen-container">
          <app-public-menu-view [isPhonePreview]="true"></app-public-menu-view>
        </div>

        <!-- Home indicator -->
        <div class="phone-home-indicator"></div>
      </div>

      <!-- Preview Live Badge -->
      <div class="preview-info">
        <div class="sync-indicator">
          <span class="sync-dot"></span>
          <span>Sincronizado em tempo real</span>
        </div>
        <span class="info-label">Template: <strong>{{ templateName }}</strong> · Paleta: <strong>{{ paletteName }}</strong></span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

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
      width: 290px;
      height: 590px;
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
      flex: 1;
      width: 100%;
      height: 520px;
      max-height: 520px;
      overflow: hidden;
      position: relative;
    }

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
export class PhonePreviewComponent {
  constructor(private designService: DesignService) {}

  get templateName(): string {
    return this.designService.currentTemplate().name;
  }

  get paletteName(): string {
    return this.designService.currentPalette().name;
  }
}
