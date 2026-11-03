import { defineConfig } from '@playwright/test';

const port = Number(process.env.FNT_E2E_PORT ?? 4363);

/** Kaya polish review recordings (art/source/party-world/README.md); see e2e/kaya-polish.review.ts. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'kaya-polish.review.ts',
  outputDir: '.shots/kaya-polish/test-results',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 800 },
    serviceWorkers: 'block',
    // Real-time recordings (cut the load with ffmpeg, from timing.json; not committed).
    video: { mode: 'on', size: { width: 1280, height: 800 } },
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
