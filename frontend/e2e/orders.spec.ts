import { expect, Page, test } from '@playwright/test';
test.setTimeout(60_000);

const enabled = { enabled: true, channel: 'whatsapp', url: 'https://wa.me/5511999999999', button_text: 'Pedir agora' };
async function fixture(page: Page) {
  let settings: any = { ...enabled, enabled: false, url: '', button_text: 'Fazer pedido' };
  let templateKey = 'default', writes = 0, cartEnabled = false, primaryColor = '#173E34';
  const items = [{ id: 'food', categoryId: 'food-cat', name: 'Açaí & frutas', price: 30, promotionalPrice: 25, isAvailable: true, isHighlighted: true, highlightType: 'chef', likesCount: 0, showPrice: true },
    { id: 'drink', categoryId: 'food-cat', name: 'Água', price: 5, isAvailable: true, likesCount: 0, showPrice: true }];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/^https:\/\/(fonts\.(googleapis|gstatic)\.com|images\.unsplash\.com)/, route => route.abort());
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname.replace('/api/v1/', '');
    const business = { id: 'tenant', name: 'Café da Praça', slug: 'orders-test', logo_url: '/logo_img.webp', welcome_bg_type: 'color', order_settings: settings };
    const fulfill = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path === 'auth/me') return fulfill({ user: { id: 'owner', name: 'Ana' }, business, accountActive: true, csrfToken: 'a'.repeat(64), plan: { code: 'FREE' }, entitlements: { MAX_PRODUCTS: 10, MAX_CATEGORIES: 4 }, usage: { products: 2, categories: 1, videos: 0 }, onboarding: { designConfigured: true } });
    if (path === 'business/tutorial') return fulfill({ tutorial_status: 'COMPLETED' });
    if (path === 'business') {
      if (req.method() === 'PUT') { settings = req.postDataJSON().order_settings; writes++; }
      return fulfill({ ...business, order_settings: settings });
    }
    const design = { templateKey, template_key: templateKey, palette: { key: 'custom', colors: { primary: primaryColor, secondary: '#849D90', accent: '#BA591B', background: '#F4F8F3', surface: '#FFFFFF', textPrimary: '#183027', textSecondary: '#586A61' } },
      homeBlocks: [{ id: 'hero', type: 'hero', enabled: true, position: 0 }, { id: 'categories', type: 'categories', enabled: true, position: 1 }], customConfig: { enable_cart: cartEnabled }, custom_config: { enable_cart: cartEnabled } };
    if (path === 'design') return fulfill(design);
    if (path === 'categories') return fulfill([{ id: 'food-cat', name: 'Pratos', iconType: 'none', isActive: true }]);
    if (path === 'items') return fulfill(items);
    if (path === 'public/menu/orders-test') return fulfill({ business: { name: business.name, slug: business.slug, logoUrl: business.logo_url, welcomeBgType: 'color', orderSettings: settings }, design,
      categories: [{ id: 'food-cat', name: 'Pratos', iconType: 'none' }], subcategories: [], items });
    return fulfill([]);
  });
  return { settings: (value: any) => settings = value, current: () => settings, writes: () => writes, template: (key: string) => templateKey = key, cart: (value: boolean) => cartEnabled = value, primary: (color: string) => primaryColor = color };
}
async function company(page: Page) {
  await page.goto('/dashboard');
  await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
  const nav = page.locator('[data-tour="nav-empresa"]');
  if (!(await nav.isVisible())) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await nav.click();
  await expect(page.locator('app-order-settings-editor')).toBeVisible();
}
async function menu(page: Page) {
  await page.goto('/m/orders-test');
  await page.getByRole('button', { name: 'Ver o Cardápio', exact: true }).click();
}
async function seedCart(page: Page, slug = 'orders-test') {
  await page.addInitScript(({ slug }) => localStorage.setItem(`cart_${slug}`, JSON.stringify([
    { itemId: 'food', name: 'Açaí & frutas', price: 30, promotionalPrice: 25, quantity: 2 },
    { itemId: 'drink', name: 'Água', price: 5, quantity: 1 },
  ])), { slug });
}

test('checkout text keeps the palette contrast inside the dashboard phone preview', async ({ page }, info) => {
  test.skip(info.project.name.includes('mobile'), 'Desktop phone preview; public mobile is covered separately.');
  const data = await fixture(page); data.settings(enabled);
  await seedCart(page, 'sapatolandia-gourmet');
  await company(page);
  const preview = page.locator('.preview-panel app-public-menu-view');
  await preview.getByRole('button', { name: 'Ver o Cardápio', exact: true }).click();
  await preview.locator('.cart-capsule-btn').click();
  const checkout = preview.getByRole('link', { name: enabled.button_text });
  for (const theme of ['dark', 'light']) {
    await page.locator('.dashboard-shell').evaluate((element, value) => element.setAttribute('data-panel-theme', value), theme);
    await expect(checkout).toHaveCSS('background-color', 'rgb(23, 62, 52)');
    await expect(checkout).toHaveCSS('color', 'rgb(255, 255, 255)');
  }
});

test('company saves, reloads, rejects unsafe links and disables orders in both panel themes', async ({ page }, info) => {
  const data = await fixture(page);
  await company(page);
  const editor = page.locator('app-order-settings-editor');
  await editor.getByLabel('Permitir pedidos').check();
  await editor.getByLabel('Link', { exact: true }).fill(enabled.url);
  await editor.getByLabel('Texto do botão').fill('Pedir agora');
  await expect(editor.locator('.preview-button')).toContainText('Pedir agora');
  await expect(editor.locator('.preview-button')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(editor.locator('.preview-button')).toHaveCSS('background-color', 'rgb(23, 62, 52)');
  for (const theme of ['dark', 'light']) {
    await page.locator('.dashboard-shell').evaluate((el, value) => el.setAttribute('data-panel-theme', value), theme);
    await editor.scrollIntoViewIfNeeded();
    const layout = await editor.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth }));
    expect(layout.scroll).toBeLessThanOrEqual(layout.width + 1);
    await editor.screenshot({ path: info.outputPath(`orders-panel-${theme}.png`) });
  }
  await page.getByRole('button', { name: 'Salvar e Sincronizar' }).click();
  await expect.poll(data.writes).toBe(1);
  expect(data.current()).toEqual(enabled);
  await company(page);
  await expect(editor.getByLabel('Texto do botão')).toHaveValue('Pedir agora');
  await editor.getByLabel('Link', { exact: true }).fill('https://wa.me.evil.com/5511999999999');
  await editor.getByLabel('Texto do botão').focus();
  await expect(editor.locator('#order-error')).toContainText('DDI');
  await page.getByRole('button', { name: 'Salvar e Sincronizar' }).click();
  expect(data.writes()).toBe(1);
  await editor.getByLabel('Permitir pedidos').uncheck();
  await page.getByRole('button', { name: 'Salvar e Sincronizar' }).click();
  await expect.poll(() => data.current().enabled).toBe(false);
  await menu(page);
  await expect(page.locator('.cart-capsule-btn')).toHaveCount(0);
});

test('WhatsApp receives only the greeting and items with quantities; checkout keeps the cart', async ({ page, context }, info) => {
  const data = await fixture(page); data.settings(enabled);
  await seedCart(page);
  await context.route('https://wa.me/**', route => route.fulfill({ contentType: 'text/html', body: '<title>WhatsApp destination</title>' }));
  await menu(page);
  await page.locator('.cart-capsule-btn').click();
  const checkout = page.getByRole('link', { name: 'Pedir agora' });
  const href = await checkout.getAttribute('href');
  const message = new URL(href!).searchParams.get('text')!;
  expect(message).toBe('Olá! Gostaria de fazer um pedido em Café da Praça:\n\n2x Açaí & frutas\n1x Água');
  await expect(checkout).toHaveCSS('background-color', 'rgb(23, 62, 52)');
  await expect(checkout).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.locator('.cart-drawer-sheet').screenshot({ path: info.outputPath('orders-whatsapp-cart.png') });
  const popupPromise = page.waitForEvent('popup');
  await checkout.focus(); await page.keyboard.press('Enter');
  const popup = await popupPromise; await popup.waitForLoadState();
  expect(popup.url()).toBe(href); await popup.close();
  await expect(page.locator('.cart-item-row')).toHaveCount(2);
  await page.locator('.c-qty-btn').nth(1).click();
  const updated = new URL((await checkout.getAttribute('href'))!).searchParams.get('text')!;
  expect(updated).toBe('Olá! Gostaria de fazer um pedido em Café da Praça:\n\n3x Açaí & frutas\n1x Água');
  await page.getByRole('button', { name: 'Limpar tudo', exact: true }).click();
  await expect(checkout).toHaveCount(0);
  await expect(page.getByText('Seu carrinho está vazio')).toBeVisible();
  await page.locator('.drawer-close-btn').click();
  await page.getByRole('button', { name: 'Pratos', exact: true }).click();
  await page.getByRole('button', { name: 'Ver detalhes de Açaí & frutas', exact: true }).first().click();
  await page.locator('.btn-sheet-add-cart').click();
  await page.locator('.cart-capsule-btn').click();
  await expect(checkout).toBeVisible();
  expect(new URL((await checkout.getAttribute('href'))!).searchParams.get('text')).toContain('1x Açaí & frutas');
});

test('custom delivery opens exactly its link and disabled settings preserve the list-only cart', async ({ page, context }, info) => {
  const data = await fixture(page);
  const custom = { ...enabled, channel: 'delivery', url: 'https://pedido.com.br/order?store=1', button_text: 'Pedir no delivery' };
  data.settings(custom); data.template('pixel');
  data.primary('#FDE68A');
  await seedCart(page);
  await context.route('https://pedido.com.br/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Delivery destination</title>' }));
  await menu(page); await page.locator('.cart-capsule-btn').click();
  const link = page.getByRole('link', { name: custom.button_text });
  await expect(link).toHaveAttribute('href', custom.url);
  await expect(link).toHaveCSS('background-color', 'rgb(253, 230, 138)');
  await expect(link).toHaveCSS('color', 'rgb(0, 0, 0)');
  await expect(page.locator('.cart-security-notice')).toContainText('não são transferidos automaticamente');
  await page.locator('.cart-drawer-sheet').screenshot({ path: info.outputPath('orders-pixel-cart.png') });
  const popupPromise = page.waitForEvent('popup'); await link.click();
  const popup = await popupPromise; await expect(popup).toHaveURL(custom.url); await popup.close();
  data.settings({ ...custom, enabled: false });
  data.cart(true);
  await menu(page);
  await page.locator('.cart-capsule-btn').click();
  await expect(page.locator('.btn-order-checkout')).toHaveCount(0);
  await expect(page.locator('.cart-security-notice')).toContainText('não envia o pedido');
});
