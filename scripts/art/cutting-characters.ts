/** Split and pack the three Cutting character sheets without retouching their art.
 * Usage: cutting-characters.ts NAME COMBAT_SOURCE WALK_SOURCE [NEAR_PASSING_SOURCE]
 * The two opposed passing poses come from cells 1/3 of a guided 2x2 walk sheet.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readPng, writePng } from './lib/image';
import { splitGrid } from './split-sheet';
import { main as normalise } from './normalise';
import { main as pack } from './pack';
import { alphaBounds, crop } from './lib/trim';
import { scaleBy } from './lib/scale';
import { placeOnBaseline } from './lib/align';

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
// The mercenary's full extended sabre needs 10% more horizontal room. Keep a
// common character scale across all combat cels instead of shrinking the strike.
if (
  normalise(['--unit', key, '--key', 'alpha', '--height', name === 'merc' ? '0.70' : '0.78']) !== 0
)
  throw new Error('Normalisation failed');
const idleHeight = alphaBounds(readPng(join('art/normalised', key, 'idle/0.png')))?.height;
if (!idleHeight) throw new Error('Missing standing reference');
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
  const placed = placeOnBaseline(scaleBy(crop(cell, bounds), scale), 128, 192);
  if (placed.problems.length) throw new Error(placed.problems.join('; '));
  writePng(join('art/normalised', key, `walk/${index}.png`), placed.image);
}
if (pack(['--unit', key, '--name', name]) !== 0) throw new Error('Packing failed');
// Alias atlas rectangles, not frame names: content validation requires each
// clip to retain its own key/clip/index vocabulary. No duplicate bitmap bytes.
const atlasPath = `public/art/units/${name}.json`;
const atlas = JSON.parse(readFileSync(atlasPath, 'utf8')) as {
  frames: Record<string, unknown>;
};
for (let index = 0; index < 2; index++)
  atlas.frames[`${key}/melee/${index}`] = atlas.frames[`${key}/cast/${index}`];
writeFileSync(atlasPath, `${JSON.stringify(atlas, null, 2)}\n`);
