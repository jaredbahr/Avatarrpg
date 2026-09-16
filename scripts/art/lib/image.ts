/**
 * The one image type the art scripts pass around: RGBA bytes, straight
 * alpha, row-major. Read and written with pngjs, which is pure JavaScript,
 * so the scripts run wherever Node runs with nothing native to build.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

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
