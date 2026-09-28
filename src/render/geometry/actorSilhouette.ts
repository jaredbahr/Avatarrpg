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
 */
export function actorShadowDensity(grid: Grid, pos: Vec2, always: boolean): number {
  const inside = pos.x >= 0 && pos.y >= 0 && pos.x < grid.width && pos.y < grid.height;
  const terrain = inside ? grid.tiles[pos.y * grid.width + pos.x]?.terrain : undefined;
  if (terrain && GRASS_FAMILY.has(terrain)) return GRASS_SHADOW_DENSITY;
  return always ? 1 : 0;
}
