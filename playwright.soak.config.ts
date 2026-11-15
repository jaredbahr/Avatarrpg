import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

/**
 * The long-session soak (#525, `e2e/long-session.soak.ts`): the demo route played in a loop on
 * both backends, from the production build, counting everything with a lifetime after each cycle.
 * It takes minutes per backend, so it has its own config and `npm run soak:browser`, and runs
 * nightly rather than with the browser suite.
 *
 * The viewport is an iPad in landscape at DPR 2, so canvas pixel areas are the ones the tablet
 * would hold. WebGL here is software and slow; `FNT_SOAK_URL` points the run at a server that is
 * already up (`npm run dev`, for readable stacks with `FNT_SOAK_STACKS=1`).
 */
const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath = existsSync(PREINSTALLED_CHROMIUM) ? PREINSTALLED_CHROMIUM : undefined;
const port = Number(process.env.FNT_E2E_PORT ?? 4391);
const origin = process.env.FNT_SOAK_URL ?? `http://127.0.0.1:${port}`;
const ipad = { width: 1194, height: 834 };

export default defineConfig({
  testDir: './e2e',
  testMatch: 'long-session.soak.ts',
  outputDir: '.shots/soak/test-results',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: origin,
    // The service worker's cache is not what is measured, and its fetches would blur the heap.
    serviceWorkers: 'block',
    viewport: ipad,
    deviceScaleFactor: 2,
    hasTouch: true,
    actionTimeout: 30_000,
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'],
    },
  },
  projects: [
    { name: 'canvas', metadata: { renderer: 'canvas' } },
    { name: 'webgl', metadata: { renderer: 'webgl' } },
  ],
  ...(process.env.FNT_SOAK_URL
    ? {}
    : {
        webServer: {
          command: `npm run build && npm run preview -- --port ${port} --host 127.0.0.1 --strictPort`,
          url: origin,
          reuseExistingServer: !process.env.CI,
          timeout: 240_000,
        },
      }),
});
