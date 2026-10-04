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
  minimumWidth = 0,
) {
  // Headroom is measured relative to an unscaled tile top. Scale the entire
  // foot-to-head distance, not just the portion above that tile.
  const silhouetteTop = y + FOOT_LINE * tileSize - (FOOT_LINE + headroom) * tileSize * scale;
  // A footprint is not a head: especially on a two-cell boss, sizing from
  // `width` alone made the bar span scenery several tiles from its owner.
  // Keep a near-head width, but let small phone viewports request a readable
  // floor. Both are in the same (world) units as the geometry.
  const headWidth = tileSize * scale * 0.32;
  const barWidth = Math.min(width * scale, Math.max(headWidth, minimumWidth));
  const barHeight = Math.max(3, tileSize * 0.06);
  const gap = Math.max(1.8, tileSize * 0.028);
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
  readonly width?: number;
}

export interface ActorSilhouetteGeometry {
  readonly bar: ReturnType<typeof actorHealthBar>;
  readonly badgeY: number;
  readonly reticleY: number;
}

export interface HealthBarPlacement {
  readonly id: string;
  readonly bar: ReturnType<typeof actorHealthBar>;
}

const STAGGER_MAX_STEPS = 4;

function barsCollide(
  a: HealthBarPlacement['bar'],
  b: HealthBarPlacement['bar'],
  margin: number,
): boolean {
  return (
    a.x < b.x + b.width - margin &&
    a.x + a.width > b.x + margin &&
    a.y < b.y + b.height + 1 - margin &&
    a.y + a.height + 1 > b.y + margin
  );
}

/**
 * Stagger only colliding bars, keeping each bar centered over its own actor.
 * The bounded rise is small enough to retain that association while avoiding
 * the old side-by-side pileup. Input order is the renderer's depth order.
 *
 * Each bar's rise is a whole number of steps carried from the previous frame.
 * A measured sprite top changes with every idle/walk pose, so a bar sitting on
 * the collision boundary would otherwise flip by a step on alternate frames.
 * A bar rises on any real overlap, and with hysteresis drops back only once it
 * clears by more than one step.
 */
export class HealthBarStagger {
  private levels = new Map<string, number>();

  place<T extends HealthBarPlacement>(bars: readonly T[]): Map<string, T['bar']> {
    const placed: T['bar'][] = [];
    const result = new Map<string, T['bar']>();
    const next = new Map<string, number>();
    for (const candidate of bars) {
      const step = Math.max(2, candidate.bar.height * 0.8);
      const at = (level: number): T['bar'] => ({
        ...candidate.bar,
        y: candidate.bar.y - step * level,
      });
      const known = this.levels.get(candidate.id);
      let level = known ?? 0;
      // Hysteresis applies to dropping only: a raised bar goes back down once
      // the lower slot is clear by a full step of margin.
      while (level > 0 && !placed.some((other) => barsCollide(at(level - 1), other, -step)))
        level--;
      // Rising uses the plain collision test, so any real overlap staggers on
      // the frame it first appears.
      while (level < STAGGER_MAX_STEPS && placed.some((other) => barsCollide(at(level), other, 0)))
        level++;
      const bar = at(level);
      placed.push(bar);
      next.set(candidate.id, level);
      result.set(candidate.id, bar);
    }
    this.levels = next;
    return result;
  }
}

/** One-shot placement with no frame memory; renderers keep a `HealthBarStagger`. */
export function staggerHealthBars<T extends HealthBarPlacement>(
  bars: readonly T[],
): Map<string, T['bar']> {
  return new HealthBarStagger().place(bars);
}

export interface ActorBodyBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Conservative screen-space envelope of the upright art both backends draw. */
export function actorBodyBounds(
  box: ActorSpriteBox,
  heightTiles: 1 | 2,
  frameHeadroom: number | null,
  scale: number,
): ActorBodyBounds {
  const width = box.width ?? box.size;
  const scaledWidth = width * scale;
  const geometry = actorSilhouetteGeometry(box, heightTiles, frameHeadroom, scale);
  return {
    left: box.x + (width - scaledWidth) / 2,
    top: geometry.bar.silhouetteTop,
    right: box.x + (width + scaledWidth) / 2,
    bottom: box.y + FOOT_LINE * box.size,
  };
}

/** Font size of a floating number at `size` (a tile, in the caller's units) and `textScale`. */
export function floaterFontPx(size: number, textScale: number): number {
  return Math.round(size * 0.34 * textScale);
}

/** The clear space between a floating number's glyph bottom and the bar's top edge. */
export function floaterBarGap(size: number): number {
  return Math.max(3, size * 0.06);
}

/**
 * Where a floating number's vertical centre starts: its glyphs end a small gap
 * above `barTop`, the top of the target's health bar, so a number and a bar
 * from the same `actorSilhouetteGeometry` can never disagree. Both backends
 * draw from this; the rise and fade are applied on top.
 */
export function floaterStartY(barTop: number, size: number, textScale: number): number {
  return barTop - floaterBarGap(size) - floaterFontPx(size, textScale) / 2;
}

/**
 * Keeps a number on the board: a tall figure standing against the top edge has
 * its bar (and so the number above it) outside the canvas, where the number is
 * clipped away unseen. `top` is the visible top edge in the caller's units; the
 * number rests just inside it, over the figure, rather than vanishing.
 */
export function floaterVisibleY(y: number, top: number, fontPx: number): number {
  return Math.max(y, top + fontPx / 2 + 2);
}

/**
 * The unit a floating number belongs to: the one whose centre it was spawned
 * on (`unitFloaterPos` is the centre less half a tile, so a 2x2 unit's number
 * sits half a tile in from its origin under square footprints).
 */
export function floaterOwner<T extends { readonly pos: Vec2; readonly size: 1 | 2 }>(
  units: readonly T[],
  pos: Vec2,
  square: boolean,
): T | undefined {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  return units.find((unit) => {
    const inset = square && unit.size === 2 ? 0.5 : 0;
    return near(unit.pos.x + inset, pos.x) && near(unit.pos.y + inset, pos.y);
  });
}

/**
 * The bar top a number with no drawn owner anchors to: the same geometry a
 * one-tile painter-fallback unit standing on `box` would get, so a target that
 * has already left the view model still reads from the same rule.
 */
export function fallbackBarTop(box: ActorSpriteBox, scale = 1): number {
  return actorSilhouetteGeometry(box, 1, null, scale).bar.y;
}

/** The target cue sits just beyond the scaled silhouette's right edge. */
export function actorReticleX(box: ActorSpriteBox, scale: number, size: 1 | 2 = 1): number {
  const width = box.width ?? box.size;
  return size === 2
    ? box.x + width + (width * (scale - 1)) / 2 + box.size * 0.12
    : box.x + width + box.size * 0.12;
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
  minimumBarWidth = 0,
): ActorSilhouetteGeometry {
  const bar = actorHealthBar(
    box.x,
    box.y,
    box.width ?? box.size,
    box.size,
    scale,
    actorHeadroom(frameHeadroom, heightTiles),
    minimumBarWidth,
  );
  const radius = Math.max(4, box.size * 0.09);
  return {
    bar,
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
/** A visible contact pool on every other terrain. */
export const BASE_SHADOW_DENSITY = 1;

/**
 * The contact-shadow density under an upright actor at `pos`. On grass every
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
  // `always` remains in the signature for view-model compatibility; lighting
  // v1 makes the renderer responsible for seating every actor on every ground.
  void always;
  return BASE_SHADOW_DENSITY;
}
