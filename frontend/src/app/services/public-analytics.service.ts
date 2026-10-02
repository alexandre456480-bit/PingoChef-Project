import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../constants/api';

export type PublicAnalyticsEvent =
  | 'MENU_VIEW'
  | 'CATEGORY_VIEW'
  | 'PRODUCT_VIEW'
  | 'VIDEO_PLAY'
  | 'VIDEO_25'
  | 'VIDEO_50'
  | 'VIDEO_100'
  | 'QR_ENTRY';
type Source = 'direct' | 'qr' | 'instagram' | 'facebook' | 'google' | 'whatsapp' | 'other';
interface EventData {
  id: string;
  eventName: PublicAnalyticsEvent;
  itemId?: string;
  categoryId?: string;
  mediaId?: string;
  playId?: string;
}
interface Page {
  slug: string;
  visitorId: string;
  pageId: string;
  source: Source;
  qrId?: string;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable({ providedIn: 'root' })
export class PublicAnalyticsService {
  private http = inject(HttpClient);
  private page?: Page;
  private queue: EventData[] = [];
  private seen = new Set<string>();
  private timer?: ReturnType<typeof setTimeout>;
  private ephemeralVisitor?: string;
  private inFlight = false;
  private blockedUntil = 0;
  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.flush(true));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flush(true);
      });
    }
  }
  startPage(
    slug: string,
    params: Record<string, string | null> = {},
    referrer = document.referrer,
  ) {
    this.endPage();
    if (
      navigator.doNotTrack === '1' ||
      (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl
    )
      return;
    let visitorId = this.ephemeralVisitor || crypto.randomUUID();
    try {
      const saved = sessionStorage.getItem('pc_analytics_session');
      if (saved && UUID.test(saved)) visitorId = saved;
      sessionStorage.setItem('pc_analytics_session', visitorId);
    } catch {
      this.ephemeralVisitor = visitorId;
    }
    const source = this.source(params, referrer);
    const qrId =
      source === 'qr' && params['qr'] && UUID.test(params['qr']) ? params['qr'] : undefined;
    this.page = { slug, visitorId, pageId: crypto.randomUUID(), source, ...(qrId ? { qrId } : {}) };
    this.record(slug, 'MENU_VIEW');
    if (source === 'qr') this.record(slug, 'QR_ENTRY');
  }
  private source(params: Record<string, string | null>, referrer: string): Source {
    const declared = (params['source'] || params['utm_source'] || '').toLowerCase();
    if (['direct', 'qr', 'instagram', 'facebook', 'google', 'whatsapp', 'other'].includes(declared))
      return declared as Source;
    if (params['qr']) return 'qr';
    try {
      const hostname = new URL(referrer).hostname.toLowerCase();
      if (hostname === location.hostname) return 'direct';
      if (hostname === 'instagram.com' || hostname.endsWith('.instagram.com')) return 'instagram';
      if (hostname === 'facebook.com' || hostname.endsWith('.facebook.com')) return 'facebook';
      if (/^(www\.)?google\.[a-z.]+$/.test(hostname)) return 'google';
      if (hostname === 'wa.me' || hostname === 'whatsapp.com' || hostname.endsWith('.whatsapp.com'))
        return 'whatsapp';
      return 'other';
    } catch {
      return 'direct';
    }
  }
  record(
    slug: string | null,
    eventName: PublicAnalyticsEvent,
    fields: Omit<EventData, 'id' | 'eventName'> = {},
  ) {
    if (!this.page || slug !== this.page.slug || Date.now() < this.blockedUntil) return;
    const key = [eventName, fields.itemId || fields.categoryId || '', fields.playId || ''].join(
      ':',
    );
    if (this.seen.has(key) || this.seen.size >= 1000) return;
    this.seen.add(key);
    if (this.queue.length >= 100) return;
    this.queue.push({ id: crypto.randomUUID(), eventName, ...fields });
    if (!this.timer) this.timer = setTimeout(() => this.flush(), 700);
  }
  flush(keepalive = false) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.page || !this.queue.length || (this.inFlight && !keepalive)) return;
    const page = this.page,
      events = this.queue.splice(0, 20);
    const url = `${API_BASE_URL}/public/menu/${encodeURIComponent(page.slug)}/events`;
    const { slug: _slug, ...identity } = page;
    const batch = { ...identity, events };
    if (keepalive) {
      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
        keepalive: true,
        credentials: 'omit',
      }).catch(() => {});
      if (this.queue.length) this.flush(true);
      return;
    }
    this.inFlight = true;
    // Retry the same IDs only once for network/5xx failures; never retry a refused or rate-limited batch.
    const send = (retry: boolean) =>
      this.http.post(url, batch, { withCredentials: false, credentials: 'omit' }).subscribe({
        next: () => complete(),
        error: (error) => {
          if (
            retry &&
            (error.status === 0 || error.status >= 500) &&
            this.page?.pageId === page.pageId
          ) {
            send(false);
            return;
          }
          if (error.status === 429) {
            this.blockedUntil = Date.now() + 60_000;
            this.queue = [];
          }
          complete();
        },
      });
    const complete = () => {
      this.inFlight = false;
      if (this.queue.length && this.page && !this.timer)
        this.timer = setTimeout(() => this.flush(), 700);
    };
    send(true);
  }
  endPage() {
    this.flush(true);
    this.page = undefined;
    this.queue = [];
    this.seen.clear();
  }
}
