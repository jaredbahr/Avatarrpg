import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'cutting-character-art.review.ts',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4239',
    viewport: { width: 1368, height: 912 },
    serviceWorkers: 'block',
    launchOptions: { channel: 'msedge' },
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4239 --strictPort',
    url: 'http://127.0.0.1:4239',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
