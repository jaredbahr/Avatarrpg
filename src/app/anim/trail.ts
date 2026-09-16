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
import { distance, neighbors, posKey, samePos, tileAt } from '../../core/rules/grid';

/** A follower's walk to its new place: from its old tile, through these tiles. */
export interface FollowerRoute {
  readonly index: number;
  readonly from: Vec2;
  readonly path: readonly Vec2[];
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
   * The leader walked `path` (the tiles after its old one, in order). Returns
   * the followers' routes; a follower whose place did not change has none.
   */
  walk(path: readonly Vec2[], count: number): FollowerRoute[] {
    if (path.length === 0) return [];
    const before = this.positions(count);
    const line = [...[...path].reverse(), ...this.line];
    const routes: FollowerRoute[] = [];
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
