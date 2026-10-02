import type { SceneImage } from '../../core/types';

function smoothstep(distance: number, width: number | undefined): number {
  if (width === undefined) return 1;
  const t = Math.max(0, Math.min(1, distance / width));
  return t * t * (3 - 2 * t);
}

/** Horizontal alpha multiplier; declared sides are in drawn (post-flip) orientation. */
export function featherAlpha(piece: SceneImage, sourceX: number, sourceWidth: number): number {
  if (!piece.feather) return 1;
  const farEdge = sourceWidth - 1;
  const drawnX = 'flip' in piece && piece.flip ? farEdge - sourceX : sourceX;
  return smoothstep(drawnX, piece.feather.left) * smoothstep(farEdge - drawnX, piece.feather.right);
}
