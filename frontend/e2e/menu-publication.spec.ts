import { expect, test } from '@playwright/test';

test.setTimeout(90_000);

test('a failed catalogue refresh does not report a successful publication as failed', async ({ page }) => {
  let itemReads = 0, published = 0;
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1/', '');
    if (path === 'auth/me') return route.fulfill({ json: { success: true, data: {
      user: { id: 'owner' }, business: { id: 'business', name: 'Restaurante', slug: 'restaurante' },
      accountActive: true, plan: { code: 'PRO' }, entitlements: {}, usage: {},
      csrfToken: 'a'.repeat(64), onboarding: { designConfigured: true }
    } } });
    if (path === 'items') {
      if (++itemReads > 1) return route.fulfill({ status: 500, json: { success: false, error: { code: 'DATABASE_ERROR' } } });
      return route.fulfill({ json: { success: true, data: [{ id: 'item', categoryId: 'cat', name: 'Produto', price: 20, isAvailable: true }] } });
    }
    if (path === 'business/publish') { published++; return route.fulfill({ json: { success: true, data: { published: true } } }); }
    if (path === 'items/media/publish-ready') return route.fulfill({ json: { success: true, data: { publishedCount: 0 } } });
    if (path === 'design') return route.fulfill({ json: { success: true, data: {} } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto('/dashboard');
  await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
  const publish = page.locator('[data-tour="publish-menu"]');
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect.poll(() => published).toBe(1);
  await expect(page.getByText(/Cardápio publicado.*atualizar/i)).toBeVisible();
});
