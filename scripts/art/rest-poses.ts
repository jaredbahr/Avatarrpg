/** Append three relaxed exploration poses; every existing frame stays pixel-identical.
 * npx tsx scripts/art/rest-poses.ts nima <three-column-transparent-sheet.png>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readPng, writePng, newImage, pixelAt, setPixel } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { scaleBy } from './lib/scale';
import { placeOnBaseline } from './lib/align';
import { splitGrid } from './split-sheet';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';

const [name, input] = process.argv.slice(2);
if (name !== 'nima' || !input)
  throw new Error('Pilot accepts nima and a transparent three-column PNG.');
const stem = `public/art/units/walking-${name}`;
const original = readPng(`${stem}.png`);
const atlas = parseAtlasJson(readFileSync(`${stem}.json`, 'utf8'));
const frames = [...atlas.frames].filter(([id]) => !id.includes('/rest'));
const idle = frames.find(([id]) => id.endsWith('/idle/0'));
if (!idle) throw new Error('Missing reference idle.');
const [idleId, rect] = idle;
const key = idleId.split('/')[0];
const standing = alphaBounds(
  crop(original, { x: rect.x, y: rect.y, width: rect.w, height: rect.h }),
);
if (!standing) throw new Error('Empty reference idle.');
const poses = splitGrid(readPng(input), 3, 1).map((cell) => {
  const bounds = alphaBounds(cell);
  if (!bounds) throw new Error('Empty rest pose.');
  return crop(cell, bounds);
});
const maxHeight = Math.max(...poses.map((pose) => pose.height));
if (maxHeight / Math.min(...poses.map((pose) => pose.height)) > 1.12) {
  throw new Error('Rest poses differ in height by more than 12%.');
}
const columns = original.width / 128;
const output = newImage(
  original.width,
  Math.max(original.height, Math.ceil((frames.length + 3) / columns) * 192),
);
output.data.set(original.data);
const rectangles: Record<string, { frame: { x: number; y: number; w: number; h: number } }> = {};
for (const [id, frame] of frames)
  rectangles[id] = { frame: { x: frame.x, y: frame.y, w: frame.w, h: frame.h } };
for (const [index, clip] of ['rest', 'restNorth', 'restSouth'].entries()) {
  const pose = poses[index];
  if (!pose) throw new Error('Missing rest pose.');
  const aligned = placeOnBaseline(scaleBy(pose, standing.height / maxHeight), 128, 192);
  if (aligned.problems.length) throw new Error(aligned.problems.join('; '));
  const slot = frames.length + index;
  const x0 = (slot % columns) * 128,
    y0 = Math.floor(slot / columns) * 192;
  for (let y = 0; y < 192; y++)
    for (let x = 0; x < 128; x++) setPixel(output, x0 + x, y0 + y, pixelAt(aligned.image, x, y));
  rectangles[`${key}/${clip}/0`] = { frame: { x: x0, y: y0, w: 128, h: 192 } };
}
for (const [, frame] of frames) {
  for (let y = frame.y; y < frame.y + frame.h; y++)
    for (let x = frame.x; x < frame.x + frame.w; x++) {
      if (pixelAt(original, x, y).some((value, index) => value !== pixelAt(output, x, y)[index]))
        throw new Error('Existing pose changed.');
    }
}
writePng(`${stem}.png`, output);
writeFileSync(
  `${stem}.json`,
  JSON.stringify(
    {
      frames: rectangles,
      meta: { image: `walking-${name}.png`, size: { w: output.width, h: output.height } },
    },
    null,
    2,
  ) + '\n',
);
console.log(`${name}: appended three rest poses; ${frames.length} original frames unchanged.`);
