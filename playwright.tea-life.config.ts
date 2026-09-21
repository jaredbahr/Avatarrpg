import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'tea-life.review.ts',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4267',
    viewport: { width: 1280, height: 720 },
    serviceWorkers: 'block',
    launchOptions: process.env.FNT_REVIEW_BROWSER_CHANNEL
      ? { channel: process.env.FNT_REVIEW_BROWSER_CHANNEL }
      : {},
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4267 --strictPort',
    url: 'http://127.0.0.1:4267',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
