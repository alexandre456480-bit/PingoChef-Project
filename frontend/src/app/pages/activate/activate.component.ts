import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-activate',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card-wave">
        <!-- Onda Decorativa Superior -->
        <div class="wave-top-wrapper">
          <svg viewBox="0 0 420 110" fill="none" xmlns="http://www.w3.org/2000/svg" class="wave-top-svg" preserveAspectRatio="none">
            <path d="M140 0C240 0 320 50 420 85V0H140Z" fill="url(#topWaveGradAct)" />
            <defs>
              <linearGradient id="topWaveGradAct" x1="140" y1="0" x2="420" y2="85" gradientUnits="userSpaceOnUse">
                <stop stop-color="#8B1A3A" />
                <stop offset="1" stop-color="#C2185B" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <!-- Cabeçalho (Logo Centralizada + Título) -->
        <header class="auth-header-section">
          <img src="/logo_img.webp" alt="Logo" class="auth-logo-center" />
          <h1 class="auth-page-title">Ativação</h1>
          <p class="auth-page-subtitle">Informe seu token exclusivo para liberar o painel</p>
        </header>

        <!-- Corpo do Formulário -->
        <main class="auth-form-section">
          @if (errorMessage) {
            <div class="alert-capsule alert-capsule-error">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span>{{ errorMessage }}</span>
            </div>
          }

          @if (successMessage) {
            <div class="alert-capsule alert-capsule-success">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span>{{ successMessage }}</span>
            </div>
          }

          <form (ngSubmit)="onActivate()">
            <div class="form-group">
              <label class="form-label" for="act-token">Token de ativação</label>
              <div class="form-input-wrapper">
                <input
                  type="text"
                  id="act-token"
                  class="form-input-capsule token-input"
                  [(ngModel)]="token"
                  name="token"
                  placeholder="ACT-XXXX-XXX"
                  required
                  autocomplete="off"
                  spellcheck="false"
                />
                <span class="form-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                </span>
              </div>
            </div>

            <button type="submit" class="btn-wave-primary" [disabled]="isLoading || !token">
              @if (isLoading) {
                <span class="btn-spinner"><span class="spinner"></span> Validando...</span>
              } @else {
                Ativar conta
              }
            </button>
          </form>

          <!-- Links de Rodapé -->
          <div class="auth-bottom-links">
            Já ativou sua conta?
            <a routerLink="/login">Faça login</a>
          </div>
        </main>

        <!-- Onda Decorativa Inferior (Múltiplas Camadas Organicas) -->
        <div class="wave-bottom-wrapper">
          <svg viewBox="0 0 420 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="wave-bottom-svg" preserveAspectRatio="none">
            <path d="M0 80C110 130 260 145 420 100V140H0V80Z" fill="#2D1B2E" />
            <path d="M0 45C130 115 280 20 420 90V140H0V45Z" fill="url(#bottomWaveGradAct)" />
            <defs>
              <linearGradient id="bottomWaveGradAct" x1="0" y1="45" x2="420" y2="140" gradientUnits="userSpaceOnUse">
                <stop stop-color="#8B1A3A" />
                <stop offset="0.6" stop-color="#C2185B" />
                <stop offset="1" stop-color="#D26E2D" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .token-input {
      text-transform: uppercase;
      letter-spacing: 3px;
      font-weight: 700;
      font-size: 1.05rem;
      text-align: center;
      font-family: 'Outfit', monospace;
    }
  `]
})
export class ActivateComponent implements OnInit {
  token = '';
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['token']) {
        this.token = params['token'];
      }
    });
  }

  onActivate(): void {
    if (!this.token) return;

    this.errorMessage = '';
    this.successMessage = '';
    this.isLoading = true;

    this.authService.activate({ token: this.token }).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.successMessage = 'Conta ativada com sucesso! Redirecionando para o login...';
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2500);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.error?.message || 'Verifique o código informado e tente novamente.';
      }
    });
  }
}
