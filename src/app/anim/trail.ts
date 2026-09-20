/**
 * The party in the world: where the followers stand, and how they walk.
 *
 * The rules keep one position for the whole party (`GameState.location`).
 * Out of combat the others are drawn too, trailing the leader a tile apart
 * along the route it has walked, like a line of people on a path. That is
 * presentation: the line lives in the scene, is never saved, and is stood
 * up again round the leader whenever the game lands somewhere without a
 * walk (a loaded save, a story jump). Pure, so it is tested without a DOM.
 */

import type { Grid, Vec2 } from '../../core/types';
import { TIMING } from './choreography';
import { strollTiming } from './stroll';
import { sampleAt, smoothPath } from '../../render/geometry/curve';
import { distance, neighbors, posKey, samePos, tileAt, reachable } from '../../core/rules/grid';

/** A follower's walk to its new place: from its old tile, through these tiles. */
export interface FollowerRoute {
  readonly index: number;
  readonly from: Vec2;
  readonly path: readonly Vec2[];
  /** Routes with the same batch can animate together; later batches wait. */
  readonly batch?: number;
  /** Offset within the phase in normal-motion milliseconds; scale with motion rate. */
  readonly delayMs?: number;
}

/** How `placeParty` lays the line out. */
export interface SeatingOptions {
  /** A tile the line leads away from: the exit the party is headed for. */
  readonly awayFrom?: Vec2;
  /** Tiles nobody may be seated on: the villagers standing about. */
  readonly avoid?: readonly Vec2[];
}

/**
 * Stands the party at `spawn` as a line: the leader on it, each follower on
 * a free walkable tile beside the member before it, so the line is a path
 * the followers can walk along from the very first step. The line leads
 * away from `awayFrom` when there is one, straight before diagonal, then in
 * the grid's fixed neighbour order, so the same map always seats them the
 * same way. A member with no free tile beside it sends the next to the
 * nearest free tile instead, and a party bigger than the open ground stacks
 * the rest on the last tile taken.
 */
export function placeParty(
  grid: Grid,
  spawn: Vec2,
  count: number,
  options: SeatingOptions = {},
): Vec2[] {
  const placed: Vec2[] = [spawn];
  const taken = new Set<string>([posKey(spawn), ...(options.avoid ?? []).map(posKey)]);
  while (placed.length < count) {
    const tail = placed[placed.length - 1] ?? spawn;
    const next = seatBeside(grid, tail, taken, options.awayFrom) ?? nearestFree(grid, tail, taken);
    if (!next) break;
    taken.add(posKey(next));
    placed.push(next);
  }
  while (placed.length < count) placed.push(placed[placed.length - 1] ?? spawn);
  return placed;
}

function free(grid: Grid, pos: Vec2, taken: ReadonlySet<string>): boolean {
  const tile = tileAt(grid, pos);
  return tile !== undefined && !tile.blocked && !taken.has(posKey(pos));
}

/** The free tile beside `tail` furthest from `awayFrom`; straight beats diagonal, then grid order. */
function seatBeside(
  grid: Grid,
  tail: Vec2,
  taken: ReadonlySet<string>,
  awayFrom: Vec2 | undefined,
): Vec2 | undefined {
  let best: { pos: Vec2; away: number; straight: number } | undefined;
  for (const next of neighbors(grid, tail)) {
    if (!free(grid, next, taken)) continue;
    const away = awayFrom ? distance(next, awayFrom) : 0;
    const straight = next.x === tail.x || next.y === tail.y ? 1 : 0;
    if (!best || away > best.away || (away === best.away && straight > best.straight)) {
      best = { pos: next, away, straight };
    }
  }
  return best?.pos;
}

/** The nearest free tile reachable from `tail`, breadth-first in grid order. */
function nearestFree(grid: Grid, tail: Vec2, taken: ReadonlySet<string>): Vec2 | undefined {
  const seen = new Set<string>([posKey(tail)]);
  const queue: Vec2[] = [tail];
  while (queue.length > 0) {
    const here = queue.shift();
    if (!here) break;
    for (const next of neighbors(grid, here)) {
      const key = posKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      const tile = tileAt(grid, next);
      if (!tile || tile.blocked) continue;
      if (!taken.has(key)) return next;
      queue.push(next);
    }
  }
  return undefined;
}

/**
 * The party as a line of tiles: the leader at its head, each member one tile
 * further back along the tiles the leader has walked. `walk` moves the line
 * forward by the leader's route and says how each follower gets to its new
 * place: through the very tiles the line held between the two, so followers
 * walk the leader's footsteps and stay one tile apart while everyone moves.
 */
export class PartyTrail {
  private line: Vec2[];
  /** Once clustered, seats are no longer an adjacent breadcrumb path. */
  private formation: { grid: Grid; avoid: readonly Vec2[] } | null = null;

  /** `members` are the party's tiles, leader first, as `placeParty` seats them. */
  constructor(members: readonly Vec2[]) {
    this.line = [...members];
  }

  /** The leader's tile. */
  get head(): Vec2 | undefined {
    return this.line[0];
  }

  /** Where each of `count` members stands, leader first. */
  positions(count: number): Vec2[] {
    const out: Vec2[] = [];
    for (let i = 0; i < count; i++) {
      const tile = this.line[Math.min(i, this.line.length - 1)];
      out.push(tile ?? { x: 0, y: 0 });
    }
    return out;
  }

  /**
   * Gather on reachable ground within two tiles of the leader. Reservations
   * retain every other member's current seat; a crowded pocket simply keeps
   * its existing formation. Routes use the rules' diagonal/collision checks.
   * The caller must animate these routes before accepting another walk.
   */
  settle(grid: Grid, avoid: readonly Vec2[] = []): FollowerRoute[] {
    const head = this.head;
    if (!head || this.line.length < 2) return [];
    const seats = [...this.line];
    const routes: FollowerRoute[] = [];
    for (let index = 1; index < seats.length; index++) {
      const from = seats[index];
      if (!from) continue;
      const blocked = new Set([...avoid, ...seats.filter((_, i) => i !== index)].map(posKey));
      const choices = [
        ...reachable(
          { grid, blocked, surfaces: new Map(), size: 1 },
          from,
          grid.width * grid.height,
        ).values(),
      ]
        .filter(
          ({ pos }) => distance(pos, head) <= 2 && !blocked.has(posKey(pos)) && drySeat(grid, pos),
        )
        .sort((a, b) => a.cost - b.cost || distance(a.pos, head) - distance(b.pos, head));
      const choice = choices[0];
      if (!choice || choice.path.length === 0) continue;
      seats[index] = choice.pos;
      routes.push({ index, from, path: choice.path });
    }
    const timed = temporalRoutes(routes, this.line);
    if (!timed) return [];
    this.line = seats;
    this.formation = { grid, avoid: [...avoid] };
    return timed.map((route) => ({ ...route, batch: 0 }));
  }

  /**
   * A complete presentation plan, including the unchanged rules leader route.
   * Clear its corridor first, then overlap routes whose timed trajectories
   * stay separated, including their initial waits and final holds. A failed clearance returns null without changing any seats.
   * The caller schedules each batch after the previous batch fully finishes.
   */
  planWalk(
    path: readonly Vec2[],
    count: number,
    grid: Grid,
    avoid: readonly Vec2[] = [],
  ): { readonly batches: readonly (readonly FollowerRoute[])[] } | null {
    if (!path.length) return { batches: [] };
    const before = this.positions(count);
    const head = before[0];
    const destination = path.at(-1);
    if (!head || !destination) return null;
    const leader: FollowerRoute = { index: 0, from: head, path };
    const positions = [...before];
    const clearance: FollowerRoute[] = [];
    const budget = grid.width * grid.height;
    for (let index = 1; index < count; index++) {
      const from = positions[index];
      if (!from || !routeNearPoint(leader, from)) continue;
      const blocked = new Set([...avoid, ...positions.filter((_, i) => i !== index)].map(posKey));
      const candidates = [
        ...reachable({ grid, blocked, surfaces: new Map(), size: 1 }, from, budget).values(),
      ]
        .filter(
          (cell) =>
            !blocked.has(posKey(cell.pos)) &&
            drySeat(grid, cell.pos) &&
            !routeNearPoint(leader, cell.pos),
        )
        .sort((a, b) => a.cost - b.cost || distance(a.pos, head) - distance(b.pos, head));
      const choice = candidates[0];
      if (!choice) return null;
      positions[index] = choice.pos;
      clearance.push({ index, from, path: choice.path });
    }
    const afterClearance = [...positions];
    const desired = [...[...path].reverse(), ...before];
    const routes: FollowerRoute[] = [leader];
    positions[0] = destination;
    for (let index = 1; index < count; index++) {
      const from = positions[index];
      const target = desired[Math.min(index, desired.length - 1)];
      if (!from || !target) continue;
      const blocked = new Set([...avoid, ...positions.filter((_, i) => i !== index)].map(posKey));
      const candidates = [
        ...reachable({ grid, blocked, surfaces: new Map(), size: 1 }, from, budget).values(),
      ]
        .filter((cell) => !blocked.has(posKey(cell.pos)))
        .sort((a, b) => {
          if (path.length <= count) {
            // A short move should not pull a nearby companion out of a good
            // resting seat merely to recreate a single-file breadcrumb chain.
            const aGap = Math.max(0, distance(a.pos, destination) - 2);
            const bGap = Math.max(0, distance(b.pos, destination) - 2);
            return (
              aGap - bGap ||
              Number(!drySeat(grid, a.pos)) - Number(!drySeat(grid, b.pos)) ||
              a.cost - b.cost
            );
          }
          return distance(a.pos, target) - distance(b.pos, target) || a.cost - b.cost;
        });
      const choice = candidates[0];
      if (!choice || !choice.path.length) continue;
      positions[index] = choice.pos;
      routes.push({ index, from, path: choice.path });
    }
    const clearPhase = temporalRoutes(clearance, before);
    const travelPhase = temporalRoutes(routes, afterClearance);
    if (!clearPhase || !travelPhase) return null;
    this.line = positions;
    this.formation = { grid, avoid: [...avoid] };
    return { batches: [...(clearPhase.length ? [clearPhase] : []), travelPhase] };
  }

  /**
   * The leader walked `path` (the tiles after its old one, in order). Returns
   * the followers' routes; a follower whose place did not change has none.
   */
  walk(path: readonly Vec2[], count: number): FollowerRoute[] {
    if (path.length === 0) return [];
    const before = this.positions(count);
    const line = [...[...path].reverse(), ...this.line];
    const routes: FollowerRoute[] = [];
    if (this.formation) {
      const { grid, avoid } = this.formation;
      const next = [...before];
      next[0] = line[0] ?? before[0] ?? { x: 0, y: 0 };
      for (let i = 1; i < count; i++) {
        const from = before[i];
        const to = line[Math.min(i, line.length - 1)];
        if (!from || !to) continue;
        const blocked = new Set([...avoid, ...next.filter((_, index) => index !== i)].map(posKey));
        const reachableSeats = reachable(
          { grid, blocked, surfaces: new Map(), size: 1 },
          from,
          grid.width * grid.height,
        );
        const route = reachableSeats.get(posKey(to));
        // Keep a held seat if another member still occupies the destination.
        // Serial playback makes these reservations true throughout the route.
        if (route && !blocked.has(posKey(to))) {
          next[i] = to;
          if (route.path.length) {
            routes.push({ index: i, from, path: route.path });
          }
        }
      }
      this.line = next;
      return routes;
    }
    for (let i = 1; i < count; i++) {
      const from = before[i];
      const to = line[Math.min(i, line.length - 1)];
      if (!from || !to || samePos(from, to)) continue;
      // The tiles between the old place and the new one, walked head-wards.
      const steps: Vec2[] = [];
      for (let k = Math.min(i + path.length - 1, line.length - 1); k >= i; k--) {
        const tile = line[k];
        if (tile && !samePos(tile, from)) steps.push(tile);
      }
      if (steps.length === 0 || !samePos(steps[steps.length - 1] ?? to, to)) steps.push(to);
      routes.push({ index: i, from, path: steps });
    }
    // Only the tiles the members stand on need remembering.
    this.line = line.slice(0, Math.max(count, 1));
    return routes;
  }
}

/** Conservative ground-space clearance, including diagonal edge crossings. */
const BODY_CLEARANCE = 0.8;
function pointSegmentDistance(point: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const span = dx * dx + dy * dy;
  const t = span
    ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / span))
    : 0;
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}
function routeNearPoint(route: FollowerRoute, point: Vec2): boolean {
  const steps = smoothPath(route.from, route.path).points;
  point = { x: point.x + 0.5, y: point.y + 0.5 };
  return steps.some(
    (to, index) =>
      pointSegmentDistance(point, steps[Math.max(0, index - 1)] ?? to, to) < BODY_CLEARANCE,
  );
}
/**
 * Reserve the actual eased curves, including start waits and final holds.
 * A trajectory moves no faster than one tile per strollStep. Checking both
 * ends of every 20ms interval bounds missed approach by at most one relative
 * speed times half the interval; the extra margin is conservative.
 */
const RESERVATION_STEP_MS = 20;
const RESERVATION_CLEARANCE = BODY_CLEARANCE + RESERVATION_STEP_MS / TIMING.strollStep;
export function temporalRoutes(
  routes: readonly FollowerRoute[],
  seats: readonly Vec2[],
): FollowerRoute[] | null {
  const prepared = routes.map((route) => {
    const curve = smoothPath(route.from, route.path);
    const timing = strollTiming(curve.length, TIMING.strollStep);
    const sample = (elapsed: number): Vec2 => {
      const pos = sampleAt(
        curve,
        timing.ease(elapsed / Math.max(1, timing.duration)) * curve.length,
      ).pos;
      return { x: pos.x - 0.5, y: pos.y - 0.5 };
    };
    return { route, duration: timing.duration, sample };
  });
  const scheduled: { movement: (typeof prepared)[number]; delay: number }[] = [];
  const movingIndices = new Set(routes.map((route) => route.index));
  const fixed = seats.filter((_, index) => !movingIndices.has(index));
  const apart = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y) >= RESERVATION_CLEARANCE;
  for (const movement of prepared) {
    // Static members cannot get out of the way at any delay.
    for (
      let time = 0;
      time <= movement.duration + RESERVATION_STEP_MS;
      time += RESERVATION_STEP_MS
    ) {
      if (fixed.some((seat) => !apart(movement.sample(time), seat))) return null;
    }
    const serialEnd = scheduled.reduce(
      (end, item) => Math.max(end, item.delay + item.movement.duration),
      0,
    );
    let accepted: number | undefined;
    for (let delay = 0; delay <= serialEnd + RESERVATION_STEP_MS; delay += RESERVATION_STEP_MS) {
      let safe = true;
      for (const earlier of scheduled) {
        const end = Math.max(delay + movement.duration, earlier.delay + earlier.movement.duration);
        for (let time = 0; time <= end + RESERVATION_STEP_MS; time += RESERVATION_STEP_MS) {
          if (
            !apart(movement.sample(time - delay), earlier.movement.sample(time - earlier.delay))
          ) {
            safe = false;
            break;
          }
        }
        if (!safe) break;
      }
      if (safe) {
        accepted = delay;
        break;
      }
    }
    if (accepted === undefined) return null;
    scheduled.push({ movement, delay: accepted });
  }
  return scheduled.map(({ movement, delay }) => ({ ...movement.route, delayMs: delay }));
}

/** Water stays legal for travelling; a party stops on dry ground. */
function drySeat(grid: Grid, pos: Vec2): boolean {
  const tile = tileAt(grid, pos);
  return (
    !!tile &&
    tile.terrain !== 'water_deep' &&
    !(tile.surface?.id === 'water' && tile.surface.duration === -1)
  );
}
