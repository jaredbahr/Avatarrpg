import type { Vec2 } from '../core/types';

export interface RoutePreview {
  readonly from: Vec2;
  readonly path: readonly Vec2[];
  origin: Vec2;
  startIndex: number;
}

export function createRoutePreview(from: Vec2, path: readonly Vec2[]): RoutePreview {
  return { from, path, origin: from, startIndex: 0 };
}

/** Queued intent must not replace the collision-safe route already being walked. */
export function displayedRoute<T>(active: T | null, queued: T | null): T | null {
  return active ?? queued;
}

/** Update progress without replacing the route or its path (renderer caches key on both). */
export function updateRoutePreview(preview: RoutePreview, leader: Vec2): RoutePreview {
  let nearestSegment = 0;
  let nearestDistance = Infinity;
  let a = preview.from;
  for (let i = 0; i < preview.path.length; i++) {
    const b = preview.path[i];
    if (!b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq
      ? Math.max(0, Math.min(1, ((leader.x - a.x) * dx + (leader.y - a.y) * dy) / lengthSq))
      : 0;
    const distance = Math.hypot(leader.x - (a.x + dx * t), leader.y - (a.y + dy * t));
    // At a waypoint both adjacent segments are equally near; prefer the later
    // one so the completed incoming segment disappears immediately.
    if (distance <= nearestDistance) {
      nearestDistance = distance;
      nearestSegment = i;
    }
    a = b;
  }
  preview.origin = leader;
  preview.startIndex = nearestSegment;
  return preview;
}
