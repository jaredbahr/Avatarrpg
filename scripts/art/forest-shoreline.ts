/** Register authored pixels only: opaque seam cover, dry exterior, bounded alpha feather. */
import { writeFileSync } from 'node:fs';
import { FOREST_POND_PATCH, FOREST_WATER_CELLS } from '../../src/content/scenes/forestRoad';
import { newImage, pixelAt, readImage, setPixel, writePng } from './lib/image';
import type { Image } from './lib/image';
import { scaleTo } from './lib/scale';
import { encodeWebp } from './lib/webp';

export const SHORE_LIMIT = 0.12;
export const COVER_LIMIT = 0.08;
export const SHORE_SOURCE = 'assets/reference/forest-pond-shoreline/shoreline-source.png';
export const SHORE_OUTPUT = 'public/art/maps/forest-scene/water.webp';

export function shorePosition(px: number, py: number, density = 2) {
  const worldX = FOREST_POND_PATCH.x + (px + 0.5) / density;
  const worldY = FOREST_POND_PATCH.y + (py + 0.5) / density;
  const dx = (worldX - 768) / 64,
    dy = worldY / 32;
  return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
}

export function shoreDistance(x: number, y: number): number {
  return Math.min(
    ...FOREST_WATER_CELLS.map((c) => Math.max(c.x - x, x - c.x - 1, c.y - y, y - c.y - 1, 0)),
  );
}

/** Teal is absent from the authored ochre dry-margin material. */
export function isWaterColour(pixel: readonly number[]): boolean {
  const [r = 0, g = 0, b = 0] = pixel;
  return b > r + 5 && g > r + 5;
}

export function packShoreline(raw: Image) {
  const { width, height } = FOREST_POND_PATCH;
  if (Math.abs(raw.width / raw.height - width / height) > 0.005)
    throw new Error('Shoreline source changed the full-canvas registration aspect.');
  const source = scaleTo(raw, width * 2, height * 2);
  const out = newImage(source.width, source.height);
  let mattePixels = 0,
    farthestSample = 0;
  for (let py = 0; py < out.height; py++)
    for (let px = 0; px < out.width; px++) {
      const { x, y } = shorePosition(px, py);
      const distance = shoreDistance(x, y);
      if (distance >= SHORE_LIMIT) continue;
      let pixel = pixelAt(source, px, py);
      // Generated alpha drifts slightly from the exact guide. Cover those holes
      // with the nearest visible dry pixel from this same authored shoreline.
      // This is registration, not synthesized material or a widened water area.
      if (pixel[3] < 16 || (distance > 0 && isWaterColour(pixel))) {
        let best = Infinity;
        let replacement: typeof pixel | null = null;
        for (let oy = -40; oy <= 40; oy++)
          for (let ox = -40; ox <= 40; ox++) {
            const sx = px + ox,
              sy = py + oy,
              squared = ox * ox + oy * oy;
            if (squared >= best || sx < 0 || sy < 0 || sx >= source.width || sy >= source.height)
              continue;
            const candidate = pixelAt(source, sx, sy);
            if (candidate[3] >= 16 && !isWaterColour(candidate)) {
              best = squared;
              replacement = candidate;
            }
          }
        if (!replacement) throw new Error(`No nearby authored dry shore pixel at ${px},${py}`);
        pixel = replacement;
        mattePixels++;
        farthestSample = Math.max(farthestSample, Math.sqrt(best));
      }
      const alpha =
        distance <= COVER_LIMIT
          ? 255
          : Math.round((255 * (SHORE_LIMIT - distance)) / (SHORE_LIMIT - COVER_LIMIT));
      setPixel(out, px, py, [pixel[0], pixel[1], pixel[2], alpha]);
    }
  return { image: out, mattePixels, farthestSample };
}

export async function main() {
  const result = packShoreline(readImage(SHORE_SOURCE));
  writeFileSync(SHORE_OUTPUT, await encodeWebp(result.image, 88, true));
  if (process.argv.includes('--audit')) writePng('.shots/pond/packed.png', result.image);
  console.log({
    width: result.image.width,
    height: result.image.height,
    mattePixels: result.mattePixels,
    farthestSample: result.farthestSample,
  });
}
if (process.argv[1]?.endsWith('forest-shoreline.ts')) await main();
