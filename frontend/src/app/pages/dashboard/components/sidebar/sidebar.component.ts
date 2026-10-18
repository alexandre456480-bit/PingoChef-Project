import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ActiveSection = 'dashboard' | 'menu' | 'empresa' | 'design' | 'preview' | 'likes' | 'analytics' | 'qr';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Mobile overlay -->
    @if (mobileOpen) {
      <div class="sidebar-overlay" (click)="closeMobile()"></div>
    }

    <aside class="sidebar" [class.mobile-open]="mobileOpen">
      <div class="sidebar-top">
        <!-- Brand -->
        <div class="sidebar-brand">
          <img src="/logo_principal_tema_light.webp" alt="PingoChef — Cardápio Digital" class="brand-logo" />
        </div>

        <!-- Navigation -->
        <nav class="nav-menu">
          @for (item of navItems; track item.section; let i = $index) {
            <button
              class="nav-item"
              [attr.data-tour]="'nav-' + item.section"
              [class.active]="activeSection === item.section"
              [attr.aria-current]="activeSection === item.section ? 'page' : null"
              (click)="navigate(item.section)"
              [style.animation-delay]="(i * 60) + 'ms'">
              <span class="nav-glow"></span>
              <span class="nav-icon-wrap" aria-hidden="true">
                <svg class="nav-icon-3d" width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <defs>
                    <linearGradient [attr.id]="'sidebar-icon-' + item.section" x1="0" y1="0" x2="1" y2="1">
                      <stop stop-color="#FFE6BC"/>
                      <stop offset="1" stop-color="#F47B20"/>
                    </linearGradient>
                  </defs>
                  <g [attr.fill]="'url(#sidebar-icon-' + item.section + ')'">
                  @switch (item.section) {
                    @case ('dashboard') {
                      <g transform="matrix(1 .18 -.22 .95 4 -1)">
                        <path d="M3 6h10v10H3zM17 6h10v10H17zM3 20h10v10H3zM17 20h10v10H17z" fill="#B94719"/>
                        <rect x="3" y="3" width="10" height="10" rx="2"/>
                        <rect x="17" y="3" width="10" height="10" rx="2"/>
                        <rect x="3" y="17" width="10" height="10" rx="2"/>
                        <rect x="17" y="17" width="10" height="10" rx="2"/>
                        <path d="M5 5h6M19 5h6M5 19h6M19 19h6" stroke="#FFF4DC" stroke-linecap="round"/>
                      </g>
                    }
                    @case ('menu') {
                      <path d="m5 6 19-3 4 3v23L9 31l-4-4z" fill="#B94719"/>
                      <path d="m8 8 19-3v21L8 29z" fill="#FFF4DC"/>
                      <path d="m5 5 19-3v23L5 28z"/>
                      <path d="M8 5v22" stroke="#D26E2D" stroke-width="2"/>
                      <path d="m12 10 8-1m-8 5 8-1m-8 5 5-.6" stroke="#690A1A" stroke-width="1.8" stroke-linecap="round"/>
                    }
                    @case ('empresa') {
                      <path d="m5 10 20-3 4 4v16l-20 4-4-4z" fill="#B94719"/>
                      <path d="m5 10 20-3v20L5 30z" fill="#FFE6BC"/>
                      <path d="m5 5 20-3 4 4-20 3z" fill="#FFF4DC"/>
                      <path d="m5 5 20-3 3 9-24 4z"/>
                      <path d="m10 5-1 9m7-10v9m6-10 2 9" stroke="#FFF4DC" stroke-width="2"/>
                      <path d="m9 19 6-1v11l-6 1z" fill="#690A1A"/>
                      <path d="m18 18 4-.6v5l-4 .6z" fill="#D26E2D"/>
                    }
                    @case ('design') {
                      <path d="M17 5C9 5 3 11 3 18s6 12 13 12c4 0 2-4 4-6 2-2 9 1 9-7S24 5 17 5Z" fill="#7C3C9C"/>
                      <path d="M17 2C9 2 3 8 3 15s6 12 13 12c4 0 2-4 4-6 2-2 9 1 9-7S24 2 17 2Z" fill="#D8B4FE"/>
                      <path d="M6 11c2-4 6-6 10-6" stroke="#F3E8FF" stroke-width="1.5" stroke-linecap="round"/>
                      <circle cx="10" cy="11" r="2.6" fill="#FB7185"/>
                      <circle cx="18" cy="8" r="2.6" fill="#FBBF24"/>
                      <circle cx="24" cy="13" r="2.6" fill="#38BDF8"/>
                      <circle cx="8" cy="19" r="2.6" fill="#34D399"/>
                    }
                    @case ('analytics') {
                      <path d="m3 23 23-4 4 4-23 5z" fill="#B94719"/>
                      <path d="m4 17 5-1v9l-5 1zm9-6 5-1v14l-5 1zm9-7 5-1v19l-5 1z"/>
                      <path d="m9 16 3 3v5l-3 1zm9-6 3 3v10l-3 1zm9-7 3 3v15l-3 1z" fill="#D26E2D"/>
                      <path d="m4 17 5-1 3 3-5 1zm9-6 5-1 3 3-5 1zm9-7 5-1 3 3-5 1z" fill="#FFF4DC"/>
                    }
                    @case ('qr') {
                      <path d="m5 6 21-3 3 3v23L8 32l-3-3z" fill="#B94719"/>
                      <path d="m3 4 23-3v24L3 29z"/>
                      <g transform="matrix(1 -.14 0 1 0 4)" fill="#690A1A">
                        <path fill-rule="evenodd" d="M6 2h7v7H6zM8 4v3h3V4zM16 2h7v7h-7zM18 4v3h3V4zM6 12h7v7H6zM8 14v3h3v-3z"/>
                        <path d="M16 12h3v3h-3zm5 0h2v7h-4v-2h2zm-5 5h2v2h-2z"/>
                      </g>
                    }
                    @case ('preview') {
                      <path d="M2 16s4-9 14-9 14 9 14 9-4 9-14 9S2 16 2 16Z"/>
                      <circle cx="16" cy="16" r="4" fill="#690A1A"/>
                    }
                    @case ('likes') {
                      <path d="M16 28 5 17C-4 8 8-2 16 7c8-9 20 1 11 10Z"/>
                    }
                  }
                  </g>
                </svg>
              </span>
              <span class="nav-label">{{ item.label }}</span>
              @if ((item.section==='analytics'&&!analyticsEnabled)||(item.section==='qr'&&!qrEnabled)) {
                <svg aria-label="Não incluído no plano" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
              }
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
        <button class="icon-round-btn" title="Configurações" aria-label="Abrir configurações" (click)="settingsOpen.emit(); mobileClose.emit()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
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
      background: linear-gradient(165deg, #690A1A, #410612);
      border-right: 1px solid rgba(255, 255, 255, 0.04);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 24px 0 24px 0;
      z-index: 100;
      position: relative;
      overflow-y: auto;
      overflow-x: hidden;
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
      padding: 0 20px 24px 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: slideDown 0.5s cubic-bezier(0.4, 0, 0.2, 1) both;
    }

    .brand-logo {
      width: 132px;
      height: 92px;
      object-fit: contain;
      filter: none;
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
      color: #CEBBC4;
      padding: 11px 16px 11px 20px;
      font-family: 'Inter', sans-serif;
      font-size: 0.88rem;
      font-weight: 500;
      cursor: pointer;
      border-radius: 0 16px 16px 0;
      position: relative;
      transition: transform 180ms ease-out, opacity 180ms ease-out, background-color 180ms ease-out, color 180ms ease-out;
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

    .nav-item:focus-visible, .icon-round-btn:focus-visible {
      outline: 2px solid #FFAB66;
      outline-offset: -3px;
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
      background: linear-gradient(145deg, #8B1A3A, #520817);
      border: 1px solid rgba(255, 230, 188, .16);
      box-shadow: 0 3px 5px rgba(35, 3, 10, .3), inset 1px 1px 1px rgba(255, 230, 188, .15);
      transition: transform 180ms ease-out, opacity 180ms ease-out, background-color 180ms ease-out, color 180ms ease-out;
      flex-shrink: 0;
    }

    .nav-item.active .nav-icon-wrap {
      background: linear-gradient(145deg, #A43836, #690A1A);
      box-shadow:
        0 2px 8px rgba(244, 123, 32, 0.15),
        inset 1px 1px 2px rgba(255, 255, 255, 0.1);
    }

    .nav-icon-3d { overflow: visible; filter: drop-shadow(0 2px 1px rgba(35, 3, 10, .4)); }

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
      flex-shrink:0;
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
      transition: transform 180ms ease-out, opacity 180ms ease-out, background-color 180ms ease-out, color 180ms ease-out;
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
        left: 0;
        transform: translateX(-100%);
        top: 0;
        width: 260px;
        height: 100dvh;
        transition: transform 250ms ease-out;
        box-shadow: none;
      }
      .sidebar.mobile-open {
        transform: translateX(0);
        box-shadow: 20px 0 60px rgba(0, 0, 0, 0.5);
      }
      .sidebar:not(.mobile-open){visibility:hidden}
      .sidebar-overlay {
        display: block;
      }
      .brand-text {
        display: block;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .sidebar,.nav-item,.nav-icon-wrap,.icon-round-btn{transition:none!important}
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
  @Input() analyticsEnabled=false;
  @Input() qrEnabled=false;
  @Output() settingsOpen=new EventEmitter<void>();
  @Input() isDarkTheme = false;
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
    { section: 'analytics', label: 'Analytics' },
    { section: 'qr', label: 'QR Code' }
  ];

  navigate(section: ActiveSection): void {
    this.sectionChange.emit(section);
    this.mobileClose.emit();
  }

  closeMobile(): void {
    this.mobileClose.emit();
  }
  @HostListener('document:keydown.escape') onEscape(){if(this.mobileOpen)this.closeMobile();}
}
