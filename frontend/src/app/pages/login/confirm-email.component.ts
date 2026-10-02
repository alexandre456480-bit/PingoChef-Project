import { finalize } from 'rxjs';
import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
@Component({
  selector: 'app-confirm-email',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, RouterLink],
  styleUrl: '../plans/commercial.css',
  template: ` <div class="commercial-page">
    <nav class="commercial-nav">
      <a routerLink="/plans"><img src="/pingo_chef_logo_principal.webp" alt="PingoChef" /></a
      ><a routerLink="/login">Entrar</a>
    </nav>
    <main class="center-card">
      <span class="eyebrow">Confirmação de e-mail</span>
      <h1>{{ confirmed ? 'Seu e-mail foi confirmado.' : 'Confira sua caixa de entrada.' }}</h1>
      @if (confirmed) {
        <p>
          {{
            status === 'pending'
              ? 'Entre com sua senha para concluir os dados do cadastro e iniciar seu cardápio.'
              : 'Sua conta Free está pronta para os primeiros passos. Entre com sua senha para configurar empresa, logo, categorias, produtos e design.'
          }}
        </p>
        <a class="button primary" routerLink="/login" [queryParams]="{ confirmation: status }"
          >Entrar e continuar</a
        >
      } @else {
        @if (expired) {
          <p class="notice" role="status">
            Este link expirou ou já foi usado. Se você já confirmou o endereço, pode entrar. Caso
            contrário, solicite um novo e-mail.
          </p>
        } @else {
          <p>
            Enviamos as instruções de confirmação{{ maskedEmail ? ' para ' + maskedEmail : '' }}.
            Confira também a pasta de spam.
          </p>
        }
        <p class="fine">
          Por privacidade, a confirmação de envio não informa se já existe uma conta nesse endereço.
        </p>
        @if (error) {
          <p class="error" role="alert">{{ error }}</p>
        }
        @if (resent) {
          <p class="notice" role="status">
            Solicitação recebida. Se o endereço precisar de confirmação, você receberá novas
            instruções.
          </p>
        }
        <form (ngSubmit)="resend()" #form="ngForm">
          <div class="field">
            <label for="confirmation-email">E-mail do cadastro</label
            ><input
              id="confirmation-email"
              name="email"
              type="email"
              [(ngModel)]="email"
              autocomplete="email"
              required
              maxlength="254"
            />
          </div>
          <div class="actions">
            <button class="button primary" [disabled]="busy || form.invalid || cooldown > 0">
              {{
                busy
                  ? 'Solicitando…'
                  : cooldown > 0
                    ? 'Aguarde ' + cooldown + 's'
                    : 'Reenviar confirmação'
              }}</button
            ><a class="button" routerLink="/login">Já confirmei · entrar</a>
          </div>
        </form>
        <p class="fine">
          Digitou o e-mail errado? <a routerLink="/plans">Inicie um novo cadastro</a> com o endereço
          correto. O cadastro anterior não será alterado.
        </p>
      }
    </main>
  </div>`,
})
export class ConfirmEmailComponent {
  email = '';
  status = '';
  busy = false;
  resent = false;
  error = '';
  cooldown = 0;
  private timer?: ReturnType<typeof setInterval>;
  constructor(
    route: ActivatedRoute,
    router: Router,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {
    this.status = route.snapshot.queryParamMap.get('confirmation') || 'sent';
    this.email =
      router.getCurrentNavigation()?.extras.state?.['email'] || history.state?.email || '';
  }
  get confirmed() {
    return ['success', 'pending'].includes(this.status);
  }
  get expired() {
    return ['invalid', 'invalid_or_used', 'expired'].includes(this.status);
  }
  get maskedEmail() {
    const [local, domain] = this.email.split('@');
    return local && domain ? local.slice(0, 2) + '•••@' + domain : '';
  }
  resend() {
    if (this.busy || this.cooldown || !this.email) return;
    this.busy = true;
    this.error = '';
    this.auth
      .resendConfirmation(this.email)
      .pipe(finalize(() => this.cdr.markForCheck()))
      .subscribe({
        next: () => {
          this.busy = false;
          this.resent = true;
          this.cooldown = 60;
          this.timer = setInterval(() => {
            this.cooldown--;
            this.cdr.markForCheck();
            if (!this.cooldown) clearInterval(this.timer);
          }, 1000);
        },
        error: () => {
          this.busy = false;
          this.error = 'Não foi possível enviar agora. Confira sua conexão e tente novamente.';
        },
      });
  }
  ngOnDestroy() {
    clearInterval(this.timer);
  }
}
