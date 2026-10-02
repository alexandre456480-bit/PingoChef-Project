import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApiService } from './admin-api.service';

@Component({selector:'app-admin-client-detail',standalone:true,imports:[CommonModule,FormsModule,RouterLink],template:`
  <a routerLink="/admin/clients" class="admin-back-link">← Voltar aos clientes</a>
  @if(loading()){<div class="admin-skeleton admin-detail-loading" role="status" aria-label="Carregando cliente"></div>}
  @else if(error()){<div role="alert" class="admin-state admin-state-error">Não foi possível carregar o cliente. <button (click)="load()">Tentar novamente</button></div>}
  @else if(data()){
    <section class="admin-page-heading"><div><span class="admin-eyebrow">{{data().slug}}</span><h2>{{data().name}}</h2><p>{{data().email||'Email indisponível'}} · {{id}}</p></div><span class="admin-badge" [class.badge-alert]="data().accountState?.lifecycle_status!=='ACTIVE'">{{data().accountState?.lifecycle_status}}</span></section>
    <nav class="admin-tabs" aria-label="Detalhes do cliente">@for(item of tabs;track item[0]){<button type="button" [class.selected]="tab===item[0]" (click)="tab=item[0]">{{item[1]}}</button>}</nav>
    @switch(tab){
      @case('overview'){
        <div class="admin-detail-grid"><section class="admin-card admin-detail-card"><h3>Conta</h3><dl><dt>Criada em</dt><dd>{{data().created_at|date:'dd/MM/yyyy HH:mm'}}</dd><dt>Estado administrativo</dt><dd>{{data().accountState?.lifecycle_status}}</dd><dt>Publicação</dt><dd>{{data().accountState?.is_published?'Publicada':'Não publicada'}}</dd><dt>Última atividade</dt><dd>{{data().activity?.[0]?.occurred_at?(data().activity[0].occurred_at|date:'dd/MM/yyyy HH:mm'):'Sem evento registrado'}}</dd><dt>Exclusão agendada</dt><dd>{{data().accountState?.deletion_scheduled_at?(data().accountState.deletion_scheduled_at|date:'dd/MM/yyyy'):'Não'}}</dd></dl></section>
          <section class="admin-card admin-detail-card"><h3>Operação da conta</h3><p class="admin-muted">Ações de estado e acesso são auditadas no servidor.</p>
            <div class="admin-action-list">
              @if(data().accountState?.lifecycle_status==='ACTIVE'){<button type="button" (click)="openAction('suspend')">Suspender conta</button>}
              @if(data().accountState?.lifecycle_status==='SUSPENDED'){<button type="button" (click)="openAction('reactivate')">Reativar conta</button>}
              @if(['ACTIVE','SUSPENDED'].includes(data().accountState?.lifecycle_status)){<button type="button" (click)="openAction('schedule-deletion')">Agendar exclusão</button>}
              @if(data().accountState?.lifecycle_status==='PENDING_DELETION'){<button type="button" (click)="openAction('cancel-deletion')">Cancelar exclusão</button>}
              <button type="button" (click)="openAction('free-period')">Conceder dias gratuitos</button>
              <button type="button" (click)="openAction('revoke-sessions')">Revogar sessões do cliente</button>
            </div>
          </section></div>
      }
      @case('menu'){
        <div class="admin-detail-grid"><section class="admin-card admin-detail-card"><h3>Categorias <span>{{data().categories?.total}}</span></h3><ul class="admin-simple-list">@for(row of data().categories?.rows||[];track row.id){<li>{{row.name}}</li>}</ul><small>Exibindo as 20 mais recentes.</small></section>
        <section class="admin-card admin-detail-card"><h3>Produtos <span>{{data().products?.total}}</span></h3><ul class="admin-simple-list">@for(row of data().products?.rows||[];track row.id){<li><span>{{row.name}}</span><span>{{row.price|currency:'BRL'}}</span></li>}</ul><small>Exibindo os 20 mais recentes.</small></section></div>
      }
      @case('usage'){
        <div class="admin-metrics-grid"><article class="admin-card admin-kpi"><span>Produtos</span><strong>{{data().products?.total||0}}</strong></article><article class="admin-card admin-kpi"><span>Mídias</span><strong>{{data().media?.total||0}}</strong></article></div>
        <section class="admin-card admin-detail-card"><h3>Mídias recentes</h3><div class="admin-table-scroll"><table><thead><tr><th>Tipo</th><th>Estado</th><th>Enviada em</th></tr></thead><tbody>@for(row of data().media?.rows||[];track row.id){<tr><td>{{row.media_type}}</td><td>{{row.status}}</td><td>{{row.created_at|date:'dd/MM/yyyy HH:mm'}}</td></tr>}</tbody></table></div></section>
        <p class="admin-subtle-note">Armazenamento em bytes e custo por cliente ainda não são instrumentados.</p>
      }
      @case('subscription'){
        <section class="admin-card admin-detail-card"><h3>Assinatura</h3>@if(data().subscription){<dl><dt>Status</dt><dd>{{data().subscription.status}}</dd><dt>Período atual até</dt><dd>{{data().subscription.current_period_end?(data().subscription.current_period_end|date:'dd/MM/yyyy'):'—'}}</dd><dt>Grace até</dt><dd>{{data().subscription.grace_until?(data().subscription.grace_until|date:'dd/MM/yyyy'):'—'}}</dd></dl>}@else{<p>Não há assinatura cadastrada.</p>}</section>
        <section class="admin-card admin-detail-card"><h3>Ajustes recentes</h3><ul class="admin-simple-list">@for(row of data().recentAdjustments||[];track row.id){<li>{{row.value}} dias gratuitos · {{row.reason}} · {{row.created_at|date:'dd/MM/yyyy'}}</li>}@empty{<li>Nenhum ajuste.</li>}</ul></section>
      }
      @case('activity'){
        <section class="admin-card admin-detail-card"><h3>Eventos da conta</h3><ul class="admin-simple-list">@for(row of data().activity||[];track $index){<li>{{row.event_name}} <time>{{row.occurred_at|date:'dd/MM/yyyy HH:mm'}}</time></li>}@empty{<li>Sem eventos registrados.</li>}</ul></section>
        <section class="admin-card admin-detail-card"><h3>Histórico administrativo</h3><ul class="admin-simple-list">@for(row of data().audit||[];track $index){<li>{{row.action}} <time>{{row.created_at|date:'dd/MM/yyyy HH:mm'}}</time></li>}@empty{<li>Nenhuma ação administrativa.</li>}</ul></section>
      }
    }
  }
  @if(action){<div class="admin-dialog-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="action-title" class="admin-dialog admin-card"><h3 id="action-title">Confirmar {{actionLabel}}</h3><p>Cliente: <strong>{{data()?.name}}</strong></p>
    @if(['schedule-deletion','revoke-sessions'].includes(action)){<label>Digite o UUID do cliente para confirmar<input [(ngModel)]="confirmId" autocomplete="off"/></label>}
    @if(['suspend','free-period'].includes(action)){<label>Motivo<input [(ngModel)]="reason" maxlength="500" required/></label>}
    @if(action==='free-period'){<label>Dias gratuitos<input type="number" min="1" max="365" [(ngModel)]="days"/></label>}
    @if(action==='schedule-deletion'){<label>Retenção em dias<input type="number" min="1" max="365" [(ngModel)]="retentionDays"/></label>}
    @if(['schedule-deletion','cancel-deletion','free-period','revoke-sessions'].includes(action)){<label>Senha administrativa para confirmação recente<input type="password" autocomplete="current-password" [(ngModel)]="password"/></label>}
    @if(actionError){<p role="alert" class="admin-inline-error">{{actionError}}</p>}
    <div class="admin-dialog-actions"><button type="button" class="admin-button admin-button-outline" (click)="action=null">Cancelar</button><button type="button" class="admin-button admin-button-danger" [disabled]="working" (click)="confirmAction()">{{working?'Aplicando…':'Confirmar ação'}}</button></div>
  </section></div>}
`})
export class AdminClientDetailComponent implements OnChanges {
  @Input({required:true}) id='';private api=inject(AdminApiService);
  readonly data=signal<any>(null);readonly loading=signal(false);readonly error=signal(false);
  readonly tabs=[['overview','Visão geral'],['menu','Cardápio'],['usage','Uso'],['subscription','Assinatura'],['activity','Atividade']];
  tab='overview';action:string|null=null;reason='';confirmId='';days=7;retentionDays=30;password='';working=false;actionError='';
  get actionLabel(){return ({suspend:'suspensão',reactivate:'reativação','schedule-deletion':'exclusão agendada','cancel-deletion':'cancelamento da exclusão','free-period':'dias gratuitos','revoke-sessions':'revogação de sessões'} as Record<string,string>)[this.action||'']||'';}
  ngOnChanges(){this.load();}
  load(){if(!this.id)return;this.loading.set(true);this.error.set(false);this.api.business(this.id).subscribe({next:data=>{this.data.set(data);this.loading.set(false);},error:()=>{this.error.set(true);this.loading.set(false);}});}
  openAction(value:string){this.action=value;this.reason='';this.confirmId='';this.password='';this.actionError='';}
  confirmAction(){if(!this.action||this.working)return;
    const action=this.action;
    if(['schedule-deletion','revoke-sessions'].includes(action)&&this.confirmId!==this.id){this.actionError='O UUID de confirmação não corresponde.';return;}
    if(['suspend','free-period'].includes(action)&&this.reason.trim().length<3){this.actionError='Informe um motivo com pelo menos 3 caracteres.';return;}
    if(action==='free-period'&&(this.days<1||this.days>365)){this.actionError='Escolha de 1 a 365 dias.';return;}
    if(action==='schedule-deletion'&&(this.retentionDays<1||this.retentionDays>365)){this.actionError='Escolha retenção de 1 a 365 dias.';return;}
    const sensitive=['schedule-deletion','cancel-deletion','free-period','revoke-sessions'].includes(action);
    if(sensitive&&!this.password){this.actionError='Digite sua senha administrativa.';return;}
    const body:Record<string,unknown>=action==='suspend'?{reason:this.reason.trim()}
      :action==='schedule-deletion'?{confirmBusinessId:this.id,retentionDays:this.retentionDays}
      :action==='free-period'?{days:this.days,reason:this.reason.trim()}
      :action==='revoke-sessions'?{confirmBusinessId:this.id}:{};
    this.working=true;this.actionError='';
    const run=()=>this.api.action(this.id,action,body).subscribe({next:()=>{this.working=false;this.action=null;this.password='';this.load();},error:err=>{this.working=false;this.actionError=err.status===409?'O estado da conta mudou. Atualize os dados e tente novamente.':'A operação falhou. Confira a confirmação e tente novamente.';}});
    if(sensitive)this.api.reauthenticate(this.password).subscribe({next:run,error:()=>{this.working=false;this.actionError='Não foi possível confirmar sua senha administrativa.';}});
    else run();
  }
}
