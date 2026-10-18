import { expect, test } from '@playwright/test';

for (const headerVariant of [undefined, 'brand-cover', 'editorial-arc', 'curve-panels']) {
test(`${headerVariant || 'compact showcase'} preserves header geometry and product actions`, async ({ page }, testInfo) => {
  const curved = headerVariant === 'editorial-arc' || headerVariant === 'curve-panels';
  let introEnabled = true;
  let colors = { primary: '#8B1A3A', secondary: '#D26E2D', accent: '#F47B20', background: '#FAF5F0', surface: '#FFFFFF', textPrimary: '#2D1822', textSecondary: '#6E5D65' };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/v1/public/menu/compact-showcase', route => route.fulfill({ json: { success: true, data: {
    business: { name: 'Hamburgueria da Casa', description: 'Hambúrgueres artesanais', slug: 'compact-showcase', logoUrl: '/logo_img.webp', welcomeBgType: 'color' },
    design: {
      templateKey: 'showcase', fontHeading: 'Outfit', fontBody: 'Inter', heroBanners: ['/assets/mascots/home/pingo-chef-animation-menu.webp'],
      palette: { colors },
      homeBlocks: [...['categories', 'hero'].map((type, position) => ({ id: type, type, enabled: true, position })),
        ...(headerVariant ? [{ id: headerVariant, type: 'template_variant', label: 'Visual do cabeçalho', enabled: false, position: 2 }] : [])],
      categoryHeroConfigs: { 'no-cover': { enabled: false, banners: [] } },
      customConfig: { enable_likes: true, enable_cart: true, intro_card: { enabled: introEnabled, title: 'Feito na casa', description: 'Ingredientes frescos todos os dias.' } }
    },
    categories: [
      { id: 'burgers', name: 'Hambúrgueres Artesanais', displayOrder: 0, isActive: true, iconType: 'none' },
      { id: 'no-cover', name: 'Bebidas', displayOrder: 1, isActive: true, iconType: 'none' }
    ],
    subcategories: [{ id: 'classics', categoryId: 'burgers', name: 'Artesanais Clássicos', displayOrder: 0 }],
    items: [
      { id: 'bacon', categoryId: 'burgers', subcategoryId: 'classics', name: 'Bacon Supreme Burger', promotionalPrice: 29.90, price: 34.90, imageUrl: '/logo_img.webp', likesCount: 54 },
      { id: 'monster', categoryId: 'burgers', name: 'Monster Cheddar BBQ com cebola caramelizada e bacon artesanal', price: 38.90, likesCount: 99 },
      { id: 'water', categoryId: 'no-cover', name: 'Água mineral', price: 5 }
    ].map(item => ({ ...item, isAvailable: true, description: 'Pão brioche tostado na manteiga, burger artesanal, fatias crocantes de bacon e muito cheddar. Preparado na hora com ingredientes selecionados.' }))
  } } }));
  await page.goto('/m/compact-showcase');
  await page.getByRole('button', { name: 'Ver o Cardápio' }).click();
  const cover = page.locator('.showcase-hero-banner');
  await expect(cover).toHaveCount(1);
  const geometry = await page.locator('.showcase-scrollable').evaluate(el => {
    const cover = el.querySelector('.showcase-hero-banner')!.getBoundingClientRect();
    const logo = el.querySelector('.brand-cover-logo, .hero-overlap-ring')!.getBoundingClientRect();
    const intro = el.querySelector('.intro-description-wrapper')!.getBoundingClientRect();
    return { top: cover.top - el.getBoundingClientRect().top, center: Math.abs(logo.left + logo.width / 2 - cover.left - cover.width / 2), overlap: cover.bottom - logo.top, below: logo.bottom - cover.bottom, introGap: intro.top - logo.bottom, logoInside: logo.top >= cover.top && logo.left >= cover.left && logo.right < cover.left + cover.width / 2 && logo.bottom <= cover.bottom, aspect: cover.width / cover.height };
  });
  if (headerVariant === 'brand-cover') {
    await expect(page.locator('.brand-cover-name')).toBeVisible();
    const identity = await page.locator('.brand-cover-identity').evaluate(el => {
      const logo = el.querySelector('img')!.getBoundingClientRect();
      const name = el.querySelector('h2')!;
      return { square: Math.abs(logo.width - logo.height), nameHeight: name.getBoundingClientRect().height, fontSize: parseFloat(getComputedStyle(name).fontSize) };
    });
    expect(identity.square).toBeLessThan(1);
    expect(identity.nameHeight).toBeGreaterThanOrEqual(identity.fontSize);
    expect(geometry.top).toBe(16);
    expect(geometry.logoInside).toBe(true);
    expect(geometry.aspect).toBeCloseTo(2.08, 1);
    await expect(page.locator('.hero-overlap-logo-container')).toHaveCount(0);
    expect(await page.locator('.category-nav-pill').first().evaluate(el => getComputedStyle(el).borderRadius)).toBe('10px');
  } else if (curved) {
    expect(geometry.center).toBeLessThan(2);
    expect(geometry.below).toBeGreaterThan(0);
    expect(geometry.aspect).toBeCloseTo(headerVariant === 'editorial-arc' ? 1.7 : 1.95, 1);
    await expect(page.locator('.intro-description-wrapper')).toHaveCount(1);
  } else {
    expect(Math.abs(geometry.top)).toBeLessThan(2);
    expect(geometry.center).toBeLessThan(2);
    expect(geometry.overlap).toBeGreaterThan(0);
    expect(geometry.below).toBeGreaterThan(0);
  }
  expect(geometry.introGap).toBeGreaterThanOrEqual(0);
  await page.getByRole('button', { name: 'Hambúrgueres Artesanais', exact: true }).click();
  await expect(cover).toHaveCount(1);
  await expect(page.locator('.product-item-card')).toHaveCount(2);
  if (headerVariant === 'brand-cover') {
    const comparison = await page.locator('.menu-viewport').evaluate(el => {
      const snapshot = () => ['.product-item-card', '.subcategory-header-collapsible'].map(selector => {
        const node = el.querySelector(selector)!;
        const style = getComputedStyle(node);
        return [node.getBoundingClientRect().height, style.borderRadius, style.boxShadow, style.padding, style.fontSize, style.gridTemplateColumns];
      });
      const variant = snapshot();
      el.removeAttribute('data-header-template');
      const base = snapshot();
      el.setAttribute('data-header-template', 'brand-cover');
      return { variant, base };
    });
    expect(comparison.variant).toEqual(comparison.base);
  }
  await page.locator('.showcase-scrollable').evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath(`${headerVariant || 'compact-showcase'}.png`) });
  if (curved) {
    await expect(page.locator('.intro-description-wrapper')).toHaveCount(1);
    await expect(page.locator('.subcat-title-wrap svg, .subcat-title-wrap img')).toHaveCount(0);
    const subcategory = page.locator('.subcategory-header-collapsible').first();
    await subcategory.focus();
    await page.keyboard.press('Enter');
    await expect(subcategory).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Space');
    await expect(subcategory).toHaveAttribute('aria-expanded', 'true');
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    const cards = await page.locator('.product-item-card').evaluateAll(elements => elements.map(el => {
      const card = el.getBoundingClientRect();
      const button = el.querySelector('.btn-view-item')!.getBoundingClientRect();
      const price = el.querySelector('.pricing-box')!.getBoundingClientRect();
      return { height: card.height, overflow: el.scrollWidth - el.clientWidth, buttonInside: button.bottom <= card.bottom && button.right <= card.right, priceVisible: price.width > 45 && price.bottom <= card.bottom };
    }));
    for (const card of cards) {
      expect(card.height).toBeLessThan(165);
      expect(card.overflow).toBeLessThanOrEqual(1);
      expect(card.buttonInside).toBe(true);
      expect(card.priceVisible).toBe(true);
    }
  }
  if (curved) {
    introEnabled = false;
    for (const palette of [
      { primary: '#E8AE8C', secondary: '#62626C', accent: '#F8D3B1', background: '#202024', surface: '#303036', textPrimary: '#F9F5F1', textSecondary: '#C0B9B3' },
      { primary: '#173E34', secondary: '#849D90', accent: '#BA591B', background: '#F4F8F3', surface: '#FFFFFF', textPrimary: '#183027', textSecondary: '#586A61' }
    ]) {
      colors = palette;
      await page.reload();
      await page.getByRole('button', { name: 'Ver o Cardápio' }).click();
      await page.getByRole('button', { name: 'Hambúrgueres Artesanais', exact: true }).click();
      await expect(page.locator('.intro-description-wrapper, .editorial-hero-copy')).toHaveCount(0);
      if (headerVariant === 'curve-panels') {
        const headerColor = await page.locator('.subcategory-header-collapsible').first().evaluate((el, primary) => {
          const swatch = document.createElement('span'); swatch.style.color = primary;
          return { actual: getComputedStyle(el).backgroundColor, expected: swatch.style.color };
        }, palette.primary);
        expect(headerColor.actual).toBe(headerColor.expected);
      }
      await page.locator('.showcase-scrollable').evaluate(el => { el.scrollTop = 0; });
      await page.screenshot({ path: testInfo.outputPath(`${headerVariant}-${palette.primary === '#E8AE8C' ? 'dark' : 'custom'}.png`) });
    }
  }
  await page.getByRole('button', { name: 'Bebidas', exact: true }).click();
  await expect(cover).toHaveCount(0);
  await expect(page.locator('.no-hero-header')).toBeVisible();
  if (curved) await expect(page.locator('.no-hero-tagline, .intro-description-wrapper')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver', exact: true }).click();
  await expect(page.locator('.product-modal-sheet')).toBeVisible();
});
}

test.setTimeout(120_000);
test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.fulfill({ contentType: 'text/css', body: '' }));
});

test('public cards keep highlights and likes working with clean photos and categories at the same elevation', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.clear());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const types = ['promotion', 'most_liked', 'chef', 'combo', 'best_seller', 'none'];
  const items = types.map((highlightType, index) => ({
    id: `item-${index}`, categoryId: 'category-a', subcategoryId: index < 3 ? 'sub-a' : null,
    name: `Prato ${index + 1}`, description: 'Preparo artesanal com ingredientes frescos.',
    price: 42, promotionalPrice: highlightType === 'promotion' ? 35 : null,
    imageUrl: '/logo_img.webp', isAvailable: true, highlightType,
    isHighlighted: highlightType !== 'none', likesCount: index + 1, displayOrder: index
  }));
  let templateKey = 'modern';
  await page.route('**/api/v1/public/menu/clean-cards', route => route.fulfill({ json: { success: true, data: {
    business: { name: 'Bistrô', slug: 'clean-cards', logoUrl: '/logo_img.webp', welcomeBgType: 'color', welcomeBgColor: '#141416' },
    design: {
      templateKey, fontHeading: 'Outfit', fontBody: 'Inter', heroBanners: [],
      palette: { colors: { primary: '#8B1A3A', secondary: '#D26E2D', accent: '#F47B20', background: '#FAF5F0', surface: '#FFFFFF', textPrimary: '#2D1822', textSecondary: '#6E5D65' } },
      homeBlocks: ['categories', 'promotion', 'most_liked', 'featured_product', 'combo', 'best_seller'].map((type, position) => ({ id: type, type, enabled: true, position })),
      customConfig: { enable_likes: true, enable_cart: true, intro_card: { enabled: false } }
    },
    categories: [{ id: 'category-a', name: 'Pratos', displayOrder: 0, isActive: true, iconType: 'none' }],
    subcategories: [{ id: 'sub-a', categoryId: 'category-a', name: 'Artesanais', displayOrder: 0 }],
    items
  } } }));
  await page.route('**/api/v1/public/menu/clean-cards/like/*', route => route.fulfill({ json: { success: true, data: { itemId: route.request().url().split('/').pop(), likesCount: 10, created: true } } }));
  for (const template of ['modern', 'minimal', 'premium', 'dark', 'showcase']) {
    templateKey = template;
    await page.goto('/m/clean-cards');
    await page.getByRole('button', { name: 'Ver o Cardápio' }).click();
    await expect(page.getByRole('heading', { name: 'Promoções & Ofertas', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pratos do Chef & Especialidades', exact: true })).toBeVisible();
    await expect(page.locator('.block-title > .block-title-icon')).toHaveCount(5);
    await expect(page.locator('.promo-block .block-title-icon')).toHaveText('🔥');
    await expect(page.locator('.featured-chef-block .block-title-icon')).toHaveAttribute('src', '/icons_chef_hat.webp');
    await expect(page.locator('.combos-block .block-title-icon svg, .best-sellers-block .block-title-icon svg')).toHaveCount(2);
    if (template === 'modern') await page.screenshot({ path: testInfo.outputPath('home-title-icons.png') });
    await expect(page.locator('.block-title-icon:not(h3 > *)')).toHaveCount(0);
    await expect(page.locator('.block-title-row > span, .promo-ribbon, .chef-star-pill, .combo-card-badge, .star-badge, .best-seller-rank')).toHaveCount(0);
    await expect(page.locator('.promo-img-wrap button, .chef-card-photo-wrap button, .combo-img-wrap button, .best-seller-img-wrap button')).toHaveCount(0);
    await page.locator('.category-nav-pill').filter({ hasText: 'Pratos' }).click();
    await expect(page.locator('.product-item-card')).toHaveCount(6);
    await expect(page.locator('.product-card-photo button, .product-card-photo .star-badge')).toHaveCount(0);
    const elevation = await page.locator('.menu-viewport').evaluate(element => ({
      category: getComputedStyle(element.querySelector('.category-nav-pill:not(.active)')!).boxShadow,
      item: getComputedStyle(element.querySelector('.product-item-card')!).boxShadow
    }));
    expect(elevation.category).toBe(elevation.item);
    const card = page.locator('.product-item-card').filter({ hasText: 'Prato 1' });
    await card.getByRole('button', { name: 'Curtir item', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Item já curtido', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.product-modal-backdrop')).toHaveCount(0);
    if (template === 'modern') await page.screenshot({ path: testInfo.outputPath('public-items.png') });
    await card.getByRole('button', { name: 'Ver', exact: true }).click();
    await expect(page.locator('.product-modal-sheet')).toBeVisible();
  }
});
