import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import type { GalleryOptions } from './e2e/gallery/fixtures';

/**
 * The screenshot gallery: `npm run gallery`.
 *
 * Same production build and preview server as the e2e suite, Chromium only,
 * because stills do not need WebKit. Four projects: the Surface at 1x, the
 * iPad at 2x on both backends, and the iPad held upright for the beats that
 * care about a stacked HUD. Output goes to `gallery/`, which is gitignored
 * and published as a CI artefact and beside the site on Pages.
 */

const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath = existsSync(PREINSTALLED_CHROMIUM) ? PREINSTALLED_CHROMIUM : undefined;
const launchOptions = executablePath ? { executablePath } : {};

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
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    renderer: 'canvas',
  },
  projects: [
    {
      name: 'surface-canvas',
      use: { ...chromium, viewport: { width: 1368, height: 912 } },
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
    command: 'npm run build && npm run preview -- --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
