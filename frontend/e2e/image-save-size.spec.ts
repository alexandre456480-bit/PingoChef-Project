import { expect, test } from '@playwright/test';

test.setTimeout(120_000);

test('large company images and a color change save below the published request limit', async ({ page }) => {
  let business: any = { id: 'business', name: 'Restaurante Teste', slug: 'restaurante-teste', description: '', welcome_bg_type: 'image', welcome_bg_color: '#FFFFFF', logo_url: null, welcome_bg_image: null };
  const saves: any[] = [];
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1/', '');
    if (path === 'auth/me') return route.fulfill({ json: { success: true, data: {
      user: { id: 'owner', email: 'owner@example.test' }, business, accountActive: true,
      plan: { code: 'PRO' }, entitlements: {}, usage: { products: 0, categories: 0, videos: 0 },
      csrfToken: 'a'.repeat(64), onboarding: { designConfigured: true }
    } } });
    if (path === 'business') {
      if (request.method() === 'PUT') {
        const bytes = Buffer.byteLength(request.postData() || '');
        if (bytes > 4_500_000) return route.fulfill({ status: 413, body: 'Request too large' });
        const body = request.postDataJSON();
        saves.push({ bytes, body });
        business = { ...business, ...body };
      }
      return route.fulfill({ json: { success: true, data: business } });
    }
    if (path === 'design') return route.fulfill({ json: { success: true, data: {} } });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto('/dashboard');
  await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
  const nav = page.getByRole('navigation').getByRole('button', { name: 'Empresa', exact: true });
  if (!await nav.isVisible()) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await nav.click();
  const editor = page.locator('app-business-editor');
  await expect(editor).toBeVisible();
  const source = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 900;
    const context = canvas.getContext('2d')!;
    const pixels = context.createImageData(canvas.width, canvas.height);
    let seed = 42;
    for (let i = 0; i < pixels.data.length; i += 4) {
      for (let channel = 0; channel < 3; channel++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        pixels.data[i + channel] = seed >>> 24;
      }
      pixels.data[i + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL('image/png');
  });
  expect(source.length * 2).toBeGreaterThan(4_500_000);
  const file = { name: 'large-image.png', mimeType: 'image/png', buffer: Buffer.from(source.split(',')[1], 'base64') };
  await editor.locator('input[type="file"]').nth(0).setInputFiles(file);
  await page.getByRole('button', { name: 'Usar imagem', exact: true }).click();
  await expect(editor.locator('.logo-img')).toHaveAttribute('src', /^data:image\/webp/);
  await editor.locator('input[type="file"]').nth(1).setInputFiles(file);
  await page.getByRole('button', { name: 'Usar imagem', exact: true }).click();
  await expect(editor.locator('.bg-preview-wrap')).toHaveAttribute('style', /data:image\/webp/);
  await editor.locator('[data-tour="company-save"]').click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0].bytes).toBeLessThanOrEqual(3_500_000);
  expect(saves[0].body.logo_url).toMatch(/^data:image\/webp/);
  await editor.getByRole('button', { name: 'Duas Cores Personalizadas' }).click();
  await editor.locator('#welcomeColorPicker').fill('#125634');
  await editor.locator('#welcomeAccentColorPicker').fill('#ffb800');
  await editor.locator('[data-tour="company-save"]').click();
  await expect.poll(() => saves.length).toBe(2);
  expect(saves[1].body.welcome_bg_color).toBe('#125634');
  expect(saves[1].body.welcome_bg_accent_color).toBe('#ffb800');
  expect(saves[1].bytes).toBeLessThanOrEqual(3_500_000);
});
