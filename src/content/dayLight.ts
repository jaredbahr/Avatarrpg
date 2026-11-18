/**
 * The light of the day on the board (issue #881, ADR 0121): a colour grade per day phase, and the lamps.
 *
 * Presentation only. The grade is laid over the world's art (the ground plates, the painting, the
 * scenery, figures and props) and never over a rule the board shows: overlays, rings, health bars,
 * floating numbers and the HUD are drawn after it, ungraded. `src/app/dayLight.ts` resolves this
 * table into the view's `light`; the renderer never reads it.
 *
 * A grade is `colour * multiply + lift` per channel, the lift in 0-255 and weighted by the pixel's
 * own alpha, so a faded piece takes the grade exactly as an opaque one does. Owner's look A, "warm
 * dusk" (2026-11-18): a light amber-violet grade at evening, a little deeper and cooler at night,
 * every figure still clearly readable for a child; a breath of warm pink at dawn; the day untouched.
 */
import type { DayPhase } from '../core/types';

export interface LightGradeDef {
  /** Per channel, 0..1: what the art's colour is multiplied by. */
  readonly multiply: readonly [number, number, number];
  /** Per channel, 0..255: what is added back after the multiply (the violet in the shade). */
  readonly lift: readonly [number, number, number];
}

export interface PhaseLightDef {
  /** Null leaves the board as painted. */
  readonly grade: LightGradeDef | null;
  /** Whether the lamps are lit: their glass glows and each lays a pool of light at its foot. */
  readonly lampsLit: boolean;
}

export const DAY_LIGHT: Readonly<Record<DayPhase, PhaseLightDef>> = {
  dawn: { grade: { multiply: [1, 0.96, 0.96], lift: [5, 1, 4] }, lampsLit: false },
  morning: { grade: null, lampsLit: false },
  midday: { grade: null, lampsLit: false },
  afternoon: { grade: null, lampsLit: false },
  evening: { grade: { multiply: [0.92, 0.8, 0.78], lift: [10, 0, 14] }, lampsLit: true },
  night: { grade: { multiply: [0.76, 0.75, 0.86], lift: [4, 6, 22] }, lampsLit: true },
};

/**
 * How much of a phase's grade a fight takes: about half, so the board still reads at a glance in the
 * middle of a turn. 1 would be the exploration grade, 0 none.
 */
export const COMBAT_LIGHT_STRENGTH = 0.5;

/**
 * A lamp's light, as stepped rings of one warm colour added onto what is under them. Sizes are in
 * world px (one art px), so a ring edge is a hard step on the world-pixel grid (ADR 0093), never a
 * gradient. Rings run outermost first; each `alpha` is how much of `color` it adds.
 */
export interface LampGlowDef {
  readonly radiusX: number;
  readonly radiusY: number;
  readonly rings: readonly { readonly scale: number; readonly alpha: number }[];
  /** 0..255 a channel: warm amber, not lemon yellow. */
  readonly color: readonly [number, number, number];
}

/** The pool on the ground under a lit lamp: modest, so it reads as lamplight, not a spotlight. */
export const LAMP_POOL: LampGlowDef = {
  // Stronger and a little wider by the owner's eye (2026-11-18): the lamps must read as coming on.
  radiusX: 36,
  radiusY: 18,
  rings: [
    { scale: 1, alpha: 0.18 },
    { scale: 0.72, alpha: 0.3 },
    { scale: 0.42, alpha: 0.42 },
  ],
  color: [255, 148, 64],
};

/** The lantern's own glass, lit across the pane (it sits inside the pane of Ba Dan's lamps). */
export const LAMP_GLASS: LampGlowDef = {
  radiusX: 5,
  radiusY: 7,
  rings: [
    { scale: 1, alpha: 0.36 },
    { scale: 0.6, alpha: 0.56 },
  ],
  color: [255, 176, 92],
};
