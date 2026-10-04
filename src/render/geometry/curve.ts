/**
 * Smoothed paths.
 *
 * A move is a list of tiles. Walked tile centre to tile centre it is a string
 * of straight hops with a kink at every turn; drawn as a curve through the
 * same centres it reads as a route. The curve is the tile-centre polyline
 * with its corners cut (Chaikin), endpoints pinned, and it never leaves the
 * tiles the path visits: each rounded corner stays inside the triangle of
 * three consecutive centres, which lies within those tiles' own squares. The
 * rule against cutting corners past a blocked tile therefore holds visually
 * as well as in the rules.
 *
 * Positions are in tile units, at tile centres (x + 0.5, y + 0.5), so the
 * same curve serves the path line and the walking unit on either backend.
 */

import type { Vec2 } from '../../core/types';
import { chaikin } from './contour';

export interface Curve {
  /** Points along the curve, in tile units, centre-based. */
  readonly points: readonly Vec2[];
  /** Arc length from the start to each point; `cumulative[0]` is 0. */
  readonly cumulative: readonly number[];
  /** Total arc length in tiles. */
  readonly length: number;
}

export interface CurveSample {
  readonly pos: Vec2;
  /** Unit tangent, or (1, 0) on a degenerate curve. */
  readonly tangent: Vec2;
}

const centre = (p: Vec2): Vec2 => ({ x: p.x + 0.5, y: p.y + 0.5 });

/** The curve a unit walks from `from` through every tile of `path`. */
export function smoothPath(from: Vec2, path: readonly Vec2[], iterations = 2): Curve {
  const control = [centre(from), ...path.map(centre)];
  const points = control.length >= 3 ? chaikin(control, iterations, false) : control;
  const cumulative: number[] = [0];
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    length += Math.hypot(b.x - a.x, b.y - a.y);
    cumulative.push(length);
  }
  return { points, cumulative, length };
}

/** Position and direction at arc length `s` along the curve, clamped to its ends. */
export function sampleAt(curve: Curve, s: number): CurveSample {
  const { points, cumulative } = curve;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return { pos: { x: 0, y: 0 }, tangent: { x: 1, y: 0 } };
  if (points.length < 2 || curve.length <= 0) return { pos: first, tangent: { x: 1, y: 0 } };

  const target = Math.max(0, Math.min(curve.length, s));
  // Binary search for the segment that contains `target`.
  let lo = 0;
  let hi = cumulative.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((cumulative[mid] ?? 0) <= target) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  const sa = cumulative[lo] ?? 0;
  const sb = cumulative[hi] ?? sa;
  if (!a || !b) return { pos: first, tangent: { x: 1, y: 0 } };

  const span = sb - sa;
  const t = span > 0 ? (target - sa) / span : 0;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    pos: { x: a.x + dx * t, y: a.y + dy * t },
    tangent: { x: dx / len, y: dy / len },
  };
}

/** Arc position nearest a moving origin, constrained past completed raw route segments. */
export function nearestDistanceAlong(
  curve: Curve,
  origin: Vec2,
  startIndex = 0,
  routeLength = 1,
): number {
  const start = Math.max(
    0,
    Math.floor((startIndex / Math.max(1, routeLength)) * (curve.points.length - 1)) - 2,
  );
  const target = centre(origin);
  let nearest = curve.cumulative[start] ?? 0;
  let nearestSq = Infinity;
  for (let i = start; i < curve.points.length - 1; i++) {
    const a = curve.points[i];
    const b = curve.points[i + 1];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq
      ? Math.max(0, Math.min(1, ((target.x - a.x) * dx + (target.y - a.y) * dy) / lengthSq))
      : 0;
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const distanceSq = (target.x - px) ** 2 + (target.y - py) ** 2;
    if (distanceSq <= nearestSq) {
      nearestSq = distanceSq;
      nearest = (curve.cumulative[i] ?? 0) + Math.sqrt(lengthSq) * t;
    }
  }
  return nearest;
}

/**
 * The integral of `rate(tangent)` over the first `s` of the curve's arc
 * length, clamped to its ends: each straight segment contributes its length,
 * or the walked part of it, times the rate for its own direction. A rate that
 * depends on direction therefore accumulates continuously through a turn,
 * where rate-at-the-current-point times distance would jump. A degenerate
 * curve integrates to 0.
 */
export function integrateAlong(curve: Curve, s: number, rate: (tangent: Vec2) => number): number {
  const { points, cumulative } = curve;
  const target = Math.max(0, Math.min(curve.length, s));
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const start = cumulative[i - 1] ?? 0;
    if (!a || !b || start >= target) break;
    const span = (cumulative[i] ?? start) - start;
    if (span <= 0) continue;
    const walked = Math.min(span, target - start);
    total += walked * rate({ x: (b.x - a.x) / span, y: (b.y - a.y) / span });
  }
  return total;
}

/** Same as `sampleAt`, by fraction of the whole length. */
export function sampleFraction(curve: Curve, fraction: number): CurveSample {
  return sampleAt(curve, fraction * curve.length);
}

/** Largest distance from any curve point to the tile-centre polyline it was built from. */
export function deviation(curve: Curve, from: Vec2, path: readonly Vec2[]): number {
  const control = [centre(from), ...path.map(centre)];
  let worst = 0;
  for (const p of curve.points) {
    let nearest = Infinity;
    for (let i = 1; i < control.length; i++) {
      const a = control[i - 1];
      const b = control[i];
      if (!a || !b) continue;
      nearest = Math.min(nearest, distanceToSegment(p, a, b));
    }
    if (control.length === 1 && control[0])
      nearest = Math.hypot(p.x - control[0].x, p.y - control[0].y);
    worst = Math.max(worst, nearest);
  }
  return worst;
}

function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}
