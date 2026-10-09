/**
 * Deterministic packer for the fine-grain Ba Dan upright art that is not a true
 * piece: the two older masters the Forest Road still borrows (the alder, `village-tree`, and the lodge, `dwelling`). The village's own
 * houses, stalls, planters and bridge are packed by `ba-dan-true-pieces.ts`.
 *
 * The PNGs in `art/source/ba-dan-restyle/fine/` are the authored assets. No
 * colour quantisation, pixel-art upscale, palette lock, or generated seating
 * is allowed here: contact shading belongs to each source at the characters'
 * grain.
 *
 * Pieces ship as lossy WebP with an exact alpha plane (see `encodeUprightWebp`);
 * the PNG sources stay lossless.
 *
 * Usage: node --import tsx scripts/art/ba-dan-restyle.ts [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { Image } from './lib/image';
import { readImage } from './lib/image';
import { encodeUprightWebp } from './lib/webp';

export const SOURCE_DIR = 'art/source/ba-dan-restyle';
export const OUTPUT_DIR = 'public/art/maps/ba-dan-scene';

/** Retained for callers that use the art bible's ink swatch. */
export const INK: readonly [number, number, number] = [0x1b, 0x14, 0x10];

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface FineAsset {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** Expected opaque envelope in source pixels (x/y are inclusive origin). */
  readonly opaque: Box;
  /** Expected lowest opaque row; this contact line is exact. */
  readonly footY: number;
  readonly tolerance: number;
}

/*
 * These are the registered scene sizes and the shipped design envelopes. A
 * source may have transparent breathing room, but it must retain the
 * registered canvas and land on the old design within two source pixels.
 */
const RESTYLE_BASE: readonly FineAsset[] = [
  {
    // Forest Road's lodge draws this file at 602x388 by canvas fraction, so the
    // conformed house sits inside the old canvas rather than cropping it.
    name: 'dwelling',
    width: 602,
    height: 388,
    opaque: { x: 42, y: 5, width: 509, height: 383 },
    footY: 387,
    tolerance: 2,
  },
  {
    name: 'village-tree',
    width: 750,
    height: 732,
    opaque: { x: 0, y: 0, width: 750, height: 732 },
    footY: 731,
    tolerance: 2,
  },
];

/**
 * Native-size trees: placed unscaled, so each canvas is its drawn size. They are validated here
 * but no longer shipped as files of their own: `ba-dan-trees-pack.ts` packs them, and the clumps
 * made from them, into `village-trees.webp`.
 */
export const TREE_ASSETS: readonly FineAsset[] = [
  {
    name: 'large-village-tree',
    width: 420,
    height: 410,
    opaque: { x: 2, y: 79, width: 417, height: 330 },
    footY: 408,
    tolerance: 0,
  },
  {
    name: 'medium-village-tree',
    width: 320,
    height: 312,
    opaque: { x: 15, y: 1, width: 292, height: 310 },
    footY: 310,
    tolerance: 0,
  },
  {
    name: 'small-village-tree',
    width: 260,
    height: 254,
    opaque: { x: 31, y: 2, width: 199, height: 251 },
    footY: 252,
    tolerance: 0,
  },
  {
    name: 'sapling-village-tree',
    width: 150,
    height: 165,
    opaque: { x: 25, y: 0, width: 99, height: 165 },
    footY: 164,
    tolerance: 0,
  },
];

export const RESTYLE_ASSETS: readonly FineAsset[] = RESTYLE_BASE;

function sameBox(a: Box, b: Box, tolerance: number): boolean {
  return (
    Math.abs(a.x - b.x) <= tolerance &&
    Math.abs(a.y - b.y) <= tolerance &&
    Math.abs(a.x + a.width - (b.x + b.width)) <= tolerance &&
    Math.abs(a.y + a.height - (b.y + b.height)) <= tolerance
  );
}

/** Bounds of pixels with alpha > 0. */
export function alphaBox(image: Image): Box {
  let x0 = image.width;
  let y0 = image.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if ((image.data[(y * image.width + x) * 4 + 3] ?? 0) === 0) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) throw new Error('Fine source has no opaque pixels.');
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Lowest opaque row anywhere in an image, or -1 for an empty image. */
export function footLine(image: Image): number {
  for (let y = image.height - 1; y >= 0; y--)
    for (let x = 0; x < image.width; x++)
      if ((image.data[(y * image.width + x) * 4 + 3] ?? 0) !== 0) return y;
  return -1;
}

/** Validate the authored source before it is allowed into a shipped texture. */
export function validateFineImage(image: Image, asset: FineAsset): void {
  if (image.width !== asset.width || image.height !== asset.height)
    throw new Error(
      `${asset.name}: fine source is ${image.width}x${image.height}; expected ${asset.width}x${asset.height}.`,
    );
  for (let i = 3; i < image.data.length; i += 4) {
    const alpha = image.data[i] ?? 0;
    if (alpha !== 0 && alpha !== 255)
      throw new Error(`${asset.name}: alpha must be binary; found ${alpha} at byte ${i}.`);
  }
  const actual = alphaBox(image);
  if (!sameBox(actual, asset.opaque, asset.tolerance))
    throw new Error(
      `${asset.name}: opaque bounds ${JSON.stringify(actual)} differ from ${JSON.stringify(asset.opaque)} by more than ${asset.tolerance}px.`,
    );
  const foot = footLine(image);
  if (foot !== asset.footY)
    throw new Error(`${asset.name}: foot line ${foot} differs from required ${asset.footY}px.`);
}

function cloneImage(image: Image): Image {
  return { width: image.width, height: image.height, data: new Uint8Array(image.data) };
}

/** Pack one fine source without changing its dimensions or pixel grain. */
export function packAsset(asset: FineAsset): Image {
  const image = readImage(`${SOURCE_DIR}/fine/${asset.name}.png`);
  validateFineImage(image, asset);
  return cloneImage(image);
}

/** Every output written by the packer. */
export function packOutputs(): { name: string; image: Image }[] {
  return RESTYLE_ASSETS.map((asset) => ({ name: asset.name, image: packAsset(asset) }));
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  let failed = false;
  for (const { name, image } of packOutputs()) {
    const output = `${OUTPUT_DIR}/${name}.webp`;
    if (check) {
      const expected = await encodeUprightWebp(image);
      const shipped = new Uint8Array(readFileSync(output));
      const same =
        shipped.length === expected.length &&
        shipped.every((value, index) => value === expected[index]);
      console.log(`${name}: ${same ? 'matches' : 'DIFFERS'}`);
      if (!same) failed = true;
    } else {
      writeFileSync(output, await encodeUprightWebp(image));
      console.log(JSON.stringify({ asset: name, width: image.width, height: image.height }));
    }
  }
  if (failed) process.exit(1);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/art/ba-dan-restyle.ts')) await main();
