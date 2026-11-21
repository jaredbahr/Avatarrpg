import { defineConfig } from '@playwright/test';

/**
 * The combat juice review (`e2e/juice.review.ts`): frame strips of every hero ability and demo enemy
 * attack, staged on a clean patch of a real board. Local only, never part of the CI gate.
 * Run: `npm run review:juice` (options in the spec's header).
 */
const PORT = Number(process.env.FNT_JUICE_PORT ?? 4351);

export default defineConfig({
  testDir: './e2e',
  testMatch: 'juice.review.ts',
  workers: 1,
  retries: 0,
  // One test walks every case in turn; a hung page fails here instead of hanging the run.
  timeout: 3_600_000,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1368, height: 912 },
    deviceScaleFactor: 2,
    serviceWorkers: 'block',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
