/**
 * Raster helpers for the top-down ground packer (ADR 0104 §3): straight-alpha RGBA buffers, unscaled
 * `drawImage` / `fillRect` equivalents (source-over, rounded), crops and trims, and the lossless
 * WebP encode. Every board's baker draws with these, so two boards bake the same way.
 */
import type { Image } from '../../lib/image';
import { readPng } from '../../lib/image';
import { encodeWebpLossless } from '../../lib/webp';
import type { RgbaImage } from '../../../../src/render/shadow/hardShadowMask';

/** The one shadow colour, `#322125` (ADR 0103). */
export const SHADOW_RGB = [0x32, 0x21, 0x25] as const;

export type Rgb = readonly [number, number, number];
export const hex = (h: string): Rgb => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
export const blank = (width: number, height: number): RgbaImage => ({
  width,
  height,
  data: new Uint8ClampedArray(width * height * 4),
});
export const at = (a: ArrayLike<number>, i: number): number => a[i] ?? 0;

export function load(path: string): RgbaImage {
  const png = readPng(path);
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
}

/** Source-over of one straight-alpha pixel onto `dst` at index `j`, rounded. */
export function over(
  d: Uint8ClampedArray,
  j: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  if (a <= 0) return;
  const da = at(d, j + 3) / 255;
  const oa = a + da * (1 - a);
  const mix = (s: number, t: number): number => (s * a + t * da * (1 - a)) / oa;
  d[j] = Math.round(mix(r, at(d, j)));
  d[j + 1] = Math.round(mix(g, at(d, j + 1)));
  d[j + 2] = Math.round(mix(b, at(d, j + 2)));
  d[j + 3] = Math.round(oa * 255);
}

/** `drawImage`, unscaled: `src`'s rect (sx, sy, w, h) source-over at (dx, dy), clipped. */
export function draw(
  dst: RgbaImage,
  src: RgbaImage,
  dx: number,
  dy: number,
  sx = 0,
  sy = 0,
  w = src.width,
  h = src.height,
): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const X = dx + x,
        Y = dy + y;
      if (X < 0 || Y < 0 || X >= dst.width || Y >= dst.height) continue;
      const s = ((sy + y) * src.width + sx + x) * 4;
      const a = at(src.data, s + 3) / 255;
      if (!a) continue;
      over(
        dst.data,
        (Y * dst.width + X) * 4,
        at(src.data, s),
        at(src.data, s + 1),
        at(src.data, s + 2),
        a,
      );
    }
}

/** `fillRect` with an rgba fill, source-over, clipped. */
export function fill(
  dst: RgbaImage,
  x: number,
  y: number,
  w: number,
  h: number,
  c: Rgb,
  a = 1,
): void {
  for (let Y = Math.max(0, y); Y < Math.min(dst.height, y + h); Y++)
    for (let X = Math.max(0, x); X < Math.min(dst.width, x + w); X++)
      over(dst.data, (Y * dst.width + X) * 4, c[0], c[1], c[2], a);
}

export function crop(src: RgbaImage, sx: number, sy: number, w: number, h: number): RgbaImage {
  const out = blank(w, h);
  draw(out, src, 0, 0, sx, sy, w, h);
  return out;
}

export const lum = (d: ArrayLike<number>, j: number): number =>
  0.299 * at(d, j) + 0.587 * at(d, j + 1) + 0.114 * at(d, j + 2);

export function trim(img: RgbaImage): { image: RgbaImage; x: number; y: number } {
  let x0 = img.width,
    y0 = img.height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++)
      if (at(img.data, (y * img.width + x) * 4 + 3)) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  return { image: crop(img, x0, y0, x1 - x0 + 1, y1 - y0 + 1), x: x0, y: y0 };
}

export const asImage = (img: RgbaImage): Image => ({
  width: img.width,
  height: img.height,
  data: new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength),
});
export const lossless = (image: RgbaImage): Promise<Uint8Array> =>
  encodeWebpLossless(asImage(image), 6);
