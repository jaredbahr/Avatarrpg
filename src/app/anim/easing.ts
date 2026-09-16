/**
 * Easing curves.
 *
 * Each maps 0..1 to 0..1 and is pure, so timing stays deterministic in tests.
 * Names follow the usual convention; the comments say what each one is for
 * on this board, which is the only reason to reach for one over another.
 */

export type Easing = (t: number) => number;

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

export const linear: Easing = (t) => clamp01(t);

/** Walking: slow out of the tile, quick through the middle, settle at the end. */
export const easeInOutCubic: Easing = (t) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** A shove or a slide: fast at first, coasting to a stop. */
export const easeOutQuad: Easing = (t) => {
  const x = clamp01(t);
  return 1 - (1 - x) * (1 - x);
};

/** A floater popping up: overshoots a little and comes back. */
export const easeOutBack: Easing = (t) => {
  const x = clamp01(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

/** A breath or a bob: symmetric and gentle. */
export const easeInOutSine: Easing = (t) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;

/** A wind-up: slow start, sharp finish. */
export const easeInCubic: Easing = (t) => {
  const x = clamp01(t);
  return x * x * x;
};
