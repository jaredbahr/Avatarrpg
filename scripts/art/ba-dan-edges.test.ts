import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BA_DAN_EDGE_WATER, BA_DAN_FORD_STONES } from '../../src/content/scenes/baDan';
import { BA_DAN_VILLAGE } from '../../src/content/maps/village';
import { pixelAt } from './lib/image';
import { decodeWebp } from './lib/webp';
import { packWater, shippedPath } from './ba-dan-water';
import { APRON_FADE, apronAlpha, apronDepth } from './ba-dan-exterior-apron';
import { FILM, packEdgePage, waterMetric } from './ba-dan-edges';

const page = packEdgePage();
const pieces = new Map(BA_DAN_EDGE_WATER.map((piece) => [piece.id, piece]));

/** The packed page's pixel at a logical ground point of one edge piece. */
function at(id: 'west-ford' | 'south-canal', x: number, y: number): number[] {
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
    for (const piece of BA_DAN_EDGE_WATER)
      for (let py = 0; py < piece.height; py++)
        for (let px = 0; px < piece.width; px++) {
          const sx = piece.source.x + px;
          const sy = piece.source.y + py;
          const want = pixelAt(page, sx, sy);
          const got = pixelAt(shipped, sx, sy);
          if (want[3] !== got[3]) alphaMismatch++;
          // Where the reference holds film over water, the painted page must not be
          // the flat film colour: #3e8fb0 within a few levels is the old wash.
          if (want[3] === 255 && cool(want) > 0) {
            water++;
            if (
              Math.abs((got[0] ?? 0) - FILM.colour[0]) < 6 &&
              Math.abs((got[1] ?? 0) - FILM.colour[1]) < 6 &&
              Math.abs((got[2] ?? 0) - FILM.colour[2]) < 6
            )
              filmed++;
          }
        }
    expect(water).toBeGreaterThan(40_000);
    expect({ alphaMismatch, filmed }).toEqual({ alphaMismatch: 0, filmed: 0 });
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

  it('lays the south canal just outside the open lawn, kerbed at both ends', () => {
    const canal = pieces.get('south-canal');
    if (!canal) throw new Error('Missing the south canal');
    // Its water row is off the board, below the lawn x4..17 the edge band covers.
    expect(canal.cells.every((cell) => cell.y === BA_DAN_VILLAGE.height)).toBe(true);
    expect(canal.cells.map((cell) => cell.x)).toEqual(Array.from({ length: 14 }, (_, i) => 4 + i));
    for (const x of [4.5, 10.5, 17.5]) {
      const water = at('south-canal', x, 16.3);
      expect(water[3], `canal at ${x}`).toBeGreaterThan(0);
      expect(cool(water), `canal at ${x} carries the film`).toBeGreaterThan(0);
      // The lawn cell's middle stays the garden's: only the kerb's lip reaches in.
      expect(at('south-canal', x, 15.5)[3]).toBe(0);
    }
    // The kerb is on the rim, and dry stone, not water.
    const kerb = at('south-canal', 10.5, 15.93);
    expect(kerb[3]).toBe(255);
    expect(cool(kerb)).toBeLessThan(0);
    // Nothing reaches the rim trees' cells beyond either end.
    expect(at('south-canal', 3.3, 16.5)[3]).toBe(0);
    expect(at('south-canal', 18.7, 16.5)[3]).toBe(0);
  });

  it('measures water with the courtyard canal metric', () => {
    const cells = [{ x: 0, y: 0 }];
    expect(waterMetric(0.5, 0.5, cells)).toBe(0);
    expect(waterMetric(1, 0.5, cells)).toBe(1);
    expect(waterMetric(0.5, 1.21, cells)).toBeCloseTo(1.42, 5);
  });
});
