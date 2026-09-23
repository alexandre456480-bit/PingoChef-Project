import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MenuService } from '../../services/menu.service';
import { DesignService } from '../../services/design.service';
import { forkJoin, switchMap } from 'rxjs';
import { ProductPlaybackService } from '../../services/product-playback.service';

import { SidebarComponent, ActiveSection } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';
import { PhonePreviewComponent } from './components/phone-preview/phone-preview.component';

import { DashboardHomeComponent } from './sections/dashboard-home/dashboard-home.component';
import { MenuEditorComponent } from './sections/menu-editor/menu-editor.component';
import { BusinessEditorComponent } from './sections/business-editor/business-editor.component';
import { DesignEditorComponent } from './sections/design-editor/design-editor.component';
import { PreviewSectionComponent } from './sections/preview-section/preview-section.component';
import { LikesSectionComponent } from './sections/likes-section/likes-section.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    TopbarComponent,
    PhonePreviewComponent,
    DashboardHomeComponent,
    MenuEditorComponent,
    BusinessEditorComponent,
    DesignEditorComponent,
    PreviewSectionComponent,
    LikesSectionComponent
  ],
  template: `
    <div class="dashboard-shell">
      <!-- 1. Sidebar -->
      <app-sidebar
        [activeSection]="activeSection"
        [mobileOpen]="mobileSidebarOpen"
        (sectionChange)="setSection($event)"
        (onLogout)="onLogout()"
        (onToast)="showToast($event)"
        (mobileClose)="mobileSidebarOpen = false">
      </app-sidebar>

      <!-- 2. Main Content Area -->
      <div class="main-viewport">
        <!-- Topbar -->
        <app-topbar
          [businessName]="businessName"
          [logoUrl]="businessLogo"
          [searchQuery]="searchQuery"
          (searchChange)="searchQuery = $event"
          (toggleSidebar)="mobileSidebarOpen = !mobileSidebarOpen"
          (togglePreview)="mobilePreviewOpen = !mobilePreviewOpen">
        </app-topbar>

        <!-- Dynamic Content Section -->
        <main class="content-canvas">
          @switch (activeSection) {
            @case ('dashboard') {
              <app-dashboard-home
                (navigateTo)="setSection($event)"
                (onToast)="showToast($event)">
              </app-dashboard-home>
            }
            @case ('menu') {
              <app-menu-editor
                (onToast)="showToast($event)">
              </app-menu-editor>
            }
            @case ('empresa') {
              <app-business-editor
                (onToast)="showToast($event)">
              </app-business-editor>
            }
            @case ('design') {
              <app-design-editor
                (onToast)="showToast($event)">
              </app-design-editor>
            }
            @case ('preview') {
              <app-preview-section
                (onPublish)="publishMenu()">
              </app-preview-section>
            }
            @case ('likes') {
              <app-likes-section></app-likes-section>
            }
          }
        </main>
      </div>

      <!-- 3. Right Panel: Phone Preview (Desktop Column) -->
      <aside class="preview-panel" [class.preview-hidden]="!showDesktopPreview">
        <div class="preview-panel-header">
          <div class="header-badge">
            <span class="pulse-dot"></span>
            <span>Preview ao Vivo</span>
          </div>
          <button class="preview-minimize-btn" (click)="toggleDesktopPreview()" [title]="showDesktopPreview ? 'Recolher preview' : 'Expandir preview'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              @if (showDesktopPreview) {
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              } @else {
                <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>
              }
            </svg>
          </button>
        </div>

        <div class="preview-device-stage">
          <app-phone-preview></app-phone-preview>
        </div>
      </aside>

      <!-- 4. Mobile Preview Modal / Drawer -->
      @if (mobilePreviewOpen) {
        <div class="mobile-preview-backdrop" (click)="mobilePreviewOpen = false">
          <div class="mobile-preview-modal" (click)="$event.stopPropagation()">
            <div class="modal-bar">
              <div class="modal-handle"></div>
              <button class="close-btn" (click)="mobilePreviewOpen = false">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="modal-stage">
              <app-phone-preview></app-phone-preview>
            </div>
          </div>
        </div>
      }

      <!-- 5. Floating Toast Notification -->
      @if (toastMessage) {
        <div class="toast-floating" role="alert">
          <div class="toast-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span>{{ toastMessage }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
      background: #0E0E11;
      color: #F4F4F5;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    .dashboard-shell {
      display: grid;
      grid-template-columns: 240px 1fr 440px;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      position: relative;
      transition: grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* When preview panel is collapsed on desktop */
    .dashboard-shell:has(.preview-hidden) {
      grid-template-columns: 240px 1fr 64px;
    }

    /* ── Main Viewport ── */
    .main-viewport {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      background: radial-gradient(circle at 50% 0%, #17171C 0%, #0E0E11 75%);
      position: relative;
      border-right: 1px solid rgba(255, 255, 255, 0.05);
    }

    .content-canvas {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 28px 32px 64px 32px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
    }

    .content-canvas::-webkit-scrollbar {
      width: 6px;
    }
    .content-canvas::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.12);
      border-radius: 4px;
    }

    /* ── Preview Panel (Desktop) ── */
    .preview-panel {
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: #111114;
      position: relative;
      overflow: hidden;
      border-left: 1px solid rgba(255, 255, 255, 0.04);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .preview-panel-header {
      padding: 18px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      background: rgba(17, 17, 20, 0.8);
      backdrop-filter: blur(12px);
      z-index: 10;
    }

    .header-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      border-radius: 20px;
      background: rgba(244, 123, 32, 0.1);
      border: 1px solid rgba(244, 123, 32, 0.2);
      color: #F47B20;
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #22C55E;
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
      animation: pulseGreen 2s infinite;
    }

    @keyframes pulseGreen {
      0% { transform: scale(0.9); opacity: 0.8; }
      50% { transform: scale(1.3); opacity: 1; }
      100% { transform: scale(0.9); opacity: 0.8; }
    }

    .preview-minimize-btn {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
      color: #A1A1AA;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .preview-minimize-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #FFF;
      border-color: rgba(255, 255, 255, 0.15);
    }

    .preview-device-stage {
      flex: 1;
      overflow-y: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      scrollbar-width: none;
    }

    .preview-device-stage::-webkit-scrollbar {
      display: none;
    }

    /* Collapsed state */
    .preview-panel.preview-hidden .header-badge,
    .preview-panel.preview-hidden .preview-device-stage {
      display: none;
    }

    .preview-panel.preview-hidden .preview-panel-header {
      justify-content: center;
      padding: 18px 8px;
    }

    /* ── Mobile Preview Modal / Drawer ── */
    .mobile-preview-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      z-index: 200;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      animation: fadeIn 0.25s ease-out;
    }

    .mobile-preview-modal {
      width: 100%;
      max-width: 480px;
      height: 90vh;
      background: #141418;
      border-top-left-radius: 28px;
      border-top-right-radius: 28px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.7);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .modal-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      position: relative;
    }

    .modal-handle {
      width: 36px;
      height: 4px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.2);
      margin: 0 auto;
    }

    .close-btn {
      position: absolute;
      right: 16px;
      top: 12px;
      background: rgba(255, 255, 255, 0.06);
      border: none;
      color: #A1A1AA;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .modal-stage {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 24px 12px 36px;
    }

    /* ── Toast Notification ── */
    .toast-floating {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(26, 26, 32, 0.95);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(244, 123, 32, 0.4);
      color: #FFF;
      padding: 12px 22px;
      border-radius: 30px;
      font-size: 0.88rem;
      font-weight: 600;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6), inset 1px 1px 1px rgba(255, 255, 255, 0.1);
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: toastIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .toast-icon {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: rgba(244, 123, 32, 0.2);
      color: #F47B20;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    @keyframes toastIn {
      from { opacity: 0; transform: translate(-50%, 14px) scale(0.96); }
      to { opacity: 1; transform: translate(-50%, 0) scale(1); }
    }

    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* ── Responsive Breakdown ── */
    @media (max-width: 1280px) {
      .dashboard-shell {
        grid-template-columns: 240px 1fr 380px;
      }
    }

    @media (max-width: 1100px) {
      .dashboard-shell {
        grid-template-columns: 220px 1fr 0px;
      }
      .preview-panel {
        display: none;
      }
      .content-canvas {
        padding: 24px 20px 48px 20px;
      }
    }

    @media (max-width: 820px) {
      .dashboard-shell {
        grid-template-columns: 1fr;
      }
      .content-canvas {
        padding: 16px 14px 40px 14px;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  activeSection: ActiveSection = 'dashboard';
  searchQuery = '';
  toastMessage: string | null = null;
  mobileSidebarOpen = false;
  mobilePreviewOpen = false;
  showDesktopPreview = true;

  constructor(
    public authService: AuthService,
    public menuService: MenuService,
    public designService: DesignService,
    private productPlaybackService: ProductPlaybackService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Carrega dados iniciais essenciais para alimentar os componentes e o phone-preview em tempo real
    this.menuService.loadCategories().subscribe();
    this.menuService.loadItems().subscribe();
    this.designService.loadDesign().subscribe();
  }

  get businessName(): string {
    return this.authService.currentBusiness()?.name || 'Seu Estabelecimento';
  }

  get businessLogo(): string | null {
    return this.authService.currentBusiness()?.logo_url || null;
  }

  setSection(section: ActiveSection): void {
    this.activeSection = section;
  }

  toggleDesktopPreview(): void {
    this.showDesktopPreview = !this.showDesktopPreview;
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    setTimeout(() => {
      this.toastMessage = null;
    }, 3200);
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  publishMenu(): void {
    forkJoin({
      design: this.designService.saveDesign(),
      media: this.productPlaybackService.publishReadyMedia()
    }).pipe(
      switchMap(() => this.menuService.loadItems())
    ).subscribe({
      next: () => {
        this.showToast('Cardápio publicado com sucesso na versão online!');
      },
      error: () => {
        this.showToast('Não foi possível concluir a publicação. Tente novamente.');
      }
    });
  }
}
