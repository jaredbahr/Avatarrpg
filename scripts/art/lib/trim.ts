/**
 * Where the figure is inside a keyed frame, and cutting it out.
 */

import type { Image } from './image';
import { newImage, pixelAt, setPixel } from './image';

export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The tightest box round every pixel whose alpha is at least `threshold`, or null for an empty image. */
export function alphaBounds(image: Image, threshold = 8): Bounds | null {
  let x0 = image.width;
  let y0 = image.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if ((image.data[(y * image.width + x) * 4 + 3] ?? 0) < threshold) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

export function crop(image: Image, bounds: Bounds): Image {
  const out = newImage(bounds.width, bounds.height);
  for (let y = 0; y < bounds.height; y++) {
    for (let x = 0; x < bounds.width; x++) {
      setPixel(out, x, y, pixelAt(image, bounds.x + x, bounds.y + y));
    }
  }
  return out;
}

/** The lowest row with any pixel at or above `threshold` alpha: where the feet are. */
export function lowestOpaqueRow(image: Image, threshold = 8): number {
  const bounds = alphaBounds(image, threshold);
  return bounds ? bounds.y + bounds.height - 1 : -1;
}

/** The largest centred box with the aspect `w:h` that fits inside the image. */
export function aspectCrop(image: { width: number; height: number }, w: number, h: number): Bounds {
  const want = w / h;
  if (image.width / image.height > want) {
    const width = Math.min(image.width, Math.round(image.height * want));
    return { x: Math.floor((image.width - width) / 2), y: 0, width, height: image.height };
  }
  const height = Math.min(image.height, Math.round(image.width / want));
  return { x: 0, y: Math.floor((image.height - height) / 2), width: image.width, height };
}

/** The largest centred square that fits inside the image. */
export function squareCrop(image: { width: number; height: number }): Bounds {
  return aspectCrop(image, 1, 1);
}
