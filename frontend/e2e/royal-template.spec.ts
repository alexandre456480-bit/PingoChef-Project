import { expect, test } from '@playwright/test';

test.setTimeout(90_000);

test('royal palace preserves branding, responsive geometry, gallery and ordering controls', async ({ page }, info) => {
  let enabled = true;
  let categoriesBeforeHero = false;
  let businessName = 'Pingo Chef';
  let businessDescription = '';
  let colors = { primary: '#8B1528', secondary: '#D1AB70', accent: '#F56A15', background: '#FFF5E4', surface: '#FFFCF5', textPrimary: '#4A2618', textSecondary: '#81715F' };
  const description = '  Apresentação da casa.\n\n    Segundo parágrafo.  ';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.route('**/api/v1/public/menu/royal-palace-test', route => route.fulfill({ json: { success: true, data: {
    business: { name: businessName, description: businessDescription, slug: 'royal-palace-test', logoUrl: '/logo_img.webp', welcomeBgType: 'color', socialLinks: [{ platform: 'instagram', url: 'https://www.instagram.com/pingochef/' }] },
    design: { templateKey: 'royal-palace', fontHeading: 'Oswald', fontBody: 'Inter', categoryStyle: 'icon_name',
      palette: { key: 'custom', colors }, heroBanners: ['/logo_img.webp', '/assets/mascots/home/pingo-chef-animation-menu.webp'],
      homeBlocks: [{ id: 'hero', type: 'hero', enabled, position: categoriesBeforeHero ? 1 : 0 }, { id: 'categories', type: 'categories', enabled: true, position: categoriesBeforeHero ? 0 : 1 },
        { id: 'offers', type: 'promotion', enabled: true, position: 2 }, { id: 'ranking', type: 'most_liked', enabled: true, position: 3 }],
      customConfig: { enable_cart: enabled, enable_likes: enabled, home_icons: { home: null }, intro_card: { enabled: true, description } } },
    categories: [{ id: 'burgers', name: 'Hambúrgueres Artesanais', iconType: 'none' }],
    subcategories: [{ id: 'classics', categoryId: 'burgers', name: 'Artesanais Clássicos' }],
    items: [{ id: 'burger', categoryId: 'burgers', subcategoryId: 'classics', name: 'Bacon Supreme Burger',
      description: 'Pão brioche tostado na manteiga, burger 180g, fatias crocantes de bacon e muito cheddar cremoso.',
      price: 34.90, promotionalPrice: 29.90, highlightType: 'promotion', isHighlighted: true, isAvailable: true, likesCount: 54, imageUrl: '/logo_img.webp',
      media: [{ id: 'video', mediaType: 'video', source: 'mux', position: 0, durationSeconds: 10, aspectRatio: '16:9' }] }]
  } } }));
  let playbackRequests = 0;
  await page.route('**/api/v1/public/menu/royal-palace-test/**', route => route.fulfill({ status: 202, json: { success: true } }));
  await page.route('**/api/v1/public/menus/**/playback', route => {
    playbackRequests++;
    return route.fulfill({ status: 503, json: { success: false } });
  });
  const open = async () => {
    await page.goto('/m/royal-palace-test');
    await page.getByRole('button', { name: 'Ver o Cardápio', exact: true }).click();
    await expect(page.locator('.menu-viewport')).toHaveAttribute('data-template', 'royal-palace');
    if (enabled) await expect(page.locator('.hero-carousel-slide.active img')).toHaveClass(/menu-image-ready/);
  };
  await open();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const hero = await page.locator('.hero-carousel-track').evaluate(el => { const b = el.getBoundingClientRect(); return b.width / b.height; });
    expect(hero).toBeCloseTo(4 / 3, 1);
    await page.locator('.category-nav-pill').nth(1).click();
    const card = page.locator('.product-item-card').first();
    await expect(card).toBeVisible();
    const geometry = await card.evaluate(el => {
      const b = el.getBoundingClientRect(), p = el.querySelector('.product-card-photo')!.getBoundingClientRect(), c = el.querySelector('.btn-view-item')!.getBoundingClientRect();
      return { overflow: el.scrollWidth - el.clientWidth, inside: c.right <= b.right && c.bottom <= b.bottom, square: p.width / p.height };
    });
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    expect(geometry.inside).toBe(true);
    expect(geometry.square).toBeCloseTo(1, 1);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath('royal-catalog.png') });
  await page.locator('.btn-view-item').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('tab', { name: 'Foto 2', exact: true }).click();
  await page.screenshot({ path: info.outputPath('royal-detail.png') });
  await page.locator('.btn-sheet-add-cart').click();
  await page.locator('.cart-capsule-btn').click();
  await expect(page.locator('.cart-drawer-sheet')).toContainText('Bacon Supreme Burger');
  colors = { ...colors, primary: '#B3667B', background: '#160E18', surface: '#2B1D2C', textPrimary: '#FFF3E3', textSecondary: '#CEBACB' };
  businessName = 'Hamburgueria Artesanal Sabores do Palacio Real';
  await page.setViewportSize({ width: 320, height: 844 });
  await open();
  expect(await page.locator('.template-brand-header').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('.template-brand-copy h2')).toHaveCSS('font-family', /Oswald/);
  enabled = false;
  await open();
  await expect(page.locator('.showcase-hero-banner')).toHaveCount(0);
  await expect(page.locator('.no-hero-header')).toBeVisible();
});
