/** Reuse the original terracotta prop; no painted pixels, scaling or new generation. */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { CEL_FRAMES, CEL_SIZE } from '../../src/content/fxCels';
import type { Image } from './lib/image';
import { newImage, pixelAt, readPng, setPixel, writePng } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { MARGIN } from './lib/align';

export const FLASK_SOURCE = 'public/art/props/flask.png';
export const FLASK_CELS = 'public/art/fx/flask-cels.png';

export function packFlask(source: Image): Image {
  const bounds = alphaBounds(source, 1);
  if (!bounds) throw new Error('Empty flask source');
  const flask = crop(source, bounds);
  if (Math.max(flask.width, flask.height) > CEL_SIZE - 2 * MARGIN)
    throw new Error('Flask source does not fit the existing cel gutter');
  const sheet = newImage(CEL_SIZE * CEL_FRAMES, CEL_SIZE);
  const left = Math.floor((CEL_SIZE - flask.width) / 2);
  const top = Math.floor((CEL_SIZE - flask.height) / 2);
  // One rigid vessel, not four changing silhouettes. The existing seeded
  // projectile rotation supplies motion on the same event clock.
  for (let frame = 0; frame < CEL_FRAMES; frame++)
    for (let y = 0; y < flask.height; y++)
      for (let x = 0; x < flask.width; x++)
        setPixel(sheet, frame * CEL_SIZE + left + x, top + y, pixelAt(flask, x, y));
  return sheet;
}

if (process.argv[1]?.endsWith('flask-cels.ts')) {
  const source = readPng(FLASK_SOURCE);
  writePng(FLASK_CELS, packFlask(source));
  console.log(
    JSON.stringify({
      source: FLASK_SOURCE,
      sourceSha256: createHash('sha256').update(readFileSync(FLASK_SOURCE)).digest('hex'),
      bounds: alphaBounds(source),
      output: FLASK_CELS,
      bytes: statSync(FLASK_CELS).size,
    }),
  );
}
