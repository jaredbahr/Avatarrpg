import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import {
  FOREST_POND_PATCH,
  FOREST_POND_REEDS,
  FOREST_ROAD_SCENE,
  REED_PLATE,
} from '../../src/content/scenes/forestRoad';
import { shoreDistance } from './forest-shoreline';
import { pixelAt, readImage } from './lib/image';
import { encodeWebp } from './lib/webp';
import { REED_OUTPUT, REED_SOURCE, packPondReeds } from './pond-reeds';

it('ships a reproducible reed fringe at the size the scene registers', async () => {
  const image = packPondReeds(readImage(REED_SOURCE));
  expect({ width: image.width, height: image.height }).toEqual(REED_PLATE);
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

it('plants the fringes on the cells that touch the pond, passable and unoccluding', () => {
  expect(FOREST_POND_REEDS).toHaveLength(3);
  expect(FOREST_ROAD_SCENE.scenery).toEqual(expect.arrayContaining([...FOREST_POND_REEDS]));
  const seen = new Set<string>();
  for (const reed of FOREST_POND_REEDS) {
    const cell = reed.footprint[0];
    if (!cell) throw new Error(`${reed.id} has no footprint`);
    seen.add(`${cell.x},${cell.y}`);
    // Stands on the bank: outside the water, but within half a cell of it, so
    // the waterline carries planting rather than meeting the road bare.
    const distance = shoreDistance(cell.x + 0.5, cell.y + 0.5);
    expect(distance, reed.id).toBeGreaterThan(0);
    expect(distance, reed.id).toBeLessThanOrEqual(0.6);
    expect(FOREST_ROAD.legend[FOREST_ROAD.rows[cell.y]?.[cell.x] ?? '']?.blocked, reed.id).not.toBe(
      true,
    );
    // Passable, low scenery: no wall, no fade, and no invented collision.
    expect(reed.wall, reed.id).toBeUndefined();
    expect(reed.fadeWhenOccluding, reed.id).toBeUndefined();
    // The artist's plate is never stretched, and the fringe stands on the
    // pond's own registered patch rather than somewhere else on the road.
    expect(reed.width / reed.height, reed.id).toBeCloseTo(REED_PLATE.width / REED_PLATE.height, 1);
    expect(reed.x + reed.width, reed.id).toBeGreaterThan(FOREST_POND_PATCH.x);
    expect(reed.x, reed.id).toBeLessThan(FOREST_POND_PATCH.x + FOREST_POND_PATCH.width);
    // The foot line is the cell's own projected centre line, as the pines and
    // the nest use, and the depth sorts the fringe just in front of it.
    expect(reed.y + reed.height, reed.id).toBeCloseTo((cell.x + cell.y + 1) * 32);
    expect((reed.depth.x + reed.depth.y) * 32, reed.id).toBeCloseTo(reed.y + reed.height - 26.24);
  }
  expect(seen.size).toBe(FOREST_POND_REEDS.length);
});
