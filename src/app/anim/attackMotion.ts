/** Presentation multipliers: the effect family gives each bending style its rhythm. */
import { easeInCubic, easeInOutSine, easeOutQuad } from './easing';

const DEFAULT = {
  windUp: 1,
  release: 1,
  recover: 1,
  reach: 1,
  launch: 0,
  compression: 0.985,
  extension: 1.015,
  gatherEase: easeInCubic,
  releaseEase: easeOutQuad,
};

const STYLES = {
  fire: { ...DEFAULT, release: 0.75, recover: 1.1, launch: 0.45, extension: 1.018 },
  water: {
    ...DEFAULT,
    release: 1.65,
    recover: 1.2,
    reach: 0.85,
    launch: 0.65,
    compression: 0.99,
    extension: 1.006,
    gatherEase: easeInOutSine,
    releaseEase: easeInOutSine,
  },
  earth: {
    ...DEFAULT,
    windUp: 1.3,
    release: 0.9,
    recover: 1.3,
    reach: 0.7,
    launch: 0.7,
    compression: 0.97,
    extension: 1.006,
  },
  air: {
    ...DEFAULT,
    windUp: 0.85,
    release: 1.3,
    recover: 0.9,
    reach: 0.8,
    launch: 0.55,
    compression: 0.995,
    extension: 1.008,
    gatherEase: easeInOutSine,
    releaseEase: easeInOutSine,
  },
};

export function attackMotion(fx: string, melee: boolean, self: boolean) {
  // A weapon strike and a self-cast keep a compact, familiar guard.
  if (melee || self) return DEFAULT;
  const family = fx.split('.')[1];
  return family && Object.prototype.hasOwnProperty.call(STYLES, family)
    ? STYLES[family as keyof typeof STYLES]
    : DEFAULT;
}
