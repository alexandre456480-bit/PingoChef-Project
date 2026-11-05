import { expect, Page, test } from '@playwright/test';

test.setTimeout(90_000);
const palette = { key: 'custom', colors: { primary: '#173E34', secondary: '#849D90', accent: '#BA591B', background: '#F4F8F3', surface: '#FFFFFF', textPrimary: '#183027', textSecondary: '#586A61' } };
const products = [
  { id: 'burger', name: 'Hambúrguer', price: 30, promotionalPrice: 25 },
  { id: 'fries', name: 'Batata frita', price: 12, promotionalPrice: 10 },
  { id: 'water', name: 'Água mineral', price: 5 },
  { id: 'cake', name: 'Bolo da casa', price: 15 },
].map(item => ({ ...item, categoryId: 'food', categoryName: 'Pratos', isAvailable: true, showPrice: true, description: 'Preparado na casa', imageUrl: '/logo_img.webp', likesCount: 0 }));

async function fixture(page: Page, { enabled = true, cart = true } = {}) {
  let ids = ['fries', 'water'], writes = 0;
  let design: any = { template_key: 'default', palette, home_blocks: [{ id: 'categories', type: 'categories', enabled: true, position: 0 }], custom_config: { enable_cart: cart, cart_recommendations_enabled: enabled, intro_card: { enabled: false } } };
  const requests: string[] = [];
  // Existing deferred analytics is independent of opening the cart; count data reads.
  page.on('request', req => { if (req.method() === 'GET' && req.url().includes('/api/v1/')) requests.push(req.url()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/^https:\/\/(fonts\.(googleapis|gstatic)\.com|images\.unsplash\.com)/, route => route.abort());
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname.replace('/api/v1/', '');
    const business = { id: 'tenant', name: 'Casa da Ana', slug: 'recommendations-test', logo_url: '/logo_img.webp', welcome_bg_type: 'color' };
    const relations = [{ triggerProductId: 'burger', recommendedProductIds: ids }];
    const fulfill = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path === 'auth/me') return fulfill({ user: { id: 'owner', name: 'Ana' }, business, accountActive: true, csrfToken: 'a'.repeat(64), plan: { code: 'FREE' }, entitlements: { MAX_PRODUCTS: 10, MAX_CATEGORIES: 4 }, usage: { products: 4, categories: 1, videos: 0 }, onboarding: { designConfigured: true } });
    if (path === 'business/tutorial') return fulfill({ tutorial_status: 'COMPLETED' });
    if (path === 'design') { if (req.method() === 'PUT') design = req.postDataJSON(); return fulfill(design); }
    if (path === 'categories') return fulfill([{ id: 'food', name: 'Pratos', iconType: 'none', isActive: true }]);
    if (path === 'items') return route.fulfill({ json: { success: true, data: products, productRecommendations: relations } });
    if (path === 'items/burger/recommendations') {
      if (req.method() === 'PUT') { ids = req.postDataJSON().recommendedProductIds; writes++; }
      return fulfill({ triggerProductId: 'burger', recommendedProductIds: ids });
    }
    if (path === 'public/menu/recommendations-test') return fulfill({ business: { name: business.name, slug: business.slug, logoUrl: business.logo_url, welcomeBgType: 'color' },
      design: { templateKey: design.template_key, palette, homeBlocks: design.home_blocks, customConfig: design.custom_config },
      cartRecommendationsEnabled: design.custom_config.cart_recommendations_enabled && design.custom_config.enable_cart,
      productRecommendations: relations, categories: [{ id: 'food', name: 'Pratos', iconType: 'none', isActive: true }], subcategories: [], items: products });
    return fulfill([]);
  });
  return { ids: () => ids, writes: () => writes, design: () => design, requests };
}
async function seed(page: Page, slug = 'recommendations-test') {
  await page.addInitScript(({ slug }) => localStorage.setItem(`cart_${slug}`, JSON.stringify([{ itemId: 'burger', name: 'Hambúrguer', price: 30, promotionalPrice: 25, quantity: 1 } ])), { slug });
}
async function menu(page: Page) {
  await page.goto('/m/recommendations-test');
  await page.getByRole('button', { name: 'Ver o Cardápio', exact: true }).click();
  await expect(page.locator('.cart-capsule-btn')).toBeVisible();
}
async function nav(page: Page, section: string) {
  const button = page.locator(`[data-tour="nav-${section}"]`);
  if ((page.viewportSize()?.width || 1280) <= 1024) {
    const open = page.getByRole('button', { name: 'Abrir menu', exact: true });
    if (await open.getAttribute('aria-expanded') !== 'true') await open.click();
  }
  await button.click();
}

test('one local suggestion: dismiss, reopen, cart mutation, promotion price, add and details', async ({ page }, info) => {
  const data = await fixture(page); await seed(page); await menu(page);
  const sizes = info.project.name.includes('mobile') ? [360, 390, 430] : [1280];
  const card = page.locator('app-cart-recommendation');
  for (const width of sizes) {
    await page.setViewportSize({ width, height: 900 });
    const before = data.requests.length;
    await page.locator('.cart-capsule-btn').click();
    await expect(card).toContainText('Batata frita');
    await expect(card).toContainText(/10,00/);
    await expect(card).toHaveCount(1);
    expect(data.requests.length).toBe(before);
    const geometry = await card.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, right: el.getBoundingClientRect().right }));
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1); expect(geometry.right).toBeLessThanOrEqual(width);
    await page.locator('.cart-drawer-sheet').screenshot({ path: info.outputPath(`recommendation-${width}.png`) });
    await page.getByRole('button', { name: 'Dispensar sugestão' }).click();
    await expect(card).toHaveCount(0);
    await page.locator('.drawer-close-btn').click(); await page.locator('.cart-capsule-btn').click();
    await expect(card).toHaveCount(0);
    await page.locator('.cart-item-row').first().locator('.c-qty-btn').last().click();
    await expect(card).toContainText('Batata frita');
    await page.locator('.drawer-close-btn').click();
  }
  await page.locator('.cart-capsule-btn').click();
  const quantity = sizes.length + 1;
  await card.getByRole('button', { name: 'Adicionar Batata frita ao carrinho', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.cart-item-row')).toHaveCount(2);
  await expect(page.locator('.total-val')).toContainText(`${quantity * 25 + 10},00`);
  await expect(card).toContainText('Água mineral');
  await card.getByRole('button', { name: 'Ver detalhes de Água mineral', exact: true }).click();
  await expect(page.locator('.cart-drawer-sheet')).toHaveCount(0);
  await expect(page.locator('.btn-sheet-add-cart')).toBeVisible();
  await page.locator('.btn-sheet-add-cart').click();
  await page.locator('.cart-capsule-btn').click();
  await expect(page.locator('.cart-item-row')).toHaveCount(3);
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: 'Limpar tudo', exact: true }).click();
  await expect(card).toHaveCount(0);
});

test('notification waits two seconds per opening, cancels on close and respects reduced motion', async ({ page }) => {
  const data = await fixture(page); await seed(page); await page.clock.install(); await menu(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  const card = page.locator('app-cart-recommendation');
  const before = data.requests.length;
  await page.locator('.cart-capsule-btn').click();
  await page.clock.runFor(1000);
  await expect(card).toHaveCount(0);
  await page.locator('.drawer-close-btn').click();
  await page.clock.runFor(3000);
  await expect(card).toHaveCount(0);
  await page.locator('.cart-capsule-btn').click();
  await page.clock.runFor(1999);
  await expect(card).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(card).toBeVisible();
  await expect(card).toHaveCSS('animation-name', 'none');
  expect(data.requests.length).toBe(before);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(card).toHaveCSS('animation-name', /suggestion-arrive$/);
  await page.clock.runFor(700);
  const position = await page.locator('.cart-drawer-sheet').evaluate(sheet => {
    const suggestion = sheet.querySelector('app-cart-recommendation')!.getBoundingClientRect();
    const footer = sheet.querySelector('.cart-drawer-footer')!.getBoundingClientRect();
    return { suggestionBottom: suggestion.bottom, footerTop: footer.top };
  });
  expect(position.suggestionBottom).toBeLessThanOrEqual(position.footerTop);
});

test('global disabled state keeps the cart without recommendations', async ({ page }) => {
  await fixture(page, { enabled: false }); await seed(page); await menu(page);
  await page.locator('.cart-capsule-btn').click();
  await expect(page.locator('.cart-item-row')).toHaveCount(1);
  await expect(page.locator('app-cart-recommendation')).toHaveCount(0);
});

test('disabled cart hides the feature even if recommendations are configured', async ({ page }) => {
  await fixture(page, { cart: false }); await seed(page);
  await page.goto('/m/recommendations-test');
  await page.getByRole('button', { name: 'Ver o Cardápio', exact: true }).click();
  await expect(page.locator('.cart-capsule-btn')).toHaveCount(0);
  await expect(page.locator('app-cart-recommendation')).toHaveCount(0);
});

test('owner orders and removes saved complements; preview and Design draft use the same state', async ({ page }, info) => {
  const desktop = !info.project.name.includes('mobile');
  const data = await fixture(page); await seed(page, 'sapatolandia-gourmet');
  await page.goto('/dashboard'); await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
  await nav(page, 'menu');
  const row = page.locator('.product-card').filter({ hasText: 'Hambúrguer' });
  await row.getByTitle('Editar', { exact: true }).click();
  const editor = page.locator('app-product-recommendations-editor');
  await expect(editor).toContainText('2/3');
  await editor.getByRole('button', { name: 'Aumentar prioridade de Água mineral' }).click();
  await expect.poll(data.ids).toEqual(['water', 'fries']);
  await editor.getByRole('button', { name: 'Remover sugestão Batata frita' }).click();
  await expect.poll(data.ids).toEqual(['water']);
  await expect(editor).toContainText('1/3');
  await expect(editor.getByRole('searchbox')).toBeEnabled();
  await editor.getByRole('searchbox').fill('pratos bolo');
  await expect(editor.locator('.candidate')).toHaveCount(1);
  await editor.getByRole('button', { name: 'Recomendar Bolo da casa' }).click();
  await expect.poll(data.ids).toEqual(['water', 'cake']);
  await editor.getByRole('button', { name: 'Recomendar Batata frita' }).click();
  await expect(editor).toContainText('3/3');
  await expect(editor.getByRole('searchbox')).toHaveCount(0);
  await expect.poll(data.writes).toBe(4);
  await editor.screenshot({ path: info.outputPath('recommendations-editor.png') });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).last().click();
  const preview = page.locator('.preview-panel app-public-menu-view');
  if (desktop) {
    await preview.getByRole('button', { name: 'Ver o Cardápio', exact: true }).click();
    await preview.locator('.cart-capsule-btn').click();
    await expect(preview.locator('app-cart-recommendation')).toContainText('Água mineral');
    await preview.locator('.drawer-close-btn').click();
  }
  await nav(page, 'design');
  await page.getByRole('heading', { name: 'Recursos do Cardápio', exact: true }).click();
  const toggle = page.getByRole('switch', { name: 'Sugestões no carrinho', exact: true });
  await toggle.locator('xpath=ancestor::div[contains(@class,"feature-config-card")]').screenshot({ path: info.outputPath('recommendations-toggle.png') });
  await expect(toggle).toHaveAttribute('aria-checked', 'true'); await toggle.click();
  expect(data.design().custom_config.cart_recommendations_enabled).toBe(true);
  if (desktop) {
    await preview.locator('.cart-capsule-btn').click(); await expect(preview.locator('app-cart-recommendation')).toHaveCount(0);
    await preview.locator('.drawer-close-btn').click();
  }
  await page.getByRole('button', { name: /Salvar Alterações|Salvar e Sincronizar/ }).click();
  await expect.poll(() => data.design().custom_config.cart_recommendations_enabled).toBe(false);
  expect(data.ids()).toEqual(['water', 'cake', 'fries']);
});
