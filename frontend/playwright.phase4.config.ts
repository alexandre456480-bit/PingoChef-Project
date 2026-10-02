import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testMatch: ['owner-phase2.spec.ts', 'menu-analytics.spec.ts', 'owner-phase4.spec.ts'],
  projects: [
    {
      name: 'phase4-desktop',
      use: { browserName: 'chromium', viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'phase4-notebook',
      use: { browserName: 'chromium', viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'phase4-tablet',
      use: {
        browserName: 'chromium',
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'phase4-mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
