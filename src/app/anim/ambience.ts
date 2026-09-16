/**
 * The air over the board.
 *
 * A map's ambience names a recipe of drifting motes (`FX_AMBIENCE`); this
 * turns it into live emitters for the frame. Nothing is stored between
 * frames: every emitter loops on the clock, two loops half a period apart so
 * one is always mid-life while the other is fading in, and each loop draws a
 * fresh seed so the same leaves do not fall in the same places twice.
 */

import type { Grid } from '../../core/types';
import type { AmbienceRecipe } from '../../content/fx';
import { hashSeed } from '../../render/fx/rng';
import { particleSpan } from '../../render/fx/simulate';
import type { EmitterInstance } from '../../render/view';

/** Loops run at once per emitter, spaced evenly through the period. */
const LOOPS = 2;

export function ambientEmitters(
  recipe: AmbienceRecipe | null,
  grid: Grid,
  time: number,
): EmitterInstance[] {
  if (!recipe) return [];
  const from = { x: 0, y: 0 };
  const to = { x: grid.width, y: grid.height };
  const out: EmitterInstance[] = [];
  recipe.emitters.forEach((def, index) => {
    const period = particleSpan(def);
    for (let loop = 0; loop < LOOPS; loop++) {
      const shifted = time + (loop * period) / LOOPS;
      const cycle = Math.floor(shifted / period);
      out.push({
        def,
        from,
        to,
        elapsed: shifted - cycle * period,
        seed: hashSeed(index, loop, cycle),
        palette: recipe.palette,
        arc: 0,
      });
    }
  });
  return out;
}
