import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init } from '@jsquash/webp/decode.js';
import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import { FOREST_WATER_CELLS } from '../../src/content/scenes/forestRoad';
import { readImage, pixelAt } from './lib/image';
import { encodeWebp } from './lib/webp';
import {
  BED_DEPTH,
  BED_SHADE,
  BED_SHELF,
  BED_SOURCE,
  BITE_FEATHER,
  SHORE_BITE,
  SHORE_LIMIT,
  biteDepth,
  packShoreline,
  pondInset,
  SHORE_SOURCE,
  SHORE_OUTPUT,
  shorePosition,
  shoreDistance,
} from './forest-shoreline';

const luminance = (pixel: readonly number[]): number =>
  0.299 * (pixel[0] ?? 0) + 0.587 * (pixel[1] ?? 0) + 0.114 * (pixel[2] ?? 0);

it('ships a reproducible pond whose bank bites in over a bed the water darkens', async () => {
  const { image, bedPixels, deepestShade } = packShoreline(
    readImage(SHORE_SOURCE),
    readImage(BED_SOURCE),
  );
  const packed = readFileSync(SHORE_OUTPUT);
  expect(Buffer.from(await encodeWebp(image, 88, true))).toEqual(packed);
  const require = createRequire(import.meta.url);
  await init(
    await WebAssembly.compile(
      readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm')),
    ),
  );
  const decoded = await decode(
    packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength),
  );
  let missingBank = 0,
    leaks = 0,
    wetBank = 0,
    waterPixels = 0,
    clearWater = 0,
    intruding = 0,
    deepestBite = 0,
    deepBite = 0,
    featherBand = 0;
  /** Mean brightness of the plate's own bands: the dry bank and the bed. */
  const band = {
    bank: { n: 0, sum: 0 },
    shelf: { n: 0, sum: 0 },
    deep: { n: 0, sum: 0 },
    featherOuter: { n: 0, sum: 0 },
    featherInner: { n: 0, sum: 0 },
  };
  const inset = pondInset(image.width, image.height);
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const { x, y } = shorePosition(px, py);
      const distance = shoreDistance(x, y);
      const [r, g, b, alpha] = pixelAt(image, px, py);
      const decodedAlpha = decoded.data[(py * image.width + px) * 4 + 3];
      if (distance > 0 && distance <= 0.08 && decodedAlpha !== 255) missingBank++;
      if (distance >= SHORE_LIMIT && decodedAlpha !== 0) leaks++;
      if (alpha > 0 && b > r + 5 && g > r + 5) wetBank++;
      if (distance > 0 && distance <= 0.06 && alpha === 255) {
        band.bank.n++;
        band.bank.sum += luminance(pixelAt(image, px, py));
      }
      const inside = inset[py * image.width + px] ?? 0;
      if (inside > 0) {
        waterPixels++;
        // The bed is opaque across the whole pond, so the 0.4-alpha water film
        // always tints authored floor rather than bare backdrop.
        if (alpha === 0) clearWater++;
        if (inside >= 0.3 && inside < 0.6) {
          band.shelf.n++;
          band.shelf.sum += luminance(pixelAt(image, px, py));
        }
        if (inside >= 0.9) {
          band.deep.n++;
          band.deep.sum += luminance(pixelAt(image, px, py));
        }
        const depth = biteDepth(x, y);
        if (inside < depth) {
          intruding++;
          // The bank never reaches half a cell in: the middle of every water
          // tile stays water, and the rules' tile is never repainted as dry.
          deepestBite = Math.max(deepestBite, inside);
          if (inside > SHORE_BITE * 0.6) deepBite++;
        }
        /*
         * The bite's inner sliver is feathered: it interpolates from the dry
         * bank's tone at its outer half to the bed's at its inner one, so wet
         * and dry meet in damp silt rather than on a second, ruled line.
         */
        if (inside > depth - BITE_FEATHER && inside < depth) {
          featherBand++;
          const slice =
            (depth - inside) / BITE_FEATHER > 0.6
              ? band.featherOuter
              : (depth - inside) / BITE_FEATHER < 0.4
                ? band.featherInner
                : null;
          if (slice) {
            slice.n++;
            slice.sum += luminance(pixelAt(image, px, py));
          }
        }
      }
    }
  expect({ missingBank, leaks, wetBank }).toEqual({
    missingBank: 0,
    leaks: 0,
    wetBank: 0,
  });
  // Every wet pixel carries the bed: no hole in the pond for the backdrop.
  expect(clearWater).toBe(0);
  expect(bedPixels).toBe(waterPixels);
  expect(deepestBite).toBeLessThanOrEqual(SHORE_BITE);
  // The shore really does come in, and wanders as it does: a uniform ring
  // would leave the pond reading as the rules' own cross.
  expect(intruding).toBeGreaterThan(5_000);
  expect(deepBite).toBeGreaterThan(300);
  /*
   * The pond is still water. A third of the wet pixels carrying authored bank
   * is the most a wandered shore costs on this small a pond: the runtime water
   * layer still covers every one of them, so what the player sees there is
   * shallow wet silt, not dry ground.
   */
  expect(intruding / waterPixels).toBeLessThan(0.35);
  expect(featherBand).toBeGreaterThan(5_000);
  /*
   * The bed is the forest floor, darkened with depth: the shelf under the bank
   * keeps most of the floor's own brightness, the middle of the pond takes
   * `BED_SHADE` of it away, and neither is ever brighter than the dry bank the
   * water is cut into. That gradient is what makes the pond read as water with
   * a bottom instead of a flat teal field.
   */
  const mean = (b: { n: number; sum: number }): number => b.sum / b.n;
  expect(mean(band.shelf)).toBeLessThan(mean(band.bank) * 0.85);
  expect(mean(band.deep)).toBeLessThan(mean(band.shelf) * 0.8);
  expect(mean(band.featherOuter)).toBeGreaterThan(mean(band.featherInner));
  expect(deepestShade).toBeLessThan(BED_SHELF - BED_SHADE * 0.6);
  expect(deepestShade).toBeGreaterThan(0.3);
  expect(BED_DEPTH).toBeGreaterThan(1);
  // Every real water centre carries bed, and muted bed at that: the middle of
  // a tile is never dry bank, and never the brightest thing in the pond.
  for (const { x, y } of FOREST_WATER_CELLS) {
    const px = Math.round((768 + (x - y) * 64 - 560) * 2);
    const py = Math.round(((x + y + 1) * 32 - 304) * 2);
    let clearSamples = 0;
    let brightest = 0;
    for (let oy = -12; oy <= 12; oy++)
      for (let ox = -12; ox <= 12; ox++) {
        const pixel = pixelAt(image, px + ox, py + oy);
        if (pixel[3] === 0) clearSamples++;
        brightest = Math.max(brightest, luminance(pixel));
      }
    expect(clearSamples, `water at ${x},${y}`).toBe(0);
    expect(brightest, `water at ${x},${y}`).toBeLessThan(mean(band.bank));
  }
});

it('preserves all eight permanent walkable water cells without adding shore collision', () => {
  const actual = FOREST_ROAD.rows.flatMap((row, y) =>
    [...row].flatMap((key, x) => (key === '~' ? [{ x, y }] : [])),
  );
  expect(actual).toEqual(FOREST_WATER_CELLS);
  expect(actual).toHaveLength(8);
  expect(FOREST_ROAD.legend['~']).toEqual({
    terrain: 'dirt',
    surface: 'water',
    surfaceDuration: -1,
  });
  expect(FOREST_ROAD.props).toEqual([]);
});
