import type { Grid, Vec2 } from '../../core/types';
import type { Projection } from '../projection';

/**
 * How far a tier lifts on screen, in tiles (ADR 0061 §5, ADR 0065). The
 * oblique board draws each walkable tier's top this far up the screen, with
 * its faces below it, and stands actors and picks taps on the same lift.
 * A quarter tile is the forest shelf plate's painted rise, so painted and
 * procedural ledges agree.
 */
export const TIER_LIFT = 0.25;
/** The orthographic board keeps ADR 0008's flat cliff bands and only nudges actors. */
export const FLAT_TIER_LIFT = 0.06;

export function elevationAt(grid: Grid, pos: Vec2): number {
  if (pos.x < 0 || pos.y < 0 || pos.x >= grid.width || pos.y >= grid.height) return 0;
  return grid.tiles[pos.y * grid.width + pos.x]?.elevation ?? 0;
}

/**
 * Screen lift of a cell's top in tiles. A blocked mass (a rock face, a wall)
 * is drawn upright by its scenery, not lifted, so its ground stays flat.
 */
export function liftAt(grid: Grid, pos: Vec2, projection: Projection): number {
  if (pos.x < 0 || pos.y < 0 || pos.x >= grid.width || pos.y >= grid.height) return 0;
  const tile = grid.tiles[pos.y * grid.width + pos.x];
  if (!tile || tile.elevation <= 0) return 0;
  if (projection !== 'oblique') return tile.elevation * FLAT_TIER_LIFT;
  return tile.blocked ? 0 : tile.elevation * TIER_LIFT;
}

/**
 * The lift under a figure between cells, blended from the four cells round
 * it, so a walk up a ramp or onto a bench climbs instead of popping.
 */
export function liftAlong(grid: Grid, at: Vec2, projection: Projection): number {
  const x = Math.floor(at.x);
  const y = Math.floor(at.y);
  const fx = at.x - x;
  const fy = at.y - y;
  const lift = (dx: number, dy: number) => liftAt(grid, { x: x + dx, y: y + dy }, projection);
  if (!fx && !fy) return lift(0, 0);
  return (
    (lift(0, 0) * (1 - fx) + lift(1, 0) * fx) * (1 - fy) +
    (lift(0, 1) * (1 - fx) + lift(1, 1) * fx) * fy
  );
}

/**
 * The cell a pointer lands on, given the flat ground point under it.
 *
 * A lifted top is the cell's diamond moved up the screen by its lift, and its
 * faces fill the gap back down to the ground, so a cell occupies its diamond
 * swept upwards. A screen step of `t` tiles up is a step of (t, t) back along
 * the oblique ground, so the pointer lies over cell c exactly when the segment
 * from `ground` to `ground + (L, L)` crosses c, L being c's lift. Of the cells
 * it crosses, the one drawn last wins: the board is painted in rising x + y,
 * the same order the renderers' lift pass uses. No lift is more than half a
 * tile, so a flat tile centre still picks its own cell.
 */
export function pickCell(grid: Grid, ground: Vec2, projection: Projection): Vec2 {
  const flat = { x: Math.floor(ground.x), y: Math.floor(ground.y) };
  if (projection !== 'oblique') return flat;
  const reach = 2 * TIER_LIFT;
  let best: Vec2 | null = null;
  for (const cx of new Set([flat.x, Math.floor(ground.x + reach)]))
    for (const cy of new Set([flat.y, Math.floor(ground.y + reach)])) {
      const lift = liftAt(grid, { x: cx, y: cy }, projection);
      const lo = Math.max(0, cx - ground.x, cy - ground.y);
      const hi = Math.min(cx + 1 - ground.x, cy + 1 - ground.y);
      // A top's far vertex touching a point exactly leaves it to the cell behind.
      if (lo >= hi || (lo > 0 && lo >= lift)) continue;
      if (!best || cx + cy > best.x + best.y) best = { x: cx, y: cy };
    }
  return best ?? flat;
}
