import { expect as baseExpect, Page, test } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 20_000 });
test.setTimeout(120_000);
const palette = { key: 'gourmet_royal', name: 'Gourmet Royal', colors: { primary: '#8B1A3A', secondary: '#D26E2D', accent: '#F47B20',
  background: '#FAF5F0', surface: '#FFFFFF', textPrimary: '#2D1822', textSecondary: '#6E5D65' } };
const sections = ['categories', 'promotion', 'most_liked', 'featured_product', 'combo', 'best_seller'];
const items = ['promotion', 'most_liked', 'chef', 'combo', 'best_seller'].map((highlightType, i) => ({
  id: `item-${i}`, categoryId: 'category', name: `Prato ${i + 1}`, description: 'Da casa', price: 25,
  promotionalPrice: highlightType === 'promotion' ? 20 : null, isAvailable: true, highlightType, likesCount: 3,
}));
async function fixture(page: Page) {
  let design: any = { template_key: 'modern', palette, home_blocks: sections.map((type, position) => ({ id: type, type, label: type, enabled: true, position })),
    custom_config: { hero_banners: [], intro_card: { enabled: false }, enable_likes: true, enable_cart: false } };
  await page.route(/^https:\/\/(fonts\.(googleapis|gstatic)\.com|images\.unsplash\.com)/, route => route.abort());
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname.replace('/api/v1/', '');
    const fulfill = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path === 'auth/me') return fulfill({ user: { id: 'owner', name: 'Ana' }, business: { id: 'tenant', name: 'Casa da Ana', slug: 'icon-test' },
      accountActive: true, csrfToken: 'a'.repeat(64), plan: { code: 'FREE' }, entitlements: { MAX_PRODUCTS: 10, MAX_CATEGORIES: 4 },
      usage: { products: 5, categories: 1, videos: 0 }, onboarding: { designConfigured: true } });
    if (path === 'business/tutorial') return fulfill({ tutorial_status: 'COMPLETED' });
    if (path === 'design') { if (req.method() === 'PUT') design = req.postDataJSON(); return fulfill(design); }
    if (path === 'items') return fulfill(items);
    if (path === 'categories') return fulfill([{ id: 'category', name: 'Pratos', iconType: 'none', isActive: true, displayOrder: 0 }]);
    if (path === 'public/menu/icon-test') return fulfill({ business: { name: 'Casa da Ana', slug: 'icon-test', welcomeBgType: 'color', welcomeBgColor: '#281320' },
      design: { templateKey: design.template_key, palette: design.palette, homeBlocks: design.home_blocks, heroBanners: [], customConfig: design.custom_config },
      categories: [{ id: 'category', name: 'Pratos', iconType: 'none', isActive: true, displayOrder: 0 }], subcategories: [], items });
    return fulfill([]);
  });
  return { saved: () => design };
}
async function openDesign(page: Page) {
  await page.goto('/dashboard'); await expect(page.locator('app-dashboard-home')).toBeVisible();
  const nav = page.locator('[data-tour="nav-design"]');
  if (!await nav.isVisible()) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await nav.click();
  await page.getByRole('heading', { name: 'Ícones da Página Inicial', exact: true }).click();
  return page.locator('app-home-icons-editor');
}
async function choose(page: Page, editor: ReturnType<Page['locator']>, section: string, option: 'none' | 'default' | 'star') {
  await editor.getByRole('button', { name: 'Escolher ícone de ' + section, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ícone de ' + section, exact: true });
  await expect(dialog).toBeVisible();
  if (option === 'star') {
    await dialog.getByRole('searchbox', { name: 'Buscar no catálogo' }).fill('estrela');
    await dialog.getByRole('group', { name: 'Estilo dos ícones' }).getByRole('button', { name: '2D', exact: true }).click();
    await dialog.getByRole('button', { name: 'Sugestão do Chef · 2D', exact: true }).click();
  } else await dialog.getByRole('button', { name: option === 'none' ? 'Sem ícone' : 'Padrão', exact: true }).click();
  await dialog.getByRole('button', { name: 'Aplicar ícone', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
test('independent icons, no icon, preview, persistence and both public navigation variants', async ({ page }, info) => {
  const data = await fixture(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  const editor = await openDesign(page);
  await expect(editor.locator('.icon-row')).toHaveCount(6);
  await choose(page, editor, 'Início', 'star');
  await choose(page, editor, 'Mais Curtidos', 'none');
  await choose(page, editor, 'Pratos do Chef', 'star');
  // Cancel is local to the picker and must not erase the selected Home icon.
  await editor.getByRole('button', { name: 'Escolher ícone de Início', exact: true }).click();
  await page.getByRole('button', { name: 'Sem ícone', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Escolher ícone de Início', exact: true })).toContainText('Sugestão do Chef');
  await page.getByRole('button', { name: 'Salvar Alterações', exact: true }).click();
  await expect(page.locator('.saved-badge')).toBeVisible();
  expect(data.saved().custom_config).toMatchObject({ enable_likes: true, enable_cart: false, home_icons: { home: '2d-star', most_liked: null, featured_product: '2d-star' } });
  await page.reload();
  const nav = page.locator('[data-tour="nav-design"]'); await expect(page.locator('app-dashboard-home')).toBeVisible();
  if (!await nav.isVisible()) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await nav.click(); await page.getByRole('heading', { name: 'Ícones da Página Inicial', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Escolher ícone de Mais Curtidos', exact: true })).toContainText('Sem ícone');
  if (info.project.name === 'chromium-desktop') {
    const preview = page.locator('.preview-panel');
    await preview.getByRole('button', { name: 'Ver o Cardápio', exact: true }).click();
    await expect(preview.getByRole('heading', { name: 'Os Mais Curtidos', exact: true }).locator('.block-title-icon')).toHaveCount(0);
    await expect(preview.getByRole('heading', { name: 'Pratos do Chef & Especialidades', exact: true }).locator('app-menu-home-icon svg')).toHaveCount(1);
  }
  await page.goto('/m/icon-test'); await page.getByRole('button', { name: 'Ver o Cardápio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Os Mais Curtidos', exact: true }).locator('.block-title-icon')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Pratos do Chef & Especialidades', exact: true }).locator('app-menu-home-icon svg')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Início', exact: true }).locator('app-menu-home-icon svg')).toHaveCount(1);
  await page.getByRole('button', { name: 'Pratos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Início', exact: true }).locator('app-menu-home-icon svg')).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('home-icons-public.png') });
  data.saved().custom_config.home_icons = Object.fromEntries(['home', 'promotion', 'most_liked', 'featured_product', 'combo', 'best_seller'].map(key => [key, null]));
  await page.reload(); await page.getByRole('button', { name: 'Ver o Cardápio', exact: true }).click();
  await expect(page.locator('.block-title-icon')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Início', exact: true }).locator('.cat-pill-icon, app-menu-home-icon')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pratos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Início', exact: true }).locator('.cat-pill-icon, app-menu-home-icon')).toHaveCount(0);
});
test('picker fits narrow screens and themes, filters the catalog and restores defaults', async ({ page }, info) => {
  await fixture(page); await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: info.project.name === 'chromium-mobile' ? 360 : 1440, height: 900 });
  const editor = await openDesign(page);
  await choose(page, editor, 'Início', 'none');
  await choose(page, editor, 'Início', 'default');
  await expect(editor.getByRole('button', { name: 'Escolher ícone de Início', exact: true })).toContainText('Padrão do PingoChef');
  for (const width of [1440, 768, 430, 390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    await editor.getByRole('button', { name: 'Escolher ícone de Combos Especiais', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('searchbox', { name: 'Buscar no catálogo' }).fill('zzzz-sem-resultado');
    await expect(dialog.getByText('Nenhum ícone encontrado')).toBeVisible();
    await dialog.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
    await expect(dialog.locator('.catalog-option').first()).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(845);
    await expect(dialog.getByRole('button', { name: 'Aplicar ícone', exact: true })).toBeInViewport();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`home-icons-picker-${width}.png`) });
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  }
  await page.locator('.theme-toggle-btn').click();
  await editor.getByRole('button', { name: 'Escolher ícone de Promoções & Ofertas', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aplicar ícone', exact: true })).toBeInViewport();
});

test('expanded libraries and emoji choices persist into the public menu', async ({ page }, info) => {
  const data = await fixture(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  const editor = await openDesign(page);
  await editor.getByRole('button', { name: 'Escolher ícone de Início', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('group', { name: 'Estilo dos ícones' }).getByRole('button', { name: 'Emojis', exact: true }).click();
  await dialog.getByRole('searchbox').fill('coração vermelho');
  await dialog.getByRole('button', { name: 'coração vermelho · Emoji', exact: true }).click();
  await dialog.getByRole('button', { name: 'Aplicar ícone', exact: true }).click();

  await editor.getByRole('button', { name: 'Escolher ícone de Pratos do Chef', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('group', { name: 'Estilo dos ícones' }).getByRole('button', { name: '3D', exact: true }).click();
  await dialog.getByRole('searchbox').fill('trofeu');
  await dialog.getByRole('button', { name: 'Troféu dourado · 3D', exact: true }).click();
  await dialog.getByRole('button', { name: 'Aplicar ícone', exact: true }).click();

  await editor.getByRole('button', { name: 'Escolher ícone de Mais Curtidos', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('searchbox').fill('troféu');
  await dialog.getByRole('button', { name: 'Troféu clássico · 2D', exact: true }).click();
  await dialog.getByRole('button', { name: 'Aplicar ícone', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar Alterações', exact: true }).click();
  await expect(page.locator('.saved-badge')).toBeVisible();
  expect(data.saved().custom_config.home_icons).toMatchObject({ home: 'emoji-2764-fe0f', featured_product: '3d-fluent-trophy', most_liked: '2d-phosphor-trophy' });
  await page.goto('/m/icon-test'); await page.getByRole('button', { name: 'Ver o Cardápio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Início', exact: true }).locator('svg text')).toHaveText('❤️');
  const image = page.getByRole('heading', { name: 'Pratos do Chef & Especialidades', exact: true }).locator('svg image');
  await expect(image).toHaveAttribute('href', '/assets/catalog/fluent-trophy.png');
  expect(await page.evaluate(async () => (await fetch('/assets/catalog/fluent-trophy.png')).ok)).toBe(true);
  await expect(page.getByRole('heading', { name: 'Os Mais Curtidos', exact: true }).locator('svg path')).not.toHaveCount(0);
  await page.screenshot({ path: info.outputPath('expanded-icons-public.png') });
});

test('emoji catalog retries loading, paginates and searches all categories and skin tones', async ({ page }, info) => {
  await fixture(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  let fail = true;
  await page.route('**/assets/catalog/emojis-pt.json', route => fail
    ? route.fulfill({ status: 503, body: '' }) : route.fallback());
  const editor = await openDesign(page);
  await editor.getByRole('button', { name: 'Escolher ícone de Início', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Não foi possível carregar os emojis.', { exact: false })).toBeVisible();
  fail = false; await dialog.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await dialog.getByRole('group', { name: 'Estilo dos ícones' }).getByRole('button', { name: 'Emojis', exact: true }).click();
  await expect(dialog.locator('.catalog-option')).toHaveCount(96);
  await dialog.getByRole('button', { name: /Mostrar mais/ }).click();
  await expect(dialog.locator('.catalog-option')).toHaveCount(192);
  await dialog.getByRole('combobox', { name: 'Categoria de emojis' }).selectOption('9');
  await dialog.getByRole('searchbox').fill('brasil');
  await expect(dialog.getByRole('button', { name: 'bandeira: Brasil · Emoji', exact: true })).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Categoria de emojis' }).selectOption('all');
  await dialog.getByRole('searchbox').fill('mão acenando pele morena');
  await expect(dialog.getByRole('button', { name: 'mão acenando: pele morena · Emoji', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'mão acenando: pele morena · Emoji', exact: true }).click();
  await page.screenshot({ path: info.outputPath('emoji-picker.png') });
  await dialog.getByRole('button', { name: 'Aplicar ícone', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Escolher ícone de Início', exact: true })).toContainText('mão acenando: pele morena');
});
