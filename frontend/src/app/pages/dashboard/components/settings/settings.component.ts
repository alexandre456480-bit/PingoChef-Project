import { finalize } from 'rxjs';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';
import { CommercialService } from '../../../../services/commercial.service';
import { PlanUsageComponent } from '../../../../components/plan-usage/plan-usage.component';
import { DialogFocusDirective } from '../../../../components/dialog-focus.directive';
@Component({
  selector: 'app-owner-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, PlanUsageComponent, DialogFocusDirective],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit {
  @Input() theme: 'light' | 'dark' = 'light';
  @Output() close = new EventEmitter<void>();
  section = 'profile';
  sections = [
    { id: 'profile', label: 'Conta' },
    { id: 'plan', label: 'Plano e uso' },
    { id: 'security', label: 'Segurança' },
    { id: 'support', label: 'Suporte' },
    { id: 'manage', label: 'Gerenciar conta' },
  ];
  busy = false;
  loading = true;
  error = '';
  notice = '';
  currentPassword = '';
  password = '';
  confirmation = '';
  deleteConfirmation = '';
  deletePassword = '';
  confirmDelete = false;
  constructor(
    public auth: AuthService,
    public commercial: CommercialService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}
  ngOnInit() {
    this.auth
      .restore()
      .pipe(finalize(() => this.cdr.markForCheck()))
      .subscribe({
        next: () => (this.loading = false),
        error: (e) => {
          this.loading = false;
          if (e.status === 401)
            this.router.navigate(['/login'], { queryParams: { session: 'expired' } });
          else this.error = 'Não foi possível atualizar sua conta. Tente novamente.';
        },
      });
  }
  select(id: string) {
    this.section = id;
    this.error = '';
    this.notice = '';
    this.currentPassword = '';
    this.password = '';
    this.confirmation = '';
    this.deletePassword = '';
    this.deleteConfirmation = '';
    this.confirmDelete = false;
  }
  compare() {
    this.close.emit();
    this.router.navigate(['/plans']);
  }
  logout(all = false) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.auth
      .logout(all)
      .pipe(finalize(() => this.cdr.markForCheck()))
      .subscribe({
        next: () =>
          this.router.navigate(['/login'], {
            queryParams: { session: all ? 'all-ended' : 'ended' },
          }),
        error: () => {
          this.busy = false;
          this.error = 'Não foi possível encerrar a sessão. Tente novamente.';
        },
      });
  }
  changePassword() {
    if (this.busy) return;
    this.error = '';
    if (this.password !== this.confirmation) {
      this.error = 'As senhas não coincidem.';
      return;
    }
    this.busy = true;
    this.auth
      .changePassword(this.currentPassword, this.password)
      .pipe(finalize(() => this.cdr.markForCheck()))
      .subscribe({
        next: () => {
          this.currentPassword = '';
          this.password = '';
          this.confirmation = '';
          this.router.navigate(['/login'], { queryParams: { password: 'changed' } });
        },
        error: (e) => {
          this.busy = false;
          this.error =
            e.error?.error?.code === 'CURRENT_PASSWORD_INVALID'
              ? 'A senha atual não confere.'
              : e.status === 429
                ? 'Aguarde antes de tentar novamente.'
                : 'Não foi possível alterar a senha. Confira a senha atual e tente novamente.';
        },
      });
  }
  deleteAccount() {
    if (this.busy || this.deleteConfirmation !== 'EXCLUIR' || !this.confirmDelete) return;
    this.busy = true;
    this.error = '';
    this.auth
      .deleteAccount(this.deletePassword, this.auth.currentBusiness()?.id, this.deleteConfirmation)
      .pipe(finalize(() => this.cdr.markForCheck()))
      .subscribe({
        next: () => {
          this.deletePassword = '';
          this.router.navigate(['/login'], { queryParams: { account: 'deletion-scheduled' } });
        },
        error: (e) => {
          this.busy = false;
          this.error =
            e.error?.error?.code === 'CURRENT_PASSWORD_INVALID'
              ? 'A senha atual não confere.'
              : 'Não foi possível agendar a exclusão. Tente novamente ou fale com o suporte.';
        },
      });
  }
}
