/** Pack painted material swatches onto the exact Ba Dan logical footprint.
 * npx tsx scripts/art/ba-dan-ground.ts <four-quadrant-materials.png>
 * Source pixels are sampled in ground coordinates; buildings remain upright layers.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { BA_DAN_VILLAGE } from '../../src/content/maps/village';
import { BA_DAN_POND } from '../../src/content/scenes/baDan';
import { newImage, readImage } from './lib/image';
import { encodeWebp } from './lib/webp';

const source = process.argv[2];
if (!source) throw new Error('Provide the painted four-quadrant material atlas.');
const atlas = readImage(source);
const swatch = Math.floor(Math.min(atlas.width, atlas.height) / 2);
const edge = 3;
const period = swatch - edge * 2;
function sample(value: number): number {
  const wrapped = ((value % (period * 2)) + period * 2) % (period * 2);
  return edge + Math.min(period - 1, Math.floor(wrapped < period ? wrapped : period * 2 - wrapped));
}

const outDir = 'public/art/maps/ba-dan-scene';
mkdirSync(outDir, { recursive: true });
for (let chunk = 0; chunk < 2; chunk++) {
  const image = newImage(1408, 1536);
  for (let py = 0; py < image.height; py++) {
    for (let px = 0; px < image.width; px++) {
      const dx = (px + chunk * 1408 - 128 - 1024 + 0.5) / 64;
      const dy = (py - 192 + 0.5) / 32;
      const x = (dx + dy) / 2;
      const y = (dy - dx) / 2;
      const cell = BA_DAN_VILLAGE.rows[Math.floor(y)]?.[Math.floor(x)] ?? ',';
      const courtyard = x >= 8 && x < 15 && y >= 4 && y < 11;
      let material =
        cell === '~'
          ? 2
          : cell === 'w' || cell === 'B'
            ? 3
            : cell === '=' || cell === '.' || courtyard
              ? 0
              : 1;
      // A narrow coping remains inside the actual water footprint, never over a path.
      if (
        cell === '~' &&
        (x < BA_DAN_POND.x + 0.08 ||
          x > BA_DAN_POND.x + BA_DAN_POND.width - 0.08 ||
          y < BA_DAN_POND.y + 0.08 ||
          y > BA_DAN_POND.y + BA_DAN_POND.height - 0.08)
      )
        material = 0;
      const sx = sample(x * 192) + (material % 2) * swatch;
      const sy = sample(y * 192) + Math.floor(material / 2) * swatch;
      const from = (sy * atlas.width + sx) * 4;
      const to = (py * image.width + px) * 4;
      image.data.set(atlas.data.subarray(from, from + 4), to);
    }
  }
  const name = chunk === 0 ? 'ground-west' : 'ground-east';
  writeFileSync(`${outDir}/${name}.webp`, await encodeWebp(image, 82));
}
