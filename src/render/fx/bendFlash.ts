/**
 * The bend flash (ADR 0055): the cel added onto itself, as the prototype's
 * `ImageEnhance.Brightness(1 + flash)` did it. Each colour channel is
 * multiplied by `1 + flash` and clamped, the alpha kept: `min(1, c(1 + f)) a`
 * once composited. An additive second draw gets the opaque pixels right but
 * adds before it clamps, so a saturated, partly clear cel (the water splash,
 * painted at 224) comes out brighter than Pillow's; this does not.
 *
 * It works on one cel, never its page: the brightened copy is a canvas the
 * cel's size, made once for each cel and flash and kept in a small LRU, which
 * both backends draw in the cel's place.
 */

/** Pillow's Brightness on straight RGBA, in place: `floor(c * (1 + flash))`, alpha kept. */
export function brighten(data: Uint8ClampedArray, flash: number): void {
  const k = 1 + flash;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = i; c < i + 3; c++) data[c] = Math.floor((data[c] ?? 0) * k);
  }
}

const flashed = new Map<string, HTMLCanvasElement>();
const MAX_FLASHED = 16;

/** The cel `frame` of `image`, brightened by `flash`; null where a 2D context is unavailable. */
export function flashedCel(
  image: CanvasImageSource,
  key: string,
  frame: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  flash: number,
): HTMLCanvasElement | null {
  const id = `${key}|${frame.x},${frame.y}|${flash}`;
  let canvas = flashed.get(id);
  if (canvas) {
    flashed.delete(id);
  } else {
    canvas = document.createElement('canvas');
    canvas.width = frame.w;
    canvas.height = frame.h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
    const pixels = ctx.getImageData(0, 0, frame.w, frame.h);
    brighten(pixels.data, flash);
    ctx.putImageData(pixels, 0, 0);
  }
  flashed.set(id, canvas);
  for (const oldest of flashed.keys()) {
    if (flashed.size <= MAX_FLASHED) break;
    flashed.delete(oldest);
  }
  return canvas;
}
