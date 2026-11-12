import { expect, Page, test } from '@playwright/test';
test.setTimeout(90_000);

async function setup(page: Page) {
  if ((page.viewportSize()?.width || 1280) < 600) await page.setViewportSize({ width: 320, height: 844 });
  let categories = ['Lanches', 'Bebidas', 'Sobremesas'].map((name, displayOrder) => ({ id: `cat-${displayOrder}`, name, displayOrder, isActive: true }));
  let business: any = { id: 'tenant', name: 'Casa Jardim', slug: 'casa-jardim', welcome_bg_type: 'color', welcome_bg_color: '#ffffff' };
  let failOrder = false;
  const writes: any[] = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/^https:\/\/(fonts\.|images\.unsplash)/, r => r.abort());
  await page.route('**/api/v1/**', route => {
    const req = route.request(), path = new URL(req.url()).pathname.replace('/api/v1/', '');
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path === 'auth/me') return ok({ user: { id: 'owner', name: 'Ana' }, business, accountActive: true, csrfToken: 'a'.repeat(64), plan: { code: 'PRO' }, entitlements: { MAX_PRODUCTS: 100, MAX_CATEGORIES: 20 }, usage: { products: 0, categories: 3, videos: 0 }, onboarding: { designConfigured: true } });
    if (path === 'business/tutorial') return ok({ tutorial_status: 'COMPLETED' });
    if (path === 'categories') return ok(categories);
    if (path === 'categories/reorder') {
      const body = req.postDataJSON(); writes.push(body);
      if (failOrder) { failOrder = false; return route.fulfill({ status: 503, json: { error: { message: 'Offline' } } }); }
      categories = categories.map(row => ({ ...row, displayOrder: body.orders.find((o: any) => o.id === row.id).displayOrder })).sort((a, b) => a.displayOrder - b.displayOrder);
      return ok({});
    }
    if (path === 'business') { if (req.method() === 'PUT') business = { ...business, ...req.postDataJSON() }; return ok(business); }
    if (path === 'design') return ok({ template_key: 'default', home_blocks: [], custom_config: {} });
    return ok([]);
  });
  await page.goto('/dashboard'); await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
  return { writes, failNext: () => { failOrder = true; } };
}
async function navigate(page: Page, name: string) {
  await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
  const button = page.getByRole('navigation').getByRole('button', { name, exact: true });
  if (!await button.isVisible()) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await button.click();
}

test('category ordering supports cancel, arbitrary positions, retry and persisted display order', async ({ page }) => {
  const state = await setup(page); await navigate(page, 'Menu');
  const organize = page.getByRole('button', { name: 'Organizar', exact: true });
  await organize.click();
  let dialog = page.getByRole('dialog', { name: 'Organizar categorias' });
  if ((page.viewportSize()?.width || 0) > 600) {
    await dialog.locator('li').first().dragTo(dialog.locator('li').last());
    await expect(dialog.locator('li strong')).toHaveText(['Bebidas', 'Sobremesas', 'Lanches']);
  } else {
    await dialog.getByRole('button', { name: 'Descer Lanches' }).click();
  }
  await dialog.getByRole('combobox', { name: 'Posição de Lanches' }).selectOption({ label: '3º' });
  await expect(dialog.locator('li strong')).toHaveText(['Bebidas', 'Sobremesas', 'Lanches']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.screenshot({ path: `../.tools/category-order-${page.viewportSize()?.width}.png` });
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click(); expect(state.writes).toHaveLength(0);
  await organize.click(); dialog = page.getByRole('dialog', { name: 'Organizar categorias' });
  await expect(dialog.locator('li strong')).toHaveText(['Lanches', 'Bebidas', 'Sobremesas']);
  await dialog.getByRole('combobox', { name: 'Posição de Lanches' }).selectOption({ label: '3º' });
  state.failNext(); await dialog.getByRole('button', { name: 'Salvar ordem' }).click();
  await expect(dialog.getByRole('status')).toContainText('ordem anterior foi mantida');
  await dialog.getByRole('button', { name: 'Salvar ordem' }).click(); await expect(dialog).toHaveCount(0);
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1].orders).toEqual([{ id: 'cat-1', displayOrder: 0 }, { id: 'cat-2', displayOrder: 1 }, { id: 'cat-0', displayOrder: 2 }]);
  await page.reload(); await navigate(page, 'Menu'); await organize.click();
  await expect(page.getByRole('dialog').locator('li strong')).toHaveText(['Bebidas', 'Sobremesas', 'Lanches']);
});

test('crop supports cancellation, keyboard panning, bounded pixels and no save until confirmation', async ({ page }) => {
  await setup(page); await navigate(page, 'Empresa');
  const source = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 400;
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 400, 400); ctx.fillStyle = '#0000ff'; ctx.fillRect(400, 0, 400, 400);
    return c.toDataURL('image/png');
  });
  const file = { name: 'colors.png', mimeType: 'image/png', buffer: Buffer.from(source.split(',')[1], 'base64') };
  const upload = page.locator('app-business-editor input[type=file]').first();
  const logo = page.locator('app-business-editor .logo-img');
  const previous = await logo.count() ? await logo.getAttribute('src') : null;
  await upload.setInputFiles(file); await expect(page.getByRole('dialog', { name: 'Logo da empresa' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('app-image-crop')).toHaveCount(0);
  if (previous) await expect(page.locator('app-business-editor .logo-img')).toHaveAttribute('src', previous);
  await upload.setInputFiles(file);
  const crop = page.getByRole('dialog', { name: 'Logo da empresa' });
  await expect(crop.getByRole('button', { name: 'Usar imagem' })).toBeEnabled();
  await crop.getByRole('button', { name: 'Preencher moldura' }).click();
  await crop.getByRole('slider').press('ArrowRight');
  await crop.getByRole('group').focus(); for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
  await crop.screenshot({ path: `../.tools/image-crop-${page.viewportSize()?.width}.png` });
  await crop.getByRole('button', { name: 'Usar imagem' }).click(); await expect(crop).toHaveCount(0);
  const pixels = await page.locator('app-business-editor .logo-img').evaluate(async (el: HTMLImageElement) => {
    await el.decode(); const c = document.createElement('canvas'); c.width = el.naturalWidth; c.height = el.naturalHeight;
    const ctx = c.getContext('2d')!; ctx.drawImage(el, 0, 0); return { width: c.width, height: c.height, center: [...ctx.getImageData(c.width / 2, c.height / 2, 1, 1).data] };
  });
  expect(pixels.width).toBe(pixels.height); expect(pixels.width).toBeLessThanOrEqual(400);
  expect(pixels.center[0]).toBeGreaterThan(240); expect(pixels.center[2]).toBeLessThan(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
