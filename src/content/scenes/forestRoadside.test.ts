import { expect, it } from 'vitest';
import { CONTENT } from '../index';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { buildGrid, posKey, reachable, tileAt } from '../../core/rules/grid';
import type { MoveContext } from '../../core/rules/grid';
import { runCombat, seedFor, STANDARD_PARTY } from '../../core/sim/runCombat';
import type { MapDef, Vec2 } from '../../core/types';
import { ENCOUNTERS } from '../encounters';
import { FOREST_GROUND_ROWS, FOREST_ROAD } from '../maps/combat';
import { connectAct1 } from '../maps/world';
import {
  FOREST_ROADSIDE_PROPS,
  FOREST_ROADSIDE_SCENERY,
  FOREST_ROAD_SCENE,
  FOREST_WATER_CELLS,
} from './forestRoad';

const key = ({ x, y }: Vec2): string => `${x},${y}`;
const CLOSED = FOREST_ROADSIDE_PROPS.map(({ cell }) => cell);
const EXPECTED_CELLS = ['4,2', '2,2', '1,2', '4,3', '2,1', '12,2', '14,2', '14,3', '17,3', '2,10'];

function context(map: MapDef): MoveContext {
  return {
    grid: buildGrid(map),
    blocked: new Set(),
    surfaces: CONTENT.surfaces,
    size: 1,
    climbCost: CONTENT.tuning.climbCost,
  };
}

const encounter = ENCOUNTERS.find((e) => e.id === 'enc_forest_road');
const explore = connectAct1(FOREST_ROAD);
const WEST_MOUTH = [4, 5, 6, 7, 8].map((y) => ({ x: 0, y }));
const EAST_MOUTH = [4, 5, 6, 7, 8].map((y) => ({ x: 19, y }));

it('closes exactly the ten roadside cells, as blocked ground that is neither cover nor a wall of sight', () => {
  expect(CLOSED.map(key)).toEqual(EXPECTED_CELLS);
  expect(FOREST_ROADSIDE_SCENERY).toHaveLength(10);
  const grid = buildGrid(FOREST_ROAD);
  for (const cell of CLOSED) {
    const tile = tileAt(grid, cell);
    expect(tile?.blocked, key(cell)).toBe(true);
    expect(tile?.blocksSight, key(cell)).toBe(false);
    expect(tile?.cover ?? false, key(cell)).toBe(false);
    expect(tile?.surface ?? null, key(cell)).toBeNull();
  }
  // Only those cells differ from the authored ground, and each keeps its tier.
  const ground = buildGrid({ ...FOREST_ROAD, rows: FOREST_GROUND_ROWS });
  const changed: string[] = [];
  for (let y = 0; y < FOREST_ROAD.height; y++)
    for (let x = 0; x < FOREST_ROAD.width; x++) {
      const was = tileAt(ground, { x, y });
      const now = tileAt(grid, { x, y });
      if (was?.blocked !== now?.blocked) {
        changed.push(`${x},${y}`);
        expect(now?.elevation, `${x},${y} tier`).toBe(was?.elevation);
        expect(now?.terrain === 'grass' || now?.terrain === 'stone').toBe(true);
      }
    }
  expect(changed.sort()).toEqual([...EXPECTED_CELLS].sort());
  // The prop art stands on those cells and nowhere else.
  for (const piece of FOREST_ROADSIDE_SCENERY) {
    expect(piece.footprint, piece.id).toHaveLength(1);
    expect(EXPECTED_CELLS, piece.id).toContain(key(piece.footprint[0] as Vec2));
    expect(FOREST_ROAD_SCENE.scenery, piece.id).toContain(piece);
  }
});

it('keeps spawns, enemies, exits, props, water, cover and the NPC clear of the new cells', () => {
  const protectedCells = new Set<string>([
    ...FOREST_ROAD.partySpawns.map(key),
    ...(encounter?.enemies ?? []).map((e) => key(e.pos)),
    ...(encounter?.reinforcements ?? []).map((e) => key(e.pos)),
    ...(encounter?.variants ?? []).flatMap((v) => (v.enemies ?? []).map((e) => key(e.pos))),
    ...FOREST_ROAD.props.map((p) => key(p.pos)),
    ...FOREST_WATER_CELLS.map(key),
    ...WEST_MOUTH.map(key),
    ...EAST_MOUTH.map(key),
    key({ x: 3, y: 1 }),
  ]);
  FOREST_GROUND_ROWS.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === 'r') protectedCells.add(`${x},${y}`);
    }),
  );
  for (const cell of CLOSED) expect(protectedCells.has(key(cell)), key(cell)).toBe(false);
});

it('lets every spawn reach every enemy cell and both exit mouths in combat', () => {
  expect(encounter).toBeDefined();
  const ctx = context(FOREST_ROAD);
  const enemyCells = [
    ...(encounter?.enemies ?? []),
    ...(encounter?.reinforcements ?? []),
    ...(encounter?.variants ?? []).flatMap((v) => v.enemies ?? []),
  ].map((e) => e.pos);
  expect(enemyCells.length).toBeGreaterThan(0);
  for (const spawn of FOREST_ROAD.partySpawns) {
    const reach = reachable(ctx, spawn, 99);
    for (const goal of [...enemyCells, ...WEST_MOUTH, ...EAST_MOUTH])
      expect(reach.has(posKey(goal)), `${key(spawn)} -> ${key(goal)}`).toBe(true);
  }
});

it('still lets a full table win the forest fight', () => {
  let victories = 0;
  for (let trial = 0; trial < 12; trial++) {
    const result = runCombat(CONTENT, {
      seed: seedFor('forest-roadside', trial),
      encounterId: 'enc_forest_road',
      party: STANDARD_PARTY,
    });
    expect(result.anomalies, `trial ${trial}`).toEqual([]);
    expect(result.outcome).not.toBe('stalemate');
    if (result.outcome === 'victory') victories++;
  }
  expect(victories).toBeGreaterThan(4);
});

it("opens the road keeper's conversation from the west entrance without a story trigger first", () => {
  const fresh = createGame(CONTENT, {
    seed: 'forest-roadside-dema',
    party: [{ characterId: 'kaya', level: 1, autoChoose: true }],
    startNode: 'village_explore',
  });
  const village = apply(CONTENT, fresh, { type: 'enterNode', nodeId: 'village_explore' }).state;
  const forest = apply(CONTENT, village, { type: 'enterNode', nodeId: 'forest_explore' }).state;
  const start = { ...forest, location: { ...forest.location, pos: { x: 1, y: 4 } } };
  const entered = (nodeId: string) =>
    apply(CONTENT, start, { type: 'walkTo', pos: { x: 3, y: 1 } }).events.some(
      (e) => e.type === 'storyNodeEntered' && e.nodeId === nodeId,
    );
  expect(entered('forest_dema')).toBe(true);
  expect(entered('road_depart')).toBe(false);
});

it('routes exploration from the west entrance to the east exit, the quarry crossing and Dema', () => {
  const ctx = context(explore);
  const reach = reachable(ctx, { x: 1, y: 4 }, 99);
  const exits = explore.exits ?? [];
  expect(exits.length).toBe(2);
  for (const exit of exits)
    for (const cell of exit.area ?? [exit.pos])
      expect(reach.has(posKey(cell)), `${exit.label} ${key(cell)}`).toBe(true);
  // Both entrances land on open ground that reaches the other side.
  for (const entry of [
    { x: 1, y: 4 },
    { x: 18, y: 4 },
  ]) {
    const from = reachable(ctx, entry, 99);
    for (const cell of [...WEST_MOUTH, ...EAST_MOUTH])
      expect(from.has(posKey(cell)), `${key(entry)} -> ${key(cell)}`).toBe(true);
  }
  for (const trigger of explore.triggers ?? [])
    expect(
      (trigger.area ?? []).some((cell) => reach.has(posKey(cell))),
      trigger.id,
    ).toBe(true);
  // Dema keeps the road from (3,1); someone can stand beside her.
  const dema = { x: 3, y: 1 };
  const beside = [...reach.values()].filter(
    ({ pos }) => Math.max(Math.abs(pos.x - dema.x), Math.abs(pos.y - dema.y)) === 1,
  );
  expect(beside.length).toBeGreaterThan(0);
  for (const npc of explore.npcs.filter((n) => n.pos))
    if (npc.pos) {
      const near = [...reach.values()].some(
        ({ pos }) =>
          Math.max(Math.abs(pos.x - (npc.pos?.x ?? 0)), Math.abs(pos.y - (npc.pos?.y ?? 0))) <= 1,
      );
      expect(near, npc.id).toBe(true);
    }
});
