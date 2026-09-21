import { defineConfig } from '@playwright/test';

/** Local real-input route walk. Not part of the required CI check. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'route-walk.review.ts',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4278',
    viewport: { width: 1368, height: 912 },
    serviceWorkers: 'block',
    launchOptions: process.env.FNT_REVIEW_BROWSER_CHANNEL
      ? { channel: process.env.FNT_REVIEW_BROWSER_CHANNEL }
      : {},
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4278 --strictPort',
    url: 'http://127.0.0.1:4278',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
