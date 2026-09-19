/** Pack sparse reusable grass regions around the forest road from the material sheet. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import { newImage, pixelAt, readImage, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { encodeWebp } from './lib/webp';

export const FOREST_GRASS_REGION = { x: 128, y: 32, width: 1984, height: 960 } as const;
export const FOREST_GRASS_PACKS = [
  { name: 'north', rows: [0, 1, 2, 3], output: 'public/art/maps/forest-scene/grass-north.webp' },
  { name: 'south', rows: [9, 10, 11], output: 'public/art/maps/forest-scene/grass-south.webp' },
] as const;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function grassPosition(px: number, py: number) {
  const worldX = FOREST_GRASS_REGION.x + px + 0.5;
  const worldY = FOREST_GRASS_REGION.y + py + 0.5;
  const dx = (worldX - 768) / 64,
    dy = worldY / 32;
  return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
}

function sample(value: number, period: number, edge: number): number {
  const wrapped = ((value % (period * 2)) + period * 2) % (period * 2);
  return edge + Math.min(period - 1, Math.floor(wrapped < period ? wrapped : period * 2 - wrapped));
}

export function withinGrassRegion(x: number, y: number, rows: readonly number[]): boolean {
  const key = FOREST_ROAD.rows[y]?.[x];
  // Grass continues beneath a pine without changing its footprint, but never
  // replaces water, ledges, rubble or the road's gameplay material.
  return rows.includes(y) && (key === ',' || key === 'T');
}

export function packGrassRegion(atlas: Image, rows: readonly number[]): Image {
  const swatch = Math.floor(Math.min(atlas.width, atlas.height) / 2);
  const edge = 3;
  const period = swatch - edge * 2;
  const image = newImage(FOREST_GRASS_REGION.width, FOREST_GRASS_REGION.height);
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const { x, y } = grassPosition(px, py);
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

      const sx = sample(x * 192, period, edge) + swatch;
      const sy = sample(y * 192, period, edge);
      const colour = pixelAt(atlas, sx, sy);
      setPixel(image, px, py, [colour[0], colour[1], colour[2], Math.round(alpha * 255)]);
    }
  return image;
}

export async function main(source: string) {
  const atlas = readImage(source);
  mkdirSync('public/art/maps/forest-scene', { recursive: true });
  for (const pack of FOREST_GRASS_PACKS) {
    const image = packGrassRegion(atlas, pack.rows);
    writeFileSync(pack.output, await encodeWebp(image, 86, true));
  }
}

if (process.argv[1]?.endsWith('forest-grass-regions.ts')) {
  const source = process.argv[2];
  if (!source) throw new Error('Provide the reviewed four-quadrant forest material sheet.');
  await main(source);
}
