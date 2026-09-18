/** Pack a generated 3×2 walk/wave sheet alongside a hero's existing poses.
 * Usage: node --import tsx scripts/art/riverside-motion.ts sura input.png
 * Alpha is preserved; every frame uses one scale and the established foot line.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readPng, writePng, newImage, pixelAt, setPixel } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { scaleBy } from './lib/scale';
import { placeOnBaseline } from './lib/align';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';

const [name, input] = process.argv.slice(2);
if (!name || !['sura', 'kaya'].includes(name) || !input)
  throw new Error('Supply sura or kaya, followed by the generated PNG.');
const key = `unit.village.${name}`;
const original = readPng(`assets/reference/character-poses/${name}.png`);
const atlas = parseAtlasJson(readFileSync(`assets/reference/character-poses/${name}.json`, 'utf8'));
const source = readPng(input);
if (source.width % 3 || source.height % 2) throw new Error('Expected a 3×2 sheet.');
const width = source.width / 3;
const height = source.height / 2;
const cells = Array.from({ length: 6 }, (_, i) =>
  crop(source, { x: (i % 3) * width, y: Math.floor(i / 3) * height, width, height }),
);
const first = [...atlas.frames.values()][0];
if (!first) throw new Error('Missing original idle frame.');
const standing = alphaBounds(
  crop(original, { x: first.x, y: first.y, width: first.w, height: first.h }),
);
const bounds = cells.map((cell) => alphaBounds(cell));
if (!standing || bounds.some((b) => !b)) throw new Error('Empty frame.');
const scale = standing.height / Math.max(...bounds.map((b) => b?.height ?? 0));
const frames = new Map<string, ReturnType<typeof readPng>>();
for (const [id, rect] of atlas.frames) {
  const suffix = id.slice(id.indexOf('/'));
  frames.set(key + suffix, crop(original, { x: rect.x, y: rect.y, width: rect.w, height: rect.h }));
}
cells.forEach((cell, i) => {
  const b = bounds[i];
  if (!b) throw new Error('Empty motion frame.');
  const placed = placeOnBaseline(scaleBy(crop(cell, b), scale), 128, 192);
  if (placed.problems.length) throw new Error(placed.problems.join('; '));
  frames.set(`${key}/${i < 4 ? 'walk' : 'wave'}/${i < 4 ? i : i - 4}`, placed.image);
});
const output = newImage(frames.size * 128, 192);
const rectangles: Record<string, { frame: { x: number; y: number; w: number; h: number } }> = {};
let index = 0;
for (const [id, frame] of frames) {
  const x0 = index++ * 128;
  for (let y = 0; y < 192; y++)
    for (let x = 0; x < 128; x++) setPixel(output, x0 + x, y, pixelAt(frame, x, y));
  rectangles[id] = { frame: { x: x0, y: 0, w: 128, h: 192 } };
}
const stem = `riverside-${name}`;
writePng(`assets/reference/character-poses/${stem}.png`, output);
writeFileSync(
  `assets/reference/character-poses/${stem}.json`,
  JSON.stringify(
    {
      frames: rectangles,
      meta: { image: `${stem}.png`, size: { w: output.width, h: output.height } },
    },
    null,
    2,
  ) + '\n',
);
console.log(`Packed ${frames.size} poses for ${name}.`);
