import { expect, Page, test } from '@playwright/test';
test.setTimeout(90_000);
const flavors = [{ id: '11111111-1111-4111-8111-111111111111', name: 'Frango', price: null, isAvailable: true }, { id: '22222222-2222-4222-8222-222222222222', name: 'Picanha', price: 18, isAvailable: true }];
async function setup(page: Page) {
  let saved: any;
  let product: any = { id: 'skewer', name: 'Espetinho', categoryId: 'food', description: 'Preparado na hora', price: 12, promotionalPrice: 10, showPrice: true, isAvailable: true, isHighlighted: false, highlightType: 'none', flavors };
  const business = { id: 'tenant', name: 'Casa Jardim', slug: 'flavors', welcome_bg_type: 'color', order_settings: { enabled: true, channel: 'whatsapp', url: 'https://wa.me/5511999999999', button_text: 'Fazer pedido' } };
  const categories = [{ id: 'food', name: 'Espetinhos', isActive: true }];
  const design = { template_key: 'default', home_blocks: [{ id: 'categories', type: 'categories', enabled: true, position: 0 }], custom_config: { enable_cart: true } };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/^https:\/\/fonts\./, route => route.abort());
  await page.route('**/api/v1/**', route => {
    const req = route.request(), path = new URL(req.url()).pathname.replace('/api/v1/', '');
    const ok = (data: any) => route.fulfill({ json: { success: true, data } });
    if (path === 'auth/me') return ok({ user: { id: 'owner' }, business, accountActive: true, csrfToken: 'a'.repeat(64), plan: { code: 'FREE' }, entitlements: { MAX_PRODUCTS: 10, MAX_CATEGORIES: 4 }, usage: { products: 1, categories: 1, videos: 0 }, onboarding: { designConfigured: true } });
    if (path === 'business/tutorial') return ok({ tutorial_status: 'COMPLETED' });
    if (path === 'categories') return ok(categories);
    if (path === 'design') return ok(design);
    if (path === 'items') return ok([product]);
    if (path === 'items/skewer/recommendations') return ok({ triggerProductId: 'skewer', recommendedProductIds: [] });
    if (path === 'items/skewer' && req.method() === 'PUT') { saved = req.postDataJSON(); product = { ...product, ...saved }; return ok(product); }
    if (path === 'public/menu/flavors') return ok({ business: { name: business.name, slug: business.slug, welcomeBgType: 'color', orderSettings: business.order_settings }, design: { templateKey: 'default', homeBlocks: design.home_blocks, customConfig: design.custom_config }, categories, items: [product] });
    return ok([]);
  });
  return { saved: () => saved, disableBeef: () => { product = { ...product, flavors: flavors.map(row => ({ ...row, isAvailable: row.name !== 'Picanha' })) }; } };
}
async function openMenu(page: Page) {
  await page.goto('/m/flavors'); await page.locator('.btn-enter-menu').click();
  await expect(page.locator('.cart-capsule-btn')).toBeVisible();
}
async function details(page: Page) {
  await page.locator('.cat-pill-label').filter({ hasText: 'Espetinhos' }).click();
  await page.locator('.btn-view-item').first().click();
  return page.locator('.product-modal-sheet');
}
test('flavors stay separate through prices, cart reload and the WhatsApp message', async ({ page }, info) => {
  const data = await setup(page); await openMenu(page);
  let detail = await details(page);
  await expect(detail.locator('.btn-sheet-add-cart')).toBeDisabled();
  await detail.getByRole('radio', { name: /Frango/ }).check();
  await expect(detail.locator('.btn-sheet-add-cart')).toContainText('10.00');
  await detail.locator('.btn-sheet-add-cart').click();
  detail = await details(page); await detail.getByRole('radio', { name: /Picanha/ }).check();
  await expect(detail.locator('.btn-sheet-add-cart')).toContainText('18.00');
  await detail.screenshot({ path: `../.tools/flavor-choice-${info.project.name}.png` });
  await detail.locator('.btn-sheet-add-cart').click();
  await page.locator('.cart-capsule-btn').click();
  await expect(page.locator('.cart-item-row')).toHaveCount(2);
  await expect(page.locator('.total-val')).toContainText('28,00');
  const link = await page.locator('.btn-order-checkout').getAttribute('href');
  const message = new URL(link!).searchParams.get('text')!;
  expect(message).toContain('Sabor: Frango'); expect(message).toContain('Sabor: Picanha');
  await openMenu(page); await page.locator('.cart-capsule-btn').click(); await expect(page.locator('.cart-item-row')).toHaveCount(2);
  data.disableBeef(); await openMenu(page); await page.locator('.cart-capsule-btn').click();
  await expect(page.locator('.btn-order-checkout')).toHaveCount(0);
  await expect(page.locator('.cart-list')).toContainText('Opção indisponível');
});
test('owner edits flavors with stable IDs and optional prices', async ({ page }) => {
  const data = await setup(page); await page.goto('/dashboard'); await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20000 });
  const nav = page.getByRole('navigation').getByRole('button', { name: 'Menu', exact: true });
  if (!await nav.isVisible()) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await nav.click(); await page.locator('.product-card button[title="Editar"]').click();
  const editor = page.locator('app-product-flavors-editor');
  await expect(editor.locator('.flavor-row')).toHaveCount(2);
  await editor.getByRole('button', { name: '+ Adicionar sabor', exact: true }).click();
  await expect(editor.locator('.flavor-row')).toHaveCount(3);
  await editor.getByLabel('Nome do sabor').last().fill('Cupim');
  await editor.getByLabel('Preço próprio (opcional)').last().fill('15');
  await page.getByRole('button', { name: 'Salvar Produto', exact: true }).click();
  await expect.poll(data.saved).toMatchObject({ flavors: [flavors[0], flavors[1], { name: 'Cupim', price: 15, isAvailable: true }] });
  expect(data.saved().flavors[2].id).toMatch(/^[a-f\d-]{36}$/);
});
