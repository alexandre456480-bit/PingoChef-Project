import { expect, test } from '@playwright/test';

test.setTimeout(120_000);

for (const template of ['default', 'centered-cover', 'arched-cover', 'brand-hero', 'signature-cover', 'pixel']) {
test(`${template} preserves customer branding, optional blocks and catalog interactions`, async ({ page }, info) => {
  let introEnabled = true, heroEnabled = true;
  const description = '  Primeiro  parágrafo.\n\n    Segundo parágrafo.\nTexto <b>literal</b>.  ';
  const brandHero = template === 'brand-hero';
  const signatureCover = template === 'signature-cover';
  const pixel = template === 'pixel';
  const photoCards = brandHero || signatureCover || pixel;
  let cartEnabled = template === 'arched-cover' || photoCards;
  let likesEnabled = photoCards;
  let colors = { primary: '#173E34', secondary: '#849D90', accent: '#BA591B', background: '#F4F8F3', surface: '#FFFFFF', textPrimary: '#183027', textSecondary: '#586A61' };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/\/api\/v1\/public\/menu\/template-default\/(events|vitals)$/, route => route.fulfill({ status: 202, json: { success: true } }));
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/api/v1/public/menu/template-default', route => route.fulfill({ json: { success: true, data: {
    business: { name: 'Cozinha da Casa', description: 'Receitas feitas com cuidado.', slug: 'template-default', logoUrl: '/logo_img.webp', welcomeBgType: 'color' },
    design: {
      templateKey: template, fontHeading: 'Oswald', fontBody: 'Lora', categoryStyle: 'name',
      heroBanners: ['/assets/mascots/home/pingo-chef-animation-menu.webp', '/logo_img.webp'],
      palette: { key: 'custom', isCustom: true, colors },
      homeBlocks: [{ id: 'hero', type: 'hero', enabled: heroEnabled, position: 0 }, { id: 'categories', type: 'categories', enabled: true, position: 1 }],
      categoryHeroConfigs: { drinks: { enabled: false, banners: [] } },
      customConfig: { enable_likes: likesEnabled, enable_cart: cartEnabled, home_icons: { home: null },
        intro_card: { enabled: introEnabled, title: 'Feito na casa', description } }
    },
    categories: [{ id: 'food', name: 'Pratos', iconType: pixel ? 'image' : 'none', imageUrl: pixel ? '/logo_img.webp' : null }, { id: 'drinks', name: 'Bebidas', iconType: 'none' }],
    subcategories: [{ id: 'classics', categoryId: 'food', name: 'Clássicos', displayOrder: 0 }],
    items: [
      { id: 'plate', categoryId: 'food', subcategoryId: 'classics', name: 'Prato artesanal com ingredientes da estação e preparo especial', price: 32.90, promotionalPrice: 29.90, likesCount: 99 },
      { id: 'water', categoryId: 'drinks', name: 'Água mineral', price: 5 }
    ].map(item => ({ ...item, imageUrl: '/logo_img.webp', description: 'Preparado na hora com ingredientes selecionados, molho artesanal e acompanhamentos frescos.', isAvailable: true }))
  } } }));
  await page.route('**/api/v1/public/menu/template-default/like/*', route => route.fulfill({ json: { success: true, data: { itemId: route.request().url().split('/').pop(), likesCount: 100, created: true } } }));
  const open = async () => {
    await page.goto('/m/template-default');
    await page.getByRole('button', { name: 'Ver o Cardápio' }).click();
    await expect(page.locator('.menu-viewport')).toHaveAttribute('data-template', template);
    if (heroEnabled) await expect(page.locator('.hero-carousel-slide.active img')).toHaveClass(/menu-image-ready/);
  };
  await open();
  await expect(page.locator('.category-nav-pill').first()).toHaveCSS('font-family', /Lora/);
  await expect(page.locator('.showcase-hero-banner')).toHaveCount(1);
  await expect(page.locator('.template-logo')).toHaveAttribute('alt', 'Cozinha da Casa');
  expect(await page.locator('.intro-card-desc').textContent()).toBe(description);
  await expect(page.locator('.intro-card-desc')).toHaveCSS('white-space', 'break-spaces');
  await expect(page.locator('.intro-card-desc b')).toHaveCount(0);
  await expect(page.locator('.category-nav-pill app-menu-home-icon')).toHaveCount(0);
  await expect(page.locator('.cart-capsule-btn')).toHaveCount(cartEnabled ? 1 : 0);
  if (cartEnabled) {
    await page.locator('.cart-capsule-btn').click();
    await expect(page.locator('.cart-drawer-sheet')).toBeVisible();
    await page.locator('.drawer-close-btn').click();
    await expect(page.locator('.cart-drawer-sheet')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Banner 2', exact: true }).click();
  await expect(page.locator('.hero-carousel-slide.active img')).toHaveAttribute('src', /logo_img/);
  await expect(page.locator('.hero-carousel-slide.active img')).toHaveClass(/menu-image-ready/);
  const geometry = await page.locator('.showcase-scrollable').evaluate(element => {
    const cover = element.querySelector('.showcase-hero-banner')!.getBoundingClientRect();
    const logo = element.querySelector('.template-logo-wrap')!.getBoundingClientRect();
    const intro = element.querySelector('.intro-description-wrapper')!.getBoundingClientRect();
    const name = element.querySelector('.template-brand-copy h2')!.getBoundingClientRect();
    const viewport = element.closest('.menu-viewport')!.getBoundingClientRect();
    return { logoInside: logo.left >= cover.left && logo.top >= cover.top && logo.bottom <= cover.bottom,
      nameBelow: name.top >= logo.bottom && name.bottom <= cover.bottom, edge: Math.abs(cover.left - viewport.left) + Math.abs(cover.right - viewport.right),
      center: Math.abs(logo.left + logo.width / 2 - viewport.left - viewport.width / 2),
      ratio: cover.width / cover.height, cover: cover.height, overlap: cover.bottom - logo.top, below: logo.bottom - cover.bottom,
      intro: intro.top - logo.bottom, introAbove: cover.top - intro.bottom };
  });
  expect(geometry.cover).toBeGreaterThan(100);
  expect(geometry.overlap).toBeGreaterThan(0);
  if (brandHero) {
    expect(geometry.logoInside).toBe(true); expect(geometry.nameBelow).toBe(true);
    expect(geometry.introAbove).toBeGreaterThanOrEqual(0);
    expect(geometry.edge).toBeGreaterThan(0);
    await expect(page.locator('.showcase-hero-banner .floating-controls-capsule')).toHaveCount(1);
  } else if (!signatureCover && !pixel) expect(geometry.below).toBeGreaterThan(0);
  if (template !== 'centered-cover' && !brandHero) expect(geometry.intro).toBeGreaterThanOrEqual(0);
  if (template !== 'default') {
    if (template === 'centered-cover') expect(geometry.introAbove).toBeGreaterThanOrEqual(0);
    const controls = await page.locator('.floating-controls-capsule').evaluate(element => ({
      width: element.getBoundingClientRect().width,
      viewportWidth: element.closest('.menu-viewport')!.getBoundingClientRect().width
    }));
    expect(controls.width).toBeLessThan(controls.viewportWidth / 2);
    if (!brandHero && !signatureCover && !pixel) {
      expect(geometry.edge).toBeLessThan(1); expect(geometry.center).toBeLessThan(1);
      expect(geometry.ratio).toBeCloseTo(template === 'arched-cover' ? 1.95 : 2.55, 1);
    }
    await expect(page.locator('.intro-description-wrapper')).toHaveCSS('text-align', 'center');
    if (template === 'arched-cover') {
      await expect(page.locator('.showcase-hero-banner')).toHaveCSS('border-bottom-left-radius', '50% 20%');
      await expect(page.locator('.category-nav-pill').first()).toHaveCSS('border-radius', '999px');
    }
  }
  if (signatureCover) {
    expect(geometry.center).toBeLessThan(1);
    expect(geometry.edge).toBeLessThan(1);
    expect(geometry.ratio).toBeCloseTo(1.7, 1);
    await expect(page.locator('.template-brand-header')).toHaveCSS('flex-direction', 'column');
    await expect(page.locator('.template-brand-header')).toHaveCSS('align-items', 'center');
    await expect(page.locator('.showcase-hero-banner')).toHaveCSS('mask-image', /radial-gradient/);
    for (const side of ['::before', '::after']) {
      expect(await page.locator('.template-brand-copy h2').evaluate((element, pseudo) => getComputedStyle(element, pseudo).content, side)).toBe('""');
    }
  }
  if (pixel) {
    expect(geometry.edge).toBeLessThan(1); expect(geometry.center).toBeLessThan(1);
    expect(await page.locator('.hero-banner-overlay').evaluate(element =>
      ['::before', '::after'].every(pseudo => ['none', 'normal'].includes(getComputedStyle(element, pseudo).content)))).toBe(true);
    await expect(page.locator('.showcase-hero-banner')).toHaveCSS('clip-path', /polygon/);
    await expect(page.locator('.floating-controls-capsule .capsule-btn')).toHaveCount(2);
    await expect(page.locator('.category-nav-pill .cat-pill-img')).toHaveCount(1);
    await expect(page.locator('.capsule-btn').first()).toHaveCSS('border-radius', '0px');
  }
  await page.getByRole('button', { name: 'Buscar prato ou bebida', exact: true }).click();
  await page.getByRole('textbox', { name: 'Buscar produtos', exact: true }).fill('mineral');
  await expect(page.locator('.product-item-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Buscar prato ou bebida', exact: true }).click();
  const branding = await page.locator('.menu-viewport').evaluate(element => ({
    primary: (element as HTMLElement).style.getPropertyValue('--primary-color'),
    heading: getComputedStyle(element.querySelector('.template-brand-copy h2')!).fontFamily,
    body: getComputedStyle(element).fontFamily,
  }));
  expect(branding.primary).toBe(colors.primary);
  expect(branding.heading).toContain('Oswald'); expect(branding.body).toContain('Lora');
  const pixelLightFrame = pixel ? await page.locator('.capsule-btn').first().evaluate(element => getComputedStyle(element).boxShadow) : '';
  await page.screenshot({ path: info.outputPath(`${template}-home-light.png`) });
  await page.getByRole('button', { name: 'Pratos', exact: true }).click();
  const section = page.locator('.subcategory-header-collapsible').first();
  await section.focus(); await page.keyboard.press('Enter');
  await expect(section).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Space');
  await expect(section).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.btn-like-item')).toHaveCount(0);
  const card = page.locator('.product-item-card');
  for (const width of [390, 320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const bounds = await card.evaluate(element => {
      const rect = element.getBoundingClientRect(), button = element.querySelector('.btn-view-item')!.getBoundingClientRect();
      const photo = element.querySelector('.product-card-photo')!.getBoundingClientRect();
      return { photoShare: photo.width / rect.width, height: rect.height, photoRatio: photo.width / photo.height, overflow: element.scrollWidth - element.clientWidth, inside: button.right <= rect.right + 1 && button.bottom <= rect.bottom + 1 };
    });
    expect(bounds.overflow).toBeLessThanOrEqual(1); expect(bounds.inside).toBe(true);
    if (signatureCover || pixel) {
      expect(bounds.photoRatio).toBeCloseTo(1, 2);
      expect(bounds.photoShare).toBeGreaterThan(.25); expect(bounds.photoShare).toBeLessThan(.45);
      expect(bounds.height).toBe(pixel ? 140 : 148);
      if (pixel) await expect(card.locator('.product-card-photo')).toHaveCSS('clip-path', /polygon/);
      await expect(card.locator('.card-item-desc')).toHaveCSS('-webkit-line-clamp', '3');
      const likeOnInfo = await card.locator('.item-like-btn').evaluate(element => {
        const button = element.getBoundingClientRect(), photo = element.closest('.product-item-card')!.querySelector('.product-card-photo')!.getBoundingClientRect();
        return button.left >= photo.right;
      });
      expect(likeOnInfo).toBe(true);
    } else if (brandHero) {
      expect(bounds.photoShare).toBeGreaterThan(.38); expect(bounds.photoShare).toBeLessThan(.5);
      expect(bounds.height).toBe(144);
      const like = card.locator('.item-like-btn');
      await expect(like).toBeVisible();
      const onPhoto = await like.evaluate(element => {
        const button = element.getBoundingClientRect(), photo = element.closest('.product-item-card')!.querySelector('.product-card-photo')!.getBoundingClientRect();
        return button.left >= photo.left && button.right <= photo.right && button.top >= photo.top && button.bottom <= photo.bottom;
      });
      expect(onPhoto).toBe(true);
      await expect(card.locator('.card-item-desc')).toHaveCSS('-webkit-line-clamp', '3');
    } else {
      expect(bounds.photoRatio).toBeCloseTo(1, 2); expect(bounds.height).toBeLessThan(120);
    }
  }
  if (photoCards) {
    const like = card.locator('.item-like-btn');
    if (pixel) await expect(like.locator('path')).toHaveAttribute('d', /^M4 4H10V6H14V4H20/);
    await like.click(); await expect(like).toHaveAttribute('aria-pressed', 'true');
    await expect(card.locator('.like-counter-val')).toHaveText('100');
    await expect(page.locator('.product-modal-sheet')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`${template}-product-card.png`) });
  }
  await card.getByRole('button', { name: /^Ver detalhes de / }).click();
  await expect(page.locator('.product-modal-sheet')).toBeVisible();
  if (pixel) await expect(page.locator('.sheet-like-action path')).toHaveAttribute('d', /^M4 4H10V6H14V4H20/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Bebidas', exact: true }).click();
  await expect(page.locator('.category-nav-pill').first()).toHaveCSS('font-family', /Lora/);
  await expect(page.locator('.showcase-hero-banner')).toHaveCount(0);
  await expect(page.locator('.no-hero-header')).toBeVisible();
  introEnabled = false;
  colors = { primary: '#E8AE8C', secondary: '#62626C', accent: '#F8D3B1', background: '#202024', surface: '#303036', textPrimary: '#F9F5F1', textSecondary: '#C0B9B3' };
  await page.setViewportSize({ width: 390, height: 844 });
  await open();
  await expect(page.locator('.intro-description-wrapper')).toHaveCount(0);
  expect(await page.locator('.menu-viewport').evaluate(element => (element as HTMLElement).style.getPropertyValue('--primary-color'))).toBe(colors.primary);
  if (pixel) expect(await page.locator('.capsule-btn').first().evaluate(element => getComputedStyle(element).boxShadow)).not.toBe(pixelLightFrame);
  await page.screenshot({ path: info.outputPath(`${template}-home-dark.png`) });
  heroEnabled = false; introEnabled = true;
  if (pixel) { cartEnabled = false; likesEnabled = false; }
  await open();
  await expect(page.locator('.showcase-hero-banner, .template-brand-header')).toHaveCount(0);
  await expect(page.locator('.no-hero-header')).toBeVisible();
  await expect(page.locator('.intro-card-title')).toHaveText('Feito na casa');
  if (pixel) {
    await expect(page.locator('.cart-capsule-btn, .item-like-btn')).toHaveCount(0);
    await expect(page.locator('.floating-controls-capsule .capsule-btn')).toHaveCount(1);
  }
});

}
