import { expect, Page, test } from '@playwright/test';
test.setTimeout(120_000);
test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }),
  );
});
function fixture(template = 'default', slug = 'optimization', empty = false) {
  return {
    success: true,
    data: {
      business: {
        name: 'Bistrô Aurora',
        slug,
        description: 'Ingredientes frescos e receitas da casa.',
        logoUrl: '/logo_img.webp',
        welcomeBgType: 'color',
        welcomeBgColor: '#2d1822',
      },
      design: {
        templateKey: template,
        fontHeading: 'Outfit',
        fontBody: 'Inter',
        heroBanners: [],
        palette: {
          colors: {
            primary: '#672138',
            secondary: '#a64e20',
            accent: '#a64e20',
            background: '#fff9f4',
            surface: '#ffffff',
            textPrimary: '#2d1822',
            textSecondary: '#6e5d65',
          },
        },
        homeBlocks: [
          'categories',
          'promotion',
          'most_liked',
          'featured_product',
          'combo',
          'best_seller',
        ].map((type, position) => ({ id: type, type, enabled: true, position })),
        customConfig: { enable_likes: true, enable_cart: false, intro_card: { enabled: false } },
      },
      categories: empty
        ? []
        : [
            { id: 'cat-a', name: 'Pratos', isActive: true, displayOrder: 0, iconType: 'none' },
            { id: 'cat-b', name: 'Bebidas', isActive: true, displayOrder: 1, iconType: 'none' },
          ],
      subcategories: [],
      items: empty
        ? []
        : Array.from({ length: 8 }, (_, i) => ({
            id: `item-${i}`,
            categoryId: i === 7 ? 'cat-b' : 'cat-a',
            name: i === 0 ? 'Açaí da casa' : `Prato ${i}`,
            description: 'Frutas e ingredientes frescos.',
            price: 29.9,
            promotionalPrice: i === 0 ? 24.9 : null,
            isAvailable: true,
            isHighlighted: true,
            highlightType: ['promotion', 'chef', 'combo', 'best_seller', 'most_liked'][i % 5],
            displayOrder: i,
            likesCount: 3,
            imageUrl: i === 1 ? '/missing-product-image.webp' : '/logo_img.webp',
            media:
              i === 0
                ? [
                    {
                      id: 'media-1',
                      mediaType: 'video',
                      source: 'mux',
                      position: 0,
                      durationSeconds: 10,
                      aspectRatio: '16:9',
                    },
                  ]
                : [],
          })),
    },
  };
}
async function mock(
  page: Page,
  options: {
    template?: string;
    empty?: boolean;
    delay?: number;
    deny?: boolean;
    rejectLike?: boolean;
    likeDelay?: number;
  } = {},
) {
  const requests: { path: string; method: string; body: any }[] = [];
  await page.route('**/api/v1/public/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    requests.push({
      path,
      method: req.method(),
      body: req.method() === 'POST' ? req.postDataJSON() : null,
    });
    if (path.endsWith('/events') || path.endsWith('/vitals'))
      return route.fulfill({ status: 202, json: { success: true } });
    if (path.endsWith('/playback'))
      return route.fulfill({
        json: {
          success: true,
          data: {
            playbackId: 'signed-test',
            playbackToken: 'short-lived-test',
            expiresAt: new Date(Date.now() + 120000).toISOString(),
            videoTitle: 'Açaí da casa',
          },
        },
      });
    if (path.includes('/like/')) {
      if (options.likeDelay) await new Promise((resolve) => setTimeout(resolve, options.likeDelay));
      return options.rejectLike
        ? route.fulfill({ status: 429, json: { success: false } })
        : route.fulfill({
            json: {
              success: true,
              data: { itemId: path.split('/').pop(), likesCount: 9, created: true },
            },
          });
    }
    if (options.delay) await new Promise((resolve) => setTimeout(resolve, options.delay));
    if (options.deny) return route.fulfill({ status: 404, json: { success: false } });
    const slug = path.split('/menu/')[1];
    return route.fulfill({ json: fixture(options.template, slug, options.empty) });
  });
  return requests;
}
async function enter(page: Page) {
  await page.goto('/m/optimization', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Ver o Cardápio' }).click();
}

for (const template of ['default']) {
  test(`${template}: responsive storefront, local discovery, keyboard detail and original template identity`, async ({
    page,
  }, info) => {
    const requests = await mock(page, { template });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const [width, height] of [
      [360, 800],
      [390, 844],
      [430, 932],
      [768, 1024],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await enter(page);
      await expect(page.locator('.menu-viewport')).toHaveAttribute('data-template', template);
      await expect(page.locator('.promo-item-card').filter({hasText:'Prato 5'})).toContainText('R$ 29.90');
      await page.screenshot({
        path: `../.tools/public-menu-performance/${template}-${width}-home-${info.project.name}.png`,
      });
      await page.getByRole('button', { name: 'Pratos', exact: true }).click();
      await expect(page.locator('.product-item-card')).toHaveCount(7);
      await expect(page.getByRole('button', { name: 'Pratos', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      const failed = page
        .locator('.product-item-card')
        .filter({ hasText: 'Prato 1' })
        .locator('img');
      await expect(failed).toHaveAttribute('src', '/assets/menu/image-placeholder.svg');
      await page.screenshot({
        path: `../.tools/public-menu-performance/${template}-${width}-catalog-${info.project.name}.png`,
      });
      const before = requests.filter((row) => row.method === 'GET').length;
      await page.getByRole('button', { name: 'Buscar prato ou bebida', exact: true }).click();
      await page.getByRole('textbox', { name: 'Buscar produtos' }).fill('ACAI');
      await expect(page.locator('.product-item-card')).toHaveCount(1);
      await page
        .locator('.product-item-card')
        .getByRole('button', { name: /^Ver detalhes de / })
        .click();
      const dialog = page.getByRole('dialog', { name: 'Açaí da casa', exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Fechar detalhes' })).toBeFocused();
      const bounds = await dialog.boundingBox();
      expect(bounds!.width).toBeLessThanOrEqual(Math.min(width, 480));
      expect(bounds!.y).toBeGreaterThanOrEqual(-1);
      expect(bounds!.height).toBeLessThanOrEqual(height);
      await page.screenshot({
        path: `../.tools/public-menu-performance/${template}-${width}-detail-${info.project.name}.png`,
      });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await page.getByRole('button',{name:'Limpar busca'}).click();
      await expect(page.locator('.product-item-card')).toHaveCount(7);
      expect(requests.filter((row) => row.method === 'GET')).toHaveLength(before);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      expect(
        await page.locator('.menu-viewport').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: `../.tools/public-menu-performance/${template}-${width}-${info.project.name}.png`,
        });
    }
    expect(errors).toEqual([]);
    expect(requests.filter((row) => row.path.endsWith('/playback'))).toHaveLength(0);
  });
}

test('secondary modules resolve near the viewport and retain usable product actions', async ({
  page,
}) => {
  await mock(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  for (const [heading, grid] of [
    ['Pratos do Chef & Especialidades', '.featured-chef-grid'],
    ['Combos Especiais', '.combos-scroll-track'],
    ['Mais Vendidos', '.best-sellers-grid'],
  ]) {
    await page.getByRole('heading', { name: heading, exact: true }).scrollIntoViewIfNeeded();
    await expect(page.locator(`${grid}.module-skeleton`)).toHaveCount(0);
    await expect(page.locator(grid).locator('img').first()).toBeVisible();
    await page
      .locator(grid)
      .getByRole('button', { name: /Ver detalhes de/ })
      .first()
      .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
  }
});

test('slow initial data has a local compatible skeleton, no competing mascot download, and a friendly retry', async ({
  page,
}) => {
  const frames: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/mascots/loading/')) frames.push(req.url());
  });
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'pc-menu-layout:optimization',
      JSON.stringify({
        templateKey: 'default',
        background: '#fff9f4',
        surface: '#fff',
        primary: '#672138',
      }),
    ),
  );
  await mock(page, { delay: 700, deny: true });
  await page.goto('/m/optimization', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.public-app-container')).toBeVisible();
  await expect(page.locator('.menu-skeleton')).toHaveAttribute('data-template', 'default');
  await expect(page.locator('.menu-skeleton')).toHaveClass(/is-visible/);
  await expect(
    page.getByRole('heading', { name: 'Não conseguimos abrir este cardápio.' }),
  ).toBeVisible();
  await expect(page.locator('app-public-menu-view')).toHaveCount(0);
  expect(frames).toEqual([]);
  await page.unroute('**/api/v1/public/**');
  await mock(page);
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('button', { name: 'Ver o Cardápio' })).toBeVisible();
});

test('likes update immediately, roll back on rejection and reconcile without blocking navigation', async ({
  page,
}) => {
  await mock(page, { rejectLike: true, likeDelay: 700 });
  await enter(page);
  await page.getByRole('button', { name: 'Pratos', exact: true }).click();
  const card = page.locator('.product-item-card').filter({ hasText: 'Açaí da casa' });
  const like = card.getByRole('button', { name: 'Curtir item', exact: true });
  await like.click();
  await expect(card.locator('.like-counter-val')).toHaveText('4');
  await expect(card.getByRole('button', { name: 'Item já curtido', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(card.getByRole('button', { name: 'Curtir item', exact: true })).toBeEnabled();
  await expect(card.locator('.like-counter-val')).toHaveText('3');
  await expect(page.getByRole('status')).toContainText('Não foi possível registrar sua curtida');
  await page.unroute('**/api/v1/public/**');
  await mock(page, { likeDelay: 400 });
  await card.getByRole('button', { name: 'Curtir item', exact: true }).click();
  await expect(card.locator('.like-counter-val')).toHaveText('9');
});

test('video downloads nothing before explicit Play, authorizes signed playback and closes back to the detail', async ({
  page,
}) => {
  const requests = await mock(page);
  let muxRequests = 0;
  await page.route(/https:\/\/[^/]*mux\.com\/.*/, () => {
    muxRequests++;
  });
  await enter(page);
  await page.getByRole('button', { name: 'Pratos', exact: true }).click();
  await page
    .locator('.product-item-card')
    .filter({ hasText: 'Açaí da casa' })
    .getByRole('button', { name: /^Ver detalhes de / })
    .click();
  await expect(page.locator('mux-player')).toHaveCount(0);
  expect(muxRequests).toBe(0);
  expect(requests.filter((row) => row.path.endsWith('/playback'))).toHaveLength(0);
  await page.getByRole('button', { name: 'Reproduzir vídeo de Açaí da casa' }).click();
  await expect(page.locator('mux-player')).toHaveAttribute('preload', 'none');
  await expect(page.locator('mux-player')).toHaveAttribute('playback-token', 'short-lived-test');
  expect(requests.filter((row) => row.path.endsWith('/playback'))).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Fechar vídeo' })).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('mux-player')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Açaí da casa', exact: true })).toBeVisible();
});

test('reduced motion, selected fonts, offline discovery and empty modules remain usable', async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const requests = await mock(page);
  await enter(page);
  expect(
    await page.locator('.menu-main-shell').evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
  const families = await page.locator('#pc-menu-fonts').getAttribute('href');
  expect(families).toContain('Outfit');
  expect(families).toContain('Inter');
  expect(families).not.toContain('Cinzel');
  await expect(page.locator('#pc-platform-fonts')).toHaveCount(0);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Pratos', exact: true }).click();
  await expect(page.locator('.product-item-card')).toHaveCount(7);
  expect(requests.filter((row) => row.method === 'GET')).toHaveLength(1);
  await context.setOffline(false);
  await page.unroute('**/api/v1/public/**');
  await mock(page, { empty: true });
  await enter(page);
  await expect(page.getByRole('heading', { name: 'Cardápio em preparação' })).toBeVisible();
  await expect(
    page.locator(
      '.promo-block,.liked-block,.featured-chef-block,.combos-block,.best-sellers-block',
    ),
  ).toHaveCount(0);
});
