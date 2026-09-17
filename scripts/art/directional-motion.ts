/** Add a transparent 5x2 front/back sheet without altering existing poses.
 * Rows: south, north. Columns: standing idle, four walk drawings.
 * Usage: node --import tsx scripts/art/directional-motion.ts kaya SOURCE.png
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readPng, writePng, newImage, pixelAt, setPixel } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { scaleBy } from './lib/scale';
import { placeOnBaseline } from './lib/align';
import { splitGrid } from './split-sheet';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';

export function packDirectional(name: string, input: string, village = false): void {
  const originalStem = village ? `riverside-${name}` : name;
  const outputStem = village ? `riverside-locomotion-${name}` : `locomotion-${name}`;
  const original = readPng(`public/art/units/${originalStem}.png`);
  const atlas = parseAtlasJson(readFileSync(`public/art/units/${originalStem}.json`, 'utf8'));
  const idle = [...atlas.frames.entries()].find(([id]) => id.endsWith('/idle/0'));
  if (!idle) throw new Error('The existing sheet must have an idle pose.');
  const [idleId, rect] = idle;
  const key = idleId.slice(0, idleId.indexOf('/'));
  const standing = alphaBounds(
    crop(original, { x: rect.x, y: rect.y, width: rect.w, height: rect.h }),
  );
  if (!standing) throw new Error('The existing idle is empty.');
  const cells = splitGrid(readPng(input), 5, 2);
  const bounds = cells.map((cell) => alphaBounds(cell));
  if (bounds.some((b) => !b)) throw new Error('A directional pose is empty.');
  const heights = bounds.map((b) => b?.height ?? 0);
  if (Math.max(...heights) / Math.min(...heights) > 1.15)
    throw new Error('Directional poses change scale by over 15%; regenerate the sheet.');
  // A single scale for the whole character preserves its build and gait.
  const scale = standing.height / Math.max(...heights);
  const frames = new Map<string, ReturnType<typeof readPng>>();
  for (const [id, r] of atlas.frames)
    frames.set(id, crop(original, { x: r.x, y: r.y, width: r.w, height: r.h }));
  cells.forEach((cell, i) => {
    const b = bounds[i];
    if (!b) throw new Error('Missing directional silhouette.');
    const pose = placeOnBaseline(scaleBy(crop(cell, b), scale), 128, 192);
    if (pose.problems.length) throw new Error(pose.problems.join('; '));
    const direction = i < 5 ? 'South' : 'North';
    const col = i % 5;
    frames.set(
      `${key}/${col === 0 ? 'idle' : 'walk'}${direction}/${col === 0 ? 0 : col - 1}`,
      pose.image,
    );
  });
  const columns = Math.min(8, frames.size);
  const output = newImage(columns * 128, Math.ceil(frames.size / columns) * 192);
  const rectangles: Record<string, { frame: { x: number; y: number; w: number; h: number } }> = {};
  let index = 0;
  for (const [id, frame] of frames) {
    const x0 = (index % columns) * 128,
      y0 = Math.floor(index / columns) * 192;
    index++;
    for (let y = 0; y < 192; y++)
      for (let x = 0; x < 128; x++) setPixel(output, x0 + x, y0 + y, pixelAt(frame, x, y));
    rectangles[id] = { frame: { x: x0, y: y0, w: 128, h: 192 } };
  }
  writePng(`public/art/units/${outputStem}.png`, output);
  writeFileSync(
    `public/art/units/${outputStem}.json`,
    JSON.stringify(
      {
        frames: rectangles,
        meta: { image: `${outputStem}.png`, size: { w: output.width, h: output.height } },
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `${outputStem}: ${frames.size} poses, ${output.width}x${output.height}, original poses preserved`,
  );
}

if (process.argv[1]?.endsWith('directional-motion.ts')) {
  const [name, input] = process.argv.slice(2);
  if (
    !name ||
    !input ||
    !['kaya', 'tenzo', 'nilak', 'sura', 'bo', 'linmei', 'nima', 'jinu', 'riko', 'wen'].includes(
      name,
    )
  )
    throw new Error('Supply a playable hero name and transparent 5x2 PNG.');
  packDirectional(name, input);
  if (name === 'kaya' || name === 'sura') packDirectional(name, input, true);
}
