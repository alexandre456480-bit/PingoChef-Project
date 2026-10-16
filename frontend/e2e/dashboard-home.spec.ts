import { expect as baseExpect, Page, test } from '@playwright/test';
import { analyticsReport, AnalyticsPlan } from './analytics-fixture';

const expect = baseExpect.configure({ timeout: 20_000 });
test.setTimeout(90_000);

test.beforeEach(async ({ page }) => {
  // Layout assertions must not wait for external font servers in an offline run.
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
});

async function mockHome(
  page: Page,
  options: {
    plan?: AnalyticsPlan;
    empty?: boolean;
    complete?: boolean;
    analyticsError?: boolean;
    dataError?: boolean;
    delay?: number;
    zeroVideo?: boolean;
    productLimit?: number;
  } = {},
) {
  const requests: string[] = [];
  const plan = options.plan ?? 'PRO';
  const items = options.empty
    ? []
    : Array.from({ length: 4 }, (_, i) => ({
        id: `item-${i}`,
        categoryId: 'category',
        name: `Produto ${i + 1}`,
        price: 20,
        isAvailable: true,
        isHighlighted: false,
        imageUrl: options.complete || i < 2 ? '/logo_img.webp' : null,
        description: 'Ingredientes selecionados da casa.',
        media: [],
      }));
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1/', '');
    requests.push(path);
    if (options.delay && ['items', 'categories', 'analytics'].includes(path))
      await new Promise((resolve) => setTimeout(resolve, options.delay));
    if (path === 'auth/me')
      return route.fulfill({
        json: {
          success: true,
          data: {
            user: { id: 'owner', name: 'Ana' },
            business: {
              id: 'tenant',
              name: 'Pingo Chefinho',
              slug: 'pingo-test',
              logo_url: '/logo_img.webp',
            },
            accountActive: true,
            plan: { code: plan, name: plan === 'PRO' ? 'Pro' : plan },
            entitlements: {
              MAX_PRODUCTS: options.productLimit ?? 10,
              MAX_CATEGORIES: 4,
              MAX_VIDEOS: options.zeroVideo ? 0 : 2,
              ANALYTICS_BASIC: plan !== 'FREE',
              ANALYTICS_ADVANCED: ['MEDIUM', 'PRO'].includes(plan),
              QR_GENERATOR: true,
            },
            usage: { products: items.length, categories: options.empty ? 0 : 1, videos: 0 },
            isPublished: !!options.complete,
            onboarding: { designConfigured: !!options.complete },
            csrfToken: 'a'.repeat(64),
          },
        },
      });
    if (path === 'items' && options.dataError)
      return route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } });
    if (path === 'items') return route.fulfill({ json: { success: true, data: items } });
    if (path === 'categories')
      return route.fulfill({
        json: {
          success: true,
          data: options.empty
            ? []
            : [{ id: 'category', name: 'Da casa', isActive: true, displayOrder: 0 }],
        },
      });
    if (path === 'analytics') {
      if (options.analyticsError)
        return route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } });
      const data = analyticsReport(plan);
      if (plan === 'BASIC') delete (data.summary as any).qrEntries;
      return route.fulfill({ json: { success: true, data } });
    }
    if (path === 'design') return route.fulfill({ json: { success: true, data: {} } });
    if (path === 'business')
      return route.fulfill({
        json: {
          success: true,
          data: { name: 'Pingo Chefinho', slug: 'pingo-test', logo_url: '/logo_img.webp' },
        },
      });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  return requests;
}

test('Home uses real response values and fits every requested width in both themes', async ({
  page,
}, info) => {
  const requests = await mockHome(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/dashboard');
  const home = page.locator('app-dashboard-home');
  await expect(home.locator('.next-action')).toContainText('2 produtos ainda estão sem foto.');
  await expect(home.getByRole('meter')).toHaveAttribute('aria-valuenow', '69');
  await expect(home.locator('.performance-metric strong').first()).toHaveText('42');
  await expect(home.locator('.usage-card')).toContainText('4 / 10');
  expect(requests.filter((path) => path === 'items')).toHaveLength(1);
  expect(requests.filter((path) => path === 'categories')).toHaveLength(1);
  expect(requests.filter((path) => path === 'auth/me')).toHaveLength(1);
  expect(requests.filter((path) => path === 'analytics')).toHaveLength(1);
  expect(requests).not.toContain('analytics/options');
  for (const width of [1440, 1280, 1024, 768, 430, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() =>
        home
          .locator('.usage-label')
          .first()
          .evaluate((el) => getComputedStyle(el).flexDirection),
      )
      .toBe((await home.evaluate((el) => el.clientWidth <= 640)) ? 'row' : 'column');
    const issues = await home.evaluate((element) =>
      [...element.querySelectorAll<HTMLElement>('*')]
        .filter((node) => getComputedStyle(node).display !== 'none' && node.getClientRects().length)
        .filter(
          (node) => node.getBoundingClientRect().right > element.getBoundingClientRect().right + 2,
        )
        .map((node) => node.className)
        .filter((name) => typeof name === 'string'),
    );
    expect(issues, `Home overflow at ${width}px`).toEqual([]);
    expect(await home.evaluate((element) => element.scrollWidth <= element.clientWidth + 2)).toBe(
      true,
    );
    const art = home.locator('.hero-art img');
    await expect(art).toHaveJSProperty('complete', true);
    expect(await art.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    if (width < 640) {
      const bounds = await home.evaluate((el) => ({
        picture: el.querySelector('.hero-art')!.getBoundingClientRect().toJSON(),
        paragraph: el.querySelector('.welcome p')!.getBoundingClientRect().toJSON(),
        heading: el.querySelector('h1')!.getBoundingClientRect().toJSON(),
      }));
      expect(bounds.picture.x).toBeGreaterThanOrEqual(bounds.paragraph.right - 1);
      expect(bounds.picture.y).toBeGreaterThanOrEqual(bounds.heading.bottom - 1);
      await expect(art).toHaveJSProperty(
        'currentSrc',
        'http://127.0.0.1:4300/assets/mascots/home/pingo-chef-animation-2-menu.webp',
      );
    }
    if (width === 1440 || width === 390) {
      await page.locator('.content-canvas').evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.screenshot({ path: `../.tools/home-${info.project.name}-${width}-dark.png` });
      await home.locator('.quick-actions').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `../.tools/home-${info.project.name}-${width}-details.png` });
    }
  }
  expect(await home.locator('.hero-art').evaluate((el) => getComputedStyle(el).animationName)).toBe(
    'none',
  );
  await page.getByRole('button', { name: /tema claro/i }).click();
  await expect(page.locator('.dashboard-shell')).toHaveAttribute('data-panel-theme', 'light');
  await page.screenshot({ path: `../.tools/home-${info.project.name}-360-light.png` });
  expect(errors).toEqual([]);
});

for (const plan of ['FREE', 'BASIC', 'MEDIUM', 'PRO'] as const) {
  test(`${plan}: correct entitlement, empty state and unavailable video limit`, async ({
    page,
  }) => {
    const requests = await mockHome(page, { plan, empty: true, zeroVideo: true });
    await page.goto('/dashboard');
    const home = page.locator('app-dashboard-home');
    await expect(home.locator('.next-action')).toContainText('Criar categoria');
    await expect(home.locator('.usage-card')).toContainText('Não incluído');
    await expect(home).not.toContainText('0 / 0');
    await expect(home).not.toContainText('NaN');
    if (plan === 'FREE') {
      await expect(home.locator('.performance')).toContainText('a partir do plano Basic');
      expect(requests.filter((path) => path.startsWith('analytics'))).toHaveLength(0);
    } else {
      await expect(home.locator('.performance-metric').first()).toContainText('42');
      await expect(home.locator('.performance')).toContainText(
        plan === 'BASIC' ? 'Visitantes' : 'Acessos via QR',
      );
    }
  });
}

test('completed onboarding is compact and all Home navigation targets remain usable', async ({
  page,
}) => {
  await mockHome(page, { complete: true });
  await page.goto('/dashboard');
  let home = page.locator('app-dashboard-home');
  await expect(home.getByRole('meter')).toHaveAttribute('aria-valuenow', '100');
  await expect(home.locator('.onboarding')).toContainText('6/6');
  await expect(home.locator('.steps-list')).toHaveCount(0);
  await home.getByRole('button', { name: 'Ver todas as etapas' }).click();
  await expect(home.locator('.steps-list li')).toHaveCount(6);
  await home.getByRole('button', { name: 'Cadastrar dados da empresa' }).click();
  await expect(page.locator('app-business-editor')).toBeVisible();
  await page.goto('/dashboard');
  home = page.locator('app-dashboard-home');
  const link = home.getByRole('link', { name: 'Abrir cardápio' });
  await expect(link).toHaveAttribute('href', 'https://pingochef-web-drab.vercel.app/m/pingo-test');
  await expect(link).toHaveAttribute('target', '_blank');
  await home.getByRole('button', { name: 'Criar produto', exact: true }).click();
  await expect(page.locator('app-menu-editor')).toBeVisible();
  await page.goto('/dashboard');
  await home.getByRole('button', { name: 'Criar categoria', exact: true }).click();
  await expect(page.locator('app-menu-editor')).toBeVisible();
  await page.goto('/dashboard');
  await home.getByRole('button', { name: 'Design', exact: true }).click();
  await expect(page.locator('app-design-editor')).toBeVisible();
  await page.goto('/dashboard');
  await home.getByRole('button', { name: 'Comparar planos', exact: true }).click();
  await expect(page).toHaveURL(/\/plans$/);
});

test('analytics errors remain separate from catalogue data and retry works', async ({ page }) => {
  await mockHome(page, { analyticsError: true });
  await page.goto('/dashboard');
  const home = page.locator('app-dashboard-home');
  await expect(home.locator('.performance')).toContainText('Não foi possível carregar');
  await expect(home.locator('.kpi').first()).toContainText('4');
  await page.route('**/api/v1/analytics', (route) =>
    route.fulfill({ json: { success: true, data: analyticsReport('PRO') } }),
  );
  await home.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(home.locator('.performance-metric').first()).toContainText('42');
});

test('a failed catalogue request shows an error rather than a misleading empty account', async ({
  page,
}) => {
  await mockHome(page, { dataError: true });
  await page.goto('/dashboard');
  const home = page.locator('app-dashboard-home');
  await expect(home.locator('.data-error')).toContainText('Não foi possível carregar os produtos');
  await expect(home.locator('.kpi-grid')).toHaveCount(0);
});

test('usage identifies near and reached limits without overflowing its progress bars', async ({
  page,
}) => {
  await mockHome(page, { productLimit: 5 });
  await page.goto('/dashboard');
  const usage = page.locator('app-dashboard-home app-plan-usage');
  await expect(usage).toContainText('próximo do limite de produtos');
  await expect(usage.getByRole('progressbar', { name: 'Produtos', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '4',
  );
  await page.unroute('**/api/v1/**');
  await mockHome(page, { productLimit: 4 });
  await page.reload();
  await expect(usage).toContainText('Limite atingido');
  const transform = await usage
    .locator('.meter span')
    .first()
    .evaluate((el) => getComputedStyle(el).transform);
  expect(transform).toBe('matrix(1, 0, 0, 1, 0, 0)');
});

test('skeleton reuses the global loading state and publication keeps the existing review flow', async ({
  page,
}) => {
  const requests = await mockHome(page, { delay: 1000 });
  await page.goto('/dashboard');
  const home = page.locator('app-dashboard-home');
  await expect(home.locator('.home-loading')).toBeVisible();
  await expect(home.locator('.home-loading')).toHaveCount(0);
  await home.getByRole('button', { name: 'Corrigir agora', exact: true }).click();
  await expect(page.locator('app-menu-editor')).toBeVisible();
  await page.goto('/dashboard');
  await home.getByRole('button', { name: 'Revisar e publicar', exact: true }).click();
  await expect(page.locator('app-preview-section')).toBeVisible();
  await expect(
    page.locator('app-preview-section').getByRole('button', { name: 'Publicar Cardápio' }),
  ).toBeVisible();
  await page
    .locator('app-preview-section')
    .getByRole('button', { name: 'Publicar Cardápio' })
    .click();
  await expect(page.locator('.toast-floating')).toContainText('Cardápio publicado com sucesso');
  expect(requests).toContain('items/media/publish-ready');
  expect(requests).toContain('business/publish');
});
