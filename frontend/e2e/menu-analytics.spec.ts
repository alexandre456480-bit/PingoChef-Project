import { expect, test, Page } from '@playwright/test';
import { analyticsOptions, analyticsReport, AnalyticsPlan, productRows } from './analytics-fixture';

async function mock(page: Page, plan: AnalyticsPlan) {
  const queries: {
    path: string;
    params: URLSearchParams;
    headers: Record<string, string>;
    body: any;
  }[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace('/api/v1/', '');
    queries.push({
      path,
      params: url.searchParams,
      headers: req.headers(),
      body: req.method() === 'POST' ? req.postDataJSON() : null,
    });
    if (path === 'auth/me')
      return route.fulfill({
        json: {
          success: true,
          data: {
            user: { id: 'owner', email: 'owner@test.example', name: 'Ana' },
            business: {
              id: '22222222-2222-4222-8222-222222222222',
              name: 'Bistrô',
              slug: 'bistro',
            },
            emailVerified: true,
            accountActive: true,
            plan: { code: plan, name: plan },
            entitlements: {
              ANALYTICS_BASIC: plan !== 'FREE',
              ANALYTICS_ADVANCED: ['MEDIUM', 'PRO'].includes(plan),
              ANALYTICS_EXPORT: plan === 'PRO',
              MAX_PRODUCTS: 150,
              MAX_CATEGORIES: 40,
              MAX_VIDEOS: 40,
            },
            usage: { products: 0, categories: 0, videos: 0 },
            csrfToken: 'a'.repeat(64),
            onboarding: { designConfigured: false },
          },
        },
      });
    if (path === 'analytics/options')
      return route.fulfill({ json: { success: true, data: analyticsOptions(plan) } });
    if (path === 'analytics')
      return route.fulfill({
        json: { success: true, data: analyticsReport(plan, url.searchParams) },
      });
    if (path === 'analytics/rankings') {
      const page = Number(url.searchParams.get('page'));
      return route.fulfill({
        json: {
          success: true,
          data: { rows: productRows.slice((page - 1) * 5, page * 5), total: 7, page, pageSize: 5 },
        },
      });
    }
    if (path === 'analytics/product-trends')
      return route.fulfill({
        json: {
          success: true,
          data: [
            { date: '2026-09-26', value: 2 },
            { date: '2026-10-02', value: 4 },
          ],
        },
      });
    if (path === 'analytics/export.csv')
      return route.fulfill({
        contentType: 'text/csv',
        headers: { 'Content-Disposition': 'attachment; filename="analytics.csv"' },
        body: 'Data,Visualizações\r\n2026-10-02,42\r\n',
      });
    if (path === 'business')
      return route.fulfill({ json: { success: true, data: { name: 'Bistrô', slug: 'bistro' } } });
    if (path === 'design') return route.fulfill({ json: { success: true, data: {} } });
    if (path === 'public/menu/bistro')
      return route.fulfill({
        json: {
          success: true,
          data: {
            business: {
              name: 'Bistrô',
              slug: 'bistro',
              description: 'Teste',
              logoUrl: '/logo_img.webp',
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
    return route.fulfill({ json: { success: true, data: [] } });
  });
  return queries;
}
async function analytics(page: Page) {
  await page.goto('/dashboard');
  const nav = page.locator('app-sidebar .nav-item').filter({ hasText: 'Analytics' });
  await expect(nav).toBeAttached();
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await nav.click();
}
for (const plan of ['FREE', 'BASIC', 'MEDIUM', 'PRO'] as const) {
  test(`${plan}: correct Analytics capabilities, accessible values, responsive layout and pagination`, async ({
    page,
  }) => {
    const requests = await mock(page, plan);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await analytics(page);
    if (plan === 'FREE') {
      await expect(page.locator('app-feature-preview')).toContainText(
        'Disponível a partir do Basic.',
      );
      expect(requests.some((q) => q.path.startsWith('analytics'))).toBe(false);
      return;
    }
    await expect(
      page.getByRole('heading', { name: 'Analytics do cardápio', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.kpi-value').first()).toHaveText('42');
    await expect(page.locator('.kpi-value').nth(1)).toHaveText('3');
    await page.getByRole('button', { name: 'Definição de Visitantes', exact: true }).focus();
    await expect(
      page.getByRole('tooltip').filter({ hasText: 'Identidades anônimas' }),
    ).toBeVisible();
    await page.getByText('Ver valores em tabela', { exact: true }).first().click();
    await expect(page.locator('app-analytics-chart table').first()).toBeVisible();
    await page
      .getByRole('button', { name: 'Próxima página de Produtos mais visualizados' })
      .click();
    await expect(page.getByText('Produto 6', { exact: true })).toBeVisible();
    expect(
      requests.some((q) => q.path === 'analytics/rankings' && q.params.get('page') === '2'),
    ).toBe(true);
    if (plan === 'BASIC') {
      await expect(page.getByLabel('Comparar com', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Baixar CSV' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Origens dos acessos' })).toHaveCount(0);
    } else {
      await page.getByLabel('Comparar com', { exact: true }).selectOption('previous');
      await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
      await expect(page.getByText('Sem base percentual', { exact: true })).toHaveCount(4);
      await expect(page.getByRole('heading', { name: 'Horários de maior acesso' })).toBeVisible();
    }
    for (const width of [1280, 900, 390]) {
      await page.setViewportSize({ width, height: 920 });
      for (let index = 0; index < 4; index++) {
        await page.locator('.kpi .info').nth(index).focus();
        const tooltip = page.locator('.kpi [role="tooltip"]').nth(index);
        await expect(tooltip).toBeVisible();
        const bounds = (await tooltip.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    if (plan === 'PRO') {
      await page.screenshot({
        path: '../.tools/phase3-analytics-mobile.png',
        fullPage: true,
        animations: 'disabled',
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.getByRole('button', { name: 'Ativar tema claro', exact: true }).click();
      await expect(page.locator('.dashboard-shell')).toHaveAttribute('data-panel-theme', 'light');
      await page.screenshot({
        path: '../.tools/phase3-analytics-desktop-light.png',
        fullPage: true,
        animations: 'disabled',
      });
    }
  });
}
test('Medium filters cover calendar presets, specific dates/month/year/custom and source; product trend is server supplied', async ({
  page,
}) => {
  const queries = await mock(page, 'MEDIUM');
  await analytics(page);
  await expect(page.locator('.kpi-value').first()).toHaveText('42');
  const selector = page.getByLabel('Período', { exact: true });
  for (const preset of [
    'today',
    'yesterday',
    '7d',
    '30d',
    'month',
    'previousMonth',
    '3m',
    '6m',
    'year',
    'previousYear',
  ]) {
    await selector.selectOption(preset);
    await expect(page.locator('.loading-state')).toHaveCount(0);
    await expect
      .poll(() =>
        queries
          .filter((q) => q.path === 'analytics')
          .at(-1)
          ?.params.get('start'),
      )
      .toBe(
        (
          {
            today: '2026-10-02',
            yesterday: '2026-10-01',
            '7d': '2026-09-26',
            '30d': '2026-09-03',
            month: '2026-10-01',
            previousMonth: '2026-09-01',
            '3m': '2026-07-03',
            '6m': '2026-04-03',
            year: '2026-01-01',
            previousYear: '2025-01-01',
          } as Record<string, string>
        )[preset],
      );
  }
  await selector.selectOption('day');
  await page.getByLabel('Dia', { exact: true }).fill('2026-09-15');
  await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
  await expect(page.locator('.period-line')).toContainText('15/09/2026');
  await selector.selectOption('specificMonth');
  await page.getByLabel('Mês', { exact: true }).fill('2026-09');
  await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
  await expect(page.locator('.period-line')).toContainText('30/09/2026');
  await selector.selectOption('specificYear');
  await page.getByLabel('Ano', { exact: true }).fill('2025');
  await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
  await expect(page.locator('.period-line')).toContainText('31/12/2025');
  await selector.selectOption('custom');
  await page.getByLabel('De', { exact: true }).fill('2026-09-01');
  await page.getByLabel('Até', { exact: true }).fill('2026-09-30');
  await page.getByLabel('Origem', { exact: true }).selectOption('qr');
  await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
  await expect(page.locator('.kpi-value').first()).toHaveText('4');
  await expect(page.getByText('Curtidas não têm atribuição', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Ver tendência de Produto 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tendência · Produto 1' })).toBeVisible();
  await expect(page.locator('app-analytics-chart').last()).toBeVisible();
  const trend = queries.find((q) => q.path === 'analytics/product-trends');
  expect(trend?.params.get('source')).toBe('qr');
  expect(trend?.params.get('start')).toBe('2026-09-01');
  await page.getByLabel('De', { exact: true }).fill('2026-10-02');
  await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('período válido');
});
test('Pro exports selected period/source and filters a registered QR without creating one', async ({
  page,
}) => {
  const queries = await mock(page, 'PRO');
  await analytics(page);
  await expect(page.locator('.kpi-value').first()).toHaveText('42');
  await page.getByRole('button', { name: 'Mesa 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remover filtro por QR' })).toBeVisible();
  await expect(page.locator('.kpi-value').first()).toHaveText('42');
  await page.getByLabel('Conteúdo do CSV').selectOption('products');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar CSV', exact: true }).click();
  await download;
  const csv = queries.find((q) => q.path === 'analytics/export.csv');
  expect(csv?.params.get('qrId')).toBe('44444444-4444-4444-8444-444444444444');
  expect(csv?.params.get('section')).toBe('products');
  expect(csv?.headers['authorization']).toBeUndefined();
  await expect(
    page.getByLabel('Comparar com', { exact: true }).locator('option[value="year"]'),
  ).toHaveCount(1);
});
test('public QR navigation collects once per navigation, preserves anonymous session and omits account credentials', async ({
  page,
}) => {
  const queries = await mock(page, 'FREE');
  await page.goto('/m/bistro?source=qr');
  await expect
    .poll(() => queries.filter((q) => q.path === 'public/menu/bistro/events').length)
    .toBe(1);
  const first = queries.find((q) => q.path === 'public/menu/bistro/events')!;
  expect(first.body.events.map((e: any) => e.eventName)).toEqual(['MENU_VIEW', 'QR_ENTRY']);
  expect(first.headers['authorization']).toBeUndefined();
  expect(first.headers['x-csrf-token']).toBeUndefined();
  await page.reload();
  await expect
    .poll(() => queries.filter((q) => q.path === 'public/menu/bistro/events').length)
    .toBe(2);
  const second = queries.filter((q) => q.path === 'public/menu/bistro/events')[1];
  expect(second.body.visitorId).toBe(first.body.visitorId);
  expect(second.body.pageId).not.toBe(first.body.pageId);
  expect(Object.keys(first.body).sort()).toEqual(['events', 'pageId', 'source', 'visitorId']);
});

test('rapid filter changes abort an older request and cannot display its late response', async ({
  page,
}) => {
  await mock(page, 'MEDIUM');
  let aborted = 0,
    delayedFinished = false;
  page.on('requestfailed', (r) => {
    if (
      r.url().includes('/analytics?') &&
      new URL(r.url()).searchParams.get('start') === '2026-10-02'
    )
      aborted++;
  });
  await page.route('**/api/v1/analytics?**', async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const data = analyticsReport('MEDIUM', params);
    if (params.get('start') === '2026-10-02') {
      data.summary.menuViews = 999;
      await new Promise((r) => setTimeout(r, 900));
      delayedFinished = true;
    }
    await route.fulfill({ json: { success: true, data } }).catch(() => {});
  });
  await analytics(page);
  await expect(page.locator('.kpi-value').first()).toHaveText('42');
  const old = page.waitForRequest(
    (r) =>
      r.url().includes('/analytics?') &&
      new URL(r.url()).searchParams.get('start') === '2026-10-02',
  );
  await page.getByLabel('Período', { exact: true }).selectOption('today');
  await old;
  await page.getByLabel('Período', { exact: true }).selectOption('7d');
  await expect.poll(() => aborted).toBeGreaterThan(0);
  await expect.poll(() => delayedFinished).toBe(true);
  await expect(page.locator('.kpi-value').first()).toHaveText('42');
  await expect(page.locator('.period-line')).toContainText('26/09/2026');
});
