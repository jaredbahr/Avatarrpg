/**
 * Measures and records the 2D art-direction test (`dev/style-test-2d.html`, docs/style-test/).
 *
 * Usage:
 *   node --import tsx scripts/style-test-2d-capture.ts <out-dir> [port] [perf|video|frames]
 *
 * Starts a Vite dev server in this process on `port` (default 5399), drives Chromium, and closes
 * both whatever happens. `perf` plays the scene on each backend at 1366x1024 (idle, a walk, two
 * strikes) and writes `perf.json` (frame times, asset bytes); `video` records a 40 s scripted play at
 * 1366x1024 to `play.webm`; `frames` writes screenshots of a strike at both tablet sizes.
 */

import { mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createServer } from 'vite';

interface Cell {
  x: number;
  y: number;
}
interface Test {
  backend: string;
  screenOf(c: Cell): { x: number; y: number };
  walkTo(c: Cell): boolean;
  strike(): boolean;
  pos(): Cell;
  busy(): boolean;
  strikes(): number;
  stats(): { frames: number[]; strikeFrames: number[] };
  resetStats(): void;
}
type TestWindow = { styleTest: Promise<Test> };

const out = process.argv[2];
if (!out) throw new Error('Usage: style-test-2d-capture.ts <out-dir> [port] [mode]');
const port = Number(process.argv[3] ?? 5399);
const mode = process.argv[4] ?? 'perf';
mkdirSync(out, { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const call = <T>(page: Page, fn: (t: Test) => T) =>
  page.evaluate(async (src) => {
    const t = await (window as unknown as TestWindow).styleTest;
    return new Function('t', `return (${src})(t)`)(t);
  }, fn.toString()) as Promise<Awaited<T>>;

async function idle(page: Page) {
  while (await call(page, (t) => t.busy())) await sleep(60);
}

/** Tap a cell the way a player would: at its centre on the canvas. */
async function tap(page: Page, c: Cell) {
  const at = (await page.evaluate(
    async (cell) => (await (window as unknown as TestWindow).styleTest).screenOf(cell),
    c,
  )) as { x: number; y: number };
  await page.mouse.click(at.x, at.y);
}

const summarise = (ms: number[]) => {
  const sorted = [...ms].sort((a, b) => a - b);
  const mean = ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length);
  const q = (f: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))] ?? 0;
  return {
    frames: ms.length,
    meanMs: +mean.toFixed(2),
    fps: +(1000 / mean).toFixed(1),
    p95Ms: +q(0.95).toFixed(2),
    maxMs: +(sorted[sorted.length - 1] ?? 0).toFixed(2),
  };
};

const server = await createServer({
  logLevel: 'warn',
  server: { port, strictPort: true, host: '127.0.0.1' },
});
try {
  await server.listen();
  // STYLE_TEST_GPU=1 asks Chromium for the machine's real GPU instead of the headless software rasteriser.
  const browser = await chromium.launch(
    process.env.STYLE_TEST_GPU
      ? {
          args: [
            '--use-angle=d3d11',
            '--ignore-gpu-blocklist',
            '--enable-gpu-rasterization',
            '--enable-webgl',
          ],
        }
      : {},
  );
  try {
    const url = (r: string, extra = '') =>
      `http://localhost:${port}/dev/style-test-2d.html?renderer=${r}${extra}`;

    if (mode === 'perf') {
      const result: Record<string, unknown> = {};
      for (const renderer of ['canvas', 'webgl']) {
        const page = await browser.newPage({ viewport: { width: 1366, height: 1024 } });
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        const bytes: Record<string, number> = {};
        page.on('response', async (res) => {
          try {
            const body = await res.body();
            const type = res.url().split('?')[0]!.split('.').pop() ?? 'other';
            bytes[type] = (bytes[type] ?? 0) + body.length;
          } catch {
            /* redirected or aborted */
          }
        });
        await page.goto(url(renderer), { timeout: 180000 });
        await call(page, (t) => t.backend);
        await sleep(4000);
        await call(page, (t) => t.resetStats());
        await sleep(5000);
        const idleStats = await call(page, (t) => t.stats().frames);
        await call(page, (t) => t.resetStats());
        await call(page, (t) => t.walkTo({ x: 8, y: 8 }));
        await idle(page);
        const walkStats = await call(page, (t) => t.stats().frames);
        await call(page, (t) => t.walkTo({ x: 9, y: 7 }));
        await idle(page);
        await call(page, (t) => t.resetStats());
        await call(page, (t) => t.strike());
        await idle(page);
        await sleep(600);
        await call(page, (t) => t.walkTo({ x: 3, y: 7 }));
        await idle(page);
        await call(page, (t) => t.strike());
        await idle(page);
        const strike = await call(page, (t) => t.stats().strikeFrames);
        result[renderer] = {
          backend: await call(page, (t) => t.backend),
          idle: summarise(idleStats),
          walk: summarise(walkStats),
          strike: summarise(strike),
          bytesByType: bytes,
          errors,
        };
        await page.close();
      }
      writeFileSync(join(out, 'perf.json'), JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result, null, 2));
    }

    if (mode === 'video') {
      const renderer = process.argv[5] ?? 'canvas';
      const context = await browser.newContext({
        viewport: { width: 1366, height: 1024 },
        recordVideo: { dir: join(out, 'video-tmp'), size: { width: 1366, height: 1024 } },
      });
      const page = await context.newPage();
      await page.goto(url(renderer), { timeout: 180000 });
      await call(page, (t) => t.backend);
      const began = Date.now();
      await sleep(2500);
      // Walk the court, strike from the west, walk round, strike from the east, wander, strike again.
      const route: Cell[] = [
        { x: 4, y: 8 },
        { x: 7, y: 9 },
        { x: 8, y: 8 },
      ];
      for (const c of route) {
        await tap(page, c);
        await idle(page);
        await sleep(300);
      }
      await tap(page, { x: 3, y: 7 });
      await idle(page);
      await sleep(500);
      await page.keyboard.press('Space');
      await sleep(250);
      await idle(page);
      await sleep(1200);
      for (const c of [
        { x: 5, y: 8 },
        { x: 8, y: 7 },
        { x: 9, y: 7 },
      ]) {
        await tap(page, c);
        await idle(page);
        await sleep(300);
      }
      await sleep(400);
      await page.keyboard.press('Space');
      await sleep(250);
      await idle(page);
      await sleep(1200);
      for (const c of [
        { x: 8, y: 9 },
        { x: 6, y: 9 },
        { x: 3, y: 8 },
        { x: 3, y: 7 },
      ]) {
        await tap(page, c);
        await idle(page);
        await sleep(250);
      }
      await page.keyboard.press('Space');
      await sleep(250);
      await idle(page);
      await sleep(2500);
      console.log(
        'strikes',
        await call(page, (t) => t.strikes()),
        'seconds',
        (Date.now() - began) / 1000,
      );
      await page.close();
      await context.close();
      const file = readdirSync(join(out, 'video-tmp'))[0];
      if (file) renameSync(join(out, 'video-tmp', file), join(out, 'play.webm'));
    }

    if (mode === 'frames') {
      for (const [w, h] of [
        [1366, 1024],
        [1024, 768],
      ] as const) {
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        await page.goto(url('canvas'), { timeout: 180000 });
        await call(page, (t) => t.backend);
        await sleep(2500);
        await page.screenshot({ path: join(out, `rest-${w}.png`) });
        await call(page, (t) => t.strike());
        for (const ms of [450, 250, 250, 250]) {
          await sleep(ms);
          await page.screenshot({
            path: join(out, `strike-${w}-${ms}-${Date.now() % 100000}.png`),
          });
        }
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}
