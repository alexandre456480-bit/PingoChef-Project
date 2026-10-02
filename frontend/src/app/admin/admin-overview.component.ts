import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminChartComponent } from './admin-chart.component';
import { AdminMetricTooltipDirective } from './admin-metric-tooltip.directive';
import { AdminApiService, type AdminDashboard, type AdminFilter, type AdminInfrastructureReport } from './admin-api.service';
import { periodLabel } from './admin-filter';

@Component({
  selector:'app-admin-overview',standalone:true,imports:[CommonModule,RouterLink,AdminChartComponent,AdminMetricTooltipDirective],
  template:`
    <section class="admin-page-heading"><div><span class="admin-eyebrow">Visão geral</span>
      <h2>Como está o PingoChef?</h2><p>Indicadores operacionais com origem e período definidos.</p></div>
      <a routerLink="/admin/clients" class="admin-button admin-button-outline">Ver clientes</a>
    </section>
    @if(loading){<div class="admin-metrics-grid" role="status" aria-label="Carregando indicadores">
      @for (_ of [1,2,3,4,5,6,7,8];track _){<div class="admin-skeleton admin-kpi-skeleton"></div>}
    </div>}
    @if(error){<div class="admin-state admin-state-error" role="alert">Não foi possível carregar a visão geral. Atualize a página para tentar novamente.</div>}
    @if(data&&!loading){
      <div class="admin-section-caption"><h3>Clientes</h3><span>Estado atual e aquisição em {{period}}</span></div>
      <div class="admin-metrics-grid">
        <article class="admin-card admin-kpi" title="Total de estabelecimentos cadastrados, independentemente do estado. Fonte: businesses."><span>Clientes totais</span><strong>{{n('clientsTotal')}}</strong><small>estabelecimentos · atual</small></article>
        <article class="admin-card admin-kpi" title="Estabelecimentos com estado administrativo ACTIVE. Fonte: business_account_state."><span>Clientes ativos</span><strong>{{n('clientsActive')}}</strong><small>contas · atual</small></article>
        <article class="admin-card admin-kpi admin-kpi-accent" title="Estabelecimentos criados no período selecionado. Fonte: businesses.created_at."><span>Novos no período</span><strong>{{p('newClients')}}</strong><small>contas · {{period}}</small>
          @if(filter.comparison!=='none'){<em>{{comparisonText}}</em>}
        </article>
        <article class="admin-card admin-kpi" title="Estabelecimentos com estado administrativo SUSPENDED. Fonte: business_account_state."><span>Suspensos</span><strong>{{n('clientsSuspended')}}</strong><small>contas · atual</small></article>
      </div>
      <div class="admin-section-caption"><h3>Cardápios e conteúdo</h3><span>Inventário atual da plataforma</span></div>
      <div class="admin-metrics-grid">
        <article class="admin-card admin-kpi" title="Contas com is_published=true, incluindo as administrativamente suspensas. Fonte: business_account_state."><span>Cardápios publicados</span><strong>{{n('menusPublished')}}</strong><small>cardápios · atual</small></article>
        <article class="admin-card admin-kpi" title="Linhas de produtos cadastrados. Fonte: menu_items."><span>Produtos</span><strong>{{n('products')}}</strong><small>produtos · atual</small></article>
        <article class="admin-card admin-kpi" title="Mídias de imagem prontas, mais imagens legadas de produtos sem mídia de imagem pronta. Fontes: product_media e menu_items.image_url."><span>Imagens vinculadas</span><strong>{{n('images')}}</strong><small>imagens · atual</small></article>
        <article class="admin-card admin-kpi" title="Vídeos de produto em estado ready. Fonte: product_media."><span>Vídeos prontos</span><strong>{{n('videos')}}</strong><small>vídeos · atual</small></article>
      </div>
      <div class="admin-chart-grid">
        <app-admin-chart title="Novos clientes" description="Estabelecimentos criados por período · fonte: businesses"
          metric="newClients" [series]="data.series" [filter]="filter" />
        <app-admin-chart title="Produtos criados" description="Produtos cadastrados por período · fonte: menu_items"
          metric="productsCreated" [series]="data.series" [filter]="filter" />
      </div>
      <section class="admin-card admin-attention" aria-label="Atenção necessária">
        <div class="admin-card-heading"><h3>Atenção necessária</h3><p>Ocorrências no período selecionado, salvo assinaturas em grace.</p></div>
        <div class="admin-attention-grid">
          <div><strong>{{a('grace')}}</strong><span>Assinaturas em grace</span></div>
          <div><strong>{{a('failedWebhooks')}}</strong><span>Webhooks Mux falhando</span></div>
          <div><strong>{{a('rejectedUploads')}}</strong><span>Uploads rejeitados</span></div>
          <div><strong>{{a('adminLoginAttempts')}}</strong><span>Tentativas de login Admin</span></div>
        </div>
        @if(infrastructure()?.alerts?.length){<ul class="admin-simple-list" aria-label="Anomalias para revisão">@for(alert of infrastructure()!.alerts;track $index){<li><span>{{alertLabel(alert.code)}} @if(alert.businessId){· {{alert.businessId}}}</span><strong>{{alert.count}} ocorrência(s)</strong></li>}</ul>}
        <p class="admin-muted">Alertas são heurísticos e não suspendem clientes automaticamente.</p>
      </section>
      <div class="admin-subtle-note">Receita e MRR aparecerão quando houver cobrança instrumentada. Nenhum valor financeiro é estimado.</div>
    }
  `
})
export class AdminOverviewComponent implements OnChanges {
  private api=inject(AdminApiService);private infraRequest?:Subscription;private lastInfraKey='';
  readonly infrastructure=signal<AdminInfrastructureReport|null>(null);
  @Input() data:AdminDashboard|null=null;@Input({required:true}) filter!:AdminFilter;
  @Input() loading=false;@Input() error=false;
  get period(){return periodLabel(this.filter);}
  ngOnChanges(changes:SimpleChanges){
    if(!changes['filter']||!this.filter)return;
    const key=`${this.filter.from}|${this.filter.to}`;
    if(key===this.lastInfraKey)return;
    this.lastInfraKey=key;this.infraRequest?.unsubscribe();
    this.infraRequest=this.api.infrastructure(this.filter).subscribe({next:value=>this.infrastructure.set(value),
      error:()=>this.infrastructure.set(null)});
  }
  alertLabel(code:string){return ({UPLOAD_SURGE:'Uploads acima do normal',IMAGE_SURGE:'Imagens Storage acima do normal',
    VIDEO_REJECTIONS:'Vídeos rejeitados',
    FAILED_MUX_WEBHOOK:'Falhas em webhooks Mux',FAILED_BILLING_WEBHOOK:'Falha em webhook de billing',ADMIN_LOGIN_ATTEMPTS:'Tentativas de login Admin',
    API_RATE_LIMITS:'Rate limits elevados',API_5XX:'Erros 5xx elevados'} as Record<string,string>)[code]||code;}
  n(key:string){return Number(this.data?.snapshot?.[key]||0).toLocaleString('pt-BR');}
  p(key:string){return Number(this.data?.period?.[key]||0).toLocaleString('pt-BR');}
  a(key:string){return Number(this.data?.attention?.[key]||0).toLocaleString('pt-BR');}
  get comparisonText(){
    const current=Number(this.data?.period?.['newClients']||0);
    const previous=Number(this.data?.period?.['previousNewClients']||0);
    if(!previous)return `Comparação: ${previous} · variação indisponível`;
    const pct=(current-previous)/previous*100;
    return `${pct>=0?'↑':'↓'} ${Math.abs(pct).toFixed(1)}% · comparação: ${previous}`;
  }
}
