import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { BA_DAN_EDGE_WATER } from '../../src/content/scenes/baDan';
import { BA_DAN_VILLAGE } from '../../src/content/maps/village';
import { pixelAt } from './lib/image';
import { decodeWebp } from './lib/webp';
import { packWater, shippedPath } from './ba-dan-water';
import { APRON_FADE, apronAlpha, apronDepth } from './ba-dan-exterior-apron';
import { FILM, packEdgePage, waterMetric } from './ba-dan-edges';
import { BA_DAN_FORD_STONES } from './ba-dan-edge-data';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const page = packEdgePage();
const pieces = new Map(BA_DAN_EDGE_WATER.map((piece) => [piece.id, piece]));

/** The packed page's pixel at a logical ground point of one edge piece. */
function at(id: 'west-ford', x: number, y: number): number[] {
  const piece = pieces.get(id);
  if (!piece) throw new Error(`Missing ${id}`);
  const wx = Math.floor(1024 + (x - y) * 64) - piece.x;
  const wy = Math.floor((x + y) * 32) - piece.y;
  if (wx < 0 || wy < 0 || wx >= piece.width || wy >= piece.height)
    throw new Error(`${x},${y} is outside ${id}`);
  return pixelAt(page, piece.source.x + wx, piece.source.y + wy);
}

const luma = (c: readonly number[]): number =>
  0.299 * (c[0] ?? 0) + 0.587 * (c[1] ?? 0) + 0.114 * (c[2] ?? 0);
/** Blue over red: the film's cast. The paving it lies on is warm. */
const cool = (c: readonly number[]): number => (c[2] ?? 0) - (c[0] ?? 0);

describe('Ba Dan edge water (reference footprint and shipped page)', () => {
  it('ships the painted page on exactly the reference footprint, with no baked film', async () => {
    const shipped = await decodeWebp(readFileSync(shippedPath('edge-water')));
    expect({ width: shipped.width, height: shipped.height }).toEqual({
      width: page.width,
      height: page.height,
    });
    // The master is packed by encode alone; the shipped file is that encode.
    expect(Buffer.from(await packWater('edge-water'))).toEqual(
      readFileSync(shippedPath('edge-water')),
    );
    let alphaMismatch = 0;
    let filmed = 0;
    let water = 0;
    let coolOutside = 0;
    for (const piece of BA_DAN_EDGE_WATER)
      for (let py = 0; py < piece.height; py++)
        for (let px = 0; px < piece.width; px++) {
          const sx = piece.source.x + px;
          const sy = piece.source.y + py;
          const want = pixelAt(page, sx, sy);
          const got = pixelAt(shipped, sx, sy);
          if (want[3] !== got[3]) alphaMismatch++;
          // The footprint is the geometry, not a colour: it used to be counted as
          // "blue over red", which depends on how bright the paving under the
          // shallows is, so a repainted ground moved four shallow water pixels
          // across that threshold and the count with it. Cool pixels outside the
          // metric would be paving or kerb the film had leaked onto.
          const dx = (piece.x + px + 0.5 - 1024) / 64;
          const dy = (piece.y + py + 0.5) / 32;
          const inWater = waterMetric((dx + dy) / 2, (dy - dx) / 2, piece.cells) <= 1;
          if (want[3] === 255 && !inWater && cool(want) > 0) coolOutside++;
          // Where the reference holds film over water, the painted page must not be
          // the flat film colour: #3e8fb0 within a few levels is the old wash.
          if (want[3] === 255 && inWater) {
            water++;
            if (
              Math.abs((got[0] ?? 0) - FILM.colour[0]) < 6 &&
              Math.abs((got[1] ?? 0) - FILM.colour[1]) < 6 &&
              Math.abs((got[2] ?? 0) - FILM.colour[2]) < 6
            )
              filmed++;
          }
        }
    // This loop measures the registered west-ford piece only. The accepted
    // long channel occupies the page's separate upper sourceRect and is held
    // byte-for-byte by packWater above; 40k described that retired combined
    // footprint, not this piece's geometric reference.
    // The ford's footprint inherits the apron's solid band, which now runs to the
    // margin's low bank (`APRON_BANK_MIN`..`MAX`) instead of fading out in steps
    // from half a tile, so more of the piece is opaque water than the 13,504 the
    // stepped fade left. The bank's outer edge now carries hedge crowns
    // (`apronBank` in `ba-dan-exterior-apron.ts`), a tenth-of-a-tile wobble that
    // moved the count from 23,279 to 23,260. The film/alpha/cool-outside
    // assertions below are unchanged.
    expect(water).toBe(23_260);
    expect({ alphaMismatch, filmed, coolOutside }).toEqual({
      alphaMismatch: 0,
      filmed: 0,
      coolOutside: 0,
    });
  });

  it('floods the two ford cells, where the road now ends', () => {
    for (const y of [7, 8]) {
      expect(BA_DAN_VILLAGE.rows[y]?.[0]).toBe('W');
      const water = at('west-ford', 0.5, y + 0.5);
      expect(water[3], `ford (0,${y}) is opaque on the board`).toBe(255);
      expect(cool(water), `ford (0,${y}) carries the film`).toBeGreaterThan(0);
      // The road's next cell is paving again, left to the ground beneath.
      expect(at('west-ford', 1.6, y + 0.5)[3]).toBe(0);
    }
    // The film is the renderer's: #3e8fb0 at its two coats' combined strength.
    expect(FILM.colour).toEqual([0x3e, 0x8f, 0xb0]);
    expect(FILM.alpha).toBeCloseTo(0.3616, 4);
  });

  it('draws the drowned stepping stones lighter than the water round them', () => {
    for (const stone of BA_DAN_FORD_STONES) {
      const top = at('west-ford', stone.x, stone.y);
      const beside = at('west-ford', stone.x + 0.3, stone.y);
      expect(top[3]).toBeGreaterThan(0);
      expect(luma(top), `stone at ${stone.x},${stone.y}`).toBeGreaterThan(luma(beside) + 12);
      // Still under water: the film's cast is on the stone too.
      expect(cool(top)).toBeGreaterThan(-60);
    }
  });

  it('runs the ford on past the rim into the apron fade, never past it', () => {
    for (const x of [-0.6, -1.2, -1.8]) {
      const pixel = at('west-ford', x, 7.5);
      const depth = apronDepth(x, 7.5);
      expect(pixel[3], `ford at ${x}`).toBeGreaterThan(0);
      expect(pixel[3]).toBeLessThanOrEqual(apronAlpha(depth, x, 7.5));
    }
    // No painted pixel of either piece lies past the fade.
    let beyond = 0;
    for (const piece of BA_DAN_EDGE_WATER)
      for (let py = 0; py < piece.height; py++)
        for (let px = 0; px < piece.width; px++) {
          if (pixelAt(page, piece.source.x + px, piece.source.y + py)[3] === 0) continue;
          const dx = (piece.x + px + 0.5 - 1024) / 64;
          const dy = (piece.y + py + 0.5) / 32;
          if (apronDepth((dx + dy) / 2, (dy - dx) / 2) >= APRON_FADE) beyond++;
        }
    expect(beyond).toBe(0);
  });

  it('measures water with the courtyard canal metric', () => {
    const cells = [{ x: 0, y: 0 }];
    expect(waterMetric(0.5, 0.5, cells)).toBe(0);
    expect(waterMetric(1, 0.5, cells)).toBe(1);
    expect(waterMetric(0.5, 1.21, cells)).toBeCloseTo(1.42, 5);
  });
});
