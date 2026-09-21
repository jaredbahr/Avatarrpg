/**
 * Cut a packed apron into the bands its scene registers.
 *
 * The scene lists `apronBands`' own rectangles as its ground pieces, and this
 * writes one WebP per rectangle from the single packed ring. The two cannot
 * drift because `apron-plates.test.ts` pins the scene's table to the geometry
 * and re-cuts the shipped files byte-for-byte.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Image } from './image';
import type { ApronBand } from './apron-bands';
import { crop } from './trim';
import { encodeWebp } from './webp';

export interface ApronPlatesOptions {
  /** The whole ring, as the scene's packer drew it. */
  readonly ring: Image;
  /** The bands, from the same table the scene registers. */
  readonly bands: readonly ApronBand[];
  /** Directory the scene's `url` prefix points at. */
  readonly directory: string;
  /** File stem; the band's index is appended. */
  readonly stem: string;
  /** WebP quality, matching what the single plate shipped at. */
  readonly quality: number;
}

export function apronPlatePath(directory: string, stem: string, index: number): string {
  return `${directory}/${stem}-${index}.webp`;
}

export async function writeApronPlates(options: ApronPlatesOptions): Promise<void> {
  mkdirSync(options.directory, { recursive: true });
  for (const [index, band] of options.bands.entries()) {
    const bytes = await encodeWebp(crop(options.ring, band), options.quality, true);
    writeFileSync(apronPlatePath(options.directory, options.stem, index), bytes);
  }
}
