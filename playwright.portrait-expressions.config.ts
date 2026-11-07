import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'portrait-expressions.review.ts',
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:45399', serviceWorkers: 'block' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1368, height: 912 } },
    },
    { name: 'ipad-portrait', use: { ...devices['iPad Pro 11'] } },
  ],
  // Run after ci:local builds this exact checkout. Never reuse another task's server.
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 45399 --strictPort',
    url: 'http://127.0.0.1:45399',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
