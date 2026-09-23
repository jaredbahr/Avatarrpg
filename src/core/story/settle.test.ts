/**
 * The leader-resettle search (ADR 0047 §5).
 *
 * `findSettleTile` answers one question — where can the leader stand? — so
 * the tests pin the two rules that make it safe: it never lands on an NPC,
 * exit, arrival tile or rest spot, and it is deterministic.
 */

import { describe as suite, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { DEFAULT_TILE, buildGrid, posKey } from '../rules/grid';
import { createGame } from '../state/createGame';
import { activeTriggers, visibleNpcs } from './world';
import type { Grid, GameState, MapDef, Tile, Vec2 } from '../types';
import { findSettleTile } from './settle';

const VILLAGE = (() => {
  const map = CONTENT.maps.get('ba_dan_village');
  if (!map) throw new Error('Missing ba_dan_village');
  return map;
})();
const GRID = buildGrid(VILLAGE);

const FOREST_ROAD = (() => {
  const map = CONTENT.maps.get('forest_road');
  if (!map) throw new Error('Missing forest_road');
  return map;
})();
const FOREST_GRID = buildGrid(FOREST_ROAD);

function village(): GameState {
  return createGame(CONTENT, {
    seed: 'settle',
    party: ['kaya', 'bo', 'nilak'].map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
}

const has = (tiles: readonly Vec2[], p: Vec2 | undefined): boolean =>
  tiles.some((tile) => tile.x === p?.x && tile.y === p?.y);

/** Every tile another map's exit arrives at on this one (mirrors settle.ts's private arrivalTiles). */
function arrivals(map: MapDef): readonly Vec2[] {
  const out: Vec2[] = [];
  for (const candidate of CONTENT.maps.values()) {
    for (const exit of candidate.exits ?? []) {
      if (exit.toMapId === map.id) out.push(exit.toPos);
    }
  }
  return out;
}

/** Exit (single or array form) and active-trigger cells: never crossed, matching `blockedForStepping`. */
function steppingForbidden(map: MapDef, state: GameState): readonly Vec2[] {
  const out: Vec2[] = map.exit ? [map.exit.pos] : [];
  for (const exit of map.exits ?? []) out.push(exit.pos);
  for (const trigger of activeTriggers(map, state)) out.push(...trigger.area);
  return out;
}

/**
 * Tiles a settle must never *land on*: an NPC, an exit, a rest spot, an
 * arrival tile another map's exit lands on, or a cell an active trigger
 * occupies. A path may still cross an NPC/arrival/rest-spot tile on the way
 * to somewhere else — only `steppingForbidden` may never be crossed either.
 */
function forbidden(map: MapDef, state: GameState): readonly Vec2[] {
  // Visible NPCs where they stand now (a bound NpcDef at its resident's anchor).
  const out: Vec2[] = [
    ...visibleNpcs(CONTENT, map, state).map((npc) => npc.pos),
    ...steppingForbidden(map, state),
  ];
  for (const spot of map.restSpots ?? []) out.push(spot.pos);
  out.push(...arrivals(map));
  return out;
}

suite('findSettleTile', () => {
  it('finds a tile one step from an open start', () => {
    const from = { x: 3, y: 7 };
    const state = village();
    const result = findSettleTile(CONTENT, VILLAGE, GRID, state, from);
    expect(result).not.toBeNull();
    expect(result?.path.length).toBeGreaterThan(0);
    expect(result?.path.length).toBe(1);
    expect(has(forbidden(VILLAGE, state), result?.pos)).toBe(false);
  });

  it('never lands on an NPC, an exit, a rest spot or an arrival tile from nearby starts', () => {
    const state = village();
    const forbiddenTiles = forbidden(VILLAGE, state);
    // Real arrival tiles land here too (forest_road and riverside both
    // route back into the village), so this exercises more than npc/exit.
    expect(arrivals(VILLAGE).length).toBeGreaterThan(0);
    // On Mira's tile, beside the table, beside the gate, and at the spawn.
    const starts: readonly Vec2[] = [
      { x: 11, y: 5 },
      { x: 10, y: 6 },
      { x: 22, y: 7 },
      { x: 3, y: 7 },
    ];
    for (const from of starts) {
      const result = findSettleTile(CONTENT, VILLAGE, GRID, state, from);
      expect(result, `start ${posKey(from)}`).not.toBeNull();
      expect(has(forbiddenTiles, result?.pos), `start ${posKey(from)}`).toBe(false);
    }
  });

  it('is deterministic: the same inputs give the same tile and path', () => {
    const from = { x: 10, y: 6 };
    const first = findSettleTile(CONTENT, VILLAGE, GRID, village(), from);
    const second = findSettleTile(CONTENT, VILLAGE, GRID, village(), from);
    expect(first).toEqual(second);
  });

  it('never cuts a corner between two blocked tiles, matching findPath', () => {
    // # S #
    // . # .
    // . . .
    //
    // From S, every orthogonal neighbour is blocked (left, right, down),
    // and both diagonal neighbours — (0,1) and (2,1) — are open tiles
    // squeezed between two blocked corners. `findPath`'s `diagonalAllowed`
    // (grid.ts) refuses that squeeze; `findSettleTile` must too, so
    // nothing here is reachable at all.
    const layout = ['#S#', '.#.', '...'];
    const tiles: Tile[] = layout
      .join('')
      .split('')
      .map((ch) => ({ ...DEFAULT_TILE, blocked: ch === '#' }));
    const grid: Grid = { width: 3, height: 3, tiles };
    const map: MapDef = {
      id: 'settle_corner_test',
      name: 'Settle corner test',
      kind: 'explore',
      width: 3,
      height: 3,
      rows: layout,
      legend: {},
      partySpawns: [],
      npcs: [],
      props: [],
      ambience: '',
    };
    const result = findSettleTile(CONTENT, map, grid, village(), { x: 1, y: 0 });
    expect(result).toBeNull();
  });

  it('never lands on or crosses an active trigger cell or the exit, on a map with real triggers', () => {
    // forest_road's two full-height triggers (road_depart at x=4, the
    // roadblock battle at x=8) are both active on a fresh state, and its
    // west exit sits at (0,4). None of that terrain is otherwise blocked -
    // only the trigger/exit status keeps it out of bounds for a settle.
    const state = village();
    const landingForbidden = forbidden(FOREST_ROAD, state);
    const crossingForbidden = steppingForbidden(FOREST_ROAD, state);
    expect(crossingForbidden.length).toBeGreaterThan(0);

    const from = { x: 2, y: 6 };
    const result = findSettleTile(CONTENT, FOREST_ROAD, FOREST_GRID, state, from);
    expect(result).not.toBeNull();
    expect(has(landingForbidden, result?.pos)).toBe(false);
    for (const step of result!.path) {
      expect(has(crossingForbidden, step), `path crosses ${posKey(step)}`).toBe(false);
    }
  });
});
