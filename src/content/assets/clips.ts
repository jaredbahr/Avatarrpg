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
  'stance',
  'stanceNorth',
  'stanceNorthEast',
  'stanceSouthEast',
  'stanceSouth',
  'stanceSouthWest',
  'stanceWest',
  'stanceNorthWest',
  'koNorthEast',
  'koSouthEast',
  'koSouthWest',
  'koNorthWest',
  'hitEast',
  'hitSouthEast',
  'hitSouth',
  'hitSouthWest',
  'hitWest',
  'hitNorthWest',
  'hitNorth',
  'hitNorthEast',
] as const;
export type ClipName = (typeof CLIP_NAMES)[number];

/** The eight screen headings an eight-way locomotion sheet authors, clockwise from east. */
export const HEADINGS = [
  'east',
  'southEast',
  'south',
  'southWest',
  'west',
  'northWest',
  'north',
  'northEast',
] as const;
export type Heading = (typeof HEADINGS)[number];

/**
 * A sheet's declared locomotion capability (ADR 0050). Absent means the legacy
 * four-way contract: a mirrored side walk plus front and back poses. An
 * eight-way sheet carries an idle, walk and rest clip for every heading and
 * the clip time its walk plays per logical tile of travel in each.
 */
export interface LocomotionDef {
  readonly headings: 8;
  readonly walkMsPerTile: Readonly<Record<Heading, number>>;
}

/** The clip families an eight-way sheet authors per heading. */
export type HeadingClipBase = 'idle' | 'walk' | 'rest' | 'stance';

/** The idle, walk, rest or stance clip for a heading; east is the unsuffixed clip. */
export function headingClip(base: HeadingClipBase, heading: Heading): ClipName {
  if (heading === 'east') return base;
  return `${base}${heading[0]?.toUpperCase() ?? ''}${heading.slice(1)}` as ClipName;
}

/**
 * The screen diagonals a G knockout is authored in (ADR 0059). On the oblique
 * combat grid every orthogonal step, so every melee adjacency, is a screen
 * diagonal; north, south, east and west only turn up on a grid-diagonal move.
 */
export const KO_HEADINGS = ['southEast', 'southWest', 'northEast', 'northWest'] as const;
export type KoHeading = (typeof KO_HEADINGS)[number];

/**
 * The diagonal a heading falls on: a diagonal is its own, and an orthogonal
 * heading takes the diagonal 45 degrees clockwise of it on screen (east to
 * south-east, south to south-west, west to north-west, north to north-east).
 * One fixed turn, so the same heading always falls the same way.
 */
export const KO_HEADING: Readonly<Record<Heading, KoHeading>> = {
  east: 'southEast',
  southEast: 'southEast',
  south: 'southWest',
  southWest: 'southWest',
  west: 'northWest',
  northWest: 'northWest',
  north: 'northEast',
  northEast: 'northEast',
};

/**
 * A G sheet's knockout for a heading: the diagonal `KO_HEADING` falls it on.
 * Always suffixed: the bare `ko` is the legacy one-cel pose, drawn facing
 * right and mirrored, which a G knockout never is (ADR 0059).
 */
export function koClip(heading: Heading): ClipName {
  const diagonal = KO_HEADING[heading];
  return `ko${diagonal[0]?.toUpperCase() ?? ''}${diagonal.slice(1)}` as ClipName;
}

/**
 * A G sheet's hit reaction for a heading (ADR 0063): authored in all eight,
 * so a heading flinches in its own drawing. Always suffixed, east too: the
 * bare `hit` is the legacy mirrored cel.
 */
export function hitClip(heading: Heading): ClipName {
  return `hit${heading[0]?.toUpperCase() ?? ''}${heading.slice(1)}` as ClipName;
}

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
  /**
   * How long each frame holds, in ms, for a clip timed cel by cel (a G
   * knockout, ADR 0059). It replaces `fps`, plays by time whatever frame the
   * choreography names, and a clip that does not loop holds its last frame.
   * A frame may name an earlier frame's cel of the same clip: a hold is
   * timing, never a second cel.
   */
  readonly frameMs?: readonly number[];
  /**
   * A trimmed clip's own cel size and foot anchor (a fraction of that size),
   * when its cels are not the sheet's frame: one rectangle per clip, like a
   * bend heading's, so a body lying flat is not clipped to a standing cel.
   */
  readonly frameSize?: { readonly w: number; readonly h: number };
  readonly anchor?: { readonly x: number; readonly y: number };
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
  stance: { min: 1, max: 8 },
  stanceNorth: { min: 1, max: 8 },
  stanceNorthEast: { min: 1, max: 8 },
  stanceSouthEast: { min: 1, max: 8 },
  stanceSouth: { min: 1, max: 8 },
  stanceSouthWest: { min: 1, max: 8 },
  stanceWest: { min: 1, max: 8 },
  stanceNorthWest: { min: 1, max: 8 },
  koNorthEast: { min: 2, max: 8 },
  koSouthEast: { min: 2, max: 8 },
  koSouthWest: { min: 2, max: 8 },
  koNorthWest: { min: 2, max: 8 },
  hitEast: { min: 2, max: 8 },
  hitSouthEast: { min: 2, max: 8 },
  hitSouth: { min: 2, max: 8 },
  hitSouthWest: { min: 2, max: 8 },
  hitWest: { min: 2, max: 8 },
  hitNorthWest: { min: 2, max: 8 },
  hitNorth: { min: 2, max: 8 },
  hitNorthEast: { min: 2, max: 8 },
};

/**
 * Clips a `facing: 'both'` sheet authors for each side, so the renderer draws
 * them unflipped; its legacy actions (cast, hit and the bare KO) are
 * still mirrored. One test for both backends (ADR 0002).
 */
export function authoredForBothSides(clip: ClipName): boolean {
  return /^(idle|walk|rest|stance)|^(ko|hit)[A-Z]/.test(clip);
}

/** The clip's length in ms when it plays once through: its frame holds, or its frames at `fps`. */
export function clipDurationMs(def: ClipDef): number {
  if (def.frameMs) return def.frameMs.reduce((sum, ms) => sum + ms, 0);
  return def.fps > 0 ? (def.frames.length / def.fps) * 1000 : 0;
}

/** Clips every sheet must have. */
export const REQUIRED_CLIPS: readonly ClipName[] = ['idle', 'cast'];
