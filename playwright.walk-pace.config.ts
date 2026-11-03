import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
import repositoryConfig from './playwright.config';

const port = Number(process.env.FNT_E2E_PORT ?? '4383');
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  ...repositoryConfig,
  testMatch: ['walk-pace.review.ts'],
  outputDir: './test-results/walk-pace-383',
  workers: 1,
  retries: 0,
  projects: repositoryConfig.projects
    ?.filter((project) => project.name === 'surface-touch')
    .map((project) => ({
      ...project,
      use: {
        ...project.use,
        deviceScaleFactor: 1,
        launchOptions: existsSync('/usr/bin/chromium')
          ? { ...project.use?.launchOptions, executablePath: '/usr/bin/chromium' }
          : project.use?.launchOptions,
      },
    })),
  use: {
    ...repositoryConfig.use,
    baseURL,
    video: { mode: 'on', size: { width: 1368, height: 912 } },
  },
  webServer: {
    command: `npm run build && npm run preview -- --strictPort --port ${port} --host 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
