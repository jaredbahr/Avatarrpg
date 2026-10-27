import { defineConfig } from '@playwright/test';

const port = Number(process.env.FNT_E2E_PORT ?? 4361);

/** Ba Dan art-direction demo captures (issue #284); see e2e/ba-dan-demo.review.ts. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'ba-dan-demo.review.ts',
  outputDir: '.shots/ba-dan-demo/test-results',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1368, height: 912 },
    serviceWorkers: 'block',
    video: { mode: 'on', size: { width: 1368, height: 912 } },
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
