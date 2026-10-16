import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AdminApiService, VideoSecurityReport } from './admin-api.service';

@Component({
  selector: 'app-admin-video-security', standalone: true, imports: [CommonModule, FormsModule],
  template: `
    <section class="admin-card admin-detail-card">
      <h3>Segurança de vídeos</h3>
      <div class="admin-table-controls"><label>Período<select [(ngModel)]="days" (ngModelChange)="page=1;load()">
        <option [ngValue]="1">Hoje (UTC)</option><option [ngValue]="7">7 dias</option><option [ngValue]="30">30 dias</option>
      </select></label><button type="button" [disabled]="loading()" (click)="load()">Atualizar</button></div>
      @if(error()){<p class="admin-inline-error" role="alert">{{error()}}</p>}
      @if(loading()){<p role="status">Carregando segurança de vídeos…</p>}
      @if(report(); as data){
        <p>Estado global: <strong>{{data.globalState}}</strong>. Emergência de ambiente: {{data.environmentKillSwitch?'ativa':'inativa'}}.</p>
        <p class="admin-muted">Uso estimado por autorizações: não representa minutos entregues nem custo faturado pelo Mux. Dados do provedor chegam com atraso mínimo de 12 horas. Os limites afetam somente vídeos.</p>
        <div class="admin-table-scroll"><table><thead><tr><th>Estabelecimento / Plano</th><th>Prontos</th><th>Intents</th><th>Tokens solicitados</th><th>Bloqueios</th><th>Uso estimado (s)</th><th>Provider reported (s)</th><th>Estado</th></tr></thead>
          <tbody>@for(row of data.businesses;track row.businessId){<tr><th scope="row">{{row.name}} · {{row.plan}}</th><td>{{row.activeVideos}}</td>
            <td>{{row.metrics['upload_intents']||0}}</td><td>{{row.metrics['playback_token_requests']||0}}</td>
            <td>{{(row.metrics['playback_blocked']||0)+(row.metrics['upload_blocked']||0)}}</td><td>{{row.estimatedDeliverySeconds|number:'1.0-0'}}</td>
            <td>{{row.providerReportedDeliverySeconds===null?'Não medido':(row.providerReportedDeliverySeconds|number:'1.0-0')}}</td>
            <td>{{row.state}} @if(row.expiresAt){<small>até {{row.expiresAt|date:'dd/MM HH:mm'}}</small>}</td></tr>}
          @empty{<tr><td colspan="8">Sem estabelecimentos.</td></tr>}</tbody></table></div>
        <div class="admin-pagination"><span>Página {{page}} · {{data.total}} estabelecimentos</span><div>
          <button type="button" [disabled]="page<=1||loading()" (click)="page=page-1;load()">Anterior</button>
          <button type="button" [disabled]="page*50>=data.total||loading()" (click)="page=page+1;load()">Próxima</button>
        </div></div>
        <h3>Controle temporário</h3>
        <p>Exige reautenticação recente. Toda mudança exige motivo e fica na auditoria.</p>
        <form (ngSubmit)="apply()" class="admin-table-controls">
          <label>Alvo<select name="target" [(ngModel)]="target" required><option value="">Selecione</option><option value="global">Todos os vídeos (emergência)</option>
            @for(row of data.businesses;track row.businessId){<option [value]="row.businessId">{{row.name}}</option>}</select></label>
          <label>Estado<select name="state" [(ngModel)]="state"><option value="HARD_BLOCK">Bloquear vídeo</option><option value="SOFT_ALERT">Alerta</option><option value="NORMAL">Liberar vídeo</option></select></label>
          <label>Duração<select name="seconds" [(ngModel)]="seconds"><option [ngValue]="300">5 minutos</option><option [ngValue]="1800">30 minutos</option><option [ngValue]="3600">1 hora</option><option [ngValue]="86400">24 horas</option></select></label>
          <label>Motivo<input name="reason" [(ngModel)]="reason" required minlength="3" maxlength="500" /></label>
          <button type="submit" [disabled]="saving()||!target||reason.trim().length<3">{{saving()?'Salvando…':'Aplicar controle'}}</button>
        </form>
        @if(saved()){<p role="status">Controle registrado na auditoria.</p>}
        <h3>Mídias com mais solicitações</h3><ul class="admin-simple-list">@for(row of data.media;track row.mediaId){<li><span>{{row.businessId}} · {{row.mediaId}}</span><strong>{{row.requests}}</strong></li>}@empty{<li>Sem solicitações no período.</li>}</ul>
        <h3>Alertas recentes</h3><ul class="admin-simple-list">@for(event of data.events;track $index){<li><span>{{event.code}} · {{event.endpoint}} · {{event.businessId}} · {{event.createdAt|date:'dd/MM HH:mm'}}</span><strong>{{event.occurrences}}</strong></li>}@empty{<li>Sem alertas no período.</li>}</ul>
      }
    </section>`
})
export class AdminVideoSecurityComponent implements OnInit, OnDestroy {
  private readonly api = inject(AdminApiService);
  private request?: Subscription;
  private mutation?: Subscription;
  readonly report = signal<VideoSecurityReport | null>(null);
  readonly loading = signal(false); readonly saving = signal(false);
  readonly error = signal(''); readonly saved = signal(false);
  days = 1; page = 1; target = ''; state = 'HARD_BLOCK'; seconds = 300; reason = '';
  ngOnInit() { this.load(); }
  ngOnDestroy() { this.request?.unsubscribe(); this.mutation?.unsubscribe(); }
  load() {
    this.request?.unsubscribe(); this.loading.set(true); this.error.set('');
    this.request = this.api.videoSecurity(this.days, this.page).subscribe({
      next: value => { this.report.set(value); this.loading.set(false); },
      error: () => { this.report.set(null); this.error.set('Não foi possível consultar a segurança de vídeos.'); this.loading.set(false); }
    });
  }
  apply() {
    if (this.saving() || !this.target || this.reason.trim().length < 3) return;
    this.saving.set(true); this.saved.set(false); this.error.set('');
    this.mutation = this.api.setVideoSecurityState(this.target === 'global' ? null : this.target, this.state, this.seconds, this.reason.trim()).subscribe({
      next: () => { this.saving.set(false); this.saved.set(true); this.reason = ''; this.load(); },
      error: failure => { this.saving.set(false); this.error.set(failure?.error?.error?.code === 'ADMIN_REAUTH_REQUIRED'
        ? 'Reautentique sua sessão administrativa antes de alterar o controle.' : 'Não foi possível alterar o controle de vídeo.'); }
    });
  }
}
