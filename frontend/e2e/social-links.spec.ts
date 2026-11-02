import { expect, Page, test } from '@playwright/test';

test.setTimeout(90_000);
const instagram = { platform: 'instagram', url: 'https://www.instagram.com/pingochef/' };
const whatsapp = { platform: 'whatsapp', url: 'https://wa.me/5511999999999' };
const palette = {
  key: 'custom',
  colors: {
    primary: '#173E34',
    secondary: '#849D90',
    accent: '#BA591B',
    background: '#F4F8F3',
    surface: '#FFFFFF',
    textPrimary: '#183027',
    textSecondary: '#586A61',
  },
};
async function fixture(page: Page) {
  let business = {
    id: 'tenant',
    name: 'Pingo Chef',
    slug: 'social-test',
    logo_url: '/logo_img.webp',
    social_links: [] as any[],
  };
  let templateKey = 'default';
  let activePalette = palette;
  let publicLinks: any[] | null = null;
  let writes = 0;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(/^https:\/\/(fonts\.(googleapis|gstatic)\.com|images\.unsplash\.com)/, (route) =>
    route.abort(),
  );
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace('/api/v1/', '');
    const fulfill = (data: unknown) => route.fulfill({ json: { success: true, data } });
    if (path === 'auth/me')
      return fulfill({
        user: { id: 'owner', name: 'Ana' },
        business,
        accountActive: true,
        csrfToken: 'a'.repeat(64),
        plan: { code: 'FREE' },
        entitlements: { MAX_PRODUCTS: 10, MAX_CATEGORIES: 4 },
        usage: { products: 1, categories: 1, videos: 0 },
        onboarding: { designConfigured: true },
      });
    if (path === 'business/tutorial') return fulfill({ tutorial_status: 'COMPLETED' });
    if (path === 'business') {
      if (req.method() === 'PUT') {
        writes++;
        business = { ...business, ...req.postDataJSON() };
      }
      return fulfill(business);
    }
    if (path === 'design')
      return fulfill({
        template_key: templateKey,
        palette: activePalette,
        custom_config: { enable_cart: true },
      });
    if (path === 'categories')
      return fulfill([{ id: 'food', name: 'Pratos', iconType: 'none', isActive: true }]);
    if (path === 'public/menu/social-test')
      return fulfill({
        business: {
          name: business.name,
          slug: business.slug,
          logoUrl: business.logo_url,
          welcomeBgType: 'color',
          socialLinks: publicLinks ?? business.social_links,
        },
        design: {
          templateKey,
          palette: activePalette,
          heroBanners: ['/logo_img.webp'],
          fontBody: 'Lora',
          fontHeading: 'Oswald',
          homeBlocks: [
            { id: 'hero', type: 'hero', enabled: true, position: 0 },
            { id: 'categories', type: 'categories', enabled: true, position: 1 },
          ],
          customConfig: {
            enable_cart: true,
            intro_card: { enabled: true, description: 'Da casa' },
          },
        },
        categories: [{ id: 'food', name: 'Pratos', iconType: 'none' }],
        subcategories: [],
        items: [],
      });
    return fulfill([]);
  });
  return {
    business: () => business,
    writes: () => writes,
    template: (key: string) => (templateKey = key),
    links: (links: any[]) => (publicLinks = links),
    palette: (value: typeof palette) => (activePalette = value),
  };
}
async function company(page: Page) {
  await page.goto('/dashboard');
  await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
  const nav = page.locator('[data-tour="nav-empresa"]');
  if (!(await nav.isVisible()))
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await nav.click();
  await expect(page.locator('app-social-links-editor')).toBeVisible();
}
async function publicMenu(page: Page) {
  await page.goto('/m/social-test');
  await page.getByRole('button', { name: 'Ver o Cardápio', exact: true }).click();
}

test('social links open their destination with click and keyboard activation', async ({ page, context }) => {
  const data = await fixture(page);
  data.links([instagram]);
  await context.route('https://www.instagram.com/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Social destination</title>' }));
  await publicMenu(page);
  for (const keyboard of [false, true]) {
    await page.locator('app-social-menu .trigger').click();
    const link = page.getByRole('navigation', { name: 'Redes sociais e canais de pedido' }).getByRole('link').first();
    const popupPromise = page.waitForEvent('popup', { timeout: 5000 });
    if (keyboard) { await link.focus(); await page.keyboard.press('Enter'); }
    else await link.click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(instagram.url);
    await popup.close();
    await page.keyboard.press('Escape');
  }
});

test('social picker has readable text and fits desktop and mobile in both panel themes', async ({
  page,
}, info) => {
  await fixture(page);
  await company(page);
  const editor = page.locator('app-social-links-editor');
  for (const theme of ['dark', 'light']) {
    // Exercise the actual theme scope without changing the user's stored preference.
    await page
      .locator('.dashboard-shell')
      .evaluate((element, value) => element.setAttribute('data-panel-theme', value), theme);
    await editor.getByRole('button', { name: 'Escolher', exact: true }).click();
    const options = editor.locator('.choices');
    const contrast = await options
      .locator('button')
      .first()
      .evaluate((element) => {
        const rgb = (value: string) =>
          value
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number);
        const luminance = (color: number[]) =>
          color
            .map((value) => {
              const channel = value / 255;
              return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            })
            .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        const ink = luminance(rgb(getComputedStyle(element).color));
        const surface = luminance(
          rgb(getComputedStyle(element.closest('.choices')!).backgroundColor),
        );
        return (Math.max(ink, surface) + 0.05) / (Math.min(ink, surface) + 0.05);
      });
    expect(contrast, `${theme} social picker contrast`).toBeGreaterThanOrEqual(4.5);
    const bounds = await options.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.screenshot({ path: info.outputPath(`social-picker-${theme}.png`) });
    await page.keyboard.press('Escape');
    await expect(options).toHaveCount(0);
  }
});

test('public social menu retains dark customer colors and fits the mobile viewport', async ({
  page,
}, info) => {
  const data = await fixture(page);
  data.links([instagram, whatsapp]);
  data.palette({
    ...palette,
    colors: {
      ...palette.colors,
      background: '#180B15',
      surface: '#281320',
      textPrimary: '#FFF8E6',
      textSecondary: '#D8CAD5',
    },
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await publicMenu(page);
  const trigger = page.locator('app-social-menu .trigger');
  await expect(trigger).toHaveCSS('background-color', 'rgb(40, 19, 32)');
  await expect(trigger).toHaveCSS('color', 'rgb(255, 248, 230)');
  await trigger.click();
  const nav = page.getByRole('navigation', { name: 'Redes sociais e canais de pedido' });
  await expect(nav).toHaveCSS('background-color', 'rgb(40, 19, 32)');
  await expect(nav.getByRole('link').first()).toHaveCSS('color', 'rgb(255, 248, 230)');
  const bounds = await nav.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568);
  await page.screenshot({ path: info.outputPath('public-social-dark.png') });
});
test('company adds, validates, previews, saves, reloads and removes social links', async ({
  page,
}, info) => {
  const data = await fixture(page);
  await company(page);
  const editor = page.locator('app-social-links-editor');
  await editor.getByRole('button', { name: 'Escolher', exact: true }).click();
  await expect(editor.locator('.choices button')).toHaveCount(6);
  await editor.getByRole('button', { name: 'Instagram', exact: true }).click();
  await editor.getByRole('textbox', { name: 'Link da rede social' }).fill('javascript:alert(1)');
  await editor.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(editor.getByRole('alert')).toBeVisible();
  expect(data.writes()).toBe(0);
  await editor.getByRole('textbox', { name: 'Link da rede social' }).fill(instagram.url);
  await editor.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(editor.locator('li')).toHaveCount(1);
  if (info.project.name === 'chromium-desktop') {
    await page
      .locator('.preview-panel')
      .getByRole('button', { name: 'Ver o Cardápio', exact: true })
      .click();
    await expect(page.locator('.preview-panel app-social-menu button.trigger')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Salvar e Sincronizar', exact: true }).click();
  await expect.poll(() => data.business().social_links).toEqual([instagram]);
  await expect(page.getByText('Dados da empresa sincronizados e salvos com sucesso!', { exact: true })).toBeVisible();
  await company(page);
  await expect(editor.locator('li')).toHaveCount(1);
  await editor.getByRole('button', { name: 'Escolher', exact: true }).click();
  await expect(
    editor.locator('.choices').getByRole('button', { name: /Instagram/ }),
  ).toBeDisabled();
  await editor.getByRole('button', { name: 'Outras', exact: true }).click();
  await editor
    .getByRole('textbox', { name: 'Link da rede social' })
    .fill('https://pingochef.com.br/');
  await editor.getByRole('textbox', { name: 'Nome do link' }).fill('Nosso site');
  await editor.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(editor.locator('li')).toHaveCount(2);
  await page.screenshot({ path: info.outputPath('social-editor.png'), fullPage: true });
  expect(await editor.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  );
  await editor.getByRole('button', { name: 'Remover Instagram', exact: true }).click();
  await editor.getByRole('button', { name: 'Remover Nosso site', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar e Sincronizar', exact: true }).click();
  await expect.poll(() => data.business().social_links).toEqual([]);
  await expect(page.getByText('Dados da empresa sincronizados e salvos com sucesso!', { exact: true })).toBeVisible();
  await publicMenu(page);
  await expect(page.locator('app-social-menu')).toHaveCount(0);
});

test('social menu fits all templates at 320px and keeps public controls working', async ({
  page,
}, info) => {
  const data = await fixture(page);
  data.links([instagram, whatsapp, { platform: 'other', url: 'javascript:alert(1)' }]);
  await page.setViewportSize({ width: 320, height: 740 });
  for (const template of [
    'default',
    'centered-cover',
    'arched-cover',
    'brand-hero',
    'signature-cover',
    'pixel',
  ]) {
    data.template(template);
    await publicMenu(page);
    const trigger = page.locator('app-social-menu .trigger');
    await trigger.click();
    const nav = page.getByRole('navigation', { name: 'Redes sociais e canais de pedido' });
    await expect(nav.getByRole('link')).toHaveCount(2);
    await expect(nav.getByRole('link').first()).toHaveAttribute('href', instagram.url);
    await expect(nav.getByRole('link').first()).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(nav.getByRole('link').first()).toHaveAttribute('target', '_blank');
    await expect(nav).toHaveCSS('font-family', /Lora/);
    const bounds = await nav.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    const buttons = await page.locator('.floating-controls-capsule').boundingBox();
    const left = await trigger.boundingBox();
    expect(left!.x + left!.width).toBeLessThan(buttons!.x);
    for (const img of await nav.locator('img').all()) {
      await expect(img).toHaveJSProperty('complete', true);
      expect(await img.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(
        0,
      );
    }
    if (template === 'pixel') {
      await expect(nav).toHaveCSS('border-top-style', 'solid');
      await expect(trigger).toHaveCSS('border-top-width', '2px');
      await page.screenshot({ path: info.outputPath('pixel-social-menu.png') });
    }
    await nav.getByRole('link').first().focus();
    await page.keyboard.press('Escape');
    await expect(nav).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.locator('.menu-viewport').click({ position: { x: 310, y: 700 } });
    await expect(nav).toHaveCount(0);
    await page.locator('.cart-capsule-btn').click();
    await expect(page.locator('.cart-drawer-sheet')).toBeVisible();
    await page.locator('.drawer-close-btn').click();
  }
});
