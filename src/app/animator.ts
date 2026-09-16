/**
 * Event playback.
 *
 * The reducer returns what happened; this decides how long the player watches
 * it. Everything is a timed track sampled per frame, so the renderer stays a
 * pure function of "what does the world look like at time T". The tracks
 * themselves are laid out by `anim/choreography.ts`; this owns the clock and
 * answers the scenes' questions: where is a unit drawn, what pose is it in,
 * which particles are live, how far has the camera been knocked.
 *
 * Reduce-motion collapses every duration to a single frame rather than
 * skipping the playback: the floating numbers and the combat log still appear,
 * they just do not linger. Turning motion off should not cost you information.
 */

import type { ContentIndex, GameEvent, Unit, Vec2 } from '../core/types';
import type { EmitterInstance, Floater } from '../render/view';
import type { ClipName } from '../render/view';
import { hashSeed, mulberry32 } from '../render/fx/rng';
import { sampleAt } from '../render/geometry/curve';
import { choreograph } from './anim/choreography';
import { Timeline } from './anim/timeline';
import type { MoveTrack, PoseTrack } from './anim/timeline';
import { motionReduced } from './ui/dom';

/** Height of the walk bob in tiles, once per tile of travel. */
const BOB = 0.05;

/** How far off dead vertical the travel has to lean before the sprite turns. */
const TURN_THRESHOLD = 0.2;

/** How often the shake picks a new direction, in ms. */
const SHAKE_STEP = 30;

export interface AnimatorOptions {
  /** Overrides the reduce-motion lookup, so tests can run without a document. */
  readonly motionReduced?: () => boolean;
}

/** Everything the renderer needs to draw a unit mid-playback. */
export interface UnitPose {
  readonly clip: ClipName;
  /** Ms into the clip. */
  readonly clipTime: number;
  /** Draw offset in tiles: the walk bob, a lunge, a recoil. */
  readonly offset: Vec2;
  readonly scale: number;
  readonly alpha: number;
  /** 0..1 white flash on a hit. */
  readonly flash: number;
  readonly facing?: 1 | -1;
}

export class Animator {
  /** Only used to turn an ability id into its manifest fx key. */
  constructor(
    private content: ContentIndex,
    private options: AnimatorOptions = {},
  ) {}

  private timeline = new Timeline();
  /** Which way each unit last walked; a unit keeps facing that way when it stops. */
  private facings = new Map<string, 1 | -1>();
  private pushes = 0;

  /** Multiplier applied to every duration; 0.02 when reduce-motion is on. */
  private get rate(): number {
    return (this.options.motionReduced ?? motionReduced)() ? 0.02 : 1;
  }

  clear(): void {
    this.timeline.clear();
    this.facings.clear();
    this.pushes = 0;
  }

  /** True while there is still something to watch. */
  busy(now: number): boolean {
    return this.timeline.busy(now);
  }

  /** When the current playback finishes, in the same clock as `now`. */
  get finishesAt(): number {
    return this.timeline.finishesAt;
  }

  /**
   * Schedules playback for a batch of events.
   *
   * `unitsBefore` is the battle roster as it was *before* the events applied,
   * so a move can animate from where the unit actually was.
   */
  push(now: number, events: readonly GameEvent[], unitsBefore: readonly Unit[]): void {
    const cursor = Math.max(now, this.timeline.finishesAt);
    const result = choreograph({
      content: this.content,
      events,
      unitsBefore,
      cursor,
      rate: this.rate,
      pushIndex: this.pushes++,
    });
    for (const track of result.tracks) this.timeline.add(track);
    this.timeline.holdUntil(result.cursor);
  }

  /** Drops finished tracks. Called once a frame so memory stays flat. */
  prune(now: number): void {
    this.timeline.prune(now);
  }

  /** The move track a unit is on at `now`, if any, with how far along it is in tiles. */
  private travel(now: number, unitId: string): { track: MoveTrack; distance: number } | null {
    let found: { track: MoveTrack; distance: number } | null = null;
    for (const track of this.timeline.active(now, 'move')) {
      if (track.unitId !== unitId) continue;
      found = { track, distance: track.ease(Timeline.progress(track, now)) * track.curve.length };
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

  /**
   * The unit's pose at `now`, or undefined when nothing is playing on it: the
   * latest-started pose track wins, the walk bob adds to it, and a hit's
   * flash decays over its own track.
   */
  unitPose(now: number, unitId: string): UnitPose | undefined {
    let pose: PoseTrack | undefined;
    for (const track of this.timeline.active(now, 'pose')) {
      if (track.unitId === unitId && (!pose || track.start >= pose.start)) pose = track;
    }
    const bob = this.offset(now, unitId);
    let flash = 0;
    for (const track of this.timeline.active(now, 'flash')) {
      if (track.unitId !== unitId) continue;
      flash = Math.max(flash, track.strength * (1 - Timeline.progress(track, now)));
    }
    if (!pose && !bob && flash === 0) return undefined;

    const t = pose ? pose.ease(Timeline.progress(pose, now)) : 0;
    const offset = pose
      ? {
          x: pose.offset.from.x + (pose.offset.to.x - pose.offset.from.x) * t + (bob?.x ?? 0),
          y: pose.offset.from.y + (pose.offset.to.y - pose.offset.from.y) * t + (bob?.y ?? 0),
        }
      : (bob ?? { x: 0, y: 0 });
    const scale = pose?.scale ? pose.scale.from + (pose.scale.to - pose.scale.from) * t : 1;
    const alpha = pose?.alpha ? pose.alpha.from + (pose.alpha.to - pose.alpha.from) * t : 1;
    const facing = pose?.facing;
    return {
      clip: pose ? pose.clip : bob ? 'walk' : 'idle',
      clipTime: pose ? now - pose.start : 0,
      offset,
      scale,
      alpha,
      flash,
      ...(facing !== undefined ? { facing } : {}),
    };
  }

  /** Live particle and stroke emitters at `now`, with their age. */
  emitters(now: number): EmitterInstance[] {
    const out: EmitterInstance[] = [];
    for (const track of this.timeline.active(now, 'emitter')) {
      out.push({
        def: track.def,
        from: track.from,
        to: track.to,
        elapsed: now - track.start,
        seed: track.seed,
        palette: track.palette,
        arc: track.arc,
      });
    }
    return out;
  }

  floaters(now: number): Floater[] {
    const out: Floater[] = [];
    for (const track of this.timeline.active(now, 'floater')) {
      out.push({
        pos: track.pos,
        text: track.text,
        color: track.color,
        progress: Timeline.progress(track, now),
      });
    }
    return out;
  }

  /**
   * How far the camera is knocked at `now`, in tiles: every live shake picks
   * a fresh direction every few frames, seeded, and dies off over its track.
   */
  cameraNudge(now: number): Vec2 {
    let x = 0;
    let y = 0;
    for (const track of this.timeline.active(now, 'shake')) {
      const step = Math.floor((now - track.start) / SHAKE_STEP);
      const r = mulberry32(hashSeed(track.seed, step));
      const angle = r() * Math.PI * 2;
      const strength = track.amplitude * (1 - Timeline.progress(track, now));
      x += Math.cos(angle) * strength;
      y += Math.sin(angle) * strength;
    }
    return { x, y };
  }
}
