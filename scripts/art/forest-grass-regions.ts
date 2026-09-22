/**
 * Pack the sparse reusable grass regions around the forest road.
 *
 *   node --import tsx scripts/art/forest-grass-regions.ts
 *
 * These two packs and `route-ground.webp` share rows 3 and 9, so they have to
 * be the same verge or the overlap shows as a seam. They therefore take their
 * pixels from the same place the route plate does — `forest-village-material.ts`,
 * re-derived from the village's accepted lawn — and not from the forest atlas,
 * whose olive-ochre swatch had no Earth-family green in it at all.
 *
 * The material is a pure function of the logical point, so the two packers
 * cannot drift across the overlap even when they are run separately.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import { FOREST_GRASS_REGIONS } from '../../src/content/scenes/forestRoadGround';
import { newImage, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { FOREST_GROUND_QUALITY, loadForestMaterial } from './forest-village-material';
import type { ForestMaterial } from './forest-village-material';
import { encodeWebp } from './lib/webp';

export const FOREST_GRASS_PACKS = [
  {
    name: 'north',
    rows: [0, 1, 2, 3],
    region: FOREST_GRASS_REGIONS.north,
    output: 'public/art/maps/forest-scene/grass-north.webp',
  },
  {
    name: 'south',
    rows: [9, 10, 11],
    region: FOREST_GRASS_REGIONS.south,
    output: 'public/art/maps/forest-scene/grass-south.webp',
  },
] as const;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function grassPosition(
  px: number,
  py: number,
  region: (typeof FOREST_GRASS_PACKS)[number]['region'],
) {
  const worldX = region.x + px + 0.5;
  const worldY = region.y + py + 0.5;
  const dx = (worldX - 768) / 64,
    dy = worldY / 32;
  return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
}

export function withinGrassRegion(x: number, y: number, rows: readonly number[]): boolean {
  const key = FOREST_ROAD.rows[y]?.[x];
  // Grass continues beneath a pine without changing its footprint, but never
  // replaces water, ledges, rubble or the road's gameplay material.
  return rows.includes(y) && (key === ',' || key === 'T');
}

export function packGrassRegion(
  material: ForestMaterial,
  rows: readonly number[],
  region: (typeof FOREST_GRASS_PACKS)[number]['region'],
): Image {
  const image = newImage(region.width, region.height);
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const { x, y } = grassPosition(px, py, region);
      const ix = Math.floor(x),
        iy = Math.floor(y);
      if (!withinGrassRegion(ix, iy, rows)) continue;

      let alpha = 1;
      for (const [ox, oy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        if (withinGrassRegion(ix + ox, iy + oy, rows)) continue;
        const distance = ox < 0 ? x - ix : ox > 0 ? ix + 1 - x : oy < 0 ? y - iy : iy + 1 - y;
        const width = 0.2 + 0.06 * (0.5 + 0.5 * Math.sin(ix * 3.7 + iy * 5.3));
        alpha = Math.min(alpha, clamp(distance / width));
      }

      const colour = material.colour('verge', x, y);
      setPixel(image, px, py, [colour[0], colour[1], colour[2], Math.round(alpha * 255)]);
    }
  return image;
}

export async function main() {
  const material = await loadForestMaterial();
  mkdirSync('public/art/maps/forest-scene', { recursive: true });
  for (const pack of FOREST_GRASS_PACKS) {
    const image = packGrassRegion(material, pack.rows, pack.region);
    writeFileSync(pack.output, await encodeWebp(image, FOREST_GROUND_QUALITY, true));
  }
}

if (process.argv[1]?.endsWith('forest-grass-regions.ts')) {
  await main();
}
