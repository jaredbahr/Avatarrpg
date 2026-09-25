import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import type { GalleryOptions } from './e2e/gallery/fixtures';

/**
 * The screenshot gallery: `npm run gallery`.
 *
 * Same production build and preview server as the e2e suite, Chromium only,
 * because stills do not need WebKit. Five projects: the Surface at 1x on both
 * backends (the filmstrips live here, cheap enough for software GL), the iPad
 * at 2x on both backends for stills, and the iPad held upright for the beats
 * that care about a stacked HUD. Output goes to `gallery/`, which is
 * gitignored and published as a CI artefact and beside the site on Pages.
 */

const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath = existsSync(PREINSTALLED_CHROMIUM) ? PREINSTALLED_CHROMIUM : undefined;
const launchOptions = executablePath ? { executablePath } : {};

/**
 * The same preview server and the same trap as the e2e suite: outside CI this
 * config reuses a server already listening on the port, so the gallery moves
 * with FNT_E2E_PORT too (see playwright.config.ts).
 */
const configuredPort = process.env.FNT_E2E_PORT ?? '4173';
if (!/^\d+$/.test(configuredPort) || Number(configuredPort) < 1 || Number(configuredPort) > 65535) {
  throw new Error(
    `FNT_E2E_PORT must be an integer port between 1 and 65535, got ${JSON.stringify(
      process.env.FNT_E2E_PORT,
    )}.`,
  );
}
const PORT = Number(configuredPort);
const ORIGIN = `http://127.0.0.1:${PORT}`;

const chromium = {
  ...devices['Desktop Chrome'],
  hasTouch: true,
  isMobile: false,
  launchOptions,
};

export default defineConfig<GalleryOptions>({
  testDir: './e2e/gallery',
  // Software GL in CI renders a frame in a sixth of a second; a filmstrip is dozens of frames.
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: ORIGIN,
    trace: 'retain-on-failure',
    renderer: 'canvas',
  },
  projects: [
    {
      name: 'surface-canvas',
      use: { ...chromium, viewport: { width: 1368, height: 912 } },
    },
    {
      name: 'surface-webgl',
      use: { ...chromium, viewport: { width: 1368, height: 912 }, renderer: 'webgl' },
    },
    {
      name: 'ipad-canvas',
      use: { ...chromium, viewport: { width: 1194, height: 834 }, deviceScaleFactor: 2 },
    },
    {
      name: 'ipad-webgl',
      use: {
        ...chromium,
        viewport: { width: 1194, height: 834 },
        deviceScaleFactor: 2,
        renderer: 'webgl',
      },
    },
    {
      name: 'portrait-canvas',
      use: { ...chromium, viewport: { width: 834, height: 1194 }, deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --host 127.0.0.1`,
    url: ORIGIN,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
