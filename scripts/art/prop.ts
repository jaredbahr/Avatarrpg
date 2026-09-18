/** Pack one transparent prop into the square frame used by SpriteCache. */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { placeOnBaseline } from './lib/align';
import type { Image } from './lib/image';
import { newImage, pixelAt, readImage, setPixel, writePng } from './lib/image';
import { scaleBy } from './lib/scale';
import { alphaBounds, crop } from './lib/trim';

const FRAME = 256;
/** Maximum width and height as fractions of one tile; the flask stays small. */
const SIZES: Readonly<Record<string, readonly [number, number]>> = {
  barrel: [0.62, 0.68],
  flask: [0.42, 0.46],
  brazier: [0.64, 0.62],
  hay: [0.75, 0.48],
  rubble: [0.76, 0.5],
  cart: [0.94, 0.81],
};

export function normaliseProp(source: Image, name: string): Image {
  const size = SIZES[name];
  if (!size) throw new Error(`Unknown prop: ${name}`);
  const bounds = alphaBounds(source);
  if (!bounds) throw new Error('The prop image is empty.');
  if (!source.data.some((value, index) => index % 4 === 3 && value === 0))
    throw new Error('The prop needs a transparent background; regenerate with alpha.');
  const factor = Math.min(1, (FRAME * size[0]) / bounds.width, (FRAME * size[1]) / bounds.height);
  const placed = placeOnBaseline(scaleBy(crop(source, bounds), factor), FRAME, FRAME);
  if (placed.problems.length) throw new Error(placed.problems.join('; '));
  if (name === 'cart') {
    // The forward shafts extend below the wheel contact in the authored view.
    // Align the wheels with the runtime shadow, leaving the shafts in the clear
    // lower margin instead of making the load appear to float above the ground.
    const grounded = newImage(FRAME, FRAME);
    for (let y = 0; y < FRAME - 23; y++)
      for (let x = 0; x < FRAME; x++) setPixel(grounded, x, y + 23, pixelAt(placed.image, x, y));
    return grounded;
  }
  return placed.image;
}

if (process.argv[1]?.endsWith('prop.ts')) {
  const [name, input, out = 'public/art/props'] = process.argv.slice(2);
  if (!name || !input) throw new Error('Usage: prop.ts NAME INPUT.png [OUTPUT_DIRECTORY]');
  const image = normaliseProp(readImage(input), name);
  mkdirSync(out, { recursive: true });
  const path = join(out, `${name}.png`);
  writePng(path, image);
  console.log(`wrote ${path} (${FRAME}x${FRAME}, transparent, baseline 85%)`);
}
