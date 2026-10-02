import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, switchMap, catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminApiService, AdminInvitation } from './admin-api.service';

@Component({selector:'app-admin-invites',standalone:true,imports:[CommonModule,FormsModule],template:`
  <section class="admin-page-heading"><div><span class="admin-eyebrow">Acesso de clientes</span><h2>Convites</h2><p>Códigos individuais, vinculados ao email e com prazo de validade.</p></div></section>
  <div class="admin-detail-grid"><section class="admin-card admin-detail-card"><h3>Gerar convite</h3><form (ngSubmit)="create()"><label>Email do cliente<input type="email" required [(ngModel)]="email" name="email" autocomplete="email" maxlength="254"/></label><label>Validade em dias<input type="number" min="1" max="30" [(ngModel)]="expiresInDays" name="days"/></label><button class="admin-button" type="submit" [disabled]="creating">{{creating?'Gerando…':'Gerar código'}}</button></form>
    @if(createError){<p class="admin-inline-error" role="alert">{{createError}}</p>}</section>
    <section class="admin-card admin-detail-card"><h3>Entrega segura</h3><p>O código aparece somente após a criação. Copie e entregue ao email informado por um canal apropriado. O Admin não mostra o código novamente.</p>
      @if(freshCode){<div class="admin-code-once"><span>Código recém-gerado para {{freshEmail}}</span><code>{{freshCode}}</code><button type="button" class="admin-button admin-button-outline" (click)="copy()">Copiar código</button><button type="button" (click)="dismiss()">Ocultar</button></div>}
    </section></div>
  <section class="admin-card admin-table-card"><div class="admin-table-controls"><label>Buscar email<input type="search" [(ngModel)]="search" (ngModelChange)="changed()" placeholder="Mínimo 2 caracteres"/></label><label>Status<select [(ngModel)]="status" (ngModelChange)="changed()"><option value="">Todos</option><option value="ISSUED">Ativo</option><option value="CONSUMED">Usado</option><option value="EXPIRED">Expirado</option><option value="REVOKED">Revogado</option></select></label></div>
    @if(error()){<p class="admin-inline-error" role="alert">Não foi possível carregar os convites.</p>}
    @if(loading()){<div class="admin-skeleton admin-table-loading" role="status" aria-label="Carregando convites"></div>}
    @else if(!rows().length){<div class="admin-state"><img src="/logo_img.webp" alt=""/><p>Nenhum convite encontrado.</p></div>}
    @else{<div class="admin-table-scroll"><table><thead><tr><th>Email</th><th>Status</th><th>Criado em</th><th>Expira em</th><th>Usado em</th><th>Ação</th></tr></thead><tbody>@for(row of rows();track row.id){<tr><th scope="row">{{row.email}}</th><td><span class="admin-badge">{{label(row.effectiveStatus)}}</span></td><td>{{row.created_at|date:'dd/MM/yyyy HH:mm'}}</td><td>{{row.expires_at|date:'dd/MM/yyyy HH:mm'}}</td><td>{{row.consumed_at?(row.consumed_at|date:'dd/MM/yyyy HH:mm'):'—'}}</td><td>@if(row.effectiveStatus==='ISSUED'||row.effectiveStatus==='RESERVED'){<button type="button" class="admin-text-button" (click)="revoke(row)">Revogar</button>}</td></tr>}</tbody></table></div>}
    <div class="admin-pagination"><span>{{total()}} convites · página {{page}}</span><div><button type="button" [disabled]="page<=1" (click)="go(page-1)">Anterior</button><button type="button" [disabled]="page*25>=total()" (click)="go(page+1)">Próxima</button></div></div>
  </section>
`})
export class AdminInvitesComponent {
  private api=inject(AdminApiService);private destroy=inject(DestroyRef);private requests=new Subject<void>();
  readonly rows=signal<AdminInvitation[]>([]);readonly total=signal(0);readonly loading=signal(false);readonly error=signal(false);
  email='';expiresInDays=7;creating=false;createError='';freshCode='';freshEmail='';search='';status='';page=1;
  constructor(){this.requests.pipe(debounceTime(250),switchMap(()=>{
    this.loading.set(true);this.error.set(false);
    return this.api.invitations({page:this.page,limit:25,email:this.search.trim().length>=2?this.search.trim():null,status:this.status||null})
      .pipe(catchError(()=>{this.error.set(true);return of(null);}));
  }),takeUntilDestroyed(this.destroy)).subscribe(result=>{this.loading.set(false);if(result){this.rows.set(result.data);this.total.set(result.pagination?.total||0);}});this.requests.next();}
  changed(){this.page=1;this.requests.next();}go(page:number){this.page=page;this.requests.next();}
  label(value:string){return ({ISSUED:'Ativo',RESERVED:'Em uso',CONSUMED:'Usado',EXPIRED:'Expirado',REVOKED:'Revogado'} as Record<string,string>)[value]||value;}
  create(){if(this.creating||!this.email||this.expiresInDays<1||this.expiresInDays>30)return;
    this.creating=true;this.createError='';this.dismiss();
    this.api.createInvitation(this.email.trim(),this.expiresInDays).subscribe({next:result=>{
      this.creating=false;this.freshCode=result.code;this.freshEmail=result.email;this.email='';this.requests.next();
    },error:()=>{this.creating=false;this.createError='Não foi possível criar o convite. Confira email e validade.';}});
  }
  copy(){if(this.freshCode)navigator.clipboard.writeText(this.freshCode);}
  dismiss(){this.freshCode='';this.freshEmail='';}
  revoke(row:AdminInvitation){if(!window.confirm(`Revogar o convite de ${row.email}?`))return;
    this.api.revokeInvitation(row.id).subscribe({next:()=>this.requests.next(),error:()=>this.createError='Não foi possível revogar o convite.'});}
}
