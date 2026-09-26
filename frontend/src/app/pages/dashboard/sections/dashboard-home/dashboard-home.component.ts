import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../services/auth.service';
import { MenuService } from '../../../../services/menu.service';
import { ActiveSection } from '../../components/sidebar/sidebar.component';
import { buildPublicMenuUrl } from '../../../../constants/public-menu';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="home-container">
      <!-- Greeting -->
      <div class="greeting-card" style="--i:0">
        <div class="greeting-content">
          <h1 class="greeting-title">Olá, <span class="greeting-name">{{ businessName }}</span></h1>
          <p class="greeting-sub">Gerencie seu cardápio digital e acompanhe tudo por aqui.</p>
        </div>
        <div class="greeting-badge">
          <span class="badge-dot"></span>
          <span class="badge-text">Sessão ativa</span>
        </div>
      </div>

      <!-- Stats Cards - Bento Grid -->
      <div class="stats-grid">
        <div class="stat-card clay" style="--i:1">
          <div class="stat-icon-wrap orange">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ totalCategories }}</span>
            <span class="stat-label">Categorias</span>
          </div>
        </div>

        <div class="stat-card clay" style="--i:2">
          <div class="stat-icon-wrap green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ totalItems }}</span>
            <span class="stat-label">Produtos</span>
          </div>
        </div>

        <div class="stat-card clay" style="--i:3">
          <div class="stat-icon-wrap blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ menuStatus }}</span>
            <span class="stat-label">Status</span>
          </div>
        </div>

        <div class="stat-card clay link-card" style="--i:4">
          <div class="stat-icon-wrap purple">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </div>
          <div class="stat-info">
            <span class="stat-value link-val">{{ publicLink }}</span>
            <div class="link-actions">
              <a
                class="link-action"
                [class.disabled]="!hasPublicLink"
                [href]="hasPublicLink ? publicLink : null"
                target="_blank"
                rel="noopener noreferrer"
                [attr.aria-disabled]="!hasPublicLink">
                Abrir
              </a>
              <button type="button" class="link-action" [disabled]="!hasPublicLink" (click)="copyLink()">
                Copiar
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Checklist -->
      <div class="checklist-card clay-card" style="--i:5">
        <div class="card-header-row">
          <div>
            <h2 class="card-title">Primeiros Passos</h2>
            <p class="card-subtitle">Complete para publicar seu cardápio</p>
          </div>
          <div class="progress-ring">
            <span class="progress-text">{{ completedSteps }}/{{ checklistItems.length }}</span>
          </div>
        </div>

        <div class="checklist-items">
          @for (item of checklistItems; track item.label; let i = $index) {
            <div class="checklist-item" [class.done]="item.done" (click)="navigateTo.emit(item.route)" style="--ci: {{i}}">
              <div class="check-circle" [class.checked]="item.done">
                @if (item.done) {
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                } @else {
                  <span class="check-number">{{ i + 1 }}</span>
                }
              </div>
              <span class="checklist-label">{{ item.label }}</span>
              <svg class="checklist-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          }
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions" style="--i:6">
        <h2 class="section-label">Atalhos Rápidos</h2>
        <div class="actions-row">
          <button class="quick-btn" (click)="navigateTo.emit('empresa')">
            <div class="quick-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            </div>
            <span>Empresa</span>
          </button>
          <button class="quick-btn" (click)="navigateTo.emit('menu')">
            <div class="quick-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <span>Criar Item</span>
          </button>
          <button class="quick-btn" (click)="navigateTo.emit('design')">
            <div class="quick-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
            </div>
            <span>Design</span>
          </button>
          <button class="quick-btn" (click)="navigateTo.emit('preview')">
            <div class="quick-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <span>Preview</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .home-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* ── Greeting ── */
    .greeting-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px 28px;
      background: linear-gradient(135deg, rgba(244, 123, 32, 0.08) 0%, rgba(139, 26, 58, 0.06) 100%);
      border: 1px solid rgba(244, 123, 32, 0.12);
      border-radius: 20px;
      animation: cardIn 0.5s calc(var(--i, 0) * 80ms) cubic-bezier(0.4, 0, 0.2, 1) both;
    }

    .greeting-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.5rem;
      font-weight: 700;
      color: #FFFFFF;
      margin: 0;
    }
    .greeting-name {
      background: linear-gradient(135deg, #F47B20, #E06A10);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .greeting-sub {
      font-size: 0.88rem;
      color: #71717A;
      margin: 6px 0 0 0;
    }

    .greeting-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      padding: 6px 14px;
      border-radius: 20px;
      flex-shrink: 0;
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22C55E;
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
    }
    .badge-text {
      font-size: 0.78rem;
      font-weight: 600;
      color: #22C55E;
    }

    /* ── Stats Grid ── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px 20px;
      background: #1A1A1E;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 18px;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      animation: cardIn 0.5s calc(var(--i, 0) * 80ms) cubic-bezier(0.4, 0, 0.2, 1) both;
    }

    .stat-card.clay {
      box-shadow:
        6px 6px 14px rgba(0, 0, 0, 0.35),
        -3px -3px 10px rgba(255, 255, 255, 0.02),
        inset 1px 1px 2px rgba(255, 255, 255, 0.04);
    }

    .stat-card:hover {
      transform: translateY(-3px);
      border-color: rgba(255, 255, 255, 0.08);
    }

    .stat-card.link-card {
      gap: 12px;
    }
    .stat-card.link-card .stat-info { flex: 1; }
    .stat-card.link-card:hover {
      border-color: rgba(244, 123, 32, 0.25);
    }

    .stat-icon-wrap {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .stat-icon-wrap.orange {
      background: rgba(244, 123, 32, 0.12);
      color: #F47B20;
    }
    .stat-icon-wrap.green {
      background: rgba(34, 197, 94, 0.12);
      color: #22C55E;
    }
    .stat-icon-wrap.blue {
      background: rgba(59, 130, 246, 0.12);
      color: #3B82F6;
    }
    .stat-icon-wrap.purple {
      background: rgba(168, 85, 247, 0.12);
      color: #A855F7;
    }

    .stat-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .stat-value {
      font-family: 'Outfit', sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      color: #FFFFFF;
    }
    .stat-value.link-val {
      font-size: 0.82rem;
      font-weight: 600;
      color: #A855F7;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .stat-label {
      font-size: 0.76rem;
      color: #71717A;
      margin-top: 2px;
    }
    .link-actions {
      display: flex;
      gap: 8px;
      margin-top: 6px;
    }
    .link-action {
      border: 0;
      background: transparent;
      color: #F47B20;
      font: inherit;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 2px 0;
      cursor: pointer;
      text-decoration: none;
    }
    .link-action:hover:not(:disabled):not(.disabled) { color: #FF9A52; }
    .link-action:focus-visible { outline: 2px solid #F47B20; outline-offset: 3px; border-radius: 2px; }
    .link-action:disabled, .link-action.disabled { color: #71717A; cursor: not-allowed; }

    /* ── Checklist ── */
    .clay-card {
      background: #1A1A1E;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 20px;
      padding: 24px;
      box-shadow:
        6px 6px 14px rgba(0, 0, 0, 0.35),
        -3px -3px 10px rgba(255, 255, 255, 0.02),
        inset 1px 1px 2px rgba(255, 255, 255, 0.04);
      animation: cardIn 0.5s calc(var(--i, 0) * 80ms) cubic-bezier(0.4, 0, 0.2, 1) both;
    }

    .card-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .card-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.15rem;
      font-weight: 700;
      color: #FFFFFF;
      margin: 0;
    }
    .card-subtitle {
      font-size: 0.82rem;
      color: #71717A;
      margin: 4px 0 0 0;
    }

    .progress-ring {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(244, 123, 32, 0.1);
      border: 2px solid rgba(244, 123, 32, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .progress-text {
      font-family: 'Outfit', sans-serif;
      font-size: 0.82rem;
      font-weight: 700;
      color: #F47B20;
    }

    .checklist-items {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .checklist-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 16px;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      animation: checkIn 0.35s calc(var(--ci, 0) * 60ms + 300ms) cubic-bezier(0.4, 0, 0.2, 1) both;
    }
    .checklist-item:hover {
      background: rgba(255, 255, 255, 0.03);
    }
    .checklist-item.done {
      opacity: 0.55;
    }

    .check-circle {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      border: 2px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.25s;
    }
    .check-circle.checked {
      background: rgba(34, 197, 94, 0.15);
      border-color: #22C55E;
      color: #22C55E;
    }
    .check-number {
      font-size: 0.72rem;
      font-weight: 700;
      color: #52525B;
    }

    .checklist-label {
      flex: 1;
      font-size: 0.9rem;
      font-weight: 500;
      color: #D4D4D8;
    }

    .checklist-arrow {
      color: #3F3F46;
      transition: transform 0.2s;
    }
    .checklist-item:hover .checklist-arrow {
      transform: translateX(4px);
      color: #F47B20;
    }

    /* ── Quick Actions ── */
    .quick-actions {
      animation: cardIn 0.5s calc(var(--i, 0) * 80ms) cubic-bezier(0.4, 0, 0.2, 1) both;
    }
    .section-label {
      font-family: 'Outfit', sans-serif;
      font-size: 1rem;
      font-weight: 700;
      color: #A1A1AA;
      margin: 0 0 14px 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 0.75rem;
    }
    .actions-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .quick-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 20px 16px;
      background: #1A1A1E;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      cursor: pointer;
      color: #A1A1AA;
      font-family: 'Inter', sans-serif;
      font-size: 0.82rem;
      font-weight: 600;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow:
        4px 4px 10px rgba(0, 0, 0, 0.3),
        -2px -2px 8px rgba(255, 255, 255, 0.02);
    }
    .quick-btn:hover {
      transform: translateY(-3px);
      border-color: rgba(244, 123, 32, 0.2);
      color: #F47B20;
      box-shadow:
        6px 6px 16px rgba(0, 0, 0, 0.4),
        -3px -3px 10px rgba(255, 255, 255, 0.03);
    }
    .quick-icon {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.04);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .quick-btn:hover .quick-icon {
      background: rgba(244, 123, 32, 0.12);
    }

    /* ── Animations ── */
    @keyframes cardIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes checkIn {
      from { opacity: 0; transform: translateX(-12px); }
      to { opacity: 1; transform: translateX(0); }
    }

    /* ── Responsive ── */
    @media (max-width: 1024px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .actions-row {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 640px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
      .greeting-card {
        flex-direction: column;
        gap: 14px;
        align-items: flex-start;
      }
      .greeting-title {
        font-size: 1.2rem;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .stat-card, .clay-card, .greeting-card, .quick-actions, .checklist-item {
        animation: none !important;
      }
    }
  `]
})
export class DashboardHomeComponent implements OnInit {
  @Output() navigateTo = new EventEmitter<ActiveSection>();
  @Output() onToast = new EventEmitter<string>();

  businessName = 'Seu Estabelecimento';
  totalCategories = 0;
  totalItems = 0;
  menuStatus = 'Rascunho';
  publicLink = 'Não configurado';
  hasPublicLink = false;

  checklistItems: { label: string; route: ActiveSection; done: boolean }[] = [];

  constructor(
    private authService: AuthService,
    private menuService: MenuService
  ) {}

  ngOnInit(): void {
    const biz = this.authService.currentBusiness();
    this.businessName = biz?.name || 'Seu Estabelecimento';
    const slug = biz?.slug || '';

    this.totalCategories = this.menuService.categories().length;
    this.totalItems = this.menuService.items().length;
    this.hasPublicLink = !!slug;
    this.publicLink = slug ? buildPublicMenuUrl(slug) : 'Não configurado';
    this.menuStatus = this.totalItems > 0 ? 'Publicado' : 'Rascunho';

    this.checklistItems = [
      { label: 'Cadastrar dados da empresa', route: 'empresa', done: !!biz?.name },
      { label: 'Enviar logo do estabelecimento', route: 'empresa', done: !!biz?.logo_url },
      { label: 'Criar primeira categoria', route: 'menu', done: this.totalCategories > 0 },
      { label: 'Criar primeiro produto', route: 'menu', done: this.totalItems > 0 },
      { label: 'Personalizar design do cardápio', route: 'design', done: false },
      { label: 'Publicar cardápio online', route: 'preview', done: false }
    ];
  }

  get completedSteps(): number {
    return this.checklistItems.filter(i => i.done).length;
  }

  copyLink(): void {
    const biz = this.authService.currentBusiness();
    if (biz?.slug) {
      navigator.clipboard.writeText(buildPublicMenuUrl(biz.slug));
      this.onToast.emit('Link copiado para a área de transferência!');
    } else {
      this.onToast.emit('Configure o slug da empresa primeiro.');
    }
  }
}
