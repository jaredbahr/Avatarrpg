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
 * Held `still` (Canvas 2D, or reduce motion) the motes go and the smoke is
 * one fixed frame: a wisp that stays where it is.
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

export function ambientEmitters(
  recipe: AmbienceRecipe | null,
  grid: Grid,
  time: number,
  chimneys: readonly Vec2[] = [],
  still = false,
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
  return out;
}
