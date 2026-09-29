import { expect, test } from '@playwright/test';

const framePath = '/assets/mascots/loading/pingo-run-';

test('shows the six-frame Pingo loader while the public menu is loading', async ({ page }, testInfo) => {
  let releaseRequest!: () => void;
  const pendingResponse = new Promise<void>(resolve => releaseRequest = resolve);
  const assetRequests = new Map<string, number>();
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.includes(framePath)) {
      assetRequests.set(url.pathname, (assetRequests.get(url.pathname) ?? 0) + 1);
    }
  });

  await page.route('**/api/v1/public/menu/**', async route => {
    await pendingResponse;
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ success: false })
    });
  });

  await page.goto('/m/validacao-loader');

  const loader = page.getByRole('status');
  await expect(loader).toBeVisible();
  await expect(loader).toContainText('Preparando seu cardápio...');

  const frames = loader.locator('.pingo-loader__preload-frame');
  await expect(frames).toHaveCount(6);
  await expect.poll(async () => frames.evaluateAll(images => images.every(image => {
    const frame = image as HTMLImageElement;
    return frame.complete && frame.naturalWidth > 0 && frame.naturalHeight > 0;
  }))).toBe(true);

  const dimensions = await frames.evaluateAll(images => images.map(image => {
    const frame = image as HTMLImageElement;
    return `${frame.naturalWidth}x${frame.naturalHeight}`;
  }));
  expect(new Set(dimensions).size).toBe(1);
  const visibleFrame = loader.locator('.pingo-loader__frame');
  await expect(visibleFrame).toHaveJSProperty('complete', true);

  await page.screenshot({ path: `test-results/pingo-loader-${testInfo.project.name}.png` });
  releaseRequest();
  await expect(loader).not.toBeVisible();

  expect(assetRequests.size).toBe(6);
  expect([...assetRequests.values()]).toEqual([1, 1, 1, 1, 1, 1]);
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

  test('keeps a static mascot frame', async ({ page }) => {
    let releaseRequest!: () => void;
    const pendingResponse = new Promise<void>(resolve => releaseRequest = resolve);

    await page.route('**/api/v1/public/menu/**', async route => {
      await pendingResponse;
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/m/movimento-reduzido');
    const loader = page.getByRole('status');
    await expect(loader).toBeVisible();

    const frame = loader.locator('.pingo-loader__frame');
    await expect(frame).toHaveCSS('animation-name', 'none');
    await expect(frame).toHaveAttribute('src', /pingo-run-01\.webp$/);
    releaseRequest();
  });
});
