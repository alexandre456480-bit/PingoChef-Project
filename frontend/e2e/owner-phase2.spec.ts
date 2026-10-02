import { expect, test, Page } from '@playwright/test';
import { analyticsOptions, analyticsReport } from './analytics-fixture';

const matrix = {
  FREE: [10, 4, 1, false, false],
  BASIC: [30, 10, 7, true, false],
  MEDIUM: [70, 25, 25, true, true],
  PRO: [150, 40, 40, true, true],
} as const;
const names = { FREE: 'Free', BASIC: 'Basic', MEDIUM: 'Medium', PRO: 'Pro' };
const id = '22222222-2222-4222-8222-222222222222';
const intent = '11111111-1111-4111-8111-111111111111';
async function mockApi(
  page: Page,
  code: keyof typeof matrix = 'FREE',
  options: { expired?: boolean; delay?: number } = {},
) {
  let ended = false;
  const [products, categories, videos, analytics, qr] = matrix[code];
  const posts: { path: string; body: any; headers: any }[] = [];
  const account = {
    user: { id: 'owner', email: 'owner@example.test', name: 'Maria' },
    business: { id, name: 'Bistrô PingoChef', slug: 'bistro' },
    emailVerified: true,
    accountActive: true,
    provisioningRequired: false,
    plan: { code, name: names[code] },
    entitlements: {
      MAX_PRODUCTS: products,
      MAX_CATEGORIES: categories,
      MAX_VIDEOS: videos,
      ANALYTICS_BASIC: analytics,
      ANALYTICS_ADVANCED: code === 'MEDIUM' || code === 'PRO',
      ANALYTICS_EXPORT: code === 'PRO',
      QR_GENERATOR: qr,
      QR_CUSTOMIZATION: qr,
      VIDEO_UPLOAD: true,
    },
    usage: { products: products, categories: 1, videos: 0 },
    csrfToken: 'a'.repeat(64),
    isPublished: false,
    onboarding: { designConfigured: false },
  };
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1/', '');
    if (request.method() === 'POST')
      posts.push({ path, body: request.postDataJSON(), headers: request.headers() });
    if (path === 'auth/me') {
      if (options.delay) await new Promise((r) => setTimeout(r, options.delay));
      return route.fulfill({
        status: options.expired || ended ? 401 : 200,
        json:
          options.expired || ended
            ? { error: { code: 'SESSION_EXPIRED' } }
            : { success: true, data: account },
      });
    }
    if (path === 'auth/plans')
      return route.fulfill({
        json: {
          success: true,
          data: {
            pricesProvisional: true,
            billingAvailable: false,
            plans: Object.entries(matrix).map(([code, values], i) => ({
              code,
              name: names[code as keyof typeof matrix],
              products: values[0],
              categories: values[1],
              videos: values[2],
              priceCents: [0, 2990, 5990, 9990][i],
              profile: [
                'Para experimentar',
                'Para pequenos negócios',
                'Para crescer',
                'Para operações maiores',
              ][i],
              features:
                i === 0
                  ? []
                  : i === 1
                    ? ['Analytics essencial']
                    : ['Analytics avançado', 'QR Code personalizado'],
              available: code === 'FREE',
            })),
          },
        },
      });
    if (path === 'auth/plan-intents' || path === 'auth/plan-intents/' + intent)
      return route.fulfill({
        status: request.method() === 'POST' ? 201 : 200,
        json: {
          success: true,
          data: {
            id: intent,
            plan: { code: 'FREE', name: 'Free' },
            expiresAt: new Date(Date.now() + 1800000).toISOString(),
          },
        },
      });
    if (path === 'auth/register' || path === 'auth/resend-confirmation')
      return route.fulfill({
        status: 202,
        json: { success: true, data: { status: 'AWAITING_EMAIL' } },
      });
    if (path === 'auth/logout' || path === 'auth/logout-all' || path === 'auth/change-password') {
      ended = true;
      return route.fulfill({ status: 204 });
    }
    if (path === 'auth/delete-account') {
      ended = true;
      return route.fulfill({
        json: {
          success: true,
          data: { status: 'PENDING_DELETION', scheduledAt: new Date().toISOString() },
        },
      });
    }
    if (path === 'business')
      return route.fulfill({ json: { success: true, data: account.business } });
    if (path === 'design') return route.fulfill({ json: { success: true, data: {} } });
    if (path === 'qr') return route.fulfill({json:{success:true,data:{rows:[],limit:20,customization:qr,publicAvailable:false}}});
    if (path === 'analytics/options')
      return route.fulfill({ json: { success: true, data: analyticsOptions(code) } });
    if (path === 'analytics')
      return route.fulfill({
        json: { success: true, data: analyticsReport(code, new URL(request.url()).searchParams) },
      });
    return route.fulfill({ json: { success: true, data: [] } });
  });
  return { account, posts };
}
async function navigation(page: Page, label: string) {
  const button = page.locator('app-sidebar .nav-item').filter({ hasText: label });
  if (!(await button.isVisible())) {
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  } else {
    const box = await button.boundingBox();
    if (box && box.x < 0)
      await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  }
  await button.click();
}
async function settings(page: Page) {
  const gear = page.getByRole('button', { name: 'Abrir configurações', includeHidden: true });
  const box = await gear.boundingBox();
  if (!box || box.x < 0)
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await gear.click();
  await expect(page.getByRole('dialog', { name: 'Configurações' })).toBeVisible();
}

test('plans remain readable on wide desktop, notebook, tablet and mobile; paid signup is unavailable', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/plans');
  for (const width of [1600, 1280, 900, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.plan-card')).toHaveCount(4);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect((await page.locator('.plan-card').first().boundingBox())!.width).toBeGreaterThan(220);
  }
  await expect(page.locator('.recommended .recommendation')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Em breve' })).toHaveCount(3);
  await page.screenshot({
    path: '../.tools/phase2-pricing-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Começar no Free' }).click();
  await expect(page).toHaveURL(/register\?intent=/);
  await expect(page.getByText('Plano Free', { exact: true })).toBeVisible();
});
test('signup sends server intent and consent and opens masked confirmation page', async ({
  page,
}) => {
  const { posts } = await mockApi(page);
  await page.goto('/register?intent=' + intent);
  await page.getByLabel('Seu nome').fill('Maria Silva');
  await page.getByLabel('Nome do estabelecimento').fill('Bistro Teste');
  await page.getByLabel('E-mail', { exact: true }).fill('maria@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('StrongPassword123!');
  await page.getByLabel('Confirmar senha').fill('StrongPassword123!');
  await page.getByRole('checkbox', { name: /Li e aceito/ }).check();
  await page.getByRole('button', { name: 'Criar conta no Free' }).click();
  await expect(page).toHaveURL(/confirm-email/);
  await expect(page.getByText(/ma•••@example.test/)).toBeVisible();
  expect(posts.find((p) => p.path === 'auth/register')?.body).toMatchObject({
    intentId: intent,
    termsAccepted: true,
  });
  expect(posts.find((p) => p.path === 'auth/register')?.body.planCode).toBeUndefined();
  await page.getByRole('button', { name: 'Reenviar confirmação' }).click();
  await expect(page.getByText('Solicitação recebida.', { exact: false })).toBeVisible();
});
test('direct generic signup returns to plan choice; expired session never renders dashboard', async ({
  page,
}) => {
  await mockApi(page, 'FREE', { expired: true, delay: 250 });
  await page.goto('/register');
  await expect(page).toHaveURL(/plans/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/login/);
  await expect(page.locator('app-sidebar')).toHaveCount(0);
  await expect(page.getByText('Sua sessão expirou.', { exact: false })).toBeVisible();
});
for (const code of Object.keys(matrix) as (keyof typeof matrix)[]) {
  test(`${code}: backend limits, visible gates, settings and reduced motion`, async ({ page }) => {
    const { account } = await mockApi(page, code);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/dashboard');
    await expect(page.locator('app-plan-usage').first()).toContainText(
      `${matrix[code][0]} / ${matrix[code][0]}`,
    );
    await expect(page.locator('app-plan-usage').first()).toContainText('Limite atingido');
    await expect(page.locator('app-sidebar .nav-label')).toHaveText([
      'Início',
      'Menu',
      'Empresa',
      'Design',
      'Analytics',
      'QR Code',
      'Sair',
    ]);
    await navigation(page, 'Analytics');
    if (matrix[code][3]) {
      await expect(page.locator('app-owner-analytics')).toContainText('Analytics do cardápio');
      await expect(page.locator('.kpi-value').first()).toContainText('42');
    } else {
      await expect(page.locator('app-feature-preview')).toContainText(
        'Disponível a partir do Basic.',
      );
      expect(await page.locator('.line').evaluate((el) => getComputedStyle(el).animationName)).toBe(
        'none',
      );
    }
    await navigation(page, 'QR Code');
    if(matrix[code][4])await expect(page.locator('app-owner-qr')).toContainText('QR Code do cardápio');
    else await expect(page.locator('app-feature-preview')).toContainText('Disponível a partir do Medium.');
    await settings(page);
    await page.getByRole('button', { name: 'Plano e uso', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(`${account.plan.name} · uso atual`);
    await expect(page.getByRole('dialog')).toContainText(`${matrix[code][2]}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Suporte', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'pingochef@gmail.com', exact: true }),
    ).toHaveAttribute('href', 'mailto:pingochef@gmail.com');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
test('settings traps keyboard focus and logout-all sends session CSRF then leaves dashboard', async ({
  page,
}) => {
  const { posts } = await mockApi(page);
  await page.goto('/dashboard');
  await settings(page);
  await page.getByRole('button', { name: 'Segurança', exact: true }).click();
  await page.keyboard.press('Tab');
  expect(await page.getByRole('dialog').evaluate((el) => el.contains(document.activeElement))).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Sair de todos os dispositivos' }).click();
  await expect(page).toHaveURL(/login/);
  const logout = posts.find((p) => p.path === 'auth/logout-all');
  expect(logout?.headers['x-csrf-token']).toBe('a'.repeat(64));
  expect(logout?.headers.authorization).toBeUndefined();
});
test('password change and account deletion require explicit form validation', async ({ page }) => {
  const { posts } = await mockApi(page);
  await page.goto('/dashboard');
  await settings(page);
  await page.getByRole('button', { name: 'Segurança', exact: true }).click();
  await page.getByLabel('Senha atual', { exact: true }).fill('OldPassword123!');
  await page.getByLabel('Nova senha', { exact: true }).fill('NewPassword123!');
  await page.getByLabel('Confirmar nova senha').fill('DifferentPassword123!');
  await page.getByRole('button', { name: 'Alterar senha', exact: true }).click();
  await expect(page.getByText('As senhas não coincidem.')).toBeVisible();
  expect(posts.find((p) => p.path === 'auth/change-password')).toBeUndefined();
  await page.getByRole('button', { name: 'Gerenciar conta' }).click();
  await expect(page.getByRole('button', { name: 'Agendar exclusão da conta' })).toBeDisabled();
  await page.getByLabel('Sua senha atual').fill('OldPassword123!');
  await page.getByLabel('Digite EXCLUIR para confirmar').fill('EXCLUIR');
  await page.getByRole('checkbox', { name: /Entendo que/ }).check();
  await page.getByRole('button', { name: 'Agendar exclusão da conta' }).click();
  await expect(page).toHaveURL(/account=deletion-scheduled/);
  expect(posts.find((p) => p.path === 'auth/delete-account')?.body).toMatchObject({
    confirmation: 'EXCLUIR',
    confirmBusinessId: id,
  });
});
test('settings fit desktop, notebook, tablet and mobile in both themes', async ({ page }) => {
  await mockApi(page);
  await page.goto('/dashboard');
  for (const width of [1600, 1280, 900, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await settings(page);
    const box = await page.getByRole('dialog').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    await page.getByRole('button', { name: 'Segurança', exact: true }).click();
    await expect(page.getByLabel('Senha atual', { exact: true })).toBeVisible();
    expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    if (width === 1600 || width === 390)
      await page.screenshot({ path: `../.tools/phase2-settings-${width}.png` });
    await page.getByRole('button', { name: 'Fechar configurações' }).click();
  }
  await page.getByRole('button', { name: 'Ativar tema claro' }).click();
  await settings(page);
  await expect(page.getByRole('dialog')).toHaveAttribute('data-theme', 'light');
  await page.keyboard.press('Escape');
  const sidebar = page.locator('app-sidebar .sidebar');
  expect(await sidebar.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain(
    '44, 16, 36',
  );
});
test('password update and single-device logout finish only after server confirmation', async ({
  page,
}) => {
  const { posts } = await mockApi(page);
  await page.goto('/dashboard');
  await settings(page);
  await page.getByRole('button', { name: 'Segurança', exact: true }).click();
  await page.getByLabel('Senha atual', { exact: true }).fill('OldPassword123!');
  await page.getByLabel('Nova senha', { exact: true }).fill('NewPassword123!');
  await page.getByLabel('Confirmar nova senha').fill('NewPassword123!');
  await page.getByRole('button', { name: 'Alterar senha', exact: true }).click();
  await expect(page).toHaveURL(/password=changed/);
  expect(posts.find((p) => p.path === 'auth/change-password')?.headers['x-csrf-token']).toBe(
    'a'.repeat(64),
  );
  await mockApi(page);
  await page.goto('/dashboard');
  await settings(page);
  await page.getByRole('button', { name: 'Gerenciar conta' }).click();
  await page.getByRole('button', { name: 'Sair desta conta' }).click();
  await expect(page).toHaveURL(/session=ended/);
});
