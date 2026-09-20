/** Pack transparent idle NPC art into the existing square image contract. */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { placeOnBaseline } from './lib/align';
import { readImage, writePng } from './lib/image';
import { scaleBy } from './lib/scale';
import { alphaBounds, crop } from './lib/trim';

const [name, input, out = 'public/art/npcs'] = process.argv.slice(2);
if (!name || !input || !['mira', 'gao', 'pella', 'dorin'].includes(name))
  throw new Error('Usage: npc.ts mira|gao|pella|dorin INPUT.png [OUTPUT_DIRECTORY]');
const source = readImage(input);
const bounds = alphaBounds(source);
if (!bounds) throw new Error('The NPC image is empty.');
if (!source.data.some((value, index) => index % 4 === 3 && value === 0))
  throw new Error('The NPC needs a transparent background; regenerate with alpha.');
const frame = 256;
const height = name === 'pella' ? 0.58 : 0.8;
const factor = Math.min(1, (frame * 0.85) / bounds.width, (frame * height) / bounds.height);
const placed = placeOnBaseline(scaleBy(crop(source, bounds), factor), frame, frame);
if (placed.problems.length) throw new Error(placed.problems.join('; '));
mkdirSync(out, { recursive: true });
writePng(join(out, `${name}.png`), placed.image);
console.log(`wrote ${name}: ${frame}x${frame}, transparent, baseline 85%`);
