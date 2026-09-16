/**
 * The one image type the art scripts pass around: RGBA bytes, straight
 * alpha, row-major. PNG is read and written with pngjs and JPEG is read
 * with jpeg-js, both pure JavaScript, so the scripts run wherever Node runs
 * with nothing native to build. A generator hands over PNG or JPEG; the
 * scripts only ever write PNG and WebP.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { decode as decodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';
import { webpSize } from './webp';

export interface Image {
  readonly width: number;
  readonly height: number;
  /** `width * height * 4` bytes: r, g, b, a. */
  readonly data: Uint8Array;
}

export function newImage(width: number, height: number): Image {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

export function readPng(path: string): Image {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

export type ImageFormat = 'png' | 'jpeg' | 'webp';

/**
 * The format and pixel size in a file's header, or null when the bytes are
 * not a PNG, a JPEG or a WebP. Reads only the header, so an inventory of a
 * folder of paintings does not decode any of them.
 */
export function imageSize(
  bytes: Uint8Array,
): { format: ImageFormat; width: number; height: number } | null {
  const at = (i: number): number => bytes[i] ?? 0;
  if (bytes.length >= 24 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) {
    const be32 = (i: number): number =>
      ((at(i) << 24) | (at(i + 1) << 16) | (at(i + 2) << 8) | at(i + 3)) >>> 0;
    return { format: 'png', width: be32(16), height: be32(20) };
  }
  if (bytes.length >= 4 && at(0) === 0xff && at(1) === 0xd8) {
    // Walk the segments to the first start-of-frame, which carries the size.
    let i = 2;
    while (i + 9 < bytes.length) {
      if (at(i) !== 0xff) {
        i += 1;
        continue;
      }
      const marker = at(i + 1);
      if (marker === 0xff) {
        i += 1;
        continue;
      }
      // Markers with no payload: another SOI, the restart markers, TEM.
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        i += 2;
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) break;
      const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isFrame) {
        return {
          format: 'jpeg',
          width: (at(i + 7) << 8) | at(i + 8),
          height: (at(i + 5) << 8) | at(i + 6),
        };
      }
      i += 2 + ((at(i + 2) << 8) | at(i + 3));
    }
    return null;
  }
  const webp = webpSize(bytes);
  return webp ? { format: 'webp', ...webp } : null;
}

/** A PNG or a JPEG from disk as RGBA. WebP is what the scripts write, never what they read. */
export function readImage(path: string): Image {
  const bytes = readFileSync(path);
  const header = imageSize(new Uint8Array(bytes));
  if (header?.format === 'png') {
    const png = PNG.sync.read(bytes);
    return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
  }
  if (header?.format === 'jpeg') {
    const jpeg = decodeJpeg(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      maxMemoryUsageInMB: 2048,
      maxResolutionInMP: 64,
    });
    return { width: jpeg.width, height: jpeg.height, data: new Uint8Array(jpeg.data) };
  }
  const what = header ? `a ${header.format}` : 'not an image the scripts read';
  throw new Error(`${path} is ${what}; hand the scripts a PNG or a JPEG.`);
}

/** Every pixel composited over the opaque colour `hex`, so nothing is left clear. */
export function flatten(image: Image, hex: string): Image {
  const [br, bg, bb] = parseHex(hex);
  const out = newImage(image.width, image.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const a = (image.data[i + 3] ?? 255) / 255;
    out.data[i] = Math.round((image.data[i] ?? 0) * a + br * (1 - a));
    out.data[i + 1] = Math.round((image.data[i + 1] ?? 0) * a + bg * (1 - a));
    out.data[i + 2] = Math.round((image.data[i + 2] ?? 0) * a + bb * (1 - a));
    out.data[i + 3] = 255;
  }
  return out;
}

export function writePng(path: string, image: Image): void {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data);
  writeFileSync(path, PNG.sync.write(png));
}

/** The pixel at (x, y) as [r, g, b, a]; black and clear off the image. */
export function pixelAt(image: Image, x: number, y: number): [number, number, number, number] {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return [0, 0, 0, 0];
  const i = (y * image.width + x) * 4;
  return [
    image.data[i] ?? 0,
    image.data[i + 1] ?? 0,
    image.data[i + 2] ?? 0,
    image.data[i + 3] ?? 0,
  ];
}

export function setPixel(image: Image, x: number, y: number, rgba: readonly number[]): void {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const i = (y * image.width + x) * 4;
  image.data[i] = rgba[0] ?? 0;
  image.data[i + 1] = rgba[1] ?? 0;
  image.data[i + 2] = rgba[2] ?? 0;
  image.data[i + 3] = rgba[3] ?? 255;
}

/** `#rrggbb` or `rrggbb` to [r, g, b]. */
export function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) throw new Error(`Not a colour: "${hex}"`);
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex(rgb: readonly number[]): string {
  return `#${rgb
    .slice(0, 3)
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
