import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { CommercialService } from '../../../services/commercial.service';
import { MenuService } from '../../../services/menu.service';
import { TutorialService } from './tutorial.service';
import { fitDialogWidth, placeDialog } from './tutorial-layout';

describe('Dashboard tutorial', () => {
  let service: TutorialService, http: HttpTestingController;
  const permissions = signal({ VIDEO_UPLOAD: true, MAX_VIDEOS: 2 });
  const qr = signal(false), analytics = signal(false);
  const url = '/api/v1/business/tutorial';
  const tick = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
  beforeEach(() => {
    qr.set(false); analytics.set(false);
    TestBed.configureTestingModule({ providers: [TutorialService, provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { account: () => ({ entitlements: permissions() }) } },
      { provide: CommercialService, useValue: { qr, analytics } },
      { provide: MenuService, useValue: { categories: () => [] } },
    ] });
    service = TestBed.inject(TutorialService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  async function start() {
    const started = service.start(); await tick();
    http.expectOne(url).flush({ data: { tutorial_status: 'IN_PROGRESS', tutorial_step: 'welcome' } }); await started;
  }
  it('automatically starts a new profile only after the server confirms it', async () => {
    const pending = service.autoStart();
    http.expectOne(url).flush({ data: { tutorial_status: 'NOT_STARTED', tutorial_step: 'welcome' } });
    await tick();
    expect(service.active()).toBe(false);
    const write = http.expectOne(url); expect(write.request.body.action).toBe('start');
    write.flush({ data: { tutorial_status: 'IN_PROGRESS', tutorial_step: 'welcome' } }); await pending;
    expect(service.active()).toBe(true);
    await service.autoStart(); http.expectNone(url);
  });
  it.each(['COMPLETED', 'SKIPPED'])('does not automatically reopen %s', async status => {
    const pending = service.autoStart(); http.expectOne(url).flush({ data: { tutorial_status: status } }); await pending;
    expect(service.active()).toBe(false); http.expectNone(url);
  });
  it('restores a guide interrupted by refresh', async () => {
    const pending = service.autoStart();
    http.expectOne(url).flush({ data: { tutorial_status: 'IN_PROGRESS', tutorial_step: 'products' } }); await tick();
    http.expectOne(url).flush({ data: { tutorial_status: 'IN_PROGRESS', tutorial_step: 'products' } }); await pending;
    expect(service.step().id).toBe('products'); expect(service.restored()).toBe(true);
  });
  it('moves forward and backward with persisted progress, then skips', async () => {
    await start();
    for (const delta of [1, -1]) {
      const pending = service.move(delta); await tick(); const write = http.expectOne(url);
      write.flush({ data: { tutorial_status: 'IN_PROGRESS', tutorial_step: write.request.body.step } }); await pending;
      expect(service.index()).toBe(delta === 1 ? 1 : 0);
    }
    const pending = service.finish(true); await tick(); const write = http.expectOne(url);
    expect(write.request.body.action).toBe('skip'); write.flush({ data: { tutorial_status: 'SKIPPED' } }); await pending;
    expect(service.active()).toBe(false);
  });
  it('shows only steps granted by account entitlements', async () => {
    qr.set(true); analytics.set(true); await start();
    expect(service.steps().some(s => s.id === 'qr')).toBe(true);
    expect(service.steps().some(s => s.id === 'analytics')).toBe(true);
  });
  it('handles an empty account without assuming products or categories', async () => {
    await start();
    expect(service.steps().some(s => s.id === 'qr')).toBe(false);
    expect(service.steps().some(s => s.id === 'analytics')).toBe(false);
    const sub = service.steps().find(s => s.id === 'subcategories')!;
    expect(typeof sub.target === 'function' ? sub.target(service.context()) : sub.target).toBeUndefined();
  });
  it('keeps the current step when persistence fails and allows retry', async () => {
    await start(); const pending = service.move(1); await tick();
    http.expectOne(url).flush({}, { status: 503, statusText: 'Unavailable' }); await pending;
    expect(service.index()).toBe(0); expect(service.error()).toContain('Tente novamente');
  });
});
describe('Tutorial positioning', () => {
  it('narrows the dialog when a wide Home leaves insufficient room for a 420px card', () => {
    const view = { width: 1280, height: 900 }, target = { left: 265, top: 151, width: 609, height: 384 };
    const width = fitDialogWidth(view, 387, target);
    expect(width).toBe(376);
    const p = placeDialog(view, { width, height: 387 }, target);
    expect(p.left).toBeGreaterThanOrEqual(target.left + target.width + 18);
  });
  it.each([1440, 1280, 1024, 768, 430, 390, 360])('keeps the dialog inside a %spx viewport', width => {
    const size = { width: Math.min(420, width - 24), height: 400 };
    const p = placeDialog({ width, height: 900 }, size, { left: width - 160, top: 15, width: 140, height: 44 });
    expect(p.left).toBeGreaterThanOrEqual(12); expect(p.top).toBeGreaterThanOrEqual(12);
    expect(p.left + size.width).toBeLessThanOrEqual(width - 12); expect(p.top + size.height).toBeLessThanOrEqual(888);
  });
  it('chooses an unobstructed placement at viewport edges', () => {
    const p = placeDialog({ width: 1440, height: 900 }, { width: 420, height: 400 },
      { left: 1200, top: 10, width: 200, height: 44 }, 'top');
    expect(p.top).toBeGreaterThanOrEqual(72);
  });
});
