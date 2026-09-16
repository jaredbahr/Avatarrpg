/**
 * Event playback.
 *
 * The reducer returns what happened; this decides how long the player watches
 * it. Everything is a timed track sampled per frame, so the renderer stays a
 * pure function of "what does the world look like at time T".
 *
 * Reduce-motion collapses every duration to a single frame rather than
 * skipping the playback: the floating numbers and the combat log still appear,
 * they just do not linger. Turning motion off should not cost you information.
 */

import type { ContentIndex, GameEvent, Unit, Vec2 } from '../core/types';
import type { FxInstance, Floater } from '../render/renderer';
import type { Curve } from '../render/geometry/curve';
import { sampleAt, smoothPath } from '../render/geometry/curve';
import type { Easing } from './anim/easing';
import { easeInOutCubic, easeOutQuad } from './anim/easing';
import { motionReduced } from './ui/dom';

interface Track {
  readonly start: number;
  readonly duration: number;
}

interface FxTrack extends Track {
  readonly pos: Vec2;
  readonly assetKey: string;
}

interface FloaterTrack extends Track {
  readonly pos: Vec2;
  readonly text: string;
  readonly color: string;
}

interface MoveTrack extends Track {
  readonly unitId: string;
  /** The route, smoothed through the tile centres, sampled by arc length. */
  readonly curve: Curve;
  readonly ease: Easing;
}

/** Base durations in milliseconds, before the motion setting is applied. */
const TIMING = {
  step: 110,
  ability: 420,
  floater: 900,
  gap: 60,
} as const;

/** Height of the walk bob in tiles, once per tile of travel. */
const BOB = 0.05;

/** How far off dead vertical the travel has to lean before the sprite turns. */
const TURN_THRESHOLD = 0.2;

export interface AnimatorOptions {
  /** Overrides the reduce-motion lookup, so tests can run without a document. */
  readonly motionReduced?: () => boolean;
}

export class Animator {
  /** Only used to turn an ability id into its manifest fx key. */
  constructor(
    private content: ContentIndex,
    private options: AnimatorOptions = {},
  ) {}

  private fxTracks: FxTrack[] = [];
  private floaterTracks: FloaterTrack[] = [];
  private moveTracks: MoveTrack[] = [];
  /** Which way each unit last walked; a unit keeps facing that way when it stops. */
  private facings = new Map<string, 1 | -1>();
  private endsAt = 0;

  /** Multiplier applied to every duration; 0.02 when reduce-motion is on. */
  private get rate(): number {
    return (this.options.motionReduced ?? motionReduced)() ? 0.02 : 1;
  }

  clear(): void {
    this.fxTracks = [];
    this.floaterTracks = [];
    this.moveTracks = [];
    this.facings.clear();
    this.endsAt = 0;
  }

  /** True while there is still something to watch. */
  busy(now: number): boolean {
    return now < this.endsAt;
  }

  /** When the current playback finishes, in the same clock as `now`. */
  get finishesAt(): number {
    return this.endsAt;
  }

  /**
   * Schedules playback for a batch of events.
   *
   * `unitsBefore` is the battle roster as it was *before* the events applied,
   * so a move can animate from where the unit actually was.
   */
  push(now: number, events: readonly GameEvent[], unitsBefore: readonly Unit[]): void {
    const rate = this.rate;
    let cursor = Math.max(now, this.endsAt);

    const positions = new Map<string, Vec2>();
    for (const unit of unitsBefore) positions.set(unit.id, unit.pos);

    for (const event of events) {
      switch (event.type) {
        case 'unitMoved': {
          if (event.path.length === 0) break;
          const from = positions.get(event.unitId) ?? event.path[0];
          const duration = TIMING.step * event.path.length * rate;
          if (from) {
            this.moveTracks.push({
              unitId: event.unitId,
              curve: smoothPath(from, event.path),
              ease: easeInOutCubic,
              start: cursor,
              duration,
            });
          }
          const last = event.path[event.path.length - 1];
          if (last) positions.set(event.unitId, last);
          cursor += duration;
          break;
        }

        case 'abilityUsed': {
          const duration = TIMING.ability * rate;
          const assetKey = this.content.abilities.get(event.abilityId)?.fx ?? 'fx.impact';
          // Cap the tile count: a 5x5 blast does not need 25 separate bursts.
          for (const tile of event.tiles.slice(0, 24)) {
            this.fxTracks.push({ pos: tile, assetKey, start: cursor, duration });
          }
          cursor += duration * 0.5;
          break;
        }

        case 'damaged': {
          const pos = positions.get(event.unitId);
          if (pos) {
            this.floaterTracks.push({
              pos,
              text: event.crit ? `${event.amount}!` : String(event.amount),
              color: event.crit ? '#ffd98a' : '#ff9d8d',
              start: cursor,
              duration: TIMING.floater * rate,
            });
          }
          cursor += TIMING.gap * rate;
          break;
        }

        case 'healed': {
          const pos = positions.get(event.unitId);
          if (pos) {
            this.floaterTracks.push({
              pos,
              text: `+${event.amount}`,
              color: '#8fe39b',
              start: cursor,
              duration: TIMING.floater * rate,
            });
          }
          cursor += TIMING.gap * rate;
          break;
        }

        case 'attackMissed': {
          const pos = positions.get(event.targetId);
          if (pos) {
            this.floaterTracks.push({
              pos,
              text: 'miss',
              color: '#cfc3ae',
              start: cursor,
              duration: TIMING.floater * rate,
            });
          }
          cursor += TIMING.gap * rate;
          break;
        }

        case 'unitPushed': {
          const from = positions.get(event.unitId);
          if (from) {
            const duration = TIMING.step * 2 * rate;
            // A shove is a straight slide: quick off the mark, coasting to a stop.
            this.moveTracks.push({
              unitId: event.unitId,
              curve: smoothPath(from, [event.to], 0),
              ease: easeOutQuad,
              start: cursor,
              duration,
            });
            positions.set(event.unitId, event.to);
            cursor += duration;
          }
          break;
        }

        case 'unitDied': {
          const pos = positions.get(event.unitId);
          if (pos) {
            this.floaterTracks.push({
              pos,
              text: 'down',
              color: '#e2584a',
              start: cursor,
              duration: TIMING.floater * rate,
            });
          }
          cursor += TIMING.gap * 2 * rate;
          break;
        }

        default:
          break;
      }
    }

    this.endsAt = Math.max(this.endsAt, cursor);
  }

  /** Active effect instances at `now`. */
  fx(now: number): FxInstance[] {
    const out: FxInstance[] = [];
    for (const track of this.fxTracks) {
      if (now < track.start || now > track.start + track.duration) continue;
      out.push({
        pos: track.pos,
        assetKey: track.assetKey,
        progress: (now - track.start) / Math.max(1, track.duration),
      });
    }
    return out;
  }

  floaters(now: number): Floater[] {
    const out: Floater[] = [];
    for (const track of this.floaterTracks) {
      if (now < track.start || now > track.start + track.duration) continue;
      out.push({
        pos: track.pos,
        text: track.text,
        color: track.color,
        progress: (now - track.start) / Math.max(1, track.duration),
      });
    }
    return out;
  }

  /** The move track a unit is on at `now`, if any, with how far along it is in tiles. */
  private travel(now: number, unitId: string): { track: MoveTrack; distance: number } | null {
    let found: { track: MoveTrack; distance: number } | null = null;
    for (const track of this.moveTracks) {
      if (track.unitId !== unitId) continue;
      if (now < track.start) continue;
      if (now > track.start + track.duration) continue;
      const t = (now - track.start) / Math.max(1, track.duration);
      found = { track, distance: track.ease(t) * track.curve.length };
    }
    return found;
  }

  /**
   * Where a unit should be drawn at `now`, if it is mid-move. Returns
   * undefined when the unit is not animating, so the caller uses `unit.pos`.
   *
   * The route is sampled by arc length under an ease, so a walk leaves the
   * tile slowly, hurries through the middle and settles at the end instead
   * of hopping tile to tile at one speed. Sampling also turns the sprite to
   * face the way it is going, which it keeps once it has stopped.
   */
  renderPos(now: number, unitId: string): Vec2 | undefined {
    const travel = this.travel(now, unitId);
    if (!travel) return undefined;
    const sample = sampleAt(travel.track.curve, travel.distance);
    if (Math.abs(sample.tangent.x) > TURN_THRESHOLD) {
      this.facings.set(unitId, sample.tangent.x > 0 ? 1 : -1);
    }
    // The curve runs through tile centres; positions are tile corners.
    return { x: sample.pos.x - 0.5, y: sample.pos.y - 0.5 };
  }

  /**
   * The walk bob: a small lift once per tile of travel, in tile units. Drawn
   * as an offset so it never changes the order units are painted in.
   */
  offset(now: number, unitId: string): Vec2 | undefined {
    const travel = this.travel(now, unitId);
    if (!travel || travel.track.curve.length <= 0) return undefined;
    return { x: 0, y: -BOB * Math.abs(Math.sin(Math.PI * travel.distance)) };
  }

  /** Which way a unit last walked, or undefined if it has not walked yet. */
  facing(unitId: string): 1 | -1 | undefined {
    return this.facings.get(unitId);
  }

  /** Drops finished tracks. Called once a frame so memory stays flat. */
  prune(now: number): void {
    const alive = (track: Track) => now <= track.start + track.duration;
    this.fxTracks = this.fxTracks.filter(alive);
    this.floaterTracks = this.floaterTracks.filter(alive);
    this.moveTracks = this.moveTracks.filter(alive);
  }
}
