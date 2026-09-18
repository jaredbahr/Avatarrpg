/** Alpha-register authored puddle art to the exact permanent-water mask. No painted pixels are invented. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import { readImage, newImage, pixelAt, setPixel } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { scaleBy } from './lib/scale';
import { encodeWebp } from './lib/webp';

const source = process.argv[2];
if (!source) throw new Error('Provide the authored cross-shaped puddle PNG.');
const raw = readImage(source),
  bounds = alphaBounds(raw);
if (!bounds) throw new Error('Puddle art is empty.');
const trimmed = crop(raw, bounds);
if (Math.abs(trimmed.width / trimmed.height - 2) > 0.08)
  throw new Error('Puddle does not match the guide aspect ratio.');
const scaled = scaleBy(trimmed, Math.min(640 / trimmed.width, 320 / trimmed.height));
const out = newImage(640, 320);
const offsetX = Math.floor((out.width - scaled.width) / 2);
const offsetY = Math.floor((out.height - scaled.height) / 2);
let clipped = 0;
for (let py = 0; py < out.height; py++) {
  for (let px = 0; px < out.width; px++) {
    const dx = (576 + (px + 0.5) / 2 - 768) / 64;
    const dy = (320 + (py + 0.5) / 2) / 32;
    const x = Math.floor((dx + dy) / 2),
      y = Math.floor((dy - dx) / 2);
    const sx = px - offsetX,
      sy = py - offsetY;
    if (sx < 0 || sy < 0 || sx >= scaled.width || sy >= scaled.height) continue;
    const pixel = pixelAt(scaled, sx, sy);
    if (FOREST_ROAD.rows[y]?.[x] === '~') setPixel(out, px, py, pixel);
    else if (pixel[3] > 0) clipped++;
  }
}
mkdirSync('public/art/maps/forest-scene', { recursive: true });
writeFileSync('public/art/maps/forest-scene/water.webp', await encodeWebp(out, 88, true));
console.log({
  source,
  bounds,
  scaled: [scaled.width, scaled.height],
  clippedOutsideWater: clipped,
});
