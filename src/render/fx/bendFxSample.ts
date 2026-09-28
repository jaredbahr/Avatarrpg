/**
 * A painted bend effect at one moment, as the sprites the backends draw
 * (ADR 0055, step 5).
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
 * - `previousPhaseEnd` is where the layer before this one, in the effect's
 *   own order and whichever release played it, left off.
 *
 * Nothing here holds, freezes or shakes (step 6), and nothing mirrors: a
 * cel's turn comes from the board, never from the actor's facing.
 */

import type { BendEffectDef, BendEffectLayer } from '../../content/bends';
import type { BendFxSprite } from '../view';
import type { BendFxIndex } from './bendFx';
import { celIndexAt } from './bendFx';
import type { Point } from './trajectory';
import { aimDeg, celTurnDeg, flightMs, flightPoint, segmentBetween, whipHead } from './trajectory';

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
  /** One board step's length (`boardStep`). */
  readonly step: number;
}

const sum = (ms: readonly number[]): number => ms.reduce((a, b) => a + b, 0);

const plays = (layer: BendEffectLayer, release: number): boolean =>
  layer.release === undefined || layer.release === release;

/** Every sprite the shot draws at `now`, in the effect's layer order. */
export function sampleBendFx(fx: BendFxIndex, shot: BendFxShot, now: number): BendFxSprite[] {
  const { effect, to, step } = shot;
  const { trajectory, layers } = effect;
  const sprites: BendFxSprite[] = [];
  const arrival = new Map<number, number>();
  const impactEnd = new Map<number, number>();
  const segment = (layer: BendEffectLayer) => fx.layerCel(layer, 0)?.meta.segment !== undefined;
  let previous: Point = shot.from;

  layers.forEach((layer, index) => {
    const rank = layers
      .slice(0, index)
      .filter((other) => other.phase === layer.phase && segment(other)).length;
    let end = previous;
    shot.releases.forEach((cue, release) => {
      if (!plays(layer, release)) return;
      const launch = cue.socket[cue.socket.length - 1] ?? shot.from;
      const aim = aimDeg(launch, to);
      const launchMs = Math.max(
        0,
        ...layers
          .filter((l) => l.phase === 'launch' && plays(l, release))
          .map((l) => sum(l.frameMs)),
      );
      const length = sum(layer.frameMs);
      let start: number;
      switch (layer.phase) {
        case 'gather':
          start = cue.launchAt - length;
          break;
        case 'launch':
          start = cue.launchAt;
          break;
        case 'travel': {
          const clock = cue.launchAt + (trajectory.kind === 'whipBolt' ? launchMs : 0);
          const lands = clock + flightMs(trajectory, previous, to, step);
          arrival.set(release, lands);
          start = cue.launchAt + launchMs;
          end = to;
          if (now < start || now >= lands) return;
          const cel = fx.layerCel(layer, now - start);
          if (!cel) return;
          const at = flightPoint(trajectory, previous, to, step, now - clock);
          sprites.push(sprite(layer, cel, at, celTurnDeg(cel.meta, aim) + at.spin, 0));
          return;
        }
        case 'impact': {
          const lands = arrival.get(release);
          if (lands === undefined) return;
          impactEnd.set(release, Math.max(impactEnd.get(release) ?? 0, lands + length));
          start = lands;
          break;
        }
        case 'residue': {
          const after = impactEnd.get(release);
          if (after === undefined) return;
          start = after;
          break;
        }
      }
      const head = whipHead(trajectory, launch, to, step);
      if (layer.origin === 'socket' && layer.phase === 'launch') {
        end = segment(layer) ? head : launch;
      } else if (layer.origin === 'targetTile') {
        end = to;
      } else if (layer.origin === 'sourceTile') {
        end = shot.from;
      }
      const elapsed = now - start;
      const k = celAt(layer.frameMs, elapsed);
      const cel = k === null ? null : fx.layerCel(layer, elapsed);
      if (k === null || !cel) return;
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
              socketAt(cue.socket, j - 1 - rank),
              socketAt(cue.socket, j - rank),
              cel.meta,
              cel.meta.segment,
            )
          : segmentBetween(launch, head, cel.meta, cel.meta.segment);
        sprites.push({ ...sprite(layer, cel, laid.at, laid.turn, flash), width: laid.width });
        return;
      }
      const at = gather ? socketAt(cue.socket, j) : layer.origin === 'socket' ? launch : end;
      sprites.push(sprite(layer, cel, at, celTurnDeg(cel.meta, aim), flash));
    });
    previous = end;
  });
  return sprites;
}

/** Which cel a play-once layer shows `elapsed` into it; null before or after. */
const celAt = (frameMs: readonly number[], elapsed: number): number | null =>
  elapsed < 0 ? null : celIndexAt(frameMs, elapsed, false);

const socketAt = (socket: readonly Point[], index: number): Point =>
  socket[Math.max(0, Math.min(socket.length - 1, index))] ?? { x: 0, y: 0 };

function sprite(
  layer: BendEffectLayer,
  cel: NonNullable<ReturnType<BendFxIndex['layerCel']>>,
  at: Point,
  turn: number,
  flash: number,
): BendFxSprite {
  return {
    image: cel.image,
    frame: cel.frame,
    pivot: cel.meta.pivot,
    at: { x: at.x, y: at.y },
    width: cel.frame.w / BEND_FX_PX_PER_TILE,
    height: cel.frame.h / BEND_FX_PX_PER_TILE,
    turn,
    alpha: 1,
    blend: layer.blend,
    flash,
    z: layer.z,
  };
}
