import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminChartComponent } from './admin-chart.component';
import { AdminMetricTooltipDirective } from './admin-metric-tooltip.directive';
import type { AdminDashboard, AdminFilter } from './admin-api.service';
import { periodLabel } from './admin-filter';

@Component({selector:'app-admin-analytics',standalone:true,imports:[CommonModule,AdminChartComponent,AdminMetricTooltipDirective],template:`
  <section class="admin-page-heading"><div><span class="admin-eyebrow">Aquisição · ativação · engajamento</span><h2>Analytics</h2><p>Coortes de clientes criados em {{period}}.</p></div></section>
  @if(loading){<div class="admin-skeleton admin-detail-loading" role="status" aria-label="Carregando analytics"></div>}
  @if(error){<div class="admin-state admin-state-error" role="alert">Não foi possível carregar os dados.</div>}
  @if(data&&!loading){
    <div class="admin-metrics-grid">
      <article class="admin-card admin-kpi" title="Businesses criados no período selecionado. Fonte: businesses.created_at."><span>Novos clientes</span><strong>{{p('newClients')}}</strong><small>contas · {{period}}</small>@if(filter.comparison!=='none'){<em>{{comparisonText('newClients','previousNewClients')}}</em>}</article>
      <article class="admin-card admin-kpi" title="Businesses distintos com login do proprietário nos últimos 7 dias. Fonte: platform_events LOGIN."><span>Ativos 7 dias</span><strong>{{n('active7d')}}</strong><small>contas · janela móvel</small></article>
      <article class="admin-card admin-kpi" title="Businesses distintos com login do proprietário nos últimos 30 dias. Fonte: platform_events LOGIN."><span>Ativos 30 dias</span><strong>{{n('active30d')}}</strong><small>contas · janela móvel</small></article>
      <article class="admin-card admin-kpi" title="Total atual de produtos dividido pelo total atual de businesses. Fonte: menu_items e businesses."><span>Produtos por cliente</span><strong>{{averageProducts}}</strong><small>produtos/conta · atual</small></article>
    </div>
    <div class="admin-chart-grid"><app-admin-chart title="Crescimento de clientes" description="Total acumulado nos intervalos com novos cadastros · businesses.created_at" metric="clientsTotal" [series]="data.series" [filter]="filter"/>
      <app-admin-chart title="Aquisição de clientes" description="Contas criadas por intervalo · businesses.created_at" metric="newClients" [series]="data.series" [filter]="filter"/>
      <app-admin-chart title="Produtos criados" description="Novos produtos por intervalo · menu_items.created_at" metric="productsCreated" [series]="data.series" [filter]="filter"/>
      <app-admin-chart title="Clientes com login" description="Businesses distintos com LOGIN por intervalo · platform_events" metric="activeBusinesses" [series]="data.series" [filter]="filter"/>
      <app-admin-chart title="Imagens adicionadas" description="Imagens ready criadas no intervalo · product_media" metric="imagesAdded" [series]="data.series" [filter]="filter"/>
      <app-admin-chart title="Vídeos adicionados" description="Vídeos ready criados no intervalo · product_media" metric="videosAdded" [series]="data.series" [filter]="filter"/>
      <app-admin-chart title="Primeiras publicações" description="Evento MENU_PUBLISHED por intervalo · platform_events" metric="publications" [series]="data.series" [filter]="filter"/></div>
    <section class="admin-card admin-detail-card"><h3>Funil de ativação</h3><p class="admin-muted">Clientes criados em {{period}}. Cada etapa exige a anterior; a configuração do negócio depende de evento registrado.</p>
      <div class="admin-funnel">@for(step of funnelSteps;track step.key;let index=$index){<div class="admin-funnel-row"><div><strong>{{step.label}}</strong><small>{{funnel(step.key)}} contas · {{percentage(step.key)}}% da coorte</small></div><div class="admin-funnel-track"><span [style.width.%]="percentageNumber(step.key)"></span></div><span class="admin-funnel-drop">{{index===0?'—':dropoff(index)+'% perda'}}</span></div>}</div>
    </section>
    <div class="admin-detail-grid"><section class="admin-card admin-detail-card"><h3>Tempo até ativação</h3><dl><dt>Convite → cadastro</dt><dd>{{duration(data.timings.inviteToSignupSeconds)}}</dd><dt>Cadastro → primeira publicação</dt><dd>{{duration(data.timings.signupToPublishSeconds)}}</dd></dl><p class="admin-muted">Média dos eventos concluídos no período selecionado.</p></section>
      <section class="admin-card admin-detail-card"><h3>Templates utilizados</h3><p class="admin-muted">Distribuição atual das configurações de design.</p><ul class="admin-simple-list">@for(row of data.templates;track row.template){<li><span>{{row.template}}</span><strong>{{row.count}}</strong></li>}@empty{<li>Nenhum template registrado.</li>}</ul></section></div>
    <div class="admin-metrics-grid"><article class="admin-card admin-kpi" title="Mídias de imagem prontas criadas no período. Fonte: product_media."><span>Imagens adicionadas</span><strong>{{p('imagesAdded')}}</strong><small>mídias · {{period}}</small>@if(filter.comparison!=='none'){<em>{{comparisonText('imagesAdded','previousImagesAdded')}}</em>}</article><article class="admin-card admin-kpi" title="Mídias de vídeo prontas criadas no período. Fonte: product_media."><span>Vídeos adicionados</span><strong>{{p('videosAdded')}}</strong><small>mídias · {{period}}</small>@if(filter.comparison!=='none'){<em>{{comparisonText('videosAdded','previousVideosAdded')}}</em>}</article><article class="admin-card admin-kpi" title="Primeiros eventos MENU_PUBLISHED por business no período. Fonte: platform_events."><span>Primeiras publicações</span><strong>{{p('publications')}}</strong><small>cardápios · {{period}}</small>@if(filter.comparison!=='none'){<em>{{comparisonText('publications','previousPublications')}}</em>}</article><article class="admin-card admin-kpi" title="Produtos cadastrados no período. Fonte: menu_items."><span>Produtos adicionados</span><strong>{{p('productsCreated')}}</strong><small>produtos · {{period}}</small>@if(filter.comparison!=='none'){<em>{{comparisonText('productsCreated','previousProductsCreated')}}</em>}</article></div>
  }
`})
export class AdminAnalyticsComponent {
  @Input()data:AdminDashboard|null=null;@Input({required:true})filter!:AdminFilter;@Input()loading=false;@Input()error=false;
  readonly funnelSteps=[{key:'account',label:'Conta criada'},{key:'business',label:'Negócio configurado'},{key:'category',label:'Categoria criada'},{key:'product',label:'Produto criado'},{key:'design',label:'Design configurado'},{key:'published',label:'Cardápio publicado'}];
  get period(){return periodLabel(this.filter);}
  p(key:string){return Number(this.data?.period?.[key]||0).toLocaleString('pt-BR');}
  comparisonText(currentKey:string,previousKey:string){const current=Number(this.data?.period?.[currentKey]||0),previous=Number(this.data?.period?.[previousKey]||0);return previous?`${((current-previous)/previous*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}% vs ${previous.toLocaleString('pt-BR')}`:`Anterior: 0 · variação indisponível`;}
  n(key:string){return Number(this.data?.snapshot?.[key]||0).toLocaleString('pt-BR');}
  get averageProducts(){const total=Number(this.data?.snapshot?.['clientsTotal']||0);return total?(Number(this.data?.snapshot?.['products']||0)/total).toLocaleString('pt-BR',{maximumFractionDigits:1}):'—';}
  funnel(key:string){return Number(this.data?.funnel?.[key]||0).toLocaleString('pt-BR');}
  percentageNumber(key:string){const total=Number(this.data?.funnel?.['account']||0);return total?Math.round(Number(this.data?.funnel?.[key]||0)/total*100):0;}
  percentage(key:string){return this.percentageNumber(key).toLocaleString('pt-BR');}
  dropoff(index:number){const previous=Number(this.data?.funnel?.[this.funnelSteps[index-1].key]||0),current=Number(this.data?.funnel?.[this.funnelSteps[index].key]||0);return previous?Math.round((previous-current)/previous*100):0;}
  duration(value:number|null){if(value===null||value===undefined)return 'Sem dados';const hours=value/3600;return hours<24?`${hours.toFixed(1)} horas`:`${(hours/24).toFixed(1)} dias`;}
}
