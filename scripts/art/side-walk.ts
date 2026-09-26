/** Append four lateral walk cels while preserving every existing action and north/south pose.
 * Usage: node --import tsx scripts/art/side-walk.ts NAME SOURCE.png
 * Kaya and Sura reuse their existing riverside cels when SOURCE is omitted.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CHARACTERS } from '../../src/content/characters';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import { placeOnBaseline } from './lib/align';
import { newImage, pixelAt, readPng, setPixel, writePng } from './lib/image';
import type { Image } from './lib/image';
import { scaleBy } from './lib/scale';
import { alphaBounds, crop } from './lib/trim';
import { splitGrid } from './split-sheet';

function readFrames(stem: string): Map<string, Image> {
  const atlas = parseAtlasJson(readFileSync(`${stem}.json`, 'utf8'));
  const image = readPng(`${stem}.png`);
  return new Map(
    [...atlas.frames].map(([id, r]) => [
      id,
      crop(image, { x: r.x, y: r.y, width: r.w, height: r.h }),
    ]),
  );
}

export function packSideWalk(name: string, input?: string): void {
  const character = CHARACTERS.find((c) => c.sprite.split('.').at(-1) === name);
  if (!character) throw new Error(`Unknown hero ${name}`);
  const key = character.sprite;
  const frames = readFrames(`assets/reference/character-locomotion/locomotion-${name}`);
  const idle = frames.get(`${key}/idle/0`);
  const height = idle && alphaBounds(idle)?.height;
  if (!height) throw new Error('Missing standing reference');

  // Kaya, Sura and Bo walk from their PixelLab G sets (scripts/art/g-sprites.ts,
  // ADR 0050 and ADR 0051); their walking-<name> sheets are retired.
  if (['kaya', 'sura', 'bo'].includes(name)) throw new Error(`${name} walks from the G set`);
  if (!input) throw new Error('Supply a transparent 2x2 walk sheet');
  const cells = splitGrid(readPng(input), 2, 2);
  const bounds = cells.map((cell) => alphaBounds(cell));
  if (bounds.some((b) => !b)) throw new Error('Empty walk cel');
  const heights = bounds.map((b) => b?.height ?? 0);
  if (Math.max(...heights) / Math.min(...heights) > 1.15)
    throw new Error('Walk changes height by over 15 percent; regenerate the sheet');
  // Common scale: the passing pose is allowed to shorten, never inflated.
  const scale = Math.min(1, height / Math.max(...heights));
  if (Math.max(...heights) < height)
    throw new Error('Source is too small; regenerate at higher resolution');
  cells.forEach((cell, i) => {
    const b = bounds[i];
    if (!b) throw new Error('Empty walk cel');
    const placed = placeOnBaseline(scaleBy(crop(cell, b), scale), 128, 192);
    if (placed.problems.length) throw new Error(placed.problems.join('; '));
    frames.set(`${key}/walk/${i}`, placed.image);
  });

  const columns = 8;
  const output = newImage(columns * 128, Math.ceil(frames.size / columns) * 192);
  const rectangles: Record<string, { frame: { x: number; y: number; w: number; h: number } }> = {};
  let index = 0;
  for (const [id, frame] of frames) {
    const x0 = (index % columns) * 128;
    const y0 = Math.floor(index++ / columns) * 192;
    for (let y = 0; y < 192; y++)
      for (let x = 0; x < 128; x++) setPixel(output, x0 + x, y0 + y, pixelAt(frame, x, y));
    rectangles[id] = { frame: { x: x0, y: y0, w: 128, h: 192 } };
  }
  const stem = `walking-${name}`;
  writePng(`public/art/units/${stem}.png`, output);
  writeFileSync(
    `public/art/units/${stem}.json`,
    JSON.stringify(
      {
        frames: rectangles,
        meta: { image: `${stem}.png`, size: { w: output.width, h: output.height } },
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`${stem}: ${frames.size} poses, four side steps, original cels preserved`);
}

if (process.argv[1]?.endsWith('side-walk.ts')) {
  const [name, input] = process.argv.slice(2);
  if (!name) throw new Error('Supply a hero name');
  packSideWalk(name, input);
}
