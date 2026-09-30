import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { pixelAt, readImage } from './lib/image';
import { encodeWebp } from './lib/webp';
import { REED_OUTPUT, REED_SOURCE, REED_WIDTH, packPondReeds } from './pond-reeds';

it('ships the legacy pond-reed asset reproducibly', async () => {
  const image = packPondReeds(readImage(REED_SOURCE));
  expect({ width: image.width, height: image.height }).toEqual({ width: REED_WIDTH, height: 313 });
  expect(Buffer.from(await encodeWebp(image, 88, true))).toEqual(readFileSync(REED_OUTPUT));
  let opaque = 0;
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) if (pixelAt(image, px, py)[3] > 128) opaque++;
  // A fringe, not a decal: the artist's mass is really there, and there is
  // still clear space around it for the water and the bank to read through.
  expect(opaque).toBeGreaterThan(image.width * image.height * 0.2);
  expect(opaque).toBeLessThan(image.width * image.height * 0.75);
});

it('fades the cut edges so the crop never ends on a ruled line', () => {
  const image = packPondReeds(readImage(REED_SOURCE));
  const column = (px: number): number => {
    let sum = 0;
    for (let py = 0; py < image.height; py++) sum += pixelAt(image, px, py)[3];
    return sum / image.height;
  };
  const row = (py: number): number => {
    let sum = 0;
    for (let px = 0; px < image.width; px++) sum += pixelAt(image, px, py)[3];
    return sum / image.width;
  };
  // The edges the crop cut through are clear; the mass rises inward.
  expect(column(image.width - 1)).toBe(0);
  expect(row(0)).toBe(0);
  expect(column(image.width - 2)).toBeLessThan(column(Math.round(image.width * 0.8)));
  expect(row(1)).toBeLessThan(row(Math.round(image.height * 0.35)));
});
