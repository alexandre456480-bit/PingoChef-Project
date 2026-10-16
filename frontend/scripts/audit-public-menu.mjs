// Controlled production-build lab. Never connects to a customer database.
// Usage: node scripts/audit-public-menu.mjs --phase before --dir ../.tools/public-menu-baseline/site
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, extname, join, sep } from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');
const arg = (key, fallback) => process.argv[process.argv.indexOf(key) + 1] ?? fallback;
const phase = process.argv.includes('--phase') ? arg('--phase') : 'before';
const root = resolve(process.argv.includes('--dir') ? arg('--dir') : 'dist/frontend/browser');
const out = resolve('../.tools/public-menu-performance');
const onlyServe = process.argv.includes('--serve');
const repeats = Number(process.argv.includes('--repeats') ? arg('--repeats') : '3');
const image = await readFile(resolve('public/logo_img.webp'));
const publicRoot = resolve('public');
export function fixture(template = 'modern', origin = '') {
  return {
    success: true,
    data: {
      business: {
        name: 'Bistrô Aurora',
        slug: 'audit',
        description: 'Sabores preparados na hora.',
        logoUrl: `${origin}/__audit/logo.webp`,
        coverImageUrl: `${origin}/__audit/cover.webp`,
        welcomeBgType: 'image',
        welcomeBgImage: `${origin}/__audit/cover.webp`,
      },
      design: {
        templateKey: template,
        fontHeading: template === 'minimal' ? 'Playfair Display' : 'Outfit',
        fontBody: 'Inter',
        heroBanners: [`${origin}/__audit/cover.webp`, `${origin}/__audit/cover-2.webp`],
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
          'hero',
          'categories',
          'promotion',
          'most_liked',
          'featured_product',
          'combo',
          'best_seller',
        ].map((type, position) => ({ id: type, type, enabled: true, position })),
        customConfig: { enable_likes: true, enable_cart: false, intro_card: { enabled: false } },
      },
      categories: Array.from({ length: 6 }, (_, i) => ({
        id: `cat-${i}`,
        name: i ? `Categoria ${i}` : 'Pratos',
        displayOrder: i,
        isActive: true,
        iconType: 'none',
      })),
      subcategories: [],
      items: Array.from({ length: 60 }, (_, i) => ({
        id: `item-${i}`,
        categoryId: `cat-${i % 6}`,
        name: i ? `Prato artesanal ${i}` : 'Açaí da casa',
        description: 'Ingredientes frescos, preparados na hora para você.',
        price: 29.9,
        promotionalPrice: i % 5 === 0 ? 24.9 : null,
        imageUrl: `${origin}/__audit/product-${i}.webp`,
        isAvailable: true,
        isHighlighted: true,
        highlightType: ['promotion', 'chef', 'combo', 'best_seller', 'most_liked'][i % 5],
        likesCount: i + 1,
        displayOrder: i,
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
const mime = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const template = /audit-minimal/.test(req.headers.referer || '') ? 'minimal' : 'modern';
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json');
      if (url.pathname.endsWith('/events') || url.pathname.endsWith('/vitals')) {
        res.statusCode = 202;
        res.end('{"success":true}');
        return;
      }
      if (url.pathname.includes('/like/')) {
        res.end('{"success":true,"data":{"likesCount":2,"created":true}}');
        return;
      }
      await new Promise((r) => setTimeout(r, 200));
      const templateKey = url.pathname.includes('minimal') ? 'minimal' : template;
      res.end(JSON.stringify(fixture(templateKey, `http://127.0.0.1:${server.address().port}`)));
      return;
    }
    let bytes, extension;
    if (url.pathname.startsWith('/__audit/')) {
      bytes = image;
      extension = '.webp';
    } else {
      const candidate = resolve(root, '.' + decodeURIComponent(url.pathname));
      if (candidate !== root && !candidate.startsWith(root + sep)) {
        res.statusCode = 403;
        res.end();
        return;
      }
      const path = extname(candidate) ? candidate : join(root, 'index.html');
      bytes = await readFile(path);
      extension = extname(path);
    }
    res.setHeader('Content-Type', mime[extension] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    if (
      req.headers['accept-encoding']?.includes('gzip') &&
      ['.js', '.css', '.html'].includes(extension)
    ) {
      bytes = gzipSync(bytes);
      res.setHeader('Content-Encoding', 'gzip');
    }
    res.end(bytes);
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
console.log(JSON.stringify({ event: 'lab_server', base, root, phase }));
if (onlyServe) await new Promise(() => {});
else if (process.argv.includes('--lighthouse')) {
  const { launch } = await import(
    pathToFileURL(
      resolve('../.tools/public-audit-tools/node_modules/chrome-launcher/dist/index.js'),
    )
  );
  const { default: lighthouse } = await import(
    pathToFileURL(resolve('../.tools/public-audit-tools/node_modules/lighthouse/core/index.js'))
  );
  await mkdir(out, { recursive: true });
  for (const template of ['modern', 'minimal']) {
    const chrome = await launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ['--headless', '--no-sandbox'],
    });
    try {
      const { lhr } = await lighthouse(`${base}/m/audit-${template}`, {
        port: chrome.port,
        output: 'json',
        onlyCategories: ['performance', 'accessibility', 'best-practices'],
        blockedUrlPatterns: ['*fonts.googleapis.com/*', '*fonts.gstatic.com/*'],
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 1,
          disabled: false,
        },
        throttlingMethod: 'devtools',
        throttling: {
          rttMs: 200,
          throughputKbps: 1600,
          cpuSlowdownMultiplier: 4,
          requestLatencyMs: 200,
          downloadThroughputKbps: 1600,
          uploadThroughputKbps: 750,
        },
      });
      await writeFile(
        join(out, `${phase}-lighthouse-${template}.json`),
        JSON.stringify(lhr, null, 2),
      );
      console.log(
        JSON.stringify({
          event: 'lighthouse',
          phase,
          template,
          scores: Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, v.score])),
          LCP: lhr.audits['largest-contentful-paint'].numericValue,
          CLS: lhr.audits['cumulative-layout-shift'].numericValue,
          errors: lhr.runtimeError ?? null,
        }),
      );
    } finally {
      await chrome.kill();
    }
  }
  server.close();
} else {
  await mkdir(out, { recursive: true });
  const vitalsScript = await readFile(
    resolve('node_modules/web-vitals/dist/web-vitals.iife.js'),
    'utf8',
  );
  const browser = await chromium.launch();
  const profiles = {
    wifi: { latency: 0, downloadThroughput: 20_000_000, uploadThroughput: 5_000_000 },
    fast4g: { latency: 150, downloadThroughput: 1_125_000, uploadThroughput: 187_500 },
    slow4g: { latency: 200, downloadThroughput: 200_000, uploadThroughput: 93_750 },
  };
  const cases = [];
  for (const template of ['modern', 'minimal']) {
    for (const network of Object.keys(profiles))
      for (let run = 0; run < repeats; run++)
        cases.push({ template, network, width: 390, height: 844, run });
    for (const [width, height] of [
      [360, 800],
      [430, 932],
      [768, 1024],
      [1440, 900],
    ])
      cases.push({ template, network: 'wifi', width, height, run: 0 });
  }
  const results = [];
  for (const scenario of cases.filter(
    (s) =>
      (!process.argv.includes('--network') || s.network === arg('--network')) &&
      (!process.argv.includes('--template') || s.template === arg('--template')) &&
      (!process.argv.includes('--mobile-only') || s.width === 390),
  )) {
    const context = await browser.newContext({
      viewport: { width: scenario.width, height: scenario.height },
    });
    const page = await context.newPage();
    const vitals = {},
      requests = [],
      failures = [];
    await page.exposeFunction('__auditVital', ({ name, value }) => {
      vitals[name] = Math.round(value * 1000) / 1000;
    });
    await page.addInitScript({
      content:
        vitalsScript +
        `;window.__stages={};for(const name of ['onLCP','onCLS','onINP','onFCP','onTTFB'])webVitals[name](m=>window.__auditVital({name:m.name,value:m.value}),{reportAllChanges:true});const tick=()=>{for(const [name,selector] of Object.entries({structure:'.public-page-shell',shell:'.public-app-container',hero:'.welcome-content',category:'.category-nav-pill',product:'.promo-item-card,.product-item-card,.liked-item-row,.chef-card'})){const el=document.querySelector(selector);if(!window.__stages[name]&&el?.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))window.__stages[name]=performance.now();}if(performance.now()<60000)requestAnimationFrame(tick);};requestAnimationFrame(tick);`,
    });
    if (process.argv.includes('--diagnose'))
      await page.addInitScript(() => {
        window.__interactionFrames = [];
        window.__interactionEvents = [];
        new PerformanceObserver((list) =>
          window.__interactionFrames.push(...list.getEntries().map((entry) => entry.toJSON())),
        ).observe({ type: 'long-animation-frame', buffered: true });
        new PerformanceObserver((list) =>
          window.__interactionEvents.push(...list.getEntries().map((entry) => entry.toJSON())),
        ).observe({ type: 'event', buffered: true, durationThreshold: 16 });
      });
    await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
    page.on('pageerror', (e) => failures.push(e.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      ...profiles[scenario.network],
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: scenario.network === 'wifi' ? 1 : 4 });
    cdp.on('Network.responseReceived', (e) =>
      requests.push({
        id: e.requestId,
        type: e.type,
        path: new URL(e.response.url).pathname,
        status: e.response.status,
        bytes: 0,
      }),
    );
    cdp.on('Network.loadingFinished', (e) => {
      const row = requests.find((r) => r.id === e.requestId);
      if (row) row.bytes = e.encodedDataLength;
    });
    await page.goto(`${base}/m/audit-${scenario.template}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });
    await page.locator('.btn-enter-menu').waitFor({ state: 'visible', timeout: 90000 });
    await page.waitForFunction(
      () => performance.now() - (window.__stages.hero || performance.now()) > 300,
    );
    const initialRequests = requests.map((r) => ({ ...r }));
    if (process.argv.includes('--diagnose')) {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.start');
    }
    const enterStart = await page.evaluate(() => performance.now());
    await page.locator('.btn-enter-menu').click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('.category-nav-pill')
          ?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
      null,
      { timeout: 30000 },
    );
    await page.waitForFunction(
      () =>
        document
          .querySelector('.promo-item-card,.chef-card')
          ?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
      null,
      { timeout: 30000 },
    );
    const menuVisible = await page.evaluate(() => performance.now());
    if (process.argv.includes('--diagnose'))
      await writeFile(
        join(out, `${phase}-cpu.json`),
        JSON.stringify((await cdp.send('Profiler.stop')).profile),
      );
    await page.locator('.category-nav-pill').filter({ hasText: 'Pratos' }).first().click();
    await page.locator('.product-item-card').first().waitFor({ state: 'visible' });
    const productStart = await page.evaluate(() => performance.now());
    await page
      .locator('.product-item-card')
      .first()
      .getByRole('button', { name: 'Ver', exact: true })
      .click();
    await page.locator('.product-modal-sheet').waitFor({ state: 'visible' });
    const detailMs = await page.evaluate((start) => performance.now() - start, productStart);
    const stages = await page.evaluate(() => window.__stages);
    if (process.argv.includes('--diagnose'))
      await writeFile(
        join(out, `${phase}-interactions.json`),
        JSON.stringify(
          await page.evaluate(() => ({
            frames: window.__interactionFrames,
            events: window.__interactionEvents,
          })),
          null,
          2,
        ),
      );
    await page.waitForTimeout(300);
    const initial = requests.filter((r) => initialRequests.some((i) => i.id === r.id));
    await page.goto('about:blank');
    await page.waitForTimeout(50);
    const summary = {
      ...scenario,
      vitals,
      stages,
      menuEntryMs: Math.round(menuVisible - enterStart),
      detailMs: Math.round(detailMs),
      initialRequests: initial.length,
      initialTransferBytes: initial.reduce((n, r) => n + r.bytes, 0),
      initialImageBytes: initial.filter((r) => r.type === 'Image').reduce((n, r) => n + r.bytes, 0),
      menuPayloadBytes: Buffer.byteLength(JSON.stringify(fixture(scenario.template, base))),
      requests,
      failures,
    };
    results.push(summary);
    console.log(
      JSON.stringify({
        event: 'lab_result',
        ...scenario,
        vitals,
        entryMs: summary.menuEntryMs,
        detailMs: summary.detailMs,
        initialBytes: summary.initialTransferBytes,
        errors: failures.length,
      }),
    );
    await writeFile(
      join(out, `${phase}.json`),
      JSON.stringify(
        {
          environment:
            'Local Chromium, production build, fixture API 200ms; external fonts isolated; not production/CrUX',
          profiles,
          results,
        },
        null,
        2,
      ),
    );
    await context.close();
  }
  await browser.close();
  server.close();
}
