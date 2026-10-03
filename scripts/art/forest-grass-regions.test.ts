import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import { FOREST_WATER_CELLS } from '../../src/content/scenes/forestRoad';
import { FOREST_GRASS_REGIONS } from '../../src/content/scenes/forestRoadGround';
import { pixelAt } from './lib/image';
import { expectPackerAlpha, expectShippedPin, readShipped } from './lib/shipped-pin';
import { loadForestMaterial } from './forest-village-material';
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

/**
 * Earth-green share of the shipped plate, over opaque pixels that lie inside a
 * grass cell and at least `CLEAR_OF_ROAD` cells from any cell that is not grass
 * region, so the stone-edged road margin and the feather are excluded.
 *
 * Measured on the shipped files 2026-10-03 (same green rule as `measure()`):
 * north 0.872, south 0.888 with the margin excluded; 0.873 and 0.890 over the
 * whole plate. Excluding the margin moves the number by under 0.005, so the gap
 * to the old procedural 0.9 is the generated grass itself (needle litter and
 * shading inside the region), not the road edge. The floor sits just under the
 * lower reading.
 */
const CLEAR_OF_ROAD = 0.2;
const MIN_GRASS_GREEN = 0.85;

function distanceToNonGrass(x: number, y: number, rows: readonly number[]): number {
  let nearest = Infinity;
  for (let cy = Math.floor(y) - 2; cy <= Math.floor(y) + 2; cy++)
    for (let cx = Math.floor(x) - 2; cx <= Math.floor(x) + 2; cx++) {
      if (withinGrassRegion(cx, cy, rows)) continue;
      const dx = Math.max(cx - x, 0, x - (cx + 1));
      const dy = Math.max(cy - y, 0, y - (cy + 1));
      nearest = Math.min(nearest, Math.hypot(dx, dy));
    }
  return nearest;
}

it('ships generated sparse grass packs on the packer footprint with fully covered eligible centers', async () => {
  const material = await loadForestMaterial();
  for (const pack of FOREST_GRASS_PACKS) {
    const packed = packGrassRegion(material, pack.rows, pack.region);
    // Every check below reads the decoded shipped file, not the packer's output.
    const image = await readShipped(pack.output);
    const pin = GRASS_PINS[pack.name];
    expect(pin, `${pack.name} has a recorded pin`).toBeDefined();
    if (pin) expectShippedPin(pack.output, pin);
    await expectPackerAlpha(pack.output, packed);
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
    // to tile had no green in it at all, which is defect 9's other half. This
    // holds the shipped grass, away from the road margin, to mostly green.
    let inside = 0,
      green = 0;
    for (let py = 0; py < image.height; py++)
      for (let px = 0; px < image.width; px++) {
        const [r, g, b, a] = pixelAt(image, px, py);
        if (a < 200) continue;
        const { x, y } = grassPosition(px, py, pack.region);
        if (!withinGrassRegion(Math.floor(x), Math.floor(y), pack.rows)) continue;
        if (distanceToNonGrass(x, y, pack.rows) < CLEAR_OF_ROAD) continue;
        inside++;
        if (g > r + 6 && g > b + 12) green++;
      }
    expect(inside, `${pack.name} pack has grass interior`).toBeGreaterThan(100_000);
    expect(green / inside, `${pack.name} shipped grass is Earth green`).toBeGreaterThan(
      MIN_GRASS_GREEN,
    );
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
