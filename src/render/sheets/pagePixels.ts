/**
 * Reading a sheet's pixels back once a page, not once a cel.
 *
 * The store measures every cel's headroom and feet when its atlas loads, and the placeholder bake
 * measures every pose it draws. Each `getImageData` is a readback the browser has to finish before
 * it returns, and WebKit pays about 2 ms for each one: entering Ba Dan read some 1,300 cels, about
 * 3 s of the scene's start in the CI's iPad WebKit. One readback of the page, then a crop of each
 * cel from it, measures the same pixels.
 */
import type { AtlasFrame } from './atlasJson';

/** Straight RGBA of a whole page, row-major, `width` pixels a row. */
export interface PagePixels {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

/**
 * One cel's RGBA, `frame.w` x `frame.h`, cut from the page. Any part of the rectangle off the page
 * stays transparent, as it does when the cel is drawn alone into a cleared canvas.
 */
export function cropPixels(page: PagePixels, frame: AtlasFrame): Uint8ClampedArray {
  const out = new Uint8ClampedArray(frame.w * frame.h * 4);
  const x0 = Math.max(0, frame.x);
  const x1 = Math.min(page.width, frame.x + frame.w);
  if (x1 <= x0) return out;
  for (let row = 0; row < frame.h; row++) {
    const y = frame.y + row;
    if (y < 0 || y >= page.height) continue;
    const from = (y * page.width + x0) * 4;
    out.set(page.data.subarray(from, from + (x1 - x0) * 4), (row * frame.w + (x0 - frame.x)) * 4);
  }
  return out;
}

/**
 * The page's pixels, drawn once into a scratch canvas and read back once. Null where there is no
 * document to draw into (the unit tests). A tainted image throws, as a per-cel read would have.
 */
export function readPagePixels(
  image: CanvasImageSource,
  width: number,
  height: number,
): PagePixels | null {
  if (typeof document === 'undefined' || width <= 0 || height <= 0) return null;
  const scratch = document.createElement('canvas');
  scratch.width = width;
  scratch.height = height;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  return { data: ctx.getImageData(0, 0, width, height).data, width, height };
}
