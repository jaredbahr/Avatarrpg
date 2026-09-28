/**
 * Ba Dan's upright scenery, restyled by direction B of the style study
 * (docs/art/ba-dan-scene.md, "Restyle"): a PixelLab redraw at the 2-screen-px
 * grain, palette-locked to the piece it replaces, quantised, inked and packed
 * nearest-upscaled so the linearly filtered scenery keeps its pixel grain.
 *
 * Every step is deterministic and needs nothing but the two tracked sources
 * per asset in `art/source/ba-dan-restyle/`:
 *
 * - `pixellab/<name>.png` is the chosen `image_to_pixelart` redraw, exactly as
 *   PixelLab returned it (job, seed and settings in `pins.json`);
 * - `shipped/<name>.png` is the pre-restyle texture, losslessly decoded. It is
 *   the chroma source: the redraw keeps its own stepped luminance, but takes
 *   its colour from the approved Ba Dan materials at the same place, because
 *   PixelLab alone pushes the jade roof teal and the timber orange.
 *
 * Then, per asset: key the redraw's flat background away from the border, crop
 * to it, lock the palette, quantise to 32 colours with no dither, turn the
 * redraw's darkest line and the silhouette into the bible ink `#1b1410`, drop
 * isolated specks, vary a few repeated tiles or baskets (`VARIATIONS`), and
 * scale up by a whole number with no resampling. No step draws by hand.
 *
 * Usage: node --import tsx scripts/art/ba-dan-restyle.ts [--check]
 * `--check` re-packs every asset and fails if a shipped file's pixels differ.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { Image } from './lib/image';
import { newImage, readImage } from './lib/image';
import { scaleTo } from './lib/scale';
import { decodeWebp, encodeWebpLossless } from './lib/webp';

export const SOURCE_DIR = 'art/source/ba-dan-restyle';
export const OUTPUT_DIR = 'public/art/maps/ba-dan-scene';

/** The bible's one ink. */
export const INK: readonly [number, number, number] = [0x1b, 0x14, 0x10];
export const COLOURS = 32;
/** A redraw pixel darker than this (0..255 luma) is its own line work: it becomes ink. */
export const LINE_LUMA = 26;
/** How far from the redraw's flat background a border-connected pixel may be and still be keyed. */
export const KEY_TOLERANCE = 18;

/** A rectangle in the cropped redraw's texels whose colours step one shade lighter or darker. */
export interface Variation {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Multiplies the pixel's colour before it snaps back to the asset's own palette. */
  readonly shade: number;
}

export interface RestyleAsset {
  readonly name: string;
  /** How much of the redraw's own chroma survives the lock (0 = all from the shipped piece). */
  readonly keep: number;
  /** The whole-number nearest upscale the texture ships at. */
  readonly scale: number;
  /**
   * Also key background pockets the silhouette encloses. Only the tree has
   * them (sky between the boughs); on a house the same grey is stone.
   */
  readonly holes?: boolean;
  readonly variations: readonly Variation[];
}

export const RESTYLE_ASSETS: readonly RestyleAsset[] = [
  {
    name: 'merchant-house',
    keep: 0.35,
    scale: 2,
    // Two short runs of roof tile, one weathered darker and one bleached.
    variations: [
      { x: 150, y: 45, width: 12, height: 15, shade: 0.88 },
      { x: 200, y: 55, width: 12, height: 15, shade: 1.12 },
    ],
  },
  {
    name: 'dwelling',
    keep: 0.35,
    scale: 2,
    variations: [
      { x: 150, y: 40, width: 12, height: 15, shade: 0.9 },
      { x: 215, y: 55, width: 13, height: 15, shade: 1.1 },
    ],
  },
  {
    name: 'merchant-display',
    keep: 0.3,
    scale: 4,
    // The six baskets repeat orange, pear, apple twice; the second orange and
    // pear baskets come out a shade apart from the first.
    variations: [
      { x: 53, y: 18, width: 18, height: 17, shade: 0.88 },
      { x: 71, y: 27, width: 18, height: 15, shade: 1.12 },
    ],
  },
  {
    name: 'low-planter',
    keep: 0.7,
    scale: 4,
    // One kerb block of the evenly repeated run, a shade cooler.
    variations: [{ x: 58, y: 40, width: 14, height: 10, shade: 0.93 }],
  },
  { name: 'village-tree', keep: 0.5, scale: 3, holes: true, variations: [] },
  { name: 'canal-bridge', keep: 0.5, scale: 4, variations: [] },
];

type Rgb = [number, number, number];

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * The redraw arrives on an opaque flat grey, sometimes with a stray one-pixel
 * frame. The outermost ring is always background; from it, flood every pixel
 * within `KEY_TOLERANCE` of the border's commonest colour. Interior greys
 * (stone, plaster) are not connected to the border, so they survive.
 */
export function keyBackground(image: Image, holes = false): Uint8Array {
  const { width, height, data } = image;
  const counts = new Map<number, number>();
  const ring = (x: number, y: number): void => {
    const i = (y * width + x) * 4;
    const key = ((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (let x = 1; x < width - 1; x++) {
    ring(x, 1);
    ring(x, height - 2);
  }
  for (let y = 1; y < height - 1; y++) {
    ring(1, y);
    ring(width - 2, y);
  }
  let best = 0;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount || (count === bestCount && key < best)) {
      best = key;
      bestCount = count;
    }
  }
  const bg: Rgb = [(best >> 16) & 255, (best >> 8) & 255, best & 255];
  const near = (p: number): boolean => {
    const i = p * 4;
    if ((data[i + 3] ?? 0) < 128) return true;
    return (
      Math.max(
        Math.abs((data[i] ?? 0) - bg[0]),
        Math.abs((data[i + 1] ?? 0) - bg[1]),
        Math.abs((data[i + 2] ?? 0) - bg[2]),
      ) <= KEY_TOLERANCE
    );
  };
  const clear = new Uint8Array(width * height);
  const stack: number[] = [];
  for (let x = 0; x < width; x++) {
    stack.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    stack.push(y * width, y * width + width - 1);
  }
  const isRing = (p: number): boolean => {
    const x = p % width;
    const y = (p - x) / width;
    return x === 0 || y === 0 || x === width - 1 || y === height - 1;
  };
  if (holes) {
    for (let p = 0; p < width * height; p++) if (near(p)) stack.push(p);
  }
  while (stack.length > 0) {
    const p = stack.pop() ?? 0;
    if (clear[p] || !(isRing(p) || near(p))) continue;
    clear[p] = 1;
    const x = p % width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (p >= width) stack.push(p - width);
    if (p < width * (height - 1)) stack.push(p + width);
  }
  const mask = new Uint8Array(width * height);
  for (let p = 0; p < mask.length; p++) mask[p] = clear[p] ? 0 : 1;
  return mask;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function maskBounds(mask: Uint8Array, width: number): Box {
  const height = mask.length / width;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) throw new Error('The redraw keyed to nothing.');
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** The shipped texture's opaque bounds (alpha above half). */
export function alphaBox(image: Image): Box {
  const mask = new Uint8Array(image.width * image.height);
  for (let p = 0; p < mask.length; p++) mask[p] = (image.data[p * 4 + 3] ?? 0) > 127 ? 1 : 0;
  return maskBounds(mask, image.width);
}

function cropImage(image: Image, box: Box): Image {
  const out = newImage(box.width, box.height);
  for (let y = 0; y < box.height; y++) {
    const from = ((box.y + y) * image.width + box.x) * 4;
    out.data.set(image.data.subarray(from, from + box.width * 4), y * box.width * 4);
  }
  return out;
}

function cropMask(mask: Uint8Array, width: number, box: Box): Uint8Array {
  const out = new Uint8Array(box.width * box.height);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      out[y * box.width + x] = mask[(box.y + y) * width + box.x + x] ?? 0;
    }
  }
  return out;
}

/** Separable Gaussian, sigma 1, radius 3, edges clamped. */
function blur(channel: Float64Array, width: number, height: number): Float64Array {
  const kernel = [-3, -2, -1, 0, 1, 2, 3].map((d) => Math.exp(-(d * d) / 2));
  const sum = kernel.reduce((a, b) => a + b, 0);
  const k = kernel.map((v) => v / sum);
  const pass = (input: Float64Array, horizontal: boolean): Float64Array => {
    const out = new Float64Array(input.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let acc = 0;
        for (let d = -3; d <= 3; d++) {
          const xx = horizontal ? Math.min(width - 1, Math.max(0, x + d)) : x;
          const yy = horizontal ? y : Math.min(height - 1, Math.max(0, y + d));
          acc += (k[d + 3] ?? 0) * (input[yy * width + xx] ?? 0);
        }
        out[y * width + x] = acc;
      }
    }
    return out;
  };
  return pass(pass(channel, true), false);
}

/**
 * Keep the redraw's luminance, take its chroma (YCbCr) from the shipped
 * texture at the same place. The shipped piece is box-scaled onto the
 * redraw's cropped frame, softened one texel so a misregistered line does not
 * print its colour, and weighted by its own coverage so where the redraw
 * overhangs it the redraw keeps its colour.
 */
export function lockPalette(
  redraw: Image,
  mask: Uint8Array,
  shipped: Image,
  keep: number,
): Float64Array {
  const { width, height } = redraw;
  const guide = scaleTo(cropImage(shipped, alphaBox(shipped)), width, height);
  const n = width * height;
  const sr = new Float64Array(n);
  const sg = new Float64Array(n);
  const sb = new Float64Array(n);
  const sa = new Float64Array(n);
  for (let p = 0; p < n; p++) {
    sr[p] = guide.data[p * 4] ?? 0;
    sg[p] = guide.data[p * 4 + 1] ?? 0;
    sb[p] = guide.data[p * 4 + 2] ?? 0;
    sa[p] = (guide.data[p * 4 + 3] ?? 0) / 255;
  }
  const [br, bg, bb, ba] = [sr, sg, sb, sa].map((c) => blur(c, width, height));
  const out = new Float64Array(n * 3);
  for (let p = 0; p < n; p++) {
    if (!mask[p]) continue;
    const r = redraw.data[p * 4] ?? 0;
    const g = redraw.data[p * 4 + 1] ?? 0;
    const b = redraw.data[p * 4 + 2] ?? 0;
    const y = luma(r, g, b);
    const cb = (b - y) * 0.564;
    const cr = (r - y) * 0.713;
    const gy = luma(br?.[p] ?? 0, bg?.[p] ?? 0, bb?.[p] ?? 0);
    const scb = ((bb?.[p] ?? 0) - gy) * 0.564;
    const scr = ((br?.[p] ?? 0) - gy) * 0.713;
    const w = Math.min(1, Math.max(0, ba?.[p] ?? 0)) * (1 - keep);
    const ocb = cb * (1 - w) + scb * w;
    const ocr = cr * (1 - w) + scr * w;
    const or = y + ocr / 0.713;
    const ob = y + ocb / 0.564;
    const og = (y - 0.299 * or - 0.114 * ob) / 0.587;
    out[p * 3] = Math.min(255, Math.max(0, or));
    out[p * 3 + 1] = Math.min(255, Math.max(0, og));
    out[p * 3 + 2] = Math.min(255, Math.max(0, ob));
  }
  return out;
}

/** Perceptual weights for nearest-colour snapping (sqrt of the luma weights). */
const WEIGHT: Rgb = [Math.sqrt(0.3), Math.sqrt(0.59), Math.sqrt(0.11)];

function distance(a: readonly number[], b: readonly number[]): number {
  let d = 0;
  for (let c = 0; c < 3; c++) {
    const v = ((a[c] ?? 0) - (b[c] ?? 0)) * WEIGHT[c]!;
    d += v * v;
  }
  return d;
}

export function nearest(colour: readonly number[], palette: readonly Rgb[]): number {
  let best = 0;
  let bestD = Infinity;
  palette.forEach((p, i) => {
    const d = distance(colour, p);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/**
 * Median cut to `count` colours, no dither: split the box with the widest
 * weighted channel range at its pixel median until there are enough boxes,
 * and paint each with its mean. Ties break on box order, so it is repeatable.
 */
export function medianCut(pixels: readonly Rgb[], count: number): Rgb[] {
  let boxes: Rgb[][] = [pixels.slice()];
  const range = (box: Rgb[]): { channel: number; span: number } => {
    let channel = 0;
    let span = -1;
    for (let c = 0; c < 3; c++) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const p of box) {
        lo = Math.min(lo, p[c]!);
        hi = Math.max(hi, p[c]!);
      }
      const s = (hi - lo) * WEIGHT[c]!;
      if (s > span) {
        span = s;
        channel = c;
      }
    }
    return { channel, span };
  };
  while (boxes.length < count) {
    let pick = -1;
    let pickScore = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      const score = range(box).span * Math.sqrt(box.length);
      if (score > pickScore) {
        pickScore = score;
        pick = i;
      }
    });
    if (pick < 0) break;
    const box = boxes[pick]!;
    const { channel } = range(box);
    const sorted = box
      .slice()
      .sort((a, b) => a[channel]! - b[channel]! || a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    const mid = sorted.length >> 1;
    boxes = [
      ...boxes.slice(0, pick),
      sorted.slice(0, mid),
      sorted.slice(mid),
      ...boxes.slice(pick + 1),
    ];
  }
  return boxes.map((box) => {
    const sum = [0, 0, 0];
    for (const p of box) for (let c = 0; c < 3; c++) sum[c]! += p[c]!;
    return sum.map((v) => Math.round(v / box.length)) as Rgb;
  });
}

const NEIGHBOURS_4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Restyle one redraw against the texture it replaces, at the redraw's own
 * grain (before the ship upscale). Returns the flat RGBA and its palette.
 */
export function restyle(
  redraw: Image,
  shipped: Image,
  asset: RestyleAsset,
): { image: Image; palette: Rgb[] } {
  const fullMask = keyBackground(redraw, asset.holes);
  const box = maskBounds(fullMask, redraw.width);
  const art = cropImage(redraw, box);
  const mask = cropMask(fullMask, redraw.width, box);
  const { width, height } = art;
  const n = width * height;
  const locked = lockPalette(art, mask, shipped, asset.keep);

  const pixels: Rgb[] = [];
  for (let p = 0; p < n; p++) {
    if (mask[p])
      pixels.push([locked[p * 3]!, locked[p * 3 + 1]!, locked[p * 3 + 2]!].map(Math.round) as Rgb);
  }
  const palette = medianCut(pixels, COLOURS);
  const index = new Int16Array(n).fill(-1);
  for (let p = 0; p < n; p++) {
    if (mask[p])
      index[p] = nearest([locked[p * 3]!, locked[p * 3 + 1]!, locked[p * 3 + 2]!], palette);
  }

  // Specks: a pixel whose four neighbours are all one other colour takes it.
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= width || y >= height ? -1 : index[y * width + x]!;
  const cleaned = index.slice();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const self = at(x, y);
      if (self < 0) continue;
      const around = NEIGHBOURS_4.map(([dx, dy]) => at(x + dx, y + dy));
      const first = around[0]!;
      if (first >= 0 && first !== self && around.every((v) => v === first))
        cleaned[y * width + x] = first;
    }
  }

  // Variations: step a few repeated tiles or baskets a shade, back onto the palette.
  for (const v of asset.variations) {
    for (let y = v.y; y < v.y + v.height; y++) {
      for (let x = v.x; x < v.x + v.width; x++) {
        const i = at(x, y);
        if (i < 0) continue;
        const c = palette[i]!;
        if (luma(...c) < LINE_LUMA) continue;
        cleaned[y * width + x] = nearest(
          c.map((ch) => Math.min(255, ch * v.shade)),
          palette,
        );
      }
    }
  }

  const image = newImage(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = cleaned[p]!;
      if (i < 0) continue;
      let rgb: readonly number[] = palette[i]!;
      const silhouette = NEIGHBOURS_4.some(([dx, dy]) => at(x + dx, y + dy) < 0);
      if (silhouette || luma(rgb[0]!, rgb[1]!, rgb[2]!) < LINE_LUMA) rgb = INK;
      image.data.set([rgb[0]!, rgb[1]!, rgb[2]!, 255], p * 4);
    }
  }
  return { image, palette };
}

/** Nearest-neighbour upscale by a whole number: every texel becomes a `k`×`k` block. */
export function upscale(image: Image, k: number): Image {
  const out = newImage(image.width * k, image.height * k);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const from = (Math.floor(y / k) * image.width + Math.floor(x / k)) * 4;
      out.data.set(image.data.subarray(from, from + 4), (y * out.width + x) * 4);
    }
  }
  return out;
}

export function packAsset(asset: RestyleAsset): Image {
  const redraw = readImage(`${SOURCE_DIR}/pixellab/${asset.name}.png`);
  const shipped = readImage(`${SOURCE_DIR}/shipped/${asset.name}.png`);
  return upscale(restyle(redraw, shipped, asset).image, asset.scale);
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  let failed = false;
  for (const asset of RESTYLE_ASSETS) {
    const image = packAsset(asset);
    const output = `${OUTPUT_DIR}/${asset.name}.webp`;
    if (check) {
      const shipped = await decodeWebp(new Uint8Array(readFileSync(output)));
      const same =
        shipped.width === image.width &&
        shipped.height === image.height &&
        shipped.data.every((v, i) => v === image.data[i]);
      if (!same) failed = true;
      console.log(`${asset.name}: ${same ? 'matches' : 'DIFFERS'}`);
      continue;
    }
    writeFileSync(output, await encodeWebpLossless(image));
    console.log(JSON.stringify({ asset: asset.name, width: image.width, height: image.height }));
  }
  if (failed) process.exit(1);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/art/ba-dan-restyle.ts')) {
  await main();
}
