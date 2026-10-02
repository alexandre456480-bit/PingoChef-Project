import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, switchMap, catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminApiService, AdminBusinessRow } from './admin-api.service';
import { safeCsvCell } from './admin-csv';

@Component({selector:'app-admin-clients',standalone:true,imports:[CommonModule,FormsModule,RouterLink],template:`
  <section class="admin-page-heading"><div><span class="admin-eyebrow">Gestão de contas</span><h2>Clientes</h2><p>Busca, status e operação de cada estabelecimento.</p></div>
    <button class="admin-button admin-button-outline" type="button" (click)="exportCsv()" [disabled]="!rows().length">Exportar página em CSV</button></section>
  <div class="admin-card admin-table-card">
    <div class="admin-table-controls">
      <label class="admin-search-label">Buscar<input type="search" [(ngModel)]="search" (ngModelChange)="changed()" placeholder="Nome, email, slug ou UUID" autocomplete="off"/></label>
      <label>Status<select [(ngModel)]="status" (ngModelChange)="changed()"><option value="">Todos</option><option value="ACTIVE">Ativo</option><option value="SUSPENDED">Suspenso</option><option value="PENDING_DELETION">Exclusão pendente</option><option value="DELETED">Excluído</option></select></label>
      <label>Assinatura<select [(ngModel)]="subscription" (ngModelChange)="changed()"><option value="">Todas</option><option value="grace">Grace</option><option value="active">Ativa</option><option value="trialing">Trial</option><option value="past_due">Em atraso</option></select></label>
      <label>Publicado<select [(ngModel)]="published" (ngModelChange)="changed()"><option value="">Todos</option><option value="true">Sim</option><option value="false">Não</option></select></label>
      <label>Plano<input [(ngModel)]="plan" (ngModelChange)="changed()" placeholder="Código do plano" maxlength="50"/></label>
      <label>Criado de<input type="date" [(ngModel)]="createdFrom" (ngModelChange)="changed()"/></label>
      <label>Até<input type="date" [(ngModel)]="createdTo" (ngModelChange)="changed()"/></label>
    </div>
    @if(error()){<p role="alert" class="admin-inline-error">Não foi possível carregar os clientes. <button type="button" (click)="reload()">Tentar novamente</button></p>}
    @if(loading()){<div class="admin-skeleton admin-table-loading" role="status" aria-label="Carregando clientes"></div>}
    @else if(!rows().length){<div class="admin-state"><img src="/logo_img.webp" alt=""/><p>Nenhum cliente encontrado para esses filtros.</p></div>}
    @else{<div class="admin-table-scroll"><table><thead><tr><th scope="col">Estabelecimento</th><th scope="col">Email</th><th scope="col">Estado</th><th scope="col">Plano</th><th scope="col">Produtos</th><th scope="col">Mídias</th><th scope="col">Publicado</th><th scope="col">Criado em</th><th scope="col">Última atividade</th></tr></thead>
      <tbody>@for(row of rows();track row.id){<tr><th scope="row"><a [routerLink]="['/admin/clients',row.id]">{{row.name}}</a><small>{{row.slug}}</small></th><td>{{row.email||'—'}}</td><td><span class="admin-badge" [class.badge-alert]="row.lifecycleStatus!=='ACTIVE'">{{statusLabel(row.lifecycleStatus)}}</span></td><td>{{row.plan||'Sem plano'}}</td><td>{{row.products}}</td><td>{{row.images}} imagens · {{row.videos}} vídeos</td><td>{{row.published?'Sim':'Não'}}</td><td>{{row.createdAt|date:'dd/MM/yyyy'}}</td><td>{{row.lastActivity?(row.lastActivity|date:'dd/MM/yyyy HH:mm'):'Sem evento'}}</td></tr>}</tbody></table></div>}
    <div class="admin-pagination"><span>{{total()}} clientes · página {{page}}</span><div><button type="button" [disabled]="page<=1||loading()" (click)="go(page-1)">Anterior</button><button type="button" [disabled]="page*25>=total()||loading()" (click)="go(page+1)">Próxima</button></div></div>
  </div>
`})
export class AdminClientsComponent {
  private api=inject(AdminApiService);private destroy=inject(DestroyRef);
  private requests=new Subject<void>();
  readonly rows=signal<AdminBusinessRow[]>([]);readonly total=signal(0);
  readonly loading=signal(false);readonly error=signal(false);
  search='';status='';subscription='';published='';plan='';createdFrom='';createdTo='';page=1;
  constructor(){this.requests.pipe(debounceTime(250),switchMap(()=>{
    this.loading.set(true);this.error.set(false);
    const query={page:this.page,limit:25,search:this.search.trim().length>=2?this.search.trim():null,
      status:this.status||null,subscription:this.subscription||null,published:this.published||null,
      plan:/^[A-Z][A-Z0-9_]{1,49}$/.test(this.plan.trim())?this.plan.trim():null,
      createdFrom:this.createdFrom?new Date(this.createdFrom+'T00:00:00').toISOString():null,
      createdTo:this.createdTo?new Date(this.createdTo+'T00:00:00').toISOString():null};
    return this.api.businesses(query).pipe(catchError(()=>{this.error.set(true);return of(null);}));
  }),takeUntilDestroyed(this.destroy)).subscribe(result=>{
    this.loading.set(false);if(result){this.rows.set(result.data);this.total.set(result.pagination?.total||0);}
  });this.requests.next();}
  changed(){this.page=1;this.requests.next();}reload(){this.requests.next();}go(page:number){this.page=page;this.requests.next();}
  statusLabel(value:string){return ({ACTIVE:'Ativo',SUSPENDED:'Suspenso',PENDING_DELETION:'Exclusão pendente',DELETED:'Excluído'} as Record<string,string>)[value]||value;}
  exportCsv(){const headings=['ID','Estabelecimento','Email','Estado','Plano','Produtos','Imagens','Vídeos','Publicado','Criado em','Última atividade'];
    const lines=[headings,...this.rows().map(r=>[r.id,r.name,r.email,r.lifecycleStatus,r.plan,r.products,r.images,r.videos,r.published,r.createdAt,r.lastActivity])].map(row=>row.map(safeCsvCell).join(','));
    const url=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`pingochef-clientes-pagina-${this.page}.csv`;a.click();URL.revokeObjectURL(url);
  }
}
