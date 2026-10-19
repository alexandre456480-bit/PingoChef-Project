import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-topbar', standalone: true,
  template: `
    <header class="topbar">
      <div class="topbar-identity">
        <button class="hamburger-btn" type="button" aria-label="Abrir menu" aria-controls="panel-sidebar"
          [attr.aria-expanded]="sidebarOpen" (click)="toggleSidebar.emit()">
          <svg class="hamburger-lines" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h12M4 18h8"/></svg>
          <img class="mobile-menu-logo" src="/icon_pinguim.webp" alt="" width="48" height="48" />
        </button>
        <div class="user-pill">
          <div class="user-avatar">
            @if (logoUrl) { <img [src]="logoUrl" alt="" class="topbar-logo-img" /> }
            @else { <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }
          </div>
          <span class="user-name">{{ businessName }}</span><span class="status-dot" aria-hidden="true"></span>
        </div>
      </div>
      <div class="topbar-actions">
        <button type="button" class="preview-toggle-btn" data-tour="preview-mobile" (click)="togglePreview.emit()"
          title="Preview do Cardápio" aria-label="Preview do Cardápio" [attr.aria-expanded]="previewOpen">
          <svg class="preview-phone-icon" width="34" height="42" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 80" fill="none">
  <defs>
    <linearGradient id="rim" x1="12" y1="2" x2="55" y2="77" gradientUnits="userSpaceOnUse"><stop stop-color="#ffc0cb"/><stop offset=".18" stop-color="#d94c69"/><stop offset=".52" stop-color="#760c29"/><stop offset=".77" stop-color="#f7607b"/><stop offset="1" stop-color="#840b28"/></linearGradient>
    <linearGradient id="glass" x1="19" y1="7" x2="47" y2="71" gradientUnits="userSpaceOnUse"><stop stop-color="#672237"/><stop offset=".45" stop-color="#280a18"/><stop offset="1" stop-color="#08070d"/></linearGradient>
    <linearGradient id="wave" x1="20" y1="15" x2="47" y2="66" gradientUnits="userSpaceOnUse"><stop stop-color="#fd8b9f"/><stop offset=".45" stop-color="#b32648"/><stop offset="1" stop-color="#380917"/></linearGradient>
    <linearGradient id="shine" x1="15" y1="4" x2="46" y2="65" gradientUnits="userSpaceOnUse"><stop stop-color="white" stop-opacity=".48"/><stop offset=".65" stop-color="white" stop-opacity="0"/></linearGradient>
  </defs>
  <ellipse cx="33" cy="75" rx="19" ry="3" fill="#17030a" fill-opacity=".3"/>
  <rect x="12" y="4" width="42" height="72" rx="10" fill="#44091b"/>
  <rect x="10" y="2" width="42" height="72" rx="10" fill="url(#rim)"/>
  <rect x="12" y="4" width="38" height="68" rx="8" fill="#160910" stroke="#ff8aa3" stroke-width=".7"/>
  <rect x="14" y="6" width="34" height="64" rx="6" fill="url(#glass)"/>
  <path d="M30 6c-15 20-8 33 18 40v18C23 53 12 35 14 19v-7a6 6 0 0 1 6-6z" fill="url(#wave)"/>
  <path d="M30 7c-14 20-8 32 18 39M14 33c7 17 17 24 34 31" stroke="#ffadba" stroke-opacity=".34" stroke-width=".8"/>
  <rect x="24" y="8" width="15" height="4" rx="2" fill="#100910"/>
  <circle cx="36" cy="10" r="1" fill="#282538"/>
  <path d="M20 4h20a9 9 0 0 1 9 9v28" stroke="url(#shine)" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M11 19v11m42-8v10" stroke="#d64a68" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M27 67h10" stroke="#e7bbc8" stroke-opacity=".5" stroke-width="1.3" stroke-linecap="round"/>
</svg>
        </button>
        <div class="publication-toolbar">
          <button type="button" class="publish-menu-btn" data-tour="publish-menu" [disabled]="publishDisabled"
            [attr.aria-busy]="isPublishing" (click)="publishRequested.emit()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/></svg>
            <span>{{ isPublishing ? 'Publicando...' : 'Publicar Cardápio' }}</span>
          </button>
        </div>
      </div>
    </header>
  `,
  styles: [`
    :host{display:block;flex-shrink:0;padding:22px 32px 18px}*{box-sizing:border-box}
    .topbar,.topbar-identity,.topbar-actions{display:flex;align-items:center;gap:12px;min-width:0}
    .topbar{justify-content:space-between}.topbar-actions{margin-left:auto;flex-shrink:0}
    button{font:inherit;cursor:pointer;touch-action:manipulation}button:focus-visible{outline:2px solid var(--panel-accent);outline-offset:4px}
    .hamburger-btn,.preview-toggle-btn{align-items:center;justify-content:center;width:48px;height:48px;padding:0;flex-shrink:0;border:1px solid var(--panel-border);border-radius:15px;background:var(--panel-surface);box-shadow:var(--panel-shadow-soft);color:var(--panel-text-muted);transition:transform 160ms ease}
    .hamburger-btn,.mobile-menu-logo,.preview-toggle-btn{display:none}.hamburger-btn:hover,.preview-toggle-btn:hover{transform:translateY(-1px)}
    .preview-toggle-btn .preview-phone-icon{display:block;object-fit:contain;filter:drop-shadow(0 3px 3px #690a1a30)}
    .user-pill{display:flex;align-items:center;gap:10px;padding:7px 12px 7px 8px;min-width:0;border:1px solid var(--panel-border);border-radius:14px;background:var(--panel-surface)}
    .user-avatar{display:flex;align-items:center;justify-content:center;width:32px;height:32px;flex-shrink:0;border-radius:10px;background:var(--panel-surface-muted);color:var(--panel-wine)}
    .topbar-logo-img{width:100%;height:100%;object-fit:cover;border-radius:10px}.user-name{font-size:13px;font-weight:600;color:var(--panel-text);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .status-dot{width:7px;height:7px;flex-shrink:0;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e55}.publication-toolbar{min-width:0}
    .publish-menu-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:12px 18px;border:1px solid #ffffff20;border-radius:16px;background:var(--panel-action);color:#fff;box-shadow:var(--panel-action-shadow);font:650 13px/1.3 Inter,system-ui,sans-serif;white-space:nowrap;transition:transform 160ms ease,box-shadow 160ms ease}
    .publish-menu-btn svg{flex-shrink:0}.publish-menu-btn:hover:not(:disabled){background:var(--panel-action-hover);transform:translateY(-1px)}.publish-menu-btn:active:not(:disabled){transform:translateY(1px)}.publish-menu-btn:disabled{opacity:.65;cursor:wait}
    @media(max-width:1100px){:host{padding:18px 20px 16px}.preview-toggle-btn{display:flex}}
    @media(max-width:1024px){:host{padding:14px}.hamburger-btn{display:flex}.user-name{max-width:160px}}
    @media(max-width:640px){
      :host{padding:12px 14px}.topbar{gap:10px;padding:12px;border:1px solid var(--panel-border);border-radius:24px;background:linear-gradient(145deg,var(--panel-surface-strong),var(--panel-surface));box-shadow:var(--panel-shadow-soft),inset 0 1px 1px #ffffff0d}
      .topbar-identity{flex-shrink:0}.topbar-actions{flex:1;gap:10px}.hamburger-btn{border-radius:50%;overflow:hidden}.hamburger-lines,.user-pill{display:none}
      .mobile-menu-logo{display:block;width:100%;height:100%;object-fit:cover;border-radius:50%}.preview-toggle-btn{border-radius:16px}.publication-toolbar{flex:1}.publish-menu-btn{width:100%;min-height:48px;padding:10px 12px;border-radius:17px;font-size:13px}
    }
    @media(max-width:360px){:host{padding:10px}.topbar{gap:8px;padding:10px;border-radius:21px}.topbar-actions{gap:8px}.hamburger-btn,.preview-toggle-btn{width:44px;height:48px}.hamburger-btn{height:44px}.publish-menu-btn{padding:10px 8px;gap:6px;font-size:12px}}
    @media(prefers-reduced-motion:reduce){button{transition:none!important}}
  `]
})
export class TopbarComponent {
  @Input() businessName = 'Seu Estabelecimento';
  @Input() logoUrl: string | null = null;
  @Input() sidebarOpen = false;
  @Input() previewOpen = false;
  @Input() publishDisabled = false;
  @Input() isPublishing = false;
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() togglePreview = new EventEmitter<void>();
  @Output() publishRequested = new EventEmitter<void>();
}