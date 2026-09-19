/**
 * Pack one authored Ba Dan ground region from the material atlas.
 *
 * Unlike ba-dan-ground.ts this intentionally emits only the reviewed courtyard
 * envelope. The map's rows choose the material at each logical cell; the
 * renderer can keep its procedural grid outside this region.
 *
 * npx tsx scripts/art/ba-dan-courtyard-ground.ts <four-quadrant-materials.png>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { BA_DAN_VILLAGE } from '../../src/content/maps/village';
import { newImage, readImage } from './lib/image';
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

// Projected bounds of the logical x5..15,y3..11 court. The image is already
// in camera space, so these are screen pixels, not another ground transform.
const x0 = 640;
const y0 = 256;
const width = 1152;
const height = 576;
const image = newImage(width, height);

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

for (let py = 0; py < height; py++) {
  for (let px = 0; px < width; px++) {
    const dx = (px + x0 - 1024 + 0.5) / 64;
    const dy = (py + y0 + 0.5) / 32;
    const x = (dx + dy) / 2;
    const y = (dy - dx) / 2;
    const cell = BA_DAN_VILLAGE.rows[Math.floor(y)]?.[Math.floor(x)] ?? ',';
    // Fade at the authored court's logical boundary so this local region
    // dissolves into procedural terrain instead of ending as a screen-space
    // rectangle. The half-tile feather stays wide enough to hide compression
    // seams while leaving the roads and canal approaches opaque.
    const edge = Math.min(x - 5, 15 - x, y - 3, 11 - y);
    const alpha = Math.round(255 * smoothstep(0, 0.5, edge));
    if (alpha === 0) continue;

    // The source atlas is a material vocabulary, not a complete-map crop:
    // stone follows authored roads, buildings, and the bridge approach while
    // the remaining court is the same grass material used by the village.
    const material = cell === '=' || cell === '.' || cell === 'B' || cell === 'l' ? 0 : 1;
    const sx = sample(x * 192) + (material % 2) * swatch;
    const sy = sample(y * 192) + Math.floor(material / 2) * swatch;
    const from = (sy * atlas.width + sx) * 4;
    const to = (py * image.width + px) * 4;
    image.data[to] = atlas.data[from] ?? 0;
    image.data[to + 1] = atlas.data[from + 1] ?? 0;
    image.data[to + 2] = atlas.data[from + 2] ?? 0;
    image.data[to + 3] = alpha;
  }
}

const outDir = 'public/art/maps/ba-dan-scene';
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/courtyard-ground.webp`, await encodeWebp(image, 82, true));
