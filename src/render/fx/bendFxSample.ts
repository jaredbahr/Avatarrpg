/**
 * A painted bend effect at one moment, as the sprites the backends draw
 * (ADR 0055, steps 5 and 6).
 *
 * The caller owns the clock and the positions: when each release leaves the
 * hand, where its socket was on the bend cels up to then, and the point the
 * effect lands on. This turns those into `BendFxSprite`s by the conventions
 * the review composites were built on:
 *
 * - gather layers end at their release's launch, one cel a bend cel, and a
 *   socket gather follows the socket over those cels; a segment cel spans the
 *   socket's last step, and each later segment layer of the phase the step
 *   before (the water's lead and trail);
 * - launch layers start at the launch, on the launch socket, and flash their
 *   first cel by the release's `flash`; a launch segment is the whip, from the
 *   socket to its head;
 * - the travel clock starts at the launch, or once the whip is out for a
 *   whip-bolt, and the travel cel draws once the launch cels are done;
 * - impact starts on arrival and flashes its first cel by `impact.flash`;
 * - residue starts after the impact;
 * - `previousPhaseEnd` is where the layer before this one left off for the
 *   same release; a release that has played nothing yet picks up where the
 *   layer before left off, whichever release played it (the rock rises in the
 *   stomp's crack).
 *
 * Everything that does not depend on the time is worked out once a shot
 * (`planBendFx`), so a frame only picks cels. Nothing here holds, freezes or
 * shakes: the caller's clock does (`src/app/anim/bendChoreo.ts`). Nothing
 * reads the actor's facing: a cel's turn comes from the board, and a throw
 * toward the screen's left flips its turned cels top to bottom so their light
 * stays on top (`flipsFor`).
 */

import type { BendEffectDef, BendEffectLayer } from '../../content/bends';
import type { BendFxSprite } from '../view';
import type { BendFxCel, BendFxIndex } from './bendFx';
import { celIndexAt } from './bendFx';
import type { Point } from './trajectory';
import {
  aimDeg,
  bendStep,
  celTurnDeg,
  flightMs,
  flightPoint,
  flipsFor,
  segmentBetween,
  whipHead,
} from './trajectory';

/** Effect cels are packed at the unit cels' scale, 128 px a tile. */
export const BEND_FX_PX_PER_TILE = 128;

export interface BendReleaseCue {
  /** When the release's launch cel starts, on the caller's clock (ms). */
  readonly launchAt: number;
  /**
   * The release socket on the bend cels up to its launch, oldest first, in
   * board units; the last is the launch point. A gather needs as many cels
   * before the launch as it has cels, and one more a segment.
   */
  readonly socket: readonly Point[];
  /** The contact flash, from the bend data; absent is none. */
  readonly flash?: number;
}

export interface BendFxShot {
  readonly effect: BendEffectDef;
  /** Indexed as the attack's releases. */
  readonly releases: readonly BendReleaseCue[];
  /** The caster's ground point, for a `sourceTile` layer. */
  readonly from: Point;
  /** Where the effect lands: the target's feet plus `impact.offsetPx`. */
  readonly to: Point;
  /**
   * The caster's draw scale. Cels are sized, and the data's tiles measured
   * (`bendStep`), against the character as it is drawn.
   */
  readonly scale: number;
  /**
   * The caster's heading on screen, degrees clockwise of +x: the aim of a
   * release thrown at the point it leaves from, which has no direction.
   */
  readonly heading?: number;
}

/** One layer played for one release, with everything that does not depend on the time. */
interface Run {
  readonly layer: BendEffectLayer;
  readonly cue: BendReleaseCue;
  /** When its first cel starts. */
  readonly start: number;
  /** Travel only: when it lands, and when its flight clock started. */
  readonly lands: number;
  readonly clock: number;
  /** Where the flight leaves from: the previous phase's end. */
  readonly from: Point;
  /** Where an unturned, unsocketed cel is laid. */
  readonly at: Point;
  readonly launch: Point;
  readonly head: Point;
  readonly aim: number;
  readonly flip: boolean;
  /** How many segment layers of its phase come before it (water's trail is 1). */
  readonly rank: number;
}

export interface BendFxPlan {
  readonly runs: readonly Run[];
  /** When each release lands on the caller's clock, undefined for one with no travel. */
  readonly arrivals: readonly (number | undefined)[];
  /** When the last cel of the last layer is done. */
  readonly endsAt: number;
}

const sum = (ms: readonly number[]): number => ms.reduce((a, b) => a + b, 0);

const plays = (layer: BendEffectLayer, release: number): boolean =>
  layer.release === undefined || layer.release === release;

const plans = new WeakMap<BendFxShot, BendFxPlan>();

/** The shot's timing and geometry, worked out once and kept with the shot. */
export function planBendFx(fx: BendFxIndex, shot: BendFxShot): BendFxPlan {
  const cached = plans.get(shot);
  if (cached) return cached;
  const { effect, to } = shot;
  const { trajectory, layers } = effect;
  const step = bendStep(shot.scale);
  const segment = layers.map((layer) => fx.layerCel(layer, 0)?.meta.segment !== undefined);
  const launchMs = shot.releases.map((_, release) =>
    Math.max(
      0,
      ...layers.filter((l) => l.phase === 'launch' && plays(l, release)).map((l) => sum(l.frameMs)),
    ),
  );
  const ranks = new Map<string, number>();
  const runs: Run[] = [];
  const arrivals: (number | undefined)[] = shot.releases.map(() => undefined);
  const impactEnd: (number | undefined)[] = shot.releases.map(() => undefined);
  const previous = new Map<number, Point>();
  let shared: Point = shot.from;
  let endsAt = -Infinity;

  layers.forEach((layer, index) => {
    const rank = ranks.get(layer.phase) ?? 0;
    if (segment[index]) ranks.set(layer.phase, rank + 1);
    const length = sum(layer.frameMs);
    let last = shared;
    shot.releases.forEach((cue, release) => {
      if (!plays(layer, release)) return;
      const from = previous.get(release) ?? shared;
      const launch = cue.socket[cue.socket.length - 1] ?? shot.from;
      const direct = Math.hypot(to.x - launch.x, to.y - launch.y) < 1e-9;
      const aim = direct ? (shot.heading ?? 0) : aimDeg(launch, to);
      const head = whipHead(trajectory, launch, to, step);
      let start: number;
      let lands = 0;
      let clock = 0;
      let end = from;
      switch (layer.phase) {
        case 'gather':
          start = cue.launchAt - length;
          break;
        case 'launch':
          start = cue.launchAt;
          break;
        case 'travel':
          clock = cue.launchAt + (trajectory.kind === 'whipBolt' ? (launchMs[release] ?? 0) : 0);
          lands = clock + flightMs(trajectory, from, to, step);
          arrivals[release] = lands;
          start = cue.launchAt + (launchMs[release] ?? 0);
          end = to;
          break;
        case 'impact': {
          const arrival = arrivals[release];
          if (arrival === undefined) return;
          impactEnd[release] = Math.max(impactEnd[release] ?? 0, arrival + length);
          start = arrival;
          break;
        }
        case 'residue': {
          const after = impactEnd[release];
          if (after === undefined) return;
          start = after;
          break;
        }
      }
      if (layer.phase !== 'travel') {
        if (layer.origin === 'socket' && layer.phase === 'launch')
          end = segment[index] ? head : launch;
        else if (layer.origin === 'targetTile') end = to;
        else if (layer.origin === 'sourceTile') end = shot.from;
      }
      runs.push({
        layer,
        cue,
        start,
        lands,
        clock,
        from,
        at: end,
        launch,
        head,
        aim,
        flip: flipsFor(aim),
        rank,
      });
      endsAt = Math.max(endsAt, layer.phase === 'travel' ? lands : start + length);
      previous.set(release, end);
      last = end;
    });
    shared = last;
  });
  const plan: BendFxPlan = { runs, arrivals, endsAt: Math.max(0, endsAt) };
  plans.set(shot, plan);
  return plan;
}

/** Every sprite the shot draws at `now`, in the effect's layer order. */
export function sampleBendFx(fx: BendFxIndex, shot: BendFxShot, now: number): BendFxSprite[] {
  const { effect, to, scale } = shot;
  const step = bendStep(scale);
  const sprites: BendFxSprite[] = [];
  for (const run of planBendFx(fx, shot).runs) {
    const { layer, cue, launch, aim, flip } = run;
    if (layer.phase === 'travel') {
      if (now < run.start || now >= run.lands) continue;
      const cel = fx.layerCel(layer, now - run.start);
      if (!cel) continue;
      const at = flightPoint(effect.trajectory, run.from, to, step, now - run.clock);
      const turn = celTurnDeg(cel.meta, aim, flip) + at.spin;
      sprites.push(sprite(layer, cel, at, turn, 0, scale, flip));
      continue;
    }
    const elapsed = now - run.start;
    const k = celAt(layer.frameMs, elapsed);
    const cel = k === null ? null : fx.layerCel(layer, elapsed);
    if (k === null || !cel) continue;
    const flash =
      k > 0
        ? 0
        : layer.phase === 'launch'
          ? (cue.flash ?? 0)
          : layer.phase === 'impact'
            ? effect.impact.flash
            : 0;
    // A gather's cel k is drawn on the bend cel `n - k` before the launch.
    const j = cue.socket.length - 1 - (layer.frameMs.length - k);
    const gather = layer.origin === 'socket' && layer.phase === 'gather';
    if (cel.meta.segment !== undefined) {
      // A gather segment spans the socket's step `rank` cels back; a launch one is the whip.
      const laid = gather
        ? segmentBetween(
            socketAt(cue.socket, j - 1 - run.rank, launch),
            socketAt(cue.socket, j - run.rank, launch),
            cel.meta,
            cel.meta.segment,
            flip,
          )
        : segmentBetween(launch, run.head, cel.meta, cel.meta.segment, flip);
      sprites.push({
        ...sprite(layer, cel, laid.at, laid.turn, flash, scale, flip),
        width: laid.width,
      });
      continue;
    }
    const at = gather
      ? socketAt(cue.socket, j, launch)
      : layer.origin === 'socket'
        ? launch
        : run.at;
    sprites.push(sprite(layer, cel, at, celTurnDeg(cel.meta, aim, flip), flash, scale, flip));
  }
  return sprites;
}

/** Which cel a play-once layer shows `elapsed` into it; null before or after. */
const celAt = (frameMs: readonly number[], elapsed: number): number | null =>
  elapsed < 0 ? null : celIndexAt(frameMs, elapsed, false);

/** The socket on a bend cel, clamped to the cels recorded; with none, the launch point. */
const socketAt = (socket: readonly Point[], index: number, launch: Point): Point =>
  socket[Math.max(0, Math.min(socket.length - 1, index))] ?? launch;

function sprite(
  layer: BendEffectLayer,
  cel: BendFxCel,
  at: Point,
  turn: number,
  flash: number,
  scale: number,
  flip: boolean,
): BendFxSprite {
  // Only a cel that turns with the throw is flipped; a fixed one keeps its drawing.
  const turned = cel.meta.facing !== undefined || cel.meta.segment !== undefined;
  return {
    image: cel.image,
    frame: cel.frame,
    pivot: cel.meta.pivot,
    at: { x: at.x, y: at.y },
    width: (cel.frame.w / BEND_FX_PX_PER_TILE) * scale,
    height: (cel.frame.h / BEND_FX_PX_PER_TILE) * scale,
    turn,
    ...(flip && turned ? { flipY: true } : {}),
    alpha: 1,
    blend: layer.blend,
    flash,
    z: layer.z,
  };
}
