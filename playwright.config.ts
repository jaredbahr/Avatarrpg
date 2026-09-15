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
 * The container ships Chromium at PLAYWRIGHT_BROWSERS_PATH; never run
 * `playwright install` here. Tests run against the *production* build so the
 * service worker and the PWA manifest are exercised the same way the Surface
 * will see them.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
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
        viewport: { width: 1368, height: 912 },
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
