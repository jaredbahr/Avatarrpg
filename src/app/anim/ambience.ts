/**
 * The air over the board.
 *
 * A map's ambience names a recipe of drifting motes (`FX_AMBIENCE`); this
 * turns it into live emitters for the frame. Nothing is stored between
 * frames: every emitter loops on the clock, two loops half a period apart so
 * one is always mid-life while the other is fading in, and each loop draws a
 * fresh seed so the same leaves do not fall in the same places twice.
 *
 * A recipe's `chimney` rises from each of the scene's chimneys the same way.
 * A recipe's `glint` raises ripples on each of the painted water cells it is
 * given, on a per-cell clock, and its `canopy` lets leaves go from each canopy.
 * Held `still` (reduce motion) the motes, ripples and canopy leaves go and the
 * smoke is one fixed frame: a wisp that stays where it is.
 */

import type { DayPhase, Grid, MapScene, Vec2 } from '../../core/types';
import type { AmbienceRecipe } from '../../content/fx';
import { hashSeed } from '../../render/fx/rng';
import { glintExtent, particleSpan } from '../../render/fx/simulate';
import type { EmitterInstance } from '../../render/view';

/** Loops run at once per emitter, spaced evenly through the period. */
const LOOPS = 2;
/** The moment a still wisp is frozen at: the village smoke's fullest column. */
const STILL_MS = 2400;
/** Ripples a painted water cell can show at once, and the span each slot repeats in. */
const RIPPLE_SLOTS = 2;
const RIPPLE_CYCLE = 4800;
/** Percent of a slot's cycles that raise a ripple at all. */
const RIPPLE_SHARE = 40;
/** Ripples whose swells peak this close together, in cells touching, are one too many: the weaker sits out. */
const RIPPLE_APART = 250;
/** Water left between the complete ripple and a bank or map edge, in tiles. */
const BANK_CLEAR = 0.02;
const RIPPLE_DRIFT = { x: 0.08, y: 0 } as const;

/** A permanent water cell, and the stretch of it a ripple's centre may fall in (tiles from its corner). */
export interface WaterCell extends Vec2 {
  readonly room: {
    readonly x0: number;
    readonly x1: number;
    readonly y0: number;
    readonly y1: number;
  };
  readonly bank: {
    readonly left: boolean;
    readonly right: boolean;
    readonly top: boolean;
    readonly bottom: boolean;
  };
}

/** The permanent water cells of a grid, kept per grid: it is the same object every frame. */
const watered = new WeakMap<Grid, readonly WaterCell[]>();
export function waterCells(grid: Grid): readonly WaterCell[] {
  let cells = watered.get(grid);
  if (!cells) {
    const isWater = (x: number, y: number) => {
      const tile =
        x < 0 || y < 0 || x >= grid.width || y >= grid.height
          ? undefined
          : grid.tiles[y * grid.width + x];
      return tile?.surface?.id === 'water' && tile.surface.duration < 0;
    };
    const out: WaterCell[] = [];
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++) {
        if (!isWater(x, y)) continue;
        const left = !isWater(x - 1, y);
        const right = !isWater(x + 1, y);
        const top = !isWater(x, y - 1);
        const bottom = !isWater(x, y + 1);
        out.push({
          x,
          y,
          room: {
            x0: left ? 0 : 0.08,
            x1: right ? 1 : 0.92,
            y0: top ? 0 : 0.08,
            y1: bottom ? 1 : 0.92,
          },
          bank: { left, right, top, bottom },
        });
      }
    cells = out;
    watered.set(grid, cells);
  }
  return cells;
}

interface Ripple {
  /** Absolute scene ms the ripple starts at, and its seed; null when this cycle sits out. */
  readonly start: number;
  readonly seed: number;
}

/** What a cell's slot raises in its `cycle`th cycle, as a pure function of the three. */
function rippleOf(cell: Vec2, slot: number, cycle: number, duration: number): Ripple | null {
  const phase = hashSeed(cell.x, cell.y, slot) % RIPPLE_CYCLE;
  const seed = hashSeed(cell.x, cell.y, 1 + cycle, slot);
  if (seed % 100 >= RIPPLE_SHARE) return null;
  const early = ((seed >>> 8) & 255) / 255;
  return { start: cycle * RIPPLE_CYCLE - phase + early * (RIPPLE_CYCLE - duration), seed };
}

/** Whether a stronger ripple swells in this cell or one touching it at about the same moment. */
function crowded(
  cell: Vec2,
  slot: number,
  mine: Ripple,
  duration: number,
  water: readonly Vec2[],
): boolean {
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let other = 0; other < RIPPLE_SLOTS; other++) {
        if (!dx && !dy && other === slot) continue;
        const at = { x: cell.x + dx, y: cell.y + dy };
        // Only water raises ripples: a bank or the map's edge cannot crowd one out.
        if (!water.some((c) => c.x === at.x && c.y === at.y)) continue;
        const phase = hashSeed(at.x, at.y, other) % RIPPLE_CYCLE;
        const around = Math.floor((mine.start + phase) / RIPPLE_CYCLE);
        for (let cycle = around - 1; cycle <= around + 1; cycle++) {
          const theirs = rippleOf(at, other, cycle, duration);
          if (
            theirs &&
            Math.abs(theirs.start - mine.start) < RIPPLE_APART &&
            theirs.seed > mine.seed
          )
            return true;
        }
      }
  return false;
}

/** Snap a ground point plus a screen-space offset to the oblique world-pixel grid. */
function pixelPoint(at: Vec2, dx = 0, dy = 0): Vec2 {
  const x = Math.round((at.x - at.y) * 64 + dx) / 128;
  const y = Math.round((at.x + at.y) * 32 + dy) / 64;
  return { x: x + y, y: y - x };
}

export interface AmbientDetails {
  readonly sources: MapScene['ambienceSources'];
  readonly phase: DayPhase;
}

/** Additional village life, using the same bounded emitter list as the original ambience. */
function authoredAmbience(
  out: EmitterInstance[],
  recipe: AmbienceRecipe,
  time: number,
  still: boolean,
  water: readonly WaterCell[],
  details: AmbientDetails,
): void {
  const sources = details.sources;
  if (!sources) return;
  const stamp = (
    def: NonNullable<AmbienceRecipe['steam']>,
    at: Vec2,
    elapsed: number,
    seed: number,
    palette: string,
  ) => {
    out.push({
      def,
      from: at,
      to: at,
      elapsed,
      seed,
      palette,
      arc: 0,
      ...(still ? { still: true } : {}),
    });
  };

  if (!still && recipe.flow) {
    const flow = recipe.flow;
    const drift = { x: 0.2, y: 0 };
    const extent = glintExtent(flow, drift);
    // The complete mark and its whole journey stay within one water tile, even beside the bridge.
    if (extent.left + extent.right < 0.9 && extent.top + extent.bottom < 0.9)
      water.forEach((cell, index) => {
        if (index % 5 !== 0) return;
        const elapsed = (time + index * 2300) % 12000;
        if (elapsed >= flow.duration) return;
        const from = pixelPoint({
          x: cell.x + (1 + extent.left - extent.right) / 2,
          y: cell.y + (1 + extent.top - extent.bottom) / 2,
        });
        out.push({
          def: flow,
          from,
          to: pixelPoint({ x: from.x + drift.x, y: from.y }),
          elapsed,
          seed: hashSeed(410, index),
          palette: recipe.palette,
          arc: 0,
        });
      });
  }

  if (!still && recipe.waterLeaf && water.length)
    for (let slot = 0; slot < 2; slot++) {
      const clock = time + slot * 7000;
      const cycle = Math.floor(clock / 14000);
      const elapsed = clock % 14000;
      if (elapsed >= recipe.waterLeaf.life[1]) continue;
      const seed = hashSeed(420, slot, cycle);
      const cell = water[seed % water.length];
      if (!cell) continue;
      // A four-pixel leaf has < 0.05 tile of extent on either ground axis. The
      // generous inner corridor includes its raster and the rounding of its centre.
      const at = pixelPoint({
        x: cell.x + 0.25 + (0.5 * elapsed) / recipe.waterLeaf.life[1],
        y: cell.y + 0.5,
      });
      stamp(recipe.waterLeaf, at, elapsed, seed, recipe.palette);
    }

  const steam = recipe.steam;
  if (steam)
    sources.steam.forEach((at, index) => {
      for (let slot = 0; slot < 2; slot++) {
        const elapsed = ((still ? 1300 : time) + slot * 2000) % 4000;
        const t = elapsed / 4000;
        stamp(
          steam,
          pixelPoint(at, Math.sin(t * Math.PI) * 2, -24 * t),
          elapsed,
          hashSeed(430, index, slot),
          'air',
        );
      }
    });

  const lantern = recipe.lantern;
  if (lantern && (details.phase === 'evening' || details.phase === 'night'))
    sources.lanterns.forEach((at, index) => {
      // Two warm pixels inside the painted glass, changing only in four held steps.
      const level = still ? 1 : Math.floor((time + index * 137) / 180) % 4;
      stamp(lantern, pixelPoint(at), 100 + level * 120, hashSeed(440, index), 'fire');
    });
}

export function ambientEmitters(
  recipe: AmbienceRecipe | null,
  grid: Grid,
  time: number,
  chimneys: readonly Vec2[] = [],
  still = false,
  water: readonly WaterCell[] = [],
  canopies: readonly Vec2[] = [],
  details?: AmbientDetails,
): EmitterInstance[] {
  if (!recipe) return [];
  const out: EmitterInstance[] = [];
  const loop = (def: AmbienceRecipe['emitters'][number], index: number, from: Vec2, to: Vec2) => {
    const period = particleSpan(def);
    for (let n = 0; n < LOOPS; n++) {
      const shifted = (still ? STILL_MS : time) + (n * period) / LOOPS;
      const cycle = Math.floor(shifted / period);
      out.push({
        def,
        from,
        to,
        elapsed: shifted - cycle * period,
        seed: hashSeed(index, n, cycle),
        palette: recipe.palette,
        arc: 0,
        ...(still ? { still: true } : {}),
      });
    }
  };
  if (!still)
    recipe.emitters.forEach((def, index) =>
      loop(def, index, { x: 0, y: 0 }, { x: grid.width, y: grid.height }),
    );
  const smoke = recipe.chimney;
  if (smoke) chimneys.forEach((at, index) => loop(smoke, 100 + index, at, at));
  if (!still)
    recipe.canopy?.forEach((leaves, kind) =>
      canopies.forEach((at, index) =>
        loop(leaves, 200 + kind * 20 + index, { x: at.x - 3, y: at.y - 3 }, at),
      ),
    );
  const ripple = recipe.glint;
  if (ripple && !still)
    for (const cell of water)
      for (let slot = 0; slot < RIPPLE_SLOTS; slot++) {
        // Each slot keeps its own phase and, every cycle, its own start and place; most cycles sit out.
        const phase = hashSeed(cell.x, cell.y, slot) % RIPPLE_CYCLE;
        const mine = rippleOf(
          cell,
          slot,
          Math.floor((time + phase) / RIPPLE_CYCLE),
          ripple.duration,
        );
        if (!mine) continue;
        const elapsed = time - mine.start;
        if (
          elapsed < 0 ||
          elapsed > ripple.duration ||
          crowded(cell, slot, mine, ripple.duration, water)
        )
          continue;
        // Bound the whole seeded shape, not merely its centre, away from every bank.
        const { room, bank } = cell;
        const extent = glintExtent(ripple, RIPPLE_DRIFT);
        const x0 = bank.left ? extent.left + BANK_CLEAR : room.x0;
        const x1 = bank.right ? 1 - extent.right - BANK_CLEAR : room.x1;
        const y0 = bank.top ? extent.top + BANK_CLEAR : room.y0;
        const y1 = bank.bottom ? 1 - extent.bottom - BANK_CLEAR : room.y1;
        const x = cell.x + x0 + (((mine.seed >>> 16) & 255) / 255) * (x1 - x0);
        const y = cell.y + y0 + (((mine.seed >>> 24) & 255) / 255) * (y1 - y0);
        out.push({
          def: ripple,
          from: { x, y },
          to: { x: x + RIPPLE_DRIFT.x, y: y + RIPPLE_DRIFT.y },
          elapsed,
          seed: mine.seed,
          palette: recipe.palette,
          arc: 0,
        });
      }
  if (details) authoredAmbience(out, recipe, time, still, water, details);
  return out;
}
