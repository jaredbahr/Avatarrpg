import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../../core/rng';
import {
  buildGrid,
  enterCost,
  findPath,
  hasLineOfSight,
  occupiedCells,
  posKey,
  reachable,
  tileAt,
} from '../../core/rules/grid';
import { BattleDraft } from '../../core/state/battleDraft';
import { createBattle, createGame } from '../../core/state/createGame';
import { deserialize, serialize, stateFromBlob } from '../../core/save/serialize';
import type { GameState, Vec2 } from '../../core/types';
import { QUARRY_FLOOR } from './combat';

const WALL_CELLS: readonly Vec2[] = [
  { x: 8, y: 4 },
  { x: 11, y: 7 },
];

const PARTY_SPAWNS: readonly Vec2[] = [
  { x: 1, y: 3 },
  { x: 3, y: 4 },
  { x: 1, y: 5 },
  { x: 3, y: 6 },
  { x: 1, y: 7 },
  { x: 3, y: 8 },
];

const SIX_PARTY = ['bo', 'sura', 'riko', 'nima', 'kaya', 'nilak'] as const;

const META = {
  label: 'Quarry interior',
  summary: 'Stone stacks and live props',
  savedAt: 1_700_000_000_000,
  session: { players: [{ name: 'Player', unitId: 'p0' }], soloPlay: false },
};

function cellsWith(map: typeof QUARRY_FLOOR, key: string): Vec2[] {
  return map.rows.flatMap((row, y) =>
    [...row].flatMap((cell, x) => (cell === key ? [{ x, y }] : [])),
  );
}

function quarryBattle(flags: Record<string, boolean> = {}, characters = ['sura', 'riko']) {
  const state = createGame(CONTENT, {
    seed: 'quarry-interior',
    party: characters.map((characterId) => ({ characterId, level: 3, autoChoose: true })),
    startNode: '',
    flags,
  });
  const rng = new RngCursor(state.rng);
  const battle = createBattle(CONTENT, state, 'enc_grumbler', rng);
  return { state, battle, rng };
}

function battleDraft(flags: Record<string, boolean> = {}) {
  const { battle, rng } = quarryBattle(flags);
  return new BattleDraft(CONTENT, battle, rng);
}

describe('Driller quarry interior', () => {
  it('keeps the permanent wall cells and live prop placements explicit', () => {
    expect(cellsWith(QUARRY_FLOOR, '#')).toEqual(WALL_CELLS);
    expect(QUARRY_FLOOR.props.map(({ propId, pos }) => ({ propId, pos }))).toEqual([
      { propId: 'rubble_pile', pos: { x: 6, y: 7 } },
      { propId: 'rubble_pile', pos: { x: 13, y: 4 } },
      { propId: 'water_barrel', pos: { x: 12, y: 6 } },
      { propId: 'brazier', pos: { x: 10, y: 3 } },
      { propId: 'cabbage_cart', pos: { x: 9, y: 6 } },
    ]);

    const original = buildGrid(QUARRY_FLOOR);
    for (const cell of WALL_CELLS) {
      expect(tileAt(original, cell)).toMatchObject({ blocked: true, blocksSight: true });
    }
    for (const placement of QUARRY_FLOOR.props) {
      expect(tileAt(original, placement.pos)?.blocked, `${placement.propId} is on a wall`).toBe(
        false,
      );
    }
  });

  it('instantiates the new props without relocating the six authored spawns', () => {
    const { battle } = quarryBattle({}, [...SIX_PARTY]);
    expect(battle.props.map((prop) => prop.propId)).toEqual([
      'rubble_pile',
      'rubble_pile',
      'water_barrel',
      'brazier',
    ]);
    expect(battle.units.filter((unit) => unit.faction === 'party').map((unit) => unit.pos)).toEqual(
      PARTY_SPAWNS,
    );

    for (const unit of battle.units) {
      for (const cell of occupiedCells(unit)) {
        expect(tileAt(battle.grid, cell)?.blocked, `${unit.name} overlaps ${posKey(cell)}`).toBe(
          false,
        );
      }
    }

    const asked = quarryBattle({ pella_asked: true });
    expect(asked.battle.props.map((prop) => prop.propId)).toEqual([
      'rubble_pile',
      'rubble_pile',
      'water_barrel',
      'brazier',
      'cabbage_cart',
    ]);
  });

  it('keeps every spawn, reinforcement and two-cell boss routeable around the stacks', () => {
    const { battle } = quarryBattle({}, [...SIX_PARTY]);
    const context = {
      grid: battle.grid,
      blocked: new Set<string>(),
      surfaces: CONTENT.surfaces,
      size: 1 as const,
    };
    const oneCellReachable = reachable(context, { x: 3, y: 6 }, 99);
    const targets = [
      ...PARTY_SPAWNS,
      { x: 15, y: 5 },
      { x: 16, y: 5 },
      { x: 14, y: 3 },
      { x: 14, y: 8 },
      { x: 13, y: 1 },
      { x: 13, y: 10 },
    ];
    for (const target of targets) {
      expect(oneCellReachable.has(posKey(target)), `unreachable ${posKey(target)}`).toBe(true);
    }

    const boss = battle.units.find((unit) => unit.enemyId === 'grumbler');
    expect(boss?.size).toBe(2);
    if (!boss) return;
    const twoCell = { ...context, size: 2 as const };
    expect(enterCost(twoCell, { x: 7, y: 4 })).toBeNull();
    expect(enterCost(twoCell, { x: 10, y: 7 })).toBeNull();
    expect(findPath(twoCell, boss.pos, { x: 9, y: 5 }, 99)).not.toBeNull();
  });

  it('uses the new stacks for real sight breaks and removes live rubble cleanly', () => {
    const draft = battleDraft();
    expect(hasLineOfSight(draft.grid, { x: 3, y: 4 }, { x: 12, y: 4 })).toBe(false);

    const rubble = draft.props.find(
      (prop) => prop.propId === 'rubble_pile' && prop.pos.x === 13 && prop.pos.y === 4,
    );
    expect(rubble).toBeDefined();
    if (!rubble) return;
    expect(hasLineOfSight(draft.grid, { x: 12, y: 4 }, { x: 15, y: 4 })).toBe(false);
    draft.breakProp(rubble.id);
    expect(draft.propAt(rubble.pos)).toBeUndefined();
    expect(tileAt(draft.grid, rubble.pos)).toMatchObject({ blocked: false, blocksSight: false });
    expect(tileAt(draft.grid, rubble.pos)?.surface?.id).toBe('rubble');
    expect(hasLineOfSight(draft.grid, { x: 12, y: 4 }, { x: 15, y: 4 })).toBe(true);
  });

  it('preserves the authored barrel and brazier reaction choices', () => {
    const draft = battleDraft();
    const barrel = draft.props.find((prop) => prop.propId === 'water_barrel');
    expect(barrel).toBeDefined();
    if (!barrel) return;
    draft.breakProp(barrel.id);
    expect(draft.propAt(barrel.pos)).toBeUndefined();
    expect(tileAt(draft.grid, barrel.pos)?.surface?.id).toBe('water');

    const brazier = draft.props.find((prop) => prop.propId === 'brazier');
    expect(brazier).toBeDefined();
    if (!brazier) return;
    const oil = { x: brazier.pos.x + 1, y: brazier.pos.y };
    expect(tileAt(draft.grid, oil)?.surface?.id).toBe('oil');
    draft.shoveProp(brazier.id, { x: brazier.pos.x - 1, y: brazier.pos.y }, 1, 'push');
    const moved = draft.props.find((prop) => prop.id === brazier.id);
    expect(moved?.pos).toEqual(oil);
    if (!moved) return;
    draft.breakProp(moved.id);
    expect(tileAt(draft.grid, oil)?.surface?.id).toBe('fire');
  });

  it('round-trips the new props and baked wall grid without a save migration', () => {
    const { state, battle, rng } = quarryBattle({ pella_asked: true });
    const midBattle: GameState = {
      ...state,
      screen: 'combat',
      rng: rng.state,
      battle,
    };
    const result = deserialize(serialize(midBattle, META));
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    const loaded = stateFromBlob(result.blob);
    expect(loaded.battle?.props).toEqual(midBattle.battle?.props);
    expect(loaded.battle?.grid).toEqual(midBattle.battle?.grid);
  });
});
