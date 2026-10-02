import type { Grid, TerrainId, Vec2 } from '../../core/types';
import { SQUARE_FOOTPRINTS, footprintCells } from '../../core/rules/footprint';
import { FOOT_LINE } from '../sheets/bake';

/**
 * Headroom shared by every upright presentation cue. A loaded frame reports
 * the measured distance above its tile; the raw painter fallback's top is
 * `FOOT_LINE * (heightTiles - 1)` above the foot line.
 */
export function actorHeadroom(
  frameHeadroom: number | null | undefined,
  heightTiles: 1 | 2,
): number {
  return frameHeadroom ?? FOOT_LINE * (heightTiles - 1);
}

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

export interface ActorSpriteBox {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export interface ActorSilhouetteGeometry {
  readonly barY: number;
  readonly badgeY: number;
  readonly reticleY: number;
}

/**
 * Shared vertical anchors for the health bar, status badges and target cue.
 * `frameHeadroom` is the measured sheet/painter headroom, or null when the
 * raw footprint fallback is being drawn.
 */
export function actorSilhouetteGeometry(
  box: ActorSpriteBox,
  heightTiles: 1 | 2,
  frameHeadroom: number | null,
  scale: number,
): ActorSilhouetteGeometry {
  const bar = actorHealthBar(
    box.x,
    box.y,
    box.size,
    box.size,
    scale,
    actorHeadroom(frameHeadroom, heightTiles),
  );
  const radius = Math.max(4, box.size * 0.09);
  return {
    barY: bar.y,
    badgeY: heightTiles > 1 ? bar.y - radius * 1.4 : box.y + box.size * 0.97,
    // Legacy one-tile cues sit at the foot line unless a loaded frame gives
    // us measured headroom; two-tile and measured silhouettes use their top.
    reticleY:
      heightTiles > 1 || frameHeadroom !== null
        ? bar.silhouetteTop - box.size * 0.04
        : box.y - box.size * 0.04,
  };
}

/**
 * The shortest a side cap is drawn, in CSS px: 20 device px on a DPR 2 tablet.
 * The bar itself is only 4-7 px tall, and in the default colours the cap is
 * what tells an ally from the party, so it may not shrink with the bar.
 */
export const HP_CAP_MIN_PX = 10;

/** A cap's width over its height; a small board narrows it further (below). */
const CAP_ASPECT = 0.7;

/**
 * The polygon for a bar's side cap (`HP_CAP` in palettes.ts), flat x,y pairs,
 * butted against the left of the bar's 1px frame; empty for none. It is at
 * least as tall as the framed bar and at least `HP_CAP_MIN_PX`, centred on the
 * bar, and it never reaches past `column`, the left edge of the actor the bar
 * sits over: on a small board it gets narrower, not wider than its figure.
 *
 * `px` is one CSS pixel in the caller's units (1 on Canvas 2D, 1 / camera
 * scale in Pixi's world space), so both backends draw the same cap.
 */
export function healthBarCap(
  bar: { x: number; y: number; height: number },
  cap: 'none' | 'diamond' | 'spike',
  column: number,
  px = 1,
): number[] {
  if (cap === 'none') return [];
  const mid = bar.y + bar.height / 2;
  const half = Math.max(bar.height / 2 + 1, (HP_CAP_MIN_PX * px) / 2);
  const top = mid - half;
  const bottom = mid + half;
  const right = bar.x - 1;
  // A 1px ink gap before a diamond, so it reads as a mark and not a bar end.
  const gap = cap === 'diamond' ? px : 0;
  const width = Math.max(0, Math.min(2 * half * CAP_ASPECT, right - gap - column));
  if (cap === 'spike') return [right, top, right, bottom, right - width, mid];
  const cx = right - gap - width / 2;
  return [cx, top, cx + width / 2, mid, cx, bottom, cx - width / 2, mid];
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
  square = SQUARE_FOOTPRINTS,
): number {
  const x0 = Math.round(pos.x);
  const y0 = Math.round(pos.y);
  for (const cell of footprintCells({ x: x0, y: y0 }, width, square)) {
    const inside = cell.x >= 0 && cell.y >= 0 && cell.x < grid.width && cell.y < grid.height;
    const terrain = inside ? grid.tiles[cell.y * grid.width + cell.x]?.terrain : undefined;
    if (terrain && GRASS_FAMILY.has(terrain)) return GRASS_SHADOW_DENSITY;
  }
  return always ? 1 : 0;
}
