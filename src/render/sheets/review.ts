/**
 * A baked sheet as a picture, for the gallery's figure page.
 *
 * `e2e/gallery` asks for every unit key's placeholder sheet at one size and
 * lays the frames out with captions, so a reviewer sees the whole cast in
 * every pose on one page. Exposed on `window.fnt` from `main.ts`; nothing in
 * the game calls it.
 */

import { resolvePainter } from '../painters/registry';
import { bakeSheet } from './bake';

export interface ReviewFrame {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface ReviewSheet {
  /** The atlas as a PNG data URL. */
  readonly url: string;
  readonly width: number;
  readonly height: number;
  /** Frames in clip order. */
  readonly frames: readonly ReviewFrame[];
}

/** Bakes `key`'s placeholder sheet at `pixelsPerTile`; null where there is no document. */
export function bakeReview(
  key: string,
  pixelsPerTile: number,
  widthTiles: 1 | 2 = 1,
): ReviewSheet | null {
  const sheet = bakeSheet(key, resolvePainter(key), pixelsPerTile, widthTiles);
  if (!sheet) return null;
  return {
    url: sheet.canvas.toDataURL('image/png'),
    width: sheet.canvas.width,
    height: sheet.canvas.height,
    frames: [...sheet.frames.entries()].map(([name, f]) => ({
      name,
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
    })),
  };
}
