import { Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, finalize, of, switchMap, takeUntil } from 'rxjs';
import {
  AnalyticsService,
  AnalyticsFilters,
  AnalyticsMetric,
  AnalyticsOptions,
  AnalyticsRanking,
  AnalyticsReport,
  AnalyticsRow,
} from '../../../../services/analytics.service';
import { AnalyticsChartComponent } from './analytics-chart.component';

@Component({
  selector: 'app-owner-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AnalyticsChartComponent],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css',
})
export class AnalyticsComponent implements OnInit {
  private api = inject(AnalyticsService);
  private destroyRef = inject(DestroyRef);
  private requests = new Subject<AnalyticsFilters>();
  private filterChanged = new Subject<void>();
  private trendRequests = new Subject<AnalyticsRow>();
  options = signal<AnalyticsOptions | null>(null);
  report = signal<AnalyticsReport | null>(null);
  loading = signal(true);
  error = signal('');
  forbidden = signal(false);
  rankingError = signal('');
  rankingBusy = signal('');
  rankings = signal<Record<string, AnalyticsRanking>>({});
  trend = signal<{ date: string; value: number }[] | null>(null);
  trendName = signal('');
  trendBusy = signal(false);
  trendError = signal('');
  exporting = signal(false);
  exportError = signal('');
  preset = '7d';
  start = '';
  end = '';
  month = '';
  year = '';
  day = '';
  comparison = 'none';
  comparisonStart = '';
  comparisonEnd = '';
  source = '';
  qrId = '';
  exportSection = 'series';
  metric = signal<AnalyticsMetric>('menuViews');
  activeFilters: AnalyticsFilters = {};
  readonly kpis: { key: AnalyticsMetric; name: string; definition: string }[] = [
    {
      key: 'menuViews',
      name: 'Visualizações do cardápio',
      definition:
        'Carregamentos concluídos do cardápio público. Uma navegação conta uma vez; reabrir ou recarregar conta outra visualização.',
    },
    {
      key: 'visitors',
      name: 'Visitantes',
      definition:
        'Identidades anônimas de sessão únicas com uma visualização no período. Não representa pessoas identificadas. Não some os visitantes dos pontos do gráfico.',
    },
    {
      key: 'productViews',
      name: 'Visualizações de produtos',
      definition:
        'Aberturas do detalhe de um produto. Cada produto conta uma vez por navegação, mesmo quando reaberto.',
    },
    {
      key: 'videoPlays',
      name: 'Reproduções de vídeo',
      definition:
        'Reproduções que realmente começaram no player. Pausar e continuar conta uma vez; uma nova reprodução iniciada conta novamente.',
    },
  ];
  readonly presets = [
    { value: 'today', label: 'Hoje' },
    { value: 'yesterday', label: 'Ontem' },
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: 'month', label: 'Este mês' },
    { value: 'previousMonth', label: 'Mês anterior', advanced: true },
    { value: '3m', label: 'Últimos 3 meses', advanced: true },
    { value: '6m', label: 'Últimos 6 meses', advanced: true },
    { value: 'year', label: 'Este ano', advanced: true },
    { value: 'previousYear', label: 'Ano anterior', advanced: true },
    { value: 'day', label: 'Dia específico' },
    { value: 'specificMonth', label: 'Mês específico', advanced: true },
    { value: 'specificYear', label: 'Ano específico', advanced: true },
    { value: 'custom', label: 'Intervalo personalizado' },
  ];
  chartPoints = computed(() =>
    (this.report()?.series || []).map((p) => ({
      label:
        p.hour === undefined
          ? this.date(p.date)
          : `${this.date(p.date)} às ${String(p.hour).padStart(2, '0')}h`,
      shortLabel:
        p.hour === undefined ? p.date.slice(5).split('-').reverse().join('/') : `${p.hour}h`,
      value: p[this.metric()],
    })),
  );
  trendPoints = computed(() =>
    (this.trend() || []).map((p) => ({
      label: this.date(p.date),
      shortLabel: p.date.slice(5).split('-').reverse().join('/'),
      value: p.value,
    })),
  );
  ngOnInit() {
    this.requests
      .pipe(
        debounceTime(160),
        switchMap((query) => {
          this.loading.set(true);
          return this.api.report(query).pipe(
            takeUntil(this.filterChanged),
            catchError((e) => {
              this.error.set(this.errorMessage(e));
              this.forbidden.set(e.status === 403);
              return of(null);
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => {
        this.report.set(data);
        if (data)
          this.rankings.set({
            product_views: { ...data.viewed, page: 1 },
            likes: { ...data.liked, page: 1 },
            ...(data.categories ? { categories: { ...data.categories, page: 1 } } : {}),
          });
      });
    this.trendRequests
      .pipe(
        switchMap((row) => {
          this.trendName.set(row.name);
          this.trendBusy.set(true);
          this.trend.set(null);
          this.trendError.set('');
          return this.api.trend(this.activeFilters, row.id).pipe(
            takeUntil(this.filterChanged),
            catchError((e) => {
              this.trendError.set(this.errorMessage(e));
              return of(null);
            }),
            finalize(() => this.trendBusy.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => this.trend.set(data));
    this.api
      .options()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (options) => {
          this.options.set(options);
          this.day = options.today;
          this.month = options.today.slice(0, 7);
          this.year = options.today.slice(0, 4);
          this.selectPreset();
        },
        error: (e) => {
          this.error.set(this.errorMessage(e));
          this.forbidden.set(e.status === 403);
          this.loading.set(false);
        },
      });
  }
  selectPreset() {
    const today = this.options()?.today;
    if (!today) return;
    const [y, m] = today.split('-').map(Number);
    this.end = today;
    if (this.preset === 'today') this.start = today;
    else if (this.preset === 'yesterday') this.start = this.end = this.shift(today, -1);
    else if (this.preset === '7d' || this.preset === '30d')
      this.start = this.shift(today, this.preset === '7d' ? -6 : -29);
    else if (this.preset === 'month') this.start = `${today.slice(0, 7)}-01`;
    else if (this.preset === 'previousMonth') {
      this.start = this.iso(new Date(Date.UTC(y, m - 2, 1)));
      this.end = this.iso(new Date(Date.UTC(y, m - 1, 0)));
    } else if (this.preset === '3m' || this.preset === '6m') {
      const months = this.preset === '3m' ? 3 : 6,
        day = Number(today.slice(8));
      const last = new Date(Date.UTC(y, m - months, 0)).getUTCDate();
      this.start = this.shift(
        this.iso(new Date(Date.UTC(y, m - 1 - months, Math.min(day, last)))),
        1,
      );
    } else if (this.preset === 'year') this.start = `${y}-01-01`;
    else if (this.preset === 'previousYear') {
      this.start = `${y - 1}-01-01`;
      this.end = `${y - 1}-12-31`;
    } else if (this.preset === 'day') this.start = this.end = this.day;
    else if (
      this.preset === 'specificMonth' ||
      this.preset === 'specificYear' ||
      this.preset === 'custom'
    ) {
      this.loading.set(false);
      return;
    }
    this.apply();
  }
  apply() {
    const opts = this.options();
    if (!opts) return;
    if (this.preset === 'day') this.start = this.end = this.day;
    if (this.preset === 'specificMonth' && /^\d{4}-\d{2}$/.test(this.month)) {
      this.start = this.month + '-01';
      const [y, m] = this.month.split('-').map(Number);
      this.end = this.iso(new Date(Date.UTC(y, m, 0)));
      if (this.end > opts.today) this.end = opts.today;
    }
    if (this.preset === 'specificYear' && /^\d{4}$/.test(this.year)) {
      this.start = this.year + '-01-01';
      this.end = this.year + '-12-31';
      if (this.end > opts.today) this.end = opts.today;
    }
    if (
      !this.validDate(this.start) ||
      !this.validDate(this.end) ||
      this.start > this.end ||
      this.start < opts.minDate ||
      this.end > opts.today
    ) {
      this.error.set('Escolha um período válido dentro do histórico do plano.');
      return;
    }
    if (
      this.comparison === 'custom' &&
      (!this.validDate(this.comparisonStart) || !this.validDate(this.comparisonEnd))
    ) {
      this.error.set('Complete as datas da comparação.');
      return;
    }
    this.filterChanged.next();
    this.report.set(null);
    this.trend.set(null);
    this.trendName.set('');
    this.rankings.set({});
    this.rankingError.set('');
    this.error.set('');
    this.exportError.set('');
    this.loading.set(true);
    this.activeFilters = {
      start: this.start,
      end: this.end,
      comparison: this.comparison,
      ...(this.source ? { source: this.source } : {}),
      ...(this.qrId ? { qrId: this.qrId } : {}),
      ...(this.comparison === 'custom'
        ? { comparisonStart: this.comparisonStart, comparisonEnd: this.comparisonEnd }
        : {}),
    };
    this.requests.next({ ...this.activeFilters });
  }
  page(metric: string, step: number) {
    const rank = this.rankings()[metric],
      page = (rank.page || 1) + step;
    if (this.rankingBusy() || page < 1 || page > Math.ceil(rank.total / 5)) return;
    this.rankingBusy.set(metric);
    this.rankingError.set('');
    this.api
      .ranking(this.activeFilters, metric, page)
      .pipe(
        takeUntil(this.filterChanged),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.rankingBusy.set('')),
      )
      .subscribe({
        next: (result) => this.rankings.update((r) => ({ ...r, [metric]: result })),
        error: (e) => this.rankingError.set(this.errorMessage(e)),
      });
  }
  showTrend(row: AnalyticsRow) {
    if (!row.removed && this.options()?.advanced) this.trendRequests.next(row);
  }
  selectQr(id: string | null) {
    if (id) {
      this.qrId = id;
      this.apply();
    }
  }
  exportCsv() {
    if (this.exporting() || !this.report()) return;
    this.exporting.set(true);
    this.exportError.set('');
    const query = { ...this.activeFilters };
    this.api
      .export(query, this.exportSection)
      .pipe(
        takeUntil(this.filterChanged),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.exporting.set(false)),
      )
      .subscribe({
        next: (blob) => {
          const href = URL.createObjectURL(blob),
            link = document.createElement('a');
          link.href = href;
          link.download = `pingochef-analytics-${query['start']}-${query['end']}.csv`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(href), 1000);
        },
        error: (e) =>
          this.exportError.set(
            e.status === 403
              ? 'Exportação disponível no Analytics Completo.'
              : 'Não foi possível exportar. Reduza o período ou tente novamente.',
          ),
      });
  }
  sourceName(name: string) {
    return (
      (
        {
          direct: 'Direto',
          qr: 'QR',
          instagram: 'Instagram',
          facebook: 'Facebook',
          google: 'Google',
          whatsapp: 'WhatsApp',
          other: 'Outras referências',
          unattributed: 'Sem atribuição',
        } as Record<string, string>
      )[name] || name
    );
  }
  date(input: string) {
    return input.slice(0, 10).split('-').reverse().join('/');
  }
  collectionDate() {
    const r = this.report();
    return r
      ? new Intl.DateTimeFormat('pt-BR', { timeZone: r.timezone }).format(
          new Date(r.collectionStartedAt),
        )
      : '';
  }
  hourWidth(value: number) {
    return Math.max(
      0,
      (value / Math.max(1, ...(this.report()?.hours || []).map((h) => h.value))) * 100,
    );
  }
  signed(value: number) {
    return value > 0 ? `+${value.toLocaleString('pt-BR')}` : value.toLocaleString('pt-BR');
  }
  pages(total: number) {
    return Math.ceil(total / 5);
  }
  metricName() {
    return this.kpis.find((k) => k.key === this.metric())!.name;
  }
  private iso(date: Date) {
    return date.toISOString().slice(0, 10);
  }
  private shift(date: string, days: number) {
    return this.iso(new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000));
  }
  private validDate(date: string) {
    const value = Date.parse(date + 'T00:00:00Z');
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(value) &&
      this.iso(new Date(value)) === date
    );
  }
  private errorMessage(e: { status?: number }) {
    return e.status === 403
      ? 'Seu plano não permite este recurso de Analytics.'
      : e.status === 400
        ? 'Período ou filtro inválido. Verifique também o histórico disponível para a comparação.'
        : 'Não foi possível carregar o Analytics. Tente novamente.';
  }
}
