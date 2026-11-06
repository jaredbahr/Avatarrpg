import type { Vec2 } from '../core/types';

/**
 * Presentation only: saved positions and rule distances remain logical grid coordinates.
 * `'topdown'` (ADR 0104) is the identity ground transform, like `'orthographic'`, at its own tile size.
 */
export type Projection = 'orthographic' | 'oblique' | 'topdown';

/** World pixels a tile spans on the oblique and orthographic boards. */
export const TILE = 64;
/** World pixels a tile spans on the top-down board (ADR 0104: the prototype's 40 px cell). */
export const TOPDOWN_TILE = 40;

/**
 * World pixels per tile for a projection: the one number `project`, `unproject`,
 * `toScreen`, `pickTile` and both backends read (through `Camera.tile`).
 */
export function tileSize(projection: Projection): number {
  return projection === 'topdown' ? TOPDOWN_TILE : TILE;
}

/** True for the pixel-art boards drawn at a whole number of device pixels per world pixel (ADR 0088, 0104). */
export function usesIntegerZoom(projection: Projection): boolean {
  return projection !== 'orthographic';
}

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
