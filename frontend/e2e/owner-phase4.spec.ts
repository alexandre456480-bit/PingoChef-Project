import { expect, test, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyticsOptions, analyticsReport, AnalyticsPlan } from './analytics-fixture';
const qrId = '44444444-4444-4444-8444-444444444444',
  publicId = '33333333-3333-4333-8333-333333333333';
const png = readFileSync(resolve('e2e/fixtures/qr-reference.png'));
const defaultConfig = {
  color: '#2C1024',
  frame: 'card',
  caption: 'Acesse nosso cardápio',
  logoPng: null,
};
async function mock(
  page: Page,
  plan: AnalyticsPlan,
  options: { conflict?: boolean; unavailable?: boolean; login?: boolean } = {},
) {
  const requests: { path: string; method: string; body: any; headers: Record<string, string> }[] =
    [];
  let row: any = null;
  let loggedIn = !options.login;
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace('/api/v1/', '');
    const body = ['POST', 'PUT', 'DELETE'].includes(req.method()) ? req.postDataJSON() : null;
    requests.push({ path, method: req.method(), body, headers: req.headers() });
    if (path === 'auth/me' && !loggedIn)
      return route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
    if (path === 'auth/login') loggedIn = true;
    if (path === 'auth/me' || path === 'auth/login')
      return route.fulfill({
        json: {
          success: true,
          data: {
            user: { id: 'owner', email: 'maria@example.test', name: 'Maria' },
            business: {
              id: '22222222-2222-4222-8222-222222222222',
              name: 'Bistrô PingoChef',
              slug: 'bistro',
            },
            accountActive: true,
            plan: { code: plan, name: plan },
            entitlements: {
              QR_GENERATOR: ['MEDIUM', 'PRO'].includes(plan),
              QR_CUSTOMIZATION: true,
              ANALYTICS_BASIC: plan !== 'FREE',
              ANALYTICS_ADVANCED: ['MEDIUM', 'PRO'].includes(plan),
              ANALYTICS_EXPORT: plan === 'PRO',
              MAX_PRODUCTS: 150,
              MAX_CATEGORIES: 40,
              MAX_VIDEOS: 40,
              VIDEO_UPLOAD: true,
            },
            usage: { products: 1, categories: 1, videos: 0 },
            csrfToken: 'a'.repeat(64),
            isPublished: true,
            onboarding: { designConfigured: true },
          },
        },
      });
    if (path === 'qr' && req.method() === 'GET')
      return route.fulfill({
        json: {
          success: true,
          data: { rows: row ? [row] : [], limit: 3, customization: true, publicAvailable: true },
        },
      });
    if (
      (path === 'qr' && req.method() === 'POST') ||
      (path === `qr/${qrId}` && req.method() === 'PUT')
    ) {
      if (options.conflict && req.method() === 'PUT')
        return route.fulfill({ status: 409, json: { error: { code: 'QR_VERSION_CONFLICT' } } });
      row = {
        id: qrId,
        name: body.name,
        publicIdentifier: publicId,
        publicUrl: `http://127.0.0.1:4300/q/${publicId}`,
        status: body.active === false ? 'PAUSED' : 'ACTIVE',
        createdAt: '2026-10-02T12:00:00Z',
        updatedAt: '2026-10-02T12:01:00Z',
        revision: (row?.revision || 0) + 1,
        configuration: body.configuration,
      };
      return route.fulfill({
        status: req.method() === 'POST' ? 201 : 200,
        json: { success: true, data: row },
      });
    }
    if (path === `qr/${qrId}` && req.method() === 'DELETE') {
      row = null;
      return route.fulfill({ status: 204 });
    }
    if (path === `qr/${qrId}/image`) {
      if (new URL(req.url()).searchParams.get('format') === 'svg')
        return route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16"/></svg>',
        });
      return route.fulfill({ contentType: 'image/png', body: png });
    }
    if (path === `public/qr/${publicId}`)
      return options.unavailable
        ? route.fulfill({ status: 404, json: { error: { code: 'QR_UNAVAILABLE' } } })
        : route.fulfill({ json: { success: true, data: { slug: 'bistro', qrId } } });
    if (path === 'public/menu/bistro')
      return route.fulfill({
        json: {
          success: true,
          data: {
            business: {
              name: 'Bistrô',
              slug: 'bistro',
              description: '',
              logoUrl: '',
              coverImageUrl: '',
            },
            design: {},
            categories: [],
            subcategories: [],
            items: [],
          },
        },
      });
    if (path === 'public/menu/bistro/events')
      return route.fulfill({ status: 202, json: { success: true, data: { accepted: 1 } } });
    if (path === 'business')
      return route.fulfill({ json: { success: true, data: { name: 'Bistrô', slug: 'bistro' } } });
    if (path === 'design') return route.fulfill({ json: { success: true, data: {} } });
    if (path === 'analytics/options')
      return route.fulfill({ json: { success: true, data: analyticsOptions(plan) } });
    if (path === 'analytics')
      return route.fulfill({
        json: { success: true, data: analyticsReport(plan, new URL(req.url()).searchParams) },
      });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  return requests;
}
async function qrSection(page: Page) {
  const nav = page.locator('app-sidebar .nav-item').filter({ hasText: 'QR Code' });
  await expect(nav).toBeAttached();
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await nav.click();
}
test('three saved QR codes disable creation while allowing deletion', async ({ page }) => {
  await mock(page, 'PRO');
  await page.route('**/api/v1/qr', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          limit: 3,
          customization: true,
          publicAvailable: true,
          rows: [1, 2, 3].map((n) => ({
            id: n === 1 ? qrId : `44444444-4444-4444-8444-44444444444${n}`,
            name: `Mesa ${n}`,
            revision: 1,
            publicIdentifier: publicId,
            publicUrl: `/q/${publicId}`,
            status: n === 2 ? 'PAUSED' : 'ACTIVE',
            configuration: defaultConfig,
          })),
        },
      },
    }),
  );
  await page.goto('/dashboard');
  await qrSection(page);
  await expect(page.locator('.qr-code-choice')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Novo QR Code', exact: true })).toBeDisabled();
  await expect(page.locator('.qr-code-choice').nth(1)).toContainText('Pausado');
  await expect(page.getByRole('button', { name: 'Excluir QR Code', exact: true })).toBeEnabled();
});
test('QR deletion requires confirmation and frees the saved slot', async ({ page }) => {
  const requests = await mock(page, 'PRO');
  await page.goto('/dashboard');
  await qrSection(page);
  await page.getByRole('button', { name: 'Gerar QR Code', exact: true }).click();
  await expect(page.locator('.qr-image')).toBeVisible();
  await page.getByRole('button', { name: 'Excluir QR Code', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  expect(requests.filter((r) => r.method === 'DELETE')).toHaveLength(0);
  await page.getByRole('button', { name: 'Excluir QR Code', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.qr-image')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Gerar QR Code', exact: true })).toBeEnabled();
  const deletion = requests.find((r) => r.method === 'DELETE');
  expect(deletion?.path).toBe(`qr/${qrId}`);
  expect(deletion?.body).toEqual({ revision: 1 });
  expect(deletion?.headers['x-csrf-token']).toBe('a'.repeat(64));
});
test('mobile search and settings buttons have equal size and open settings', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'phase4-mobile', 'Mobile layout');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mock(page, 'PRO');
  await page.goto('/dashboard');
  const topbar = page.locator('app-topbar');
  const search = topbar.getByRole('button', { name: 'Abrir pesquisa', exact: true });
  const settings = topbar.getByRole('button', { name: 'Abrir configurações', exact: true });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(settings).toBeVisible();
    const a = (await search.boundingBox())!,
      b = (await settings.boundingBox())!;
    expect(a.width).toBeCloseTo(44, 2);
    expect(b.width).toBeCloseTo(a.width, 2);
    expect(b.height).toBeCloseTo(a.height, 2);
    expect(Math.abs(a.y - b.y)).toBeLessThan(1);
    expect(b.x).toBeGreaterThan(a.x + a.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await settings.click();
  await expect(page.getByRole('dialog', { name: 'Configurações', exact: true })).toBeVisible();
});
for (const plan of ['FREE', 'BASIC'] as const)
  test(`${plan}: demo makes no real QR request, including DevTools local plan storage`, async ({
    page,
  }) => {
    const requests = await mock(page, plan);
    await page.addInitScript(() => {
      localStorage.setItem('plan', 'PRO');
      localStorage.setItem('QR_GENERATOR', 'true');
    });
    await page.goto('/dashboard');
    await qrSection(page);
    await expect(page.locator('app-feature-preview')).toContainText(
      'Disponível a partir do Medium.',
    );
    await expect(page.locator('app-owner-qr')).toHaveCount(0);
    expect(requests.some((r) => r.path.startsWith('qr'))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
for (const plan of ['MEDIUM', 'PRO'] as const)
  test(`${plan}: generate, stable update, pause, safe downloads and keyboard`, async ({
    page,
  }, info) => {
    const requests = await mock(page, plan);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/dashboard');
    await qrSection(page);
    await expect(page.getByRole('heading', { name: 'QR Code do cardápio' })).toBeVisible();
    expect(requests.filter((r) => /qr\/.+\/image/.test(r.path))).toHaveLength(0);
    await page.getByLabel('Nome do QR', { exact: true }).fill('QR Balcão');
    await page.getByLabel('Texto curto', { exact: true }).fill('Veja nosso cardápio');
    await page.getByLabel('Cor principal', { exact: true }).fill('#F47B20');
    const generate = page.getByRole('button', { name: 'Gerar QR Code', exact: true });
    await generate.focus();
    await expect(generate).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText('QR Code gerado com sucesso.', { exact: true })).toBeVisible();
    await expect(page.locator('.qr-image')).toBeVisible();
    const create = requests.find((r) => r.path === 'qr' && r.method === 'POST')!;
    expect(create.headers['x-csrf-token']).toBe('a'.repeat(64));
    expect(create.body).toEqual({
      name: 'QR Balcão',
      configuration: { ...defaultConfig, color: '#f47b20', caption: 'Veja nosso cardápio' },
    });
    await expect(page.locator('.menu-link')).toHaveAttribute(
      'href',
      `http://127.0.0.1:4300/q/${publicId}`,
    );
    await page.getByLabel('Cor principal', { exact: true }).fill('#FFFFFF');
    await expect(page.getByRole('button', { name: 'Atualizar QR Code' })).toBeEnabled();
    await expect(page.getByText(/Escolha uma cor mais escura/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Atualizar QR Code' }).click();
    await expect(page.getByText('QR Code atualizado. O endereço permanece o mesmo.', { exact: true })).toBeVisible();
    expect(requests.filter(r => r.method === 'PUT').at(-1)?.body.configuration.color.toUpperCase()).toBe('#FFFFFF');
    await page.getByLabel('Cor principal', { exact: true }).fill('#691525');
    await page.getByLabel('QR ativo para visitantes').uncheck();
    await page.getByRole('button', { name: 'Atualizar QR Code' }).click();
    await expect(page.locator('.status-label')).toContainText('Pausado');
    expect(requests.find((r) => r.method === 'PUT')?.body.revision).toBe(1);
    await expect(page.locator('.menu-link')).toHaveAttribute(
      'href',
      `http://127.0.0.1:4300/q/${publicId}`,
    );
    for (const format of ['PNG', 'SVG']) {
      const downloaded = page.waitForEvent('download');
      await page.getByRole('button', { name: `Baixar ${format}`, exact: true }).click();
      expect((await downloaded).suggestedFilename()).toBe(
        `pingochef-qr-${qrId}.${format.toLowerCase()}`,
      );
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const dimensions = await page.locator('.qr-image').boundingBox();
    expect(dimensions!.width).toBeLessThanOrEqual(info.project.use.viewport!.width);
    const linkColor = await page.locator('.menu-link').evaluate((el) => getComputedStyle(el).color);
    expect(linkColor).toBe('rgb(255, 248, 230)');
    await page.getByRole('button', { name: 'Ativar tema claro' }).click();
    await expect(page.locator('.dashboard-shell')).toHaveAttribute('data-panel-theme', 'light');
    expect(await page.locator('.menu-link').evaluate((el) => getComputedStyle(el).color)).toBe(
      'rgb(46, 18, 52)',
    );
    expect(await generate.count()).toBe(0);
    expect(
      await page
        .locator('.primary')
        .first()
        .evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe('0s');
    if (info.project.name === 'phase4-desktop')
      await page.screenshot({
        path: `../.tools/phase4-qr-${plan.toLowerCase()}.png`,
        fullPage: true,
      });
  });
test('a larger rectangular PNG is fitted into a transparent 128-pixel logo', async ({ page }) => {
  const requests = await mock(page, 'PRO');
  await page.goto('/dashboard');
  await qrSection(page);
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d')!;
    const pixels = context.createImageData(canvas.width, canvas.height);
    let seed = 0x12345678;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      pixels.data[i] = seed & 255;
      pixels.data[i + 1] = (seed >>> 8) & 255;
      pixels.data[i + 2] = (seed >>> 16) & 255;
      pixels.data[i + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const source = Buffer.from(base64, 'base64');
  expect(source.length).toBeGreaterThan(24576);
  await page.getByLabel('Logo opcional').setInputFiles({
    name: 'logo-maior.png',
    mimeType: 'image/png',
    buffer: source,
  });
  await expect(page.getByRole('dialog', { name: 'Ajuste sua imagem' })).toBeVisible();
  expect(requests.filter(r => r.method === 'POST' && r.path === 'qr')).toHaveLength(0);
  await page.getByRole('button', { name: 'Usar imagem', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remover logo' })).toBeVisible();
  await page.getByRole('button', { name: 'Gerar QR Code', exact: true }).click();
  const logoPng = requests.find((r) => r.path === 'qr' && r.method === 'POST')!.body.configuration
    .logoPng;
  const normalized = Buffer.from(logoPng.slice(22), 'base64');
  expect([normalized.readUInt32BE(16), normalized.readUInt32BE(20)]).toEqual([128, 128]);
  const alpha = await page.evaluate(async (dataUrl: string) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    return [context.getImageData(64, 0, 1, 1).data[3], context.getImageData(64, 64, 1, 1).data[3]];
  }, logoPng);
  expect(alpha).toEqual([0, 255]);
});

for (const format of ['jpeg', 'webp', 'svg']) {
  test(`QR logo imports ${format}, crops and saves only a normalized PNG`, async ({ page }, info) => {
    const requests = await mock(page, 'PRO');
    let externalRequests = 0;
    await page.route('https://qr-logo-untrusted.invalid/**', route => { externalRequests++; return route.abort(); });
    await page.goto('/dashboard');
    await qrSection(page);
    const source = format === 'svg'
      ? Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="5000" height="1000"><script>window.__qrUnsafe = true</script><image href="https://qr-logo-untrusted.invalid/pixel.png" width="10" height="10"/><path fill="#00cc44" d="M0 0h5000v1000H0z"/></svg>')
      : Buffer.from(await page.evaluate((type) => {
        const canvas = document.createElement('canvas');
        canvas.width = 600; canvas.height = 300;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#00cc44'; ctx.fillRect(0, 0, 600, 300);
        return canvas.toDataURL(`image/${type}`).split(',')[1];
      }, format), 'base64');
    await page.getByLabel('Logo opcional').setInputFiles({ name: `logo.${format}`, mimeType: format === 'svg' ? 'image/svg+xml' : `image/${format}`, buffer: source });
    const dialog = page.getByRole('dialog', { name: 'Ajuste sua imagem' });
    await expect(dialog.getByRole('button', { name: 'Usar imagem', exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Preencher quadrado' }).click();
    await dialog.getByLabel('Zoom da imagem').press('End');
    await dialog.getByRole('button', { name: 'Girar 90°' }).click();
    const canvas = dialog.locator('canvas');
    const bounds = (await canvas.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width * .75, bounds.y + bounds.height * .7); await page.mouse.up();
    expect(await dialog.getByLabel('Posição horizontal').inputValue()).not.toBe('0');
    if (format === 'webp') await page.screenshot({ path: info.outputPath('qr-logo-editor.png') });
    await dialog.getByRole('button', { name: 'Usar imagem', exact: true }).click();
    await page.getByRole('button', { name: 'Gerar QR Code', exact: true }).click();
    await expect.poll(() => requests.filter(r => r.path === 'qr' && r.method === 'POST').length).toBe(1);
    const logo = requests.find(r => r.path === 'qr' && r.method === 'POST')!.body.configuration.logoPng;
    const bytes = Buffer.from(logo.slice(22), 'base64');
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([128, 128]);
    expect(bytes.length).toBeLessThan(96 * 1024);
    await expect(page.locator('.qr-image')).toBeVisible();
    expect(externalRequests).toBe(0);
    expect(await page.evaluate(() => (window as any).__qrUnsafe)).toBeUndefined();
  });
}

function twoPageLogoPdf(): Buffer {
  const stream = (color: string, width: number, height: number) => {
    const content = `${color} rg 0 0 ${width} ${height} re f\n`;
    return `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`;
  };
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Resources << >> /Contents 4 0 R >>',
    stream('1 0 0', 400, 200),
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 400] /Resources << >> /Contents 6 0 R >>',
    stream('0 1 0', 200, 400),
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const [i, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${offset.toString().padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

test('QR logo renders the selected PDF page locally and keeps cancellation reversible', async ({ page }) => {
  const requests = await mock(page, 'PRO');
  const issues: string[] = [];
  page.on('pageerror', error => issues.push(error.message));
  await page.goto('/dashboard');
  await qrSection(page);
  await page.getByLabel('Logo opcional').setInputFiles({ name: 'logo.pdf', mimeType: 'application/pdf', buffer: twoPageLogoPdf() });
  const dialog = page.getByRole('dialog', { name: 'Ajuste sua imagem' });
  await expect(dialog.getByRole('button', { name: 'Usar imagem', exact: true })).toBeEnabled({ timeout: 20000 });
  await dialog.getByLabel('Página do PDF', { exact: true }).fill('2');
  await expect(dialog.getByRole('button', { name: 'Usar imagem', exact: true })).toBeEnabled();
  const pixel = await dialog.locator('canvas').evaluate(canvas => Array.from((canvas as HTMLCanvasElement).getContext('2d')!.getImageData(256, 256, 1, 1).data));
  expect(pixel).toEqual([0, 255, 0, 255]);
  await dialog.getByRole('button', { name: 'Usar imagem', exact: true }).click();
  const previous = await page.locator('.logo-thumbnail').getAttribute('src');
  await page.getByLabel('Logo opcional').setInputFiles({ name: 'replacement.pdf', mimeType: 'application/pdf', buffer: twoPageLogoPdf() });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.logo-thumbnail')).toHaveAttribute('src', previous!);
  await expect(page.getByLabel('Logo opcional')).toBeFocused();
  await page.getByRole('button', { name: 'Gerar QR Code', exact: true }).click();
  await expect.poll(() => requests.filter(r => r.path === 'qr' && r.method === 'POST').length).toBe(1);
  expect(requests.find(r => r.path === 'qr' && r.method === 'POST')!.body.configuration.logoPng).toBe(previous);
  expect(issues).toEqual([]);
});

test('QR logo rejects oversized, empty and disguised non-image files without sending them', async ({ page }) => {
  const requests = await mock(page, 'PRO');
  await page.goto('/dashboard');
  await qrSection(page);
  await page.getByLabel('Logo opcional').setInputFiles({ name: 'large.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(4 * 1024 * 1024 + 1) });
  await expect(page.getByRole('alert')).toContainText('até 4 MB');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Logo opcional').setInputFiles({ name: 'empty.png', mimeType: 'image/png', buffer: Buffer.alloc(0) });
  await expect(page.getByRole('alert')).toContainText('vazio');
  await page.getByLabel('Logo opcional').setInputFiles({ name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('<script>alert(1)</script>') });
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Não foi possível abrir');
  await expect(page.getByRole('button', { name: 'Usar imagem', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(requests.filter(r => r.path === 'qr' && r.method === 'POST')).toHaveLength(0);
});
test('conflict is clear and unsaved changes cannot download an obsolete file', async ({ page }) => {
  await mock(page, 'PRO', { conflict: true });
  await page.goto('/dashboard');
  await qrSection(page);
  await page.getByRole('button', { name: 'Gerar QR Code' }).click();
  await expect(page.locator('.qr-image')).toBeVisible();
  await page.getByLabel('Nome do QR', { exact: true }).fill('QR Mesa 2');
  await expect(page.getByRole('button', { name: 'Baixar PNG' })).toBeDisabled();
  await page.getByRole('button', { name: 'Atualizar QR Code' }).click();
  await expect(page.getByRole('alert')).toContainText('alterado em outra sessão');
});
test('stable public QR resolves once and emits QR_ENTRY only after the public menu succeeds', async ({
  page,
}) => {
  const requests = await mock(page, 'MEDIUM');
  await page.goto(`/q/${publicId}`);
  await expect(page).toHaveURL(new RegExp(`/m/bistro\\?source=qr&qr=${qrId}`));
  await expect.poll(() => requests.filter((r) => r.path.endsWith('/events')).length).toBe(1);
  const batch = requests.find((r) => r.path.endsWith('/events'))!;
  expect(batch.body.qrId).toBe(qrId);
  expect(batch.body.source).toBe('qr');
  expect(batch.body.events.map((e: any) => e.eventName)).toEqual(['MENU_VIEW', 'QR_ENTRY']);
  expect(batch.headers.authorization).toBeUndefined();
  expect(batch.headers['x-csrf-token']).toBeUndefined();
  await page.reload();
  await expect.poll(() => requests.filter((r) => r.path.endsWith('/events')).length).toBe(2);
  expect(requests.filter((r) => r.path.startsWith('public/qr/'))).toHaveLength(1); // reload stays on menu, no second redirect.
  expect(requests.filter((r) => r.path.endsWith('/events'))[1].body.visitorId).toBe(
    batch.body.visitorId,
  ); // Database deduplicates entries across page IDs.
});
test('invalid/unavailable public QR never emits menu analytics or accepts a redirect target', async ({
  page,
}) => {
  const requests = await mock(page, 'PRO', { unavailable: true });
  await page.goto(`/q/${publicId}?next=https://evil.test`);
  await expect(page.getByRole('alert')).toContainText('não está disponível');
  expect(requests.some((r) => r.path.endsWith('/events'))).toBe(false);
  await page.goto('/q/not-a-uuid');
  await expect(page.getByRole('alert')).toContainText('inválido');
  expect(requests.filter((r) => r.path.startsWith('public/qr/'))).toHaveLength(1);
});
test('owner login is keyboard accessible and restores the server account without browser tokens', async ({
  page,
}) => {
  const requests = await mock(page, 'FREE', { login: true });
  await page.goto('/login');
  await page.getByLabel('E-mail', { exact: true }).fill('maria@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('StrongPassword123!');
  const enter = page.getByRole('button', { name: 'Entrar', exact: true });
  await enter.focus();
  await expect(enter).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.locator('app-sidebar')).toBeAttached();
  await expect(page.getByRole('heading', { name: 'Olá, Bistrô PingoChef' })).toBeVisible();
  expect(requests.find((r) => r.path === 'auth/login')?.body).toEqual({
    email: 'maria@example.test',
    password: 'StrongPassword123!',
  });
  expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('refresh_token'))).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('legacy confirmation links return to login with password recovery available and no resend flow', async ({
  page,
}) => {
  await mock(page, 'FREE', { login: true });
  let sent = false;
  await page.route('**/api/v1/auth/resend-confirmation', async (route) => {
    sent = true;
    return route.fulfill({ status: 404 });
  });
  await page.goto('/confirm-email?confirmation=sent');
  await expect(page).toHaveURL(/login/);
  await expect(page.getByRole('button', { name: 'Reenviar confirmação', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Esqueci minha senha' })).toBeVisible();
  expect(sent).toBe(false);
});

test('password recovery still sends instructions and resets the password with recovery CSRF', async ({ page }) => {
  await mock(page, 'FREE', { login: true });
  let email = '';
  let reset: { password: string; csrf: string | undefined } | undefined;
  await page.route('**/api/v1/auth/forgot-password', async (route) => {
    email = route.request().postDataJSON().email;
    return route.fulfill({ status: 202, json: { success: true, data: {} } });
  });
  await page.route('**/api/v1/auth/recovery-session', async (route) => route.fulfill({
    json: { success: true, data: { email: 'maria@example.test', csrfToken: 'a'.repeat(64) } },
  }));
  await page.route('**/api/v1/auth/reset-password', async (route) => {
    reset = { password: route.request().postDataJSON().password, csrf: route.request().headers()['x-csrf-token'] };
    return route.fulfill({ status: 204 });
  });
  await page.goto('/login');
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
  await page.getByLabel('E-mail', { exact: true }).fill('maria@example.test');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('enviaremos as instruções por e-mail');
  expect(email).toBe('maria@example.test');
  await page.goto('/reset-password');
  await page.getByLabel('Nova senha', { exact: true }).fill('ChangedPassword123!');
  await page.getByLabel('Confirmar senha', { exact: true }).fill('ChangedPassword123!');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  expect(reset).toEqual({ password: 'ChangedPassword123!', csrf: 'a'.repeat(64) });
});
