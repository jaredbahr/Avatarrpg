/**
 * Build transparent low-bank coping around the walkable Ba Dan water cells.
 * The water itself stays in the runtime surface shader; this layer contributes
 * only the authored stone edge and therefore cannot drift from the grid.
 *
 * npx tsx scripts/art/ba-dan-canal-banks.ts <four-quadrant-materials.png>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  BA_DAN_CANAL_BANK_RADIUS,
  BA_DAN_CANAL_BANKS,
  BA_DAN_WATER_CELLS,
} from '../../src/content/scenes/baDan';
import { newImage, readImage, setPixel } from './lib/image';
import { encodeWebp } from './lib/webp';

const source = process.argv[2];
if (!source) throw new Error('Provide the painted four-quadrant material atlas.');
const atlas = readImage(source);
const swatch = Math.floor(Math.min(atlas.width, atlas.height) / 2);
const edge = 3;
const period = swatch - edge * 2;
const sample = (value: number): number => {
  const wrapped = ((value % (period * 2)) + period * 2) % (period * 2);
  return edge + Math.min(period - 1, Math.floor(wrapped < period ? wrapped : period * 2 - wrapped));
};

// The 64/32 half-extents are the actual oblique tile diamond. Derive the
// raster envelope from the shared scene bounds so the last southeast cell
// cannot fall outside the authored coping image.
const { x: x0, y: y0, width, height } = BA_DAN_CANAL_BANKS;
const image = newImage(width, height);

for (let py = 0; py < height; py++) {
  for (let px = 0; px < width; px++) {
    const worldX = x0 + px + 0.5;
    const worldY = y0 + py + 0.5;
    let ring = 0;
    let inside = false;
    for (const { x, y } of BA_DAN_WATER_CELLS) {
      const centerX = 1024 + (x - y) * 64;
      const centerY = (x + y + 1) * 32;
      const metric = Math.abs((worldX - centerX) / 64) + Math.abs((worldY - centerY) / 32);
      if (metric <= 1) inside = true;
      // A readable low coping is deliberately wider than a one-pixel rim at
      // the shipped 64/32 projected tile size. The water remains transparent
      // here and is painted exactly once by the runtime surface shader.
      if (metric <= BA_DAN_CANAL_BANK_RADIUS)
        ring = Math.max(ring, BA_DAN_CANAL_BANK_RADIUS - metric);
    }
    if (inside || ring <= 0) continue;

    const sx = sample(worldX * 1.5);
    const sy = sample(worldY * 1.5);
    const from = (sy * atlas.width + sx) * 4;
    const shade = ring > 0.26 ? 0.82 : ring > 0.1 ? 0.92 : 1;
    setPixel(image, px, py, [
      Math.round((atlas.data[from] ?? 0) * shade),
      Math.round((atlas.data[from + 1] ?? 0) * shade),
      Math.round((atlas.data[from + 2] ?? 0) * shade),
      255,
    ]);
  }
}

const outDir = 'public/art/maps/ba-dan-scene';
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/canal-banks.webp`, await encodeWebp(image, 82, true));
