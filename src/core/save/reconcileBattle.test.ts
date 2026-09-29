import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { buildGrid, tileAt, withSurface } from '../rules/grid';
import { RngCursor } from '../rng';
import { createBattle, createGame } from '../state/createGame';
import type { GameState, MapDef } from '../types';
import { reconcileBattle } from './reconcile';
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
  const oldMap: MapDef = { ...currentMap, rows: oldRows, props: [] };
  return {
    ...seeded,
    screen: 'combat',
    rng: rng.state,
    battle: { ...battle, grid: buildGrid(oldMap), props: [], temporaryWalls: [] },
  };
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
    const unit = old.battle.units[0];
    if (!unit) throw new Error('fixture did not create a unit');
    const state: GameState = {
      ...old,
      battle: {
        ...old.battle,
        grid: withSurface(old.battle.grid, surfacePos, { id: 'fire', duration: 2, spread: 1 }),
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
  });

  it('leaves a save made from the current rows byte-for-byte unchanged', () => {
    const current = battleState('quarry_gate', CONTENT.maps.get('quarry_gate')?.rows ?? []);
    expect(serialize(reconcileBattle(CONTENT, current), META)).toBe(serialize(current, META));
  });

  it('reapplies a Forest Road blocker from the M3 row reshape', () => {
    const old = battleState('forest_road', OLD_FOREST_ROWS);
    const loaded = load(old);
    expect(
      tileAt(loaded.battle?.grid ?? buildGrid(CONTENT.maps.get('forest_road')!), { x: 2, y: 0 }),
    ).toMatchObject({ blocked: true, blocksSight: true });
  });
});
