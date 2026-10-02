import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { AdminApiService } from './admin-api.service';

@Component({
  selector:'app-admin-login',standalone:true,imports:[CommonModule,FormsModule],
  template:`
    <main class="admin-login-page">
      <section class="admin-login-intro" aria-label="PingoChef Admin">
        <img src="/logo_principal_tema_light.webp" alt="PingoChef" />
        <span class="admin-login-kicker">CONTROLE DA PLATAFORMA</span>
        <h1>Uma visão clara do que importa.</h1>
        <p>Acompanhe clientes, publicação, uso e segurança em um só lugar.</p>
      </section>
      <section class="admin-login-form-wrap">
        <div class="admin-login-form admin-card">
          <span class="admin-eyebrow">Acesso administrativo</span>
          <h2>Entrar no Admin</h2>
          <p class="admin-muted">Use sua identidade administrativa. A sessão expira após 30 minutos sem atividade.</p>
          <form (ngSubmit)="submit()">
            <label for="admin-email">E-mail</label>
            <input id="admin-email" name="email" type="email" autocomplete="username"
              [(ngModel)]="email" required maxlength="254" />
            <label for="admin-password">Senha</label>
            <input id="admin-password" name="password" type="password" autocomplete="current-password"
              [(ngModel)]="password" required maxlength="128" />
            @if(error){<p class="admin-inline-error" role="alert">{{error}}</p>}
            <button class="admin-button admin-button-block" type="submit" [disabled]="loading">
              {{loading?'Verificando acesso…':'Entrar com segurança'}}
            </button>
          </form>
          <p class="admin-login-note">A autorização é verificada no servidor em cada solicitação.</p>
        </div>
      </section>
    </main>
  `
})
export class AdminLoginComponent {
  email='';password='';loading=false;error='';
  constructor(private api:AdminApiService,private router:Router){}
  submit(){
    if(this.loading||!this.email||!this.password)return;
    this.loading=true;this.error='';
    this.api.login(this.email.trim(),this.password).pipe(finalize(()=>this.loading=false))
      .subscribe({next:()=>{this.password='';this.router.navigateByUrl('/admin/overview');},
        error:(error:HttpErrorResponse)=>{
          this.password='';
          this.error=error.status===429?'Muitas tentativas. Aguarde alguns minutos.':
            error.error?.error?.code==='ADMIN_MFA_REQUIRED'
              ?'Esta conta exige MFA. O desafio precisa ser configurado antes do acesso.'
              :'Não foi possível entrar. Confira as credenciais e tente novamente.';
        }});
  }
}
