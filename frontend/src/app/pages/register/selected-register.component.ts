import { finalize } from 'rxjs';
import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommercialService, PlanIntent } from '../../services/commercial.service';
@Component({
  selector: 'app-selected-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, RouterLink],
  styleUrl: '../plans/commercial.css',
  template: ` <div class="commercial-page">
    <nav class="commercial-nav">
      <a routerLink="/plans"><img src="/pingo_chef_logo_principal.webp" alt="PingoChef" /></a
      ><a routerLink="/login">Entrar</a>
    </nav>
    <div class="stepper" aria-label="Etapas do cadastro">
      <span>1. Plano</span><span class="current">2. Conta</span><span>3. E-mail</span
      ><span>4. Primeiros passos</span>
    </div>
    <main class="center-card">
      @if (loading) {
        <p role="status">Preparando seu cadastro…</p>
      }
      @if (error) {
        <p class="error" role="alert">{{ error }}</p>
      }
      @if (intent) {
        <span class="eyebrow">Plano {{ intent.plan.name }}</span>
        <h1>Seu cardápio começa aqui.</h1>
        <p>
          Crie sua conta no {{ intent.plan.name }}. Vamos confirmar seu e-mail antes de ativar o
          estabelecimento.
        </p>
        <a routerLink="/plans">Voltar e escolher outro plano</a>
        <form (ngSubmit)="submit()" #form="ngForm">
          <div class="field">
            <label for="signup-name">Seu nome</label
            ><input
              id="signup-name"
              name="fullName"
              [(ngModel)]="data.fullName"
              autocomplete="name"
              required
              minlength="2"
              maxlength="120"
            />
          </div>
          <div class="field">
            <label for="signup-business">Nome do estabelecimento</label
            ><input
              id="signup-business"
              name="businessName"
              [(ngModel)]="data.businessName"
              (ngModelChange)="slug()"
              autocomplete="organization"
              required
              minlength="2"
              maxlength="100"
            />
          </div>
          <div class="field">
            <label for="signup-slug">Endereço do cardápio</label
            ><input
              id="signup-slug"
              name="slug"
              [(ngModel)]="data.slug"
              pattern="[a-z0-9-]{3,50}"
              required
              maxlength="50"
            /><span class="fine"
              >Use letras minúsculas, números e hífens. Você poderá ajustar os dados no
              painel.</span
            >
          </div>
          <div class="field">
            <label for="signup-email">E-mail</label
            ><input
              id="signup-email"
              name="email"
              type="email"
              [(ngModel)]="data.email"
              autocomplete="email"
              required
              maxlength="254"
            />
          </div>
          <div class="field">
            <label for="signup-password">Senha</label
            ><input
              id="signup-password"
              name="password"
              [type]="showPassword ? 'text' : 'password'"
              [(ngModel)]="data.password"
              autocomplete="new-password"
              required
              minlength="8"
              maxlength="128"
            /><span class="fine"
              >Pelo menos 8 caracteres. Combine palavras, números e símbolos.</span
            >
          </div>
          <div class="field">
            <label for="signup-confirm">Confirmar senha</label
            ><input
              id="signup-confirm"
              name="confirmPassword"
              [type]="showPassword ? 'text' : 'password'"
              [(ngModel)]="confirmation"
              autocomplete="new-password"
              required
              maxlength="128"
            />
          </div>
          <label class="check-label"
            ><input type="checkbox" name="showPassword" [(ngModel)]="showPassword" />Mostrar
            senhas</label
          >
          <div class="field">
            <label class="check-label"
              ><input type="checkbox" name="terms" [(ngModel)]="terms" required /><span
                >Li e aceito os
                <a routerLink="/terms" target="_blank" rel="noopener">Termos de Uso</a> e as
                <a routerLink="/privacy" target="_blank" rel="noopener"
                  >Informações de Privacidade</a
                >
                desta versão preliminar.</span
              ></label
            >
          </div>
          <button
            class="button primary"
            type="submit"
            [disabled]="saving || form.invalid || !terms"
          >
            {{ saving ? 'Criando conta…' : 'Criar conta no ' + intent.plan.name }}
          </button>
        </form>
      }
      @if (!loading && !intent) {
        <a class="button primary" routerLink="/plans">Escolher meu plano</a>
      }
    </main>
  </div>`,
})
export class SelectedRegisterComponent implements OnInit {
  intent: PlanIntent | null = null;
  loading = true;
  saving = false;
  error = '';
  terms = false;
  showPassword = false;
  confirmation = '';
  data = { fullName: '', businessName: '', slug: '', email: '', password: '' };
  constructor(
    private commercial: CommercialService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}
  ngOnInit() {
    const id = this.route.snapshot.queryParamMap.get('intent');
    if (!id) {
      this.router.navigate(['/plans'], { replaceUrl: true });
      return;
    }
    this.commercial
      .intent(id)
      .pipe(finalize(() => this.cdr.markForCheck()))
      .subscribe({
        next: (r) => {
          this.intent = r.data;
          this.loading = false;
        },
        error: (e) => {
          this.loading = false;
          this.error =
            e.status === 410
              ? 'Esta escolha expirou. Selecione seu plano novamente.'
              : 'Não foi possível verificar seu plano. Confira sua conexão e tente novamente.';
        },
      });
  }
  slug() {
    this.data.slug = this.data.businessName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 50);
  }
  submit() {
    if (!this.intent || !this.terms || this.saving) return;
    this.error = '';
    if (this.data.password !== this.confirmation) {
      this.error = 'As senhas não coincidem.';
      return;
    }
    this.saving = true;
    this.auth
      .register({ ...this.data, intentId: this.intent.id, termsAccepted: true })
      .pipe(finalize(() => this.cdr.markForCheck()))
      .subscribe({
        next: () => {
          const email = this.data.email;
          this.data.password = '';
          this.confirmation = '';
          this.router.navigate(['/confirm-email'], {
            state: { email },
            queryParams: { confirmation: 'sent' },
          });
        },
        error: (e) => {
          this.saving = false;
          this.error =
            e.status === 410
              ? 'Esta escolha expirou. Volte aos planos e tente novamente.'
              : e.status === 429
                ? 'Aguarde alguns minutos antes de tentar novamente.'
                : 'Não foi possível criar sua conta. Verifique os dados e tente novamente.';
        },
      });
  }
}
