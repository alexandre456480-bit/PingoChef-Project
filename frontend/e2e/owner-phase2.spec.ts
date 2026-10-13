import { expect, test, Page } from '@playwright/test';
import { analyticsOptions, analyticsReport } from './analytics-fixture';

const matrix = {
  FREE: [10, 4, 1, false, false],
  BASIC: [30, 10, 7, true, false],
  MEDIUM: [70, 25, 25, true, true],
  PRO: [150, 40, 40, true, true],
} as const;
const names = { FREE: 'Free', BASIC: 'Basic', MEDIUM: 'Medium', PRO: 'Pro' };
const id = '22222222-2222-4222-8222-222222222222';
const intent = '11111111-1111-4111-8111-111111111111';
async function mockApi(
  page: Page,
  code: keyof typeof matrix = 'FREE',
  options: { expired?: boolean; delay?: number } = {},
) {
  let ended = options.expired === true;
  const [products, categories, videos, analytics, qr] = matrix[code];
  const posts: { path: string; body: any; headers: any }[] = [];
  const account = {
    user: { id: 'owner', email: 'owner@example.test', name: 'Maria' },
    business: { id, name: 'Bistrô PingoChef', slug: 'bistro' },
    accountActive: true,
    provisioningRequired: false,
    plan: { code, name: names[code] },
    entitlements: {
      MAX_PRODUCTS: products,
      MAX_CATEGORIES: categories,
      MAX_VIDEOS: videos,
      ANALYTICS_BASIC: analytics,
      ANALYTICS_ADVANCED: code === 'MEDIUM' || code === 'PRO',
      ANALYTICS_EXPORT: code === 'PRO',
      QR_GENERATOR: qr,
      QR_CUSTOMIZATION: qr,
      VIDEO_UPLOAD: true,
    },
    usage: { products: products, categories: 1, videos: 0 },
    csrfToken: 'a'.repeat(64),
    isPublished: false,
    onboarding: { designConfigured: false },
  };
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1/', '');
    if (request.method() === 'POST')
      posts.push({ path, body: request.postDataJSON(), headers: request.headers() });
    if (path === 'auth/me') {
      if (options.delay) await new Promise((r) => setTimeout(r, options.delay));
      return route.fulfill({
        status: ended ? 401 : 200,
        json:
          ended
            ? { error: { code: 'SESSION_EXPIRED' } }
            : { success: true, data: account },
      });
    }
    if (path === 'auth/plans')
      return route.fulfill({
        json: {
          success: true,
          data: {
            pricesProvisional: true,
            billingAvailable: false,
            plans: Object.entries(matrix).map(([code, values], i) => ({
              code,
              name: names[code as keyof typeof matrix],
              products: values[0],
              categories: values[1],
              videos: values[2],
              priceCents: [0, 2990, 5990, 9990][i],
              profile: [
                'Para experimentar',
                'Para pequenos negócios',
                'Para crescer',
                'Para operações maiores',
              ][i],
              features:
                i === 0
                  ? []
                  : i === 1
                    ? ['Analytics essencial']
                    : ['Analytics avançado', 'QR Code personalizado'],
              available: code === 'FREE',
            })),
          },
        },
      });
    if (path === 'auth/plan-intents' || path === 'auth/plan-intents/' + intent)
      return route.fulfill({
        status: request.method() === 'POST' ? 201 : 200,
        json: {
          success: true,
          data: {
            id: intent,
            plan: { code: 'FREE', name: 'Free' },
            expiresAt: new Date(Date.now() + 1800000).toISOString(),
          },
        },
      });
    if (path === 'auth/register')
      return route.fulfill({
        status: 202,
        json: { success: true, data: { status: 'REGISTRATION_ACCEPTED' } },
      });
    if (path === 'auth/login') {
      ended = false;
      return route.fulfill({ json: { success: true, data: account } });
    }
    if (path === 'auth/logout' || path === 'auth/logout-all' || path === 'auth/change-password') {
      ended = true;
      return route.fulfill({ status: 204 });
    }
    if (path === 'auth/delete-account') {
      ended = true;
      return route.fulfill({
        json: {
          success: true,
          data: { status: 'PENDING_DELETION', scheduledAt: new Date().toISOString() },
        },
      });
    }
    if (path === 'business')
      return route.fulfill({ json: { success: true, data: account.business } });
    if (path === 'design') return route.fulfill({ json: { success: true, data: {} } });
    if (path === 'qr') return route.fulfill({json:{success:true,data:{rows:[],limit:3,customization:qr,publicAvailable:false}}});
    if (path === 'analytics/options')
      return route.fulfill({ json: { success: true, data: analyticsOptions(code) } });
    if (path === 'analytics')
      return route.fulfill({
        json: { success: true, data: analyticsReport(code, new URL(request.url()).searchParams) },
      });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  return { account, posts };
}
async function navigation(page: Page, label: string) {
  const button = page.locator('app-sidebar .nav-item').filter({ hasText: label });
  await expect(button).toBeAttached();
  const hamburger = page.getByRole('button', { name: 'Abrir menu', exact: true });
  const box = await button.boundingBox();
  if (await hamburger.isVisible() && (!(await button.isVisible()) || (box && box.x < 0)))
    await hamburger.click();
  await button.click();
}
async function settings(page: Page) {
  const gear = page.locator('app-sidebar').getByRole('button', { name: 'Abrir configurações', includeHidden: true });
  const box = await gear.boundingBox();
  if (!box || box.x < 0)
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await gear.click();
  await expect(page.getByRole('dialog', { name: 'Configurações' })).toBeVisible();
}

test('plans remain readable on wide desktop, notebook, tablet and mobile; paid signup is unavailable', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/plans');
  for (const width of [1600, 1280, 900, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.plan-card')).toHaveCount(4);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect((await page.locator('.plan-card').first().boundingBox())!.width).toBeGreaterThan(220);
  }
  await expect(page.locator('.recommended .recommendation')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Em breve' })).toHaveCount(3);
  await page.screenshot({
    path: '../.tools/phase2-pricing-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Começar no Free' }).click();
  await expect(page).toHaveURL(/register\?intent=/);
  await expect(page.getByText('Plano Free', { exact: true })).toBeVisible();
});
test('signup sends server intent and consent, then logs in without email verification', async ({
  page,
}) => {
  const { posts } = await mockApi(page, 'FREE', { expired: true });
  await page.goto('/register?intent=' + intent);
  await page.getByLabel('Seu nome').fill('Maria Silva');
  await page.getByLabel('Nome do estabelecimento').fill('Bistro Teste');
  await page.getByLabel('E-mail', { exact: true }).fill('maria@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('StrongPassword123!');
  await page.getByLabel('Confirmar senha').fill('StrongPassword123!');
  await page.getByRole('checkbox', { name: /Li e aceito/ }).check();
  await page.getByRole('button', { name: 'Criar conta no Free' }).click();
  await expect(page).toHaveURL(/login\?registration=received/);
  await expect(page.getByRole('status')).toContainText('Cadastro recebido');
  await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue('maria@example.test');
  await expect(page.getByRole('button', { name: 'Reenviar confirmação' })).toHaveCount(0);
  expect(posts.find((p) => p.path === 'auth/register')?.body).toMatchObject({
    intentId: intent,
    termsAccepted: true,
  });
  expect(posts.find((p) => p.path === 'auth/register')?.body.planCode).toBeUndefined();
  await page.getByLabel('Senha', { exact: true }).fill('StrongPassword123!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  expect(posts.some((p) => p.path === 'auth/resend-confirmation')).toBe(false);
});
test('signup keeps the form when an older backend still responds with email verification', async ({ page }) => {
  await mockApi(page, 'FREE', { expired: true });
  await page.route('**/api/v1/auth/register', route => route.fulfill({
    status: 202, json: { success: true, data: { status: 'AWAITING_EMAIL' } },
  }));
  await page.goto('/register?intent=' + intent);
  await page.getByLabel('Seu nome').fill('Maria Silva');
  await page.getByLabel('Nome do estabelecimento').fill('Bistro Teste');
  await page.getByLabel('E-mail', { exact: true }).fill('maria@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('StrongPassword123!');
  await page.getByLabel('Confirmar senha').fill('StrongPassword123!');
  await page.getByRole('checkbox', { name: /Li e aceito/ }).check();
  await page.getByRole('button', { name: 'Criar conta no Free' }).click();
  await expect(page).toHaveURL(/register\?intent=/);
  await expect(page.getByRole('alert')).toContainText('Não foi possível concluir o cadastro');
  await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue('maria@example.test');
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('StrongPassword123!');
});

test('direct generic signup returns to plan choice; expired session never renders dashboard', async ({
  page,
}) => {
  await mockApi(page, 'FREE', { expired: true, delay: 250 });
  await page.goto('/register');
  await expect(page).toHaveURL(/plans/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/login/);
  await expect(page.locator('app-sidebar')).toHaveCount(0);
  await expect(page.getByText('Sua sessão expirou.', { exact: false })).toBeVisible();
});
for (const code of Object.keys(matrix) as (keyof typeof matrix)[]) {
  test(`${code}: backend limits, visible gates, settings and reduced motion`, async ({ page }) => {
    const { account } = await mockApi(page, code);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/dashboard');
    await expect(page.locator('app-plan-usage')).toHaveCount(0);
    await navigation(page, 'Menu');
    await expect(page.locator('app-menu-editor')).toBeVisible();
    await expect(page.locator('app-plan-usage')).toHaveCount(0);
    await expect(page.locator('app-sidebar .nav-label')).toHaveText([
      'Início',
      'Menu',
      'Empresa',
      'Design',
      'Analytics',
      'QR Code',
      'Sair',
    ]);
    await navigation(page, 'Analytics');
    if (matrix[code][3]) {
      await expect(page.locator('app-owner-analytics')).toContainText('Analytics do cardápio');
      await expect(page.locator('.kpi-value').first()).toContainText('42');
    } else {
      await expect(page.locator('app-feature-preview')).toContainText(
        'Disponível a partir do Basic.',
      );
      expect(await page.locator('.line').evaluate((el) => getComputedStyle(el).animationName)).toBe(
        'none',
      );
    }
    await navigation(page, 'QR Code');
    if(matrix[code][4])await expect(page.locator('app-owner-qr')).toContainText('QR Code do cardápio');
    else await expect(page.locator('app-feature-preview')).toContainText('Disponível a partir do Medium.');
    await settings(page);
    await page.getByRole('button', { name: 'Plano e uso', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(`${account.plan.name} · uso atual`);
    await expect(page.getByRole('dialog')).toContainText(`${matrix[code][2]}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Suporte', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'pingochef@gmail.com', exact: true }),
    ).toHaveAttribute('href', 'mailto:pingochef@gmail.com');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
test('menu containers fit narrow screens, category actions are independent and mobile controls share the neutral style', async ({ page }, testInfo) => {
  await mockApi(page, 'PRO');
  const categoryName = 'Pratos artesanais preparados com ingredientes selecionados';
  await page.route('**/api/v1/categories', route => route.fulfill({ json: { success: true, data: [
    { id: 'category-a', name: categoryName, iconType: 'none', displayOrder: 0, isActive: true }
  ] } }));
  await page.route('**/api/v1/subcategories**', route => route.fulfill({ json: { success: true, data: [
    { id: 'sub-a', categoryId: 'category-a', name: 'Especialidades para compartilhar com a família e os amigos', displayOrder: 0 }
  ] } }));
  await page.route('**/api/v1/items', route => route.fulfill({ json: { success: true, data: [
    { id: 'item-a', categoryId: 'category-a', subcategoryId: 'sub-a', categoryName, name: 'Um prato com um nome bastante longo para testar o layout', description: 'Ingredientes frescos e preparo artesanal.', price: 42, isAvailable: true }
  ] } }));
  await page.goto('/dashboard');
  await navigation(page, 'Menu');
  const editor = page.locator('app-menu-editor');
  await editor.getByRole('button', { name: categoryName, exact: true }).click();
  await expect(editor.locator('.subcat-item')).toBeVisible();
  await expect(editor.locator('button button')).toHaveCount(0);
  for (const width of [1440, 1180, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await editor.evaluate(element => Array.from(element.querySelectorAll('.products-grid, .product-card, .subcat-item, .subcat-add-row')).filter(node => {
      const rect = node.getBoundingClientRect(), bounds = node.closest('.section-block')!.getBoundingClientRect();
      return rect.left < bounds.left - 1 || rect.right > bounds.right + 1;
    }).map(node => node.className));
    expect(overflow).toEqual([]);
    expect((await editor.locator('.subcat-name').boundingBox())!.height).toBeLessThan(110);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const controls = await page.locator('app-topbar').evaluate(element => ['.mobile-settings-toggle', '.preview-toggle-btn'].map(selector => {
    const style = getComputedStyle(element.querySelector(selector)!);
    return { color: style.color, background: style.backgroundColor, border: style.borderColor };
  }));
  expect(controls[0]).toEqual(controls[1]);
  const theme = await page.locator('.dashboard-shell').evaluate(element => ({
    main: getComputedStyle(element.querySelector('.main-viewport')!).getPropertyValue('--panel-surface').trim(),
    right: getComputedStyle(element.querySelector('.preview-panel')!).getPropertyValue('--panel-surface').trim(),
    sidebar: getComputedStyle(element.querySelector('.sidebar')!).getPropertyValue('--panel-surface').trim()
  }));
  expect(theme.main).toBe(theme.right);
  expect(theme.main).not.toBe(theme.sidebar);
  await page.screenshot({ path: testInfo.outputPath('menu-mobile.png') });
  await editor.locator('button.cat-chip').click();
  await expect(editor.locator('.subcategories-section')).toHaveCount(0);
  await editor.getByRole('button', { name: `Editar categoria ${categoryName}`, exact: true }).click();
  await expect(editor.locator('.category-modal')).toBeVisible();
  await expect(editor.locator('.cat-filter-btn')).toHaveAttribute('aria-pressed', 'false');
});

for (const uploadResponse of ['normal', 'delayed', 'failed']) {
test(`video upload updates without another click when PUT response is ${uploadResponse} and can be saved and published`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockApi(page, 'PRO');
  const categoryId = '11111111-1111-4111-8111-111111111111';
  const itemId = '22222222-2222-4222-8222-222222222222';
  const mediaId = '33333333-3333-4333-8333-333333333333';
  const item = { id: itemId, categoryId, name: 'Prato com vídeo', description: 'Preparo artesanal.', price: 42, isAvailable: true, showPrice: true, highlightType: 'none', media: [] as any[] };
  let uploaded = false, published = false, polls = 0, deletions = 0;
  const media = { id: mediaId, mediaType: 'video', source: 'mux', position: 0, status: 'ready', isPublished: false, durationSeconds: 8, aspectRatio: '16:9', errorCode: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await page.route('**/api/v1/categories', route => route.fulfill({ json: { success: true, data: [{ id: categoryId, name: 'Pratos', iconType: 'none', displayOrder: 0, isActive: true }] } }));
  await page.route('**/api/v1/items', route => route.fulfill({ json: { success: true, data: [item] } }));
  await page.route(`**/api/v1/items/${itemId}`, route => route.fulfill({ json: { success: true, data: item } }));
  await page.route(`**/api/v1/items/${itemId}/media`, async route => {
    await new Promise(resolve => setTimeout(resolve, 150));
    return route.fulfill({ json: { success: true, data: uploaded ? [{ ...media, status: ++polls === 1 ? 'processing' : 'ready' }] : [] } });
  });
  await page.route(`**/api/v1/items/${itemId}/media/video/upload-intent`, route => route.fulfill({ status: 201, json: { success: true, data: { mediaId, uploadUrl: 'https://storage.googleapis.com/pingo-upload-test', expiresAt: new Date(Date.now() + 900000).toISOString(), maxFileSizeBytes: 52428800, maxDurationSeconds: 15 } } }));
  await page.route(`**/api/v1/items/${itemId}/media/${mediaId}`, route => {
    if (route.request().method() === 'DELETE') deletions++;
    return route.fulfill({ status: 204 });
  });
  await page.route('https://storage.googleapis.com/pingo-upload-test', async route => {
    const headers = route.request().headers();
    expect(headers.authorization).toBeUndefined();
    expect(headers['x-csrf-token']).toBeUndefined();
    expect(headers.cookie).toBeUndefined();
    uploaded = true;
    if (uploadResponse === 'failed') return route.abort('failed');
    await new Promise(resolve => setTimeout(resolve, uploadResponse === 'delayed' ? 12000 : 150));
    await route.fulfill({ status: 200, body: '' }).catch(() => undefined);
  });
  await page.route('**/api/v1/items/media/publish-ready', route => {
    expect(polls).toBeGreaterThan(1);
    published = true;
    item.media = [{ id: mediaId, mediaType: 'video', source: 'mux', position: 0, durationSeconds: 8, aspectRatio: '16:9' }];
    return route.fulfill({ json: { success: true, data: { publishedCount: 1 } } });
  });
  await page.route('**/api/v1/business/publish', route => route.fulfill({ json: { success: true, data: {} } }));
  // Only local file metadata is stubbed: external bytes and API responses are test fixtures.
  await page.addInitScript(() => {
    const src = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')!;
    Object.defineProperty(HTMLMediaElement.prototype, 'src', { ...src, set(value: string) {
      if (value.startsWith('blob:')) {
        Object.defineProperty(this, 'duration', { configurable: true, value: 8 });
        setTimeout(() => this.dispatchEvent(new Event('loadedmetadata')), 10);
      } else src.set!.call(this, value);
    } });
  });
  await page.goto('/dashboard');
  const sidebarStyle = await page.locator('app-sidebar').evaluate(element => {
    const button = element.querySelector('.nav-item')!;
    return { button: getComputedStyle(button).boxShadow, icon: getComputedStyle(button.querySelector('.nav-icon-wrap')!).boxShadow, glyph: getComputedStyle(button.querySelector('svg')!).filter };
  });
  expect(sidebarStyle.icon).toBe('none');
  expect(sidebarStyle.glyph).toBe('none');
  if (uploadResponse === 'normal') await page.screenshot({ path: testInfo.outputPath('sidebar-restored.png') });
  await navigation(page, 'Menu');
  await page.locator('.product-card button[title="Editar"]').click();
  if (uploadResponse === 'normal') {
    await page.locator('app-menu-editor input[type=file][accept*="image/png"]').setInputFiles({ name: 'prato.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64') });
    await expect(page.locator('.item-img-preview')).toBeVisible();
  }
  const uploader = page.locator('app-product-video-uploader');
  await uploader.locator('input[type=file]').setInputFiles({ name: 'prato.mp4', mimeType: 'video/mp4', buffer: Buffer.from('video-fixture') });
  await expect(uploader.getByRole('button', { name: 'Enviar vídeo', exact: true })).toBeVisible();
  await uploader.getByRole('button', { name: 'Enviar vídeo', exact: true }).click();
  await expect(uploader.getByText('Vídeo pronto', { exact: true })).toBeVisible();
  expect(deletions).toBe(0);
  const save = page.getByRole('button', { name: 'Salvar Produto', exact: true });
  await expect(save).toBeEnabled();
  const appearance = await save.evaluate(element => {
    const style = getComputedStyle(element);
    return { color: style.backgroundColor, gradient: style.backgroundImage, shadow: style.boxShadow };
  });
  expect(appearance.color).toBe('rgb(139, 21, 40)');
  expect(appearance.gradient).toBe('none');
  expect(appearance.shadow).toContain('inset');
  await page.screenshot({ path: testInfo.outputPath('video-ready.png') });
  await save.click();
  await expect(page.locator('app-menu-editor .modal-card.large')).toHaveCount(0);
  const publishButton = page.locator('.publication-toolbar').getByRole('button', { name: 'Publicar Cardápio', exact: true });
  await expect(publishButton).toBeVisible();
  if (uploadResponse === 'normal') {
    for (const width of [1920, 1366, 1180, 820, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const box = (await publishButton.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath('publish-mobile.png') });
  }
  await publishButton.click();
  await expect(page.getByText('Cardápio publicado com sucesso na versão online!', { exact: true })).toBeVisible();
  expect(published).toBe(true);
});
}

test('settings traps keyboard focus and logout-all sends session CSRF then leaves dashboard', async ({
  page,
}) => {
  const { posts } = await mockApi(page);
  await page.goto('/dashboard');
  await settings(page);
  await page.getByRole('button', { name: 'Segurança', exact: true }).click();
  await page.keyboard.press('Tab');
  expect(await page.getByRole('dialog').evaluate((el) => el.contains(document.activeElement))).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Sair de todos os dispositivos' }).click();
  await expect(page).toHaveURL(/login/);
  const logout = posts.find((p) => p.path === 'auth/logout-all');
  expect(logout?.headers['x-csrf-token']).toBe('a'.repeat(64));
  expect(logout?.headers.authorization).toBeUndefined();
});
test('password change and account deletion require explicit form validation', async ({ page }) => {
  const { posts } = await mockApi(page);
  await page.goto('/dashboard');
  await settings(page);
  await page.getByRole('button', { name: 'Segurança', exact: true }).click();
  await page.getByLabel('Senha atual', { exact: true }).fill('OldPassword123!');
  await page.getByLabel('Nova senha', { exact: true }).fill('NewPassword123!');
  await page.getByLabel('Confirmar nova senha').fill('DifferentPassword123!');
  await page.getByRole('button', { name: 'Alterar senha', exact: true }).click();
  await expect(page.getByText('As senhas não coincidem.')).toBeVisible();
  expect(posts.find((p) => p.path === 'auth/change-password')).toBeUndefined();
  await page.getByRole('button', { name: 'Gerenciar conta' }).click();
  await expect(page.getByRole('button', { name: 'Agendar exclusão da conta' })).toBeDisabled();
  await page.getByLabel('Sua senha atual').fill('OldPassword123!');
  await page.getByLabel('Digite EXCLUIR para confirmar').fill('EXCLUIR');
  await page.getByRole('checkbox', { name: /Entendo que/ }).check();
  await page.getByRole('button', { name: 'Agendar exclusão da conta' }).click();
  await expect(page).toHaveURL(/account=deletion-scheduled/);
  expect(posts.find((p) => p.path === 'auth/delete-account')?.body).toMatchObject({
    confirmation: 'EXCLUIR',
    confirmBusinessId: id,
  });
});
test('settings fit desktop, notebook, tablet and mobile in both themes', async ({ page }) => {
  await mockApi(page);
  await page.goto('/dashboard');
  for (const width of [1600, 1280, 900, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await settings(page);
    const box = await page.getByRole('dialog').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    await page.getByRole('button', { name: 'Segurança', exact: true }).click();
    await expect(page.getByLabel('Senha atual', { exact: true })).toBeVisible();
    expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    if (width === 1600 || width === 390)
      await page.screenshot({ path: `../.tools/phase2-settings-${width}.png` });
    await page.getByRole('button', { name: 'Fechar configurações' }).click();
  }
  await page.getByRole('button', { name: 'Ativar tema claro' }).click();
  await settings(page);
  await expect(page.getByRole('dialog')).toHaveAttribute('data-theme', 'light');
  await page.keyboard.press('Escape');
  const sidebar = page.locator('app-sidebar .sidebar');
  expect(await sidebar.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain(
    '44, 16, 36',
  );
});
test('password update and single-device logout finish only after server confirmation', async ({
  page,
}) => {
  const { posts } = await mockApi(page);
  await page.goto('/dashboard');
  await settings(page);
  await page.getByRole('button', { name: 'Segurança', exact: true }).click();
  await page.getByLabel('Senha atual', { exact: true }).fill('OldPassword123!');
  await page.getByLabel('Nova senha', { exact: true }).fill('NewPassword123!');
  await page.getByLabel('Confirmar nova senha').fill('NewPassword123!');
  await page.getByRole('button', { name: 'Alterar senha', exact: true }).click();
  await expect(page).toHaveURL(/password=changed/);
  expect(posts.find((p) => p.path === 'auth/change-password')?.headers['x-csrf-token']).toBe(
    'a'.repeat(64),
  );
  await mockApi(page);
  await page.goto('/dashboard');
  await settings(page);
  await page.getByRole('button', { name: 'Gerenciar conta' }).click();
  await page.getByRole('button', { name: 'Sair desta conta' }).click();
  await expect(page).toHaveURL(/session=ended/);
});
