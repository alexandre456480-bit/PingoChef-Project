import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { AdminFilter } from './admin-api.service';
import { ADMIN_PRESETS, customFilter, periodLabel, presetFilter } from './admin-filter';

@Component({
  selector:'app-admin-filter',standalone:true,imports:[CommonModule,FormsModule],
  template:`
    <section class="admin-filter" aria-label="Filtros temporais">
      <div class="admin-filter-top">
        <div><strong>Período analisado</strong><p>{{ label }}</p></div>
        <span class="admin-filter-zone">{{ filter.timezone }}</span>
      </div>
      <div class="admin-filter-controls">
        <label>Período
          <select [ngModel]="filter.preset" (ngModelChange)="choosePreset($event)" aria-label="Selecionar período">
            @for (option of presets; track option[0]) { <option [value]="option[0]">{{ option[1] }}</option> }
            <option value="day">Dia específico</option><option value="month">Mês específico</option>
            <option value="year">Ano específico</option><option value="range">Intervalo personalizado</option>
          </select>
        </label>
        <label>Comparar com
          <select [ngModel]="filter.comparison" (ngModelChange)="setComparison($event)">
            <option value="none">Sem comparação</option><option value="previous">Período anterior</option>
            <option value="year">Mesmo período do ano anterior</option>
          </select>
        </label>
        <label>Granularidade
          <select [ngModel]="filter.granularity" (ngModelChange)="setGranularity($event)">
            <option value="hour">Hora</option><option value="day">Dia</option>
            <option value="week">Semana</option><option value="month">Mês</option>
            <option value="year">Ano</option>
          </select>
        </label>
        <label>Fuso horário
          <select [ngModel]="filter.timezone" (ngModelChange)="setTimezone($event)">
            <option value="America/Sao_Paulo">São Paulo</option><option value="UTC">UTC</option>
            <option value="America/New_York">Nova York</option><option value="Europe/Lisbon">Lisboa</option>
          </select>
        </label>
      </div>
      @if (customMode) {
        <div class="admin-filter-custom">
          @if (customMode === 'day' || customMode === 'range') {
            <label>De <input type="date" [(ngModel)]="customStart" /></label>
            @if (customMode === 'range') { <label>Até <input type="date" [(ngModel)]="customEnd" /></label> }
          } @else if (customMode === 'month') {
            <label>Mês <input type="month" [(ngModel)]="customStart" /></label>
          } @else {
            <label>Ano <input type="number" min="2020" max="2100" [(ngModel)]="customStart" /></label>
          }
          <button type="button" class="admin-button" (click)="applyCustom()">Aplicar período</button>
        </div>
      }
      @if (error) { <p class="admin-inline-error" role="alert">{{ error }}</p> }
    </section>
  `
})
export class AdminFilterComponent {
  @Input({required:true}) filter!:AdminFilter;
  @Output() filterChange=new EventEmitter<AdminFilter>();
  readonly presets=ADMIN_PRESETS;
  customMode:'day'|'month'|'year'|'range'|null=null;
  customStart='';customEnd='';error='';
  get label(){return periodLabel(this.filter);}
  choosePreset(value:string){
    if(['day','month','year','range'].includes(value)) {
      this.customMode=value as typeof this.customMode;
      this.customStart='';this.customEnd='';return;
    }
    this.customMode=null;this.error='';
    this.filterChange.emit({ ...presetFilter(value,this.filter.timezone),comparison:this.filter.comparison });
  }
  setComparison(value:AdminFilter['comparison']){this.filterChange.emit({...this.filter,comparison:value});}
  setGranularity(value:AdminFilter['granularity']){
    const days=(Date.parse(this.filter.to)-Date.parse(this.filter.from))/86400000;
    if((value==='hour'&&days>2)||(value==='day'&&days>90)) {
      this.error=value==='hour'?'Use horas em períodos de até 2 dias.':'Use dias em períodos de até 90 dias.';
      return;
    }
    this.error='';this.filterChange.emit({...this.filter,granularity:value});
  }
  setTimezone(value:string){
    const custom=['day','month','year','range','custom'].includes(this.filter.preset);
    if(this.customMode&&this.customStart){
      try{this.filterChange.emit(customFilter(this.customMode,String(this.customStart),this.customEnd,value,this.filter.comparison));this.error='';}
      catch(error){this.error=error instanceof Error?error.message:'Período inválido.';}
    }else if(custom){this.filterChange.emit({...this.filter,timezone:value});}
    else{this.filterChange.emit({...presetFilter(this.filter.preset,value),comparison:this.filter.comparison});}
  }
  applyCustom(){
    if(!this.customMode)return;
    try {
      const result=customFilter(this.customMode,String(this.customStart),this.customEnd,
        this.filter.timezone,this.filter.comparison);
      this.error='';this.filterChange.emit(result);
    } catch(error){this.error=error instanceof Error?error.message:'Período inválido.';}
  }
}
