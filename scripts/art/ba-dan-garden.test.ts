import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BA_DAN_GARDEN_PLATES } from '../../src/content/scenes/baDan';
import { pixelAt } from './lib/image';
import { decodeWebp } from './lib/webp';
import {
  GARDEN_TONES,
  GRAIN,
  MATERIAL_TONES,
  transitionCluster,
  gardenPlatePath,
  packGardenPlate,
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
    for (const plate of BA_DAN_GARDEN_PLATES) {
      const image = packGardenPlate(plate);
      for (let y = 0; y < image.height; y += GRAIN) {
        for (let x = 0; x < image.width; x += GRAIN) {
          const rgba = pixelAt(image, x, y);
          if (rgba[3] === 0) clear++;
          else {
            painted++;
            expect(rgba[3]).toBe(255);
            expect(allowed.has(rgba.slice(0, 3).join(','))).toBe(true);
          }
          for (let dy = 0; dy < GRAIN; dy++)
            for (let dx = 0; dx < GRAIN; dx++) expect(pixelAt(image, x + dx, y + dy)).toEqual(rgba);
        }
      }
    }
    expect(painted).toBeGreaterThan(100_000);
    expect(clear).toBeGreaterThan(1_000);
  });

  it('uses a clustered transition mask rather than a repeating ordered screen', () => {
    const samples = Array.from({ length: 16 }, (_, y) =>
      Array.from({ length: 16 }, (_, x) => transitionCluster(x / 8, y / 8, 71) < 0.45),
    );
    let sameAtFour = 0;
    let compared = 0;
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 12; x++) {
        compared++;
        if (samples[y]?.[x] === samples[y + 4]?.[x + 4]) sameAtFour++;
      }
    // A 4x4 Bayer screen repeats exactly on this diagonal; painted clusters do not.
    expect(sameAtFour).toBeLessThan(compared * 0.85);
  });
});
