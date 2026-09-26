/**
 * Residents walking between their places (ADR 0047 §7, W8).
 *
 * Presentation only. The rules place everyone on their resolved anchor the
 * moment a command lands; this diffs what the map drew before against what it
 * should draw now and walks each person across the tiles between, so nobody
 * pops from one place to the next when the day moves on.
 *
 * - A same-map move walks the slot's `via` points, then a core `findPath`
 *   route over the explore grid, round the party and the other people as the
 *   trail does. Someone going home walks to their door and fades there;
 *   someone going to another map (or nowhere) walks to the exit that leads
 *   there. Arrivals are the same in reverse.
 * - Blocked: retry through the party, whom the rules walk through anyway; if
 *   that fails too, fade out where they stand and fade in where they belong.
 *   Nobody teleports mid-stride and nobody is lost.
 * - The walk is the party's own (`partyWalked` through a private `Animator`):
 *   the same 280 ms a tile, ramps, bob and facing, with no footsteps.
 * - A conversation freezes everything: the clock stops, and no plan is made
 *   until the conversation ends, so a pinned speaker never moves.
 */

import type { ContentIndex, GameState, Grid, MapDef, Vec2 } from '../../core/types';
import { cachedGrid, euclidean, findPath, posKey, samePos } from '../../core/rules/grid';
import { resolveResidents } from '../../core/story/residents';
import { backgroundFigures, visibleNpcs } from '../../core/story/world';
import { Animator } from '../animator';
import { motionReduced } from '../ui/dom';

/** Someone the map draws from a placement: a resident's NpcDef, or a background role. */
export interface Standing {
  /** Resident or background-role id. */
  readonly id: string;
  /** The NpcDef a tap talks to; null for a role, which says nothing. */
  readonly npcId: string | null;
  readonly sprite: string;
  readonly name: string;
  readonly pos: Vec2;
}

export type ResidentMotion =
  | {
      readonly kind: 'walk';
      readonly who: Standing;
      readonly from: Vec2;
      readonly path: readonly Vec2[];
      /** Fades in at `from` (a door or an exit) before the walk. */
      readonly enter: boolean;
      /** Fades out at the end of the path (a door or an exit). */
      readonly leave: boolean;
    }
  | {
      /** No route at all: fade out at `from`, then in at `to`. */
      readonly kind: 'fade';
      readonly who: Standing;
      readonly from: Vec2 | null;
      readonly to: Vec2 | null;
    };

/** Every placed person on `map`, by resident or role id. */
export function standingOn(content: ContentIndex, map: MapDef, state: GameState): Standing[] {
  const out: Standing[] = [];
  for (const npc of visibleNpcs(content, map, state))
    if (npc.resident)
      out.push({
        id: npc.resident,
        npcId: npc.id,
        sprite: npc.sprite,
        name: npc.name,
        pos: npc.pos,
      });
  for (const role of backgroundFigures(content, map, state))
    out.push({ id: role.id, npcId: null, sprite: role.sprite, name: role.label, pos: role.pos });
  return out;
}

export interface MotionInput {
  readonly content: ContentIndex;
  readonly map: MapDef;
  readonly before: GameState;
  readonly after: GameState;
  /** The tiles the party is drawn on, leader first. */
  readonly party: readonly Vec2[];
  /**
   * Where someone still on an earlier walk is drawn now, rounded to a tile,
   * or null once they have faded off the map. Overrides `before`.
   */
  readonly drawn?: ReadonlyMap<string, Vec2 | null>;
}

/**
 * The walks that carry the map from `before`'s people to `after`'s. Pure and
 * deterministic: ids in sorted order, and `findPath`'s own tie-breaks.
 */
export function planResidentMotion(input: MotionInput): ResidentMotion[] {
  const { content, map, before, after, party, drawn } = input;
  const grid = cachedGrid(map);
  const was = new Map(standingOn(content, map, before).map((s) => [s.id, s]));
  const now = standingOn(content, map, after);
  const is = new Map(now.map((s) => [s.id, s]));
  const partyKeys = party.map(posKey);
  const motions: ResidentMotion[] = [];
  for (const id of [...new Set([...was.keys(), ...is.keys()])].sort()) {
    const who = is.get(id) ?? was.get(id);
    const from = drawn?.has(id) ? (drawn.get(id) ?? null) : (was.get(id)?.pos ?? null);
    const to = is.get(id)?.pos ?? null;
    if (!who || (from && to && samePos(from, to)) || (!from && !to)) continue;
    const start = from ?? portal(content, map, before, id, to ?? who.pos);
    const end = to ?? portal(content, map, after, id, start);
    const slot = resolveResidents(content, after).placements.find((p) => p.id === id)?.slot;
    const others = now.filter((s) => s.id !== id).map((s) => posKey(s.pos));
    const path = route(
      content,
      grid,
      start,
      [...(to ? (slot?.via ?? []) : []), end],
      [[...others, ...partyKeys], others],
    );
    motions.push(
      path
        ? { kind: 'walk', who, from: start, path, enter: !from, leave: !to }
        : { kind: 'fade', who, from, to },
    );
  }
  return motions;
}

/** `findPath` through each goal in turn, avoiding each list of tiles in turn; null if none works. */
function route(
  content: ContentIndex,
  grid: Grid,
  start: Vec2,
  goals: readonly Vec2[],
  tries: readonly (readonly string[])[],
): Vec2[] | null {
  for (const avoid of tries) {
    const path: Vec2[] = [];
    let at: Vec2 | null = start;
    for (const goal of goals) {
      if (!at) break;
      const blocked = new Set(avoid.filter((key) => key !== posKey(goal)));
      const step = findPath(
        { grid, blocked, surfaces: content.surfaces, size: 1 },
        at,
        goal,
        grid.width * grid.height,
      );
      at = step ? goal : null;
      if (step) path.push(...step.path);
    }
    if (at) return path;
  }
  return null;
}

/**
 * Where someone comes onto or leaves `map`: the door of their private anchor
 * here, or the exit toward the map they are on. A household role uses its
 * resident's door; anyone else with nowhere to go uses the nearest way out.
 */
function portal(
  content: ContentIndex,
  map: MapDef,
  state: GameState,
  id: string,
  near: Vec2,
): Vec2 {
  const placement = resolveResidents(content, state).placements.find((p) => p.id === id);
  const company = content.backgroundRoles.get(id)?.accompanies;
  const anchor = placement?.anchor ?? content.residents.get(company?.resident ?? '')?.home;
  const site = anchor ? content.anchors.get(anchor)?.site : undefined;
  const door = site?.kind === 'private' ? site.door : undefined;
  if (door?.mapId === map.id) return door.pos;
  const elsewhere = site?.kind === 'map' ? site.mapId : door?.mapId;
  const toward = map.exits?.find((exit) => exit.toMapId === elsewhere);
  if (toward) return toward.pos;
  const ways = [...(map.exits ?? []).map((exit) => exit.pos), ...(map.exit ? [map.exit.pos] : [])];
  ways.sort((a, b) => euclidean(a, near) - euclidean(b, near) || a.y - b.y || a.x - b.x);
  return ways[0] ?? near;
}

/** How long a fade at a door, an exit or a blocked route takes, at full motion. */
export const FADE_MS = 320;

interface Track {
  readonly motion: ResidentMotion;
  readonly animator: Animator | null;
  readonly start: number;
  /** When the walk (or a blocked route's fade-out) ends. */
  readonly walkEnd: number;
  readonly end: number;
  readonly fade: number;
}

/** One person as the map draws them now. */
export interface ResidentFigure {
  readonly id: string;
  readonly npcId: string | null;
  readonly sprite: string;
  readonly name: string;
  /** Their rules tile, which a tap walks to; null while they walk off the map. */
  readonly pos: Vec2 | null;
  readonly drawPos: Vec2;
  /** The walk bob, in tiles. */
  readonly offset?: Vec2;
  readonly facing: 1 | -1;
  readonly walking: boolean;
  /** Ms into the walk clip, by distance, as the party's is. */
  readonly clipTime: number;
  readonly alpha: number;
  /** Radians about the feet: a lean into the walk, eased in and out with it. */
  readonly lean?: number;
  /** 0..1: how far the figure settles onto a foot, strongest at each footfall. */
  readonly squash?: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * The walks in progress on the loaded map, on a clock of their own that
 * stands still through a conversation, a menu or a hidden tab. Owned by the
 * app so a conversation in its own scene does not forget where people were.
 */
export class ResidentWalks {
  private clock = 0;
  private last: number | null = null;
  private map: MapDef | null = null;
  private seen: GameState | null = null;
  private people: readonly Standing[] = [];
  private tracks = new Map<string, Track>();
  private facings = new Map<string, 1 | -1>();

  constructor(
    private content: ContentIndex,
    private reduced: () => boolean = motionReduced,
  ) {}

  /** Forget everything: a load, a new game or the preview puts people straight on their tiles. */
  reset(): void {
    this.map = null;
    this.seen = null;
    this.tracks.clear();
    this.facings.clear();
  }

  /** Moves the clock on, unless `frozen`. */
  tick(now: number, frozen: boolean): void {
    if (this.last !== null && !frozen) this.clock += Math.min(100, Math.max(0, now - this.last));
    this.last = now;
    for (const [id, track] of this.tracks) {
      if (this.clock < track.end) continue;
      const facing = track.animator?.facing(id);
      if (facing) this.facings.set(id, facing);
      this.tracks.delete(id);
    }
  }

  /** True while anyone is still walking or fading. */
  moving(): boolean {
    return this.tracks.size > 0;
  }

  /** True while someone is still on their way to their rules tile `pos`. */
  walkingTo(pos: Vec2): boolean {
    for (const [id, track] of this.tracks) {
      const to = this.people.find((s) => s.id === id)?.pos;
      if (to && samePos(to, pos) && this.clock < track.walkEnd) return true;
    }
    return false;
  }

  /**
   * Plans the walks from the people last drawn to `state`'s, once per state.
   * Nothing is planned while `live` is false (a conversation, a departing
   * walk): the plan waits for the state that follows it. A new map, or the
   * first state after a reset, places everyone where they stand.
   * Returns true when anyone started to move.
   */
  update(map: MapDef, state: GameState, party: readonly Vec2[], live: boolean): boolean {
    if (map !== this.map || !this.seen) {
      this.map = map;
      this.accept(state);
      this.tracks.clear();
      return false;
    }
    if (state === this.seen || !live) return false;
    // Someone caught mid-walk sets off again from the tile they are drawn on,
    // but only when their own tile changed: anyone else keeps the walk they are on.
    const was = new Map(this.people.map((s) => [s.id, s.pos]));
    const is = new Map(standingOn(this.content, map, state).map((s) => [s.id, s.pos]));
    const drawn = new Map<string, Vec2 | null>();
    for (const figure of this.figures()) {
      const a = was.get(figure.id);
      const b = is.get(figure.id);
      if (!this.tracks.has(figure.id) || (a && b ? samePos(a, b) : a === b)) continue;
      drawn.set(
        figure.id,
        !figure.pos && figure.alpha < 1
          ? null
          : { x: Math.round(figure.drawPos.x), y: Math.round(figure.drawPos.y) },
      );
    }
    const motions = planResidentMotion({
      content: this.content,
      map,
      before: this.seen,
      after: state,
      party,
      drawn,
    });
    this.accept(state);
    for (const motion of motions) this.start(motion, map);
    return motions.length > 0;
  }

  private accept(state: GameState): void {
    this.seen = state;
    this.people = this.map ? standingOn(this.content, this.map, state) : [];
  }

  private start(motion: ResidentMotion, map: MapDef): void {
    const id = motion.who.id;
    const fade = FADE_MS * (this.reduced() ? 0.02 : 1);
    const at = this.clock;
    if (motion.kind === 'fade') {
      const out = motion.from ? fade : 0;
      const end = at + out + (motion.to ? fade : 0);
      this.tracks.set(id, { motion, animator: null, start: at, walkEnd: at + out, end, fade });
      return;
    }
    const animator = new Animator(this.content, { motionReduced: this.reduced });
    animator.setProjection(map.projection ?? 'orthographic');
    animator.push(
      at,
      [{ type: 'partyWalked', unitId: id, from: motion.from, path: motion.path }],
      [],
      { silentSteps: true, delayMs: motion.enter ? FADE_MS : 0 },
    );
    const walkEnd = Math.max(at + (motion.enter ? fade : 0), animator.finishesAt);
    const end = walkEnd + (motion.leave ? fade : 0);
    this.tracks.set(id, { motion, animator, start: at, walkEnd, end, fade });
  }

  /** Everyone the map draws now: the people last planned for, and anyone still walking off. */
  figures(): ResidentFigure[] {
    const out: ResidentFigure[] = [];
    const placed = new Set<string>();
    for (const who of this.people) {
      placed.add(who.id);
      const track = this.tracks.get(who.id);
      out.push(
        track
          ? this.sample(who, track, who.pos)
          : {
              ...who,
              drawPos: who.pos,
              facing: this.facings.get(who.id) ?? 1,
              walking: false,
              clipTime: 0,
              alpha: 1,
            },
      );
    }
    for (const [id, track] of this.tracks)
      if (!placed.has(id)) out.push(this.sample(track.motion.who, track, null));
    return out;
  }

  private sample(who: Standing, track: Track, pos: Vec2 | null): ResidentFigure {
    const { motion, start, walkEnd, fade } = track;
    const c = this.clock;
    const base = { id: who.id, npcId: who.npcId, sprite: who.sprite, name: who.name, pos };
    if (motion.kind === 'fade') {
      const out = motion.from !== null && c < walkEnd;
      return {
        ...base,
        drawPos: (out ? motion.from : motion.to) ?? who.pos,
        facing: this.facings.get(who.id) ?? 1,
        walking: false,
        clipTime: 0,
        alpha: out
          ? 1 - clamp01((c - start) / fade)
          : motion.to
            ? clamp01((c - walkEnd) / fade)
            : 0,
      };
    }
    const animator = track.animator;
    const end = motion.path.at(-1) ?? motion.from;
    const drawPos = animator?.renderPos(c, who.id) ?? (c < walkEnd ? motion.from : end);
    const clip = animator?.locomotion(c, who.id, 'rest', who.sprite).clip ?? 'rest';
    const offset = animator?.offset(c, who.id);
    const facing = animator?.facing(who.id) ?? this.facings.get(who.id) ?? 1;
    const clipTime = animator?.unitPose(c, who.id, who.sprite)?.clipTime ?? 0;
    const walking = clip.startsWith('walk');
    // The lean and the footfalls ease in and out over the stroll's 120 ms ramps.
    const from = start + (motion.enter ? fade : 0);
    const into = walking ? clamp01(Math.min(c - from, walkEnd - c) / ((120 * fade) / FADE_MS)) : 0;
    return {
      ...base,
      drawPos,
      ...(offset ? { offset } : {}),
      facing,
      walking,
      clipTime,
      lean: 0.06 * facing * into,
      // A tile of travel is 500 ms of clip, one stride: a footfall where the bob touches down.
      // That is the four-way gait. An eight-way sheet (ADR 0050, ADR 0051) plays
      // its declared `walkMsPerTile` instead, so this bob would drift from its
      // feet; no resident uses one today. Read the sheet's rate before one does.
      squash: (1 - Math.abs(Math.sin((Math.PI * clipTime) / 500))) * into,
      alpha:
        motion.enter && c < start + fade
          ? clamp01((c - start) / fade)
          : motion.leave && c >= walkEnd
            ? 1 - clamp01((c - walkEnd) / fade)
            : 1,
    };
  }
}
