/** Repack the registered north-lawn seam from the shared village material. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { BA_DAN_NORTH_FRINGE } from '../../src/content/scenes/baDan';
import { newImage, setPixel } from './lib/image';
import { encodeWebp } from './lib/webp';
import { GROUND_WEBP_QUALITY, villageBake, villageGroundRgb } from './ba-dan-village-material';

export const OUTPUT = 'public/art/maps/ba-dan-scene/north-grass-fringe.webp';
export const SOURCE_SIZE = { width: 512, height: 267 } as const;

const worldFrame = {
  x: 1024 + (BA_DAN_NORTH_FRINGE.x - BA_DAN_NORTH_FRINGE.y - BA_DAN_NORTH_FRINGE.depth) * 64,
  y: (BA_DAN_NORTH_FRINGE.x + BA_DAN_NORTH_FRINGE.y) * 32,
  width: (BA_DAN_NORTH_FRINGE.width + BA_DAN_NORTH_FRINGE.depth) * 64,
  height:
    ((BA_DAN_NORTH_FRINGE.width + BA_DAN_NORTH_FRINGE.depth) * 64 * SOURCE_SIZE.height) /
    SOURCE_SIZE.width,
} as const;

export function packNorthGrassFringe() {
  const image = newImage(SOURCE_SIZE.width, SOURCE_SIZE.height);
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const wx = worldFrame.x + ((px + 0.5) * worldFrame.width) / image.width;
      const wy = worldFrame.y + ((py + 0.5) * worldFrame.height) / image.height;
      const edge = Math.min(px, image.width - 1 - px, py, image.height - 1 - py);
      const alpha = Math.round(255 * Math.min(1, edge / 18));
      setPixel(image, px, py, [...villageBake(wx, wy, villageGroundRgb(wx, wy)), alpha]);
    }
  return image;
}

if (process.argv[1]?.endsWith('ba-dan-north-fringe-ground.ts')) {
  mkdirSync('public/art/maps/ba-dan-scene', { recursive: true });
  writeFileSync(OUTPUT, await encodeWebp(packNorthGrassFringe(), GROUND_WEBP_QUALITY, true));
}
