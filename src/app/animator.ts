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
import type { Projection } from '../render/projection';
import { sampleAt } from '../render/geometry/curve';
import { choreograph } from './anim/choreography';
import type { HealthChange, SoundCue } from './anim/choreography';
import { Timeline } from './anim/timeline';
import type { MoveTrack, PoseTrack } from './anim/timeline';
import { motionReduced } from './ui/dom';
import { directionalClip, walkDirection, verticalClip, screenDirection } from './anim/direction';
import type { WalkDirection } from './anim/direction';
import type { MeleeDirection } from '../content/assets/clips';

/** Height of the walk bob in tiles, once per tile of travel. */
const BOB = 0.05;

/**
 * A walk clip advances by distance, not time: this many ms of clip per tile
 * of travel, so at the sheets' 4 fps a stride is two poses a tile whatever
 * the unit's speed.
 */
const WALK_MS_PER_TILE = 500;

/**
 * How long a finished walk holds its settled pose before the ready stance is
 * selected. The travel already brakes to a stop (see `anim/stroll.ts`), but the
 * last stride's pose is not a stance: without this dwell the sprite cuts
 * straight from mid-stride to idle on the frame the route ends.
 */
const STOP_SETTLE_MS = 140;

/** How far off dead vertical the travel has to lean before the sprite turns. */
const TURN_THRESHOLD = 0.2;

/** How often the shake picks a new direction, in ms. */
const SHAKE_STEP = 30;

interface HeadingCue {
  readonly unitId: string;
  readonly at: number;
  readonly tangent: Vec2;
  readonly screenSpace?: boolean;
}

interface HealthCue extends HealthChange {
  readonly order: number;
}

export interface UnitHealthPresentation {
  readonly hp: number;
  readonly fallen: boolean;
}

export interface AnimatorOptions {
  /** Overrides the reduce-motion lookup, so tests can run without a document. */
  readonly motionReduced?: () => boolean;
  /**
   * Where a push's sound cues go. Presentation only and entirely optional: the
   * animator never reads them back, nothing about `busy()` or `finishesAt`
   * depends on them, and with no sink the game is silent and otherwise
   * identical (ADR 0012).
   */
  readonly onSounds?: (cues: readonly SoundCue[], now: number) => void;
}

/** Everything the renderer needs to draw a unit mid-playback. */
export interface UnitPose {
  readonly clip: ClipName;
  /** Ms into the clip. */
  readonly clipTime: number;
  /** Upright screen offset in tile-size units: walk bob, lunge or recoil. */
  readonly offset: Vec2;
  readonly scale: number;
  readonly alpha: number;
  /** 0..1 white flash on a hit. */
  readonly flash: number;
  readonly facing?: 1 | -1;
  readonly meleeDirection?: MeleeDirection;
  /** The clip's frame, when the choreography named one. */
  readonly frame?: number;
}

export class Animator {
  /** Only used to turn an ability id into its manifest fx key. */
  constructor(
    private content: ContentIndex,
    private options: AnimatorOptions = {},
  ) {}

  private timeline = new Timeline();
  private projection: Projection = 'orthographic';

  /** Set by the scene before scheduling playback; saves retain logical positions. */
  setProjection(projection: Projection): void {
    if (this.projection === projection) return;
    this.projection = projection;
    this.facings.clear();
    this.directions.clear();
  }

  /** Which way each unit last walked; a unit keeps facing that way when it stops. */
  private facings = new Map<string, 1 | -1>();
  private directions = new Map<string, WalkDirection>();
  /** When each unit's last voluntary walk ended, and when its stop settles. */
  private stops = new Map<string, { readonly from: number; readonly to: number }>();
  private pendingHeadings: HeadingCue[] = [];
  /** Health events wait beside the tracks which make their impact visible. */
  private healthCues: HealthCue[] = [];
  private settledHealth = new Map<string, UnitHealthPresentation>();
  private healthOrder = 0;
  private pushes = 0;
  /** Unshifted batch anchor, shared by alongside pushes with independent delays. */
  private lastCursor = 0;

  /** Multiplier applied to every duration; 0.02 when reduce-motion is on. */
  private get rate(): number {
    return (this.options.motionReduced ?? motionReduced)() ? 0.02 : 1;
  }

  clear(): void {
    this.timeline.clear();
    this.facings.clear();
    this.directions.clear();
    this.stops.clear();
    this.pendingHeadings = [];
    this.healthCues = [];
    this.settledHealth.clear();
    this.healthOrder = 0;
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
   * so a move can animate from where the unit actually was. Playback queues
   * after whatever is already playing; `alongside` starts it where the
   * previous push started instead, for tracks that belong to the same
   * moment (the followers of a walk the rules only reported for the leader).
   */
  push(
    now: number,
    events: readonly GameEvent[],
    unitsBefore: readonly Unit[],
    options: {
      alongside?: boolean;
      silentSteps?: boolean;
      /** Delay from the shared batch anchor, in normal-motion milliseconds. */
      delayMs?: number;
    } = {},
  ): void {
    const base = options.alongside
      ? Math.max(now, this.lastCursor)
      : Math.max(now, this.timeline.finishesAt);
    // Followers each delay from the same batch anchor, never from the previous delay.
    this.lastCursor = base;
    const rate = this.rate;
    const cursor = base + Math.max(0, options.delayMs ?? 0) * rate;
    const result = choreograph({
      content: this.content,
      events,
      unitsBefore,
      cursor,
      rate,
      pushIndex: this.pushes++,
      silentSteps: options.silentSteps ?? options.alongside,
      projection: this.projection,
    });
    const affected = new Set(result.health.map((change) => change.unitId));
    // State is already the reducer's final result. Seed each affected unit at
    // this queued batch's start so the view keeps its prior health until the
    // choreography says the hit or heal has landed.
    for (const unit of unitsBefore) {
      if (!affected.has(unit.id)) continue;
      this.healthCues.push({
        unitId: unit.id,
        hp: unit.hp,
        fallen: unit.hp <= 0,
        at: cursor,
        order: this.healthOrder++,
      });
    }
    for (const change of result.health)
      this.healthCues.push({ ...change, order: this.healthOrder++ });
    this.healthCues.sort((a, b) => a.at - b.at || a.order - b.order);
    for (const track of result.tracks) {
      this.timeline.add(track);
      if (track.kind === 'move') {
        if (track.gait === 'slide') {
          // A push takes the stance over: the struck figure does not settle
          // out of a walk it was knocked out of.
          this.stops.delete(track.unitId);
        } else {
          const ended = track.start + track.duration;
          this.stops.set(track.unitId, { from: ended, to: ended + STOP_SETTLE_MS * rate });
          this.pendingHeadings.push({
            unitId: track.unitId,
            at: ended,
            tangent: sampleAt(track.curve, track.curve.length).tangent,
          });
        }
      }
      if (track.kind === 'pose' && track.facing !== undefined)
        this.pendingHeadings.push({
          unitId: track.unitId,
          at: track.start,
          tangent: { x: track.facing, y: 0 },
          screenSpace: true,
        });
    }
    this.pendingHeadings.sort((a, b) => a.at - b.at);
    this.timeline.holdUntil(result.cursor);
    // The cues carry animator-clock times; `now` lets the sink convert them to
    // its own clock, which for Web Audio is the only one that schedules exactly.
    if (result.sounds.length > 0) this.options.onSounds?.(result.sounds, now);
  }

  /** Drops finished tracks. Called once a frame so memory stays flat. */
  prune(now: number): void {
    this.settleHeadings(now);
    this.settleHealth(now);
    for (const [unitId, stop] of this.stops) {
      if (now >= stop.to) this.stops.delete(unitId);
    }
    this.timeline.prune(now);
  }

  /**
   * The health/fallen fields to draw at this playback instant. Rules already
   * own the final unit state; this only holds that feedback until its existing
   * choreography impact or heal clock.
   */
  unitHealth(now: number, unit: Unit): UnitHealthPresentation {
    let presentation = this.settledHealth.get(unit.id);
    let future: UnitHealthPresentation | undefined;
    for (const cue of this.healthCues) {
      if (cue.unitId !== unit.id) continue;
      const state = { hp: cue.hp, fallen: cue.fallen };
      if (cue.at <= now) presentation = state;
      else if (!future) future = state;
    }
    return presentation ?? future ?? { hp: unit.hp, fallen: unit.hp <= 0 };
  }

  /** Promote passed health cues before pruning them, retaining the settled view. */
  private settleHealth(now: number): void {
    let count = 0;
    const settled = new Set<string>();
    for (const cue of this.healthCues) {
      if (cue.at > now) break;
      this.settledHealth.set(cue.unitId, { hp: cue.hp, fallen: cue.fallen });
      settled.add(cue.unitId);
      count++;
    }
    if (count === 0) return;
    this.healthCues.splice(0, count);
    // Once a unit has no queued feedback left, reducer state is again the
    // presentation authority. This avoids retaining an old bar across a
    // later rules-owned change such as a refreshed max HP.
    for (const unitId of settled) {
      if (!this.healthCues.some((cue) => cue.unitId === unitId)) this.settledHealth.delete(unitId);
    }
  }

  /** Preserve turns even when playback skips a frame, in playback order. */
  private settleHeadings(now: number): void {
    let count = 0;
    for (const cue of this.pendingHeadings) {
      if (cue.at > now) break;
      this.rememberDirection(cue.unitId, cue.tangent, cue.screenSpace);
      count++;
    }
    if (count > 0) this.pendingHeadings.splice(0, count);
  }

  private rememberDirection(unitId: string, tangent: Vec2, screenSpace = false): void {
    const screen = screenSpace ? tangent : screenDirection(tangent, this.projection);
    this.directions.set(unitId, walkDirection(screen, this.directions.get(unitId)));
    if (Math.abs(screen.x) > TURN_THRESHOLD) this.facings.set(unitId, screen.x > 0 ? 1 : -1);
  }

  /**
   * Locomotion fields shared by the world, riverside and combat views.
   *
   * A walk that has just ended holds its settled pose for a moment before
   * `resting` (combat's ready stance) is selected, so the sprite does not cut
   * from mid-stride to guard on the frame the route ends. The dwell is
   * presentation only: `busy()` and `finishesAt` still end with the travel.
   */
  locomotion(
    now: number,
    unitId: string,
    resting: 'idle' | 'rest' = 'idle',
  ): { clip: ClipName; facing: 1 | -1 } {
    this.settleHeadings(now);
    const travel = this.walkTravel(now, unitId);
    if (travel)
      this.rememberDirection(unitId, sampleAt(travel.track.curve, travel.distance).tangent);
    const stop = !travel && this.settling(now, unitId);
    const clip = directionalClip(
      travel ? 'walk' : stop ? 'rest' : resting,
      this.directions.get(unitId),
    );
    return { clip, facing: verticalClip(clip) ? 1 : (this.facings.get(unitId) ?? 1) };
  }

  /** True while a finished walk is still holding the settled stop pose. */
  private settling(now: number, unitId: string): boolean {
    const stop = this.stops.get(unitId);
    return stop !== undefined && now >= stop.from && now < stop.to;
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

  private walkTravel(now: number, unitId: string) {
    const travel = this.travel(now, unitId);
    return travel?.track.gait === 'slide' ? null : travel;
  }

  /** Fade the lift at each end so a fractional final stride settles onto the path. */
  private walkBob(now: number, travel: { track: MoveTrack; distance: number }): Vec2 {
    const { track, distance } = travel;
    const fade = Math.max(
      0,
      Math.min(
        1,
        (now - track.start) / (90 * this.rate),
        (track.start + track.duration - now) / (90 * this.rate),
      ),
    );
    return { x: 0, y: -BOB * Math.abs(Math.sin(Math.PI * distance)) * fade };
  }

  /**
   * Where a unit should be drawn at `now`, if it is mid-move. Returns
   * its upcoming route's origin while waiting for a queued move. After the
   * final move it returns undefined, so the caller uses `unit.pos`.
   *
   * The route is sampled by arc length under an ease, so a walk leaves the
   * tile gently, holds its pace through the middle and settles at the end instead
   * of hopping tile to tile at one speed. Sampling also turns the sprite to
   * face the way it is going, which it keeps once it has stopped.
   */
  renderPos(now: number, unitId: string): Vec2 | undefined {
    this.settleHeadings(now);
    const travel = this.travel(now, unitId);
    if (!travel) {
      // State already holds final seats when several walking batches queue.
      // Hold the upcoming route's origin without playing its gait or turn early.
      const next = this.timeline.nextMove(now, unitId);
      if (!next) return undefined;
      const start = sampleAt(next.curve, 0).pos;
      return { x: start.x - 0.5, y: start.y - 0.5 };
    }
    const sample = sampleAt(travel.track.curve, travel.distance);
    if (travel.track.gait !== 'slide') this.rememberDirection(unitId, sample.tangent);
    // The curve runs through tile centres; positions are tile corners.
    return { x: sample.pos.x - 0.5, y: sample.pos.y - 0.5 };
  }

  /**
   * The walk bob: a small lift once per tile of travel, in tile units. Drawn
   * as an offset so it never changes the order units are painted in.
   */
  offset(now: number, unitId: string): Vec2 | undefined {
    const travel = this.walkTravel(now, unitId);
    if (!travel || travel.track.curve.length <= 0) return undefined;
    return this.walkBob(now, travel);
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
    this.settleHeadings(now);
    let pose: PoseTrack | undefined;
    for (const track of this.timeline.active(now, 'pose')) {
      if (track.unitId === unitId && (!pose || track.start >= pose.start)) pose = track;
    }
    const travel = this.walkTravel(now, unitId);
    const bob = travel && travel.track.curve.length > 0 ? this.walkBob(now, travel) : undefined;
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
    const frame = pose?.frame;
    return {
      clip: pose ? pose.clip : bob ? 'walk' : 'idle',
      clipTime: pose ? now - pose.start : travel ? travel.distance * WALK_MS_PER_TILE : 0,
      offset,
      scale,
      alpha,
      flash,
      ...(facing !== undefined ? { facing } : {}),
      ...(pose?.meleeDirection ? { meleeDirection: pose.meleeDirection } : {}),
      ...(frame !== undefined ? { frame } : {}),
    };
  }

  /** Live particle and stroke emitters at `now`, with their age. */
  emitters(now: number): EmitterInstance[] {
    const cels: EmitterInstance[] = [];
    const out: EmitterInstance[] = [];
    for (const track of this.timeline.active(now, 'emitter')) {
      const target = track.def.kind === 'particles' && track.def.cel ? cels : out;
      target.push({
        def: track.def,
        from: track.from,
        to: track.to,
        elapsed: now - track.start,
        seed: track.seed,
        palette: track.palette,
        arc: track.arc,
        ...(track.attachments ? { attachments: track.attachments } : {}),
      });
    }
    // The fallback's 96-particle cap must not spend its budget on debris
    // before showing the authored silhouette on every affected tile.
    return cels.length ? [...cels, ...out] : out;
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
