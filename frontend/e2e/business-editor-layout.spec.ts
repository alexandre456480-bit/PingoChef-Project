import { expect, test } from '@playwright/test';

test('campos da empresa ficam dentro do cartão em larguras estreitas', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 800 });
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('user_data', JSON.stringify({ id: 'e2e-user' }));
    localStorage.setItem('business_data', JSON.stringify({
      id: 'e2e-business', name: 'Restaurante Teste', slug: 'restaurante-teste', description: 'Descrição de teste'
    }));
  });
  await page.route('**/api/v1/categories', route => route.fulfill({ json: { success: true, data: [] } }));
  await page.route('**/api/v1/items', route => route.fulfill({ json: { success: true, data: [] } }));
  await page.route('**/api/v1/design', route => route.fulfill({ json: { success: true, data: {} } }));

  await page.goto('/dashboard');
  await page.locator('.nav-item').filter({ hasText: 'Empresa' }).click();
  await expect(page.locator('input[name="bName"]')).toBeVisible();

  for (const width of [1180, 390]) {
    await page.setViewportSize({ width, height: 800 });
    const layout = await page.locator('app-business-editor').evaluate(editor => {
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
