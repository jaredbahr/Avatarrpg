import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Dev containers ship a Chromium that may not match the revision this
 * Playwright expects. Point at it when it is there; in CI, where
 * `playwright install` has run, fall through to the bundled browser.
 */
const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath = existsSync(PREINSTALLED_CHROMIUM) ? PREINSTALLED_CHROMIUM : undefined;

/**
 * WebKit is what an iPad runs, and it is not in the dev container (never run
 * `playwright install` there). The iPad projects therefore run in CI, where
 * the workflow installs WebKit, and locally only when FNT_E2E_WEBKIT=1 says a
 * WebKit build is present. Playwright's WebKit is the engine, not Safari:
 * Home Screen install and iPadOS orientation quirks stay on the manual
 * checklist in docs/device-matrix.md.
 */
const WEBKIT = Boolean(process.env.CI) || process.env.FNT_E2E_WEBKIT === '1';

/**
 * FNT_E2E_VIEWPORT=1194x834 runs the Chromium project at another size, which
 * is how a height-limited iPad layout is reproduced in the dev container
 * without WebKit.
 */
const viewportOverride = /^(\d+)x(\d+)$/.exec(process.env.FNT_E2E_VIEWPORT ?? '');
const SURFACE_VIEWPORT = viewportOverride
  ? { width: Number(viewportOverride[1]), height: Number(viewportOverride[2]) }
  : { width: 1368, height: 912 };

/**
 * The container ships Chromium at PLAYWRIGHT_BROWSERS_PATH; never run
 * `playwright install` here. Tests run against the *production* build so the
 * service worker and the PWA manifest are exercised the same way the Surface
 * will see them.
 */
export default defineConfig({
  testDir: './e2e',
  // The screenshot gallery has its own config and its own npm script.
  testIgnore: /e2e\/gallery\//,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // Publish a diagnostic report promptly after a reproducible failure.
  // A successful run still executes the complete suite.
  maxFailures: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'surface-touch',
      use: {
        ...devices['Desktop Chrome'],
        // Approximates the Surface in landscape: touch-only, no mouse hover.
        hasTouch: true,
        isMobile: false,
        viewport: SURFACE_VIEWPORT,
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
    ...(WEBKIT
      ? [
          {
            // An iPad in landscape: WebKit, touch, DPR 2. The whole suite bar
            // the service-worker spec, which Playwright supports in Chromium only.
            name: 'ipad-landscape',
            use: { ...devices['iPad Pro 11 landscape'] },
            testIgnore: /offline\.spec\.ts/,
          },
          {
            // Held upright: the board no longer fits at fingertip size, so the
            // camera's tappable-tile rule and the stacked HUD are what is tested.
            name: 'ipad-portrait',
            use: { ...devices['iPad Pro 11'] },
            testMatch: /(touch|gestures)\.spec\.ts/,
          },
        ]
      : []),
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
