import { expect, test } from '@playwright/test';

test.setTimeout(90_000);

for (const templateKey of ['sweet-boutique']) {
  test(`${templateKey}: responsive composition, branding and shared interactions`, async ({ page }, info) => {
    let enabled = true;
    let dark = false;
    let businessName = 'Ateliê da Vila';
    let social = false;
    const description = '  Receitas da casa.\n\n    Feitas na hora.  ';
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
    await page.route('**/api/v1/public/menu/sweet-test', route => route.fulfill({ json: { success: true, data: {
      business: { name: businessName, slug: 'sweet-test', description: 'Sabores preparados na hora', logoUrl: '/logo_img.webp', welcomeBgType: 'color', socialLinks: social ? [{ platform: 'instagram', url: 'https://instagram.com/pingochef/' }] : [] },
      design: { templateKey, fontHeading: 'Oswald', fontBody: 'Inter',
        palette: { key: 'custom', colors: { primary: '#9E3655', secondary: '#DBADA4', accent: '#B64D64',
          background: dark ? '#172020' : '#FFF8F1', surface: dark ? '#253030' : '#FFFCF8',
          textPrimary: dark ? '#FFF8F1' : '#4B242A', textSecondary: dark ? '#C2CFCA' : '#8B7479' } },
        heroBanners: ['/assets/mascots/home/pingo-chef-animation-menu.webp', '/logo_img.webp'],
        homeBlocks: [{ id: 'hero', type: 'hero', position: 0, enabled }, { id: 'categories', type: 'categories', position: 1, enabled: true },
          { id: 'offers', type: 'promotion', position: 2, enabled: true }, { id: 'ranking', type: 'most_liked', position: 3, enabled: true }],
        customConfig: { enable_cart: enabled, enable_likes: enabled, home_icons: { home: null }, intro_card: { enabled: true, description } } },
      categories: [{ id: 'burgers', name: 'Doces da Casa', iconType: 'none' },
        { id: 'drinks', name: 'Bebidas e acompanhamentos', iconType: 'none' }],
      subcategories: [{ id: 'classics', categoryId: 'burgers', name: 'Artesanais' }],
      items: ['Cupcake da Casa', 'Macaron artesanal de framboesa e chocolate branco', 'Brigadeiro de Chocolate', 'Torta de Morango'].map((name, index) => ({
        id: `item-${index}`, categoryId: 'burgers', subcategoryId: 'classics', name,
        description: 'Receita artesanal preparada com ingredientes selecionados e finalizada com carinho.', price: 34.9, promotionalPrice: index > 1 ? null : 29.9,
        isHighlighted: index < 2, highlightType: index > 1 ? 'none' : 'promotion', isAvailable: true, likesCount: 54,
        imageUrl: index === 2 ? null : '/logo_img.webp', media: index ? [] : [{ id: 'video', mediaType: 'video', source: 'mux', position: 0, durationSeconds: 10, aspectRatio: '16:9' }]
      }))
    } } }));
    await page.route('**/api/v1/public/menu/sweet-test/**', route => route.fulfill({ status: 202, json: { success: true } }));
    let playbackRequests = 0;
    await page.route('**/api/v1/public/menus/**/playback', route => { playbackRequests++; return route.fulfill({ status: 503 }); });
    const open = async () => {
      await page.goto('/m/sweet-test');
      await page.getByRole('button', { name: 'Ver o Cardápio', exact: true }).click();
      await expect(page.locator('.menu-viewport')).toHaveAttribute('data-template', templateKey);
    };
    await open();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const hero = await page.locator('.showcase-hero-banner').evaluate(element => {
        const box = element.getBoundingClientRect();
        const viewport = element.closest('.menu-viewport')!.getBoundingClientRect();
        const track = element.querySelector('.hero-carousel-track')!.getBoundingClientRect();
        const brand = element.querySelector('.template-brand-header')!.getBoundingClientRect();
        const controls = element.querySelector('.floating-controls-capsule')!.getBoundingClientRect();
        const dots = element.querySelector('.carousel-dots-wrap')!.getBoundingClientRect();
        return { edge: Math.max(Math.abs(box.top - viewport.top), Math.abs(box.left - viewport.left), Math.abs(box.right - viewport.right)),
          height: box.height, fill: Math.abs(track.height - box.height),
          center: Math.abs(brand.x + brand.width / 2 - box.x - box.width / 2), bottomGap: box.bottom - brand.bottom,
          inside: brand.top >= controls.bottom && brand.bottom <= box.bottom && controls.right <= box.right && dots.bottom <= brand.top };
      });
      expect(hero.edge).toBeLessThan(1); expect(hero.height).toBeGreaterThanOrEqual(400);
      expect(hero.center).toBeLessThan(1); expect(hero.bottomGap).toBeCloseTo(16, 0);
      expect(hero.fill).toBeLessThan(1); expect(hero.inside).toBe(true);
    }
    await page.setViewportSize(info.project.use.viewport!);
    await expect(page.locator('.showcase-hero-banner')).toHaveCSS('border-radius', '0px');
    expect(await page.locator('.intro-card-desc').textContent()).toBe(description);
    await expect(page.locator('.template-brand-copy h2')).toHaveCSS('font-family', /Oswald/);
    await expect(page.locator('.category-nav-pill').first()).toHaveCSS('font-family', /Inter/);
    await expect(page.locator('.promo-item-card')).toHaveCount(2);
    await expect(page.locator('.promo-items-scroll')).toHaveCSS('grid-template-columns', /\d+px \d+px/);
    await page.screenshot({ path: info.outputPath(`${templateKey}-home.png`) });
    await page.getByRole('button', { name: 'Banner 2', exact: true }).click();
    await expect(page.locator('.hero-carousel-slide.active img')).toHaveAttribute('src', /logo_img/);
    await page.getByRole('button', { name: 'Doces da Casa', exact: true }).click();
    await expect(page.locator('.product-item-card')).toHaveCount(4);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const geometry = await page.locator('.items-grid').evaluate(element => {
        const cards = [...element.querySelectorAll('.product-item-card')];
        const bounds = cards.map(card => card.getBoundingClientRect());
        return { columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
          equalRowHeight: Math.abs(bounds[0].height - bounds[1].height) < 1, valid: cards.every((card, index) => {
            const button = card.querySelector('.btn-view-item')!.getBoundingClientRect();
            return card.scrollWidth <= card.clientWidth + 1 && button.right <= bounds[index].right + 1 && button.bottom <= bounds[index].bottom + 1;
          }), overflow: element.closest('.showcase-scrollable')!.scrollWidth - element.closest('.showcase-scrollable')!.clientWidth };
      });
      expect(geometry.columns).toBe(2);
      expect(geometry.equalRowHeight).toBe(true);
      expect(geometry.valid).toBe(true); expect(geometry.overflow).toBeLessThanOrEqual(1);

    }
    await page.setViewportSize(info.project.use.viewport!);
    const group = page.locator('.subcategory-header-collapsible');
    await group.click(); await expect(group).toHaveAttribute('aria-expanded', 'false'); await group.click();
    await page.screenshot({ path: info.outputPath(`${templateKey}-catalog.png`) });
    await page.getByRole('button', { name: 'Ver detalhes de Cupcake da Casa', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: /Reproduzir vídeo de/ })).toBeVisible();
    expect(playbackRequests).toBe(0);
    await page.getByRole('tab', { name: 'Foto 2', exact: true }).click();
    await expect(page.locator('.media-image')).toBeVisible();
    await page.screenshot({ path: info.outputPath(`${templateKey}-detail.png`) });
    await page.locator('.btn-sheet-add-cart').click();
    await page.locator('.cart-capsule-btn').click();
    await expect(page.locator('.cart-drawer-sheet')).toContainText('Cupcake da Casa');
    await page.locator('.drawer-close-btn').click();
    await page.getByRole('button', { name: 'Buscar prato ou bebida', exact: true }).click();
    await page.getByRole('textbox', { name: 'Buscar produtos', exact: true }).fill('Cupcake');
    await expect(page.locator('.product-item-card')).toHaveCount(1);
    dark = true; await open();
    await page.getByRole('button', { name: 'Doces da Casa', exact: true }).click();
    await expect(page.locator('.card-item-title').first()).toHaveCSS('color', 'rgb(255, 248, 241)');
    await page.screenshot({ path: info.outputPath(`${templateKey}-dark.png`) });
    social = true; businessName = 'Ateliê de Doces Artesanais da Vila e Confeitaria';
    await page.setViewportSize({ width: 320, height: 844 }); await open();
    expect(await page.locator('.template-brand-header').evaluate(element => {
      const logo = element.querySelector('.template-logo-wrap')!.getBoundingClientRect();
      const name = element.querySelector('.template-brand-copy')!.getBoundingClientRect();
      const menu = document.querySelector('app-social-menu button')!.getBoundingClientRect();
      return logo.right <= name.left && menu.bottom <= logo.top && element.scrollWidth <= element.clientWidth + 1;
    })).toBe(true);
    enabled = false; await open();
    await expect(page.locator('.showcase-hero-banner, .template-brand-header, .cart-capsule-btn')).toHaveCount(0);
    await expect(page.locator('.no-hero-header')).toBeVisible();
    expect(await page.locator('.intro-card-desc').textContent()).toBe(description);
  });
}
