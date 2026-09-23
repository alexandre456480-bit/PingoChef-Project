import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ActiveSection = 'dashboard' | 'menu' | 'empresa' | 'design' | 'preview' | 'likes';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Mobile overlay -->
    @if (mobileOpen) {
      <div class="sidebar-overlay" (click)="closeMobile()" @fadeIn></div>
    }

    <aside class="sidebar" [class.mobile-open]="mobileOpen">
      <div class="sidebar-top">
        <!-- Brand -->
        <div class="sidebar-brand">
          <img src="/logo_img.webp" alt="Cardápio Digital" class="brand-logo" />
          <span class="brand-text">Cardápio<span class="brand-accent">Digital</span></span>
        </div>

        <!-- Navigation -->
        <nav class="nav-menu">
          @for (item of navItems; track item.section; let i = $index) {
            <button
              class="nav-item"
              [class.active]="activeSection === item.section"
              (click)="navigate(item.section)"
              [style.animation-delay]="(i * 60) + 'ms'">
              <span class="nav-glow"></span>
              <span class="nav-icon-wrap">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  @switch (item.section) {
                    @case ('dashboard') {
                      <rect width="7" height="7" x="3" y="3" rx="1"/>
                      <rect width="7" height="7" x="14" y="3" rx="1"/>
                      <rect width="7" height="7" x="14" y="14" rx="1"/>
                      <rect width="7" height="7" x="3" y="14" rx="1"/>
                    }
                    @case ('menu') {
                      <path d="M4 6h16M4 12h16M4 18h7"/>
                      <circle cx="18" cy="18" r="3"/>
                      <path d="m20.2 20.2 1.8 1.8"/>
                    }
                    @case ('empresa') {
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    }
                    @case ('design') {
                      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
                      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
                      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
                      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                    }
                    @case ('preview') {
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    }
                    @case ('likes') {
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                    }
                  }
                </svg>
              </span>
              <span class="nav-label">{{ item.label }}</span>
              @if (activeSection === item.section) {
                <span class="active-dot"></span>
              }
            </button>
          }

          <div class="nav-separator"></div>

          <button class="nav-item logout-item" (click)="onLogout.emit()">
            <span class="nav-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </span>
            <span class="nav-label">Sair</span>
          </button>
        </nav>
      </div>

      <!-- Bottom actions -->
      <div class="sidebar-bottom">
        <button class="icon-round-btn" title="Configurações (Em breve)" (click)="onToast.emit('Configurações em desenvolvimento')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </aside>
  `,
  styles: [`
    :host {
      display: contents;
    }

    .sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 90;
      animation: overlayIn 0.25s ease-out;
    }

    .sidebar {
      background: linear-gradient(180deg, #141416 0%, #111113 100%);
      border-right: 1px solid rgba(255, 255, 255, 0.04);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 24px 0 24px 0;
      z-index: 100;
      position: relative;
      overflow: hidden;
    }

    /* Decorative gradient accent on the right edge */
    .sidebar::after {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 1px;
      height: 100%;
      background: linear-gradient(
        180deg,
        transparent 0%,
        rgba(244, 123, 32, 0.3) 30%,
        rgba(244, 123, 32, 0.5) 50%,
        rgba(244, 123, 32, 0.3) 70%,
        transparent 100%
      );
    }

    .sidebar-top {
      display: flex;
      flex-direction: column;
    }

    /* ── Brand ── */
    .sidebar-brand {
      padding: 0 20px 32px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      animation: slideDown 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
    }

    .brand-logo {
      width: 40px;
      height: 40px;
      object-fit: contain;
      filter: drop-shadow(0 4px 12px rgba(244, 123, 32, 0.3));
      animation: floatLogo 3s ease-in-out infinite;
    }

    .brand-text {
      font-family: 'Outfit', sans-serif;
      font-size: 1rem;
      font-weight: 700;
      color: #E4E4E7;
      letter-spacing: -0.02em;
      line-height: 1.1;
    }

    .brand-accent {
      color: #F47B20;
      display: block;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.04em;
    }

    /* ── Navigation ── */
    .nav-menu {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 0 12px 0 0;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 14px;
      background: transparent;
      border: none;
      color: #71717A;
      padding: 11px 16px 11px 20px;
      font-family: 'Inter', sans-serif;
      font-size: 0.88rem;
      font-weight: 500;
      cursor: pointer;
      border-radius: 0 16px 16px 0;
      position: relative;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      text-align: left;
      overflow: hidden;
      animation: navItemIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
    }

    .nav-item:hover {
      color: #D4D4D8;
      background: rgba(255, 255, 255, 0.03);
    }

    .nav-item:hover .nav-icon-wrap {
      transform: scale(1.1);
    }

    /* Active state with claymorphism */
    .nav-item.active {
      background: linear-gradient(135deg, rgba(244, 123, 32, 0.12) 0%, rgba(244, 123, 32, 0.06) 100%);
      color: #F47B20;
      font-weight: 600;
      box-shadow:
        inset 3px 0 0 #F47B20,
        0 4px 12px rgba(244, 123, 32, 0.08);
    }

    .nav-glow {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 0;
      height: 100%;
      background: radial-gradient(circle at left, rgba(244, 123, 32, 0.15), transparent 70%);
      transition: width 0.3s ease;
      pointer-events: none;
    }

    .nav-item.active .nav-glow {
      width: 100%;
    }

    .nav-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.04);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      flex-shrink: 0;
    }

    .nav-item.active .nav-icon-wrap {
      background: rgba(244, 123, 32, 0.18);
      box-shadow:
        0 2px 8px rgba(244, 123, 32, 0.15),
        inset 1px 1px 2px rgba(255, 255, 255, 0.1);
    }

    .nav-label {
      flex: 1;
      white-space: nowrap;
    }

    .active-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #F47B20;
      box-shadow: 0 0 8px rgba(244, 123, 32, 0.6);
      animation: pulse 2s ease-in-out infinite;
    }

    .nav-separator {
      height: 1px;
      margin: 12px 20px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
    }

    .logout-item:hover {
      color: #EF4444 !important;
    }
    .logout-item:hover .nav-icon-wrap {
      background: rgba(239, 68, 68, 0.12);
    }

    /* ── Bottom ── */
    .sidebar-bottom {
      display: flex;
      gap: 12px;
      padding: 0 20px;
      animation: slideUp 0.5s 0.3s cubic-bezier(0.4, 0, 0.2, 1) both;
    }

    .icon-round-btn {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
      color: #71717A;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .icon-round-btn:hover {
      background: rgba(244, 123, 32, 0.1);
      border-color: rgba(244, 123, 32, 0.2);
      color: #F47B20;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(244, 123, 32, 0.12);
    }

    /* ── Animations ── */
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes navItemIn {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }

    @keyframes floatLogo {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    @keyframes overlayIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* ── Responsive ── */
    @media (max-width: 1024px) {
      .sidebar {
        position: fixed;
        left: -280px;
        top: 0;
        width: 260px;
        height: 100vh;
        transition: left 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: none;
      }
      .sidebar.mobile-open {
        left: 0;
        box-shadow: 20px 0 60px rgba(0, 0, 0, 0.5);
      }
      .sidebar-overlay {
        display: block;
      }
      .brand-text {
        display: block;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .nav-item,
      .sidebar-brand,
      .sidebar-bottom,
      .brand-logo {
        animation: none !important;
      }
      .active-dot {
        animation: none;
      }
    }
  `]
})
export class SidebarComponent {
  @Input() activeSection: ActiveSection = 'dashboard';
  @Input() mobileOpen = false;
  @Output() sectionChange = new EventEmitter<ActiveSection>();
  @Output() onLogout = new EventEmitter<void>();
  @Output() onToast = new EventEmitter<string>();
  @Output() mobileClose = new EventEmitter<void>();

  navItems: { section: ActiveSection; label: string }[] = [
    { section: 'dashboard', label: 'Início' },
    { section: 'menu', label: 'Menu' },
    { section: 'empresa', label: 'Empresa' },
    { section: 'design', label: 'Design' },
    { section: 'preview', label: 'Preview' },
    { section: 'likes', label: 'Likes' }
  ];

  navigate(section: ActiveSection): void {
    this.sectionChange.emit(section);
    this.mobileClose.emit();
  }

  closeMobile(): void {
    this.mobileClose.emit();
  }
}
