import { Page } from '@playwright/test';

export async function togglePanelTheme(page: Page) {
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menu.isVisible() && !await page.locator('.sidebar').evaluate(node => node.classList.contains('mobile-open')))
    await menu.click();
  await page.locator('.sidebar .theme-toggle-btn').click();
}
