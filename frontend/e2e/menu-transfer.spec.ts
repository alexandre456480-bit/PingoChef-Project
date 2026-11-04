import { expect, test } from '@playwright/test';

test.setTimeout(120_000);
test('exports and imports a large menu in bounded chunks with review, confirmation and a backup', async ({ page }, testInfo) => {
  const archive = { format: 'pingochef-menu', version: 1, exportedAt: '2026-11-04T12:00:00.000Z', excludedVideos: 0,
    business: { name: 'Restaurante', logo_url: 'data:image/png;base64,' + 'A'.repeat(5_000_000) }, design: null, categories: [], subcategories: [], items: [] };
  const text = JSON.stringify(archive), chunks = Math.ceil(text.length / 500_000);
  let applied = 0, uploaded = '', previews = 0, exports = 0;
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/api/v1/**', route => {
    const req = route.request(), path = new URL(req.url()).pathname.replace('/api/v1/', '');
    if (path === 'auth/me') return route.fulfill({ json: { success: true, data: {
      user: { id: 'owner' }, business: { id: 'business', name: 'Restaurante', slug: 'restaurante' },
      accountActive: true, plan: { code: 'PRO' }, entitlements: {}, usage: {}, csrfToken: 'a'.repeat(64), onboarding: { designConfigured: true }
    } } });
    if (path.startsWith('menu-transfer')) {
      if (!['GET', 'DELETE'].includes(req.method())) {
        expect(req.headers()['x-csrf-token']).toBe('a'.repeat(64));
        expect(Buffer.byteLength(req.postData()!)).toBeLessThan(3_000_000);
      }
      if (path === 'menu-transfer') {
        const body = req.postDataJSON();
        if (body.kind === 'export') { exports++; return route.fulfill({ json: { success: true, data: { id: 'export', parts: chunks } } }); }
        return route.fulfill({ json: { success: true, data: { id: 'import', parts: body.parts } } });
      }
      if (req.method() === 'GET') { const index = Number(path.split('/').at(-1)); return route.fulfill({ json: { success: true, data: text.slice(index * 500_000, (index + 1) * 500_000) } }); }
      if (req.method() === 'PUT') { uploaded += req.postDataJSON().content; return route.fulfill({ json: { success: true } }); }
      if (path.endsWith('/preview')) { previews++; return route.fulfill({ json: { success: true, data: { name: 'Restaurante', template: 'sweet-boutique', categories: 0, subcategories: 0, items: 0, excludedVideos: 0, canReplaceCatalog: true } } }); }
      if (path.endsWith('/apply')) { expect(req.postDataJSON()).toEqual({ catalog: true, confirmed: true }); applied++; }
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ json: { success: true, data: path === 'design' ? {} : [] } });
  });
  await page.goto('/dashboard');
  await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 30_000 });
  if (testInfo.project.name.includes('mobile')) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir configurações', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByTestId('export-menu').click();
  expect((await download).suggestedFilename()).toMatch(/cardapio.*\.pingochef\.json$/);
  await expect(page.getByText('Exportação concluída.', { exact: false })).toBeVisible();
  await page.getByTestId('menu-file').setInputFiles({ name: 'menu.pingochef.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.getByText('Revise antes de importar')).toBeVisible();
  expect(uploaded).toBe(text); expect(previews).toBe(1); expect(applied).toBe(0);
  const confirm = page.getByTestId('confirm-import');
  await expect(confirm).toBeDisabled();
  await page.getByRole('checkbox', { name: /Revisei o conteúdo/ }).check();
  await page.screenshot({ path: testInfo.outputPath('menu-transfer-review.png'), fullPage: true });
  const backup = page.waitForEvent('download');
  await confirm.click();
  expect((await backup).suggestedFilename()).toContain('backup-antes-da-importacao');
  await expect(page.getByRole('button', { name: 'Recarregar painel', exact: true })).toBeVisible();
  expect(applied).toBe(1); expect(exports).toBe(2);
  await expect(page.getByRole('button', { name: 'Fechar configurações', exact: true })).toBeDisabled();
});
