/** Split and pack the three Cutting character sheets without retouching their art.
 * Usage: cutting-characters.ts NAME COMBAT_SOURCE WALK_SOURCE [NEAR_PASSING_SOURCE]
 * The two opposed passing poses come from cells 1/3 of a guided 2x2 walk sheet.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import { readPng, writePng } from './lib/image';
import { splitGrid } from './split-sheet';
import { main as pack } from './pack';
import { alphaBounds, crop } from './lib/trim';
import { scaleBy } from './lib/scale';
import { BASELINE, MARGIN, placeOnBaseline } from './lib/align';

const [name, source, walkSource, nearPassingSource] = process.argv.slice(2);
if (!name || !source || !walkSource || !['ruon', 'merc', 'sergeant'].includes(name))
  throw new Error(
    'Usage: cutting-characters.ts NAME COMBAT_SOURCE WALK_SOURCE [NEAR_PASSING_SOURCE]',
  );
const key = name === 'ruon' ? 'unit.ally.ruon' : `unit.enemy.${name}`;
const cells = splitGrid(readPng(source), 3, 3);
const poses = [
  'idle/0',
  'idle/1',
  'walk/0',
  'walk/1',
  'cast/0',
  'cast/1',
  'cast/2',
  'hit/0',
  'ko/0',
];
for (const [index, pose] of poses.entries()) {
  const cell = cells[index];
  if (!cell) throw new Error(`Missing source cell ${pose}`);
  const path = join('art/raw', key, `${pose}.png`);
  mkdirSync(dirname(path), { recursive: true });
  writePng(path, cell);
}
// Heroes' 121 px cels receive a 1.25 oblique runtime scale. These nondirectional
// actors need 151 px standing art to share their adult height, not smaller bodies
// to accommodate weapon reach. Preserve one scale across every combat pose.
const idleHeight = 151;
const sourceIdle = cells[0] && alphaBounds(cells[0]);
if (!sourceIdle || sourceIdle.height < idleHeight) throw new Error('Standing source is too small');
const combatScale = idleHeight / sourceIdle.height;
const scaled = cells.map((cell) => {
  const bounds = alphaBounds(cell);
  if (!bounds) throw new Error('Empty combat pose');
  return scaleBy(crop(cell, bounds), combatScale);
});
const guided = splitGrid(readPng(walkSource), 2, 2);
const selected = [guided[1], guided[3]];
if (selected.some((cell) => !cell)) throw new Error('Missing walk contact');
const heights = selected.map((cell) => (cell && alphaBounds(cell)?.height) || 0);
if (Math.min(...heights) === 0 || Math.max(...heights) / Math.min(...heights) > 1.15)
  throw new Error('Walking height drift exceeds 15 percent');
const commonScale = idleHeight / Math.max(...heights);
for (let index = 0; index < 2; index++) {
  const separateSource = index === 0 && nearPassingSource;
  const cell = separateSource ? readPng(separateSource) : selected[index];
  const bounds = cell && alphaBounds(cell);
  if (!cell || !bounds) throw new Error('Empty walking pose');
  const scale = separateSource ? idleHeight / bounds.height : commonScale;
  if (scale > 1) throw new Error('Walking source is too small');
  scaled[2 + index] = scaleBy(crop(cell, bounds), scale);
}
const extents = scaled.map((cell) => {
  const bounds = alphaBounds(cell);
  if (!bounds) throw new Error('Empty scaled pose');
  return bounds;
});
const width = Math.max(128, Math.max(...extents.map((b) => b.width)) + 2 * MARGIN);
let height = 192;
while (Math.round(height * BASELINE) < Math.max(...extents.map((b) => b.height)) + MARGIN) height++;
console.log(
  `${key}: declared frame ${width}x${height}, standing height ${idleHeight}, combat scale ${combatScale}`,
);
for (const [index, pose] of poses.entries()) {
  const cell = scaled[index];
  if (!cell) throw new Error('Missing scaled pose');
  const placed = placeOnBaseline(cell, width, height);
  if (placed.problems.length) throw new Error(placed.problems.join('; '));
  const path = join('art/normalised', key, `${pose}.png`);
  mkdirSync(dirname(path), { recursive: true });
  writePng(path, placed.image);
}
if (pack(['--unit', key, '--name', name]) !== 0) throw new Error('Packing failed');
// A single measured lossless packing pass keeps the adult-scale art inside
// ADR 0032's units budget. Default strategy 3 costs 7,379 extra bytes here.
const pngPath = `public/art/units/${name}.png`;
writeFileSync(
  pngPath,
  PNG.sync.write(PNG.sync.read(readFileSync(pngPath)), {
    deflateLevel: 9,
    deflateStrategy: 0,
  }),
);
// Alias atlas rectangles, not frame names: content validation requires each
// clip to retain its own key/clip/index vocabulary. No duplicate bitmap bytes.
const atlasPath = `public/art/units/${name}.json`;
const atlas = JSON.parse(readFileSync(atlasPath, 'utf8')) as {
  frames: Record<string, unknown>;
};
for (let index = 0; index < 2; index++)
  atlas.frames[`${key}/melee/${index}`] = atlas.frames[`${key}/cast/${index}`];
writeFileSync(atlasPath, `${JSON.stringify(atlas, null, 2)}\n`);
