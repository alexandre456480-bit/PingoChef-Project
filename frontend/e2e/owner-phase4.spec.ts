import { expect, test, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyticsOptions, analyticsReport, AnalyticsPlan } from './analytics-fixture';
const qrId = '44444444-4444-4444-8444-444444444444',
  publicId = '33333333-3333-4333-8333-333333333333';
const png = readFileSync(resolve('e2e/fixtures/qr-reference.png'));
const defaultConfig = {
  color: '#2C1024',
  frame: 'card',
  caption: 'Acesse nosso cardápio',
  logoPng: null,
};
async function mock(
  page: Page,
  plan: AnalyticsPlan,
  options: { conflict?: boolean; unavailable?: boolean; login?: boolean } = {},
) {
  const requests: { path: string; method: string; body: any; headers: Record<string, string> }[] =
    [];
  let row: any = null;
  let loggedIn = !options.login;
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace('/api/v1/', '');
    const body = ['POST', 'PUT'].includes(req.method()) ? req.postDataJSON() : null;
    requests.push({ path, method: req.method(), body, headers: req.headers() });
    if (path === 'auth/me' && !loggedIn)
      return route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
    if (path === 'auth/login') loggedIn = true;
    if (path === 'auth/me' || path === 'auth/login')
      return route.fulfill({
        json: {
          success: true,
          data: {
            user: { id: 'owner', email: 'maria@example.test', name: 'Maria' },
            business: {
              id: '22222222-2222-4222-8222-222222222222',
              name: 'Bistrô PingoChef',
              slug: 'bistro',
            },
            emailVerified: true,
            accountActive: true,
            plan: { code: plan, name: plan },
            entitlements: {
              QR_GENERATOR: ['MEDIUM', 'PRO'].includes(plan),
              QR_CUSTOMIZATION: true,
              ANALYTICS_BASIC: plan !== 'FREE',
              ANALYTICS_ADVANCED: ['MEDIUM', 'PRO'].includes(plan),
              ANALYTICS_EXPORT: plan === 'PRO',
              MAX_PRODUCTS: 150,
              MAX_CATEGORIES: 40,
              MAX_VIDEOS: 40,
              VIDEO_UPLOAD: true,
            },
            usage: { products: 1, categories: 1, videos: 0 },
            csrfToken: 'a'.repeat(64),
            isPublished: true,
            onboarding: { designConfigured: true },
          },
        },
      });
    if (path === 'qr' && req.method() === 'GET')
      return route.fulfill({
        json: {
          success: true,
          data: { rows: row ? [row] : [], limit: 20, customization: true, publicAvailable: true },
        },
      });
    if (
      (path === 'qr' && req.method() === 'POST') ||
      (path === `qr/${qrId}` && req.method() === 'PUT')
    ) {
      if (options.conflict && req.method() === 'PUT')
        return route.fulfill({ status: 409, json: { error: { code: 'QR_VERSION_CONFLICT' } } });
      row = {
        id: qrId,
        name: body.name,
        publicIdentifier: publicId,
        publicUrl: `http://127.0.0.1:4300/q/${publicId}`,
        status: body.active === false ? 'PAUSED' : 'ACTIVE',
        createdAt: '2026-10-02T12:00:00Z',
        updatedAt: '2026-10-02T12:01:00Z',
        revision: (row?.revision || 0) + 1,
        configuration: body.configuration,
      };
      return route.fulfill({
        status: req.method() === 'POST' ? 201 : 200,
        json: { success: true, data: row },
      });
    }
    if (path === `qr/${qrId}/image`) {
      if (new URL(req.url()).searchParams.get('format') === 'svg')
        return route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16"/></svg>',
        });
      return route.fulfill({ contentType: 'image/png', body: png });
    }
    if (path === `public/qr/${publicId}`)
      return options.unavailable
        ? route.fulfill({ status: 404, json: { error: { code: 'QR_UNAVAILABLE' } } })
        : route.fulfill({ json: { success: true, data: { slug: 'bistro', qrId } } });
    if (path === 'public/menu/bistro')
      return route.fulfill({
        json: {
          success: true,
          data: {
            business: {
              name: 'Bistrô',
              slug: 'bistro',
              description: '',
              logoUrl: '',
              coverImageUrl: '',
            },
            design: {},
            categories: [],
            subcategories: [],
            items: [],
          },
        },
      });
    if (path === 'public/menu/bistro/events')
      return route.fulfill({ status: 202, json: { success: true, data: { accepted: 1 } } });
    if (path === 'business')
      return route.fulfill({ json: { success: true, data: { name: 'Bistrô', slug: 'bistro' } } });
    if (path === 'design') return route.fulfill({ json: { success: true, data: {} } });
    if (path === 'analytics/options')
      return route.fulfill({ json: { success: true, data: analyticsOptions(plan) } });
    if (path === 'analytics')
      return route.fulfill({
        json: { success: true, data: analyticsReport(plan, new URL(req.url()).searchParams) },
      });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  return requests;
}
async function qrSection(page: Page) {
  const nav = page.locator('app-sidebar .nav-item').filter({ hasText: 'QR Code' });
  await expect(nav).toBeAttached();
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await nav.click();
}
for (const plan of ['FREE', 'BASIC'] as const)
  test(`${plan}: demo makes no real QR request, including DevTools local plan storage`, async ({
    page,
  }) => {
    const requests = await mock(page, plan);
    await page.addInitScript(() => {
      localStorage.setItem('plan', 'PRO');
      localStorage.setItem('QR_GENERATOR', 'true');
    });
    await page.goto('/dashboard');
    await qrSection(page);
    await expect(page.locator('app-feature-preview')).toContainText(
      'Disponível a partir do Medium.',
    );
    await expect(page.locator('app-owner-qr')).toHaveCount(0);
    expect(requests.some((r) => r.path.startsWith('qr'))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
for (const plan of ['MEDIUM', 'PRO'] as const)
  test(`${plan}: generate, stable update, pause, safe downloads and keyboard`, async ({
    page,
  }, info) => {
    const requests = await mock(page, plan);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/dashboard');
    await qrSection(page);
    await expect(page.getByRole('heading', { name: 'QR Code do cardápio' })).toBeVisible();
    expect(requests.filter((r) => /qr\/.+\/image/.test(r.path))).toHaveLength(0);
    await page.getByLabel('Nome do QR', { exact: true }).fill('QR Balcão');
    await page.getByLabel('Texto curto', { exact: true }).fill('Veja nosso cardápio');
    const generate = page.getByRole('button', { name: 'Gerar QR Code', exact: true });
    await generate.focus();
    await expect(generate).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText('QR Code gerado com sucesso.', { exact: true })).toBeVisible();
    await expect(page.locator('.qr-image')).toBeVisible();
    const create = requests.find((r) => r.path === 'qr' && r.method === 'POST')!;
    expect(create.headers['x-csrf-token']).toBe('a'.repeat(64));
    expect(create.body).toEqual({
      name: 'QR Balcão',
      configuration: { ...defaultConfig, caption: 'Veja nosso cardápio' },
    });
    await expect(page.locator('.menu-link')).toHaveAttribute(
      'href',
      `http://127.0.0.1:4300/q/${publicId}`,
    );
    await page.getByLabel('Cor principal', { exact: true }).fill('#FFFFFF');
    await expect(page.getByRole('button', { name: 'Atualizar QR Code' })).toBeDisabled();
    await expect(page.getByText(/Escolha uma cor mais escura/)).toBeVisible();
    await page.getByLabel('Cor principal', { exact: true }).fill('#691525');
    await page.getByLabel('QR ativo para visitantes').uncheck();
    await page.getByRole('button', { name: 'Atualizar QR Code' }).click();
    await expect(page.locator('.status-label')).toContainText('Pausado');
    expect(requests.find((r) => r.method === 'PUT')?.body.revision).toBe(1);
    await expect(page.locator('.menu-link')).toHaveAttribute(
      'href',
      `http://127.0.0.1:4300/q/${publicId}`,
    );
    for (const format of ['PNG', 'SVG']) {
      const downloaded = page.waitForEvent('download');
      await page.getByRole('button', { name: `Baixar ${format}`, exact: true }).click();
      expect((await downloaded).suggestedFilename()).toBe(
        `pingochef-qr-${qrId}.${format.toLowerCase()}`,
      );
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const dimensions = await page.locator('.qr-image').boundingBox();
    expect(dimensions!.width).toBeLessThanOrEqual(info.project.use.viewport!.width);
    const linkColor = await page.locator('.menu-link').evaluate((el) => getComputedStyle(el).color);
    expect(linkColor).toBe('rgb(255, 248, 230)');
    await page.getByRole('button', { name: 'Ativar tema claro' }).click();
    await expect(page.locator('.dashboard-shell')).toHaveAttribute('data-panel-theme', 'light');
    expect(await page.locator('.menu-link').evaluate((el) => getComputedStyle(el).color)).toBe(
      'rgb(46, 18, 52)',
    );
    expect(await generate.count()).toBe(0);
    expect(
      await page
        .locator('.primary')
        .first()
        .evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe('0s');
    if (info.project.name === 'phase4-desktop')
      await page.screenshot({
        path: `../.tools/phase4-qr-${plan.toLowerCase()}.png`,
        fullPage: true,
      });
  });
test('conflict is clear and unsaved changes cannot download an obsolete file', async ({ page }) => {
  await mock(page, 'PRO', { conflict: true });
  await page.goto('/dashboard');
  await qrSection(page);
  await page.getByRole('button', { name: 'Gerar QR Code' }).click();
  await expect(page.locator('.qr-image')).toBeVisible();
  await page.getByLabel('Nome do QR', { exact: true }).fill('QR Mesa 2');
  await expect(page.getByRole('button', { name: 'Baixar PNG' })).toBeDisabled();
  await page.getByRole('button', { name: 'Atualizar QR Code' }).click();
  await expect(page.getByRole('alert')).toContainText('alterado em outra sessão');
});
test('stable public QR resolves once and emits QR_ENTRY only after the public menu succeeds', async ({
  page,
}) => {
  const requests = await mock(page, 'MEDIUM');
  await page.goto(`/q/${publicId}`);
  await expect(page).toHaveURL(new RegExp(`/m/bistro\\?source=qr&qr=${qrId}`));
  await expect.poll(() => requests.filter((r) => r.path.endsWith('/events')).length).toBe(1);
  const batch = requests.find((r) => r.path.endsWith('/events'))!;
  expect(batch.body.qrId).toBe(qrId);
  expect(batch.body.source).toBe('qr');
  expect(batch.body.events.map((e: any) => e.eventName)).toEqual(['MENU_VIEW', 'QR_ENTRY']);
  expect(batch.headers.authorization).toBeUndefined();
  expect(batch.headers['x-csrf-token']).toBeUndefined();
  await page.reload();
  await expect.poll(() => requests.filter((r) => r.path.endsWith('/events')).length).toBe(2);
  expect(requests.filter((r) => r.path.startsWith('public/qr/'))).toHaveLength(1); // reload stays on menu, no second redirect.
  expect(requests.filter((r) => r.path.endsWith('/events'))[1].body.visitorId).toBe(
    batch.body.visitorId,
  ); // Database deduplicates entries across page IDs.
});
test('invalid/unavailable public QR never emits menu analytics or accepts a redirect target', async ({
  page,
}) => {
  const requests = await mock(page, 'PRO', { unavailable: true });
  await page.goto(`/q/${publicId}?next=https://evil.test`);
  await expect(page.getByRole('alert')).toContainText('não está disponível');
  expect(requests.some((r) => r.path.endsWith('/events'))).toBe(false);
  await page.goto('/q/not-a-uuid');
  await expect(page.getByRole('alert')).toContainText('inválido');
  expect(requests.filter((r) => r.path.startsWith('public/qr/'))).toHaveLength(1);
});
test('owner login is keyboard accessible and restores the server account without browser tokens', async ({
  page,
}) => {
  const requests = await mock(page, 'FREE', { login: true });
  await page.goto('/login');
  await page.getByLabel('E-mail ou usuário', { exact: true }).fill('maria@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('StrongPassword123!');
  const enter = page.getByRole('button', { name: 'Entrar', exact: true });
  await enter.focus();
  await expect(enter).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.locator('app-plan-usage').first()).toContainText('FREE');
  expect(requests.find((r) => r.path === 'auth/login')?.body).toEqual({
    email: 'maria@example.test',
    password: 'StrongPassword123!',
  });
  expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('refresh_token'))).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
