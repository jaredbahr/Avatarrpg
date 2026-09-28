/**
 * Where a painted bend effect flies (ADR 0055, step 5).
 *
 * Pure geometry in board units: the space `projectGround` returns, where one
 * unit is a tile's width on screen and y points down. Upright art (the
 * character, a socket, the point above the target's feet an effect lands on)
 * is placed in the same units, so every point here is a screen point divided
 * by the tile's width, whatever the zoom.
 *
 * Distances are measured in tiles of one board step: the screen length of a
 * move of one tile along a grid axis. That is the prototype's `STEP = (96,
 * 48)` on the oblique board (its speeds, arc heights and whip cap were all
 * measured in `hypot(96, 48)` px) and a plain tile width on a square one. So
 * a flight lasts its real on-screen length over its speed: a diagonal throw,
 * or one to a raised hand, takes as long as it looks.
 *
 * Angles are degrees clockwise of +x, the way `atan2(dy, dx)` measures with y
 * down, which is how the effect atlas records `facing` and `angle`.
 */

import type { BendTrajectory } from '../../content/bends';
import type { Projection } from '../projection';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** One board step's screen length in board units: the length of one grid move on screen. */
export const boardStep = (projection: Projection): number =>
  projection === 'oblique' ? Math.hypot(1, 0.5) : 1;

/**
 * The unit the effect data's "tiles" are in, as board units, for a character
 * drawn at `scale` (ADR 0055, step 6): the prototype's board step measured
 * against the character, not the game's. The prototype drew the character
 * cels at 1.35x on a `hypot(96, 48)` px step; the game draws them at 0.75x on
 * a 128 px tile, times the actor's own scale. So one data tile is
 * `hypot(96, 48) * 0.75 / 1.35` packed px, about 0.466 tiles at scale 1 and
 * 2.4 times shorter than an oblique board step. A throw, an arc and a whip
 * then move against the character exactly as the approved prototype's did,
 * and a flight lasts what the prototype's lasted over the same distance
 * measured in character heights. The projection plays no part: the character
 * is the ruler.
 */
export const bendStep = (scale = 1): number => ((Math.hypot(96, 48) * 0.75) / 1.35 / 128) * scale;

export const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

const length = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

/** The direction from `a` to `b`, in degrees clockwise of +x. */
export const aimDeg = (a: Point, b: Point): number =>
  (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

/**
 * Where a water whip's head stops: `whipFraction` of the way from the launch
 * to the target, but no more than `whipMaxTiles`. The bolt leaves from here.
 * Any other trajectory has no whip, and its head is the launch point.
 */
export function whipHead(trajectory: BendTrajectory, from: Point, to: Point, step: number): Point {
  if (trajectory.kind !== 'whipBolt') return from;
  const distance = length(from, to);
  if (distance === 0) return from;
  const reach = Math.min(distance * trajectory.whipFraction, trajectory.whipMaxTiles * step);
  return lerp(from, to, reach / distance);
}

/**
 * How long the flight from `from` to `to` takes, in ms: its length in tiles
 * over the speed. For a whip-bolt, `from` is the whip's head and this is the
 * bolt; the whip itself is its launch cels.
 */
export function flightMs(trajectory: BendTrajectory, from: Point, to: Point, step: number): number {
  const speed =
    trajectory.kind === 'whipBolt'
      ? trajectory.boltSpeedTilesPerSecond
      : trajectory.speedTilesPerSecond;
  return (length(from, to) / step / speed) * 1000;
}

/**
 * The flight `ms` after it began: the point, and the spin in degrees an arc
 * adds to the cel's turn. An arc lifts by `heightTiles` at its middle, as the
 * prototype's `arc()` did (`4 h t (1 - t)`); a straight path and a bolt do
 * not. Clamped to the ends, so a late sample sits on the target.
 */
export function flightPoint(
  trajectory: BendTrajectory,
  from: Point,
  to: Point,
  step: number,
  ms: number,
): Point & { readonly spin: number } {
  const total = flightMs(trajectory, from, to, step);
  const t = total > 0 ? Math.min(1, Math.max(0, ms / total)) : 1;
  const point = lerp(from, to, t);
  if (trajectory.kind !== 'arc') return { ...point, spin: 0 };
  return {
    x: point.x,
    y: point.y - 4 * trajectory.heightTiles * step * t * (1 - t),
    spin: trajectory.spin * 360 * t,
  };
}

/** How a packed effect cel turns (its atlas `fx`); `segment` is handled by `segmentBetween`. */
export interface CelTurn {
  readonly facing?: number;
  readonly angle?: number;
}

/**
 * Whether a throw aimed at `aim` draws its turned cels flipped (ADR 0055,
 * step 6): past straight up or down, toward the screen's left, a cel turned
 * to it would stand on its head and its painted light would come from below.
 * Flipped top to bottom first, the same turn keeps the light on top. Exactly
 * up or down is not flipped.
 */
export const flipsFor = (aim: number): boolean => Math.abs(aim) > 90;

/**
 * The turn a cel is drawn at, in degrees clockwise: art that points somewhere
 * (`facing`) turns by the aim minus that; a fixed `angle` ignores the aim;
 * anything else is drawn as packed. The aim is the chord from launch to
 * target, as the prototype aimed, not the arc's tangent. A `flip`ped cel is
 * mirrored top to bottom before it turns, so its art points at `-facing` and
 * it turns by the aim plus that.
 */
export function celTurnDeg(meta: CelTurn, aim: number, flip = false): number {
  if (meta.facing !== undefined) return flip ? aim + meta.facing : aim - meta.facing;
  return meta.angle ?? 0;
}

/**
 * A segment cel laid between two points: centred on their midpoint, turned
 * along them, and its width stretched to `stretch` times their distance
 * (`segment` in the atlas). Its height is left as packed.
 */
export function segmentBetween(
  a: Point,
  b: Point,
  meta: CelTurn,
  stretch: number,
  flip = false,
): { readonly at: Point; readonly turn: number; readonly width: number } {
  return {
    at: lerp(a, b, 0.5),
    turn: celTurnDeg({ facing: meta.facing ?? 0 }, aimDeg(a, b), flip),
    width: stretch * length(a, b),
  };
}
