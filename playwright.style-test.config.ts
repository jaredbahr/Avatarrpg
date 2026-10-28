import { defineConfig } from '@playwright/test';

const port = Number(process.env.FNT_E2E_PORT ?? 4364);

/** World-style figure test captures; see e2e/style-test.review.ts. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'style-test.review.ts',
  outputDir: '.shots/style-test/test-results',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1368, height: 912 },
    serviceWorkers: 'block',
    // FNT_STYLE_VIDEO=1 records the run; the real-time crossing of Ba Dan is in it.
    video: process.env.FNT_STYLE_VIDEO ? { mode: 'on', size: { width: 1368, height: 912 } } : 'off',
    launchOptions: process.env.FNT_REVIEW_BROWSER_CHANNEL
      ? { channel: process.env.FNT_REVIEW_BROWSER_CHANNEL }
      : {},
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
