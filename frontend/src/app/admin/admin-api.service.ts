import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, tap, map, catchError, of } from 'rxjs';
import { API_BASE_URL } from '../constants/api';

export interface AdminEnvelope<T> { success: boolean; data: T; pagination?: { page: number; limit: number; total: number } }
export interface AdminFilter { from: string; to: string; timezone: string; granularity: 'hour'|'day'|'week'|'month'|'year'; comparison: 'none'|'previous'|'year'; preset: string }
export interface AdminSeriesPoint { bucket: string; metric: string; value: number }
export interface AdminDashboard {
  filter: AdminFilter & { compareFrom: string|null; compareTo: string|null };
  snapshot: Record<string, number>;
  period: Record<string, number>;
  attention: Record<string, number>;
  funnel: Record<string, number>;
  series: AdminSeriesPoint[];
  templates: { template: string; count: number }[];
  timings: { inviteToSignupSeconds: number|null; signupToPublishSeconds: number|null };
  overview: { events: Record<string, number>; series: {bucket:string;eventName:string;count:number}[] };
}
export interface AdminBusinessRow {
  id: string; name: string; slug: string; email: string;
  lifecycleStatus: string; published: boolean; subscriptionStatus: string|null;
  plan: string|null; createdAt: string; products: number; images: number;
  videos: number; lastActivity: string|null;
}
export interface AdminInvitation {
  id: string; email: string; status: string; effectiveStatus: string;
  expires_at: string; consumed_at: string|null; revoked_at: string|null;
  created_at: string;
}
export interface AdminCommercialReport {
  statuses: Record<string,number>; newSubscriptions:number;cancellations:number;
  planDistribution:{plan:string;count:number}[];graceDays:number;billingEnforced:boolean;
  financial:{mrr:null;recognizedRevenue:null;approvedPayments:null;churn:null;
    arpu:null;delinquentAmount:null;revenueByPlan:null;availability:string};
}
export interface AdminInfrastructureReport {
  mux:{status:Record<string,number>;uploads:number;declaredUploadBytes:number;
    deliveryBytes:null;providerStorageBytes:null};
  storage:{trackedImages:number;newTrackedImages:number;storageBytes:null};
  database:{businesses:number;products:number;media:number;databaseBytes:null};
  api:{requests:number;errors5xx:number;rateLimits:number;averageLatencyMs:number|null;maxLatencyMs:number|null};
  byBusiness:{businessId:string;uploads:number}[];
  byBusinessStorage:{businessId:string;trackedImages:number;newTrackedImages:number}[];
  alerts:{code:string;businessId:string|null;count:number;threshold:number}[];
  measurement:{api:string;mux:string;storageBytes:string;costs:string};
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly base = `${API_BASE_URL}/admin`;
  readonly csrfToken = signal<string|null>(null);
  readonly userId = signal<string|null>(null);

  constructor(private http: HttpClient) {}

  private options(params?: HttpParams) { return { withCredentials: true, params }; }
  private writeOptions() {
    const token = this.csrfToken();
    if (!token) throw new Error('Sessão administrativa indisponível. Entre novamente.');
    return { withCredentials: true, headers: new HttpHeaders({ 'X-CSRF-Token': token }) };
  }
  private params(input: Record<string, string|number|boolean|null|undefined>): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(input)) {
      if (value !== null && value !== undefined && value !== '') params = params.set(key, String(value));
    }
    return params;
  }

  login(email: string, password: string): Observable<void> {
    return this.http.post<AdminEnvelope<{csrfToken:string}>>(`${this.base}/auth/login`,
      { email, password }, { withCredentials: true }).pipe(
      tap(result => this.csrfToken.set(result.data.csrfToken)), map(() => void 0));
  }
  session(): Observable<boolean> {
    return this.http.get<AdminEnvelope<{userId:string;csrfToken:string}>>(`${this.base}/auth/session`,
      this.options()).pipe(
      tap(result => { this.userId.set(result.data.userId); this.csrfToken.set(result.data.csrfToken); }),
      map(() => true),
      catchError(() => { this.csrfToken.set(null); this.userId.set(null); return of(false); })
    );
  }
  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/logout`, {}, this.writeOptions()).pipe(
      tap(() => { this.csrfToken.set(null); this.userId.set(null); }));
  }
  reauthenticate(password: string): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/reauthenticate`, { password }, this.writeOptions());
  }
  dashboard(filter: AdminFilter): Observable<AdminDashboard> {
    const { preset: _preset, ...query } = filter;
    return this.http.get<AdminEnvelope<AdminDashboard>>(`${this.base}/dashboard`,
      this.options(this.params(query))).pipe(map(result => result.data));
  }
  commercial(filter:AdminFilter):Observable<AdminCommercialReport>{
    return this.http.get<AdminEnvelope<AdminCommercialReport>>(`${this.base}/commercial`,
      this.options(this.params({from:filter.from,to:filter.to}))).pipe(map(result=>result.data));
  }
  infrastructure(filter:AdminFilter):Observable<AdminInfrastructureReport>{
    return this.http.get<AdminEnvelope<AdminInfrastructureReport>>(`${this.base}/infrastructure`,
      this.options(this.params({from:filter.from,to:filter.to}))).pipe(map(result=>result.data));
  }
  purgeJobs(page:number){
    return this.http.get<AdminEnvelope<{id:string;business_id:string;phase:string;attempts:number;
      last_error_code:string|null;started_at:string;completed_at:string|null}[]>>(
      `${this.base}/purge-jobs`,this.options(this.params({page})));
  }
  businesses(query: Record<string,string|number|boolean|null|undefined>) {
    return this.http.get<AdminEnvelope<AdminBusinessRow[]>>(`${this.base}/businesses`,
      this.options(this.params(query)));
  }
  business(id: string) {
    return this.http.get<AdminEnvelope<any>>(`${this.base}/businesses/${encodeURIComponent(id)}`,
      this.options()).pipe(map(result => result.data));
  }
  invitations(query: Record<string,string|number|null|undefined>) {
    return this.http.get<AdminEnvelope<AdminInvitation[]>>(`${this.base}/invites`,
      this.options(this.params(query)));
  }
  createInvitation(email: string, expiresInDays: number) {
    return this.http.post<AdminEnvelope<{id:string;email:string;code:string;expiresAt:string}>>(
      `${this.base}/invites`, { email, expiresInDays }, this.writeOptions()).pipe(map(result => result.data));
  }
  revokeInvitation(id: string) {
    return this.http.post<void>(`${this.base}/invites/${encodeURIComponent(id)}/revoke`, {}, this.writeOptions());
  }
  auditLogs(query: Record<string,string|number|null|undefined>) {
    return this.http.get<AdminEnvelope<any[]>>(`${this.base}/audit-logs`,
      this.options(this.params(query)));
  }
  media(query: Record<string,string|number|null|undefined>) {
    return this.http.get<AdminEnvelope<any[]>>(`${this.base}/media`,
      this.options(this.params(query)));
  }
  action(id: string, action: string, body: Record<string,unknown>) {
    return this.http.post<AdminEnvelope<unknown>|void>(
      `${this.base}/businesses/${encodeURIComponent(id)}/${action}`, body, this.writeOptions());
  }
}
