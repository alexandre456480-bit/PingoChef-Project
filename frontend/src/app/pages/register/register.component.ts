import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card-wave">
        <!-- Onda Decorativa Superior -->
        <div class="wave-top-wrapper">
          <svg viewBox="0 0 420 110" fill="none" xmlns="http://www.w3.org/2000/svg" class="wave-top-svg" preserveAspectRatio="none">
            <path d="M140 0C240 0 320 50 420 85V0H140Z" fill="url(#topWaveGradReg)" />
            <defs>
              <linearGradient id="topWaveGradReg" x1="140" y1="0" x2="420" y2="85" gradientUnits="userSpaceOnUse">
                <stop stop-color="#8B1A3A" />
                <stop offset="1" stop-color="#C2185B" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <!-- Cabeçalho (Logo Centralizada + Título) -->
        <header class="auth-header-section">
          <img src="/logo_img.webp" alt="Logo" class="auth-logo-center" />
          <h1 class="auth-page-title">Cadastre-se</h1>
          <p class="auth-page-subtitle">Crie sua conta em poucos segundos</p>
        </header>

        <!-- Corpo do Formulário -->
        <main class="auth-form-section">
          @if (errorMessage) {
            <div class="alert-capsule alert-capsule-error">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span>{{ errorMessage }}</span>
            </div>
          }

          <form (ngSubmit)="onRegister()">
            <!-- Nome Completo -->
            <div class="form-group">
              <label class="form-label" for="reg-name">Seu nome completo</label>
              <div class="form-input-wrapper">
                <input
                  type="text"
                  id="reg-name"
                  class="form-input-capsule"
                  [(ngModel)]="formData.fullName"
                  name="fullName"
                  placeholder="Ex: João da Silva"
                  required
                  autocomplete="name"
                />
                <span class="form-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
              </div>
            </div>

            <!-- Nome do Estabelecimento -->
            <div class="form-group">
              <label class="form-label" for="reg-business">Nome do estabelecimento</label>
              <div class="form-input-wrapper">
                <input
                  type="text"
                  id="reg-business"
                  class="form-input-capsule"
                  [(ngModel)]="formData.businessName"
                  name="businessName"
                  placeholder="Ex: Restaurante Gourmet"
                  (input)="generateSlug()"
                  required
                />
                <span class="form-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/><path d="M18 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/><path d="M14 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/><path d="M10 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/><path d="M6 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/></svg>
                </span>
              </div>
              @if (formData.slug) {
                <div class="slug-preview-capsule">
                  <span>🔗</span> seusite.com/c/<span>{{ formData.slug }}</span>
                </div>
              }
            </div>

            <!-- E-mail -->
            <div class="form-group">
              <label class="form-label" for="reg-email">E-mail de acesso</label>
              <div class="form-input-wrapper">
                <input
                  type="email"
                  id="reg-email"
                  class="form-input-capsule"
                  [(ngModel)]="formData.email"
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

            <!-- Senha + Confirmação -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="reg-password">Senha</label>
                <div class="form-input-wrapper">
                  <input
                    [type]="showPassword ? 'text' : 'password'"
                    id="reg-password"
                    class="form-input-capsule"
                    [(ngModel)]="formData.password"
                    name="password"
                    placeholder="Mín. 8 chars"
                    (input)="evaluatePasswordStrength()"
                    required
                    autocomplete="new-password"
                  />
                  <span class="form-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </span>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-confirm">Confirmar</label>
                <div class="form-input-wrapper">
                  <input
                    [type]="showPassword ? 'text' : 'password'"
                    id="reg-confirm"
                    class="form-input-capsule no-icon"
                    [(ngModel)]="confirmPassword"
                    name="confirmPassword"
                    placeholder="Repita a senha"
                    required
                    autocomplete="new-password"
                  />
                </div>
              </div>
            </div>

            <!-- Força da Senha -->
            @if (formData.password) {
              <div class="password-strength">
                <div class="strength-bar" [class.active]="passwordStrength >= 1" [ngClass]="passwordStrengthClass"></div>
                <div class="strength-bar" [class.active]="passwordStrength >= 2" [ngClass]="passwordStrengthClass"></div>
                <div class="strength-bar" [class.active]="passwordStrength >= 3" [ngClass]="passwordStrengthClass"></div>
                <div class="strength-bar" [class.active]="passwordStrength >= 4" [ngClass]="passwordStrengthClass"></div>
              </div>
              <div class="strength-label" [ngClass]="passwordStrengthClass">{{ passwordStrengthLabel }}</div>
            }

            <!-- Termos de Uso -->
            <div class="checkbox-group">
              <input type="checkbox" id="terms" class="checkbox-custom" [(ngModel)]="termsAccepted" name="terms" />
              <label for="terms" class="checkbox-label">
                Li e aceito os <a href="#" (click)="$event.preventDefault()">Termos de Uso</a>
                e a <a href="#" (click)="$event.preventDefault()">Política de Privacidade</a>
              </label>
            </div>

            <!-- Botão Principal -->
            <button
              type="submit"
              class="btn-wave-primary"
              [disabled]="isLoading || !termsAccepted || formData.password !== confirmPassword"
            >
              @if (isLoading) {
                <span class="btn-spinner"><span class="spinner"></span> Criando conta...</span>
              } @else {
                Cadastrar
              }
            </button>
          </form>

          <!-- Links de Rodapé -->
          <div class="auth-bottom-links">
            Já tem uma conta?
            <a routerLink="/login">Faça login</a>
          </div>
        </main>

        <!-- Onda Decorativa Inferior (Múltiplas Camadas Organicas) -->
        <div class="wave-bottom-wrapper">
          <svg viewBox="0 0 420 140" fill="none" xmlns="http://www.w3.org/2000/svg" class="wave-bottom-svg" preserveAspectRatio="none">
            <path d="M0 80C110 130 260 145 420 100V140H0V80Z" fill="#2D1B2E" />
            <path d="M0 45C130 115 280 20 420 90V140H0V45Z" fill="url(#bottomWaveGradReg)" />
            <defs>
              <linearGradient id="bottomWaveGradReg" x1="0" y1="45" x2="420" y2="140" gradientUnits="userSpaceOnUse">
                <stop stop-color="#8B1A3A" />
                <stop offset="0.6" stop-color="#C2185B" />
                <stop offset="1" stop-color="#D26E2D" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  `
})
export class RegisterComponent {
  formData = {
    fullName: '',
    businessName: '',
    slug: '',
    email: '',
    password: '',
    phone: ''
  };
  confirmPassword = '';
  showPassword = false;
  termsAccepted = false;
  isLoading = false;
  errorMessage = '';
  passwordStrength = 0;
  passwordStrengthClass = '';
  passwordStrengthLabel = '';

  constructor(private authService: AuthService, private router: Router) {}

  generateSlug(): void {
    if (this.formData.businessName) {
      this.formData.slug = this.formData.businessName
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    }
  }

  evaluatePasswordStrength(): void {
    const p = this.formData.password;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;

    this.passwordStrength = score;
    if (score <= 1) { this.passwordStrengthClass = 'weak'; this.passwordStrengthLabel = 'Fraca'; }
    else if (score <= 2) { this.passwordStrengthClass = 'medium'; this.passwordStrengthLabel = 'Média'; }
    else { this.passwordStrengthClass = 'strong'; this.passwordStrengthLabel = 'Forte'; }
  }

  onRegister(): void {
    this.errorMessage = '';

    if (this.formData.password !== this.confirmPassword) {
      this.errorMessage = 'As senhas não coincidem.';
      return;
    }

    if (this.formData.password.length < 8) {
      this.errorMessage = 'A senha deve ter pelo menos 8 caracteres.';
      return;
    }

    this.isLoading = true;

    this.authService.register(this.formData).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.router.navigate(['/activate'], {
            queryParams: { token: res.data.activationToken }
          });
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.error?.message || 'Falha ao criar conta. Tente novamente.';
      }
    });
  }
}
