import { expect, it, vi } from 'vitest';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import {
  BANK_REED_ART,
  FOREST_CREEK_REEDS,
  FOREST_POND_REEDS,
  FOREST_ROAD_SCENE,
} from '../../src/content/scenes/forestRoad';
import { alphaBounds, lowestOpaqueRow } from './lib/trim';
import { BANK_REED_COUNT, BANK_REED_SIZE, packBankReed } from './forest-bank-reeds';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

/**
 * The packer's reeds are the pre-G1 art: since ADR 0087 they are the input the
 * G1 reeds were redrawn from, at the same registered aspect, and no longer ship.
 * `forest-g1-pack.test.ts` holds what does.
 */
it('packs four reproducible full-bound painted bank reeds', () => {
  expect(BANK_REED_ART).toHaveLength(BANK_REED_COUNT);
  for (let index = 0; index < BANK_REED_COUNT; index++) {
    const { image } = packBankReed(index);
    expect({ width: image.width, height: image.height }).toEqual(BANK_REED_ART[index]);
    expect({ width: image.width, height: image.height }).toEqual(BANK_REED_SIZE[index]);
    expect(alphaBounds(image)).toEqual({ x: 0, y: 0, width: image.width, height: image.height });
    expect(lowestOpaqueRow(image)).toBe(image.height - 1);
    let soft = 0;
    const tones = new Set<number>();
    for (let i = 0; i < image.data.length; i += 4) {
      const alpha = image.data[i + 3] ?? 0;
      if (alpha > 0 && alpha < 255) soft++;
      if (alpha >= 8)
        tones.add(
          ((image.data[i] ?? 0) << 16) | ((image.data[i + 1] ?? 0) << 8) | (image.data[i + 2] ?? 0),
        );
    }
    expect(soft, `reed ${index} soft alpha`).toBeGreaterThan(1_000);
    expect(tones.size, `reed ${index} painted tones`).toBeGreaterThan(100);
  }
});

it('plants a varied bank-reed family without changing passability or contact treatment', () => {
  const reeds = [...FOREST_POND_REEDS, ...FOREST_CREEK_REEDS];
  expect(reeds).toHaveLength(5);
  expect(FOREST_ROAD_SCENE.scenery).toEqual(expect.arrayContaining(reeds));
  expect(new Set(reeds.map(({ url }) => url))).toEqual(
    new Set(BANK_REED_ART.map((_, index) => `art/maps/forest-g1/bank-reed-${index}.webp`)),
  );
  expect(reeds.map(({ url }) => url)).toEqual([
    'art/maps/forest-g1/bank-reed-0.webp',
    'art/maps/forest-g1/bank-reed-1.webp',
    'art/maps/forest-g1/bank-reed-3.webp',
    'art/maps/forest-g1/bank-reed-2.webp',
    'art/maps/forest-g1/bank-reed-1.webp',
  ]);
  for (const reed of reeds) {
    const cell = reed.footprint[0];
    if (!cell) throw new Error(`${reed.id} has no footprint`);
    expect(FOREST_ROAD.legend[FOREST_ROAD.rows[cell.y]?.[cell.x] ?? '']?.blocked, reed.id).not.toBe(
      true,
    );
    expect(reed.wall, reed.id).toBeUndefined();
    expect(reed.fadeWhenOccluding, reed.id).toBeUndefined();
    expect(reed.contactShadow, reed.id).toBe(false);
    // Recover the registered foot from where the image stands: it lies in the
    // reed's own cell, and depth is that foot clamped to the cell centre.
    const across = (reed.x + reed.width / 2 - 768) / 64;
    const down = (reed.y + reed.height) / 32;
    const foot = { x: (down + across) / 2, y: (down - across) / 2 };
    const EPS = 1e-9;
    expect(foot.x, reed.id).toBeGreaterThanOrEqual(cell.x - EPS);
    expect(foot.x, reed.id).toBeLessThanOrEqual(cell.x + 1 + EPS);
    expect(foot.y, reed.id).toBeGreaterThanOrEqual(cell.y - EPS);
    expect(foot.y, reed.id).toBeLessThanOrEqual(cell.y + 1 + EPS);
    expect(reed.depth.x, reed.id).toBeCloseTo(Math.min(foot.x, cell.x + 0.5));
    expect(reed.depth.y, reed.id).toBeCloseTo(Math.min(foot.y, cell.y + 0.5));
  }
});
