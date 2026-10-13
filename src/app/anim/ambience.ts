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

import type { Grid, Vec2 } from '../../core/types';
import type { AmbienceRecipe } from '../../content/fx';
import { hashSeed } from '../../render/fx/rng';
import { particleSpan } from '../../render/fx/simulate';
import type { EmitterInstance } from '../../render/view';

/** Loops run at once per emitter, spaced evenly through the period. */
const LOOPS = 2;
/** The moment a still wisp is frozen at: the village smoke's fullest column. */
const STILL_MS = 2400;
/** Ripples a painted water cell can show at once, and the span each slot repeats in. */
const RIPPLE_SLOTS = 2;
const RIPPLE_CYCLE = 4800;
/** Percent of a slot's cycles that raise a ripple at all. */
const RIPPLE_SHARE = 55;
/** Ripples whose swells peak this close together, in cells touching, are one too many: the weaker sits out. */
const RIPPLE_APART = 250;
/** How far a ripple's centre keeps from a cell edge that faces a bank, in tiles. */
const BANK_CLEAR = 0.28;

/** A permanent water cell, and the stretch of it a ripple's centre may fall in (tiles from its corner). */
export interface WaterCell extends Vec2 {
  readonly room: {
    readonly x0: number;
    readonly x1: number;
    readonly y0: number;
    readonly y1: number;
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
        // A side that is not water is a bank: stones, reeds or masonry. Keep clear of it.
        const edge = (water: boolean) => (water ? 0.08 : BANK_CLEAR);
        out.push({
          x,
          y,
          room: {
            x0: edge(isWater(x - 1, y)),
            x1: 1 - edge(isWater(x + 1, y)),
            y0: edge(isWater(x, y - 1)),
            y1: 1 - edge(isWater(x, y + 1)),
          },
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
function crowded(cell: Vec2, slot: number, mine: Ripple, duration: number): boolean {
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let other = 0; other < RIPPLE_SLOTS; other++) {
        if (!dx && !dy && other === slot) continue;
        const at = { x: cell.x + dx, y: cell.y + dy };
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

export function ambientEmitters(
  recipe: AmbienceRecipe | null,
  grid: Grid,
  time: number,
  chimneys: readonly Vec2[] = [],
  still = false,
  water: readonly WaterCell[] = [],
  canopies: readonly Vec2[] = [],
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
        if (elapsed < 0 || elapsed > ripple.duration || crowded(cell, slot, mine, ripple.duration))
          continue;
        // Open water only, clear of the banks, carried a little down the flow (+x).
        const { room } = cell;
        const x = cell.x + room.x0 + (((mine.seed >>> 16) & 255) / 255) * (room.x1 - room.x0);
        const y = cell.y + room.y0 + (((mine.seed >>> 24) & 255) / 255) * (room.y1 - room.y0);
        out.push({
          def: ripple,
          from: { x, y },
          to: { x: x + 0.08, y },
          elapsed,
          seed: mine.seed,
          palette: recipe.palette,
          arc: 0,
        });
      }
  return out;
}
