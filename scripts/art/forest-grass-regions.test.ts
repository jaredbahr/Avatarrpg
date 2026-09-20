import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import { FOREST_WATER_CELLS } from '../../src/content/scenes/forestRoad';
import { FOREST_GRASS_REGIONS } from '../../src/content/scenes/forestRoadGround';
import { pixelAt, readImage } from './lib/image';
import { encodeWebp } from './lib/webp';
import {
  FOREST_GRASS_PACKS,
  grassPosition,
  packGrassRegion,
  withinGrassRegion,
} from './forest-grass-regions';

const source = 'assets/source/forest-material-v2/material-sheet.png';

it('ships reproducible sparse grass packs with fully covered eligible centers', async () => {
  const atlas = readImage(source);
  for (const pack of FOREST_GRASS_PACKS) {
    const image = packGrassRegion(atlas, pack.rows, pack.region);
    expect(Buffer.from(await encodeWebp(image, 86, true))).toEqual(readFileSync(pack.output));
    let opaque = 0,
      feather = 0,
      waterLeaks = 0,
      nonGrassLeaks = 0;
    for (let py = 0; py < image.height; py++)
      for (let px = 0; px < image.width; px++) {
        const { x, y } = grassPosition(px, py, pack.region);
        const alpha = pixelAt(image, px, py)[3];
        const water = FOREST_WATER_CELLS.some(
          (cell) => x >= cell.x && x < cell.x + 1 && y >= cell.y && y < cell.y + 1,
        );
        if (water && alpha > 0) waterLeaks++;
        if (alpha > 0) {
          opaque++;
          if (!withinGrassRegion(Math.floor(x), Math.floor(y), pack.rows)) nonGrassLeaks++;
        }
        if (alpha > 0 && alpha < 255) feather++;
      }
    expect({ waterLeaks, nonGrassLeaks }).toEqual({ waterLeaks: 0, nonGrassLeaks: 0 });
    expect(opaque, `${pack.name} pack has content`).toBeGreaterThan(1_000);
    expect(feather, `${pack.name} pack has a soft edge`).toBeGreaterThan(1_000);

    for (let y = 0; y < FOREST_ROAD.height; y++)
      for (let x = 0; x < FOREST_ROAD.width; x++) {
        if (!withinGrassRegion(x, y, pack.rows)) continue;
        const worldX = 768 + (x - y) * 64;
        const worldY = (x + y + 1) * 32;
        const px = Math.floor(worldX - pack.region.x);
        const py = Math.floor(worldY - pack.region.y);
        expect(px, `${pack.name} ${x},${y} horizontal registration`).toBeGreaterThanOrEqual(0);
        expect(px, `${pack.name} ${x},${y} horizontal registration`).toBeLessThan(
          pack.region.width,
        );
        expect(py, `${pack.name} ${x},${y} vertical registration`).toBeGreaterThanOrEqual(0);
        expect(py, `${pack.name} ${x},${y} vertical registration`).toBeLessThan(pack.region.height);
        expect(pixelAt(image, px, py)[3], `${pack.name} ${x},${y} center alpha`).toBe(255);
      }
  }
});

it('uses separate projected registrations without creating a full-map ground replacement', () => {
  expect(FOREST_GRASS_REGIONS).toEqual({
    north: { x: 512, y: 0, width: 1536, height: 768 },
    south: { x: 0, y: 288, width: 1472, height: 736 },
  });
  expect(FOREST_GRASS_PACKS.map((pack) => pack.rows)).toEqual([
    [0, 1, 2, 3],
    [9, 10, 11],
  ]);
});
