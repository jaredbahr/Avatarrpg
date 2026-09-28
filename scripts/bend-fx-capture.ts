/**
 * Captures the dev bend effect harness (`dev/bend-fx.html`, ADR 0055 step 5)
 * frame by frame on both backends, for review against the approved prototype.
 *
 * Usage:
 *   node --import tsx scripts/bend-fx-capture.ts <out-dir> [port]
 *
 * Starts a Vite dev server in this process on `port` (default 4347), drives
 * Chromium through every element at range 3 and 5, cardinal and diagonal, on
 * Canvas 2D and forced WebGL, and writes each bend cel's frame, taken 1 ms
 * after the cel starts, then one every 80 ms after the bend until the effect
 * has finished (a long throw lands after the bend), to `<out-dir>/<renderer>/<element>-<range>-<dir>/NN.png`,
 * and the same frame without the effects to `NN-bare.png`, with a
 * `timing.json` beside them. The server and the browser are closed
 * whatever happens, so nothing is left listening.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

interface Harness {
  backend: string;
  frames: number[];
  frameMs: number[];
  draw(t: number, effects?: boolean): number;
  crop(): { x: number; y: number; width: number; height: number };
}
type HarnessWindow = { bendFx: Promise<Harness> };

const out = process.argv[2];
if (!out) throw new Error('Usage: bend-fx-capture.ts <out-dir> [port]');
const port = Number(process.argv[3] ?? 4347);

const server = await createServer({
  logLevel: 'warn',
  server: { port, strictPort: true, host: '127.0.0.1' },
});
try {
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const renderer of ['canvas', 'webgl'] as const) {
      for (const element of ['fire', 'earth', 'water'] as const) {
        for (const range of [3, 5]) {
          for (const dir of ['cardinal', 'diagonal'] as const) {
            const query = `element=${element}&range=${range}&dir=${dir}&renderer=${renderer}`;
            await page.goto(`http://127.0.0.1:${port}/dev/bend-fx.html?${query}`);
            const info = await page.evaluate(async () => {
              const h = await (window as unknown as HarnessWindow).bendFx;
              return { backend: h.backend, frames: h.frames, frameMs: h.frameMs, crop: h.crop() };
            });
            if (info.backend !== renderer) throw new Error(`${query} drew on ${info.backend}.`);
            const folder = join(out, renderer, `${element}-${range}-${dir}`);
            mkdirSync(folder, { recursive: true });
            // One frame a bend cel, then every 80 ms past the last until the
            // effect is done: a long throw lands after the bend has ended.
            const end = (info.frames.at(-1) ?? 0) + (info.frameMs.at(-1) ?? 0);
            const times = info.frames.map((start) => start + 1);
            for (let index = 0; ; index++) {
              const t = times[index] ?? end + 1 + (index - info.frames.length) * 80;
              if (index >= info.frames.length && (t > end + 4000 || index > 60)) break;
              if (index >= times.length) times.push(t);
              let drawn = 0;
              // With the effects, then without, for an effect-only difference.
              for (const effects of [true, false]) {
                // Twice across two frames: Pixi draws once its renderer is up.
                for (let pass = 0; pass < 2; pass++) {
                  const count = await page.evaluate(
                    async ([at, fx]) => {
                      const h = await (window as unknown as HarnessWindow).bendFx;
                      const n = h.draw(at, fx);
                      await new Promise((r) =>
                        requestAnimationFrame(() => requestAnimationFrame(r)),
                      );
                      return n;
                    },
                    [t, effects] as const,
                  );
                  if (effects) drawn = count;
                }
                const name = `${String(index).padStart(2, '0')}${effects ? '' : '-bare'}.png`;
                await page.screenshot({ path: join(folder, name), clip: info.crop });
              }
              if (index >= info.frames.length && drawn === 0) break;
            }
            writeFileSync(join(folder, 'timing.json'), JSON.stringify({ ...info, times }, null, 2));
            console.log(`${renderer} ${element} ${range} ${dir}: ${times.length} frames`);
          }
        }
      }
    }
    if (errors.length > 0) throw new Error(`Page errors:\n${errors.join('\n')}`);
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}
