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
    service.setTemplate('default');
    service.saveDesign().subscribe();
    const saved = http.expectOne('/api/v1/design');
    expect(saved.request.body).toMatchObject({
      template_key: 'default', palette, font_heading: 'Oswald', font_body: 'Source Sans 3', font_pair: 'bold_street',
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

  it.each(['centered-cover', 'arched-cover', 'brand-hero', 'signature-cover'])('round-trips %s without changing customer personalization or features', template => {
    const original = service.draft();
    service.setTemplate(template);
    expect(service.draft()).toEqual({ ...original, templateKey: template });
    service.saveDesign().subscribe();
    const write = http.expectOne('/api/v1/design');
    expect(write.request.body.template_key).toBe(template);
    expect(write.request.body.custom_config).not.toHaveProperty('template_variant');
    write.flush({ success: true });
    service.loadDesign().subscribe();
    http.expectOne('/api/v1/design').flush({ success: true, data: write.request.body });
    expect(service.currentTemplate().key).toBe(template);
    expect(service.draft().palette).toEqual(original.palette);
    expect(service.draft().homeBlocks).toEqual(original.homeBlocks);
    service.setTemplate('default');
    expect(service.currentTemplate().key).toBe('default');
  });

  it.each(['minimal', 'modern', 'premium', 'dark', 'showcase', 'brand-cover', 'editorial-arc', 'curve-panels'])(
    'replaces legacy %s without changing customer content, branding or feature flags', key => {
      const palette = { ...AVAILABLE_PALETTES[0], colors: { ...AVAILABLE_PALETTES[0].colors, primary: '#123456' } };
      const blocks = [{ id: 'hero', type: 'hero', enabled: false, position: 2 }];
      const config = { template_variant: key, home_icons: { home: null, combo: '2d-star' }, enable_cart: false,
        enable_likes: false, hero_scope: 'home_only', category_hero_configs: { drinks: { enabled: false, banners: [] } },
        hero_banners: ['https://example.test/banner.webp'], intro_card: { enabled: true, title: 'Cliente', description: 'Texto original' } };
      service.loadDesign().subscribe();
      http.expectOne('/api/v1/design').flush({ success: true, data: { template_key: key, palette,
        font_heading: 'Oswald', font_body: 'Lora', category_style: 'name',
        home_blocks: [...blocks, { id: key, type: 'template_variant', enabled: false, position: 8 }], custom_config: config } });
      expect(service.currentTemplate().key).toBe('default');
      expect(service.draft().palette).toEqual(palette);
      expect(service.draft().homeBlocks).toContainEqual(blocks[0]);
      expect(service.hasUnsavedChanges()).toBe(false);
      const original = service.draft();
      service.setTemplate('default');
      expect(service.draft()).toEqual(original);
      service.setTemplate(key);
      expect(service.draft()).toEqual(original);
      service.saveDesign().subscribe();
      const write = http.expectOne('/api/v1/design');
      expect(write.request.body).toMatchObject({ template_key: 'default', palette, font_heading: 'Oswald', font_body: 'Lora',
        category_style: 'name', custom_config: { home_icons: config.home_icons, enable_cart: false, enable_likes: false,
          hero_scope: 'home_only', category_hero_configs: config.category_hero_configs, hero_banners: config.hero_banners,
          intro_card: config.intro_card } });
      expect(write.request.body.custom_config).not.toHaveProperty('template_variant');
      expect(write.request.body.home_blocks.some((block: any) => block.type === 'template_variant')).toBe(false);
      write.flush({ success: true });
      expect(resolveMenuTemplate({ templateKey: 'unknown' }).key).toBe('default');
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
