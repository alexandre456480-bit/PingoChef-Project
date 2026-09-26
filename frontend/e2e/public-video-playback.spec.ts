import { expect, test } from '@playwright/test';

const menuResponse = {
  success: true,
  data: {
    business: {
      name: 'Pingo Teste',
      slug: 'pingo-teste',
      description: 'Cardápio de teste',
      logoUrl: '/logo_img.webp',
      coverImageUrl: '/logo_img.webp',
      welcomeBgType: 'color',
      welcomeBgColor: '#2D1822'
    },
    design: {
      templateKey: 'modern',
      palette: {
        key: 'gourmet_royal',
        name: 'Gourmet Royal',
        colors: {
          primary: '#8B1A3A', secondary: '#D26E2D', accent: '#F47B20',
          background: '#FAF5F0', surface: '#FFFFFF', textPrimary: '#2D1822', textSecondary: '#6E5D65'
        }
      },
      fontHeading: 'Outfit',
      fontBody: 'Inter',
      fontPair: 'modern_clean',
      categoryStyle: 'icon_name',
      motion: 'fade',
      homeBlocks: [{ id: 'best', type: 'best_seller', label: 'Mais vendidos', enabled: true, position: 0 }],
      heroBanners: [],
      customConfig: { enable_likes: false, enable_cart: false }
    },
    categories: [{
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Pratos', displayOrder: 0, isActive: true
    }],
    subcategories: [],
    items: [{
      id: '22222222-2222-4222-8222-222222222222',
      categoryId: '11111111-1111-4111-8111-111111111111',
      name: 'Produto com vídeo',
      description: 'Produto usado no E2E',
      price: 29.9,
      promotionalPrice: null,
      imageUrl: '/logo_img.webp',
      isAvailable: true,
      isHighlighted: true,
      highlightType: 'best_seller',
      showPrice: true,
      likesCount: 0,
      displayOrder: 0,
      media: [{
        id: '33333333-3333-4333-8333-333333333333',
        mediaType: 'video', source: 'mux', position: 0, durationSeconds: 10, aspectRatio: '16:9'
      }]
    }]
  }
};

test('does not authorize or mount Mux before explicit Play', async ({ page }) => {
  let playbackRequests = 0;
  let muxNetworkRequests = 0;
  const browserIssues: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') browserIssues.push(message.text());
  });
  page.on('pageerror', error => browserIssues.push(error.message));
  page.on('requestfailed', request => browserIssues.push(`${request.url()}: ${request.failure()?.errorText}`));

  await page.route('**/api/v1/public/menu/pingo-teste', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4300' },
    body: JSON.stringify(menuResponse)
  }));
  await page.route('**/api/v1/public/menus/**/playback', route => {
    playbackRequests += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4300' },
      body: JSON.stringify({
        success: true,
        data: {
          playbackId: 'signed-playback-test',
          playbackToken: 'short-lived-test-token',
          expiresAt: new Date(Date.now() + 120_000).toISOString(),
          videoTitle: 'Produto com vídeo'
        }
      })
    });
  });
  await page.route(/https:\/\/[^/]*mux\.com\/.*/, route => {
    muxNetworkRequests += 1;
    return route.abort();
  });

  await page.goto('/m/pingo-teste');
  const enterButton = page.getByRole('button', { name: /ver o cardápio/i });
  await expect(enterButton).toBeVisible({ timeout: 8_000 }).catch(error => {
    throw new Error(`${browserIssues.join('\n')}\n${error.message}`);
  });
  await enterButton.click();
  await page.locator('.best-seller-card').click();
  await expect(page.locator('.product-modal-sheet')).toBeVisible();

  expect(playbackRequests).toBe(0);
  expect(muxNetworkRequests).toBe(0);
  await expect(page.locator('mux-player')).toHaveCount(0);

  await page.getByRole('tab', { name: /vídeo 2/i }).click();
  await page.getByRole('button', { name: /reproduzir vídeo/i }).click();
  await expect.poll(() => playbackRequests).toBe(1);
  await expect(page.locator('mux-player')).toHaveAttribute('preload', 'none');
});
