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
  'idleNorthEast',
  'idleSouthEast',
  'idleSouth',
  'idleSouthWest',
  'idleWest',
  'idleNorthWest',
  'walkNorth',
  'walkNorthEast',
  'walkSouthEast',
  'walkSouth',
  'walkSouthWest',
  'walkWest',
  'walkNorthWest',
  'rest',
  'restNorth',
  'restNorthEast',
  'restSouthEast',
  'restSouth',
  'restSouthWest',
  'restWest',
  'restNorthWest',
  'tea',
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
  idle: { min: 2, max: 4 },
  walk: { min: 2, max: 12 },
  cast: { min: 3, max: 3 },
  melee: { min: 2, max: 2 },
  hit: { min: 1, max: 1 },
  ko: { min: 1, max: 1 },
  wave: { min: 2, max: 2 },
  idleNorth: { min: 1, max: 4 },
  idleNorthEast: { min: 1, max: 4 },
  idleSouthEast: { min: 1, max: 4 },
  idleSouth: { min: 1, max: 4 },
  idleSouthWest: { min: 1, max: 4 },
  idleWest: { min: 1, max: 4 },
  idleNorthWest: { min: 1, max: 4 },
  walkNorth: { min: 4, max: 12 },
  walkNorthEast: { min: 4, max: 12 },
  walkSouthEast: { min: 4, max: 12 },
  walkSouth: { min: 4, max: 12 },
  walkSouthWest: { min: 4, max: 12 },
  walkWest: { min: 4, max: 12 },
  walkNorthWest: { min: 4, max: 12 },
  rest: { min: 1, max: 1 },
  restNorth: { min: 1, max: 1 },
  restNorthEast: { min: 1, max: 1 },
  restSouthEast: { min: 1, max: 1 },
  restSouth: { min: 1, max: 1 },
  restSouthWest: { min: 1, max: 1 },
  restWest: { min: 1, max: 1 },
  restNorthWest: { min: 1, max: 1 },
  tea: { min: 2, max: 2 },
};

/** Clips every sheet must have. */
export const REQUIRED_CLIPS: readonly ClipName[] = ['idle', 'cast'];
