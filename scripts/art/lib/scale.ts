/**
 * Scaling a keyed figure without inventing anything.
 *
 * A box filter over premultiplied colour: every output pixel is the plain
 * average of the source pixels it covers, weighted by their alpha, so flat
 * fills stay flat, ink edges stay crisp at the new size, and a clear pixel
 * never bleeds its (meaningless) colour into an opaque neighbour. Generate
 * at 4x and come down through this; never go up.
 */

import type { Image } from './image';
import { newImage } from './image';

/** Scales to exactly `width` x `height`. Upscaling is refused: it would invent pixels. */
export function scaleTo(image: Image, width: number, height: number): Image {
  if (width > image.width || height > image.height) {
    throw new Error(
      `Refusing to upscale ${image.width}x${image.height} to ${width}x${height}: generate larger instead.`,
    );
  }
  const out = newImage(width, height);
  const sx = image.width / width;
  const sy = image.height / height;
  for (let y = 0; y < height; y++) {
    const y0 = y * sy;
    const y1 = (y + 1) * sy;
    for (let x = 0; x < width; x++) {
      const x0 = x * sx;
      const x1 = (x + 1) * sx;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let weight = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const wy = Math.min(y1, yy + 1) - Math.max(y0, yy);
        if (wy <= 0) continue;
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const wx = Math.min(x1, xx + 1) - Math.max(x0, xx);
          if (wx <= 0) continue;
          const w = wx * wy;
          const i = (yy * image.width + xx) * 4;
          const alpha = (image.data[i + 3] ?? 0) / 255;
          r += (image.data[i] ?? 0) * alpha * w;
          g += (image.data[i + 1] ?? 0) * alpha * w;
          b += (image.data[i + 2] ?? 0) * alpha * w;
          a += alpha * w;
          weight += w;
        }
      }
      const o = (y * width + x) * 4;
      if (a > 0) {
        out.data[o] = Math.round(r / a);
        out.data[o + 1] = Math.round(g / a);
        out.data[o + 2] = Math.round(b / a);
        out.data[o + 3] = Math.round((a / weight) * 255);
      }
    }
  }
  return out;
}

/** Scales by a factor, keeping the aspect; the result is rounded to whole pixels. */
export function scaleBy(image: Image, factor: number): Image {
  return scaleTo(
    image,
    Math.max(1, Math.round(image.width * factor)),
    Math.max(1, Math.round(image.height * factor)),
  );
}
