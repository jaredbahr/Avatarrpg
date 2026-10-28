/**
 * A prop's grounded cast (`groundedCast` in lighting.ts) as a canvas both
 * backends draw into the shadow union: white where the cast falls, at the
 * art's own pixel size and origin, so it is placed exactly as the prop is.
 * Built once per drawn sprite and key; the sprite cache's canvases are its keys,
 * so a cast goes when its sprite is evicted.
 */
import { groundedCast, type CastKey } from './lighting';

const casts = new WeakMap<object, Map<string, HTMLCanvasElement | null>>();

export function groundedCastArt(
  source: HTMLCanvasElement | HTMLImageElement,
  key: CastKey,
): HTMLCanvasElement | null {
  let byKey = casts.get(source);
  if (!byKey) {
    byKey = new Map();
    casts.set(source, byKey);
  }
  const id = `${key.x},${key.y}`;
  const cached = byKey.get(id);
  if (cached !== undefined) return cached;
  const width = source.width;
  const height = source.height;
  let art: HTMLCanvasElement | null = null;
  if (width > 0 && height > 0) {
    const read = document.createElement('canvas');
    read.width = width;
    read.height = height;
    const readCtx = read.getContext('2d', { willReadFrequently: true });
    if (readCtx) {
      readCtx.drawImage(source, 0, 0);
      const pixels = readCtx.getImageData(0, 0, width, height).data;
      const cast = groundedCast((x, y) => pixels[(y * width + x) * 4 + 3] ?? 0, width, height, key);
      art = document.createElement('canvas');
      art.width = cast.width;
      art.height = cast.height;
      const ctx = art.getContext('2d');
      if (ctx) {
        const image = ctx.createImageData(cast.width, cast.height);
        cast.mask.forEach((on, i) => {
          if (on) image.data.set([255, 255, 255, 255], i * 4);
        });
        ctx.putImageData(image, 0, 0);
      }
    }
  }
  byKey.set(id, art);
  return art;
}
