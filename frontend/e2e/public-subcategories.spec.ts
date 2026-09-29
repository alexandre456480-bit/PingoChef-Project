import { expect, test } from '@playwright/test';

test('subcategorias longas continuam visíveis no cardápio público', async ({ page }) => {
  const categoryId = '11111111-1111-4111-8111-111111111111';
  const subcategoryId = '22222222-2222-4222-8222-222222222222';
  const items = Array.from({ length: 140 }, (_, index) => ({
    id: `produto-${index}`,
    categoryId,
    subcategoryId,
    name: `Prato ${index + 1}`,
    description: 'Prato artesanal',
    price: 20,
    imageUrl: null,
    isAvailable: true,
    isHighlighted: false,
    highlightType: 'none',
    displayOrder: index
  }));

  await page.route('**/api/v1/public/menu/teste-subcategorias', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        business: { name: 'Teste', slug: 'teste-subcategorias', logoUrl: '/logo_img.webp', welcomeBgType: 'color', welcomeBgColor: '#2D1822' },
        design: {
          templateKey: 'modern',
          palette: { colors: { primary: '#8B1A3A', secondary: '#D26E2D', accent: '#F47B20', background: '#FAF5F0', surface: '#FFFFFF', textPrimary: '#2D1822', textSecondary: '#6E5D65' } },
          fontHeading: 'Outfit', fontBody: 'Inter', fontPair: 'modern_clean',
          homeBlocks: [{ id: 'categories', type: 'categories', enabled: true, position: 0 }],
          heroBanners: [], customConfig: { enable_likes: false, enable_cart: false }
        },
        categories: [{ id: categoryId, name: 'Pratos', displayOrder: 0, isActive: true }],
        subcategories: [{ id: subcategoryId, categoryId, name: 'Artesanais', displayOrder: 0 }],
        items
      }
    })
  }));

  await page.goto('/m/teste-subcategorias');
  await page.getByRole('button', { name: 'Ver o Cardápio' }).click();
  await expect(page.locator('.entry-transition-layer')).toBeVisible();
  const mark = await page.locator('.entry-mark').evaluate(element => {
    const logo = element.getBoundingClientRect();
    const curtains = element.parentElement!.getBoundingClientRect();
    return {
      offsetX: logo.left + logo.width / 2 - (curtains.left + curtains.width / 2),
      offsetY: logo.top + logo.height / 2 - (curtains.top + curtains.height / 2),
      background: getComputedStyle(element).backgroundColor,
      imageFit: getComputedStyle(element.querySelector('img')!).objectFit
    };
  });
  expect(Math.abs(mark.offsetX)).toBeLessThan(1);
  expect(Math.abs(mark.offsetY)).toBeLessThan(1);
  expect(mark.background).toBe('rgba(0, 0, 0, 0)');
  expect(mark.imageFit).toBe('contain');
  await expect(page.locator('.entry-transition-layer')).toHaveCount(0, { timeout: 3000 });
  await page.locator('.category-nav-pill').filter({ hasText: 'Pratos' }).first().click();

  await expect(page.getByRole('heading', { name: 'Artesanais' })).toBeVisible();
  await expect.poll(() => page.locator('.subcategory-group').first().evaluate(element => getComputedStyle(element).opacity)).toBe('1');
  await expect(page.getByText('Prato 1', { exact: true })).toBeVisible();
});
