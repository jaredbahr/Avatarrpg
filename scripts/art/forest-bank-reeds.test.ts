import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import {
  BANK_REED_ART,
  FOREST_CREEK_REEDS,
  FOREST_POND_REEDS,
  FOREST_ROAD_SCENE,
} from '../../src/content/scenes/forestRoad';
import { encodeWebp } from './lib/webp';
import { BANK_REED_COUNT, bankReedOutput, packBankReed } from './forest-bank-reeds';

it('ships four reproducible alpha-trimmed bank reeds', async () => {
  expect(BANK_REED_ART).toHaveLength(BANK_REED_COUNT);
  for (let index = 0; index < BANK_REED_COUNT; index++) {
    const { image } = packBankReed(index);
    expect({ width: image.width, height: image.height }).toEqual(BANK_REED_ART[index]);
    expect(Buffer.from(await encodeWebp(image, 88, true))).toEqual(
      readFileSync(bankReedOutput(index)),
    );
  }
});

it('plants a varied bank-reed family without changing passability or contact treatment', () => {
  const reeds = [...FOREST_POND_REEDS, ...FOREST_CREEK_REEDS];
  expect(reeds).toHaveLength(5);
  expect(FOREST_ROAD_SCENE.scenery).toEqual(expect.arrayContaining(reeds));
  expect(new Set(reeds.map(({ url }) => url))).toEqual(
    new Set(BANK_REED_ART.map((_, index) => `art/maps/forest-scene/bank-reed-${index}.webp`)),
  );
  expect(reeds.map(({ url }) => url)).toEqual([
    'art/maps/forest-scene/bank-reed-0.webp',
    'art/maps/forest-scene/bank-reed-1.webp',
    'art/maps/forest-scene/bank-reed-3.webp',
    'art/maps/forest-scene/bank-reed-2.webp',
    'art/maps/forest-scene/bank-reed-1.webp',
  ]);
  expect(FOREST_ROAD_SCENE.scenery.map(({ url }) => url)).not.toContain(
    'art/maps/forest-scene/pond-reeds.webp',
  );

  for (const reed of reeds) {
    const cell = reed.footprint[0];
    if (!cell) throw new Error(`${reed.id} has no footprint`);
    expect(FOREST_ROAD.legend[FOREST_ROAD.rows[cell.y]?.[cell.x] ?? '']?.blocked, reed.id).not.toBe(
      true,
    );
    expect(reed.wall, reed.id).toBeUndefined();
    expect(reed.fadeWhenOccluding, reed.id).toBeUndefined();
    expect(reed.contactShadow, reed.id).toBe(false);
    expect(reed.x + reed.width / 2, reed.id).toBeCloseTo(768 + (reed.depth.x - reed.depth.y) * 64);
    expect(reed.y + reed.height, reed.id).toBeCloseTo((reed.depth.x + reed.depth.y) * 32);
  }
});
