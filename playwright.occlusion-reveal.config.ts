import { defineConfig } from '@playwright/test';

const port = Number(process.env.FNT_E2E_PORT ?? 4364);

/** Grounding pass review captures (ADR 0093); see e2e/occlusion-reveal.review.ts. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'occlusion-reveal.review.ts',
  outputDir: '.shots/occlusion-reveal/test-results',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1368, height: 912 },
    serviceWorkers: 'block',
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
