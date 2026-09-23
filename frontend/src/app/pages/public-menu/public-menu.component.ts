import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { PublicMenuViewComponent } from '../../components/public-menu-view/public-menu-view.component';
import { PublicMenuService } from '../../services/public-menu.service';

@Component({
  selector: 'app-public-menu',
  standalone: true,
  imports: [CommonModule, PublicMenuViewComponent],
  template: `
    <div class="public-page-shell">
      @if (loading) {
        <div class="public-loading-screen">
          <div class="spinner-ring"></div>
          <p class="loading-label">Carregando cardápio...</p>
        </div>
      } @else if (error) {
        <div class="public-error-screen">
          <div class="error-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 class="error-title">Cardápio Indisponível</h2>
          <p class="error-desc">{{ error }}</p>
          <a href="/login" class="btn-home">Acessar Plataforma</a>
        </div>
      } @else {
        <!-- App Mobile Frame Container -->
        <main class="public-app-container">
          <app-public-menu-view [isPhonePreview]="false" [publicSlug]="slug"></app-public-menu-view>
        </main>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #09090B;
    }

    .public-page-shell {
      min-height: 100vh;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: stretch;
      background: #09090B;
      color: #F4F4F5;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    /* Container for public app */
    .public-app-container {
      width: 100%;
      max-width: 480px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: #111114;
      box-shadow: 0 0 60px rgba(0, 0, 0, 0.6);
      position: relative;
    }

    /* Loading Screen */
    .public-loading-screen {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      min-height: 100vh;
    }

    .spinner-ring {
      width: 44px;
      height: 44px;
      border: 3px solid rgba(244, 123, 32, 0.2);
      border-top-color: #F47B20;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-label {
      font-size: 0.9rem;
      color: #A1A1AA;
    }

    /* Error Screen */
    .public-error-screen {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 32px 20px;
      max-width: 380px;
      margin: auto;
      gap: 16px;
    }

    .error-icon {
      color: #EF4444;
      background: rgba(239, 68, 68, 0.1);
      width: 72px;
      height: 72px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .error-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.4rem;
      font-weight: 700;
      color: #FFF;
      margin: 0;
    }

    .error-desc {
      font-size: 0.88rem;
      color: #71717A;
      line-height: 1.4;
      margin: 0;
    }

    .btn-home {
      display: inline-block;
      margin-top: 8px;
      padding: 12px 24px;
      background: #F47B20;
      color: #FFF;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.88rem;
    }
  `]
})
export class PublicMenuComponent implements OnInit {
  slug: string = '';

  constructor(
    private route: ActivatedRoute,
    public publicMenuService: PublicMenuService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.slug = params.get('slug') || 'sapatolandia-gourmet';
      this.publicMenuService.loadPublicMenu(this.slug).subscribe();
    });
  }

  get loading() {
    return this.publicMenuService.loading();
  }

  get error() {
    return this.publicMenuService.error();
  }
}
