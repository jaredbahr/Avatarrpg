import { defineConfig } from '@playwright/test';

const port = Number(process.env.FNT_E2E_PORT ?? 4371);

/** Portrait variant sample captures (ADR 0092 pending); see e2e/portrait-variants.review.ts. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'portrait-variants.review.ts',
  outputDir: '.shots/portrait-variants/test-results',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1368, height: 912 },
    deviceScaleFactor: 2,
    serviceWorkers: 'block',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
