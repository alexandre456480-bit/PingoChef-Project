import { togglePanelTheme } from './helpers/panel-theme';
import { expect, test, Page } from '@playwright/test';

test.setTimeout(120_000);

async function openDesign(page: Page) {
  let design: any = {};
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.addInitScript(() => localStorage.setItem('pingo-chef-panel-theme', 'light'));
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1/', '');
    if (path === 'auth/me') return route.fulfill({ json: { success: true, data: {
      user: { id: 'owner', email: 'owner@example.test' },
      business: { id: 'business', name: 'Bistrô', slug: 'bistro' },
      accountActive: true, plan: { code: 'PRO' },
      entitlements: {}, usage: { products: 0, categories: 0, videos: 0 },
      csrfToken: 'a'.repeat(64), onboarding: { designConfigured: true }
    } } });
    if (path === 'design') {
      if (request.method() === 'PUT') design = request.postDataJSON();
      return route.fulfill({ json: { success: true, data: design } });
    }
    return route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto('/dashboard');
  await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 15_000 });
  const nav = page.getByRole('navigation').getByRole('button', { name: 'Design', exact: true });
  if (!await nav.isVisible()) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await nav.click();
  const editor = page.locator('app-design-editor');
  await expect(editor).toBeVisible();
  return editor;
}

test('sections collapse with keyboard without losing draft colors or typography, and save survives reload', async ({ page }) => {
  const editor = await openDesign(page);
  const sections = editor.locator('details.design-section');
  await expect(sections).toHaveCount(8);
  await expect(editor.locator('details[open]')).toHaveCount(1);
  await expect(editor.getByText('Animações', { exact: true })).toHaveCount(0);
  const structure = editor.locator('summary').filter({ hasText: 'Estrutura & Template' });
  await structure.focus();
  await page.keyboard.press('Enter');
  await expect(editor.locator('.templates-grid')).toBeHidden();
  await page.keyboard.press('Space');
  await expect(editor.locator('.templates-grid')).toBeVisible();

  const palettes = editor.locator('details').filter({ has: page.getByRole('heading', { name: 'Paleta de Cores', exact: true }) });
  await palettes.locator('summary').click();
  await expect(palettes.locator('.palette-card')).toHaveCount(18);
  await palettes.getByRole('button', { name: 'Escuras / Dark', exact: true }).click();
  await expect(palettes.locator('.palette-card:not(.custom-card)')).toHaveCount(8);
  await expect(palettes.locator('.palette-card:not(.custom-card) .light-chip')).toHaveCount(0);
  await palettes.locator('.palette-card').filter({ hasText: 'Grafite & Cobre' }).click();
  await palettes.getByRole('button', { name: 'Claras / Light', exact: true }).click();
  await expect(palettes.locator('.palette-card:not(.custom-card)')).toHaveCount(9);
  await expect(palettes.locator('.palette-card:not(.custom-card) .dark-chip')).toHaveCount(0);
  await expect(palettes.locator('.selection-summary')).toContainText('Grafite & Cobre');
  await palettes.locator('summary').click();

  const typography = editor.locator('details').filter({ has: page.getByRole('heading', { name: 'Tipografia', exact: true }) });
  await typography.locator('summary').click();
  const heading = typography.getByRole('group', { name: 'Filtrar fontes de títulos', exact: true });
  await heading.getByRole('button', { name: 'Impacto / Condensadas', exact: true }).click();
  await expect(typography.locator('.typography-category-block').first().locator('.font-select-card')).toHaveCount(2);
  await typography.locator('.typography-category-block').first().getByRole('button', { name: /Oswald/ }).click();
  const pairs = typography.getByRole('group', { name: 'Filtrar combinações por estilo', exact: true });
  await pairs.getByRole('button', { name: 'Impacto / Condensadas', exact: true }).click();
  await typography.getByRole('button', { name: 'Impacto & Street Food (Oswald + Source Sans 3)', exact: true }).click();
  await expect(typography.locator('.current-font-pill').last()).toHaveText('Source Sans 3');
  const bodyFilters = typography.getByRole('group', { name: 'Filtrar fontes de leitura', exact: true });
  await expect(bodyFilters.getByRole('button', { name: 'Impacto / Condensadas', exact: true })).toHaveCount(0);
  await bodyFilters.getByRole('button', { name: 'Arredondadas', exact: true }).click();
  await expect(typography.locator('.typography-category-block').last().locator('.font-select-card')).toHaveCount(2);
  await typography.locator('summary').click();
  await typography.locator('summary').click();
  await expect(typography.locator('.current-font-pill').first()).toHaveText('Oswald');
  await heading.getByRole('button', { name: 'Pixel', exact: true }).click();
  await expect(typography.locator('.typography-category-block').first().locator('.font-select-card')).toHaveCount(1);
  await bodyFilters.getByRole('button', { name: 'Pixel', exact: true }).click();
  await expect(typography.locator('.typography-category-block').last().locator('.font-select-card')).toHaveCount(1);
  await pairs.getByRole('button', { name: 'Pixel', exact: true }).click();
  await typography.getByRole('button', { name: 'Pixel & Arcade (Silkscreen + Pixelify Sans)', exact: true }).click();
  await expect(typography.locator('.current-font-pill').first()).toHaveText('Silkscreen');
  await expect(typography.locator('.current-font-pill').last()).toHaveText('Pixelify Sans');

  const showcase = editor.locator('.template-card').filter({ hasText: 'Pixel' });
  await expect(editor.locator('.template-card')).toHaveCount(6);
  await expect(showcase).toHaveCount(1);
  await showcase.click();
  await expect(showcase).toHaveAttribute('aria-pressed', 'true');

  const description = '  Primeiro  par\u00e1grafo.\n\n    Segundo par\u00e1grafo.\nTexto <b>literal</b>.  ';
  const intro = editor.locator('details').filter({ has: page.locator('.intro-textarea') });
  await intro.locator('summary').click();
  await editor.locator('.intro-textarea').fill(description);
  expect(await editor.locator('.preview-card-desc').textContent()).toBe(description);
  await expect(editor.locator('.preview-card-desc')).toHaveCSS('white-space', 'break-spaces');
  await expect(editor.locator('.preview-card-desc b')).toHaveCount(0);
  const save = page.waitForRequest(r => r.url().endsWith('/api/v1/design') && r.method() === 'PUT');
  await editor.getByRole('button', { name: /Salvar Alterações|Salvar e Sincronizar/ }).click();
  const payload = (await save).postDataJSON();
  expect(payload).toMatchObject({ template_key: 'pixel', palette: { key: 'graphite_copper' }, font_heading: 'Silkscreen', font_body: 'Pixelify Sans', font_pair: 'pixel_arcade' });
  expect(payload.custom_config.intro_card.description).toBe(description);
  expect(payload.custom_config).not.toHaveProperty('template_variant');
  expect(payload.home_blocks.some((block: any) => block.type === 'template_variant')).toBe(false);
  expect(payload).not.toHaveProperty('motion');
  expect(payload).not.toHaveProperty('paletteFilter');
  await expect(editor.locator('.saved-badge')).toBeAttached();
  await page.reload();
  await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 15_000 });
  const nav = page.getByRole('navigation').getByRole('button', { name: 'Design', exact: true });
  if (!await nav.isVisible()) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await nav.click();
  await expect(showcase).toHaveAttribute('aria-pressed', 'true');
  expect(await editor.locator('.intro-textarea').inputValue()).toBe(description);
  expect(await editor.locator('.preview-card-desc').textContent()).toBe(description);
  await editor.locator('summary').filter({ has: page.getByRole('heading', { name: 'Paleta de Cores', exact: true }) }).click();
  await expect(editor.locator('.palette-card').filter({ hasText: 'Grafite & Cobre' })).toHaveAttribute('aria-pressed', 'true');
});

test('expanded controls fit narrow screens in light and dark panel themes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const editor = await openDesign(page);
  const summaries = await editor.locator('details > summary').all();
  for (const summary of summaries.slice(1)) await summary.click();
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await togglePanelTheme(page);
    await expect(page.locator('.dashboard-shell')).toHaveAttribute('data-panel-theme', theme);
    const overflow = await editor.evaluate(element => Array.from(element.querySelectorAll('.design-section, .design-filters, .fonts-selection-grid, .palettes-grid, .btn-preset-pill')).filter(node => {
      const rect = node.getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      return rect.left < bounds.left - 1 || rect.right > bounds.right + 1;
    }).map(node => node.className));
    expect(overflow).toEqual([]);
  }
});
