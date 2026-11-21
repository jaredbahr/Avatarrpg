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

/**
 * Exploration's preferred CSS px a tile: the top-down board opens at N = 2 (80 px a tile on a 1x screen, 4 device px
 * per world px on a 2x iPad), and the orthographic one at 48. It opened at N = 3 (120 px) until the owner pulled the
 * explore camera back one step (2026-11-21, ADR 0104 amendment): at N = 3 an iPad in landscape showed about 12 by 6
 * cells and a level's next goal was usually off screen; at N = 2 it shows about 15 by 7, the art stays on whole device
 * pixels and a tile (80 CSS px) is still well over the tap target. An upright phone already opened at N = 2 and stays
 * there: N = 1 would put a tile under the tap target. In CSS px.
 */
export function exploreTilePx(projection: Projection): number {
  if (projection === 'topdown') return 2 * TOPDOWN_TILE;
  return 48;
}
