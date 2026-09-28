import type { Grid, TerrainId, Vec2 } from '../../core/types';
import { FOOT_LINE } from '../sheets/bake';

/** Shared upright geometry. `y` already includes elevation and the current pose offset. */
export function actorHealthBar(
  x: number,
  y: number,
  width: number,
  tileSize: number,
  scale: number,
  headroom = 0,
) {
  // Headroom is measured relative to an unscaled tile top. Scale the entire
  // foot-to-head distance, not just the portion above that tile.
  const silhouetteTop = y + FOOT_LINE * tileSize - (FOOT_LINE + headroom) * tileSize * scale;
  const barWidth = width * 0.72;
  const barHeight = Math.max(3, tileSize * 0.075);
  const gap = Math.max(1.4, tileSize * 0.028);
  return {
    x: x + (width - barWidth) / 2,
    // The extra pixel is the bar's ink frame.
    y: silhouetteTop - gap - barHeight - 1,
    width: barWidth,
    height: barHeight,
    silhouetteTop,
  };
}

/**
 * The polygon for a bar's side cap (`HP_CAP` in palettes.ts), flat x,y pairs,
 * butted against the left of the bar's 1px frame; empty for none. It is as
 * tall as the framed bar, so it grows with the bar and never with the type.
 */
export function healthBarCap(
  bar: { x: number; y: number; height: number },
  cap: 'none' | 'diamond' | 'spike',
): number[] {
  const top = bar.y - 1;
  const bottom = bar.y + bar.height + 1;
  const mid = (top + bottom) / 2;
  const half = (bottom - top) / 2;
  const left = bar.x - 1;
  if (cap === 'spike') return [left, top, left, bottom, left - half * 1.6, mid];
  if (cap === 'diamond') {
    const cx = left - half - 1;
    return [cx, top, cx + half, mid, cx, bottom, cx - half, mid];
  }
  return [];
}

/** Ground whose busy texture swallows the standard contact pool. */
const GRASS_FAMILY: ReadonlySet<TerrainId> = new Set<TerrainId>(['grass']);

/** How much denser the pool is on grass: enough to seat a figure, short of a sticker. */
export const GRASS_SHADOW_DENSITY = 1.4;

/**
 * The contact-shadow density under an upright actor at `pos`, 0 for none.
 * Explore figures always carry the standard pool (ADR 0015). On grass every
 * figure gets a denser one, combat included, because there the standard pool
 * vanishes into the tufts and the figure floats; on paving and rock it does
 * not, so nothing changes there.
 *
 * `pos` is the drawn position, so a walk reads the tile under the feet as it
 * crosses from road to grass; it is rounded to a tile here. A two-wide figure
 * stands on grass if any cell of its footprint is grass.
 */
export function actorShadowDensity(
  grid: Grid,
  pos: Vec2,
  always: boolean,
  width: 1 | 2 = 1,
): number {
  const x0 = Math.round(pos.x);
  const y = Math.round(pos.y);
  for (let x = x0; x < x0 + width; x++) {
    const inside = x >= 0 && y >= 0 && x < grid.width && y < grid.height;
    const terrain = inside ? grid.tiles[y * grid.width + x]?.terrain : undefined;
    if (terrain && GRASS_FAMILY.has(terrain)) return GRASS_SHADOW_DENSITY;
  }
  return always ? 1 : 0;
}
