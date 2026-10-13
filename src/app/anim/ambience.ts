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
const RIPPLE_CYCLE = 5200;

/** The permanent water cells of a grid, kept per grid: it is the same object every frame. */
const watered = new WeakMap<Grid, Vec2[]>();
export function waterCells(grid: Grid): readonly Vec2[] {
  let cells = watered.get(grid);
  if (!cells) {
    cells = grid.tiles.flatMap((tile, i) =>
      tile.surface?.id === 'water' && tile.surface.duration < 0
        ? [{ x: i % grid.width, y: Math.floor(i / grid.width) }]
        : [],
    );
    watered.set(grid, cells);
  }
  return cells;
}

export function ambientEmitters(
  recipe: AmbienceRecipe | null,
  grid: Grid,
  time: number,
  chimneys: readonly Vec2[] = [],
  still = false,
  water: readonly Vec2[] = [],
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
  const leaves = recipe.canopy;
  if (leaves && !still)
    canopies.forEach((at, index) => loop(leaves, 200 + index, { x: at.x - 3, y: at.y - 3 }, at));
  const ripple = recipe.glint;
  if (ripple && !still)
    for (const cell of water)
      for (let slot = 0; slot < RIPPLE_SLOTS; slot++) {
        // Each slot keeps its own phase and, every cycle, its own start and place; some cycles sit out.
        const shifted = time + (hashSeed(cell.x, cell.y, slot) % RIPPLE_CYCLE);
        const cycle = Math.floor(shifted / RIPPLE_CYCLE);
        const seed = hashSeed(cell.x, cell.y, 1 + cycle, slot);
        const start = ((seed >>> 8) & 255) / 255;
        const elapsed = shifted - cycle * RIPPLE_CYCLE - start * (RIPPLE_CYCLE - ripple.duration);
        if (seed % 4 === 0 || elapsed < 0 || elapsed > ripple.duration) continue;
        // Open water only: the middle of the cell, clear of its banks, carried down the flow (+x).
        const x = cell.x + 0.3 + slot * 0.15 + (((seed >>> 16) & 255) / 255) * 0.08;
        const y = cell.y + 0.42 + slot * 0.16 + (((seed >>> 24) & 255) / 255 - 0.5) * 0.06;
        out.push({
          def: ripple,
          from: { x, y },
          to: { x: x + 0.12, y },
          elapsed,
          seed,
          palette: recipe.palette,
          arc: 0,
        });
      }
  return out;
}
