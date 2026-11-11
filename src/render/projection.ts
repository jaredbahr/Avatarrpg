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

/**
 * True for the boards that draw a map's `scene` (its ground plates and scenery) when it has one:
 * the oblique board and the top-down one (ADR 0104). The orthographic board never does.
 */
export function drawsScene(projection: Projection): boolean {
  return projection !== 'orthographic';
}

/**
 * True where the renderers ground a scene at run time: `sceneGrounding`'s contact wash, the
 * structure and scenery shadow masks, the lift pass and `reliefLift`. Only the oblique board; a
 * top-down scene's shadows are baked into its plates (ADR 0104 section 2), and it lifts nothing.
 */
export function groundsSceneAtRuntime(projection: Projection): boolean {
  return projection === 'oblique';
}

/** The fewest tiles across a top-down view opens on: a phone held upright steps down a zoom for it. */
export const TOPDOWN_MIN_TILES_ACROSS = 4.5;

/**
 * Exploration's preferred CSS px a tile: the top-down board opens at N = 3 on a 1x screen (120 px,
 * ADR 0104), or N = 2 (80 px) where N = 3 would show under `TOPDOWN_MIN_TILES_ACROSS` tiles across
 * (an upright phone: 390 CSS px is 3¼ tiles at 120), the oblique one at 96 and the orthographic one
 * at 48. `viewportWidth` is in CSS px.
 */
export function exploreTilePx(projection: Projection, viewportWidth = Infinity): number {
  if (projection === 'topdown')
    return viewportWidth < TOPDOWN_MIN_TILES_ACROSS * 3 * TOPDOWN_TILE
      ? 2 * TOPDOWN_TILE
      : 3 * TOPDOWN_TILE;
  return projection === 'oblique' ? 96 : 48;
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
