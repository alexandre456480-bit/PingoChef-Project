import { expect as baseExpect, Page, test } from '@playwright/test';
import { togglePanelTheme } from './helpers/panel-theme';

const expect = baseExpect.configure({ timeout: 20_000 });
test.setTimeout(120_000);
async function fixture(page: Page) {
  let publications = 0;
  await page.addInitScript(() => {
    if (!localStorage.getItem('pingo-chef-panel-theme')) localStorage.setItem('pingo-chef-panel-theme', 'dark');
  });
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1/', '');
    const fulfill = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path === 'auth/me') return fulfill({ user: { id: 'owner', name: 'Ana' }, business: { id: 'tenant', name: 'Casa da Ana', slug: 'casa-da-ana' },
      accountActive: true, csrfToken: 'a'.repeat(64), plan: { code: 'FREE' }, entitlements: { MAX_PRODUCTS: 10, MAX_CATEGORIES: 4 },
      usage: { products: 0, categories: 0, videos: 0 }, onboarding: { designConfigured: true } });
    if (path === 'business/tutorial') return fulfill({ tutorial_status: 'COMPLETED' });
    if (path === 'design') return fulfill(route.request().method() === 'PUT' ? route.request().postDataJSON() : {});
    if (path === 'business/publish') { publications++; return fulfill({ published: true }); }
    if (path === 'items/media/publish-ready') return fulfill({ publishedCount: 0 });
    return fulfill([]);
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/dashboard');
  await expect(page.locator('app-dashboard-home')).toBeVisible();
  return () => publications;
}

test('mobile header matches reference, keeps actions on one row and supports both themes', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  const header = page.locator('app-topbar');
  const menu = header.getByRole('button', { name: 'Abrir menu', exact: true });
  const preview = header.getByRole('button', { name: 'Preview do Cardápio', exact: true });
  const publish = header.getByRole('button', { name: 'Publicar Cardápio', exact: true });
  await expect(header.locator('input, .theme-toggle-btn, .mobile-settings-toggle, .mobile-search-toggle')).toHaveCount(0);
  await expect(preview.locator('svg.preview-phone-icon')).toBeVisible();
  for (const theme of ['dark', 'light']) {
    for (const width of [320, 360, 390, 430, 640]) {
      await page.setViewportSize({ width, height: 844 });
      const boxes = await Promise.all([menu.boundingBox(), preview.boundingBox(), publish.boundingBox()]);
      for (const box of boxes) {
        expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        expect(Math.abs(box!.y + box!.height / 2 - (boxes[0]!.y + boxes[0]!.height / 2))).toBeLessThan(1);
      }
      expect(boxes[0]!.x + boxes[0]!.width).toBeLessThan(boxes[1]!.x);
      expect(boxes[1]!.x + boxes[1]!.width).toBeLessThan(boxes[2]!.x);
      expect(await publish.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      if (width === 390) await header.screenshot({ path: info.outputPath(`header-${theme}.png`) });
    }
    if (theme === 'dark') await togglePanelTheme(page);
  }
  await page.reload();
  await expect(page.locator('.dashboard-shell')).toHaveAttribute('data-panel-theme', 'light');
});

test('mobile preview, sidebar settings, support email and publishing remain functional', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const publications = await fixture(page);
  await page.getByRole('button', { name: 'Preview do Cardápio', exact: true }).click();
  await expect(page.locator('.mobile-preview-modal')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar preview do cardápio', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await expect(page.locator('.sidebar .theme-toggle-btn')).toBeInViewport();
  await page.getByRole('button', { name: 'Abrir configurações', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Configurações', exact: true });
  await expect(settings).toBeVisible();
  await settings.getByRole('button', { name: 'Suporte', exact: true }).click();
  await expect(settings.getByRole('link', { name: 'pingochefcardapio@gmail.com', exact: true })).toHaveAttribute('href', 'mailto:pingochefcardapio@gmail.com');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Publicar Cardápio', exact: true }).click();
  await expect(page.getByText('Cardápio publicado com sucesso na versão online!', { exact: true })).toBeVisible();
  expect(publications()).toBe(1);
});
