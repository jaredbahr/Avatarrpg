/**
 * Where a figure's drawn feet meet the ground (ADR 0093's planting amendment; owner, 2026-10-28: "They're still
 * floating"). Measured from a cel's own pixels when its atlas loads, so it holds for any sheet, redrawn or not:
 *
 * - `ground`: the row just under the lowest opaque sole, which the store stands the cel on (`plantAnchor`), so the
 *   planted foot is on the tile's ground point in every idle and walk cel, not a few pixels above or below it;
 * - `soles`: per column, the row under that column's sole where it touches the ground (within `SOLE_REACH` of the
 *   lowest), or -1: the near foot and, on an oblique board, the far foot a few rows higher. A lifted swing foot is
 *   off the ground and has none;
 * - `centre`: the middle of those contacts, which the steady pool is centred on.
 */

import type { ClipName } from '../../content/assets/clips';

/** Alpha at or above which a pixel is the figure. */
const OPAQUE = 128;
/** How far above the lowest sole another sole may stand and still be on the ground, in tiles (the far foot). */
export const SOLE_REACH = 0.05;
/** The most a cel is moved to stand on its soles, in tiles: anything further is not a foot (a fallen body). */
const MAX_PLANT = 0.16;

export interface FrameFeet {
  /** The row under the lowest opaque sole, in frame px. */
  readonly ground: number;
  /** Per column, the row under its sole where that sole touches the ground, or -1. */
  readonly soles: Int16Array;
  /** The middle of the contacts, in frame px (x across, y the mean contact row). */
  readonly centre: { readonly x: number; readonly y: number };
}

/** The feet of one frame's RGBA pixels, `width` x `height`; null when it has no opaque pixel. */
export function feetFromPixels(
  data: ArrayLike<number>,
  width: number,
  height: number,
  pixelsPerTile: number,
): FrameFeet | null {
  const lowest = new Int16Array(width).fill(-1);
  let bottom = -1;
  for (let x = 0; x < width; x += 1)
    for (let y = height - 1; y >= 0; y -= 1)
      if ((data[(y * width + x) * 4 + 3] ?? 0) >= OPAQUE) {
        lowest[x] = y;
        if (y > bottom) bottom = y;
        break;
      }
  if (bottom < 0) return null;
  const reach = Math.max(1, Math.round(SOLE_REACH * pixelsPerTile));
  const soles = new Int16Array(width).fill(-1);
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let x = 0; x < width; x += 1) {
    const y = lowest[x] ?? -1;
    if (y < 0 || y < bottom - reach) continue;
    soles[x] = y + 1;
    sx += x + 0.5;
    sy += y + 1;
    n += 1;
  }
  return { ground: bottom + 1, soles, centre: { x: sx / n, y: sy / n } };
}

/** The clips a figure stands or walks in: those its planted foot is on the ground for. */
export function standsOnSoles(clip: string): boolean {
  return /^(idle|walk|jog|rest|stance)/.test(clip);
}

/**
 * The anchor a cel stands by: the sheet's (or its clip's), with its foot line moved onto the cel's own soles when it
 * is a standing or walking cel and its soles are within `MAX_PLANT` of the authored line.
 */
export function plantAnchor(
  clip: string,
  anchor: { readonly x: number; readonly y: number },
  frame: { readonly h: number },
  feet: FrameFeet | undefined,
  pixelsPerTile: number,
): { readonly x: number; readonly y: number } {
  if (!feet || !standsOnSoles(clip) || frame.h <= 0) return anchor;
  if (Math.abs(feet.ground - anchor.y * frame.h) > MAX_PLANT * pixelsPerTile) return anchor;
  return { x: anchor.x, y: feet.ground / frame.h };
}

/** The idle a moving or standing clip's heading rests in: what its steady pool is centred on. */
export function restingClip(clip: ClipName): ClipName {
  return clip.replace(/^(walk|jog|rest|stance)/, 'idle') as ClipName;
}
