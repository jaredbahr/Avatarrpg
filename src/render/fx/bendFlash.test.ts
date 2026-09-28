/**
 * The bend flash is the prototype's `ImageEnhance.Brightness(1.75)` (ADR
 * 0055): the cel added onto itself at 0.75, colour times 1.75, alpha kept.
 *
 * The fixtures are Pillow's own output (12.3.0) on two shipped cels, the fire
 * launch and the water splash, written by `bend-draw-review/flash_fixture.py`
 * from the same WebP page. Both backends draw a flashed cel from
 * `brighten`'s copy (`bendFxSource`), so this compares the two pixel for pixel.
 * The splash is the hard case: painted at 224 and saturated, it is where an
 * additive redraw, which adds before it clamps, parts from Pillow.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readPng } from '../../../scripts/art/lib/image';
import { decodeWebp } from '../../../scripts/art/lib/webp';
import { parseBendFxPage } from './bendFx';
import { brighten } from './bendFlash';

const PAGE = 'art/fx/bend-fx.json';
const cels = parseBendFxPage(readFileSync(join('public', PAGE), 'utf8'), PAGE);

async function cel(name: string): Promise<Uint8ClampedArray> {
  const found = cels.get(name);
  if (!found) throw new Error(name);
  const page = await decodeWebp(new Uint8Array(readFileSync(join('public', found.image))));
  const { x, y, w, h } = found.frame;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    const start = ((y + row) * page.width + x) * 4;
    out.set(page.data.subarray(start, start + w * 4), row * w * 4);
  }
  return out;
}

/** The largest channel difference, and how many channels differ at all. */
function difference(a: Uint8ClampedArray, b: ArrayLike<number>) {
  let worst = 0;
  let differ = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs((a[i] ?? 0) - (b[i] ?? 0));
    worst = Math.max(worst, d);
    if (d > 0) differ++;
  }
  return { worst, differ };
}

describe('the bend flash', () => {
  for (const [name, fixture] of [
    ['fx.fire.fireball/jab-launch/0', 'bendFlash.jab-launch.png'],
    ['fx.water.bolt/splash/0', 'bendFlash.splash.png'],
  ] as const) {
    it(`matches Pillow's Brightness(1.75) on ${name}`, async () => {
      const pixels = await cel(name);
      const pillow = readPng(join('src/render/fx', fixture));
      expect(pillow.data.length).toBe(pixels.length);
      // Unflashed, the fixture is far off, so the comparison can tell.
      expect(difference(pixels, pillow.data).worst).toBeGreaterThan(40);
      brighten(pixels, 0.75);
      expect(difference(pixels, pillow.data)).toEqual({ worst: 0, differ: 0 });
    });
  }

  it('clamps each channel and keeps the alpha', () => {
    const px = new Uint8ClampedArray([200, 100, 10, 77, 0, 0, 0, 0]);
    brighten(px, 0.75);
    expect([...px]).toEqual([255, 175, 17, 77, 0, 0, 0, 0]);
  });
});
