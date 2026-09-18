import type { FxCel } from './fxCels';

type Cue = readonly [clip: FxCel, size: number];
export interface BendingCelCue {
  readonly cast?: Cue;
  readonly travel?: Cue;
  readonly impact: Cue;
  readonly area?: Cue;
}

/** Authored sizes in tiles. Geometry, travel speed and hit timing stay in the recipes. */
export const BENDING_CEL_CUES: Readonly<Record<string, BendingCelCue>> = {
  'fx.fire.jab': { cast: ['flame', 0.55], travel: ['flame', 1.05], impact: ['fire-burst', 1.15] },
  'fx.fire.blast': {
    cast: ['flame', 0.75],
    travel: ['flame', 1.4],
    impact: ['fire-burst', 1.8],
    area: ['fire-burst', 0.85],
  },
  'fx.fire.arc': { cast: ['flame', 0.65], impact: ['fire-burst', 1.25], area: ['flame', 0.85] },
  'fx.fire.dragon': { cast: ['flame', 0.85], impact: ['fire-burst', 1.7], area: ['flame', 1.15] },
  'fx.fire.wall': { cast: ['flame', 0.5], impact: ['fire-burst', 1], area: ['fire-burst', 1.2] },
  'fx.fire.step': { cast: ['fire-burst', 0.9], impact: ['fire-burst', 0.9] },
  'fx.fire.shield': { impact: ['fire-burst', 1.5] },
  'fx.fire.lightning': { cast: ['lightning', 0.6], impact: ['lightning', 1.45] },
  'fx.fire.chain': {
    cast: ['lightning', 0.5],
    impact: ['lightning', 1.2],
    area: ['lightning', 0.85],
  },
  'fx.fire.storm': {
    cast: ['lightning', 0.65],
    impact: ['lightning', 1.65],
    area: ['lightning', 1.1],
  },

  'fx.water.whip': { cast: ['healing', 0.6], impact: ['splash', 1.3] },
  'fx.water.pull': { cast: ['healing', 0.55], impact: ['splash', 1.1] },
  'fx.water.wave': { cast: ['healing', 0.65], impact: ['splash', 1.8], area: ['splash', 1.15] },
  'fx.water.spikes': { cast: ['ice', 0.6], impact: ['ice', 1.5], area: ['ice', 1.1] },
  'fx.water.path': { impact: ['ice', 0.65], area: ['ice', 0.6] },
  'fx.water.shield': { impact: ['ice', 1.45] },
  'fx.water.octopus': { impact: ['healing', 1.55], area: ['splash', 0.9] },
  'fx.water.heal': { cast: ['healing', 0.55], impact: ['healing', 1.25] },
  'fx.water.hands': { cast: ['healing', 0.65], impact: ['healing', 1.4] },
  'fx.water.mist': { impact: ['healing', 1.25], area: ['healing', 0.9] },
  'fx.water.tide': { impact: ['healing', 1.65], area: ['healing', 1.1] },

  'fx.earth.rock': {
    cast: ['earth-rise', 0.6],
    travel: ['boulder', 0.85],
    impact: ['earth-rise', 1.1],
  },
  'fx.earth.boulder': {
    cast: ['earth-rise', 0.85],
    travel: ['boulder', 1.4],
    impact: ['earth-rise', 1.7],
    area: ['earth-rise', 0.8],
  },
  'fx.earth.wall': {
    cast: ['earth-rise', 0.55],
    impact: ['earth-rise', 1.4],
    area: ['earth-rise', 1.4],
  },
  'fx.earth.rubble': { impact: ['earth-rise', 1.15] },
  'fx.earth.shockwave': {
    cast: ['earth-rise', 0.55],
    impact: ['earth-rise', 1.25],
    area: ['earth-rise', 0.7],
  },
  'fx.earth.fissure': {
    cast: ['earth-rise', 0.65],
    impact: ['earth-rise', 1.2],
    area: ['earth-rise', 0.9],
  },
  'fx.earth.mudslide': {
    cast: ['earth-rise', 0.5],
    impact: ['earth-rise', 0.8],
    area: ['earth-rise', 0.55],
  },
  'fx.earth.sense': { impact: ['earth-rise', 0.55] },
  'fx.earth.stance': { impact: ['earth-rise', 1.2] },
  'fx.earth.metal': { cast: ['metal', 0.55], travel: ['metal', 0.8], impact: ['metal', 1.3] },
  'fx.earth.cable': { cast: ['metal', 0.45], impact: ['metal', 0.85] },
  'fx.earth.armor': { impact: ['metal', 1.5] },

  'fx.air.blast': { cast: ['wind', 0.65], travel: ['wind', 1.35], impact: ['wind', 1.15] },
  'fx.air.gust': { cast: ['wind', 0.65], impact: ['wind', 1.5], area: ['wind', 0.9] },
  'fx.air.cyclone': { cast: ['cushion', 0.65], impact: ['cyclone', 1.7], area: ['cushion', 0.7] },
  'fx.air.tornado': { cast: ['cushion', 0.85], impact: ['cyclone', 2.2], area: ['wind', 0.9] },
  'fx.air.scooter': { cast: ['cushion', 1.15], impact: ['cushion', 1.15] },
  'fx.air.cushion': { impact: ['cushion', 1.35] },
  'fx.air.shield': { impact: ['cushion', 1.6] },
  'fx.air.boom': { cast: ['wind', 0.7], impact: ['cushion', 1.75] },
  'fx.air.shout': { cast: ['wind', 0.65], impact: ['wind', 1.4], area: ['cushion', 0.95] },
  'fx.air.shatter': { impact: ['cushion', 1.9], area: ['wind', 1.05] },
};
