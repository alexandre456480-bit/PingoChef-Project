import { expect, Page, test } from '@playwright/test';

test.setTimeout(90_000);
const picture = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64');
async function fixture(page: Page) {
  let saved: any, created: any;
  const item = { id: 'burger', categoryId: 'food', subcategoryId: 'classic', name: 'Hambúrguer da casa', description: 'Ingredientes selecionados.', price: 25, promotionalPrice: 20, showPrice: true, isAvailable: true, isHighlighted: false, highlightType: 'none', imageUrl: 'https://images.example.test/product.png' };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('https://images.example.test/**', route => route.fulfill({ body: picture, contentType: 'image/png' }));
  await page.route(/^https:\/\/(fonts\.(googleapis|gstatic)\.com|images\.unsplash\.com)/, route => route.abort());
  await page.route('**/api/v1/**', route => {
    const req = route.request(), path = new URL(req.url()).pathname.replace('/api/v1/', '');
    const fulfill = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path === 'auth/me') return fulfill({ user: { id: 'owner', name: 'Ana' }, business: { id: 'tenant', name: 'Casa da Ana', slug: 'editor-test' }, accountActive: true, csrfToken: 'a'.repeat(64), plan: { code: 'FREE' }, entitlements: { MAX_PRODUCTS: 10, MAX_CATEGORIES: 4, MAX_VIDEOS: 1 }, usage: { products: 2, categories: 2, videos: 0 }, onboarding: { designConfigured: true } });
    if (path === 'business/tutorial') return fulfill({ tutorial_status: 'COMPLETED' });
    if (path === 'design') return fulfill({ template_key: 'default', home_blocks: [], custom_config: {} });
    if (path === 'categories') return fulfill([{ id: 'food', name: 'Pratos', isActive: true }, { id: 'drinks', name: 'Bebidas', isActive: true }]);
    if (path.startsWith('subcategories')) return fulfill([{ id: 'classic', categoryId: 'food', name: 'Clássicos' }]);
    if (path === 'items' && req.method() === 'POST') { created = req.postDataJSON(); return fulfill({ ...created, id: 'new' }); }
    if (path === 'items') return fulfill([{ ...item, ...saved }, { ...item, id: 'water', categoryId: 'drinks', subcategoryId: null, name: 'Água mineral', price: 5 }]);
    if (path === 'items/burger' && req.method() === 'PUT') { saved = req.postDataJSON(); return fulfill({ ...item, ...saved }); }
    if (path === 'items/burger/recommendations') return fulfill({ triggerProductId: 'burger', recommendedProductIds: [] });
    return fulfill([]);
  });
  await page.goto('/dashboard'); await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
  if ((page.viewportSize()?.width || 1280) <= 1024) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await page.locator('[data-tour="nav-menu"]').click();
  return { saved: () => saved, created: () => created };
}
async function edit(page: Page) {
  await page.locator('.product-card').filter({ hasText: 'Hambúrguer da casa' }).getByTitle('Editar', { exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar Produto', exact: true });
  await expect(dialog.locator('app-product-recommendations-editor')).toContainText('0/3');
  return dialog;
}

test('responsive item editor preserves every section and keeps actions visible in both themes', async ({ page }, info) => {
  await fixture(page);
  const widths = info.project.name.includes('mobile') ? [360, 390, 430] : [1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    const dialog = await edit(page);
    for (const theme of ['light', 'dark']) {
      await page.locator('.dashboard-shell').evaluate((el, value) => el.setAttribute('data-panel-theme', value), theme);
      const geometry = await dialog.evaluate(el => {
        const scroll = el.querySelector('.item-editor-scroll')!, footer = el.querySelector('.item-editor-footer')!.getBoundingClientRect(), box = el.getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width, bottom: footer.bottom, overflow: scroll.scrollWidth - scroll.clientWidth };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(0); expect(geometry.right).toBeLessThanOrEqual(width + 1); expect(geometry.bottom).toBeLessThanOrEqual(901); expect(geometry.overflow).toBeLessThanOrEqual(1);
      if (width > 1024) expect(geometry.width).toBeGreaterThan(900);
      await expect(dialog.getByRole('button', { name: 'Salvar Produto', exact: true })).toBeInViewport();
      await dialog.locator('.item-editor-scroll').evaluate(el => el.scrollTop = 0);
      await dialog.screenshot({ path: info.outputPath(`editor-${width}-${theme}.png`) });
      await dialog.locator('.item-editor-scroll').evaluate(el => el.scrollTop = el.scrollHeight);
      await expect(dialog.locator('app-product-recommendations-editor')).toBeInViewport();
      await expect(dialog.getByRole('button', { name: 'Salvar Produto', exact: true })).toBeInViewport();
    }
    await dialog.getByRole('button', { name: 'Fechar editor de produto' }).click();
  }
});

test('editing and creating preserve fields, prices, all highlights, photo modes and video safeguards', async ({ page }) => {
  const data = await fixture(page), dialog = await edit(page);
  await expect(dialog.getByLabel('Subcategoria', { exact: true })).toHaveValue('classic');
  await dialog.getByLabel('Nome do Produto', { exact: true }).fill('Hambúrguer especial');
  await dialog.getByLabel('Descrição', { exact: true }).fill('Pão, carne e queijo.');
  await dialog.getByLabel('Preço Regular (R$)', { exact: true }).fill('32');
  await dialog.getByLabel('Preço Promocional (R$)', { exact: true }).fill('29');
  const highlights = dialog.getByRole('group', { name: 'Tipo de Destaque', exact: true });
  for (const label of ['Padrão', 'Promoção', '+Curtidos', 'Prato Chefe', 'Combo', 'Mais Vendido']) {
    await highlights.getByRole('button', { name: label, exact: true }).click();
    await expect(highlights.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await dialog.getByLabel('Exibir preço no cardápio').uncheck();
  await expect(dialog.getByText(/Quando desativado/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Remover Imagem', exact: true }).click();
  await dialog.getByRole('button', { name: 'Upload de Foto', exact: true }).click();
  await dialog.locator('input[type=file][accept*="image/png"]').setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: picture });
  await expect(dialog.locator('.item-img-preview')).toBeVisible();
  await dialog.getByRole('button', { name: 'Inserir Link / URL', exact: true }).click();
  await dialog.getByLabel('Link da foto', { exact: true }).fill('https://images.example.test/updated.png');
  await dialog.getByRole('button', { name: 'Salvar Produto', exact: true }).click();
  await expect.poll(data.saved).toMatchObject({ name: 'Hambúrguer especial', description: 'Pão, carne e queijo.', categoryId: 'food', subcategoryId: 'classic', price: 32, promotionalPrice: 29, imageUrl: 'https://images.example.test/updated.png', showPrice: false, highlightType: 'best_seller', isHighlighted: true });
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Novo Produto', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'Novo Produto', exact: true });
  await expect(create.locator('app-product-recommendations-editor')).toHaveCount(0);
  await expect(create.locator('app-product-video-uploader')).toContainText('Salve o produto primeiro');
  await create.getByLabel('Nome do Produto', { exact: true }).fill('Suco da casa');
  await create.getByLabel('Categoria', { exact: true }).selectOption('drinks');
  await expect(create.getByLabel('Subcategoria', { exact: true })).toHaveCount(0);
  await create.getByLabel('Preço Regular (R$)', { exact: true }).fill('10');
  await create.getByRole('button', { name: 'Salvar Produto', exact: true }).click();
  await expect.poll(data.created).toMatchObject({ name: 'Suco da casa', categoryId: 'drinks', subcategoryId: null, price: 10, showPrice: true, highlightType: 'none' });
});
