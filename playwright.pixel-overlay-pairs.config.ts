import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/** The same review test runs against the exact old and new production builds. */
const appRoot = resolve(process.env.FNT_PIXEL_CAPTURE_APP_ROOT ?? process.cwd());
const port = Number(process.env.FNT_PIXEL_CAPTURE_PORT ?? 4381);
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('Invalid capture port');
const origin = `http://127.0.0.1:${port}`;
const chromium = ['/opt/pw-browsers/chromium', '/usr/bin/chromium'].find((path) =>
  existsSync(path),
);
// Use only after an exact-head production build has a recorded exit-0 receipt.
const built = process.env.FNT_PIXEL_CAPTURE_SKIP_BUILD === '1';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'pixel-overlay-pairs.review.ts',
  outputDir: '.shots/pixel-overlay-pairs/test-results',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: origin,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    hasTouch: true,
    launchOptions: chromium ? { executablePath: chromium } : {},
  },
  webServer: {
    command: `${built ? '' : 'npm run build && '}npm run preview -- --host 127.0.0.1 --port ${port}`,
    cwd: appRoot,
    url: origin,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
