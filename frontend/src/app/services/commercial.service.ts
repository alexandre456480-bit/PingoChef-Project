import { Injectable, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { API_BASE_URL } from '../constants/api';
import { AuthService } from './auth.service';

export interface PlanCard {
  code: string;
  name: string;
  priceCents: number;
  products: number;
  categories: number;
  videos: number;
  profile: string;
  features: string[];
  available: boolean;
}
export interface PlanIntent {
  id: string;
  plan: { code: string; name: string };
  expiresAt: string;
}
@Injectable({ providedIn: 'root' })
export class CommercialService {
  readonly seenDemos = new Set<string>();
  readonly analytics = computed(
    () =>
      this.auth.account()?.entitlements?.ANALYTICS_BASIC === true ||
      this.auth.account()?.entitlements?.ANALYTICS_ADVANCED === true,
  );
  readonly qr = computed(() => this.auth.account()?.entitlements?.QR_GENERATOR === true);
  readonly thematicTemplates = computed(() => this.auth.account()?.entitlements?.THEMATIC_TEMPLATES === true);
  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private router: Router,
  ) {}
  plans() {
    return this.http.get<{
      data: { plans: PlanCard[]; pricesProvisional: boolean; billingAvailable: boolean };
    }>(`${API_BASE_URL}/auth/plans`);
  }
  startRegistration(planCode: string) {
    return this.http.post<{ data: PlanIntent }>(`${API_BASE_URL}/auth/plan-intents`, { planCode }).pipe(
      switchMap(({ data }) => this.router.navigate(['/register'], { queryParams: { intent: data.id } })),
    );
  }
  intent(id: string) {
    return this.http.get<{ data: PlanIntent }>(
      `${API_BASE_URL}/auth/plan-intents/${encodeURIComponent(id)}`,
    );
  }
}
