/**
 * Where a sheet frame lands on the board.
 *
 * A frame's anchor stands on the unit's foot point. Canvas 2D draws the
 * rectangle this returns; Pixi sets its sprite's anchor to the frame's and
 * its size to this rectangle's, which covers the same rectangle.
 */

import type { ResolvedFrame } from './store';

type Placed = Pick<ResolvedFrame, 'frame' | 'anchor' | 'pixelsPerTile'>;

/** The rectangle `frame` covers with its anchor on (`footX`, `footY`), at `tilePx` a tile. */
export function placeFrame(
  frame: Placed,
  footX: number,
  footY: number,
  tilePx: number,
): { x: number; y: number; w: number; h: number } {
  const w = (frame.frame.w / frame.pixelsPerTile) * tilePx;
  const h = (frame.frame.h / frame.pixelsPerTile) * tilePx;
  return { x: footX - frame.anchor.x * w, y: footY - frame.anchor.y * h, w, h };
}
