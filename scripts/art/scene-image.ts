/** Pack an authored scene layer without changing its painted geometry.
 * npx tsx scripts/art/scene-image.ts <source.png> <output.webp> [maxWidth]
 * Alpha trim and uniform downscale only; registration belongs to the scene manifest.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { readImage } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { scaleBy } from './lib/scale';
import { encodeWebp } from './lib/webp';

const [source, output, widthArg = '768'] = process.argv.slice(2);
if (!source || !output) throw new Error('Provide source PNG and output WebP paths.');
const maxWidth = Number(widthArg);
if (!Number.isFinite(maxWidth) || maxWidth < 1 || maxWidth > 2048) {
  throw new Error('Maximum width must be between 1 and 2048.');
}
const raw = readImage(source);
const bounds = alphaBounds(raw);
if (!bounds) throw new Error('Source is empty.');
const trimmed = crop(raw, bounds);
const scale = Math.min(1, maxWidth / trimmed.width, 2048 / trimmed.height);
const packed = scaleBy(trimmed, scale);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, await encodeWebp(packed, 88, true));
console.log(JSON.stringify({ source, bounds, scale, width: packed.width, height: packed.height }));
