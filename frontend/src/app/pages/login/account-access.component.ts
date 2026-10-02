import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-account-access', standalone: true, imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page"><section class="auth-card-wave">
      <header class="auth-header-section"><img src="/pingo_chef_logo_principal.webp" alt="PingoChef" class="auth-logo-center" />
        <h1 class="auth-page-title">{{ title }}</h1></header>
      <main class="auth-form-section">
        @if (message) { <p role="status">{{ message }}</p> }
        @if (error) { <p role="alert">{{ error }}</p> }
        <form (ngSubmit)="submit()">
          @if (mode === 'forgot') {
            <div class="form-group"><label for="account-email" class="form-label">E-mail</label>
              <input id="account-email" class="form-input-capsule" type="email" name="email" autocomplete="email" [(ngModel)]="email" required /></div>
          } @else if (mode === 'reset') {
            <p>Defina a nova senha para {{ accountEmail }}.</p>
            <div class="form-group"><label for="account-password" class="form-label">Nova senha</label>
              <input id="account-password" class="form-input-capsule" type="password" name="password" autocomplete="new-password" [(ngModel)]="password" minlength="8" maxlength="128" required /></div>
            <div class="form-group"><label for="account-confirm" class="form-label">Confirmar senha</label>
              <input id="account-confirm" class="form-input-capsule" type="password" name="confirm" autocomplete="new-password" [(ngModel)]="confirmation" required /></div>
          } @else {
            <p>Confirme os dados para ativar seu estabelecimento no plano Free.</p>
            <div class="form-group"><label class="form-label" for="owner-name">Seu nome</label><input id="owner-name" class="form-input-capsule" name="fullName" [(ngModel)]="registration.fullName" minlength="2" maxlength="120" required /></div>
            <div class="form-group"><label class="form-label" for="business-name">Estabelecimento</label><input id="business-name" class="form-input-capsule" name="businessName" [(ngModel)]="registration.businessName" minlength="2" maxlength="120" required /></div>
            <div class="form-group"><label class="form-label" for="business-slug">Identificador do cardápio</label><input id="business-slug" class="form-input-capsule" name="slug" [(ngModel)]="registration.slug" pattern="[a-z0-9-]{3,50}" required /></div>
          }
          <button class="btn-wave-primary" type="submit" [disabled]="busy || !ready">{{ busy ? 'Aguarde...' : 'Continuar' }}</button>
        </form><div class="auth-bottom-links"><a routerLink="/login">Voltar para o login</a></div>
      </main></section></div>`
})
export class AccountAccessComponent implements OnInit {
  mode: 'forgot' | 'reset' | 'complete'; title: string; email = ''; password = ''; confirmation = '';
  registration = { fullName: '', businessName: '', slug: '' };
  message = ''; error = ''; busy = false; ready = false;
  accountEmail = '';
  constructor(private auth: AuthService, route: ActivatedRoute, private router: Router) {
    this.mode = route.snapshot.data['mode'];
    this.title = this.mode === 'forgot' ? 'Recuperar senha' : this.mode === 'reset' ? 'Definir nova senha' : 'Concluir cadastro';
  }
  ngOnInit(): void {
    if (this.mode === 'forgot') { this.ready = true; return; }
    const session = this.mode === 'reset' ? this.auth.recoverySession() : this.auth.restore();
    session.subscribe({ next: (response:any) => { this.accountEmail = response.data?.email || ''; this.ready = true; }, error: () => { this.error = 'A sessão expirou. Solicite um novo link ou entre novamente.'; } });
  }
  submit(): void {
    if (this.busy || !this.ready) return;
    if (this.mode === 'reset' && this.password !== this.confirmation) { this.error = 'As senhas não coincidem.'; return; }
    this.busy = true; this.error = '';
    const action = this.mode === 'forgot' ? this.auth.forgotPassword(this.email)
      : this.mode === 'reset' ? this.auth.resetPassword(this.password) : this.auth.completeRegistration(this.registration);
    action.subscribe({ next: () => {
      this.busy = false;
      if (this.mode === 'complete') this.router.navigate(['/dashboard']);
      else if (this.mode === 'reset') this.router.navigate(['/login']);
      else this.message = 'Se o endereço puder receber esta solicitação, enviaremos as instruções por e-mail.';
    }, error: (response: any) => { this.busy = false; this.error = response.error?.error?.message || 'Não foi possível concluir. Tente novamente.'; } });
  }
}
