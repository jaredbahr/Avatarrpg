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
 * A recipe's `glint` slides a faint highlight along each of the painted water
 * cells it is given, on a per-cell clock. Held `still` (reduce motion) the
 * motes and glints go and the smoke is one fixed frame: a wisp that stays
 * where it is.
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
/** A water cell's glint cycle: a glint lives for the recipe's duration, then the cell rests. */
const GLINT_CYCLE = 9000;

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
  const glint = recipe.glint;
  if (glint && !still)
    for (const cell of water) {
      // Each cell keeps its own phase; about half its cycles sit out, so only a few are lit at once.
      const shifted = time + (hashSeed(cell.x, cell.y) % GLINT_CYCLE);
      const cycle = Math.floor(shifted / GLINT_CYCLE);
      const seed = hashSeed(cell.x, cell.y, 1 + cycle);
      const elapsed = shifted - cycle * GLINT_CYCLE;
      if (seed & 1 || elapsed > glint.duration) continue;
      // A path along the flow, inside the cell by more than half a glint and its width.
      const y = cell.y + 0.3 + (((seed >>> 8) & 255) / 255) * 0.4;
      out.push({
        def: glint,
        from: { x: cell.x + 0.3, y },
        to: { x: cell.x + 0.7, y },
        elapsed,
        seed,
        palette: recipe.palette,
        arc: 0,
      });
    }
  return out;
}
