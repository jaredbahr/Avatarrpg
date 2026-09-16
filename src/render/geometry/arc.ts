/**
 * The aim arc: the flight a hurled ability will take, drawn at aim time so
 * the player sees the lob before committing to it.
 *
 * It samples the flight's own curve (`headAt` in `fx/simulate.ts`), so the
 * preview and the projectile agree by construction: what the arc shows is
 * where the stone goes, never a description of it written in parallel.
 * Pure geometry in tile units; both backends draw the same points.
 */

import type { Vec2 } from '../../core/types';
import { headAt } from '../fx/simulate';

/** Samples along the flight: enough for a smooth lob at any zoom. */
export const ARC_STEPS = 24;

/** `steps + 1` points from `from` to `to`, lobbed `arc` tiles high at the midpoint. */
export function aimArcPoints(from: Vec2, to: Vec2, arc: number, steps = ARC_STEPS): Vec2[] {
  const points: Vec2[] = [];
  for (let i = 0; i <= steps; i++) points.push(headAt(from, to, i / steps, arc));
  return points;
}

/**
 * The arrowhead every preview ends in, as a flat polygon `[x0, y0, x1, y1, ...]`
 * round `tip`, pointing along the unit `tangent`, sized to a tile of `size`
 * pixels. One shape for the walk's curve and the throw's arc, on both backends.
 */
export function arrowheadPolygon(tip: Vec2, tangent: Vec2, size: number): number[] {
  const back = size * 0.22;
  const half = size * 0.14;
  const tx = tangent.x;
  const ty = tangent.y;
  return [
    tip.x + tx * back * 0.45,
    tip.y + ty * back * 0.45,
    tip.x - tx * back + ty * half,
    tip.y - ty * back - tx * half,
    tip.x - tx * back * 0.55,
    tip.y - ty * back * 0.55,
    tip.x - tx * back - ty * half,
    tip.y - ty * back + tx * half,
  ];
}

/** The direction the arc arrives from: its last step, as a unit vector. */
export function arcHeading(points: readonly Vec2[]): Vec2 {
  const last = points[points.length - 1];
  const before = points[points.length - 2];
  if (!last || !before) return { x: 1, y: 0 };
  const dx = last.x - before.x;
  const dy = last.y - before.y;
  const length = Math.hypot(dx, dy);
  return length === 0 ? { x: 1, y: 0 } : { x: dx / length, y: dy / length };
}
