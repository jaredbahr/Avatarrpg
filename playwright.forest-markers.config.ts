import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'forest-markers.review.ts',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4259',
    viewport: { width: 1280, height: 720 },
    serviceWorkers: 'block',
    launchOptions: { channel: 'msedge' },
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4259 --strictPort',
    url: 'http://127.0.0.1:4259',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
