/** Split the transparent 3x3 machine sheet before the normalise/pack stages.
 * Usage: node --import tsx scripts/art/grumbler-motion.ts SOURCE.png
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readPng, writePng } from './lib/image';
import { alphaBounds } from './lib/trim';
import { splitGrid } from './split-sheet';

const input = process.argv[2];
if (!input) throw new Error('Supply a transparent 3x3 Grumbler pose sheet');
const cells = splitGrid(readPng(input), 3, 3);
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
cells.forEach((cell, index) => {
  const pose = poses[index];
  const bounds = alphaBounds(cell);
  if (!pose || !bounds) throw new Error(`Missing pose ${index}`);
  if (
    bounds.x < 4 ||
    bounds.y < 4 ||
    bounds.x + bounds.width > cell.width - 4 ||
    bounds.y + bounds.height > cell.height - 4
  )
    throw new Error(`Clipped source ${pose}; regenerate with transparent margins`);
  const output = `art/raw/unit.enemy.grumbler/${pose}.png`;
  mkdirSync(dirname(output), { recursive: true });
  writePng(output, cell);
});
console.log('Grumbler: split nine complete poses');
