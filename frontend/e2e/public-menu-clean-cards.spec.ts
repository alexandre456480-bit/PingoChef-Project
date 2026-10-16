import { expect, test } from '@playwright/test';

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
  for (const template of ['modern', 'minimal', 'premium', 'dark']) {
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
