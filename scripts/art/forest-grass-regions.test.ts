import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import { FOREST_WATER_CELLS } from '../../src/content/scenes/forestRoad';
import { FOREST_GRASS_REGIONS } from '../../src/content/scenes/forestRoadGround';
import { pixelAt } from './lib/image';
import { expectPackerAlpha, expectShippedPin } from './lib/shipped-pin';
import { loadForestMaterial } from './forest-village-material';
import { measure } from './forest-ground-measure';
import {
  FOREST_GRASS_PACKS,
  grassPosition,
  packGrassRegion,
  withinGrassRegion,
} from './forest-grass-regions';

/** Generated 2026-10-03 (see docs/art/forest-ground-composition.md); not packer output. */
const GRASS_PINS: Record<string, { bytes: number; sha256: string }> = {
  north: {
    bytes: 37046,
    sha256: '42723d7694c81b57ca9ac27b295d8058e340b8e2b4d9e4a852f61dba4daa690e',
  },
  south: {
    bytes: 30314,
    sha256: '291abe5e896816e5c69cf84e8d43bc6a7446fa0e15671004f399c066598c51d2',
  },
};

it('ships generated sparse grass packs on the packer footprint with fully covered eligible centers', async () => {
  const material = await loadForestMaterial();
  for (const pack of FOREST_GRASS_PACKS) {
    const image = packGrassRegion(material, pack.rows, pack.region);
    const pin = GRASS_PINS[pack.name];
    expect(pin, `${pack.name} has a recorded pin`).toBeDefined();
    if (pin) expectShippedPin(pack.output, pin);
    await expectPackerAlpha(pack.output, image);
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
    // DL-2 §3: the verge is the Earth family. The forest atlas these packs used
    // to tile had no green in it at all, which is defect 9's other half.
    expect(measure(image).greenShare, `${pack.name} pack is Earth green`).toBeGreaterThan(0.9);
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
