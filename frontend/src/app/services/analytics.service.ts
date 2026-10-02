import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs';
import { API_BASE_URL } from '../constants/api';
export interface AnalyticsOptions {
  timezone: string;
  today: string;
  minDate: string;
  historyDays: number;
  collectionStartedAt: string;
  rawRetentionDays: number;
  aggregateRetentionDays: number;
  advanced: boolean;
  complete: boolean;
  tier: string;
}
export type AnalyticsMetric = 'menuViews' | 'visitors' | 'productViews' | 'videoPlays';
export interface AnalyticsSummary {
  menuViews: number;
  visitors: number;
  productViews: number;
  videoPlays: number;
  video25?: number;
  video50?: number;
  video100?: number;
  likes: number;
  qrEntries?: number;
}
export interface AnalyticsPoint {
  date: string;
  hour?: number;
  menuViews: number;
  visitors: number;
  productViews: number;
  videoPlays: number;
}
export interface AnalyticsRow {
  id: string;
  name: string;
  value: number;
  removed: boolean;
}
export interface AnalyticsRanking {
  rows: AnalyticsRow[];
  total: number;
  page?: number;
  pageSize?: number;
}
export interface AnalyticsRange {
  start: string;
  end: string;
  days: number;
  bucket: string;
}
export interface AnalyticsReport {
  range: AnalyticsRange;
  timezone: string;
  summary: AnalyticsSummary;
  series: AnalyticsPoint[];
  viewed: AnalyticsRanking;
  liked: AnalyticsRanking;
  categories: AnalyticsRanking | null;
  sources: { name: string; value: number }[] | null;
  hours: { hour: number; value: number }[] | null;
  qr: { id: string | null; name: string; value: number }[] | null;
  collectionStartedAt: string;
  likesAttributed: boolean;
  comparison: {
    range: AnalyticsRange;
    summary: AnalyticsSummary;
    deltas: Record<
      AnalyticsMetric,
      { current: number; previous: number; absolute: number; percent: number | null }
    >;
  } | null;
}
export type AnalyticsFilters = Record<string, string>;
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private http = inject(HttpClient);
  private params(query: AnalyticsFilters) {
    return new HttpParams({ fromObject: query });
  }
  options() {
    return this.http
      .get<{ data: AnalyticsOptions }>(`${API_BASE_URL}/analytics/options`)
      .pipe(map((r) => r.data));
  }
  report(query: AnalyticsFilters) {
    return this.http
      .get<{ data: AnalyticsReport }>(`${API_BASE_URL}/analytics`, { params: this.params(query) })
      .pipe(map((r) => r.data));
  }
  ranking(query: AnalyticsFilters, metric: string, page: number) {
    return this.http
      .get<{ data: AnalyticsRanking }>(`${API_BASE_URL}/analytics/rankings`, {
        params: this.params({ ...query, metric, page: String(page), pageSize: '5' }),
      })
      .pipe(map((r) => r.data));
  }
  trend(query: AnalyticsFilters, itemId: string) {
    return this.http
      .get<{ data: { date: string; value: number }[] }>(
        `${API_BASE_URL}/analytics/product-trends`,
        { params: this.params({ ...query, itemId }) },
      )
      .pipe(map((r) => r.data));
  }
  export(query: AnalyticsFilters, section: string) {
    return this.http.get(`${API_BASE_URL}/analytics/export.csv`, {
      params: this.params({ ...query, section }),
      responseType: 'blob',
    });
  }
}
