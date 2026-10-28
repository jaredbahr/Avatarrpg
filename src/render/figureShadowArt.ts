/**
 * A figure's ground shadow (`figureShadow` in lighting.ts) as two canvases both backends draw into the
 * shadow union, one world pixel a canvas pixel: `cast`, white wherever the pool and its cast fall, and
 * `contact`, white under the soles. Each goes in at its own level and the union keeps the stronger.
 * Built once per size and key; a handful exist at a time (one per figure scale and width).
 */
import { FIGURE_CONTACT, figureShadow, type CastKey } from './lighting';

export interface FigureShadowArt {
  readonly cast: HTMLCanvasElement;
  readonly contact: HTMLCanvasElement;
  /** The foot's position in either canvas, in its pixels (world pixels). */
  readonly footX: number;
  readonly footY: number;
}

const cache = new Map<string, FigureShadowArt | null>();

export function figureShadowArt(
  tilePx: number,
  key: CastKey,
  widthTiles = 1,
): FigureShadowArt | null {
  const id = `${tilePx.toFixed(3)}:${widthTiles}:${key.x},${key.y}`;
  const cached = cache.get(id);
  if (cached !== undefined) return cached;
  const shadow = figureShadow(tilePx, key, widthTiles);
  const paint = (keep: (level: number) => boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = shadow.width;
    canvas.height = shadow.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const image = ctx.createImageData(shadow.width, shadow.height);
    shadow.mask.forEach((level, i) => {
      if (keep(level)) image.data.set([255, 255, 255, 255], i * 4);
    });
    ctx.putImageData(image, 0, 0);
    return canvas;
  };
  const cast = paint((level) => level > 0);
  const contact = paint((level) => level === FIGURE_CONTACT);
  const art = cast && contact ? { cast, contact, footX: shadow.footX, footY: shadow.footY } : null;
  if (cache.size > 32) cache.clear();
  cache.set(id, art);
  return art;
}
