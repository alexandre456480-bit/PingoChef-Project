import { finalize } from 'rxjs';
import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  changeDetection:ChangeDetectionStrategy.Default,
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    @if(checking){<div class="auth-page" role="status">Verificando sua sessão…</div>}
    @else {<div class="auth-page">
      <div class="auth-card-wave">
        <!-- Onda Decorativa Superior -->
        <div class="wave-top-wrapper">
          <svg viewBox="0 0 420 110" fill="none" xmlns="http://www.w3.org/2000/svg" class="wave-top-svg" preserveAspectRatio="none">
            <path d="M140 0C240 0 320 50 420 85V0H140Z" fill="url(#topWaveGrad)" />
            <defs>
              <linearGradient id="topWaveGrad" x1="140" y1="0" x2="420" y2="85" gradientUnits="userSpaceOnUse">
                <stop stop-color="#8B1A3A" />
                <stop offset="1" stop-color="#C2185B" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <!-- Cabeçalho (Logo Centralizada + Título) -->
        <header class="auth-header-section">
          <img src="/pingo_chef_logo_principal.webp" alt="Pingo Chef" class="auth-logo-center" />
          <h1 class="auth-page-title">Entrar</h1>
          <p class="auth-page-subtitle">Informe suas credenciais de acesso</p>
        </header>

        <!-- Corpo do Formulário -->
        <main class="auth-form-section">
          @if (errorMessage) {
            <div class="alert-capsule alert-capsule-error">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span>{{ errorMessage }}</span>
            </div>
          }

          @if (notice) { <p role="status">{{ notice }}</p> }
          <form (ngSubmit)="onLogin()">
            <!-- E-mail -->
            <div class="form-group">
              <label class="form-label" for="login-email">E-mail ou usuário</label>
              <div class="form-input-wrapper">
                <input
                  type="email"
                  id="login-email"
                  class="form-input-capsule"
                  [(ngModel)]="email"
                  name="email"
                  [placeholder]="'seu@email.com'"
                  required
                  autocomplete="email"
                />
                <span class="form-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </span>
              </div>
            </div>

            <!-- Senha -->
            <div class="form-group">
              <label class="form-label" for="login-password">Senha</label>
              <div class="form-input-wrapper">
                <input
                  [type]="showPassword ? 'text' : 'password'"
                  id="login-password"
                  class="form-input-capsule"
                  [(ngModel)]="password"
                  name="password"
                  placeholder="Sua senha de acesso"
                  required
                  autocomplete="current-password"
                />
                <span class="form-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <button
                  type="button"
                  class="password-toggle-capsule"
                  (click)="showPassword = !showPassword"
                  [attr.aria-label]="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
                >
                  @if (showPassword) {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                  } @else {
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            <!-- Botão Principal -->
            <button type="submit" class="btn-wave-primary" [disabled]="isLoading">
              @if (isLoading) {
                <span class="btn-spinner"><span class="spinner"></span> Entrando...</span>
              } @else {
                Entrar
              }
            </button>
          </form>
          <div class="auth-bottom-links"><a routerLink="/forgot-password">Esqueci minha senha</a></div>
          <div class="auth-bottom-links"><button type="button" (click)="resend()" [disabled]="isLoading || !email">Reenviar confirmação</button></div>

          <!-- Links de Rodapé -->
          <div class="auth-bottom-links">
            Não tem uma conta?
            <a routerLink="/plans">Escolha seu plano</a>
          </div>
        </main>

        <!-- Onda Decorativa Inferior (Múltiplas Camadas Organicas) -->
        <div class="wave-bottom-wrapper">
          <svg viewBox="0 0 420 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="wave-bottom-svg" preserveAspectRatio="none">
            <!-- Camada de Fundo Escura (Aubergine) -->
            <path d="M0 80C110 130 260 145 420 100V140H0V80Z" fill="#2D1B2E" />
            <!-- Camada Principal da Onda (Burgundy a Rose) -->
            <path d="M0 45C130 115 280 20 420 90V140H0V45Z" fill="url(#bottomWaveGrad)" />
            <defs>
              <linearGradient id="bottomWaveGrad" x1="0" y1="45" x2="420" y2="140" gradientUnits="userSpaceOnUse">
                <stop stop-color="#8B1A3A" />
                <stop offset="0.6" stop-color="#C2185B" />
                <stop offset="1" stop-color="#D26E2D" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>}
  `
})
export class LoginComponent implements OnInit {
  checking=true;
  email = '';
  password = '';
  showPassword = false;
  isLoading = false;
  errorMessage = '';
  notice = '';

  constructor(private authService: AuthService, private router: Router, route: ActivatedRoute,private cdr:ChangeDetectorRef) {
    const status = route.snapshot.queryParamMap.get('confirmation');
    this.notice = status === 'sent' ? 'Confira seu e-mail para confirmar o cadastro.'
      : status === 'success' ? 'E-mail confirmado. Entre para continuar.'
      : status === 'pending' ? 'E-mail confirmado. Entre para concluir os dados do cadastro.'
      : status === 'invalid_or_used' ? 'Este link expirou ou já foi usado. Tente entrar ou reenvie a confirmação.' : '';
    if (route.snapshot.queryParamMap.get('account') === 'unavailable') this.notice = 'Sua conta está indisponível. Entre em contato com o suporte.';
    if (route.snapshot.queryParamMap.get('account') === 'deletion-scheduled') this.notice = 'Exclusão agendada para daqui a 30 dias. Seu cardápio foi retirado do ar. Para ajuda, fale com pingochef@gmail.com.';
    if (route.snapshot.queryParamMap.get('password') === 'changed') this.notice = 'Senha atualizada e sessões encerradas. Entre com sua nova senha.';
    const session=route.snapshot.queryParamMap.get('session');
    if(session==='expired')this.notice='Sua sessão expirou. Entre novamente para continuar.';
    if(session==='all-ended')this.notice='Todas as sessões foram encerradas.';
  }
  ngOnInit(){this.authService.restore().pipe(finalize(()=>this.cdr.markForCheck())).subscribe({next:r=>{this.checking=false;if(r.data.provisioningRequired)this.router.navigate(['/complete-registration']);else if(r.data.accountActive)this.router.navigate(['/dashboard']);},error:e=>{this.checking=false;if(e.status!==401)this.errorMessage='Não foi possível verificar sua sessão. Confira sua conexão e tente entrar.';}});}
  resend(): void {
    if (!this.email || this.isLoading) return;
    this.isLoading = true;
    this.authService.resendConfirmation(this.email).pipe(finalize(()=>this.cdr.markForCheck())).subscribe({
      next: () => { this.isLoading = false; this.notice = 'Se necessário, enviaremos instruções para esse e-mail.'; },
      error: () => { this.isLoading = false; this.errorMessage = 'Não foi possível enviar agora. Tente novamente.'; }
    });
  }

  onLogin(): void {
    if (!this.email || !this.password) return;

    this.errorMessage = '';
    this.isLoading = true;

    this.authService.login({ email: this.email, password: this.password }).pipe(finalize(()=>this.cdr.markForCheck())).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          if (res.data.provisioningRequired) this.router.navigate(['/complete-registration']);
          else if (res.data.accountActive) this.router.navigate(['/dashboard']);
          else this.errorMessage = 'Esta conta está indisponível. Entre em contato com o suporte.';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.status===0?'Não foi possível conectar. Confira sua conexão e tente novamente.':err.status===429?'Aguarde alguns minutos antes de tentar novamente.':'Verifique e-mail, senha e a confirmação do endereço.';
      }
    });
  }
}
