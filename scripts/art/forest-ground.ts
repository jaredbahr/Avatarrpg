/** Register painted material swatches to the existing forest cells, without rule changes. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import { newImage, readImage } from './lib/image';
import { encodeWebp } from './lib/webp';

const source = process.argv[2];
if (!source) throw new Error('Provide the four-quadrant painted forest material atlas.');
const atlas = readImage(source);
const swatch = Math.floor(Math.min(atlas.width, atlas.height) / 2);
const edge = 3,
  period = swatch - edge * 2;
function sample(value: number): number {
  const wrapped = ((value % (period * 2)) + period * 2) % (period * 2);
  return edge + Math.min(period - 1, Math.floor(wrapped < period ? wrapped : period * 2 - wrapped));
}
const outDir = 'public/art/maps/forest-scene';
mkdirSync(outDir, { recursive: true });
for (let chunk = 0; chunk < 2; chunk++) {
  const image = newImage(1152, 1280);
  for (let py = 0; py < image.height; py++) {
    for (let px = 0; px < image.width; px++) {
      const dx = (px + chunk * 1152 - 128 - 768 + 0.5) / 64;
      const dy = (py - 192 + 0.5) / 32;
      const x = (dx + dy) / 2,
        y = (dy - dx) / 2;
      const cell = FOREST_ROAD.rows[Math.floor(y)]?.[Math.floor(x)] ?? ',';
      const material = cell === '~' ? 2 : cell === '^' || cell === 'r' ? 3 : cell === '=' ? 0 : 1;
      const sx = sample(x * 192) + (material % 2) * swatch;
      const sy = sample(y * 192) + Math.floor(material / 2) * swatch;
      const from = (sy * atlas.width + sx) * 4,
        to = (py * image.width + px) * 4;
      image.data.set(atlas.data.subarray(from, from + 4), to);
    }
  }
  writeFileSync(
    `${outDir}/ground-${chunk === 0 ? 'west' : 'east'}.webp`,
    await encodeWebp(image, 82),
  );
}
