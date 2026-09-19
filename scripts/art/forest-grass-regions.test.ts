import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FOREST_WATER_CELLS } from '../../src/content/scenes/forestRoad';
import { pixelAt, readImage } from './lib/image';
import { encodeWebp } from './lib/webp';
import {
  FOREST_GRASS_PACKS,
  FOREST_GRASS_REGION,
  grassPosition,
  packGrassRegion,
  withinGrassRegion,
} from './forest-grass-regions';

const source = 'assets/source/forest-material-v2/material-sheet.png';

it('ships reproducible sparse grass packs with transparent water and non-grass cells', async () => {
  const atlas = readImage(source);
  for (const pack of FOREST_GRASS_PACKS) {
    const image = packGrassRegion(atlas, pack.rows);
    expect(Buffer.from(await encodeWebp(image, 86, true))).toEqual(readFileSync(pack.output));
    let opaque = 0,
      feather = 0;
    for (let py = 0; py < image.height; py++)
      for (let px = 0; px < image.width; px++) {
        const { x, y } = grassPosition(px, py);
        const alpha = pixelAt(image, px, py)[3];
        const water = FOREST_WATER_CELLS.some(
          (cell) => x >= cell.x && x < cell.x + 1 && y >= cell.y && y < cell.y + 1,
        );
        if (water) expect(alpha).toBe(0);
        if (alpha > 0) {
          opaque++;
          expect(withinGrassRegion(Math.floor(x), Math.floor(y), pack.rows)).toBe(true);
        }
        if (alpha > 0 && alpha < 255) feather++;
      }
    expect(opaque, `${pack.name} pack has content`).toBeGreaterThan(1_000);
    expect(feather, `${pack.name} pack has a soft edge`).toBeGreaterThan(1_000);
  }
});

it('shares the registered local canvas without creating a full-map ground replacement', () => {
  expect(FOREST_GRASS_REGION).toEqual({ x: 128, y: 32, width: 1984, height: 960 });
  expect(FOREST_GRASS_PACKS.map((pack) => pack.rows)).toEqual([
    [0, 1, 2, 3],
    [9, 10, 11],
  ]);
});
