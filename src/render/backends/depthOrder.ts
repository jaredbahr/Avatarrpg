/**
 * Pixi's zIndex for everything that sorts by ground depth on the board.
 *
 * Canvas 2D lists scenery ahead of every figure and sorts stably by ground
 * depth, so at an equal-depth tie a piece of frontage draws first, then the
 * figure's contact shadow, then the figure. Pixi breaks a zIndex tie by child
 * order instead, which drifts as sprites are added across map changes. These
 * offsets pin the Canvas 2D order: scenery sits under the tie, below a
 * figure's shadow as well.
 */
export const SHADOW_BIAS = -0.001;
export const SCENERY_BIAS = -0.002;
/** A piece's grass tufts paint over its foot, still under a figure's shadow at the tie. */
export const TUFT_BIAS = -0.0015;

/** A figure's shadow, just under the figure standing at `figure`. */
export function shadowZ(figure: number): number {
  return figure + SHADOW_BIAS;
}

/** A piece of scenery whose foot projects to ground depth `groundY`. */
export function sceneryZ(groundY: number): number {
  return groundY + SCENERY_BIAS;
}

/** The grass tufts at the foot of a piece whose foot projects to `groundY`. */
export function tuftZ(groundY: number): number {
  return groundY + TUFT_BIAS;
}
