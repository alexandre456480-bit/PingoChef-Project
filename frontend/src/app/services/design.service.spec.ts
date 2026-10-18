import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AVAILABLE_PALETTES, contrastTextColor, DesignService, resolveMenuTemplate } from './design.service';

describe('Design settings persistence', () => {
  let service: DesignService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DesignService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DesignService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('saves independent home icons, round-trips no icon and restores defaults without changing unrelated design', () => {
    const config = { home_icons: { home: '3d-bistro', most_liked: null }, enable_cart: false };
    service.loadDesign().subscribe();
    http.expectOne('/api/v1/design').flush({ success: true, data: { custom_config: config } });
    const originalBlocks = service.draft().homeBlocks;
    service.setHomeIcon('home', '2d-star');
    service.setHomeIcon('featured_product', null);
    expect(config.home_icons.home).toBe('3d-bistro');
    expect(service.hasUnsavedChanges()).toBe(true);
    service.saveDesign().subscribe();
    const write = http.expectOne('/api/v1/design');
    expect(write.request.body.custom_config).toMatchObject({ enable_cart: false,
      home_icons: { home: '2d-star', most_liked: null, featured_product: null } });
    write.flush({ success: true });
    service.setHomeIcon('home', undefined);
    expect(service.homeIcon('home')).toBeUndefined();
    expect(service.homeIcon('most_liked')).toBeNull();
    expect(service.draft().homeBlocks).toBe(originalBlocks);
    service.resetDraft();
    expect(service.homeIcon('home')).toBe('2d-star');
    expect(service.homeIcon('featured_product')).toBeNull();
    expect(service.hasUnsavedChanges()).toBe(false);
    service.loadDesign().subscribe();
    http.expectOne('/api/v1/design').flush({ success: true, data: write.request.body });
    expect(service.homeIcon('home')).toBe('2d-star');
    expect(service.homeIcon('most_liked')).toBeNull();
  });

  it('round-trips a new palette and font pair, preserving unrelated settings and ignoring legacy motion', () => {
    const palette = AVAILABLE_PALETTES.find(p => p.key === 'graphite_copper')!;
    service.loadDesign().subscribe();
    http.expectOne('/api/v1/design').flush({ success: true, data: {
      palette, font_heading: 'Oswald', font_body: 'Source Sans 3', font_pair: 'bold_street', motion: 'none',
      custom_config: { enable_cart: false, hero_banners: ['https://example.test/banner.webp'], intro_card: { enabled: true, title: 'Boas-vindas', description: 'Da nossa cozinha.' } }
    } });
    expect(service.hasUnsavedChanges()).toBe(false);
    expect(service.draft()).not.toHaveProperty('motion');
    service.setTemplate('premium');
    service.saveDesign().subscribe();
    const saved = http.expectOne('/api/v1/design');
    expect(saved.request.body).toMatchObject({
      template_key: 'premium', palette, font_heading: 'Oswald', font_body: 'Source Sans 3', font_pair: 'bold_street',
      custom_config: { enable_cart: false, hero_banners: ['https://example.test/banner.webp'], intro_card: { title: 'Boas-vindas' } }
    });
    expect(saved.request.body).not.toHaveProperty('motion');
    saved.flush({ success: true });
    expect(service.hasUnsavedChanges()).toBe(false);
  });

  it('preserves custom colors when loading instead of replacing them with a preset', () => {
    const palette = { ...AVAILABLE_PALETTES[0], key: 'custom', name: 'Personalizada', isCustom: true };
    service.loadDesign().subscribe();
    http.expectOne('/api/v1/design').flush({ success: true, data: { palette } });
    expect(service.draft().palette).toEqual(palette);
  });

  it.each(['brand-cover', 'editorial-arc', 'curve-panels'])('saves and restores %s through the existing API and clears it when switching templates', (variant) => {
    const original = service.draft();
    service.setTemplate(variant);
    expect(service.currentTemplate().key).toBe(variant);
    expect(service.draft()).toMatchObject({
      templateKey: 'showcase', palette: original.palette,
      fontHeading: original.fontHeading, fontBody: original.fontBody,
      homeBlocks: original.homeBlocks, heroBanners: original.heroBanners, introCard: original.introCard
    });
    service.saveDesign().subscribe();
    const saved = http.expectOne('/api/v1/design');
    const payload = saved.request.body;
    expect(payload).toMatchObject({ template_key: 'showcase', custom_config: { template_variant: variant } });
    expect(payload.home_blocks).toContainEqual(expect.objectContaining({ id: variant, type: 'template_variant', enabled: false }));
    expect(resolveMenuTemplate({ templateKey: payload.template_key, homeBlocks: payload.home_blocks, customConfig: {} }).key).toBe(variant);
    saved.flush({ success: true });
    service.loadDesign().subscribe();
    http.expectOne('/api/v1/design').flush({ success: true, data: payload });
    expect(service.currentTemplate().key).toBe(variant);
    expect(service.draft().homeBlocks).toEqual(original.homeBlocks);
    expect(service.hasUnsavedChanges()).toBe(false);
    service.setTemplate('showcase');
    expect(service.currentTemplate().key).toBe('showcase');
    expect(service.draft().customConfig).not.toHaveProperty('template_variant');
  });
});

function luminance(hex: string): number {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
it('new palettes provide readable text and prices on both page and card backgrounds', () => {
  for (const palette of AVAILABLE_PALETTES.slice(7)) {
    const foreground = luminance(contrastTextColor(palette.colors.primary, palette.colors.accent));
    for (const token of ['primary', 'accent'] as const) {
      const background = luminance(palette.colors[token]);
      expect((Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05), `${palette.name}: button text on ${token}`).toBeGreaterThanOrEqual(4.5);
    }
    for (const text of ['textPrimary', 'textSecondary', 'accent'] as const) {
      for (const surface of ['background', 'surface'] as const) {
        const a = luminance(palette.colors[text]), b = luminance(palette.colors[surface]);
        expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), `${palette.name}: ${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});
