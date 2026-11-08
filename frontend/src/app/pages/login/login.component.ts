import { finalize } from 'rxjs';
import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthShellComponent } from './auth-shell.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  changeDetection:ChangeDetectionStrategy.Default,
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AuthShellComponent],
  templateUrl: './login.component.html',
  styleUrl: './access-form.css',
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
    if (route.snapshot.queryParamMap.get('registration') === 'received') {
      this.notice = 'Cadastro recebido. Entre com seu e-mail e senha para continuar.';
      this.email = router.getCurrentNavigation()?.extras.state?.['email'] || history.state?.email || '';
    }
    if (route.snapshot.queryParamMap.get('account') === 'unavailable') this.notice = 'Sua conta está indisponível. Entre em contato com o suporte.';
    if (route.snapshot.queryParamMap.get('account') === 'deletion-scheduled') this.notice = 'Exclusão agendada para daqui a 30 dias. Seu cardápio foi retirado do ar. Para ajuda, fale com pingochefcardapio@gmail.com.';
    if (route.snapshot.queryParamMap.get('password') === 'changed') this.notice = 'Senha atualizada e sessões encerradas. Entre com sua nova senha.';
    const session=route.snapshot.queryParamMap.get('session');
    if(session==='expired')this.notice='Sua sessão expirou. Entre novamente para continuar.';
    if(session==='all-ended')this.notice='Todas as sessões foram encerradas.';
  }
  ngOnInit(){this.authService.restore().pipe(finalize(()=>this.cdr.markForCheck())).subscribe({next:r=>{this.checking=false;if(r.data.provisioningRequired)this.router.navigate(['/complete-registration']);else if(r.data.accountActive)this.router.navigate(['/dashboard']);},error:e=>{this.checking=false;if(e.status!==401)this.errorMessage='Não foi possível verificar sua sessão. Confira sua conexão e tente entrar.';}});}
  onLogin(): void {
    if (!this.email || !this.password || this.isLoading) return;

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
        this.errorMessage = err.status===0?'Não foi possível conectar. Confira sua conexão e tente novamente.':err.status===429?'Aguarde alguns minutos antes de tentar novamente.':err.error?.error?.code==='PROVISIONING_UNAVAILABLE'?'Não foi possível concluir a configuração da conta. Tente novamente em instantes.':err.status>=500?'O serviço de login está temporariamente indisponível. Tente novamente em instantes.':'E-mail ou senha incorretos.';
      }
    });
  }
}
