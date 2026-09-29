/**
 * Captures the dev bend harness (`dev/bend-fx.html`, ADR 0055 steps 5 and 6)
 * on both backends, for review against the approved prototype.
 *
 * Usage:
 *   node --import tsx scripts/bend-fx-capture.ts <out-dir> [port] [elements]
 *
 * Starts a Vite dev server in this process on `port` (default 4347), drives
 * Chromium through every element at range 3 and 5, thrown south-east (a grid
 * axis), east (a grid diagonal), west and north-west, on Canvas 2D and forced
 * WebGL, and plays the whole choreography: the character on the freeze
 * clock, the painted effect, every hold and the board kick. It writes a frame
 * every 40 ms of scene time from the start until everything is done, plus one
 * in the middle of every hold, to
 * `<out-dir>/<renderer>/<element>-<range>-<dir>/NNN.png`, with a `timing.json`
 * beside them giving each frame's scene time, the character's cel and whether
 * it is held, and the holds and landings. The server and the browser are
 * closed whatever happens, so nothing is left listening. `elements`, a
 * comma list, captures only those (all three by default).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

interface Harness {
  backend: string;
  heading: string;
  duration: number;
  holds: { at: number; ms: number }[];
  arrivals: (number | null)[];
  draw(t: number): { sprites: number; flipped: number; index: number; held: boolean };
  crop(): { x: number; y: number; width: number; height: number };
}
type HarnessWindow = { bendFx: Promise<Harness> };

const out = process.argv[2];
if (!out) throw new Error('Usage: bend-fx-capture.ts <out-dir> [port]');
const port = Number(process.argv[3] ?? 4347);
const only = process.argv[4]?.split(',');
const CADENCE = 40;

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
        if (only && !only.includes(element)) continue;
        for (const range of [3, 5]) {
          for (const dir of ['southEast', 'east', 'west', 'northWest'] as const) {
            const query = `element=${element}&range=${range}&dir=${dir}&renderer=${renderer}`;
            await page.goto(`http://127.0.0.1:${port}/dev/bend-fx.html?${query}`);
            const info = await page.evaluate(async () => {
              const h = await (window as unknown as HarnessWindow).bendFx;
              return {
                backend: h.backend,
                heading: h.heading,
                duration: h.duration,
                holds: h.holds,
                arrivals: h.arrivals,
                crop: h.crop(),
              };
            });
            if (info.backend !== renderer) throw new Error(`${query} drew on ${info.backend}.`);
            const folder = join(out, renderer, `${element}-${range}-${dir}`);
            mkdirSync(folder, { recursive: true });
            const times = new Set<number>();
            for (let t = 0; t <= info.duration + CADENCE; t += CADENCE) times.add(t);
            for (const hold of info.holds) times.add(Math.round((hold.at + hold.ms / 2) * 10) / 10);
            const frames: {
              t: number;
              index: number;
              held: boolean;
              sprites: number;
              flipped: number;
            }[] = [];
            for (const [n, t] of [...times].sort((a, b) => a - b).entries()) {
              let state = { sprites: 0, flipped: 0, index: -1, held: false };
              // Twice across two frames: Pixi draws once its renderer is up.
              for (let pass = 0; pass < 2; pass++) {
                state = await page.evaluate(async (at) => {
                  const h = await (window as unknown as HarnessWindow).bendFx;
                  const drawn = h.draw(at);
                  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
                  return drawn;
                }, t);
              }
              await page.screenshot({
                path: join(folder, `${String(n).padStart(3, '0')}.png`),
                clip: info.crop,
              });
              frames.push({ t, ...state });
            }
            writeFileSync(
              join(folder, 'timing.json'),
              JSON.stringify({ ...info, frames }, null, 2),
            );
            console.log(`${renderer} ${element} ${range} ${dir}: ${frames.length} frames`);
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
