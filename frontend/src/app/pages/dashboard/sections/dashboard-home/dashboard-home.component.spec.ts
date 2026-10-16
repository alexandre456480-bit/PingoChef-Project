import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DashboardHomeComponent } from './dashboard-home.component';
import { AuthService } from '../../../../services/auth.service';
import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CommercialService } from '../../../../services/commercial.service';
import { AnalyticsService } from '../../../../services/analytics.service';

describe('DashboardHomeComponent', () => {
  const business = signal<any>(null);
  const account = signal<any>(null);
  const items = signal<MenuItem[]>([]);
  const categories = signal<any[]>([]);
  const analyticsEnabled = signal(false);
  const report = vi.fn();
  let home: DashboardHomeComponent;
  const item = (id: string, extras: Partial<MenuItem> = {}): MenuItem => ({
    id,
    categoryId: 'category',
    name: id,
    price: 12,
    isAvailable: true,
    isHighlighted: false,
    ...extras,
  });

  beforeEach(() => {
    business.set(null);
    account.set({});
    items.set([]);
    categories.set([]);
    analyticsEnabled.set(false);
    report.mockReset();
    report.mockReturnValue(of({}));
    TestBed.configureTestingModule({
      imports: [DashboardHomeComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentBusiness: business, account } },
        { provide: MenuService, useValue: { items, categories } },
        { provide: CommercialService, useValue: { analytics: analyticsEnabled, qr: () => false } },
        { provide: AnalyticsService, useValue: { report } },
      ],
    });
    home = TestBed.createComponent(DashboardHomeComponent).componentInstance;
  });

  it('handles a new account without dividing by zero or inventing a public link', () => {
    expect(home.healthScore()).toBe(0);
    expect(home.publicLink()).toBeNull();
    expect(home.healthChecks()[0].value).toBe('Sem produtos');
    expect(home.nextAction().route).toBe('empresa');
    home.ngOnInit();
    expect(report).not.toHaveBeenCalled();
  });

  it('calculates proportional coverage and reacts to existing menu signals', () => {
    business.set({ name: 'Bistrô', slug: 'bistro', logo_url: '/logo.webp' });
    account.set({ isPublished: true, onboarding: { designConfigured: true } });
    categories.set([{ id: 'category' }]);
    items.set([
      item('one', { imageUrl: '/one.webp', description: 'Completo' }),
      item('two', { description: 'Completo' }),
    ]);
    expect(home.completedSteps()).toBe(6);
    expect(home.healthScore()).toBe(94); // (6 + 1/2 + 2/2) / 8
    expect(home.nextAction().title).toBe('1 produto ainda está sem foto.');
    items.update((rows) => rows.map((row) => ({ ...row, imageUrl: '/photo.webp' })));
    expect(home.healthScore()).toBe(100);
    expect(home.nextAction().route).toBe('menu');
  });

  it('does not penalize a complete menu for having no optional videos', () => {
    business.set({ name: 'Bistrô', slug: 'bistro', logo_url: '/logo.webp' });
    account.set({ isPublished: true, onboarding: { designConfigured: true } });
    categories.set([{ id: 'category' }]);
    items.set([item('one', { imageUrl: '/one.webp', description: 'Completo' })]);
    expect(home.videoProductCount()).toBe(0);
    expect(home.healthScore()).toBe(100);
    expect(home.visibleSteps()).toHaveLength(0);
    home.expandedSteps.set(true);
    expect(home.visibleSteps()).toHaveLength(6);
  });

  it('prioritizes company, category, product, images, descriptions and publication', () => {
    expect(home.nextAction().route).toBe('empresa');
    business.set({ name: 'Bistrô', slug: 'bistro', logo_url: '/logo.webp' });
    expect(home.nextAction().cta).toBe('Criar categoria');
    categories.set([{ id: 'category' }]);
    expect(home.nextAction().cta).toBe('Criar produto');
    items.set([item('one')]);
    expect(home.nextAction().cta).toBe('Corrigir agora');
    items.set([item('one', { imageUrl: '/one.webp' })]);
    expect(home.nextAction().cta).toBe('Completar descrições');
    items.set([item('one', { imageUrl: '/one.webp', description: 'Completo' })]);
    expect(home.nextAction().route).toBe('preview');
  });

  it('uses visitors when the existing API does not expose QR traffic', () => {
    home.report.set({ summary: { menuViews: 12, visitors: 7, videoPlays: 3 } } as any);
    expect(home.performanceMetrics().map((metric) => metric.value)).toEqual([12, 7, 3]);
    expect(home.performanceMetrics()[1].label).toBe('Visitantes');
    home.report.set({
      summary: { menuViews: 12, visitors: 7, qrEntries: 0, videoPlays: 3 },
    } as any);
    expect(home.performanceMetrics()[1].label).toBe('Acessos via QR');
    expect(home.performanceMetrics()[1].value).toBe(0);
  });

  it('does not turn an analytics failure into fake zero metrics and allows retry', () => {
    analyticsEnabled.set(true);
    report.mockReturnValue(throwError(() => new Error('offline')));
    home.loadPerformance();
    expect(home.performanceError()).toContain('Não foi possível');
    expect(home.report()).toBeNull();
    expect(home.performanceLoading()).toBe(false);
    report.mockReturnValue(of({ summary: { menuViews: 0, visitors: 0, videoPlays: 0 } }));
    home.loadPerformance();
    expect(home.performanceError()).toBe('');
    expect(report).toHaveBeenCalledTimes(2);
  });
});
