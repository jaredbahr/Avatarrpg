import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { buildGrid, tileAt, withSurface, withTile } from '../rules/grid';
import { RngCursor } from '../rng';
import { createBattle, createGame } from '../state/createGame';
import type { BattleState, ContentIndex, GameState, MapDef } from '../types';
import { reconcileBattle, reconcileBattleResult } from './reconcile';
import { deserialize, serialize, stateFromBlob } from './serialize';

const META = {
  label: 'Slot 1',
  summary: 'Old combat map',
  savedAt: 1_700_000_000_000,
  session: { players: [{ name: 'Lorelai', unitId: 'p0' }], soloPlay: false },
};

const OLD_QUARRY_ROWS = [
  '^^^^######..######^^',
  '^^^^#....#..#....#^^',
  '^^^..........c....^^',
  '.....c....oo.......^',
  '..........oo........',
  '===========oo=======',
  '===========oo=======',
  '..........oo........',
  '.....c....oo.......^',
  '^^^...........c...^^',
  '^^^^#....#..#....#^^',
  '^^^^######..######^^',
] as const;

const OLD_FOREST_ROWS = [
  'TT,,,,,,T,,,,,,,,,TT',
  'T,,,,,,,,,,,,,T,,,,T',
  ',,,,,,,,,,,,,,,,,,,^',
  ',,,,,,,r,,,,,,,,,,^^',
  '====================',
  '=====~~=====,,,,,,^^',
  '====~~~~====,,,,,,,^',
  '=====~~=====,,,,,,,,',
  '====================',
  ',,,,,,,,r,,,,,,,,,,,',
  'T,,,,,,,,,,,,,T,,,,T',
  'TT,,,,,,,,,,,,,,,,TT',
] as const;

function battleState(mapId: 'quarry_gate' | 'forest_road', oldRows: readonly string[]): GameState {
  const seeded = createGame(CONTENT, {
    seed: `reconcile-${mapId}`,
    party: [{ characterId: 'kaya' }, { characterId: 'bo' }],
    startNode: mapId === 'quarry_gate' ? 'battle_quarry_gate' : 'battle_forest_road',
  });
  const encounterId = mapId === 'quarry_gate' ? 'enc_quarry_gate' : 'enc_forest_road';
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, encounterId, rng);
  const currentMap = CONTENT.maps.get(mapId);
  if (!currentMap) throw new Error(`missing ${mapId}`);
  const oldMap: MapDef = { ...currentMap, rows: oldRows };
  let grid = buildGrid(oldMap);
  const props: BattleState['props'][number][] = [];
  for (const prop of battle.props) {
    const tile = tileAt(grid, prop.pos);
    const def = CONTENT.props.get(prop.propId);
    if (!tile || !def) throw new Error(`bad prop fixture ${prop.propId}`);
    props.push({ ...prop, previous: tile });
    grid = withTile(grid, prop.pos, {
      ...tile,
      blocked: tile.blocked || def.blocksMove,
      blocksSight: tile.blocksSight || def.blocksSight,
      cover: tile.cover || def.grantsCover,
    });
  }
  return {
    ...seeded,
    screen: 'combat',
    rng: rng.state,
    battle: { ...battle, grid, props, temporaryWalls: [] },
  };
}

function contentWithMap(map: MapDef): ContentIndex {
  const maps = new Map(CONTENT.maps);
  maps.set(map.id, map);
  return { ...CONTENT, maps };
}

function load(state: GameState): GameState {
  const parsed = deserialize(serialize(state, META));
  if (!parsed.ok) throw new Error(parsed.error);
  return reconcileBattle(CONTENT, stateFromBlob(parsed.blob));
}

describe('reconcileBattle', () => {
  it('reapplies Quarry Gate blockers, snaps a buried unit, and preserves another surface', () => {
    const old = battleState('quarry_gate', OLD_QUARRY_ROWS);
    if (!old.battle) throw new Error('fixture did not create a battle');
    const surfacePos = { x: 5, y: 4 };
    const wallPos = { x: 8, y: 4 };
    const unit = old.battle.units[0];
    if (!unit) throw new Error('fixture did not create a unit');
    const surfaced = withSurface(old.battle.grid, surfacePos, {
      id: 'fire',
      duration: 2,
      spread: 1,
    });
    const wallPrevious = tileAt(surfaced, wallPos);
    if (!wallPrevious) throw new Error('wall fixture is off-grid');
    const state: GameState = {
      ...old,
      battle: {
        ...old.battle,
        grid: withTile(surfaced, wallPos, {
          ...wallPrevious,
          terrain: 'wall',
          blocked: true,
          blocksSight: true,
          cover: false,
          surface: null,
        }),
        temporaryWalls: [{ pos: wallPos, untilRound: 3, previous: wallPrevious }],
        units: old.battle.units.map((candidate) =>
          candidate.id === unit.id ? { ...candidate, pos: { x: 10, y: 0 } } : candidate,
        ),
      },
    };

    const loaded = load(state);
    const gate = tileAt(loaded.battle?.grid ?? old.battle.grid, { x: 10, y: 0 });
    const rock = tileAt(loaded.battle?.grid ?? old.battle.grid, { x: 0, y: 0 });
    expect(gate).toMatchObject({ terrain: 'wood', blocked: true, blocksSight: true });
    expect(rock).toMatchObject({ blocked: true, blocksSight: true });
    expect(loaded.battle?.units.find((candidate) => candidate.id === unit.id)?.pos).toEqual({
      x: 10,
      y: 1,
    });
    expect(tileAt(loaded.battle?.grid ?? old.battle.grid, surfacePos)?.surface).toEqual({
      id: 'fire',
      duration: 2,
      spread: 1,
    });
    expect(tileAt(loaded.battle?.grid ?? old.battle.grid, wallPos)).toMatchObject({
      terrain: 'wall',
      blocked: true,
      blocksSight: true,
    });
    expect(loaded.battle?.props.map((prop) => prop.propId)).toEqual(
      old.battle.props.map((prop) => prop.propId),
    );
  });

  it('leaves a real current Quarry Gate battle byte-for-byte unchanged', () => {
    const seeded = createGame(CONTENT, {
      seed: 'current-quarry-byte-for-byte',
      party: [{ characterId: 'kaya' }, { characterId: 'bo' }],
      startNode: 'battle_quarry_gate',
    });
    const rng = new RngCursor(seeded.rng);
    const current = {
      ...seeded,
      screen: 'combat' as const,
      battle: createBattle(CONTENT, seeded, 'enc_quarry_gate', rng),
    };
    expect(serialize(reconcileBattle(CONTENT, current), META)).toBe(serialize(current, META));
  });

  it('reapplies a Forest Road blocker from the M3 row reshape', () => {
    const old = battleState('forest_road', OLD_FOREST_ROWS);
    const loaded = load(old);
    expect(
      tileAt(loaded.battle?.grid ?? buildGrid(CONTENT.maps.get('forest_road')!), { x: 2, y: 0 }),
    ).toMatchObject({ blocked: true, blocksSight: true });
  });

  it('uses newly authored permanent water on a changed Forest Road cell', () => {
    const old = battleState('forest_road', OLD_FOREST_ROWS);
    const loaded = load(old);
    expect(tileAt(loaded.battle!.grid, { x: 7, y: 5 })?.surface).toEqual({
      id: 'water',
      duration: -1,
      spread: 0,
    });
  });

  it('keeps a live temporary surface when the authored cell changed', () => {
    const old = battleState('forest_road', OLD_FOREST_ROWS);
    if (!old.battle) throw new Error('missing battle');
    const pos = { x: 7, y: 5 };
    const state = {
      ...old,
      battle: {
        ...old.battle,
        grid: withSurface(old.battle.grid, pos, { id: 'fire' as const, duration: 2, spread: 1 }),
      },
    };
    expect(tileAt(reconcileBattle(CONTENT, state).battle!.grid, pos)?.surface).toEqual({
      id: 'fire',
      duration: 2,
      spread: 1,
    });
  });

  it('keeps a non-blocking flask when a blocking saved prop shares its cell', () => {
    const old = battleState('quarry_gate', OLD_QUARRY_ROWS);
    if (!old.battle) throw new Error('missing battle');
    const flask = old.battle.props.find((prop) => prop.propId === 'oil_flask');
    const brazier = old.battle.props.find((prop) => prop.propId === 'brazier');
    if (!flask || !brazier) throw new Error('missing real props');
    const pos = flask.pos;
    const props = [{ ...brazier, pos }, flask];
    const state = { ...old, battle: { ...old.battle, props } };
    const reconciled = reconcileBattle(CONTENT, state);
    expect(reconciled.battle?.props.map((prop) => prop.propId)).toEqual(['brazier', 'oil_flask']);
    expect(reconciled.battle?.props[1]?.previous.blocked).toBe(true);
  });

  it('snaps a size-2 unit from far off-grid and leaves every other unit in place', () => {
    const old = battleState('quarry_gate', OLD_QUARRY_ROWS);
    if (!old.battle) throw new Error('missing battle');
    const target = old.battle.units[0];
    if (!target) throw new Error('missing unit');
    const others = old.battle.units.slice(1).map((unit) => ({ id: unit.id, pos: unit.pos }));
    const state = {
      ...old,
      battle: {
        ...old.battle,
        units: old.battle.units.map((unit) =>
          unit.id === target.id ? { ...unit, size: 2 as const, pos: { x: 1000, y: 1000 } } : unit,
        ),
      },
    };
    const reconciled = reconcileBattle(CONTENT, state);
    const moved = reconciled.battle!.units.find((unit) => unit.id === target.id)!;
    expect(moved.pos).not.toEqual({ x: 1000, y: 1000 });
    expect(moved.pos.x).toBeLessThan(reconciled.battle!.grid.width - 1);
    expect(
      reconciled.battle!.units.slice(1).map((unit) => ({ id: unit.id, pos: unit.pos })),
    ).toEqual(others);
  });

  it('is idempotent across two reconciliation passes', () => {
    const old = battleState('quarry_gate', OLD_QUARRY_ROWS);
    const once = reconcileBattle(CONTENT, old);
    expect(reconcileBattle(CONTENT, once)).toEqual(once);
  });

  it('reports a missing battle map without changing the save', () => {
    const old = battleState('quarry_gate', OLD_QUARRY_ROWS);
    const state = { ...old, battle: { ...old.battle!, mapId: 'removed-map' } };
    expect(reconcileBattleResult(CONTENT, state)).toEqual({
      state,
      warnings: [{ kind: 'missing-map', mapId: 'removed-map' }],
    });
  });

  it('keeps the old battle grid and reports when no unit origin is free', () => {
    const old = battleState('quarry_gate', OLD_QUARRY_ROWS);
    const current = CONTENT.maps.get('quarry_gate')!;
    const rows = current.rows.map(() => '####################');
    const content = contentWithMap({ ...current, rows });
    const result = reconcileBattleResult(content, old);
    expect(result.state).toBe(old);
    expect(result.state.battle?.grid).toBe(old.battle?.grid);
    expect(result.warnings).toContainEqual({
      kind: 'no-free-cell',
      unitId: old.battle?.units.find((unit) => unit.hp > 0)?.id,
    });
  });

  it('reports an isolated geometric snap candidate and uses the main component', () => {
    const old = battleState('quarry_gate', OLD_QUARRY_ROWS);
    if (!old.battle) throw new Error('missing battle');
    const unit = old.battle.units[0]!;
    const current = CONTENT.maps.get('quarry_gate')!;
    const rows = current.rows.map((_, y) => {
      if (y === 0) return '##################.#';
      if (y === 3) return '#.##################';
      return '####################';
    });
    const content = contentWithMap({ ...current, rows, partySpawns: [current.partySpawns[0]!] });
    const state = {
      ...old,
      battle: {
        ...old.battle,
        units: [{ ...unit, pos: { x: 19, y: 0 } }],
      },
    };
    const result = reconcileBattleResult(content, state);
    expect(result.warnings.some((warning) => warning.kind === 'disconnected-snap')).toBe(true);
    expect(result.state.battle?.units[0]?.pos).toEqual(current.partySpawns[0]);
  });
});
