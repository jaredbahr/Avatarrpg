import { defineConfig } from '@playwright/test';

/** Opt-in continuous legal-action evidence, separate from required CI suites. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'air-displacement.review.ts',
  workers: 1,
  retries: 0,
  maxFailures: 1,
  reporter: 'list',
  outputDir: '.shots/air-displacement/results',
  use: {
    channel: 'chrome',
    viewport: { width: 1440, height: 1080 },
    baseURL: 'http://127.0.0.1:4319',
    serviceWorkers: 'block',
    video: { mode: 'on', size: { width: 1440, height: 1080 } },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4319 --strictPort',
    url: 'http://127.0.0.1:4319',
    reuseExistingServer: false,
    timeout: 180000,
  },
});
