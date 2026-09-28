import { defineConfig, devices } from '@playwright/test';

/**
 * The quarry props and ink review (`e2e/quarry-props.review.ts`): the iPad and
 * a phone, each on both backends, against the production preview build.
 * FNT_E2E_PORT moves the server as in `playwright.config.ts`.
 */
const PORT = Number(process.env.FNT_E2E_PORT ?? '4311');
const ORIGIN = `http://127.0.0.1:${PORT}`;

const chromium = { ...devices['Desktop Chrome'], hasTouch: true, isMobile: false };
const IPAD = { viewport: { width: 1194, height: 834 }, deviceScaleFactor: 2 };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 };

export default defineConfig({
  testDir: './e2e',
  testMatch: 'quarry-props.review.ts',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: ORIGIN, serviceWorkers: 'block' },
  projects: [
    { name: 'ipad-canvas', use: { ...chromium, ...IPAD } },
    { name: 'ipad-webgl', use: { ...chromium, ...IPAD } },
    { name: 'phone-canvas', use: { ...chromium, ...PHONE } },
    { name: 'phone-webgl', use: { ...chromium, ...PHONE } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --host 127.0.0.1 --strictPort`,
    url: ORIGIN,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
