import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'feel-pass.review.ts',
  outputDir: 'test-results/feel-pass-runs',
  workers: 1,
  retries: 0,
  timeout: 600_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4351',
    viewport: { width: 1368, height: 912 },
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4351 --strictPort',
    url: 'http://127.0.0.1:4351',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
