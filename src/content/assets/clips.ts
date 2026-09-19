/**
 * The pose vocabulary a unit sheet can carry (ADR 0003).
 *
 * A clip is a handful of key poses, not an animation: the animator supplies
 * the motion between them and the effects supply the bending. Only `idle` and
 * `cast` are required; the rest fall back down the table in
 * `src/render/sheets/resolveClip.ts`, so a sheet with two poses still plays
 * every event.
 */

export const BASE_CLIP_NAMES = ['idle', 'walk', 'cast', 'melee', 'hit', 'ko', 'wave'] as const;
export type BaseClipName = (typeof BASE_CLIP_NAMES)[number];
export const CLIP_NAMES = [
  ...BASE_CLIP_NAMES,
  'idleNorth',
  'idleSouth',
  'walkNorth',
  'walkSouth',
  'rest',
  'restNorth',
  'restSouth',
] as const;
export type ClipName = (typeof CLIP_NAMES)[number];

/** Authored screen-facing melee contact variants, when a sheet carries them. */
export const MELEE_DIRECTIONS = ['screenUp', 'screenDown'] as const;
export type MeleeDirection = (typeof MELEE_DIRECTIONS)[number];

export interface ClipDef {
  /** Frame names in the atlas, in pose order. */
  readonly frames: readonly string[];
  /** Frames a second when the clip plays by time (a walk cycle, an idle breath). */
  readonly fps: number;
  readonly loop: boolean;
  /** Optional cue frames, e.g. which frame of a melee clip lands the hit. */
  readonly events?: { readonly hit?: number };
}

/** Poses a clip must carry to be valid, and how many it may carry. */
export const CLIP_FRAME_COUNTS: Readonly<Record<ClipName, { min: number; max: number }>> = {
  idle: { min: 2, max: 2 },
  walk: { min: 2, max: 4 },
  cast: { min: 3, max: 3 },
  melee: { min: 2, max: 2 },
  hit: { min: 1, max: 1 },
  ko: { min: 1, max: 1 },
  wave: { min: 2, max: 2 },
  idleNorth: { min: 1, max: 1 },
  idleSouth: { min: 1, max: 1 },
  walkNorth: { min: 4, max: 4 },
  walkSouth: { min: 4, max: 4 },
  rest: { min: 1, max: 1 },
  restNorth: { min: 1, max: 1 },
  restSouth: { min: 1, max: 1 },
};

/** Clips every sheet must have. */
export const REQUIRED_CLIPS: readonly ClipName[] = ['idle', 'cast'];
