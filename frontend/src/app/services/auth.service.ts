import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  businessName: string;
  slug: string;
  phone?: string;
}

export interface ActivateRequest {
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/v1/auth';
  private businessApiUrl = 'http://localhost:3000/api/v1/business';

  // Signals do Angular para Estado Reativo do Usuário
  currentUser = signal<any>(null);
  currentBusiness = signal<any>(null);

  constructor(private http: HttpClient) {
    this.loadSessionFromStorage();
  }

  register(data: RegisterRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, data);
  }

  activate(data: ActivateRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/activate`, data);
  }

  login(data: LoginRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, data).pipe(
      tap((res: any) => {
        if (res.success && res.data.accessToken) {
          localStorage.setItem('access_token', res.data.accessToken);
          localStorage.setItem('user_data', JSON.stringify(res.data.user));
          if (res.data.business) {
            localStorage.setItem('business_data', JSON.stringify(res.data.business));
            this.currentBusiness.set(res.data.business);
          }
          this.currentUser.set(res.data.user);
        }
      })
    );
  }

  private getAuthHeaders(): { headers: HttpHeaders } {
    const token = localStorage.getItem('access_token') || '';
    return {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      })
    };
  }

  getBusiness(): Observable<any> {
    return this.http.get(`${this.businessApiUrl}`, this.getAuthHeaders()).pipe(
      tap((res: any) => {
        if (res.success && res.data) {
          localStorage.setItem('business_data', JSON.stringify(res.data));
          this.currentBusiness.set(res.data);
        }
      })
    );
  }

  updateBusiness(data: any): Observable<any> {
    return this.http.put(`${this.businessApiUrl}`, data, this.getAuthHeaders()).pipe(
      tap((res: any) => {
        if (res.success && res.data) {
          localStorage.setItem('business_data', JSON.stringify(res.data));
          this.currentBusiness.set(res.data);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('business_data');
    this.currentUser.set(null);
    this.currentBusiness.set(null);
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token');
  }

  private loadSessionFromStorage(): void {
    try {
      const userStr = localStorage.getItem('user_data');
      const bizStr = localStorage.getItem('business_data');
      if (userStr && userStr !== 'undefined' && userStr !== 'null') {
        this.currentUser.set(JSON.parse(userStr));
      }
      if (bizStr && bizStr !== 'undefined' && bizStr !== 'null') {
        this.currentBusiness.set(JSON.parse(bizStr));
      }
    } catch (e) {
      console.error('Erro ao ler sessão do localStorage:', e);
      localStorage.removeItem('user_data');
      localStorage.removeItem('business_data');
    }
  }
}
