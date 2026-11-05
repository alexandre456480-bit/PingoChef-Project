import { expect, Page, test } from '@playwright/test';
test.setTimeout(90_000);

async function fixture(page: Page, plan = 'FREE', template = 'royal-palace', serverReject = false) {
  const writes: string[] = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/^https:\/\/(fonts\.(googleapis|gstatic)\.com|images\.unsplash\.com)/, route => route.abort());
  await page.route('**/api/v1/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace('/api/v1/', '');
    const fulfill = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (request.method() !== 'GET') writes.push(path);
    if (path === 'auth/me') return fulfill({ user: { id: 'owner', name: 'Ana' }, business: { id: 'tenant', name: 'Casa da Ana', slug: 'plans-test' }, accountActive: true, csrfToken: 'a'.repeat(64), plan: { code: plan },
      entitlements: { MAX_PRODUCTS: 30, MAX_CATEGORIES: 10, MAX_VIDEOS: plan === 'FREE' ? 0 : 5, VIDEO_UPLOAD: plan !== 'FREE', THEMATIC_TEMPLATES: plan !== 'FREE' }, usage: { products: 1, categories: 1, videos: 0 }, onboarding: { designConfigured: true } });
    if (path === 'business/tutorial') return fulfill({ tutorial_status: 'COMPLETED' });
    if (path === 'design') return fulfill({ template_key: template, home_blocks: [], custom_config: {} });
    if (path === 'categories') return fulfill([{ id: 'food', name: 'Pratos', isActive: true }]);
    if (path === 'items') return fulfill([{ id: 'item', categoryId: 'food', name: 'Prato', price: 10, isAvailable: true }]);
    if (path === 'business/publish') return serverReject ? route.fulfill({ status: 403, json: { success: false, error: { code: 'THEMATIC_TEMPLATE_REQUIRES_PLAN' } } }) : fulfill({ published: true });
    return fulfill([]);
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'Publicar Cardápio', exact: true })).toBeEnabled({ timeout: 30_000 });
  return writes;
}

test('Free preserves the selected theme and shows an accessible upgrade before publication writes', async ({ page }, info) => {
  const writes = await fixture(page);
  for (const width of info.project.name.includes('mobile') ? [360, 390, 430] : [1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Publicar Cardápio', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: /Dê vida/ });
    await expect(dialog).toContainText('Basic ou superior');
    expect(await dialog.locator('a.primary').evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 250, 240)');
    await expect(dialog).toContainText('Palácio Real');
    expect(writes.filter(path => ['design', 'business/publish', 'media/publish'].includes(path))).toEqual([]);
    const geometry = await dialog.evaluate(el => ({ overflow: el.scrollWidth - el.clientWidth, right: el.getBoundingClientRect().right }));
    expect(geometry.overflow).toBeLessThanOrEqual(1); expect(geometry.right).toBeLessThanOrEqual(width);
    await dialog.screenshot({ path: info.outputPath(`upgrade-${width}.png`) });
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Publicar Cardápio', exact: true }).click();
  await page.getByRole('dialog', { name: /Dê vida/ }).getByRole('link', { name: 'Conhecer os planos' }).click();
  await expect(page).toHaveURL(/\/plans$/);
});

for (const plan of ['BASIC', 'MEDIUM', 'PRO']) test(`${plan} can publish a thematic template`, async ({ page }) => {
  const writes = await fixture(page, plan);
  await page.getByRole('button', { name: 'Publicar Cardápio', exact: true }).click();
  await expect.poll(() => writes.includes('business/publish')).toBe(true);
  await expect(page.locator('app-template-upgrade-dialog')).toHaveCount(0);
});

test('Free publishes simple templates and stale paid state handles the server upgrade response', async ({ page }) => {
  const writes = await fixture(page, 'FREE', 'liquid-glass');
  await page.getByRole('button', { name: 'Publicar Cardápio', exact: true }).click();
  await expect.poll(() => writes.includes('business/publish')).toBe(true);
  await page.unroute('**/api/v1/**');
  await fixture(page, 'BASIC', 'royal-palace', true);
  await page.getByRole('button', { name: 'Publicar Cardápio', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Dê vida/ })).toBeVisible();
});
