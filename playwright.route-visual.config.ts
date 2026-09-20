import { defineConfig } from '@playwright/test';

/** FNT_ROUTE_REVIEW_VIEWPORT=834x1194 reviews the same route on a portrait tablet. */
const viewport = /^(\d+)x(\d+)$/.exec(process.env.FNT_ROUTE_REVIEW_VIEWPORT ?? '');

export default defineConfig({
  testDir: './e2e',
  testMatch: 'route-visual.review.ts',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4277',
    viewport: viewport
      ? { width: Number(viewport[1]), height: Number(viewport[2]) }
      : { width: 1368, height: 912 },
    serviceWorkers: 'block',
    launchOptions: process.env.FNT_REVIEW_BROWSER_CHANNEL
      ? { channel: process.env.FNT_REVIEW_BROWSER_CHANNEL }
      : {},
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4277 --strictPort',
    url: 'http://127.0.0.1:4277',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
