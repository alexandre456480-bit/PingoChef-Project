import { Page } from '@playwright/test';

export async function togglePanelTheme(page: Page) {
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menu.isVisible() && !await page.locator('.sidebar').evaluate(node => node.classList.contains('mobile-open')))
    await menu.click();
  await page.getByRole('button', { name: 'Abrir configurações', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Configurações', exact: true });
  await settings.getByRole('button', { name: /Ativar tema (claro|escuro)/ }).click();
  await settings.getByRole('button', { name: 'Fechar configurações' }).click();
}
