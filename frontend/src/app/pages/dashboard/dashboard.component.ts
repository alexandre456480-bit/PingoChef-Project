import { ChangeDetectorRef, Component, OnInit, effect, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MenuService } from '../../services/menu.service';
import { DesignService } from '../../services/design.service';
import { finalize, forkJoin, switchMap } from 'rxjs';
import { ProductPlaybackService } from '../../services/product-playback.service';
import { PingoLoaderComponent } from '../../components/pingo-loader/pingo-loader.component';

import { SidebarComponent, ActiveSection } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';
import { PhonePreviewComponent } from './components/phone-preview/phone-preview.component';

import { DashboardHomeComponent } from './sections/dashboard-home/dashboard-home.component';
import { MenuEditorComponent } from './sections/menu-editor/menu-editor.component';
import { BusinessEditorComponent } from './sections/business-editor/business-editor.component';
import { DesignEditorComponent } from './sections/design-editor/design-editor.component';
import { PreviewSectionComponent } from './sections/preview-section/preview-section.component';
import { LikesSectionComponent } from './sections/likes-section/likes-section.component';
import { CommercialService } from '../../services/commercial.service';
import { SettingsComponent } from './components/settings/settings.component';
import { FeaturePreviewComponent } from './sections/feature-preview/feature-preview.component';
import { OwnerSessionState } from '../../services/owner-session-state.service';
import { AnalyticsComponent } from './sections/analytics/analytics.component';
import { QrComponent } from './sections/qr/qr.component';
import { TutorialService } from './tutorial/tutorial.service';
import type { TutorialStep } from './tutorial/tutorial.steps';
import { TutorialOverlayComponent } from './tutorial/tutorial-overlay.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  providers: [TutorialService],
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
    LikesSectionComponent,
    PingoLoaderComponent, SettingsComponent, FeaturePreviewComponent, AnalyticsComponent, QrComponent, TutorialOverlayComponent
  ],
  template: `
    <div class="dashboard-shell" [attr.data-panel-theme]="panelTheme">
      <app-pingo-loader
        [active]="isInitialLoading || isPublishing"
        [fullscreen]="true"
        [message]="isPublishing ? 'Preparando seu cardápio...' : 'Preparando tudo para você...'">
      </app-pingo-loader>

      <!-- 1. Sidebar -->
      <app-sidebar
        [attr.inert]="settingsVisible || tutorial.active() ? '' : null"
        [analyticsEnabled]="commercial.analytics()"
        [qrEnabled]="commercial.qr()"
        (settingsOpen)="settingsVisible = true"
        [activeSection]="activeSection"
        [isDarkTheme]="panelTheme === 'dark'"
        [mobileOpen]="mobileSidebarOpen"
        (sectionChange)="setSection($event)"
        (onLogout)="onLogout()"
        (onToast)="showToast($event)"
        (mobileClose)="mobileSidebarOpen = false">
      </app-sidebar>

      <!-- 2. Main Content Area -->
      <div class="main-viewport" [attr.inert]="settingsVisible || tutorial.active() ? '' : null">
        <!-- Topbar -->
        <app-topbar
          [businessName]="businessName"
          [logoUrl]="businessLogo"
          [searchQuery]="searchQuery"
          [isDarkTheme]="panelTheme === 'dark'"
          (searchChange)="searchQuery = $event"
          (themeToggle)="togglePanelTheme()"
          (settingsOpen)="settingsVisible = true"
          (toggleSidebar)="mobileSidebarOpen = !mobileSidebarOpen"
          (togglePreview)="mobilePreviewOpen = !mobilePreviewOpen">
        </app-topbar>

        <div class="publication-toolbar">
          <p>Atualize o design e os vídeos do cardápio online.</p>
          <button type="button" class="publish-menu-btn" data-tour="publish-menu"
            [disabled]="isInitialLoading || isPublishing"
            [attr.aria-busy]="isPublishing" (click)="publishMenu()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/>
            </svg>
            <span>{{ isPublishing ? 'Publicando...' : 'Publicar Cardápio' }}</span>
          </button>
        </div>

        <!-- Dynamic Content Section -->
        <main class="content-canvas" [style.padding-bottom.px]="tutorial.bottomReserve() || null"
          [style.--tutorial-sheet-space]="tutorial.step()?.id === 'design-save' && tutorial.bottomReserve() ? tutorial.bottomReserve() + 'px' : null">
          @switch (activeSection) {
            @case ('dashboard') {
              <app-dashboard-home
                [loading]="isInitialLoading"
                [dataError]="homeDataError"
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
            @case ('analytics') {
              @if (commercial.analytics()) { <app-owner-analytics></app-owner-analytics> }
              @else { <app-feature-preview feature="analytics"></app-feature-preview> }
            }
            @case ('qr') {
              @if (commercial.qr()) { <app-owner-qr></app-owner-qr> }
              @else { <app-feature-preview feature="qr"></app-feature-preview> }
            }
          }
        </main>
      </div>

      <!-- 3. Right Panel: Phone Preview (Desktop Column) -->
      <aside class="preview-panel" data-tour="preview-desktop" [class.preview-hidden]="!showDesktopPreview" [attr.inert]="settingsVisible || tutorial.active() ? '' : null">
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
              <button class="close-btn" aria-label="Fechar preview do cardápio" (click)="mobilePreviewOpen = false">
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
      @if(settingsVisible){<app-owner-settings [theme]="panelTheme" (close)="settingsVisible=false" (tutorialOpen)="restartTutorial()"></app-owner-settings>}
      @defer (when tutorial.active()) {
        @if (tutorial.active()) { <app-tutorial-overlay /> }
      } @error {
        @if (tutorial.active()) {
          <div class="tutorial-load-error" role="alert">
            <p>Não foi possível carregar o guia. Atualize a página para tentar novamente.</p>
            <button type="button" (click)="tutorial.closeForNow()">Voltar ao painel</button>
          </div>
        }
      }
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
    .tutorial-load-error{position:fixed;inset:0;z-index:1200;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;background:#180b15f0;color:#fff7f2;text-align:center}
    .tutorial-load-error button{min-height:44px;padding:12px 20px;background:#ffd27a;color:#341625;border:0;border-radius:12px;font-weight:700;cursor:pointer}

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
      min-width: 0;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      background: radial-gradient(circle at 50% 0%, #17171C 0%, #0E0E11 75%);
      position: relative;
      border-right: 1px solid rgba(255, 255, 255, 0.05);
    }

    .publication-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; padding: 0 32px 18px; flex-shrink: 0;
    }
    .publication-toolbar p { margin: 0; color: var(--panel-text-muted); font-size: .78rem; line-height: 1.5; }
    .publish-menu-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      min-height: 44px; padding: 10px 18px; flex-shrink: 0; white-space: nowrap;
      border: 1px solid rgba(255,255,255,.12); border-radius: 14px;
      background: var(--panel-action); color: #fff; box-shadow: var(--panel-action-shadow);
      font: 600 .85rem 'Inter', sans-serif; cursor: pointer;
      transition: background .15s ease, transform .15s ease;
    }
    .publish-menu-btn:hover:not(:disabled) { background: var(--panel-action-hover); }
    .publish-menu-btn:active:not(:disabled) { transform: translateY(1px); }
    .publish-menu-btn:focus-visible { outline: 2px solid var(--panel-accent); outline-offset: 3px; }
    .publish-menu-btn:disabled { opacity: .65; cursor: wait; }
    .publish-menu-btn svg { flex-shrink: 0; }
    @media(max-width:1100px) { .publication-toolbar { padding: 0 20px 16px; } }
    @media(max-width:1024px) { .publication-toolbar { padding: 0 14px 12px; } }
    @media(max-width:640px) {
      .publication-toolbar p { display: none; }
      .publish-menu-btn { width: 100%; }
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
      transition: transform 180ms ease-out, opacity 180ms ease-out, background-color 180ms ease-out, color 180ms ease-out;
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
      transition: transform 180ms ease-out, opacity 180ms ease-out, background-color 180ms ease-out, color 180ms ease-out;
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
      width: max-content;
      max-width: calc(100vw - 32px);
      box-sizing: border-box;
      pointer-events: none;
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

    @media (max-width: 1024px) {
      .dashboard-shell {
        grid-template-columns: 1fr;
      }
      .content-canvas {
        padding: 16px 14px 40px 14px;
      }
    }
    .dashboard-shell{--pc-surface:#281320;--pc-text:#fff7f2;--pc-muted:#cebbc4;--pc-border:#ffffff20;--pc-link:#ffab66;--pc-track:#513348;background:#180b15}
    .main-viewport{background:radial-gradient(circle at 50% 0%,#281320,#180b15 75%)}
    .dashboard-shell[data-panel-theme=light]{--pc-surface:#fff9f4;--pc-text:#2d1b2e;--pc-muted:#725f68;--pc-border:#ddcccf;--pc-link:#691525;--pc-track:#eadbdc;background:#f7eee7}
    .dashboard-shell[data-panel-theme=light] .main-viewport{background:#f7eee7}
    @media(max-width:1100px){.dashboard-shell:has(.preview-hidden){grid-template-columns:220px 1fr 0}}
    @media(max-width:1024px){.dashboard-shell:has(.preview-hidden){grid-template-columns:minmax(0,1fr)}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild(MenuEditorComponent) private menuEditor?: MenuEditorComponent;
  private tutorialSnapshot?: { section: ActiveSection; sidebar: boolean; preview: boolean; mobilePreview: boolean };
  private resourcesWasOpen?: boolean;
  settingsVisible=false;
  private refreshTimer?:ReturnType<typeof setTimeout>;
  activeSection: ActiveSection = 'dashboard';
  searchQuery = '';
  toastMessage: string | null = null;
  mobileSidebarOpen = false;
  mobilePreviewOpen = false;
  showDesktopPreview = true;
  panelTheme: 'light' | 'dark' = 'dark';
  isInitialLoading = true;
  homeDataError = '';
  isPublishing = false;

  private pendingInitialRequests = 3;

  constructor(
    public authService: AuthService,
    public menuService: MenuService,
    public designService: DesignService,
    private productPlaybackService: ProductPlaybackService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    public commercial: CommercialService,
    public tutorial: TutorialService,
    state:OwnerSessionState
  ) {
    effect(()=>{
      if(state.sessionExpired())this.router.navigate(['/login'],{queryParams:{session:'expired'}});
    });
    effect(()=>{
      const version=state.usageVersion();
      if(version>0){clearTimeout(this.refreshTimer);this.refreshTimer=setTimeout(()=>this.authService.restore().subscribe({error:()=>this.showToast('Não foi possível atualizar o uso do plano. Tente novamente.')}),250);}
    });
  }
  ngOnDestroy(){clearTimeout(this.refreshTimer);}

  ngOnInit(): void {
    this.tutorial.connect({ prepare: step => this.prepareTutorial(step), restore: () => this.restoreTutorial() });
    try {
      this.panelTheme = localStorage.getItem('pingo-chef-panel-theme') === 'light' ? 'light' : 'dark';
    } catch {
      this.panelTheme = 'dark';
    }

    // Carrega dados iniciais essenciais para alimentar os componentes e o phone-preview em tempo real
    this.menuService.loadCategories()
      .pipe(finalize(() => this.completeInitialRequest()))
      .subscribe({error:()=>{this.homeDataError = 'Não foi possível carregar as categorias.';this.showToast('Não foi possível carregar as categorias. Confira sua conexão.');}});
    this.menuService.loadItems()
      .pipe(finalize(() => this.completeInitialRequest()))
      .subscribe({error:()=>{this.homeDataError = 'Não foi possível carregar os produtos.';this.showToast('Não foi possível carregar os produtos. Confira sua conexão.');}});
    this.designService.loadDesign()
      .pipe(finalize(() => this.completeInitialRequest()))
      .subscribe({error:()=>this.showToast('Não foi possível carregar o design. Confira sua conexão.')});
  }

  async restartTutorial(): Promise<void> {
    this.settingsVisible = false;
    await this.tutorial.start();
    if (this.tutorial.error()) this.showToast(this.tutorial.error());
    this.cdr.markForCheck();
  }

  private async prepareTutorial(step: TutorialStep): Promise<void> {
    this.tutorialSnapshot ??= { section: this.activeSection, sidebar: this.mobileSidebarOpen,
      preview: this.showDesktopPreview, mobilePreview: this.mobilePreviewOpen };
    this.settingsVisible = false;
    this.mobilePreviewOpen = false;
    this.activeSection = step.section;
    this.mobileSidebarOpen = step.prepare === 'navigation' && window.innerWidth <= 1024;
    if (step.prepare === 'preview') this.showDesktopPreview = true;
    // Section changes in this dashboard are local state, not separate URL routes.
    this.cdr.detectChanges();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (!this.tutorial.active()) return;
    if (step.prepare === 'subcategory' && this.menuEditor && this.menuService.categories().length)
      this.menuEditor.filterBy(this.menuService.categories()[0].id);
    const resources = document.querySelector<HTMLDetailsElement>('[data-tour="resources-panel"]');
    if (resources) {
      if (step.prepare === 'resources') {
        this.resourcesWasOpen ??= resources.open;
        resources.open = true;
      } else if (this.resourcesWasOpen !== undefined) {
        resources.open = this.resourcesWasOpen;
        this.resourcesWasOpen = undefined;
      }
    }
    this.cdr.detectChanges();
  }

  private restoreTutorial(): void {
    const snapshot = this.tutorialSnapshot;
    if (!snapshot) return;
    this.activeSection = snapshot.section; this.mobileSidebarOpen = snapshot.sidebar;
    this.showDesktopPreview = snapshot.preview; this.mobilePreviewOpen = snapshot.mobilePreview;
    this.tutorialSnapshot = undefined; this.resourcesWasOpen = undefined;
    this.cdr.markForCheck();
    // The settings launch button can disappear while touring. Return to a visible, safe control.
    setTimeout(() => document.querySelector<HTMLElement>('[data-tour="publish-menu"]')?.focus({ preventScroll: true }));
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

  togglePanelTheme(): void {
    this.panelTheme = this.panelTheme === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem('pingo-chef-panel-theme', this.panelTheme);
    } catch {
      // O tema continua funcionando mesmo quando o armazenamento está indisponível.
    }
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.toastMessage = null;
      this.cdr.markForCheck();
    }, 3200);
  }

  onLogout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.showToast('Não foi possível encerrar a sessão. Tente novamente.')
    });
  }

  publishMenu(): void {
    if (this.isPublishing) return;
    this.isPublishing = true;

    forkJoin({
      design: this.designService.saveDesign(),
      media: this.productPlaybackService.publishReadyMedia()
    }).pipe(
      switchMap(() => this.authService.publishBusinessMenu()),
      switchMap(() => this.menuService.loadItems()),
      finalize(() => {
        this.isPublishing = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.showToast('Cardápio publicado com sucesso na versão online!');
      },
      error: () => {
        this.showToast('Não foi possível concluir a publicação. Tente novamente.');
      }
    });
  }

  private completeInitialRequest(): void {
    this.pendingInitialRequests = Math.max(0, this.pendingInitialRequests - 1);
    this.isInitialLoading = this.pendingInitialRequests > 0;
    this.cdr.markForCheck();
    if (!this.isInitialLoading && !this.homeDataError) void this.tutorial.autoStart();
  }
}
