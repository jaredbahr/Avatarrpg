/** Reproducibly pack the approved PixelLab prop-family-v1 sources. */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Image } from './lib/image';
import { newImage, pixelAt, readImage, setPixel, writePng } from './lib/image';
import { normaliseProp } from './prop';

const SOURCE = 'media/art-sources/prop-family-v1';
const OUTPUT = 'public/art/props';
const SHIPPED = ['barrel', 'cart', 'brazier', 'rubble', 'flask', 'hay'] as const;

/**
 * PixelLab delivered this family at 128 px. Expand the source samples without
 * interpolation so the established prop packer can perform its normal
 * premultiplied-alpha downsample into the 256 px registered frame.
 */
export function expandPropSource(source: Image, factor = 4): Image {
  const expanded = newImage(source.width * factor, source.height * factor);
  for (let y = 0; y < expanded.height; y++)
    for (let x = 0; x < expanded.width; x++)
      setPixel(expanded, x, y, pixelAt(source, Math.floor(x / factor), Math.floor(y / factor)));
  return expanded;
}

export function packPropFamily(source = SOURCE, output = OUTPUT): void {
  mkdirSync(output, { recursive: true });
  for (const name of SHIPPED) {
    const input = join(source, `${name}.png`);
    const target = join(output, `${name}.png`);
    writePng(target, normaliseProp(expandPropSource(readImage(input)), name));
    console.log(`wrote ${target} (256x256, transparent, baseline 85%)`);
  }
}

if (process.argv[1]?.endsWith('prop-family.ts')) packPropFamily();
