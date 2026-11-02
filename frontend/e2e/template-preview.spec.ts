import { expect, test } from '@playwright/test';

test.setTimeout(90_000);

test('selecting Doce Encanto updates the phone preview and survives saving and reload', async ({ page }, info) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  const business = { id: 'preview-tenant', name: 'Pingo Chef', slug: 'preview-test', logo_url: '/logo_img.webp' };
  let design = {
    template_key: 'compact-menu', font_heading: 'Silkscreen', font_body: 'Pixelify Sans',
    palette: { key: 'custom', colors: { primary: '#194E40', secondary: '#98AD95', accent: '#C56620',
      background: '#F4F8F3', surface: '#FFFFFF', textPrimary: '#17372C', textSecondary: '#61776A' } },
    home_blocks: [{ id: 'hero', type: 'hero', enabled: true, position: 0 }, { id: 'categories', type: 'categories', enabled: true, position: 1 }],
    custom_config: { enable_cart: true, hero_banners: ['/logo_img.webp'], home_icons: { home: null } }
  };
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1/', '');
    const fulfill = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path === 'auth/me') return fulfill({ user: { id: 'preview-owner', name: 'Ana' }, business, accountActive: true,
      csrfToken: 'a'.repeat(64), plan: { code: 'FREE' }, entitlements: { MAX_PRODUCTS: 10, MAX_CATEGORIES: 4 },
      usage: { products: 2, categories: 1, videos: 0 }, onboarding: { designConfigured: true } });
    if (path === 'business/tutorial') return fulfill({ tutorial_status: 'COMPLETED' });
    if (path === 'business') return fulfill(business);
    if (path === 'design') {
      if (request.method() === 'PUT') design = request.postDataJSON();
      return fulfill(design);
    }
    if (path === 'categories') return fulfill([{ id: 'food', name: 'Pratos', iconType: 'none', isActive: true }]);
    if (path === 'items') return fulfill(['Burger da Casa', 'Burger Especial'].map((name, index) => ({
      id: `food-${index}`, name, categoryId: 'food', price: 29.9, isAvailable: true, likesCount: 54,
      imageUrl: '/logo_img.webp', description: 'Receita preparada na hora com ingredientes selecionados.'
    })));
    return fulfill([]);
  });
  const preview = page.locator('.preview-panel .menu-viewport');
  await page.goto('/dashboard');
  await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-tour="nav-design"]').click();
  await expect(preview).toHaveAttribute('data-template', 'compact-menu');
  const editor = page.locator('app-design-editor');
  await editor.getByRole('button', { name: 'Temáticos', exact: true }).click();
  const choice = editor.locator('.template-card').filter({ has: page.getByRole('heading', { name: 'Doce Encanto', exact: true }) });
  await choice.click();
  await expect(choice).toHaveAttribute('aria-pressed', 'true');
  await expect(preview).toHaveAttribute('data-template', 'sweet-boutique', { timeout: 20_000 });
  await preview.getByRole('button', { name: 'Ver o Cardápio', exact: true }).click();
  await preview.getByRole('button', { name: 'Pratos', exact: true }).click();
  await expect(preview.locator('.items-grid')).toHaveCSS('grid-template-columns', /\d+px \d+px/);
  await expect(preview.locator('.product-card-photo').first()).toHaveCSS('aspect-ratio', '8 / 5');
  await expect(preview.locator('.template-logo-wrap')).toHaveCSS('width', '64px');
  await expect(preview.locator('.category-nav-pill').first()).toHaveCSS('font-family', /Pixelify Sans/);
  await page.locator('.preview-panel').screenshot({ path: info.outputPath('sweet-boutique-panel.png') });
  await page.locator('[data-tour="design-save"]').click();
  await expect.poll(() => design.template_key).toBe('sweet-boutique');
  expect(design.font_heading).toBe('Silkscreen');
  expect(design.palette.colors.primary).toBe('#194E40');
  await page.reload();
  await expect(preview).toHaveAttribute('data-template', 'sweet-boutique', { timeout: 20_000 });
});
