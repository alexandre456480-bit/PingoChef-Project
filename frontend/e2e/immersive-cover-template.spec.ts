import { expect, test } from '@playwright/test';

test.setTimeout(90_000);

test('immersive cover preserves branding, responsive geometry, gallery and ordering controls', async ({ page }, info) => {
  let enabled = true;
  let colors = { primary: '#8B1528', secondary: '#C38359', accent: '#F56A15', background: '#FCF4E9', surface: '#FFF9F1', textPrimary: '#40131F', textSecondary: '#75646C' };
  const description = '  Apresentação da casa.\n\n    Segundo parágrafo.  ';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.route('**/api/v1/public/menu/immersive-cover-test', route => route.fulfill({ json: { success: true, data: {
    business: { name: 'Pingo Chef', slug: 'immersive-cover-test', logoUrl: '/logo_img.webp', welcomeBgType: 'color' },
    design: { templateKey: 'immersive-cover', fontHeading: 'Oswald', fontBody: 'Inter', categoryStyle: 'icon_name',
      palette: { key: 'custom', colors }, heroBanners: ['/logo_img.webp', '/assets/mascots/home/pingo-chef-animation-menu.webp'],
      homeBlocks: [{ id: 'hero', type: 'hero', enabled, position: 0 }, { id: 'categories', type: 'categories', enabled: true, position: 1 },
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
  await page.route('**/api/v1/public/menu/immersive-cover-test/**', route => route.fulfill({ status: 202, json: { success: true } }));
  await page.route('**/api/v1/public/menus/**/playback', route => {
    playbackRequests++;
    return route.fulfill({ status: 503, json: { success: false } });
  });
  const open = async () => {
    await page.goto('/m/immersive-cover-test');
    await page.getByRole('button', { name: 'Ver o Cardápio', exact: true }).click();
    await expect(page.locator('.menu-viewport')).toHaveAttribute('data-template', 'immersive-cover');
    if (enabled) await expect(page.locator('.hero-carousel-slide.active img')).toHaveClass(/menu-image-ready/);
  };
  await open();
  await expect(page.locator('.promo-item-card')).toHaveCSS('border-radius', '16px');
  await expect(page.locator('.ranking-item-row')).toHaveCSS('border-radius', '16px');
  await page.screenshot({ path: info.outputPath('immersive-cover-home.png') });
  expect(await page.locator('.intro-card-desc').textContent()).toBe(description);
  await expect(page.locator('.category-nav-pill').first()).toHaveCSS('font-family', /Inter/);
  const geometry = await page.locator('.showcase-scrollable').evaluate(element => {
    const logo = element.querySelector('.template-logo-wrap')!.getBoundingClientRect();
    const hero = element.querySelector('.showcase-hero-banner')!.getBoundingClientRect();
    const viewport = element.closest('.menu-viewport')!.getBoundingClientRect();
    return { center: Math.abs(logo.x + logo.width / 2 - viewport.x - viewport.width / 2), inside: logo.top >= hero.top && logo.bottom <= hero.bottom };
  });
  expect(geometry.center).toBeLessThan(1); expect(geometry.inside).toBe(true);
  const heroImageRatio = await page.locator('.hero-carousel-track').evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.width / bounds.height;
  });
  expect(heroImageRatio).toBeCloseTo(1, 2);
  await page.getByRole('button', { name: 'Banner 2', exact: true }).click();
  await expect(page.locator('.hero-carousel-slide.active img')).toHaveAttribute('src', /pingo-chef-animation/);
  await expect(page.locator('.hero-carousel-slide.active img')).toHaveClass(/menu-image-ready/);
  await page.locator('.hero-carousel-slide.active img').evaluate(image => (image as HTMLImageElement).decode());
  await page.screenshot({ path: info.outputPath('immersive-cover-home.png') });
  await page.getByRole('button', { name: 'Hambúrgueres Artesanais', exact: true }).click();
  const group = page.locator('.subcategory-header-collapsible');
  await group.click(); await expect(group).toHaveAttribute('aria-expanded', 'false'); await group.click();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const bounds = await page.locator('.product-item-card').evaluate(element => {
      const card = element.getBoundingClientRect(), photo = element.querySelector('.product-card-photo')!.getBoundingClientRect();
      const button = element.querySelector('.btn-view-item')!.getBoundingClientRect();
      return { overflow: element.scrollWidth - element.clientWidth, ratio: photo.width / photo.height,
        inside: button.right <= card.right && button.bottom <= card.bottom, height: card.height };
    });
    expect(bounds.overflow).toBeLessThanOrEqual(1); expect(bounds.ratio).toBeCloseTo(16 / 9, 2);
    expect(bounds.inside).toBe(true); expect(bounds.height).toBeLessThan(450);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.btn-view-item').hover();
  await expect(page.locator('.btn-view-item')).toHaveCSS('border-radius', '12px');
  await page.screenshot({ path: info.outputPath('immersive-cover-catalog.png') });
  await page.locator('.btn-view-item').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: /Reproduzir vídeo de/ })).toBeVisible();
  expect(playbackRequests).toBe(0);
  await page.getByRole('tab', { name: 'Foto 2', exact: true }).click();
  await expect(page.locator('.media-image')).toBeVisible();
  await page.getByRole('tab', { name: 'Vídeo 1', exact: true }).click();
  await expect(page.getByRole('button', { name: /Reproduzir vídeo de/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Foto 2', exact: true }).click();
  await page.screenshot({ path: info.outputPath('immersive-cover-detail.png') });
  await page.locator('.btn-sheet-add-cart').click();
  await page.locator('.cart-capsule-btn').click();
  await expect(page.locator('.cart-drawer-sheet')).toContainText('Bacon Supreme Burger');
  await page.locator('.drawer-close-btn').click();
  colors = { ...colors, primary: '#B3667B', background: '#160E18', surface: '#2B1D2C', textPrimary: '#FFF3E3', textSecondary: '#CEBACB' };
  await open(); await page.screenshot({ path: info.outputPath('immersive-cover-dark.png') });
  await expect(page.locator('.template-brand-copy h2')).toHaveCSS('font-family', /Oswald/);
  await page.getByRole('button', { name: 'Buscar prato ou bebida', exact: true }).click();
  await page.getByRole('textbox', { name: 'Buscar produtos', exact: true }).fill('Bacon');
  await expect(page.locator('.product-item-card')).toHaveCount(1);
  enabled = false; await open();
  await expect(page.locator('.showcase-hero-banner, .template-brand-header, .cart-capsule-btn')).toHaveCount(0);
  await expect(page.locator('.no-hero-header')).toBeVisible();
});
