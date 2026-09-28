/**
 * Wind and a startled flock over an authored scene, on the render clock only.
 *
 * Everything here is a pure function of `view.time` and scene data, in scene
 * pixels, so both backends move the same trees and fly the same birds without
 * holding state, and nothing touches the core RNG, a save or the event log.
 * One gust field drives all of it: a crest travels screen-right across the
 * board, the pines lean hardest as it passes and the grass brightens under it.
 */
import type { SceneFlock, SceneImage } from '../../core/types';
import type { MapView } from '../view';

/** Scene pixels a gust crest travels per second, and the spacing of crests. */
const GUST_SPEED = 230;
export const GUST_LENGTH = 1500;

/** 0 in a lull, 1 under a gust crest, at scene x. */
export function gust(time: number, x: number): number {
  const phase = ((time / 1000) * GUST_SPEED - x) / GUST_LENGTH;
  return 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
}

/**
 * How far a crown leans downwind, as a shear: its top moves this many pixels
 * per pixel of height while the base stays put. A 224-pixel pine tops out at
 * about four pixels, enough to read as a living tree and never as a wobble.
 * `quantize` is Canvas 2D's: three held drawings of the lean, lull to crest,
 * rather than a smooth shear.
 */
export function sway(time: number, piece: SceneImage, quantize = false): number {
  const x = piece.x + piece.width / 2;
  const g = gust(time, x);
  return quantize
    ? 0.005 + Math.min(2, Math.floor(g * 3)) * 0.006
    : 0.004 + g * 0.012 + Math.sin((time / 1000) * 1.7 + x * 0.021) * 0.003;
}

/**
 * Scene x of the last gust crest at or before `from`, for the grass band; the
 * rest follow every `GUST_LENGTH`. A number, not a list, so a frame allocates
 * nothing.
 */
export function firstGustCrest(time: number, from: number): number {
  const head = (time / 1000) * GUST_SPEED - GUST_LENGTH / 4;
  return head - Math.ceil((head - from) / GUST_LENGTH) * GUST_LENGTH;
}

/** One bird of the flush, in scene pixels about its centre. */
export interface FlockBird {
  /** Its place in the flock, the same for the whole flight. */
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly frame: number;
  /** Radians clockwise from up-screen, which is where the art's head points. */
  readonly angle: number;
  readonly alpha: number;
}

/** How long one bird is on screen; the flush is over once the last has gone. */
const FLIGHT_MS = 3400;
const STAGGER_MS = 150;

/** Ms from the flush until the last bird has gone; past it there is nothing to draw. */
export function flockSpan(flock: SceneFlock): number {
  return (flock.count - 1) * STAGGER_MS + FLIGHT_MS;
}

/**
 * Ms since the view's flush while a bird is still in the air; NaN before it,
 * once the last bird has gone, under Reduce motion or with no flock, so a
 * backend does no flock work at all outside the flight.
 */
export function flushElapsed(view: MapView): number {
  const flock = view.scene?.flock;
  const elapsed = view.time - (view.flushedAt ?? NaN);
  return flock && !view.reducedMotion && elapsed >= 0 && elapsed <= flockSpan(flock)
    ? elapsed
    : NaN;
}

/** Frames a second of the flap: quick, like a small bird's. */
const FLAP_FPS = 14;

/**
 * The birds bursting out of the perches' crowns `elapsed` ms after the flush.
 * Each crosses over the board away from its own tree and out past the far
 * side, so the flush crosses whatever part of the board the camera frames.
 * The perches are the scene's own wind-moved scenery, so birds only ever
 * leave trees that are drawn, and their centroid stands in for the board's
 * middle because the trees ring it.
 */
export function flockAt(
  flock: SceneFlock,
  perches: readonly SceneImage[],
  elapsed: number,
): FlockBird[] {
  const birds: FlockBird[] = [];
  if (elapsed < 0 || elapsed > flockSpan(flock) || perches.length === 0) return birds;
  const crown = (piece: SceneImage) => ({
    x: piece.x + piece.width / 2,
    y: piece.y + piece.height * 0.25,
  });
  const centre = perches.map(crown).reduce((a, b) => ({ x: a.x + b.x, y: a.y + b.y }));
  centre.x /= perches.length;
  centre.y /= perches.length;
  for (let i = 0; i < flock.count; i++) {
    // Spread over the perches, not the first few trees in the list.
    const perch = perches[Math.floor(((i + 0.5) * perches.length) / flock.count)];
    if (!perch) continue;
    const age = elapsed - i * STAGGER_MS;
    if (age < 0 || age > FLIGHT_MS) continue;
    const t = age / 1000;
    const start = crown(perch);
    // Away across the middle, fanned a little so the birds do not fly in file.
    const aim =
      Math.atan2(centre.x - start.x, start.y - centre.y) + (((i * 0.618) % 1) - 0.5) * 0.7;
    const reach = 260 * t + 150 * t * t;
    // A hop up off the crown first, then level flight with a flutter.
    const hop = 70 * Math.min(t, 0.4);
    const wobble = Math.sin(t * 9 + i * 1.9) * 4;
    birds.push({
      id: i,
      x: start.x + Math.sin(aim) * reach + Math.cos(aim) * wobble,
      y: start.y - Math.cos(aim) * reach - hop + Math.sin(aim) * wobble,
      frame: Math.floor(t * FLAP_FPS + i * 2) % flock.frames,
      angle: aim,
      alpha: Math.min(1, age / 120, (FLIGHT_MS - age) / 400),
    });
  }
  return birds;
}

/** The atlas crop for one flap frame; frames run left to right on one row. */
export function flockFrame(flock: SceneFlock, frame: number): SceneImage {
  return {
    url: flock.url,
    sourceRect: {
      x: frame * flock.frameSize,
      y: 0,
      width: flock.frameSize,
      height: flock.frameSize,
    },
    x: 0,
    y: 0,
    width: flock.size,
    height: flock.size,
  };
}
