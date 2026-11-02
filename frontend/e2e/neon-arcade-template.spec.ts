import { expect, test } from '@playwright/test';

test.setTimeout(90_000);

test('neon arcade preserves branding, responsive geometry, gallery and ordering controls', async ({ page }, info) => {
  let enabled = true;
  let colors = { primary: '#8B1528', secondary: '#C38359', accent: '#F56A15', background: '#FCF4E9', surface: '#FFF9F1', textPrimary: '#40131F', textSecondary: '#75646C' };
  const description = '  Apresentação da casa.\n\n    Segundo parágrafo.  ';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.route('**/api/v1/public/menu/neon-arcade-test', route => route.fulfill({ json: { success: true, data: {
    business: { name: 'Pingo Chef', slug: 'neon-arcade-test', logoUrl: '/logo_img.webp', welcomeBgType: 'color', socialLinks: [{ platform: 'instagram', url: 'https://www.instagram.com/pingochef/' }] },
    design: { templateKey: 'neon-arcade', fontHeading: 'Oswald', fontBody: 'Inter', categoryStyle: 'icon_name',
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
  await page.route('**/api/v1/public/menu/neon-arcade-test/**', route => route.fulfill({ status: 202, json: { success: true } }));
  await page.route('**/api/v1/public/menus/**/playback', route => {
    playbackRequests++;
    return route.fulfill({ status: 503, json: { success: false } });
  });
  const open = async () => {
    await page.goto('/m/neon-arcade-test');
    await page.getByRole('button', { name: 'Ver o Cardápio', exact: true }).click();
    await expect(page.locator('.menu-viewport')).toHaveAttribute('data-template', 'neon-arcade');
    if (enabled) await expect(page.locator('.hero-carousel-slide.active img')).toHaveClass(/menu-image-ready/);
  };
  await open();
  await expect(page.locator('.promo-item-card')).toHaveCSS('border-radius', '0px');
  await expect(page.locator('.ranking-item-row')).toHaveCSS('border-radius', '0px');
  await page.screenshot({ path: info.outputPath('neon-arcade-home.png') });
  expect(await page.locator('.intro-card-desc').textContent()).toBe(description);
  await expect(page.locator('.category-nav-pill').first()).toHaveCSS('font-family', /Inter/);
  const geometry = await page.locator('.showcase-scrollable').evaluate(element => {
    const logo = element.querySelector('.template-logo-wrap')!.getBoundingClientRect();
    const hero = element.querySelector('.showcase-hero-banner')!.getBoundingClientRect();
    const name = element.querySelector('.template-brand-copy')!.getBoundingClientRect();
    return { left: logo.right <= name.left + 1, above: logo.bottom <= hero.top,
      center: Math.abs(logo.y + logo.height / 2 - name.y - name.height / 2) };
  });
  expect(geometry.left).toBe(true); expect(geometry.above).toBe(true); expect(geometry.center).toBeLessThan(1);
  const headerGap = await page.locator('.template-brand-copy').evaluate(element => {
    const logo = element.closest('.template-brand-header')!.querySelector('.template-logo-wrap')!.getBoundingClientRect();
    const menu = document.querySelector('app-social-menu button')!.getBoundingClientRect();
    const controls = document.querySelector('.floating-controls-capsule')!.getBoundingClientRect();
    return { socialClear: menu.bottom <= logo.top, controlsClear: element.getBoundingClientRect().right <= controls.left };
  });
  expect(headerGap.socialClear).toBe(true); expect(headerGap.controlsClear).toBe(true);
  const heroGeometry = await page.locator('.hero-carousel-track').evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const hero = element.closest('.showcase-hero-banner')!;
    const frame = hero.getBoundingClientRect(), style = getComputedStyle(hero);
    return {
      ratio: (frame.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) /
        (frame.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)),
      inset: Math.max(Math.abs(bounds.left - frame.left), Math.abs(bounds.top - frame.top),
        Math.abs(bounds.right - frame.right), Math.abs(bounds.bottom - frame.bottom))
    };
  });
  expect(heroGeometry.ratio).toBeCloseTo(16 / 9, 2);
  expect(heroGeometry.inset).toBeLessThan(1);
  await page.getByRole('button', { name: 'Banner 2', exact: true }).click();
  await expect(page.locator('.hero-carousel-slide.active img')).toHaveAttribute('src', /pingo-chef-animation/);
  await expect(page.locator('.hero-carousel-slide.active img')).toHaveClass(/menu-image-ready/);
  await page.locator('.hero-carousel-slide.active img').evaluate(image => (image as HTMLImageElement).decode());
  await page.screenshot({ path: info.outputPath('neon-arcade-home.png') });
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
    expect(bounds.overflow).toBeLessThanOrEqual(1); expect(bounds.ratio).toBeCloseTo(1, 2);
    expect(bounds.inside).toBe(true); expect(bounds.height).toBeLessThan(150);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.btn-view-item').hover();
  await expect(page.locator('.btn-view-item')).toHaveCSS('border-radius', '0px');
  await page.screenshot({ path: info.outputPath('neon-arcade-catalog.png') });
  await page.locator('.btn-view-item').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: /Reproduzir vídeo de/ })).toBeVisible();
  expect(playbackRequests).toBe(0);
  await page.getByRole('tab', { name: 'Foto 2', exact: true }).click();
  await expect(page.locator('.media-image')).toBeVisible();
  await page.getByRole('tab', { name: 'Vídeo 1', exact: true }).click();
  await expect(page.getByRole('button', { name: /Reproduzir vídeo de/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Foto 2', exact: true }).click();
  await page.screenshot({ path: info.outputPath('neon-arcade-detail.png') });
  await page.locator('.btn-sheet-add-cart').click();
  await page.locator('.cart-capsule-btn').click();
  await expect(page.locator('.cart-drawer-sheet')).toContainText('Bacon Supreme Burger');
  await page.locator('.drawer-close-btn').click();
  colors = { primary: '#E71B72', secondary: '#7E6BBC', accent: '#FF9820', background: '#10071C', surface: '#170C28', textPrimary: '#FFF2FC', textSecondary: '#CDC1DC' };
  await open(); await page.screenshot({ path: info.outputPath('neon-arcade-dark.png') });
  await expect(page.locator('.template-brand-copy h2')).toHaveCSS('font-family', /Oswald/);
  await page.getByRole('button', { name: 'Buscar prato ou bebida', exact: true }).click();
  expect(await page.locator('.search-input').evaluate(element => {
    const input = element.getBoundingClientRect();
    const social = document.querySelector('app-social-menu button')!.getBoundingClientRect();
    const controls = document.querySelector('.floating-controls-capsule')!.getBoundingClientRect();
    return input.top >= Math.max(social.bottom, controls.bottom);
  })).toBe(true);
  await page.getByRole('textbox', { name: 'Buscar produtos', exact: true }).fill('Bacon');
  await expect(page.locator('.product-item-card')).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('neon-arcade-dark-catalog.png') });
  enabled = false; await open();
  await expect(page.locator('.showcase-hero-banner, .template-brand-header, .cart-capsule-btn')).toHaveCount(0);
  await expect(page.locator('.no-hero-header')).toBeVisible();
});
