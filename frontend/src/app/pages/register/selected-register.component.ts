import { finalize } from 'rxjs';
import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthShellComponent } from '../login/auth-shell.component';
import { AuthService } from '../../services/auth.service';
import { CommercialService, PlanIntent } from '../../services/commercial.service';
@Component({
  selector: 'app-selected-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, RouterLink, AuthShellComponent],
  styleUrl: '../login/access-form.css',
  templateUrl: './selected-register.component.html',
})
export class SelectedRegisterComponent implements OnInit {
  intent: PlanIntent | null = null;
  loading = true;
  saving = false;
  error = '';
  terms = false;
  showPassword = false;
  confirmation = '';
  invitationCode = '';
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
      .register({ ...this.data, invitationCode: this.invitationCode, intentId: this.intent.id, termsAccepted: true })
      .pipe(finalize(() => this.cdr.markForCheck()))
      .subscribe({
        next: (response) => {
          if (response.data?.status !== 'REGISTRATION_ACCEPTED') {
            this.saving = false;
            this.error = 'Não foi possível concluir o cadastro. Atualize a página e tente novamente.';
            return;
          }
          const email = this.data.email;
          this.data.password = '';
          this.confirmation = '';
          this.router.navigate(['/login'], { queryParams: { registration: 'received' }, state: { email } });
        },
        error: (e) => {
          this.saving = false;
          this.error =
            e.status === 410
              ? 'Esta escolha expirou. Volte aos planos e tente novamente.'
              : e.status === 429
                ? 'Aguarde alguns minutos antes de tentar novamente.'
                : e.status === 0 || e.status >= 500
                  ? 'O cadastro está temporariamente indisponível. Tente novamente em alguns minutos.'
                  : 'Não foi possível criar sua conta. Verifique os dados e tente novamente.';
        },
      });
  }
}
