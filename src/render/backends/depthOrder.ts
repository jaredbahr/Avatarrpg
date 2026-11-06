import type { Projection } from '../projection';

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

/** Stable-sort comparator shared by the Canvas scene stack and its content-order tests. */
export function compareRenderedDepth(a: number, b: number): number {
  return a - b;
}

/** A figure's shadow, just under the figure standing at `figure`. */
export function shadowZ(figure: number): number {
  return figure + SHADOW_BIAS;
}

/** A piece of scenery whose foot projects to ground depth `groundY`. */
export function sceneryZ(groundY: number): number {
  return groundY + SCENERY_BIAS;
}

/**
 * How much one world pixel of foot x weighs in the top-down depth key: small
 * enough that the whole width of a board up to 9,000 world px (225 top-down
 * tiles) adds under 0.001, so it never outweighs a world pixel of foot y or
 * the shadow and scenery biases above. It only breaks ties on one row.
 */
export const TOPDOWN_X_WEIGHT = 1e-7;

/**
 * Ground depth of a foot already in world pixels (`camera.groundPoint`). The
 * oblique and orthographic boards sort by the foot's screen y alone, as they
 * always have. The top-down board (ADR 0104) sorts by the foot's screen y,
 * then its x, so two things on one row draw in the same order on both
 * backends whatever order they were listed in.
 */
export function boardDepth(foot: { x: number; y: number }, projection: Projection): number {
  return projection === 'topdown' ? foot.y + foot.x * TOPDOWN_X_WEIGHT : foot.y;
}
