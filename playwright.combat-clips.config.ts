import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'combat-clips.review.ts',
  workers: 1,
  retries: 0,
  timeout: 900_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4344',
    viewport: { width: 1368, height: 912 },
    deviceScaleFactor: 2,
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4344 --strictPort',
    url: 'http://127.0.0.1:4344',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
