import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init } from '@jsquash/webp/decode.js';
import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import { FOREST_WATER_CELLS } from '../../src/content/scenes/forestRoad';
import { readImage, pixelAt } from './lib/image';
import { encodeWebp } from './lib/webp';
import {
  packShoreline,
  SHORE_SOURCE,
  SHORE_OUTPUT,
  shorePosition,
  shoreDistance,
} from './forest-shoreline';

it('ships a reproducible dry pond bank with transparent water interior and a bounded margin', async () => {
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
  let waterInterior = 0,
    missingBank = 0,
    leaks = 0,
    wetBank = 0;
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const { x, y } = shorePosition(px, py);
      const distance = shoreDistance(x, y);
      const [r, g, b, alpha] = pixelAt(image, px, py);
      const decodedAlpha = decoded.data[(py * image.width + px) * 4 + 3];
      if (distance <= 0 && decodedAlpha !== 0) waterInterior++;
      if (distance > 0 && distance <= 0.08 && decodedAlpha !== 255) missingBank++;
      if (distance >= 0.12 && decodedAlpha !== 0) leaks++;
      if (alpha > 0 && b > r + 5 && g > r + 5) wetBank++;
    }
  expect({ waterInterior, missingBank, leaks, wetBank }).toEqual({
    waterInterior: 0,
    missingBank: 0,
    leaks: 0,
    wetBank: 0,
  });
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
