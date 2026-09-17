/**
 * Which poses to draw for a clip a sheet may not have.
 *
 * ADR 0003's fallback table: a walk without walk frames is the idle plus the
 * animator's bob, a melee without melee frames borrows the cast, a hit
 * without a hit frame is the idle (the flash and the recoil carry it), and a
 * KO without one is the hit, then the idle. Nothing ever resolves to no
 * frame while the sheet has an idle, and every sheet must.
 */

import type { ClipDef, ClipName } from '../../content/assets/clips';

const FALLBACK: Readonly<Record<ClipName, readonly ClipName[]>> = {
  idle: [],
  wave: ['idle'],
  walk: ['idle'],
  cast: ['idle'],
  melee: ['cast', 'idle'],
  hit: ['idle'],
  ko: ['hit', 'idle'],
};

export interface ResolvedClip {
  /** The clip actually found, which may not be the one asked for. */
  readonly clip: ClipName;
  readonly def: ClipDef;
  /** True when the clip asked for was the one found. */
  readonly exact: boolean;
}

export function resolveClip(
  clips: Partial<Record<ClipName, ClipDef>>,
  wanted: ClipName,
): ResolvedClip | null {
  const own = clips[wanted];
  if (own && own.frames.length > 0) return { clip: wanted, def: own, exact: true };
  for (const other of FALLBACK[wanted]) {
    const def = clips[other];
    if (def && def.frames.length > 0) return { clip: other, def, exact: false };
  }
  return null;
}

/**
 * The frame to draw: the one the choreography named when it knows (a cast's
 * wind-up is frame 0, whatever the fps), otherwise the clip's own timing from
 * how long it has been playing. A frame named for a clip that resolved to a
 * shorter fallback is clamped; a mismatched fallback (a cast frame on an idle)
 * takes the last frame, which is the pose nearest "doing something".
 */
export function frameIndex(
  resolved: ResolvedClip,
  clipTime: number,
  clipFrame: number | undefined,
): number {
  const count = resolved.def.frames.length;
  if (count <= 1) return 0;
  if (clipFrame !== undefined && resolved.exact) {
    return Math.max(0, Math.min(count - 1, Math.floor(clipFrame)));
  }
  if (clipFrame !== undefined) return count - 1;
  const raw = Math.floor((Math.max(0, clipTime) / 1000) * resolved.def.fps);
  return resolved.def.loop ? raw % count : Math.min(count - 1, raw);
}
