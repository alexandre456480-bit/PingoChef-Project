import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { AdminFilter, AdminSeriesPoint } from './admin-api.service';

@Component({
  selector:'app-admin-chart',standalone:true,imports:[CommonModule],
  template:`
    <figure class="admin-card admin-chart-card">
      <figcaption><h3>{{ title }}</h3><p>{{ description }}</p></figcaption>
      @if (loading) {
        <div class="admin-skeleton admin-chart-loading" role="status" aria-label="Carregando gráfico"></div>
      } @else if (error) {
        <div class="admin-state admin-state-error" role="alert">Não foi possível carregar o gráfico.</div>
      } @else if (!points.length) {
        <div class="admin-state">Sem dados no período selecionado.</div>
      } @else {
        <div class="admin-chart" role="img" [attr.aria-label]="title + ': ' + accessibleSummary">
          @for (point of points;track point.bucket) {
            <div class="admin-chart-column" [attr.title]="tooltip(point)">
              <span class="admin-chart-value">{{ point.value }}</span>
              <div class="admin-chart-bar-track"><div class="admin-chart-bar"
                [style.height.%]="height(point.value)"></div></div>
              <span class="admin-chart-label">{{ label(point.bucket) }}</span>
            </div>
          }
        </div>
        <details class="admin-chart-table"><summary>Ver dados em tabela</summary>
          <table><thead><tr><th scope="col">Período</th><th scope="col">{{ title }}</th></tr></thead>
            <tbody>@for (point of points;track point.bucket) {
              <tr><th scope="row">{{ longLabel(point.bucket) }}</th><td>{{ point.value }}</td></tr>
            }</tbody></table>
        </details>
      }
    </figure>
  `
})
export class AdminChartComponent {
  @Input() title='';@Input() description='';@Input() metric='';
  @Input() series:AdminSeriesPoint[]=[];
  @Input() filter!:AdminFilter;
  @Input() loading=false;@Input() error=false;
  get points(){return (this.series||[]).filter(point=>point.metric===this.metric);}
  get maximum(){return Math.max(1,...this.points.map(point=>point.value));}
  get accessibleSummary(){return this.points.map(point=>`${this.longLabel(point.bucket)}: ${point.value}`).join('; ');}
  height(value:number){return value===0?0:Math.max(4,Math.round(value/this.maximum*100));}
  label(bucket:string){
    if(!this.filter)return bucket;
    const options:Intl.DateTimeFormatOptions=this.filter.granularity==='hour'
      ? {hour:'2-digit',minute:'2-digit'}
      : this.filter.granularity==='month'||this.filter.granularity==='year'
        ? {month:'short',year:'2-digit'}:{day:'2-digit',month:'2-digit'};
    return new Intl.DateTimeFormat('pt-BR',{...options,timeZone:this.filter.timezone}).format(new Date(bucket));
  }
  longLabel(bucket:string){return new Intl.DateTimeFormat('pt-BR',{
    dateStyle:'medium',timeStyle:this.filter?.granularity==='hour'?'short':undefined,
    timeZone:this.filter?.timezone||'UTC'
  }).format(new Date(bucket));}
  tooltip(point:AdminSeriesPoint){return `${this.longLabel(point.bucket)} · ${point.value}`;}
}
