import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PublicAnalyticsService } from './public-analytics.service';

describe('PublicAnalyticsService', () => {
  let tracker: PublicAnalyticsService, http: HttpTestingController;
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({}));
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    tracker = TestBed.inject(PublicAnalyticsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    tracker.endPage();
    http.verify();
    vi.unstubAllGlobals();
  });
  it('deduplicates page/resource/play events, carries no PII or credentials, and preserves session across reloads', () => {
    const itemId = crypto.randomUUID(),
      playId = crypto.randomUUID(),
      mediaId = crypto.randomUUID();
    tracker.startPage('bistro');
    tracker.record('bistro', 'MENU_VIEW');
    tracker.record('bistro', 'PRODUCT_VIEW', { itemId });
    tracker.record('bistro', 'PRODUCT_VIEW', { itemId });
    tracker.record('preview', 'PRODUCT_VIEW', { itemId });
    tracker.record('bistro', 'VIDEO_PLAY', { itemId, mediaId, playId });
    tracker.record('bistro', 'VIDEO_PLAY', { itemId, mediaId, playId });
    tracker.flush();
    const request = http.expectOne('/api/v1/public/menu/bistro/events');
    expect(request.request.withCredentials).toBe(false);
    expect(request.request.credentials).toBe('omit');
    expect(request.request.headers.has('Authorization')).toBe(false);
    const first = request.request.body;
    expect(first.events.map((e: any) => e.eventName)).toEqual([
      'MENU_VIEW',
      'PRODUCT_VIEW',
      'VIDEO_PLAY',
    ]);
    expect(Object.keys(first).sort()).toEqual(['events', 'pageId', 'source', 'visitorId']);
    request.flush({ data: { accepted: 3 } });
    tracker.startPage('bistro');
    tracker.flush();
    const second = http.expectOne('/api/v1/public/menu/bistro/events');
    expect(second.request.body.visitorId).toBe(first.visitorId);
    expect(second.request.body.pageId).not.toBe(first.pageId);
    second.flush({});
  });
  it('allows declared QR traffic without generator and buckets referrers without sending URLs', () => {
    const qr = crypto.randomUUID();
    tracker.startPage('bistro', { qr }, 'https://private.example/path?email=test');
    tracker.flush();
    const req = http.expectOne('/api/v1/public/menu/bistro/events');
    expect(req.request.body.qrId).toBe(qr);
    expect(req.request.body.source).toBe('qr');
    expect(req.request.body.events.map((e: any) => e.eventName)).toEqual(['MENU_VIEW', 'QR_ENTRY']);
    expect(JSON.stringify(req.request.body)).not.toContain('private.example');
    req.flush({});
  });
  it('retries network/5xx once with identical IDs, and stops sending after rate denial', () => {
    tracker.startPage('bistro');
    tracker.flush();
    const a = http.expectOne('/api/v1/public/menu/bistro/events');
    const body = a.request.body;
    a.flush({}, { status: 503, statusText: 'Unavailable' });
    const b = http.expectOne('/api/v1/public/menu/bistro/events');
    expect(b.request.body).toEqual(body);
    b.flush({}, { status: 429, statusText: 'Rate Limited' });
    tracker.record('bistro', 'CATEGORY_VIEW', { categoryId: crypto.randomUUID() });
    tracker.flush();
    http.expectNone('/api/v1/public/menu/bistro/events');
  });
  it('honors browser privacy preferences', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
    try {
      tracker.startPage('bistro');
      tracker.flush();
      http.expectNone('/api/v1/public/menu/bistro/events');
    } finally {
      delete (navigator as any).globalPrivacyControl;
    }
  });
});
