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

/**
 * ADR 0003's table, by rule. Everything unsuffixed is the idle but the idle
 * itself, the melee (the cast) and the KO (the hit). A heading's G knockout
 * falls back to the legacy pose and its G hit to the legacy cel (ADR 0059,
 * ADR 0063), either one before its clip data has loaded. A heading's idle or
 * walk falls back through its front or back pose to the side clip; a
 * heading's rest is that heading's idle, then the same; and a fighting stance
 * is the idle of a sheet that authors none (ADR 0052). A jog is asked only of
 * a sheet that has one (ADR 0095).
 */
function fallbacks(clip: ClipName): readonly ClipName[] {
  const [, base = '', ns = '', ew = ''] = /^([a-z]+)(North|South)?(East|West)?$/.exec(clip) ?? [];
  if (!ns && !ew)
    return clip === 'idle'
      ? []
      : clip === 'melee'
        ? ['cast', 'idle']
        : clip === 'ko'
          ? ['hit', 'idle']
          : ['idle'];
  if (base === 'ko') return ['ko', 'hit', 'idle'];
  if (base === 'hit') return ['hit', 'idle'];
  const own = base === 'rest' || base === 'stance' ? [`idle${ns}${ew}`] : [];
  const side = ns && ew ? [`${base === 'walk' ? 'walk' : 'idle'}${ns}`] : [];
  const tail = base === 'walk' || base === 'rest' ? [base, 'idle'] : ['idle'];
  return [...own, ...side, ...tail] as ClipName[];
}

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
  for (const other of fallbacks(wanted)) {
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
  // A clip timed cel by cel plays by time, whatever frame was named (ADR 0059).
  const holds = resolved.def.frameMs;
  if (holds) return timedFrame(holds, resolved.def.loop, clipTime);
  // Melee borrows cast's compatible wind-up/release poses. Treating it as an
  // unrelated fallback held the recovery drawing through the entire attack.
  if (clipFrame !== undefined && (resolved.exact || resolved.clip === 'cast')) {
    return Math.max(0, Math.min(count - 1, Math.floor(clipFrame)));
  }
  if (clipFrame !== undefined) return count - 1;
  const raw = Math.floor((Math.max(0, clipTime) / 1000) * resolved.def.fps);
  return resolved.def.loop ? raw % count : Math.min(count - 1, raw);
}

/** The frame `clipTime` ms into a clip of per-frame holds; past the end, the last or around again. */
function timedFrame(holds: readonly number[], loop: boolean, clipTime: number): number {
  const total = holds.reduce((sum, ms) => sum + ms, 0);
  if (total <= 0) return 0;
  let t = Math.max(0, clipTime);
  if (t >= total) {
    if (!loop) return holds.length - 1;
    t %= total;
  }
  for (let i = 0; i < holds.length; i++) {
    t -= holds[i] ?? 0;
    if (t < 0) return i;
  }
  return holds.length - 1;
}
