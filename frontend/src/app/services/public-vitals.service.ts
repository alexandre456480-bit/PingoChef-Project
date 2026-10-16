import { Injectable } from '@angular/core';
import { API_BASE_URL } from '../constants/api';
import type { Metric } from 'web-vitals';

@Injectable({ providedIn: 'root' })
export class PublicVitalsService {
  private active?: { slug: string; templateCode: string };
  private measurements = new Map<string, number>();
  private sent = false;
  private initialized = false;
  async start(slug: string, templateCode: string): Promise<void> {
    if (
      navigator.doNotTrack === '1' ||
      (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl
    )
      return;
    if (!['minimal', 'modern', 'premium', 'dark'].includes(templateCode)) return;
    const navigation = performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined;
    // Buffered document metrics from an earlier admin/login page must never be
    // attributed to a later menu reached through client-side navigation.
    if (navigation && !/^\/(m|c|q)\//.test(new URL(navigation.name).pathname)) return;
    // Document Web Vitals are not invented SPA-navigation metrics. Only the first
    // eligible menu in this document owns them; local stages use performance marks.
    if (this.active || this.initialized) return;
    this.active = { slug, templateCode };
    this.initialized = true;
    try {
      const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import('web-vitals');
      const record = (metric: Metric) => {
        if (this.active && Number.isFinite(metric.value))
          this.measurements.set(metric.name, metric.value);
      };
      onCLS(record);
      onFCP(record);
      onINP(record);
      onLCP(record);
      onTTFB(record);
      const hidden = () => {
        if (document.visibilityState === 'hidden') queueMicrotask(() => this.flush());
      };
      document.addEventListener('visibilitychange', hidden);
      window.addEventListener('pagehide', () => this.flush());
    } catch {
      /* Observability must never block navigation or show an error. */
    }
  }
  private flush(): void {
    if (!this.active || this.sent || !this.measurements.size) return;
    this.sent = true;
    const { slug, templateCode } = this.active;
    const body = JSON.stringify({
      templateCode,
      deviceClass: innerWidth < 768 ? 'mobile' : innerWidth < 1024 ? 'tablet' : 'desktop',
      metrics: [...this.measurements]
        .slice(0, 5)
        .map(([name, value]) => ({ name, value: Math.max(0, Math.min(600_000, value)) })),
    });
    void fetch(`${API_BASE_URL}/public/menu/${encodeURIComponent(slug)}/vitals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      credentials: 'omit',
      keepalive: true,
    }).catch(() => {});
  }
  end(): void {
    this.flush();
    this.active = undefined;
  }
}
