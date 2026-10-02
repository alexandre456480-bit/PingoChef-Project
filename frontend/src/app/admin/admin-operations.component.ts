import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApiService, AdminCommercialReport, AdminDashboard, AdminFilter, AdminInfrastructureReport } from './admin-api.service';
import { periodLabel } from './admin-filter';
import { AdminMetricTooltipDirective } from './admin-metric-tooltip.directive';

@Component({selector:'app-admin-operations',standalone:true,imports:[CommonModule,FormsModule,RouterLink,AdminMetricTooltipDirective],template:`
  @if(section==='subscriptions'){
    <section class="admin-page-heading"><div><span class="admin-eyebrow">Negócio</span><h2>Assinaturas</h2><p>Estados comerciais e evolução no período {{period}}.</p></div></section>
    @if(data&&!loading){<div class="admin-metrics-grid"><article class="admin-card admin-kpi" title="Assinaturas com status active. Fonte: subscriptions."><span>Ativas</span><strong>{{n('subscriptionsActive')}}</strong><small>assinaturas · atual</small></article><article class="admin-card admin-kpi" title="Assinaturas com status grace. Fonte: subscriptions."><span>Em grace</span><strong>{{n('subscriptionsGrace')}}</strong><small>assinaturas · atual</small></article><article class="admin-card admin-kpi" title="Assinaturas com status past_due. Fonte: subscriptions."><span>Em atraso</span><strong>{{n('subscriptionsPastDue')}}</strong><small>assinaturas · atual</small></article><article class="admin-card admin-kpi" title="Assinaturas com status canceled. Fonte: subscriptions."><span>Canceladas</span><strong>{{n('subscriptionsCanceled')}}</strong><small>assinaturas · atual</small></article></div>}
    @if(commercial()){<div class="admin-metrics-grid"><article class="admin-card admin-kpi" title="Assinaturas criadas no período. Fonte: subscriptions.created_at."><span>Novas assinaturas</span><strong>{{commercial()!.newSubscriptions}}</strong><small>{{period}}</small></article><article class="admin-card admin-kpi" title="Assinaturas com evento de mudança para canceled no período. Fonte: subscription_events."><span>Cancelamentos</span><strong>{{commercial()!.cancellations}}</strong><small>{{period}}</small></article><article class="admin-card admin-kpi"><span>Grace configurado</span><strong>{{commercial()!.graceDays}} dias</strong><small>política atual</small></article></div>
      <section class="admin-card admin-detail-card"><h3>Assinaturas por plano</h3><ul class="admin-simple-list">@for(row of commercial()!.planDistribution;track row.plan){<li><span>{{row.plan}}</span><strong>{{row.count}}</strong></li>}@empty{<li>Nenhuma assinatura cadastrada.</li>}</ul></section>}
    <section class="admin-card admin-detail-card"><h3>Painel financeiro preparado</h3><p>Valores indisponíveis até existir provedor de cobrança e ledger financeiro confiável.</p><dl><dt>MRR</dt><dd>Receita recorrente mensal contratada ativa; indisponível.</dd><dt>Receita reconhecida</dt><dd>Valor apropriado ao período de prestação; indisponível.</dd><dt>Pagamento aprovado</dt><dd>Valor capturado pelo provedor no período; indisponível.</dd><dt>Churn</dt><dd>Cancelamentos divididos pela base inicial do período; indisponível.</dd><dt>ARPU</dt><dd>Receita recorrente dividida por contas pagantes; indisponível.</dd><dt>Inadimplência</dt><dd>Valor vencido e não pago; indisponível.</dd><dt>Receita por plano</dt><dd>Receita reconhecida agrupada por plano; indisponível.</dd></dl></section>
    <div class="admin-subtle-note">Cartão e Pix estão previstos na interface de provedor. Nenhum gateway ou preço foi definido.</div>
  }
  @if(section==='usage'){
    <section class="admin-page-heading"><div><span class="admin-eyebrow">Infraestrutura</span><h2>Uso e custos</h2><p>Volumes registrados em {{period}}. Custo em moeda ainda não é medido.</p></div></section>
    @if(data&&!loading){<div class="admin-metrics-grid"><article class="admin-card admin-kpi" title="Produtos cadastrados no período. Fonte: menu_items."><span>Produtos criados</span><strong>{{p('productsCreated')}}</strong><small>produtos · período</small></article><article class="admin-card admin-kpi" title="Imagens prontas criadas no período. Fonte: product_media."><span>Imagens adicionadas</span><strong>{{p('imagesAdded')}}</strong><small>mídias · período</small></article><article class="admin-card admin-kpi" title="Vídeos prontos criados no período. Fonte: product_media."><span>Vídeos adicionados</span><strong>{{p('videosAdded')}}</strong><small>mídias · período</small></article><article class="admin-card admin-kpi" title="Webhooks Mux em estado failed atualizados no período. Fonte: mux_webhook_events."><span>Webhooks com falha</span><strong>{{a('failedWebhooks')}}</strong><small>eventos · período</small></article></div>}
    <div class="admin-subtle-note">Bytes de storage, reprodução Mux e custos de provedores precisam de medição própria antes de aparecerem aqui.</div>
    @if(infrastructure()){<div class="admin-metrics-grid"><article class="admin-card admin-kpi"><span>Requisições API</span><strong>{{infrastructure()!.api.requests}}</strong><small>telemetria persistida · {{period}}</small></article><article class="admin-card admin-kpi"><span>Erros 5xx</span><strong>{{infrastructure()!.api.errors5xx}}</strong><small>requisições · período</small></article><article class="admin-card admin-kpi"><span>Rate limits</span><strong>{{infrastructure()!.api.rateLimits}}</strong><small>respostas 429 · período</small></article><article class="admin-card admin-kpi"><span>Latência média</span><strong>{{infrastructure()!.api.averageLatencyMs??'—'}}</strong><small>ms · requisições medidas</small></article></div>
      <section class="admin-card admin-detail-card"><h3>Mux e banco</h3><dl><dt>Uploads reservados</dt><dd>{{infrastructure()!.mux.uploads}}</dd><dt>Bytes declarados nos uploads</dt><dd>{{infrastructure()!.mux.declaredUploadBytes|number}} bytes · estimativa de entrada</dd><dt>Vídeos processing</dt><dd>{{infrastructure()!.mux.status['processing']||0}}</dd><dt>Vídeos ready</dt><dd>{{infrastructure()!.mux.status['ready']||0}}</dd><dt>Vídeos errored</dt><dd>{{infrastructure()!.mux.status['errored']||0}}</dd><dt>Vídeos rejected</dt><dd>{{infrastructure()!.mux.status['rejected']||0}}</dd><dt>Linhas de mídia no banco</dt><dd>{{infrastructure()!.database.media}}</dd><dt>Bytes Mux / Storage / banco</dt><dd>Não medidos</dd></dl></section>
      <section class="admin-card admin-detail-card"><h3>Uploads por cliente</h3><ul class="admin-simple-list">@for(row of infrastructure()!.byBusiness;track row.businessId){<li><a [routerLink]="['/admin/clients',row.businessId]">{{row.businessId}}</a><strong>{{row.uploads}}</strong></li>}@empty{<li>Sem uploads no período.</li>}</ul></section>
      <section class="admin-card admin-detail-card"><h3>Imagens Storage por cliente</h3><p>Contagem de registros rastreados; bytes reais não medidos.</p><ul class="admin-simple-list">@for(row of infrastructure()!.byBusinessStorage;track row.businessId){<li><a [routerLink]="['/admin/clients',row.businessId]">{{row.businessId}}</a><strong>{{row.trackedImages}} · +{{row.newTrackedImages}} no período</strong></li>}@empty{<li>Sem imagens Storage rastreadas.</li>}</ul></section>
      <section class="admin-card admin-detail-card"><h3>Anomalias para revisão</h3><p>Limites fixos operacionais. Nenhuma conta é bloqueada automaticamente.</p><ul class="admin-simple-list">@for(row of infrastructure()!.alerts;track $index){<li><span>{{alertLabel(row.code)}} @if(row.businessId){· {{row.businessId}}}</span><strong>{{row.count}} / {{row.threshold}}</strong></li>}@empty{<li>Nenhuma anomalia detectada nas fontes medidas.</li>}</ul></section>}
  }
  @if(section==='videos'||section==='storage'){
    <section class="admin-page-heading"><div><span class="admin-eyebrow">Infraestrutura</span><h2>{{section==='videos'?'Vídeos':'Storage'}}</h2><p>Inventário de mídias {{section==='videos'?'de vídeo':'de imagem'}}.</p></div></section>
    @if(data&&!loading){<div class="admin-metrics-grid"><article class="admin-card admin-kpi" [title]="section==='videos'?'Vídeos ready em product_media.':'Imagens ready em product_media mais imagens legadas em menu_items.'"><span>{{section==='videos'?'Vídeos prontos':'Imagens vinculadas'}}</span><strong>{{n(section==='videos'?'videos':'images')}}</strong><small>inventário atual</small></article><article class="admin-card admin-kpi"><span>Adicionadas no período</span><strong>{{p(section==='videos'?'videosAdded':'imagesAdded')}}</strong><small>{{period}}</small></article><article class="admin-card admin-kpi" title="Mídias rejeitadas, qualquer tipo, atualizadas no período."><span>Uploads rejeitados</span><strong>{{a('rejectedUploads')}}</strong><small>todas as mídias · período</small></article></div>}
    <section class="admin-card admin-table-card"><div class="admin-table-controls"><label>Estado<select [(ngModel)]="mediaStatus" (ngModelChange)="load()"><option value="">Todos</option><option value="ready">Pronto</option><option value="processing">Processando</option><option value="rejected">Rejeitado</option><option value="errored">Erro</option></select></label></div>
      @if(listError()){<p role="alert" class="admin-inline-error">Não foi possível carregar o inventário.</p>}
      @if(listLoading()){<div class="admin-skeleton admin-table-loading" role="status" aria-label="Carregando mídias"></div>}
      @else{<div class="admin-table-scroll"><table><thead><tr><th>Estabelecimento</th><th>Estado</th><th>Publicado</th><th>Criado em</th></tr></thead><tbody>@for(row of rows();track row.id){<tr><th scope="row"><a [routerLink]="['/admin/clients',row.business_id]">{{row.businessName||row.business_id}}</a></th><td>{{row.status}}</td><td>{{row.is_published?'Sim':'Não'}}</td><td>{{row.created_at|date:'dd/MM/yyyy HH:mm'}}</td></tr>}@empty{<tr><td colspan="4">Nenhuma mídia encontrada.</td></tr>}</tbody></table></div>}
      <div class="admin-pagination"><span>{{total()}} mídias · página {{page}}</span><div><button type="button" [disabled]="page<=1" (click)="go(page-1)">Anterior</button><button type="button" [disabled]="page*25>=total()" (click)="go(page+1)">Próxima</button></div></div>
    </section><div class="admin-subtle-note">Storage em bytes e uso de playback ainda não possuem fonte de medição confiável.</div>
  }
  @if(section==='security'){
    <section class="admin-page-heading"><div><span class="admin-eyebrow">Sistema</span><h2>Segurança</h2><p>Controles e eventos relevantes da operação.</p></div></section>
    <div class="admin-detail-grid"><section class="admin-card admin-detail-card"><h3>Sessão administrativa</h3><ul class="admin-simple-list"><li>Cookie HttpOnly e SameSite</li><li>Validação de origem e CSRF em alterações</li><li>Timeout e reautenticação para operações sensíveis</li><li>Autorização conferida no servidor</li></ul></section><section class="admin-card admin-detail-card"><h3>Ocorrências</h3><p>Para eventos de acesso e mudanças administrativas, consulte <a routerLink="/admin/audit">Auditoria</a>.</p><p>Para revogar sessões de um cliente, abra o detalhe em <a routerLink="/admin/clients">Clientes</a>.</p></section></div>
    <section class="admin-card admin-table-card"><h3>Exclusões definitivas</h3><p class="admin-muted">A rotina interna apaga recursos externos antes dos dados. Falhas mantêm o trabalho para nova tentativa.</p><div class="admin-table-scroll"><table><thead><tr><th>Conta</th><th>Etapa</th><th>Tentativas</th><th>Último código</th><th>Início</th></tr></thead><tbody>@for(job of purgeJobs();track job.id){<tr><th scope="row">{{job.business_id}}</th><td>{{job.phase}}</td><td>{{job.attempts}}</td><td>{{job.last_error_code||'—'}}</td><td>{{job.started_at|date:'dd/MM/yyyy HH:mm'}}</td></tr>}@empty{<tr><td colspan="5">Nenhuma exclusão iniciada.</td></tr>}</tbody></table></div></section>
  }
  @if(section==='audit'){
    <section class="admin-page-heading"><div><span class="admin-eyebrow">Sistema</span><h2>Auditoria</h2><p>Operações administrativas registradas no servidor.</p></div></section>
    <section class="admin-card admin-table-card"><div class="admin-table-controls"><label>Ação<input [(ngModel)]="auditAction" (ngModelChange)="load()" placeholder="Ex.: SESSIONS_REVOKED"/></label><label>UUID alvo<input [(ngModel)]="auditTarget" (ngModelChange)="load()"/></label><label>De<input type="date" [(ngModel)]="auditFrom" (ngModelChange)="load()"/></label><label>Até<input type="date" [(ngModel)]="auditTo" (ngModelChange)="load()"/></label></div>
      @if(listError()){<p role="alert" class="admin-inline-error">Não foi possível carregar a auditoria.</p>}
      @if(listLoading()){<div class="admin-skeleton admin-table-loading" role="status" aria-label="Carregando auditoria"></div>}
      @else{<div class="admin-table-scroll"><table><thead><tr><th>Data</th><th>Ação</th><th>Alvo</th><th>Administrador</th></tr></thead><tbody>@for(row of rows();track row.id){<tr><td>{{row.created_at|date:'dd/MM/yyyy HH:mm'}}</td><th scope="row">{{row.action}}</th><td>{{row.target_type}} · {{row.target_id}}</td><td>{{row.actor_user_id}}</td></tr>}@empty{<tr><td colspan="4">Nenhum registro encontrado.</td></tr>}</tbody></table></div>}
      <div class="admin-pagination"><span>{{total()}} registros · página {{page}}</span><div><button type="button" [disabled]="page<=1" (click)="go(page-1)">Anterior</button><button type="button" [disabled]="page*25>=total()" (click)="go(page+1)">Próxima</button></div></div>
    </section>
  }
  @if(section==='settings'){
    <section class="admin-page-heading"><div><span class="admin-eyebrow">Sistema</span><h2>Configurações</h2><p>Estado operacional desta fase.</p></div></section>
    <section class="admin-card admin-detail-card"><h3>Políticas de operação</h3><dl><dt>Convites</dt><dd>Código de uso único e expiração entre 1 e 30 dias.</dd><dt>Publicação</dt><dd>Exige ação explícita do cliente após salvar o cardápio.</dd><dt>Billing</dt><dd>Preparado no banco; cobrança não habilitada nesta fase.</dd><dt>Filtros</dt><dd>Fuso e intervalo são preservados na URL das páginas analíticas.</dd></dl></section>
  }
  @if(loading&&['subscriptions','usage','videos','storage'].includes(section)){<div class="admin-skeleton admin-detail-loading" role="status" aria-label="Carregando métricas"></div>}
  @if(error&&['subscriptions','usage','videos','storage'].includes(section)){<div class="admin-state admin-state-error" role="alert">Não foi possível carregar as métricas.</div>}
`})
export class AdminOperationsComponent implements OnChanges {
  @Input({required:true})section='subscriptions';@Input()data:AdminDashboard|null=null;@Input({required:true})filter!:AdminFilter;@Input()loading=false;@Input()error=false;
  private api=inject(AdminApiService);
  readonly rows=signal<any[]>([]);readonly total=signal(0);readonly listLoading=signal(false);readonly listError=signal(false);
  readonly commercial=signal<AdminCommercialReport|null>(null);
  readonly infrastructure=signal<AdminInfrastructureReport|null>(null);
  readonly purgeJobs=signal<{id:string;business_id:string;phase:string;attempts:number;
    last_error_code:string|null;started_at:string;completed_at:string|null}[]>([]);
  private reportKey='';
  private reportRequest?:Subscription;
  page=1;mediaStatus='';auditAction='';auditTarget='';auditFrom='';auditTo='';
  get period(){return periodLabel(this.filter);}n(key:string){return Number(this.data?.snapshot?.[key]||0).toLocaleString('pt-BR');}p(key:string){return Number(this.data?.period?.[key]||0).toLocaleString('pt-BR');}a(key:string){return Number(this.data?.attention?.[key]||0).toLocaleString('pt-BR');}
  ngOnChanges(changes:SimpleChanges){
    if(changes['section']||changes['filter']){
      this.page=1;this.load();this.loadReport();
      if(this.section==='security')this.api.purgeJobs(1).subscribe({next:result=>this.purgeJobs.set(result.data),
        error:()=>this.purgeJobs.set([])});
    }
  }
  go(page:number){this.page=page;this.load();}
  load(){if(!['videos','storage','audit'].includes(this.section))return;this.listLoading.set(true);this.listError.set(false);
    const request=this.section==='audit'?this.api.auditLogs({page:this.page,limit:25,
      action:/^[A-Za-z0-9_.]{1,80}$/.test(this.auditAction)?this.auditAction:null,
      targetId:this.auditTarget||null,from:this.auditFrom?new Date(this.auditFrom+'T00:00:00').toISOString():null,
      to:this.auditTo?new Date(this.auditTo+'T00:00:00').toISOString():null})
      :this.api.media({page:this.page,limit:25,type:this.section==='videos'?'video':'image',status:this.mediaStatus||null,
        from:this.filter.from,to:this.filter.to});
    request.subscribe({next:result=>{this.rows.set(result.data);this.total.set(result.pagination?.total||0);this.listLoading.set(false);},error:()=>{this.listError.set(true);this.listLoading.set(false);}});
  }
  private loadReport(){
    if(!this.filter)return;
    const key=`${this.section}|${this.filter.from}|${this.filter.to}`;
    if(key===this.reportKey)return;
    this.reportKey=key;this.reportRequest?.unsubscribe();
    if(this.section==='subscriptions')this.reportRequest=this.api.commercial(this.filter)
      .subscribe({next:value=>this.commercial.set(value),error:()=>this.commercial.set(null)});
    if(['usage','videos','storage'].includes(this.section))this.reportRequest=this.api.infrastructure(this.filter)
      .subscribe({next:value=>this.infrastructure.set(value),error:()=>this.infrastructure.set(null)});
  }
  alertLabel(code:string){return ({UPLOAD_SURGE:'Muitos uploads',IMAGE_SURGE:'Muitas imagens Storage',
    VIDEO_REJECTIONS:'Vídeos rejeitados',
    FAILED_MUX_WEBHOOK:'Webhooks Mux falhando',FAILED_BILLING_WEBHOOK:'Webhook de billing falhando',ADMIN_LOGIN_ATTEMPTS:'Tentativas de login Admin',
    API_RATE_LIMITS:'Rate limits elevados',API_5XX:'Erros 5xx elevados'} as Record<string,string>)[code]||code;}
}
