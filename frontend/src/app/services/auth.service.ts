import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, defer, finalize, shareReplay, tap, throwError } from 'rxjs';
import { API_BASE_URL } from '../constants/api';
import { OwnerSessionState } from './owner-session-state.service';

export interface RegisterRequest {
  email: string; password: string; fullName: string; businessName: string; slug: string;
  invitationCode?: string; phone?: string; planCode?: 'FREE' | 'BASIC' | 'MEDIUM' | 'PRO';
  intentId?: string; termsAccepted?: true;
}
export interface LoginRequest { email: string; password: string }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${API_BASE_URL}/auth`;
  private readonly businessApiUrl = `${API_BASE_URL}/business`;
  readonly currentUser;
  readonly currentBusiness;
  readonly account;
  private restoreRequest?: Observable<any>;

  constructor(private readonly http: HttpClient, private readonly state: OwnerSessionState) {
    this.currentUser = state.currentUser; this.currentBusiness = state.currentBusiness; this.account = state.account;
  }
  register(data: RegisterRequest): Observable<any> {
    const { invitationCode, ...body } = data;
    return this.http.post(`${this.apiUrl}/register`, { ...body, ...(invitationCode?.trim() ? { invitationCode: invitationCode.trim() } : {}) });
  }
  login(data: LoginRequest): Observable<any> {
    this.removeLegacyStorage();
    return this.http.post(`${this.apiUrl}/login`, data).pipe(tap((res: any) => this.state.accept(res.data)));
  }
  restore(): Observable<any> {
    if (!this.restoreRequest) {
      this.restoreRequest = defer(() => {
        // Read once for an optional, bounded server-authorized transition. Never store a new token.
        let oldToken: string | null = null;
        try { oldToken = localStorage.getItem('access_token'); } catch { /* Storage may be unavailable. */ }
        this.removeLegacyStorage();
        return this.http.get(`${this.apiUrl}/me`).pipe(catchError(error => {
          if (error.status === 401 && oldToken) return this.http.post(`${this.apiUrl}/migrate-session`, {}, {
            headers: new HttpHeaders({ Authorization: `Bearer ${oldToken}` })
          });
          return throwError(() => error);
        }));
      }).pipe(tap((res: any) => this.state.accept(res.data)), finalize(() => { this.restoreRequest = undefined; }),
        shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.restoreRequest;
  }
  private removeLegacyStorage(): void {
    try {
      for (const name of ['access_token', 'refresh_token', 'user_data', 'business_data']) localStorage.removeItem(name);
    } catch { /* Authentication does not depend on browser storage. */ }
  }
  getBusiness(): Observable<any> {
    return this.http.get(this.businessApiUrl).pipe(tap((res: any) => this.currentBusiness.set(res.data)));
  }
  publishBusinessMenu(): Observable<any> { return this.http.post(`${this.businessApiUrl}/publish`, {}); }
  updateBusiness(data: any): Observable<any> {
    return this.http.put(this.businessApiUrl, data).pipe(tap((res: any) => this.currentBusiness.set(res.data)));
  }
  logout(all = false): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/${all ? 'logout-all' : 'logout'}`, {}).pipe(tap(() => {
      this.state.clear(); this.removeLegacyStorage();
    }));
  }
  isAuthenticated(): boolean { return Boolean(this.currentUser()); }
  forgotPassword(email: string) { return this.http.post(`${this.apiUrl}/forgot-password`, { email }); }
  resendConfirmation(email: string) { return this.http.post(`${this.apiUrl}/resend-confirmation`, { email }); }
  recoverySession() {
    return this.http.get(`${this.apiUrl}/recovery-session`).pipe(tap((res: any) => this.state.csrfToken.set(res.data.csrfToken)));
  }
  resetPassword(password: string) {
    return this.http.post(`${this.apiUrl}/reset-password`, { password }).pipe(tap(() => this.state.clear()));
  }
  changePassword(currentPassword:string,password:string){
    return this.http.post(`${this.apiUrl}/change-password`,{currentPassword,password}).pipe(tap(()=>this.state.clear()));
  }
  deleteAccount(currentPassword:string,confirmBusinessId:string,confirmation:string){
    return this.http.post(`${this.apiUrl}/delete-account`,{currentPassword,confirmBusinessId,confirmation}).pipe(tap(()=>this.state.clear()));
  }
  completeRegistration(data: Omit<RegisterRequest, 'email' | 'password' | 'invitationCode'>) {
    return this.http.post(`${this.apiUrl}/complete-registration`, data).pipe(tap((res: any) => {
      this.currentBusiness.set(res.data.business); this.account.set(res.data);
    }));
  }
}
