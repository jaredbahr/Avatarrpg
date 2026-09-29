import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BA_DAN_GARDEN_PLATES } from '../../src/content/scenes/baDan';
import { pixelAt } from './lib/image';
import { decodeWebp } from './lib/webp';
import {
  FLAGSTONE_TONES,
  GARDEN_TONES,
  GRAIN,
  MATERIAL_TONES,
  flagstoneTexel,
  gardenPlatePath,
  onExit,
  packGardenPlate,
  worldLogical,
} from './ba-dan-garden';

describe('Ba Dan outer garden', () => {
  it('ships the deterministic garden plates byte-for-pixel', async () => {
    for (const [index, plate] of BA_DAN_GARDEN_PLATES.entries()) {
      const expected = packGardenPlate(plate);
      const shipped = await decodeWebp(readFileSync(gardenPlatePath(index)));
      expect({ width: shipped.width, height: shipped.height }).toEqual({
        width: expected.width,
        height: expected.height,
      });
      expect(Buffer.from(shipped.data).equals(Buffer.from(expected.data))).toBe(true);
    }
  });

  it('uses only opaque two-pixel colour clusters or transparent exterior', () => {
    const allowed = new Set(
      [...Object.values(GARDEN_TONES), MATERIAL_TONES.road.shadow].map((tone) => tone.join(',')),
    );
    let painted = 0;
    let clear = 0;
    let exit = 0;
    const stone = new Set(FLAGSTONE_TONES.map(({ tone }) => tone.join(',')));
    for (const plate of BA_DAN_GARDEN_PLATES) {
      const image = packGardenPlate(plate);
      for (let y = 0; y < image.height; y += GRAIN) {
        for (let x = 0; x < image.width; x += GRAIN) {
          const rgba = pixelAt(image, x, y);
          if (rgba[3] === 0) clear++;
          else {
            painted++;
            expect(rgba[3]).toBe(255);
            const tx = (plate.x + x) / GRAIN;
            const ty = (plate.y + y) / GRAIN;
            const at = worldLogical((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN);
            // A road exit's last tile is the painted flagstone, not a garden tone.
            if (onExit(at.x, at.y)) {
              exit++;
              expect(rgba.slice(0, 3)).toEqual([...flagstoneTexel(tx, ty)]);
              expect(stone.has(rgba.slice(0, 3).join(','))).toBe(true);
            } else expect(allowed.has(rgba.slice(0, 3).join(','))).toBe(true);
          }
          for (let dy = 0; dy < GRAIN; dy++)
            for (let dx = 0; dx < GRAIN; dx++) expect(pixelAt(image, x + dx, y + dy)).toEqual(rgba);
        }
      }
    }
    expect(painted).toBeGreaterThan(100_000);
    expect(clear).toBeGreaterThan(1_000);
    expect(exit, 'both road exits carry flagstone under the courts').toBeGreaterThan(1_000);
  });

  it('wears the ground in clusters rather than a repeating ordered screen', () => {
    const wear = MATERIAL_TONES.road.shadow.join(',');
    let worn = 0;
    let singles = 0;
    for (const plate of BA_DAN_GARDEN_PLATES) {
      const image = packGardenPlate(plate);
      const isWear = (tx: number, ty: number): boolean =>
        pixelAt(image, tx * GRAIN, ty * GRAIN)
          .slice(0, 3)
          .join(',') === wear;
      for (let ty = 1; ty < image.height / GRAIN - 1; ty++)
        for (let tx = 1; tx < image.width / GRAIN - 1; tx++) {
          if (!isWear(tx, ty)) continue;
          worn++;
          // A worn texel with no worn neighbour: the unit an ordered screen is made of.
          const neighbours = [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ] as const;
          if (!neighbours.some(([dx, dy]) => isWear(tx + dx, ty + dy))) singles++;
        }
    }
    expect(worn).toBeGreaterThan(1_000);
    // Measured: 37% for the 4x4 Bayer wear of 0fbcc40, 1.6% for these clusters.
    expect(singles / worn).toBeLessThan(0.05);
  });
});
