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
import type { Grid, GameState, MapDef, Tile, Vec2 } from '../types';
import { findSettleTile } from './settle';

const VILLAGE = (() => {
  const map = CONTENT.maps.get('ba_dan_village');
  if (!map) throw new Error('Missing ba_dan_village');
  return map;
})();
const GRID = buildGrid(VILLAGE);

function village(): GameState {
  return createGame(CONTENT, {
    seed: 'settle',
    party: ['kaya', 'bo', 'nilak'].map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
}

const has = (tiles: readonly Vec2[], p: Vec2 | undefined): boolean =>
  tiles.some((tile) => tile.x === p?.x && tile.y === p?.y);

/** Tiles a settle must never return: an NPC, the exit, or a rest spot. */
function forbidden(map: MapDef): readonly Vec2[] {
  const out: Vec2[] = map.npcs.map((npc) => npc.pos);
  if (map.exit) out.push(map.exit.pos);
  for (const spot of map.restSpots ?? []) out.push(spot.pos);
  return out;
}

suite('findSettleTile', () => {
  it('finds a tile one step from an open start', () => {
    const from = { x: 3, y: 7 };
    const result = findSettleTile(CONTENT, VILLAGE, GRID, village(), from);
    expect(result).not.toBeNull();
    expect(result?.path.length).toBeGreaterThan(0);
    expect(result?.path.length).toBe(1);
    expect(has(forbidden(VILLAGE), result?.pos)).toBe(false);
  });

  it('never lands on an NPC, the exit or the rest spot from nearby starts', () => {
    const forbiddenTiles = forbidden(VILLAGE);
    // On Mira's tile, beside the table, beside the gate, and at the spawn.
    const starts: readonly Vec2[] = [
      { x: 11, y: 5 },
      { x: 10, y: 6 },
      { x: 22, y: 7 },
      { x: 3, y: 7 },
    ];
    for (const from of starts) {
      const result = findSettleTile(CONTENT, VILLAGE, GRID, village(), from);
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
});
