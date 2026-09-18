import type { Vec2 } from '../core/types';

/** Presentation only: saved positions and rule distances remain logical grid coordinates. */
export type Projection = 'orthographic' | 'oblique';

export function projectGround(pos: Vec2, projection: Projection): Vec2 {
  return projection === 'oblique' ? { x: pos.x - pos.y, y: (pos.x + pos.y) / 2 } : pos;
}

export function unprojectGround(pos: Vec2, projection: Projection): Vec2 {
  return projection === 'oblique' ? { x: pos.y + pos.x / 2, y: pos.y - pos.x / 2 } : pos;
}

export function groundBounds(width: number, height: number, projection: Projection) {
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ].map((p) => projectGround(p, projection));
  const minX = Math.min(...corners.map((p) => p.x));
  const minY = Math.min(...corners.map((p) => p.y));
  const maxX = Math.max(...corners.map((p) => p.x));
  const maxY = Math.max(...corners.map((p) => p.y));
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}
