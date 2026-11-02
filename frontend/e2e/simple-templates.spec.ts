import { expect, test } from '@playwright/test';

for (const templateKey of ['editorial-menu', 'product-gallery', 'compact-menu']) {
  test(`${templateKey}: responsive composition, branding and shared interactions`, async ({ page }, info) => {
    let enabled = true;
    let dark = false;
    const description = '  Receitas da casa.\n\n    Feitas na hora.  ';
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
    await page.route('**/api/v1/public/menu/simple-test', route => route.fulfill({ json: { success: true, data: {
      business: { name: 'Cozinha da Vila', slug: 'simple-test', description: 'Sabores preparados na hora', logoUrl: '/logo_img.webp', welcomeBgType: 'color' },
      design: { templateKey, fontHeading: 'Oswald', fontBody: 'Inter',
        palette: { key: 'custom', colors: { primary: '#315950', secondary: '#C5AE89', accent: '#B84420',
          background: dark ? '#172020' : '#F5F3EE', surface: dark ? '#253030' : '#FFFFFF',
          textPrimary: dark ? '#F5F3EE' : '#263632', textSecondary: dark ? '#C2CFCA' : '#66736D' } },
        heroBanners: ['/assets/mascots/home/pingo-chef-animation-menu.webp', '/logo_img.webp'],
        homeBlocks: [{ id: 'hero', type: 'hero', position: 0, enabled }, { id: 'categories', type: 'categories', position: 1, enabled: true },
          { id: 'offers', type: 'promotion', position: 2, enabled: true }, { id: 'ranking', type: 'most_liked', position: 3, enabled: true }],
        customConfig: { enable_cart: enabled, enable_likes: enabled, home_icons: { home: null }, intro_card: { enabled: true, description } } },
      categories: [{ id: 'burgers', name: 'Hambúrgueres Artesanais', iconType: 'none' },
        { id: 'drinks', name: 'Bebidas e acompanhamentos', iconType: 'none' }],
      subcategories: [{ id: 'classics', categoryId: 'burgers', name: 'Clássicos da casa' }],
      items: ['Bacon Supreme Burger', 'Hambúrguer artesanal com cheddar e cebola caramelizada', 'Vegetariano da Vila'].map((name, index) => ({
        id: `item-${index}`, categoryId: 'burgers', subcategoryId: 'classics', name,
        description: 'Pão brioche tostado, queijo, alface e molho especial da casa.', price: 34.9, promotionalPrice: index ? null : 29.9,
        isHighlighted: !index, highlightType: index ? 'none' : 'promotion', isAvailable: true, likesCount: 54,
        imageUrl: index === 2 ? null : '/logo_img.webp', media: index ? [] : [{ id: 'video', mediaType: 'video', source: 'mux', position: 0, durationSeconds: 10, aspectRatio: '16:9' }]
      }))
    } } }));
    await page.route('**/api/v1/public/menu/simple-test/**', route => route.fulfill({ status: 202, json: { success: true } }));
    let playbackRequests = 0;
    await page.route('**/api/v1/public/menus/**/playback', route => { playbackRequests++; return route.fulfill({ status: 503 }); });
    const open = async () => {
      await page.goto('/m/simple-test');
      await page.getByRole('button', { name: 'Ver o Cardápio', exact: true }).click();
      await expect(page.locator('.menu-viewport')).toHaveAttribute('data-template', templateKey);
    };
    await open();
    expect(await page.locator('.intro-card-desc').textContent()).toBe(description);
    await expect(page.locator('.template-brand-copy h2')).toHaveCSS('font-family', /Oswald/);
    await expect(page.locator('.category-nav-pill').first()).toHaveCSS('font-family', /Inter/);
    await page.screenshot({ path: info.outputPath(`${templateKey}-home.png`) });
    await page.getByRole('button', { name: 'Banner 2', exact: true }).click();
    await expect(page.locator('.hero-carousel-slide.active img')).toHaveAttribute('src', /logo_img/);
    await page.getByRole('button', { name: 'Hambúrgueres Artesanais', exact: true }).click();
    await expect(page.locator('.product-item-card')).toHaveCount(3);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const geometry = await page.locator('.items-grid').evaluate(element => {
        const cards = [...element.querySelectorAll('.product-item-card')];
        const bounds = cards.map(card => card.getBoundingClientRect());
        return { columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
          photoRight: cards[0].querySelector('.product-card-photo')!.getBoundingClientRect().left > cards[0].querySelector('.product-card-body')!.getBoundingClientRect().left,
          height: bounds[0].height, valid: cards.every((card, index) => {
            const button = card.querySelector('.btn-view-item')!.getBoundingClientRect();
            return card.scrollWidth <= card.clientWidth + 1 && button.right <= bounds[index].right + 1 && button.bottom <= bounds[index].bottom + 1;
          }), overflow: element.closest('.showcase-scrollable')!.scrollWidth - element.closest('.showcase-scrollable')!.clientWidth };
      });
      expect(geometry.columns).toBe(templateKey === 'product-gallery' ? 2 : 1);
      expect(geometry.valid).toBe(true); expect(geometry.overflow).toBeLessThanOrEqual(1);
      if (templateKey === 'editorial-menu') expect(geometry.photoRight).toBe(true);
      if (templateKey === 'compact-menu') expect(geometry.height).toBeLessThan(120);
    }
    await page.setViewportSize(info.project.use.viewport!);
    const group = page.locator('.subcategory-header-collapsible');
    await group.click(); await expect(group).toHaveAttribute('aria-expanded', 'false'); await group.click();
    await page.screenshot({ path: info.outputPath(`${templateKey}-catalog.png`) });
    await page.getByRole('button', { name: 'Ver detalhes de Bacon Supreme Burger', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: /Reproduzir vídeo de/ })).toBeVisible();
    expect(playbackRequests).toBe(0);
    await page.getByRole('tab', { name: 'Foto 2', exact: true }).click();
    await expect(page.locator('.media-image')).toBeVisible();
    await page.locator('.btn-sheet-add-cart').click();
    await page.locator('.cart-capsule-btn').click();
    await expect(page.locator('.cart-drawer-sheet')).toContainText('Bacon Supreme Burger');
    await page.locator('.drawer-close-btn').click();
    await page.getByRole('button', { name: 'Buscar prato ou bebida', exact: true }).click();
    await page.getByRole('textbox', { name: 'Buscar produtos', exact: true }).fill('Bacon');
    await expect(page.locator('.product-item-card')).toHaveCount(1);
    dark = true; await open();
    await page.getByRole('button', { name: 'Hambúrgueres Artesanais', exact: true }).click();
    await expect(page.locator('.card-item-title').first()).toHaveCSS('color', 'rgb(245, 243, 238)');
    await page.screenshot({ path: info.outputPath(`${templateKey}-dark.png`) });
    enabled = false; await open();
    await expect(page.locator('.showcase-hero-banner, .template-brand-header, .cart-capsule-btn')).toHaveCount(0);
    await expect(page.locator('.no-hero-header')).toBeVisible();
    expect(await page.locator('.intro-card-desc').textContent()).toBe(description);
  });
}
