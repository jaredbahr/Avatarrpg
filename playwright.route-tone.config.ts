import { defineConfig } from '@playwright/test';

/**
 * The route tone review. `FNT_RT_TAG` names the folder the frames land in, so
 * the same probe runs on the head before and the head after a palette change;
 * `FNT_RT_RENDERER` picks the backend and `FNT_RT_NODES` the boards.
 *
 * The port is per-run rather than shared with the other review configs, so a
 * dev server left up by another worktree is never reused by mistake.
 */
const PORT = process.env.FNT_RT_PORT ?? '4291';
const URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: 'route-tone.review.ts',
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: URL,
    viewport: { width: 1368, height: 912 },
    serviceWorkers: 'block',
    launchOptions: process.env.FNT_REVIEW_BROWSER_CHANNEL
      ? { channel: process.env.FNT_REVIEW_BROWSER_CHANNEL }
      : {},
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: URL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
