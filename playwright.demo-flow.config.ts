import { defineConfig } from '@playwright/test';

const port = Number(process.env.FNT_E2E_PORT ?? 4371);

/**
 * The demo played end to end, recorded (see e2e/demo-flow.review.ts).
 * Four projects: 1280x800 and iPad portrait (820x1180 at 2 dpr), each on both
 * backends. `--project` picks one; WebGL here is software and slow.
 */
const desktop = { width: 1280, height: 800 };
const ipad = { width: 820, height: 1180 };

export default defineConfig({
  testDir: './e2e',
  testMatch: 'demo-flow.review.ts',
  outputDir: '.shots/demo-flow/test-results',
  workers: 1,
  retries: 0,
  timeout: 1_800_000,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    serviceWorkers: 'block',
    ...(process.env.FNT_CHROMIUM_EXECUTABLE
      ? { launchOptions: { executablePath: process.env.FNT_CHROMIUM_EXECUTABLE } }
      : {}),
    // A review step that cannot act should fail and say where, not hang the run.
    actionTimeout: 30_000,
  },
  projects: [
    {
      name: 'desktop-canvas',
      use: { viewport: desktop, deviceScaleFactor: 1, video: { mode: 'on', size: desktop } },
      metadata: { renderer: 'canvas' },
    },
    {
      name: 'desktop-webgl',
      use: { viewport: desktop, deviceScaleFactor: 1, video: { mode: 'on', size: desktop } },
      metadata: { renderer: 'webgl' },
    },
    {
      name: 'ipad-canvas',
      use: {
        viewport: ipad,
        deviceScaleFactor: 2,
        hasTouch: true,
        video: { mode: 'on', size: ipad },
      },
      metadata: { renderer: 'canvas' },
    },
    {
      name: 'ipad-webgl',
      use: {
        viewport: ipad,
        deviceScaleFactor: 2,
        hasTouch: true,
        video: { mode: 'on', size: ipad },
      },
      metadata: { renderer: 'webgl' },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
