import { expect, test } from '@playwright/test';

test('public menu searches all categories and returns to the current category on clear', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/v1/public/menu/search-regression', route => route.fulfill({
    json: { success: true, data: {
      business: { name: 'Cardápio teste', slug: 'search-regression', welcomeBgType: 'color' },
      design: {
        templateKey: 'default',
        homeBlocks: [{ id: 'categories', type: 'categories', enabled: true, position: 0 }],
      },
      categories: [{ id: 'food', name: 'Pratos' }, { id: 'drinks', name: 'Bebidas' }],
      subcategories: [{ id: 'juice', categoryId: 'drinks', name: 'Sucos' }],
      items: [
        { id: 'food-1', categoryId: 'food', name: 'Espetinho', price: 19, isAvailable: true },
        { id: 'drink-1', categoryId: 'drinks', subcategoryId: 'juice', name: 'Suco de limão', price: 9, isAvailable: true },
      ],
    } },
  }));

  await page.goto('/m/search-regression');
  await page.getByRole('button', { name: 'Ver o Cardápio' }).click();
  await page.getByRole('button', { name: 'Pratos', exact: true }).click();
  const catalog = page.locator('.catalog-section');
  await expect(catalog.getByText('Espetinho', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Buscar prato ou bebida' }).click();
  const search = page.getByRole('textbox', { name: 'Buscar produtos' });
  await search.fill('limao');
  await expect(catalog.getByText('Suco de limão', { exact: true })).toBeVisible({ timeout: 3000 });
  await expect(catalog.getByText('Espetinho', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await expect(catalog.getByRole('heading', { name: 'Pratos' })).toBeVisible();
  await expect(catalog.getByText('Espetinho', { exact: true })).toBeVisible();
  await expect(catalog.getByText('Suco de limão', { exact: true })).toHaveCount(0);
});
