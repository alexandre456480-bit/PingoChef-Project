import { expect, test } from '@playwright/test';

test.setTimeout(120_000);
test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.fulfill({ contentType: 'text/css', body: '' }));
});

const framePath = '/assets/mascots/loading/pingo-run-';

test('public loading shows its shell and local skeleton without downloading mascot frames', async ({ page }, testInfo) => {
  let releaseRequest!: () => void;
  const pendingResponse = new Promise<void>(resolve => releaseRequest = resolve);
  const frames: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.includes(framePath)) frames.push(request.url()); });
  await page.route('**/api/v1/public/menu/**', async route => {
    await pendingResponse;
    await route.fulfill({ status: 404, json: { success: false } });
  });
  await page.goto('/m/validacao-loader');
  await expect(page.locator('.public-app-container')).toBeVisible();
  await expect(page.locator('.menu-skeleton')).toHaveClass(/is-visible/);
  await page.screenshot({ path: `test-results/public-skeleton-${testInfo.project.name}.png` });
  expect(frames).toEqual([]);
  releaseRequest();
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  await expect(page.locator('.menu-skeleton')).toHaveCount(0);
});

test('uses dark as the dashboard default and preserves a light preference', async ({ page }) => {
  let releaseRequests!: () => void;
  const pendingResponses = new Promise<void>(resolve => releaseRequests = resolve);

  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('user_data', JSON.stringify({ id: 'e2e-user', name: 'Teste' }));
    localStorage.setItem('business_data', JSON.stringify({ name: 'Pingo Teste', slug: 'pingo-teste' }));
    localStorage.removeItem('pingo-chef-panel-theme');
  });

  await page.route('**/api/v1/**', async route => {
    await pendingResponses;
    const isDesign = new URL(route.request().url()).pathname.endsWith('/design');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: isDesign ? {} : [] })
    });
  });

  await page.goto('/dashboard');
  const shell = page.locator('.dashboard-shell');
  await expect(shell).toHaveAttribute('data-panel-theme', 'dark');
  await expect(page.getByRole('status')).toBeVisible();
  releaseRequests();
  await expect(page.getByRole('status')).not.toBeVisible();

  const themeButton = page.getByRole('button', { name: 'Ativar tema claro' });
  await expect(themeButton).toBeVisible();
  await themeButton.click();
  await expect(shell).toHaveAttribute('data-panel-theme', 'light');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pingo-chef-panel-theme'))).toBe('light');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('keeps the public skeleton static', async ({ page }) => {
    let releaseRequest!: () => void;
    const pendingResponse = new Promise<void>(resolve => releaseRequest = resolve);
    await page.route('**/api/v1/public/menu/**', async route => {
      await pendingResponse;
      await route.fulfill({ status: 404, json: {} });
    });
    await page.goto('/m/movimento-reduzido');
    await expect(page.locator('.menu-skeleton')).toHaveClass(/is-visible/);
    await expect(page.locator('.skeleton-logo')).toHaveCSS('animation-name', 'none');
    releaseRequest();
  });
});
