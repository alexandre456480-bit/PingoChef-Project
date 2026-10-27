import { expect, test, Locator } from '@playwright/test';

test.setTimeout(45_000);

async function geometry(root: Locator) {
  return root.evaluate(element => {
    const size = (selector: string) => {
      const node = element.querySelector(selector) as HTMLElement;
      return { width: node.offsetWidth, height: node.offsetHeight, font: getComputedStyle(node).fontSize };
    };
    return {
      viewport: { width: (element as HTMLElement).offsetWidth, height: (element as HTMLElement).offsetHeight },
      hero: size('.showcase-hero-banner'), logo: size('.template-logo-wrap'),
      heading: size('.template-brand-copy h2'), category: size('.category-nav-pill')
    };
  });
}

for (const template of ['default', 'centered-cover', 'arched-cover', 'brand-hero', 'signature-cover']) {
  test(`${template}: preview matches a 390x740 public mobile viewport`, async ({ page, context }, info) => {
    const business = { id: 'business', name: 'Cozinha da Casa', slug: 'parity', description: 'Receitas artesanais.', logo_url: '/logo_img.webp', welcome_bg_type: 'color' };
    const palette = { key: 'custom', name: 'Casa', isCustom: true, colors: { primary: '#173E34', secondary: '#849D90', accent: '#BA591B', background: '#F4F8F3', surface: '#FFFFFF', textPrimary: '#183027', textSecondary: '#586A61' } };
    const homeBlocks = ['hero', 'categories'].map((type, position) => ({ id: type, type, label: type, enabled: true, position }));
    const customConfig = { enable_likes: false, enable_cart: true, hero_banners: ['/logo_img.webp'], intro_card: { enabled: true, title: 'Bem-vindo', description: 'Primeiro parágrafo.\n\nSegundo parágrafo.' } };
    const categories = [{ id: 'food', name: 'Pratos', iconType: 'none', isActive: true, displayOrder: 0 }];
    const items = [{ id: 'plate', categoryId: 'food', name: 'Prato artesanal da casa', price: 32.9, description: 'Ingredientes frescos e molho artesanal preparados na hora.', imageUrl: '/logo_img.webp', isAvailable: true }];
    await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.fulfill({ contentType: 'text/css', body: '' }));
    await context.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1/', '');
      let data: unknown = [];
      if (path === 'auth/me') data = { user: { id: 'owner', email: 'owner@example.test' }, business, accountActive: true, plan: { code: 'PRO' }, entitlements: {}, usage: { products: 1, categories: 1, videos: 0 }, csrfToken: 'a'.repeat(64), onboarding: { designConfigured: true } };
      if (path === 'design') data = { template_key: template, palette, home_blocks: homeBlocks, custom_config: customConfig, font_heading: 'Oswald', font_body: 'Lora', category_style: 'name' };
      if (path === 'categories') data = categories;
      if (path === 'items') data = items;
      if (path === 'public/menu/parity') data = {
        business: { ...business, logoUrl: business.logo_url, welcomeBgType: 'color' },
        design: { templateKey: template, palette, homeBlocks, customConfig, heroBanners: customConfig.hero_banners, fontHeading: 'Oswald', fontBody: 'Lora', categoryStyle: 'name' },
        categories, subcategories: [], items
      };
      return route.fulfill({ json: { success: true, data } });
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const mobile = info.project.name.includes('mobile');
    if (!mobile) await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dashboard');
    await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 15_000 });
    if (mobile) await page.getByRole('button', { name: 'Preview' }).click();
    const preview = page.locator(mobile ? '.modal-stage .menu-viewport' : '.preview-panel .menu-viewport');
    await preview.getByRole('button', { name: 'Ver o Cardápio' }).click();
    await expect(preview).toHaveAttribute('data-template', template);
    await expect(preview.locator('.hero-slide-image')).toHaveClass(/menu-image-ready/);
    const publicPage = await context.newPage();
    await publicPage.setViewportSize({ width: 390, height: 740 });
    await publicPage.emulateMedia({ reducedMotion: 'reduce' });
    await publicPage.goto('/m/parity');
    await publicPage.getByRole('button', { name: 'Ver o Cardápio' }).click();
    const publicView = publicPage.locator('.menu-viewport');
    await expect(publicView.locator('.hero-slide-image')).toHaveClass(/menu-image-ready/);
    expect(await geometry(preview)).toEqual(await geometry(publicView));
    const fitted = await preview.evaluate(element => {
      const frame = element.closest('.phone-frame')!.getBoundingClientRect();
      const container = element.closest('.preview-device-stage, .modal-stage')!;
      const stage = container.getBoundingClientRect();
      return frame.left >= stage.left && frame.right <= stage.right && frame.top >= stage.top && frame.bottom <= stage.top + container.scrollHeight;
    });
    expect(fitted).toBe(true);
    await preview.getByRole('button', { name: 'Pratos', exact: true }).click();
    await publicView.getByRole('button', { name: 'Pratos', exact: true }).click();
    const cardSize = (card: Locator) => card.evaluate(element => ({ width: (element as HTMLElement).offsetWidth, height: (element as HTMLElement).offsetHeight, photo: (element.querySelector('.product-card-photo') as HTMLElement).offsetWidth }));
    expect(await cardSize(preview.locator('.product-item-card'))).toEqual(await cardSize(publicView.locator('.product-item-card')));
    await preview.getByRole('button', { name: /^Ver detalhes de / }).click();
    await publicView.getByRole('button', { name: /^Ver detalhes de / }).click();
    const modalHeight = (view: Locator) => view.locator('.product-modal-sheet').evaluate(element => (element as HTMLElement).offsetHeight);
    expect(await modalHeight(preview)).toBe(await modalHeight(publicView));
    await page.screenshot({ path: info.outputPath(`${template}-preview.png`) });
    await publicPage.close();
  });
}
