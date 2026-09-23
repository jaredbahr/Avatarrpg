/**
 * The leader-resettle search (ADR 0047 §5).
 *
 * `wait`'s refusal (§1) and, in a later work item, `settle()` itself both
 * need the same answer: is there somewhere free to put the leader? This
 * file holds only the search for now; `settle()` is added here later.
 */

import type { ContentIndex, GameEvent, GameState, Grid, MapDef, StepResult, Vec2 } from '../types';
import { DIRECTIONS, buildGrid, inBounds, posKey, samePos, tileAt } from '../rules/grid';
import { activeTriggers, visibleNpcs } from './world';

export interface SettleTile {
  readonly pos: Vec2;
  readonly path: readonly Vec2[];
}

function tileSet(positions: readonly Vec2[]): ReadonlySet<string> {
  const set = new Set<string>();
  for (const p of positions) set.add(posKey(p));
  return set;
}

function exitTiles(map: MapDef): ReadonlySet<string> {
  const positions: Vec2[] = map.exits ? map.exits.map((exit) => exit.pos) : [];
  if (map.exit) positions.push(map.exit.pos);
  return tileSet(positions);
}

/** Every tile another map's exit arrives at on this one (ADR 0047 §3). */
function arrivalTiles(content: ContentIndex, map: MapDef): ReadonlySet<string> {
  const positions: Vec2[] = [];
  for (const candidate of content.maps.values()) {
    for (const exit of candidate.exits ?? []) {
      if (exit.toMapId === map.id) positions.push(exit.toPos);
    }
  }
  return tileSet(positions);
}

function restSpotTiles(map: MapDef): ReadonlySet<string> {
  return tileSet(map.restSpots ? map.restSpots.map((spot) => spot.pos) : []);
}

/**
 * Nearest walkable tile, other than `from`, that is not a visible NPC tile,
 * an exit tile, an arrival tile, an active trigger cell or a rest spot (ADR
 * 0047 §5). Breadth-first; a step never crosses an exit or an active
 * trigger cell, so it can never fire one; a diagonal step may not squeeze
 * between two blocked orthogonal neighbours, matching `findPath`'s rule.
 * Ties break by (path length, y, x). Returns null when no such tile exists.
 */
export function findSettleTile(
  content: ContentIndex,
  map: MapDef,
  grid: Grid,
  state: GameState,
  from: Vec2,
): SettleTile | null {
  const blockedForStepping = new Set<string>([
    ...exitTiles(map),
    ...activeTriggers(map, state).flatMap((trigger) => trigger.area.map(posKey)),
  ]);
  const npcTiles = new Set(visibleNpcs(map, state).map((npc) => posKey(npc.pos)));
  const arrivals = arrivalTiles(content, map);
  const restSpots = restSpotTiles(map);

  const isBlockedForStepping = (p: Vec2): boolean => blockedForStepping.has(posKey(p));
  const isForbiddenLanding = (p: Vec2): boolean =>
    npcTiles.has(posKey(p)) || arrivals.has(posKey(p)) || restSpots.has(posKey(p));

  const visited = new Set<string>([posKey(from)]);
  let frontier: SettleTile[] = [{ pos: from, path: [] }];
  const maxDepth = grid.width * grid.height;

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    const nextFrontier: SettleTile[] = [];
    const candidates: SettleTile[] = [];

    for (const node of frontier) {
      for (const d of DIRECTIONS) {
        const next = { x: node.pos.x + d.x, y: node.pos.y + d.y };
        if (!inBounds(grid, next)) continue;
        const key = posKey(next);
        if (visited.has(key)) continue;

        if (next.x !== node.pos.x && next.y !== node.pos.y) {
          const a = { x: next.x, y: node.pos.y };
          const b = { x: node.pos.x, y: next.y };
          if (isBlockedForStepping(a) || isBlockedForStepping(b)) continue;
        }

        const tile = tileAt(grid, next);
        if (!tile || tile.blocked) continue;
        if (isBlockedForStepping(next)) continue;

        visited.add(key);
        const path = [...node.path, next];
        nextFrontier.push({ pos: next, path });
        if (!isForbiddenLanding(next)) candidates.push({ pos: next, path });
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x);
      const winner = candidates[0];
      if (winner) return winner;
    }
    frontier = nextFrontier;
  }

  return null;
}

/**
 * Wraps every command (ADR 0047 §5, B2). `_before` is unused today —
 * kept because the ADR specifies `settle(content, before, after)`, and a
 * later work item's placement diffing may need it.
 */
export function settle(content: ContentIndex, _before: GameState, after: GameState): StepResult {
  let state = after;
  const events: GameEvent[] = [];

  if (state.world.talk) {
    const stillHolds =
      state.screen === 'dialogue' && state.location.mapId === state.world.talk.mapId;
    if (!stillHolds) {
      state = { ...state, world: { ...state.world, talk: null } };
    }
  }

  if (state.screen === 'explore') {
    const map = content.maps.get(state.location.mapId);
    if (map) {
      const onNpc = visibleNpcs(map, state).some((npc) => samePos(npc.pos, state.location.pos));
      if (onNpc) {
        const grid = buildGrid(map);
        const found = findSettleTile(content, map, grid, state, state.location.pos);
        const leader = state.party[0];
        if (found && leader) {
          const from = state.location.pos;
          state = { ...state, location: { ...state.location, pos: found.pos } };
          events.push({ type: 'partyWalked', unitId: leader.id, from, path: found.path });
        }
        // No free tile: broken content per the ADR's §4 neighbour rule.
        // Leave the leader in place rather than crash; structured
        // diagnostics land with the resolver (W4a).
      }
    }
  }

  return { state, events };
}
