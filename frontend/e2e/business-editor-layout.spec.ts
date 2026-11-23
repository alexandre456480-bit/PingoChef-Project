import { expect, test } from '@playwright/test';

test('campos da empresa ficam dentro do cartão em larguras estreitas', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 800 });
  const business = { id: 'e2e-business', name: 'Restaurante Teste', slug: 'restaurante-teste' };
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/auth/me')
      ? { user: { id: 'e2e-user' }, business, accountActive: true }
      : path.endsWith('/business/tutorial') ? { tutorial_status: 'COMPLETED' }
      : path.endsWith('/business') ? business
      : path.endsWith('/design') ? {} : [];
    return route.fulfill({ json: { success: true, data } });
  });

  await page.goto('/dashboard');
  await page.locator('.nav-item').filter({ hasText: 'Empresa' }).click();
  const editor = page.locator('app-business-editor');
  const summaries = editor.locator('.company-section > summary');
  const openSections = editor.locator('.company-section[open]');
  await expect(summaries).toHaveCount(5);
  await expect(openSections).toHaveCount(0);
  const name = editor.locator('input[name="bName"]');
  await expect(name).toBeHidden();
  const identity = summaries.filter({ hasText: 'Dados do Estabelecimento' });
  await identity.focus();
  await identity.press('Enter');
  await expect(name).toBeVisible();
  await name.fill('Restaurante em edição');
  await identity.click();
  await expect(openSections).toHaveCount(0);
  await identity.click();
  await expect(name).toHaveValue('Restaurante em edição');

  for (const width of [1180, 390]) {
    await page.setViewportSize({ width, height: 800 });
    const layout = await editor.evaluate(editor => {
      const card = editor.querySelector('.business-card')!.getBoundingClientRect();
      const fields = ['input[name="bName"]', 'input[name="bSlug"]', 'textarea[name="bDesc"]'];
      return fields.map(selector => {
        const rect = editor.querySelector(selector)!.getBoundingClientRect();
        return { left: rect.left, right: rect.right, cardLeft: card.left, cardRight: card.right };
      });
    });
    for (const field of layout) {
      expect(field.left).toBeGreaterThanOrEqual(field.cardLeft - 1);
      expect(field.right).toBeLessThanOrEqual(field.cardRight + 1);
    }
  }
});
