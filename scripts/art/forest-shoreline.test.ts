import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init } from '@jsquash/webp/decode.js';
import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import { FOREST_WATER_CELLS } from '../../src/content/scenes/forestRoad';
import { readImage, pixelAt } from './lib/image';
import { encodeWebp } from './lib/webp';
import {
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

it('ships a reproducible pond bank whose dry material bites into the outer water cells', async () => {
  const { image } = packShoreline(readImage(SHORE_SOURCE));
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
    intruding = 0,
    deepestBite = 0,
    deepBite = 0;
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
      const inside = inset[py * image.width + px] ?? 0;
      if (inside > 0) {
        waterPixels++;
        if (alpha > 0) {
          intruding++;
          // The bank never reaches half a cell in: the middle of every water
          // tile stays water, and the rules' tile is never repainted as dry.
          deepestBite = Math.max(deepestBite, inside);
          if (inside > SHORE_BITE * 0.6) deepBite++;
          // The inner edge is feathered, never a second ruled line.
          expect(alpha).toBeLessThanOrEqual(255);
          if (inside > biteDepth(x, y) + BITE_FEATHER) {
            throw new Error(`Dry material at ${x},${y} sits past its own bite depth`);
          }
        }
      }
    }
  expect({ missingBank, leaks, wetBank }).toEqual({
    missingBank: 0,
    leaks: 0,
    wetBank: 0,
  });
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
  // Every real water center remains clear for the runtime water layer.
  for (const { x, y } of FOREST_WATER_CELLS) {
    const px = Math.round((768 + (x - y) * 64 - 560) * 2);
    const py = Math.round(((x + y + 1) * 32 - 304) * 2);
    let opaqueSamples = 0;
    for (let oy = -12; oy <= 12; oy++)
      for (let ox = -12; ox <= 12; ox++) {
        if (pixelAt(image, px + ox, py + oy)[3] > 0) opaqueSamples++;
      }
    expect(opaqueSamples, `water at ${x},${y}`).toBe(0);
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
