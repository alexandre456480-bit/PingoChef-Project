import { expect as baseExpect, Page, test } from '@playwright/test';
import { analyticsOptions, analyticsReport } from './analytics-fixture';

test.setTimeout(120_000);
const expect = baseExpect.configure({ timeout: 25_000 });
async function mockTutorial(page: Page, opts: { status?: string; step?: string; paid?: boolean; populated?: boolean } = {}) {
  let state = { tutorial_status: opts.status ?? 'NOT_STARTED', tutorial_step: opts.step ?? 'welcome', tutorial_version: 1 };
  const writes: string[] = [], requests: string[] = [];
  await page.route(/^https:\/\/(fonts\.|images\.unsplash)/, route => route.abort());
  await page.route('**/api/v1/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.replace('/api/v1/', '');
    requests.push(path);
    if (req.method() !== 'GET') writes.push(`${req.method()} ${path}`);
    const fulfill = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path === 'business/tutorial') {
      if (req.method() === 'PATCH') {
        const body = req.postDataJSON();
        state = { tutorial_status: body.action === 'skip' ? 'SKIPPED' : body.action === 'complete' ? 'COMPLETED' : 'IN_PROGRESS',
          tutorial_step: body.action === 'restart' ? 'welcome' : body.action === 'start' ? state.tutorial_step : body.step, tutorial_version: 1 };
      }
      return fulfill(state);
    }
    if (path === 'auth/me') return fulfill({ user: { id: 'owner', name: 'Ana', email: 'ana@example.test' },
      business: { id: 'tenant', name: 'Casa da Ana', slug: 'casa-ana', logo_url: null }, accountActive: true,
      csrfToken: 'a'.repeat(64), plan: { code: opts.paid ? 'PRO' : 'FREE', name: opts.paid ? 'Pro' : 'Free' },
      entitlements: { MAX_PRODUCTS: 10, MAX_CATEGORIES: 4, MAX_VIDEOS: opts.paid ? 2 : 0,
        VIDEO_UPLOAD: !!opts.paid, ANALYTICS_BASIC: !!opts.paid, ANALYTICS_ADVANCED: !!opts.paid, QR_GENERATOR: !!opts.paid },
      usage: { products: opts.populated ? 1 : 0, categories: opts.populated ? 1 : 0, videos: 0 }, isPublished: false,
      onboarding: { designConfigured: false },
    });
    if (path === 'categories') return fulfill(opts.populated ? [{ id: 'category', name: 'Pratos', isActive: true, displayOrder: 0 }] : []);
    if (path === 'items') return fulfill(opts.populated ? [{ id: 'item', categoryId: 'category', name: 'Prato da casa', price: 20, isAvailable: true, media: [] }] : []);
    if (path === 'subcategories') return fulfill([]);
    if (path === 'design') return fulfill({});
    if (path === 'business') return fulfill({ id: 'tenant', name: 'Casa da Ana', slug: 'casa-ana' });
    if (path === 'qr') return fulfill({ rows: [], limit: 10, customization: true, publicAvailable: false });
    if (path === 'analytics/options') return fulfill(analyticsOptions('PRO'));
    if (path === 'analytics') return fulfill(analyticsReport('PRO', url.searchParams));
    return fulfill([]);
  });
  return { state: () => state, writes, requests };
}
const layer = (page: Page) => page.locator('.tour-layer');
async function next(page: Page) {
  const old = await layer(page).getAttribute('data-step');
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await expect(layer(page)).not.toHaveAttribute('data-step', old!);
  await expect(page.locator('.tour-dialog')).toHaveAttribute('aria-busy', 'false');
}
async function fit(page: Page) {
  const viewport = page.viewportSize()!;
  await expect.poll(async () => {
    const box = await page.locator('.tour-dialog').boundingBox();
    return !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1;
  }).toBe(true);
  await expect(page.getByRole('button', { name: 'Próximo', exact: true }).or(page.getByRole('button', { name: 'Finalizar tutorial', exact: true }))).toBeInViewport();
  await expect.poll(() => page.evaluate(() => {
    const spot = document.querySelector('.tour-spotlight')?.getBoundingClientRect(), card = document.querySelector('.tour-dialog')!.getBoundingClientRect();
    if (!spot) return 0;
    return Math.max(0, Math.min(spot.right, card.right) - Math.max(spot.left, card.left)) * Math.max(0, Math.min(spot.bottom, card.bottom) - Math.max(spot.top, card.top));
  })).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const width of [1440, 1280, 1024, 768, 430, 390, 360]) {
  test(`complete guide fits ${width}px without performing business operations`, async ({ page }, info) => {
    test.skip(info.project.name === 'chromium-mobile' && width !== 390, 'Other widths are covered by the desktop browser project.');
    await page.setViewportSize({ width, height: width <= 430 ? 844 : 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const fixture = await mockTutorial(page, { paid: true, populated: width === 1440 });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/dashboard'); await expect(layer(page)).toHaveAttribute('data-step', 'welcome');
    const visited: string[] = [];
    for (let count = 0; count < 22; count++) {
      const id = (await layer(page).getAttribute('data-step'))!; visited.push(id);
      await expect(page.locator('.tour-dialog')).toHaveAttribute('aria-busy', 'false');
      await fit(page);
      if (!['welcome', 'subcategories', 'videos', 'finish'].includes(id))
        await expect(page.locator('.tour-spotlight'), `Missing spotlight at ${id}`).toBeVisible();
      if (id === 'company-nav' && width <= 1024) await expect(page.locator('.sidebar')).toHaveClass(/mobile-open/);
      if (id === 'company') await expect(page.locator('app-business-editor')).toBeVisible();
      if (id === 'categories') await expect(page.locator('app-menu-editor')).toBeVisible();
      if (id === 'resources') await expect(page.locator('[data-tour="resources-panel"]')).toHaveAttribute('open', '');
      if (id === 'preview') await expect(page.locator(`[data-tour="${width <= 1100 ? 'preview-mobile' : 'preview-desktop'}"]`)).toBeVisible();
      if (id === 'subcategories') await expect(page.locator('.tour-spotlight')).toHaveCount(width === 1440 ? 1 : 0);
      if (id === 'publish') {
        await expect(page.locator('.tour-spotlight')).toBeVisible();
        const box = await page.locator('[data-tour="publish-menu"]').boundingBox();
        const spot = await page.locator('.tour-spotlight').boundingBox();
        expect(Math.abs(spot!.x - box!.x)).toBeLessThanOrEqual(8);
      }
      if ((width === 1440 || width === 390) && ['welcome', 'products', 'preview', 'publish', 'finish'].includes(id))
        await page.screenshot({ path: info.outputPath(`tutorial-${width}-${id}.png`) });
      if (id === 'finish') break;
      await next(page);
    }
    expect(visited).toContain('qr'); expect(visited).toContain('analytics'); expect(visited).toContain('videos');
    await page.getByRole('button', { name: 'Finalizar tutorial', exact: true }).click();
    await expect(layer(page)).toHaveCount(0); expect(fixture.state().tutorial_status).toBe('COMPLETED');
    await page.reload(); await expect(page.locator('app-dashboard-home')).toBeVisible();
    await expect(page.locator('.home-loading')).toHaveCount(0); await expect(layer(page)).toHaveCount(0);
    expect(fixture.writes.every(path => path === 'PATCH business/tutorial')).toBe(true);
    expect(errors).toEqual([]);
  });
}
test('skip confirmation, keyboard, manual restart, back and refresh resume', async ({ page }) => {
  const fixture = await mockTutorial(page);
  await page.goto('/dashboard'); await expect(layer(page)).toHaveAttribute('data-step', 'welcome');
  await next(page); await next(page);
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(layer(page)).toHaveAttribute('data-step', 'home');
  await page.reload(); await expect(layer(page)).toHaveAttribute('data-step', 'home');
  await expect(page.getByText('Continuando de onde você parou.')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('heading', { name: 'Pular o tutorial?' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar guia' }).click();
  await page.getByRole('button', { name: 'Pular tutorial' }).click();
  await page.getByRole('button', { name: 'Confirmar e pular' }).click();
  await expect(layer(page)).toHaveCount(0); expect(fixture.state().tutorial_status).toBe('SKIPPED');
  await page.reload(); await expect(page.locator('.home-loading')).toHaveCount(0);
  await expect(layer(page)).toHaveCount(0);
  await page.locator('button[aria-label="Abrir configurações"]:visible').first().click();
  await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
  await expect(layer(page)).toHaveAttribute('data-step', 'welcome');
  // Focus stays inside the modal, even when the highlighted background contains buttons.
  await page.keyboard.press('Shift+Tab');
  expect(await page.locator('.tour-dialog').evaluate(node => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('ArrowRight'); await expect(layer(page)).toHaveAttribute('data-step', 'home');
  expect(fixture.requests).not.toContain('qr'); expect(fixture.requests).not.toContain('analytics');
});
test('missing target falls back and accounts without entitlements omit paid sections', async ({ page }) => {
  const fixture = await mockTutorial(page, { status: 'IN_PROGRESS', step: 'resources' });
  await page.goto('/dashboard'); await expect(layer(page)).toHaveAttribute('data-step', 'resources');
  await expect(page.locator('[data-tour="resources-panel"]')).toHaveAttribute('open', '');
  await page.locator('[data-tour="publish-menu"]').evaluate(node => node.removeAttribute('data-tour'));
  await next(page); await expect(layer(page)).toHaveAttribute('data-step', 'publish');
  await expect(page.locator('.tour-spotlight')).toHaveCount(0);
  await next(page); await next(page); await expect(layer(page)).toHaveAttribute('data-step', 'finish');
  expect(fixture.requests).not.toContain('qr'); expect(fixture.requests).not.toContain('analytics');
  await fit(page);
});
test('existing category is prepared before highlighting subcategories', async ({ page }) => {
  await mockTutorial(page, { status: 'IN_PROGRESS', step: 'subcategories', populated: true });
  await page.goto('/dashboard');
  await expect(layer(page)).toHaveAttribute('data-step', 'subcategories');
  await expect(page.locator('.tour-dialog')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-tour="subcategories"]')).toBeVisible();
  await expect(page.locator('.tour-spotlight')).toBeVisible();
});
test('preview target follows live desktop/mobile resize with normal motion', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockTutorial(page, { status: 'IN_PROGRESS', step: 'preview', paid: true });
  await page.goto('/dashboard'); await expect(layer(page)).toHaveAttribute('data-step', 'preview');
  for (const width of [1440, 390, 1080, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const key = width <= 1100 ? 'preview-mobile' : 'preview-desktop';
    await expect(page.locator(`[data-tour="${key}"]`)).toBeVisible();
    await expect.poll(async () => {
      const target = await page.locator(`[data-tour="${key}"]`).boundingBox();
      const spot = await page.locator('.tour-spotlight').boundingBox();
      return !!spot && !!target && Math.abs(spot.x - target.x) <= 8 && spot.y < target.y + target.height;
    }).toBe(true);
    await fit(page);
  }
});
test('manual guide expands a collapsed preview and restores it on exit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockTutorial(page, { status: 'COMPLETED', paid: true });
  await page.goto('/dashboard'); await expect(page.locator('app-dashboard-home')).toBeVisible();
  await page.getByRole('button', { name: 'Recolher preview' }).click();
  await expect(page.locator('[data-tour="preview-desktop"]')).toHaveClass(/preview-hidden/);
  await page.locator('button[aria-label="Abrir configurações"]:visible').first().click();
  await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
  await expect(layer(page)).toHaveAttribute('data-step', 'welcome');
  for (let i = 0; i < 15 && await layer(page).getAttribute('data-step') !== 'preview'; i++) await next(page);
  await expect(layer(page)).toHaveAttribute('data-step', 'preview');
  await expect(page.locator('[data-tour="preview-desktop"]')).not.toHaveClass(/preview-hidden/);
  await page.getByRole('button', { name: 'Pular tutorial' }).click();
  await page.getByRole('button', { name: 'Confirmar e pular' }).click();
  await expect(layer(page)).toHaveCount(0);
  await expect(page.locator('[data-tour="preview-desktop"]')).toHaveClass(/preview-hidden/);
});
