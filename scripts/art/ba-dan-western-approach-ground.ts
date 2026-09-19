/**
 * Pack the first-view western Ba Dan approach from the shared material atlas.
 *
 * This is deliberately a local, transparent ground region: it covers the
 * spawn road and its immediate grass shoulders while overlapping the existing
 * courtyard feather with the same logical-coordinate sampling.
 *
 * npx tsx scripts/art/ba-dan-western-approach-ground.ts <four-quadrant-materials.png>
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

// Projected bounds for logical x0..6, y6..9. It overlaps the courtyard at
// x5..6; neither region needs a screen-space edge there because both sample
// the same material at the same logical coordinate.
const x0 = 384;
const y0 = 192;
const width = 704;
const height = 352;
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
    if (x < 0 || x >= 7 || y < 6 || y >= 10) continue;
    const cell = BA_DAN_VILLAGE.rows[Math.floor(y)]?.[Math.floor(x)] ?? ',';
    // The canal remains a runtime-owned transparent surface. Trees and the
    // blocked map edge retain their grass/stone underlayers so no procedural
    // corner shows through around their transparent scenery.
    if (cell === '~') continue;
    // Feather only toward the procedural exterior. The eastern edge sits under
    // the courtyard region, whose matching sampling already supplies the join.
    const alpha = Math.round(255 * smoothstep(0, 0.4, Math.min(x, y - 6, 10 - y)));
    if (alpha === 0) continue;
    const material = cell === '=' || cell === '.' || cell === 'B' || cell === 'l' ? 0 : 1;
    const sx = sample(x * 192) + (material % 2) * swatch;
    const sy = sample(y * 192) + Math.floor(material / 2) * swatch;
    const from = (sy * atlas.width + sx) * 4;
    const to = (py * image.width + px) * 4;
    image.data[to] = atlas.data[from] ?? 0;
    image.data[to + 1] = atlas.data[from + 1] ?? 0;
    image.data[to + 2] = atlas.data[from + 2] ?? 0;
    image.data[to + 3] = Math.round(((atlas.data[from + 3] ?? 255) * alpha) / 255);
  }
}

const outDir = 'public/art/maps/ba-dan-scene';
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/western-approach-ground.webp`, await encodeWebp(image, 82, true));
