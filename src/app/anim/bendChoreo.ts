/**
 * A bend on the presentation clock (ADR 0055, step 6).
 *
 * `planBend` lays one attack of a character's bend out once: its cels on
 * their authored `frameMs`, where each release leaves the hand, where its
 * painted effect lands, every hit-stop and every board kick. The rest are
 * pure samplers of that plan at a scene time, so skipped frames and replays
 * see the same thing.
 *
 * The freeze clock. Scene time runs on; the bend's presentation time `p`
 * stops for every hold. A hold freezes the character and every effect of
 * the bend together, in flight or not: a hit-stop, as the prototype froze
 * the whole frame. There are two kinds:
 * - a launch hold, `launchHoldMs` at the start of the release's contact cel;
 * - an impact hold, `impactHoldMs` the moment its effect lands.
 * Holds are serial: `p` does not move during one, so no second moment can
 * come due inside it, and a later hold starts only when `p` reaches its own
 * moment (the jab's impact hold lands while the cross flies, freezing the
 * cross with it, and the cross keeps its own hold on arrival). Holds whose
 * moments fall within `HOLD_MERGE_MS` of the first of them, one 60 Hz frame,
 * are one hold, as long as the longest: two contacts at once cost one
 * hit-stop, never their sum, and never a one-frame twitch between two.
 *
 * The character. It plays its heading's cels, never mirrored, and reads each
 * release's socket by play index (a held cel keeps its own sockets). When the
 * last effect lands after the character reaches its `recovery` key frame, it
 * holds the cel before that key, the follow-through, until the landing and
 * its hold, then plays the recovery back to the stance: the pose that threw
 * stays out while the throw is in the air. Effects never wait for it.
 *
 * The kick. Each release kicks the board by its `shakeTiles` when it lands on
 * contact, and each impact by `impact.shakeTiles`, measured like the rest of
 * the data against the character (`bendStep`). A launch kick is toward the
 * throw's side of the screen and up, the prototype's `(3, -2)` mirrored for a
 * throw to the left, and an impact kick the opposite way. It stands still for
 * the hold and then eases back to nothing over the cel it landed on, on the
 * presentation clock, so a later hold freezes it too. Reduced motion has no
 * kick.
 */

import type { Heading } from '../../content/assets/clips';
import { HEADINGS } from '../../content/assets/clips';
import type { BendAttackCue, BendEffectDef, HeadingBendDef } from '../../content/bends';
import type { BendFxIndex } from '../../render/fx/bendFx';
import { planBendFx, sampleBendFx } from '../../render/fx/bendFxSample';
import type { BendFxShot, BendReleaseCue } from '../../render/fx/bendFxSample';
import type { Point } from '../../render/fx/trajectory';
import { aimDeg, bendStep } from '../../render/fx/trajectory';
import { celOffset } from '../../render/sheets/placement';
import type { ResolvedBendFrame } from '../../render/sheets/store';
import type { BendFxSprite } from '../../render/view';

/** Holds this close together are one hold: one 60 Hz frame. */
export const HOLD_MERGE_MS = 17;

/** What a plan needs of a bend cel: `SheetStore.bendFrame`'s answer. */
export type BendCel = Pick<ResolvedBendFrame, 'frame' | 'anchor' | 'pixelsPerTile' | 'sockets'>;

export interface BendSpec {
  readonly heading: Heading;
  /** The heading's bend: `set.facings[heading]`. */
  readonly facing: HeadingBendDef;
  readonly attack: BendAttackCue;
  readonly effect: BendEffectDef;
  /** Cel `index` of the heading, by play index. */
  readonly cel: (index: number) => BendCel | null;
  /** The caster's foot on the board, in board units. */
  readonly foot: Point;
  /** Where the effect lands: the target's foot plus `impact.offsetPx`, scaled. */
  readonly to: Point;
  /** The caster's draw scale: cels, sockets and the data's tiles scale with it. */
  readonly scale: number;
  /** No kick under reduced motion. */
  readonly still?: boolean;
}

export interface BendHold {
  /** The presentation moment it freezes at, ms from the bend's start. */
  readonly at: number;
  readonly ms: number;
  /** What called it; a merged hold keeps every cause. */
  readonly causes: readonly { readonly kind: 'launch' | 'impact'; readonly release: number }[];
}

interface Kick {
  /** Presentation moment (a hold's, when it has one). */
  readonly at: number;
  /** Board units. */
  readonly x: number;
  readonly y: number;
  /** Presentation ms it eases back over. */
  readonly decay: number;
}

export interface BendPlan {
  readonly heading: Heading;
  readonly facing: HeadingBendDef;
  readonly shot: BendFxShot;
  /** Sorted, merged. */
  readonly holds: readonly BendHold[];
  /** When each release lands, presentation ms; undefined for one that does not travel. */
  readonly arrivals: readonly (number | undefined)[];
  /** The follow-through wait: the cel held and for how long, from when. */
  readonly wait: { readonly at: number; readonly ms: number; readonly frame: number };
  /** Presentation ms at which the character is back in its stance. */
  readonly bendEnds: number;
  /** Presentation ms at which the character and every effect are done. */
  readonly ends: number;
  /** Scene ms the whole thing takes: `ends` plus every hold. */
  readonly duration: number;
  readonly kicks: readonly Kick[];
}

const sum = (ms: readonly number[]): number => ms.reduce((a, b) => a + b, 0);

/** Heading to screen degrees clockwise of +x: the aim of a throw with no direction. */
export const headingDeg = (heading: Heading): number => HEADINGS.indexOf(heading) * 45;

/**
 * A release's socket over the cels up to its launch, in board units, by play
 * index. A cel that does not record it borrows the nearest earlier one that
 * does (the first, for the cels before any), so the path keeps one point a cel.
 */
function socketPath(spec: BendSpec, release: BendAttackCue['releases'][number]): Point[] {
  const points: (Point | undefined)[] = [];
  for (let index = 0; index <= release.launchFrame; index++) {
    const cel = spec.cel(index);
    const point = cel?.sockets[release.socket];
    if (!cel || !point) {
      points.push(undefined);
      continue;
    }
    const offset = celOffset(cel, point);
    points.push({
      x: spec.foot.x + offset.x * spec.scale,
      y: spec.foot.y + offset.y * spec.scale,
    });
  }
  const first = points.find((p) => p !== undefined);
  if (!first) return [];
  let last = first;
  return points.map((p) => (last = p ?? last));
}

/** Lays the attack out: cels, releases, landings, holds and kicks. */
export function planBend(fx: BendFxIndex, spec: BendSpec): BendPlan {
  const { facing, attack, effect } = spec;
  const starts = facing.frameMs.map((_, i) => sum(facing.frameMs.slice(0, i)));
  const total = sum(facing.frameMs);
  const releases: BendReleaseCue[] = attack.releases.map((release) => ({
    launchAt: starts[release.launchFrame] ?? 0,
    socket: socketPath(spec, release),
    ...(release.flash === undefined ? {} : { flash: release.flash }),
  }));
  const shot: BendFxShot = {
    effect,
    releases,
    from: spec.foot,
    to: spec.to,
    scale: spec.scale,
    heading: headingDeg(spec.heading),
  };
  const fxPlan = planBendFx(fx, shot);
  const arrivals = fxPlan.arrivals;

  // Every hold, then merged: a group is every hold within HOLD_MERGE_MS of its first.
  const raw = attack.releases.flatMap((release, index) => {
    const out: { at: number; ms: number; kind: 'launch' | 'impact'; release: number }[] = [
      {
        at: starts[release.frame] ?? 0,
        ms: release.launchHoldMs,
        kind: 'launch',
        release: index,
      },
    ];
    const lands = arrivals[index];
    if (lands !== undefined)
      out.push({ at: lands, ms: release.impactHoldMs, kind: 'impact', release: index });
    return out;
  });
  raw.sort((a, b) => a.at - b.at || (a.kind === b.kind ? 0 : a.kind === 'launch' ? -1 : 1));
  const holds: BendHold[] = [];
  const holdOf = new Map<(typeof raw)[number], BendHold>();
  for (const entry of raw) {
    const open = holds[holds.length - 1];
    if (open && entry.at - open.at < HOLD_MERGE_MS) {
      const merged: BendHold = {
        at: open.at,
        ms: Math.max(open.ms, entry.ms),
        causes: [...open.causes, { kind: entry.kind, release: entry.release }],
      };
      holds[holds.length - 1] = merged;
      for (const [key, value] of holdOf) if (value === open) holdOf.set(key, merged);
      holdOf.set(entry, merged);
    } else {
      const hold: BendHold = {
        at: entry.at,
        ms: entry.ms,
        causes: [{ kind: entry.kind, release: entry.release }],
      };
      holds.push(hold);
      holdOf.set(entry, hold);
    }
  }

  // The follow-through waits for the last landing.
  const recovery = Object.values(facing.keyFrames).find((key) => key.role === 'recovery');
  const recoveryAt = recovery ? (starts[recovery.frame] ?? total) : total;
  const lastLanding = Math.max(0, ...arrivals.map((a) => a ?? 0));
  const waitMs = recovery ? Math.max(0, lastLanding - recoveryAt) : 0;
  const wait = { at: recoveryAt, ms: waitMs, frame: Math.max(0, (recovery?.frame ?? 0) - 1) };
  const bendEnds = total + waitMs;
  const ends = Math.max(bendEnds, fxPlan.endsAt);

  const kicks: Kick[] = [];
  if (!spec.still) {
    const unit = bendStep(spec.scale);
    for (const entry of raw) {
      const release = attack.releases[entry.release];
      const cue = releases[entry.release];
      if (!release || !cue) continue;
      const tiles = entry.kind === 'launch' ? (release.shakeTiles ?? 0) : effect.impact.shakeTiles;
      if (tiles <= 0) continue;
      const launch = cue.socket[cue.socket.length - 1] ?? spec.foot;
      const direct = Math.hypot(spec.to.x - launch.x, spec.to.y - launch.y) < 1e-9;
      const aim = direct ? (shot.heading ?? 0) : aimDeg(launch, spec.to);
      const side = Math.cos((aim * Math.PI) / 180) < 0 ? -1 : 1;
      const sign = entry.kind === 'launch' ? 1 : -1;
      const length = (tiles * unit) / Math.hypot(3, 2);
      const impactCel = fx
        .layersFor(effect.id, entry.release)
        .find((layer) => layer.phase === 'impact')?.frameMs[0];
      kicks.push({
        at: holdOf.get(entry)?.at ?? entry.at,
        x: sign * side * 3 * length,
        y: sign * -2 * length,
        decay: entry.kind === 'launch' ? (facing.frameMs[release.frame] ?? 60) : (impactCel ?? 60),
      });
    }
  }

  return {
    heading: spec.heading,
    facing,
    shot,
    holds,
    arrivals,
    wait,
    bendEnds,
    ends,
    duration: ends + sum(holds.map((hold) => hold.ms)),
    kicks,
  };
}

/**
 * The presentation time `elapsed` scene ms into the bend, and the hold it is
 * frozen in, if any. Continuous and never decreasing; it stops at every hold.
 */
export function bendClock(plan: BendPlan, elapsed: number): { p: number; hold?: BendHold } {
  let frozen = 0;
  for (const hold of plan.holds) {
    const begins = hold.at + frozen;
    if (elapsed < begins) break;
    if (elapsed < begins + hold.ms) return { p: hold.at, hold };
    frozen += hold.ms;
  }
  return { p: Math.min(plan.ends, Math.max(0, elapsed - frozen)) };
}

/**
 * The scene ms, from the bend's start, at which presentation time reaches
 * `p`: for a moment with a hold, when the hold begins. What anything outside
 * the bend (the struck unit's pose, the damage, a floater) is laid out on.
 */
export function bendSceneAt(plan: BendPlan, p: number): number {
  let frozen = 0;
  for (const hold of plan.holds) {
    if (hold.at >= p) break;
    frozen += hold.ms;
  }
  return p + frozen;
}

/** The play index of the character's cel at presentation time `p`, or null once it is back in its stance. */
export function bendCelAt(plan: BendPlan, p: number): number | null {
  if (p >= plan.bendEnds) return null;
  const { wait, facing } = plan;
  if (p >= wait.at && p < wait.at + wait.ms) return wait.frame;
  let t = p >= wait.at + wait.ms ? p - wait.ms : p;
  for (const [index, ms] of facing.frameMs.entries()) {
    if (t < ms) return index;
    t -= ms;
  }
  return facing.frameMs.length - 1;
}

/** What the character draws `elapsed` scene ms in: its heading, play index and whether it is held. */
export function bendPoseAt(
  plan: BendPlan,
  elapsed: number,
): { readonly heading: Heading; readonly index: number; readonly held: boolean } | null {
  const { p, hold } = bendClock(plan, elapsed);
  const index = bendCelAt(plan, p);
  return index === null ? null : { heading: plan.heading, index, held: hold !== undefined };
}

/** The painted effect's sprites `elapsed` scene ms in. */
export function bendFxAt(fx: BendFxIndex, plan: BendPlan, elapsed: number): BendFxSprite[] {
  return sampleBendFx(fx, plan.shot, bendClock(plan, elapsed).p);
}

/** How far the board is kicked `elapsed` scene ms in, in board units (the view's `cameraNudge`). */
export function bendNudge(plan: BendPlan, elapsed: number): Point {
  const { p } = bendClock(plan, elapsed);
  let x = 0;
  let y = 0;
  for (const kick of plan.kicks) {
    const age = p - kick.at;
    if (age < 0 || age >= kick.decay) continue;
    // Standing still through the hold (age 0), then easing back to nothing.
    const left = 1 - age / kick.decay;
    x += kick.x * left;
    y += kick.y * left;
  }
  return { x, y };
}
