/**
 * Presentation only: saved positions and rule distances remain logical grid coordinates.
 * Both boards are the identity ground transform: `'topdown'` (ADR 0104) at its own tile size, and
 * `'orthographic'` (the riverside) at `TILE`. The oblique diamond board retired at T7.
 */
export type Projection = 'orthographic' | 'topdown';

/** World pixels a tile spans on the orthographic board. */
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

/** True for the pixel-art board drawn at a whole number of device pixels per world pixel (ADR 0088, 0104). */
export function usesIntegerZoom(projection: Projection): boolean {
  return projection === 'topdown';
}

/**
 * True for the board that draws a map's `scene` (its ground plates and scenery) when it has one:
 * the top-down one (ADR 0104). The orthographic board never does.
 */
export function drawsScene(projection: Projection): boolean {
  return projection === 'topdown';
}

/** The fewest tiles across a top-down view opens on: a phone held upright steps down a zoom for it. */
export const TOPDOWN_MIN_TILES_ACROSS = 4.5;

/**
 * Exploration's preferred CSS px a tile: the top-down board opens at N = 3 on a 1x screen (120 px,
 * ADR 0104), or N = 2 (80 px) where N = 3 would show under `TOPDOWN_MIN_TILES_ACROSS` tiles across
 * (an upright phone: 390 CSS px is 3¼ tiles at 120), and the orthographic one at 48. `viewportWidth`
 * is in CSS px.
 */
export function exploreTilePx(projection: Projection, viewportWidth = Infinity): number {
  if (projection === 'topdown')
    return viewportWidth < TOPDOWN_MIN_TILES_ACROSS * 3 * TOPDOWN_TILE
      ? 2 * TOPDOWN_TILE
      : 3 * TOPDOWN_TILE;
  return 48;
}
