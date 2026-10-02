/** Persistent presentation for a prop whose fuel clock is running. */

import { OBLIQUE_UP, ORTHOGRAPHIC_UP, resolveFx } from '../../content/fx';
import type { ParticleEmitterDef } from '../../content/fx';
import type { Projection } from '../../render/projection';
import { particleSpan } from '../../render/fx/simulate';
import { hashSeed } from '../../render/fx/rng';
import type { EmitterInstance, RenderProp } from '../../render/view';

const particleDefs = (): ParticleEmitterDef[] =>
  resolveFx('fx.prop.burning').impact.filter(
    (def): def is ParticleEmitterDef => def.kind === 'particles',
  );

/**
 * The recipe is authored for the oblique ground, where straight up the screen
 * is a ground diagonal and a ground unit along it is short on screen. A flat
 * map rises along its own up, at approximately half the authored ground speed.
 */
const FLAMES: Readonly<Record<Projection, readonly ParticleEmitterDef[]>> = {
  oblique: particleDefs().map((def) => ({ ...def, spread: OBLIQUE_UP })),
  orthographic: particleDefs().map((def) => ({
    ...def,
    spread: ORTHOGRAPHIC_UP,
    speed: [def.speed[0] * 0.5, def.speed[1] * 0.5],
  })),
};

/** Loops run at once per emitter, spaced evenly through the period, so the flame never gutters. */
const LOOPS = 2;
/** The moment a still flame is frozen at: every tongue of the first loop has been born. */
const STILL_MS = 520;
/** Half the width of the patch the tongues are born in, in tiles. */
const HEARTH = 0.08;
/**
 * The flame starts part-way up the prop, not at its foot: a ground offset that
 * is straight up the screen in each projection.
 */
const LIFT: Readonly<Record<Projection, { readonly x: number; readonly y: number }>> = {
  oblique: { x: -0.22, y: -0.22 },
  orthographic: { x: 0, y: -0.22 },
};

/**
 * A small, looping flame over a burning prop. Rules paint the real fire
 * surface around a solid prop, not underneath it; this cue makes the fuelled
 * prop itself readable between upkeep events. It is state, not fidelity, so it
 * draws on every backend; held `still` (reduce motion) it is one fixed frame.
 */
export function burningPropEmitters(
  props: readonly RenderProp[],
  now: number,
  projection: Projection = 'orthographic',
  still = false,
): EmitterInstance[] {
  const out: EmitterInstance[] = [];
  props.forEach((prop) => {
    if (prop.burning === undefined) return;
    const lift = LIFT[projection];
    const centre = { x: prop.pos.x + 0.5 + lift.x, y: prop.pos.y + 0.5 + lift.y };
    const from = { x: centre.x - HEARTH, y: centre.y - HEARTH };
    const to = { x: centre.x + HEARTH, y: centre.y + HEARTH };
    FLAMES[projection].forEach((def, effectIndex) => {
      const period = particleSpan(def);
      for (let n = 0; n < (still ? 1 : LOOPS); n++) {
        const shifted = (still ? STILL_MS : now) + (n * period) / LOOPS;
        const cycle = Math.floor(shifted / period);
        out.push({
          def,
          from,
          to,
          elapsed: shifted - cycle * period,
          seed: hashSeed(0xb4, prop.pos.x, prop.pos.y, effectIndex, n, cycle),
          palette: 'fire',
          arc: 0,
          ...(still ? { still: true } : {}),
        });
      }
    });
  });
  return out;
}
