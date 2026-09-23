import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="topbar">
      <!-- Mobile hamburger -->
      <button class="hamburger-btn" (click)="toggleSidebar.emit()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="4" y1="6" x2="20" y2="6"/>
          <line x1="4" y1="12" x2="16" y2="12"/>
          <line x1="4" y1="18" x2="12" y2="18"/>
        </svg>
      </button>

      <!-- Search -->
      <div class="search-box">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          [placeholder]="searchPlaceholder"
          [ngModel]="searchQuery"
          (ngModelChange)="searchChange.emit($event)"
          class="search-input"
        />
        @if (searchQuery) {
          <button class="search-clear" (click)="searchChange.emit('')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        }
      </div>

      <!-- Right side -->
      <div class="topbar-right">
        <!-- Mobile preview toggle -->
        <button class="preview-toggle-btn" (click)="togglePreview.emit()" title="Preview do Cardápio">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/>
            <line x1="12" y1="18" x2="12.01" y2="18"/>
          </svg>
        </button>

        <!-- User pill -->
        <div class="user-pill">
          <div class="user-avatar">
            @if (logoUrl) {
              <img [src]="logoUrl" [alt]="businessName" class="topbar-logo-img" />
            } @else {
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            }
          </div>
          <span class="user-name">{{ businessName }}</span>
          <span class="status-dot"></span>
        </div>
      </div>
    </header>
  `,
  styles: [`
    :host {
      display: block;
      flex-shrink: 0;
    }

    .topbar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 0 0 20px 0;
      animation: topbarIn 0.5s 0.15s cubic-bezier(0.4, 0, 0.2, 1) both;
    }

    /* ── Hamburger (mobile only) ── */
    .hamburger-btn {
      display: none;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
      color: #A1A1AA;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .hamburger-btn:hover {
      background: rgba(244, 123, 32, 0.1);
      color: #F47B20;
    }

    /* ── Search ── */
    .search-box {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 10px 18px;
      flex: 1;
      max-width: 520px;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(8px);
    }
    .search-box:focus-within {
      border-color: rgba(244, 123, 32, 0.3);
      box-shadow: 0 0 0 3px rgba(244, 123, 32, 0.08);
      background: rgba(255, 255, 255, 0.05);
    }

    .search-icon {
      color: #52525B;
      flex-shrink: 0;
    }

    .search-input {
      background: transparent;
      border: none;
      color: #E4E4E7;
      outline: none;
      width: 100%;
      font-family: 'Inter', sans-serif;
      font-size: 0.88rem;
    }
    .search-input::placeholder {
      color: #52525B;
    }

    .search-clear {
      background: none;
      border: none;
      color: #52525B;
      cursor: pointer;
      display: flex;
      padding: 2px;
      border-radius: 4px;
      transition: color 0.15s;
    }
    .search-clear:hover {
      color: #F47B20;
    }

    /* ── Right side ── */
    .topbar-right {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .preview-toggle-btn {
      display: none;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(244, 123, 32, 0.1);
      border: 1px solid rgba(244, 123, 32, 0.2);
      color: #F47B20;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }
    .preview-toggle-btn:hover {
      background: rgba(244, 123, 32, 0.18);
      transform: translateY(-1px);
    }

    .user-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      padding: 7px 14px 7px 8px;
      border-radius: 14px;
      transition: all 0.2s;
    }
    .user-pill:hover {
      border-color: rgba(255, 255, 255, 0.1);
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      background: linear-gradient(135deg, rgba(244, 123, 32, 0.15), rgba(244, 123, 32, 0.08));
      color: #F47B20;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .user-name {
      font-family: 'Inter', sans-serif;
      font-size: 0.85rem;
      font-weight: 600;
      color: #E4E4E7;
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22C55E;
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
      flex-shrink: 0;
    }

    .topbar-logo-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }

    /* ── Animations ── */
    @keyframes topbarIn {
      from { opacity: 0; transform: translateY(-12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Responsive ── */
    @media (max-width: 1024px) {
      .hamburger-btn {
        display: flex;
      }
      .preview-toggle-btn {
        display: flex;
      }
      .user-name {
        display: none;
      }
    }

    @media (max-width: 640px) {
      .search-box {
        max-width: none;
      }
      .topbar {
        gap: 8px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .topbar { animation: none; }
    }
  `]
})
export class TopbarComponent {
  @Input() businessName = 'Seu Estabelecimento';
  @Input() logoUrl: string | null = null;
  @Input() searchQuery = '';
  @Input() searchPlaceholder = 'Buscar produtos, categorias...';
  @Output() searchChange = new EventEmitter<string>();
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() togglePreview = new EventEmitter<void>();
}
