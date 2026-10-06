import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { buildGrid, enterCost, reachable, tileAt, withSurface, withTile } from '../rules/grid';
import { isAlive } from '../rules/stats';
import { activeUnit } from '../rules/turnOrder';
import { RngCursor } from '../rng';
import { createBattle, createGame } from '../state/createGame';
import type { BattleState, ContentIndex, GameState, Grid, MapDef } from '../types';
import { reconcileBattle, reconcileBattleResult, type ReconcileBattleOptions } from './reconcile';
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

/** The Driller floor as it shipped before M6 (plan 1.6). */
const OLD_DRILLER_ROWS = [
  'AAA^^..........^^AAA',
  'AA^^....r..r....^^AA',
  '^^.....oo..oo.....^^',
  '.......oo..oo.......',
  '..r.....#...........',
  '..........mm........',
  '..........mm........',
  '..r........#........',
  '.......oo..oo.......',
  '^^.....oo..oo.....^^',
  'AA^^....r..r....^^AA',
  'AAA^^..........^^AAA',
] as const;

/** The Cutting as it shipped before M5 (plan 1.5, Option A). */
const OLD_CUTTING_ROWS = [
  'AAAAAAA^^^^^^^AAAAAA',
  'AA^^^,,,,,,,,,,^^^AA',
  '^^,,,,,,r,,,,,,,,^^A',
  ',,,,,,,,,,,,r,,,,,^^',
  '====================',
  '=====,,~~~~,,,,,====',
  '=====,,~~~~,,,,,====',
  '====================',
  ',,,,,,r,,,,,,,,,,,^^',
  '^^,,,,,,,,,,r,,,,^^A',
  'AA^^^,,,,,,,,,,^^^AA',
  'AAAAAAA^^^^^^^AAAAAA',
] as const;

const FIXTURES = {
  quarry_gate: { startNode: 'battle_quarry_gate', encounterId: 'enc_quarry_gate' },
  forest_road: { startNode: 'battle_forest_road', encounterId: 'enc_forest_road' },
  quarry_floor: { startNode: '', encounterId: 'enc_grumbler' },
  ambush_road: { startNode: '', encounterId: 'enc_ambush' },
} as const;

function battleState(mapId: keyof typeof FIXTURES, oldRows: readonly string[]): GameState {
  const seeded = createGame(CONTENT, {
    seed: `reconcile-${mapId}`,
    party: [{ characterId: 'kaya' }, { characterId: 'bo' }],
    startNode: FIXTURES[mapId].startNode,
  });
  const encounterId = FIXTURES[mapId].encounterId;
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

/** A battle against the authored map, so its saved static grid already matches. */
function currentBattleState(mapId: keyof typeof FIXTURES): GameState {
  const map = CONTENT.maps.get(mapId);
  if (!map) throw new Error(`missing ${mapId}`);
  return battleState(mapId, map.rows);
}

function load(state: GameState, options: ReconcileBattleOptions = {}): GameState {
  const parsed = deserialize(serialize(state, META));
  if (!parsed.ok) throw new Error(parsed.error);
  return reconcileBattle(CONTENT, stateFromBlob(parsed.blob), options);
}

/** The same real load path, but reconciled against injected content. */
function loadWith(content: ContentIndex, state: GameState): GameState {
  const parsed = deserialize(serialize(state, META));
  if (!parsed.ok) throw new Error(parsed.error);
  return reconcileBattle(content, stateFromBlob(parsed.blob));
}

/**
 * Two-wide corridor used to distinguish terrain connectivity from contact
 * reachability. The first party unit is buried at the east edge, while the
 * second unit blocks the lower lane at x=6. The no-opponent variant leaves that
 * blocker in the boss's enemy faction and kills the buried unit, so no contact target
 * exists while the boss still has to search every usable square.
 */
function corridorFixture(noOpponent = false) {
  const old = currentBattleState('quarry_floor');
  if (!old.battle) throw new Error('missing battle');
  const map = CONTENT.maps.get('quarry_floor');
  if (!map) throw new Error('missing map');
  const rows = Array.from({ length: map.height }, (_, y) =>
    y === 2 || y === 3 ? '#..................#' : '#'.repeat(map.width),
  );
  const corridor = { ...map, rows, partySpawns: [{ x: 18, y: 2 }], props: [] };
  const party = old.battle.units.filter((unit) => unit.faction === 'party');
  const boss = old.battle.units.find((unit) => unit.size === 2);
  if (!boss || party.length < 2) throw new Error('fixture is missing units');
  const state: GameState = {
    ...old,
    battle: {
      ...old.battle,
      grid: buildGrid(corridor),
      props: [],
      temporaryWalls: [],
      units: [
        {
          ...party[0]!,
          hp: noOpponent ? 0 : party[0]!.hp,
          pos: { x: 100, y: 2 },
        },
        {
          ...party[1]!,
          faction: 'enemy',
          pos: { x: 6, y: 3 },
        },
        { ...boss, pos: { x: 1, y: 1 } },
      ],
    },
  };
  return { content: contentWithMap(corridor), state, bossId: boss.id };
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

  it('reconciles a pre-M6 mid-battle Driller save onto the approved floor', () => {
    const old = battleState('quarry_floor', OLD_DRILLER_ROWS);
    if (!old.battle) throw new Error('fixture did not create a battle');
    const boss = old.battle.units.find((unit) => unit.size === 2);
    const party = old.battle.units.find((unit) => unit.faction === 'party');
    if (!boss || !party) throw new Error('fixture is missing the Grumbler or a party unit');
    // Live fire on a floor cell M6 left alone, and on one it raised to the bench.
    const fire = { id: 'fire' as const, duration: 2, spread: 1 };
    const floorFire = { x: 5, y: 3 };
    const benchFire = { x: 5, y: 1 };
    const state: GameState = {
      ...old,
      battle: {
        ...old.battle,
        grid: withSurface(withSurface(old.battle.grid, floorFire, fire), benchFire, fire),
        units: old.battle.units.map((unit) =>
          // The boss's second cell stands where the drill shaft is now, and the
          // party unit stands in the old rear gap, now the terrace wall.
          unit.id === boss.id
            ? { ...unit, hp: 37, sprite: 'unit.enemy.grumbler', pos: { x: 17, y: 5 } }
            : unit.id === party.id
              ? { ...unit, pos: { x: 10, y: 0 } }
              : unit,
        ),
      },
    };

    const loaded = load(state);
    const grid = loaded.battle?.grid;
    if (!grid) throw new Error('the reconciled save lost its battle');
    expect(tileAt(grid, { x: 10, y: 0 })).toMatchObject({ blocked: true, blocksSight: true });
    expect(tileAt(grid, { x: 0, y: 1 })).toMatchObject({ blocked: true, elevation: 2 });
    expect(tileAt(grid, { x: 18, y: 5 })).toMatchObject({
      terrain: 'pit',
      blocked: true,
      blocksSight: false,
    });
    expect(tileAt(grid, { x: 5, y: 1 })).toMatchObject({ elevation: 1, surface: fire });
    expect(tileAt(grid, { x: 5, y: 3 })?.surface).toEqual(fire);
    // The heap lifted onto the bench keeps its authored, permanent rubble.
    expect(tileAt(grid, { x: 8, y: 1 })).toMatchObject({
      elevation: 1,
      surface: { id: 'rubble', duration: -1 },
    });

    // The Grumbler snaps whole: the nearest origin whose two cells are free
    // floor, clear of the shaft; the party unit off the wall onto the bench.
    const snappedBoss = loaded.battle?.units.find((unit) => unit.id === boss.id);
    expect(snappedBoss?.pos).toEqual({ x: 16, y: 4 });
    expect(snappedBoss?.sprite).toBe('unit.enemy.driller');
    expect(snappedBoss?.hp).toBe(37);
    for (const cell of [
      { x: 16, y: 4 },
      { x: 17, y: 4 },
    ])
      expect(tileAt(grid, cell)).toMatchObject({ blocked: false, elevation: 0 });
    expect(loaded.battle?.units.find((unit) => unit.id === party.id)?.pos).toEqual({
      x: 9,
      y: 1,
    });
    // Every other unit was already on open ground and has not moved.
    for (const unit of state.battle!.units)
      if (unit.id !== boss.id && unit.id !== party.id)
        expect(loaded.battle?.units.find((candidate) => candidate.id === unit.id)?.pos).toEqual(
          unit.pos,
        );
    expect(reconcileBattle(CONTENT, loaded)).toEqual(loaded);
  });

  it('leaves a real current Driller battle byte-for-byte unchanged', () => {
    const seeded = createGame(CONTENT, {
      seed: 'current-driller-byte-for-byte',
      party: [{ characterId: 'kaya' }, { characterId: 'bo' }],
      startNode: '',
    });
    const rng = new RngCursor(seeded.rng);
    const current = {
      ...seeded,
      screen: 'combat' as const,
      battle: createBattle(CONTENT, seeded, 'enc_grumbler', rng),
    };
    expect(serialize(reconcileBattle(CONTENT, current), META)).toBe(serialize(current, META));
  });

  it('refreshes a legacy boss sprite without changing saved health or position', () => {
    const old = currentBattleState('quarry_floor');
    if (!old.battle) throw new Error('fixture did not create a battle');
    const boss = old.battle.units.find((unit) => unit.enemyId === 'grumbler');
    if (!boss) throw new Error('fixture is missing the boss');
    const state: GameState = {
      ...old,
      battle: {
        ...old.battle,
        units: old.battle.units.map((unit) =>
          unit.id === boss.id ? { ...unit, hp: 37, sprite: 'unit.enemy.grumbler' } : unit,
        ),
      },
    };

    const loaded = load(state);
    expect(loaded.battle?.units.find((unit) => unit.id === boss.id)).toMatchObject({
      sprite: 'unit.enemy.driller',
      hp: 37,
      pos: boss.pos,
    });
  });

  it('snaps a Grumbler whose 2x2 is buried only once square footprints are on', () => {
    const old = battleState('quarry_floor', OLD_DRILLER_ROWS);
    if (!old.battle) throw new Error('fixture did not create a battle');
    const boss = old.battle.units.find((unit) => unit.size === 2);
    if (!boss) throw new Error('fixture is missing the Grumbler');
    /*
     * A legacy 2x1 stands happily on (7,3)-(8,3) in the rebuilt floor, but the
     * 2x2's lower row walks into the drill-shaft wall at (8,4). Off, the save
     * is untouched; on, the boss snaps to the nearest whole square that is free
     * and still inside the floor the party can reach.
     */
    const state: GameState = {
      ...old,
      battle: {
        ...old.battle,
        units: old.battle.units.map((unit) =>
          unit.id === boss.id ? { ...unit, pos: { x: 7, y: 3 } } : unit,
        ),
      },
    };

    const legacy = load(state, { squareFootprints: false });
    expect(legacy.battle?.units.find((unit) => unit.id === boss.id)?.pos).toEqual({ x: 7, y: 3 });

    const square = load(state, { squareFootprints: true });
    const moved = square.battle?.units.find((unit) => unit.id === boss.id)?.pos;
    // The search expands in row-major rings. Its first legal flat 2x2 is
    // (6,2)-(7,3); candidates nearer the shaft intersect walls or split tiers.
    expect(moved).toEqual({ x: 6, y: 2 });
    for (const cell of [
      { x: 6, y: 2 },
      { x: 7, y: 2 },
      { x: 6, y: 3 },
      { x: 7, y: 3 },
    ]) {
      expect(tileAt(square.battle!.grid, cell), `${cell.x},${cell.y}`).toMatchObject({
        blocked: false,
      });
    }
    const elevations = [
      { x: 6, y: 2 },
      { x: 7, y: 2 },
      { x: 6, y: 3 },
      { x: 7, y: 3 },
    ].map((cell) => tileAt(square.battle!.grid, cell)?.elevation);
    expect(new Set(elevations).size).toBe(1);
  });

  it('keeps the earlier unit and snaps a later overlapping unit to a free square cell', () => {
    const current = currentBattleState('quarry_floor');
    const battle = current.battle;
    if (!battle) throw new Error('fixture did not create a battle');
    const boss = battle.units.find((unit) => unit.size === 2);
    const anchor = battle.units.find((unit) => unit.size !== 2);
    if (!boss || !anchor) throw new Error('fixture is missing a boss or anchor unit');
    const state: GameState = {
      ...current,
      battle: {
        ...battle,
        units: [
          { ...anchor, pos: { x: 6, y: 3 } },
          { ...boss, pos: { x: 6, y: 2 } },
          ...battle.units.filter((unit) => unit.id !== anchor.id && unit.id !== boss.id),
        ],
      },
    };

    const square = load(state, { squareFootprints: true });
    const units = square.battle?.units;
    if (!units) throw new Error('the reconciled save lost its battle');
    expect(units[0]?.pos).toEqual({ x: 6, y: 3 });
    expect(units[1]?.pos).not.toEqual({ x: 6, y: 2 });

    const claims = new Set<string>();
    for (const unit of units.filter((candidate) => candidate.hp > 0)) {
      const cells = Array.from({ length: unit.size === 2 ? 4 : 1 }, (_, index) => ({
        x: unit.pos.x + (unit.size === 2 && index % 2 ? 1 : 0),
        y: unit.pos.y + (unit.size === 2 && index > 1 ? 1 : 0),
      }));
      for (const cell of cells) {
        const key = `${cell.x},${cell.y}`;
        expect(claims.has(key), `overlap at ${key}`).toBe(false);
        claims.add(key);
      }
    }
  });

  it('snaps a legacy anchor the map edit never buried once square footprints are on', () => {
    const current = currentBattleState('quarry_floor');
    const battle = current.battle;
    if (!battle) throw new Error('fixture did not create a battle');
    const boss = battle.units.find((unit) => unit.size === 2);
    if (!boss) throw new Error('fixture is missing the Grumbler');
    /*
     * The authored floor is untouched, so the saved static grid already matches
     * and the terrain pass has nothing to do. But (18,3) only works as a legacy
     * 2x1: the square's lower row steps into the drill-shaft pits at (18,4) and
     * (19,4). Under the A-6 flip that anchor is off-map, so the load has to snap
     * it onto the nearest whole square instead of returning the save verbatim.
     */
    const state: GameState = {
      ...current,
      battle: {
        ...battle,
        units: battle.units.map((unit) =>
          unit.id === boss.id ? { ...unit, pos: { x: 18, y: 3 } } : unit,
        ),
      },
    };

    // Gate off the early return stands: the same state comes back untouched, so
    // the legacy anchor is left exactly where the save put it.
    const legacy = reconcileBattleResult(CONTENT, state, { squareFootprints: false });
    expect(legacy.state).toBe(state);
    expect(legacy.warnings).toEqual([]);

    // Flag on, the unchanged map still gets the square pass, and the load path
    // snaps an anchor that is off-map as a 2x2.
    const square = load(state, { squareFootprints: true });
    const moved = square.battle?.units.find((unit) => unit.id === boss.id)?.pos;
    // The nearest flat 2x2 that clears the pit column: (16,1) is nearer in
    // row-major order but straddles the terrace (tiers 1 and 2), so it is skipped.
    expect(moved).toEqual({ x: 16, y: 3 });
    for (const cell of [
      { x: 16, y: 3 },
      { x: 17, y: 3 },
      { x: 16, y: 4 },
      { x: 17, y: 4 },
    ]) {
      expect(tileAt(square.battle!.grid, cell), `${cell.x},${cell.y}`).toMatchObject({
        blocked: false,
        elevation: 0,
      });
    }
    // Snapping is confined to the boss; every other unit keeps its saved cell.
    for (const unit of battle.units) {
      if (unit.id === boss.id) continue;
      expect(square.battle?.units.find((candidate) => candidate.id === unit.id)?.pos).toEqual(
        unit.pos,
      );
    }
  });

  it('reconciles a pre-M5 mid-battle Cutting save onto the cut', () => {
    const old = battleState('ambush_road', OLD_CUTTING_ROWS);
    if (!old.battle) throw new Error('fixture did not create a battle');
    const party = old.battle.units.find((unit) => unit.faction === 'party');
    const enemy = old.battle.units.find((unit) => unit.faction === 'enemy');
    if (!party || !enemy) throw new Error('fixture is missing a party unit or an enemy');
    // Live fire on a bay cell M5 left alone, and on one it closed down to rock.
    const fire = { id: 'fire' as const, duration: 2, spread: 1 };
    const bayFire = { x: 7, y: 2 };
    const rockFire = { x: 10, y: 1 };
    const state: GameState = {
      ...old,
      battle: {
        ...old.battle,
        grid: withSurface(withSurface(old.battle.grid, bayFire, fire), rockFire, fire),
        units: old.battle.units.map((unit) =>
          // The party unit stands in the old open middle, now the pinch's rock;
          // the enemy on an old tier-2 slab in the east corner, now cut rock.
          unit.id === party.id
            ? { ...unit, pos: { x: 10, y: 2 } }
            : unit.id === enemy.id
              ? { ...unit, pos: { x: 19, y: 0 } }
              : unit,
        ),
      },
    };

    const loaded = load(state);
    const grid = loaded.battle?.grid;
    if (!grid) throw new Error('the reconciled save lost its battle');
    // The cut is rock wherever M5 closed it, and walkable tier-2 is gone.
    for (const pos of [
      { x: 10, y: 2 },
      { x: 19, y: 0 },
      { x: 10, y: 1 },
      { x: 9, y: 8 },
    ])
      expect(tileAt(grid, pos), `${pos.x},${pos.y}`).toMatchObject({
        blocked: true,
        blocksSight: true,
        elevation: 2,
        surface: null,
      });
    expect(grid.tiles.some((tile) => !tile.blocked && tile.elevation === 2)).toBe(false);
    // The tier-1 ledges the crossbow and the party face each other from.
    expect(tileAt(grid, { x: 16, y: 3 })).toMatchObject({ blocked: false, elevation: 1 });
    expect(tileAt(grid, { x: 17, y: 9 })).toMatchObject({ blocked: false, elevation: 1 });
    // The pool moved one tile west: its authored water follows the new rows,
    // and the old east column is dry road.
    for (const y of [5, 6]) {
      expect(tileAt(grid, { x: 6, y })?.surface).toEqual({ id: 'water', duration: -1, spread: 0 });
      expect(tileAt(grid, { x: 10, y })?.surface).toBeNull();
    }
    expect(tileAt(grid, bayFire)?.surface).toEqual(fire);
    // Authored rubble on the moved heaps, and none left on the old anchors.
    expect(tileAt(grid, { x: 13, y: 3 })?.surface).toMatchObject({ id: 'rubble', duration: -1 });
    expect(tileAt(grid, { x: 12, y: 3 })?.surface).toBeNull();

    const snappedParty = loaded.battle?.units.find((unit) => unit.id === party.id)?.pos;
    const snappedEnemy = loaded.battle?.units.find((unit) => unit.id === enemy.id)?.pos;
    // The party unit to the nearest open cell east of the pinch (row-major
    // ahead of the road at (10,4)); the enemy down off the rock onto the NE
    // ledge, still above the road.
    expect({ snappedParty, snappedEnemy }).toEqual({
      snappedParty: { x: 11, y: 3 },
      snappedEnemy: { x: 17, y: 2 },
    });
    for (const pos of [snappedParty, snappedEnemy])
      expect(pos && tileAt(grid, pos)?.blocked).toBe(false);
    // Every other unit was already on open ground and has not moved.
    for (const unit of state.battle!.units)
      if (unit.id !== party.id && unit.id !== enemy.id)
        expect(loaded.battle?.units.find((candidate) => candidate.id === unit.id)?.pos).toEqual(
          unit.pos,
        );
    expect(reconcileBattle(CONTENT, loaded)).toEqual(loaded);
  });

  it('leaves a real current Cutting battle byte-for-byte unchanged', () => {
    const seeded = createGame(CONTENT, {
      seed: 'current-cutting-byte-for-byte',
      party: [{ characterId: 'kaya' }, { characterId: 'bo' }],
      startNode: '',
    });
    const rng = new RngCursor(seeded.rng);
    const current = {
      ...seeded,
      screen: 'combat' as const,
      battle: createBattle(CONTENT, seeded, 'enc_ambush', rng),
    };
    expect(serialize(reconcileBattle(CONTENT, current), META)).toBe(serialize(current, META));
  });

  it('keeps a burning prop alight through a load-time rebuild', () => {
    const old = battleState('quarry_gate', OLD_QUARRY_ROWS);
    if (!old.battle) throw new Error('fixture did not create a battle');
    const burning = old.battle.props.map((prop, index) => ({ ...prop, burning: index + 1 }));
    const state: GameState = { ...old, battle: { ...old.battle, props: burning } };

    const loaded = load(state);
    if (!loaded.battle) throw new Error('load dropped the battle');
    // The fixture's map edit forces the rebuild path, which re-creates every
    // prop instance from its saved self — the fire has to come with it.
    expect(loaded.battle.props.length).toBe(burning.length);
    for (const prop of loaded.battle.props) {
      const source = burning.find((candidate) => candidate.id === prop.id);
      expect(source, `prop ${prop.id} vanished across the rebuild`).toBeDefined();
      expect(prop.burning, `prop ${prop.id} lost its fire`).toBe(source?.burning);
    }
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

  it('moves the shipped enc_grumbler turn-1 boss onto open terrain', () => {
    const current = currentBattleState('quarry_floor');
    if (!current.battle) throw new Error('missing battle');
    const boss = current.battle.units.find((unit) => unit.size === 2);
    const party = current.battle.units.filter((unit) => unit.faction === 'party');
    if (!boss || party.length < 2) throw new Error('fixture is missing the boss or party');
    const state: GameState = {
      ...current,
      battle: {
        ...current.battle,
        units: current.battle.units.map((unit) => {
          if (unit.id === boss.id) return { ...unit, pos: { x: 18, y: 5 } };
          if (unit.id === party[0]?.id) return { ...unit, pos: { x: 13, y: 5 } };
          if (unit.id === party[1]?.id) return { ...unit, pos: { x: 13, y: 6 } };
          return unit;
        }),
      },
    };

    const result = reconcileBattleResult(CONTENT, state, { squareFootprints: true });
    const moved = result.state.battle?.units.find((unit) => unit.id === boss.id);
    expect(result.warnings.some((warning) => warning.kind === 'no-free-cell')).toBe(false);
    expect(moved?.pos).not.toEqual({ x: 18, y: 5 });
    if (moved) {
      const cells = [
        { x: moved.pos.x, y: moved.pos.y },
        { x: moved.pos.x + 1, y: moved.pos.y },
        { x: moved.pos.x, y: moved.pos.y + 1 },
        { x: moved.pos.x + 1, y: moved.pos.y + 1 },
      ];
      for (const cell of cells)
        expect(tileAt(result.state.battle!.grid, cell)?.blocked).toBe(false);
    }
  });

  it('falls back to the first walkable terrain cell when every party spawn is buried', () => {
    const old = currentBattleState('quarry_floor');
    if (!old.battle) throw new Error('missing battle');
    const map = CONTENT.maps.get('quarry_floor');
    if (!map) throw new Error('missing map');
    const rows = map.rows.map((row, y) => {
      let next = row.replace(/[XASP]/g, '.');
      for (const spawn of map.partySpawns) {
        if (spawn.y === y) next = `${next.slice(0, spawn.x)}#${next.slice(spawn.x + 1)}`;
      }
      if (y === 6) next = `${next.slice(0, 19)}#${next.slice(20)}`;
      return next;
    });
    const content = contentWithMap({ ...map, rows, props: [] });
    const boss = old.battle.units.find((unit) => unit.size === 2);
    if (!boss) throw new Error('missing boss');
    const state: GameState = {
      ...old,
      battle: {
        ...old.battle,
        units: old.battle.units.map((unit) =>
          unit.id === boss.id ? { ...unit, pos: { x: 18, y: 5 } } : unit,
        ),
      },
    };
    const result = reconcileBattleResult(content, state, { squareFootprints: true });
    expect(result.warnings.some((warning) => warning.kind === 'no-free-cell')).toBe(false);
    expect(result.state.battle?.units.find((unit) => unit.id === boss.id)?.pos).not.toEqual({
      x: 18,
      y: 5,
    });
  });

  it('prefers a farther connected candidate after an earlier opponent moves', () => {
    const { content, state, bossId } = corridorFixture();
    const result = reconcileBattleResult(content, state, { squareFootprints: true });
    const moved = result.state.battle?.units.find((unit) => unit.id === bossId);
    // The party unit snaps to the east end first. The boss's nearest connected
    // square is (1,2), but the blocker in the two-wide corridor keeps it from
    // ever reaching that opponent, so the first square past the blocker wins.
    expect(result.state.battle?.units[0]?.pos).toEqual({ x: 18, y: 2 });
    expect(moved?.pos).toEqual({ x: 7, y: 2 });
    // Connectivity is terrain-only: the blocker prevents contact across the
    // lower lane, but it must not make the nearest terrain component look
    // disconnected from the party spawn.
    expect(result.warnings.some((warning) => warning.kind === 'disconnected-snap')).toBe(false);
  });

  it('uses terrain connectivity when a corridor has no opponent to contact', () => {
    const { content, state, bossId } = corridorFixture(true);
    const result = reconcileBattleResult(content, state, { squareFootprints: true });
    // The dead party unit contributes no contact target. The living same-faction
    // blocker remains at (6,3), but terrain-only flooding sees the whole two-wide
    // corridor, so the boss's nearest connected 2x2 anchor is exactly (1,2).
    expect(result.state.battle?.units.find((unit) => unit.id === bossId)?.pos).toEqual({
      x: 1,
      y: 2,
    });
    expect(result.warnings).toEqual([]);
  });

  it('keeps a sealed boss save unchanged and reports no-free-cell', () => {
    const old = battleState('quarry_gate', OLD_QUARRY_ROWS);
    const current = CONTENT.maps.get('quarry_gate');
    if (!old.battle || !current) throw new Error('missing sealed-boss fixture');
    const rows = current.rows.map(() => '#'.repeat(current.width));
    const content = contentWithMap({ ...current, rows, props: [] });
    const result = reconcileBattleResult(content, old, { squareFootprints: true });
    expect(result.state).toBe(old);
    expect(result.state.battle?.grid).toBe(old.battle.grid);
    expect(result.warnings).toContainEqual({
      kind: 'no-free-cell',
      unitId: old.battle.units[0]?.id,
    });
  });

  it('keeps a sealed square boss save unchanged when only disconnected candidates are usable', () => {
    const old = currentBattleState('quarry_floor');
    if (!old.battle) throw new Error('missing battle');
    const map = CONTENT.maps.get('quarry_floor');
    if (!map) throw new Error('missing map');
    const party = old.battle.units.find((unit) => unit.faction === 'party');
    const boss = old.battle.units.find((unit) => unit.size === 2);
    if (!party || !boss) throw new Error('fixture is missing the party or boss');
    // The party stands in a one-cell-wide corridor. The boss's east pocket has
    // a usable (10,2) 2x2 candidate, but a square cannot traverse that corridor
    // to reach the party; there is deliberately no party-side 2x2 pocket.
    const rows = Array.from({ length: map.height }, (_, y) => {
      const cells = Array.from({ length: map.width }, () => '#');
      if (y === 2) for (const x of [10, 11]) cells[x] = '.';
      if (y === 3) for (let x = 1; x <= 11; x++) cells[x] = '.';
      return cells.join('');
    });
    const sealedMap = { ...map, rows, partySpawns: [{ x: 1, y: 3 }], props: [] };
    const state: GameState = {
      ...old,
      battle: {
        ...old.battle,
        grid: buildGrid(sealedMap),
        props: [],
        temporaryWalls: [],
        units: [
          { ...party, pos: { x: 1, y: 3 } },
          { ...boss, pos: { x: 10, y: 3 } },
        ],
      },
    };
    const result = reconcileBattleResult(contentWithMap(sealedMap), state, {
      squareFootprints: true,
    });
    expect(result.state).toBe(state);
    expect(result.warnings).toContainEqual({
      kind: 'disconnected-snap',
      unitId: boss.id,
      pos: { x: 10, y: 2 },
    });
    expect(result.warnings).toContainEqual({ kind: 'no-free-cell', unitId: boss.id });
  });

  it('bounds reachable floods when searching a sealed-boss worst case', () => {
    const { content, state } = corridorFixture(true);
    let floods = 0;
    const countingReachable: typeof reachable = (...args) => {
      floods += 1;
      return reachable(...args);
    };
    reconcileBattleResult(content, state, {
      squareFootprints: true,
      reachable: countingReachable,
    });
    // The terrain flood has one component; the same-faction blocker splits the
    // contact flood into left and right components. Cache reuse therefore makes
    // exactly 1 + 2 = 3 calls, versus roughly 2N + 1 without component caches.
    expect(floods).toBe(3);
  });

  it('does not snap a square boss into a chamber joined by a one-cell corridor', () => {
    // Quarry Gate has no boss encounter. Start with the authored Driller
    // battle instead, then replace its map with this small synthetic layout.
    const old = currentBattleState('quarry_floor');
    if (!old.battle) throw new Error('missing battle');
    const current = CONTENT.maps.get('quarry_floor');
    if (!current) throw new Error('missing map');
    const party = old.battle.units.find((unit) => unit.faction === 'party');
    const boss = old.battle.units.find((unit) => unit.size === 2);
    if (!party || !boss) throw new Error('fixture is missing the party or boss');

    // Every cell is in the one-cell walkable component, but the connection to
    // the 2x2 chamber is only one tile wide. A square cannot walk through it.
    const rows = Array.from({ length: current.height }, (_, y) => {
      const cells = Array.from({ length: current.width }, () => '#');
      const open =
        y === 2 ? [1, 2, 3, 10, 11] : y === 3 ? Array.from({ length: 11 }, (_, x) => x + 1) : [];
      for (const x of open) cells[x] = '.';
      return cells.join('');
    });
    const map = { ...current, rows, partySpawns: [{ x: 1, y: 3 }] };
    const content = contentWithMap(map);
    const state: GameState = {
      ...old,
      battle: {
        ...old.battle,
        grid: buildGrid(map),
        props: [],
        temporaryWalls: [],
        units: [
          { ...party, pos: { x: 1, y: 3 } },
          // The legacy 2x1 fits on the chamber's lower row; the square's
          // lower row is buried, making (10,2) the tempting sealed candidate.
          { ...boss, pos: { x: 10, y: 3 } },
        ],
      },
    };

    const legacy = reconcileBattleResult(content, state, { squareFootprints: false });
    expect(legacy.state.battle?.units.find((unit) => unit.id === boss.id)?.pos).toEqual({
      x: 10,
      y: 3,
    });

    const result = reconcileBattleResult(content, state, { squareFootprints: true });
    const moved = result.state.battle?.units.find((unit) => unit.id === boss.id);
    expect(moved?.pos).not.toEqual({ x: 10, y: 2 });
    expect(moved?.pos).toEqual({ x: 2, y: 2 });
    expect(result.warnings).toContainEqual({
      kind: 'disconnected-snap',
      unitId: boss.id,
      pos: { x: 10, y: 2 },
    });
  });
});

describe('ramp reconciliation', () => {
  const floor = CONTENT.maps.get('quarry_floor');
  if (!floor) throw new Error('missing the quarry floor map');
  const floorRows = floor.rows;

  /** (3,1) is the authored slope; (3,2) is the tier-0 floor that steps onto it. */
  const RAMP = { x: 3, y: 1 };
  const BELOW = { x: 3, y: 2 };

  /** Move cost of stepping from the floor up onto the slope. */
  function rampStepCost(grid: Grid): number | null {
    return enterCost(
      {
        grid,
        blocked: new Set<string>(),
        surfaces: CONTENT.surfaces,
        size: 1,
        climbCost: CONTENT.tuning.climbCost,
      },
      BELOW,
      RAMP,
    );
  }

  function savedFloor(): GameState {
    const state = battleState('quarry_floor', floorRows);
    if (!state.battle) throw new Error('fixture did not create a battle');
    return state;
  }

  /** The authored save with the ramp flag set (or dropped) at (3,1). */
  function withRampFlag(state: GameState, ramp: boolean | undefined): GameState {
    if (!state.battle) throw new Error('fixture did not create a battle');
    const tile = tileAt(state.battle.grid, RAMP);
    if (!tile) throw new Error('the ramp fixture is off-grid');
    return {
      ...state,
      battle: { ...state.battle, grid: withTile(state.battle.grid, RAMP, { ...tile, ramp }) },
    };
  }

  it('rebuilds a ramp the map has added, waiving the climb', () => {
    const loaded = load(withRampFlag(savedFloor(), false));
    expect(tileAt(loaded.battle?.grid ?? buildGrid(floor), RAMP)).toMatchObject({
      terrain: 'stone',
      elevation: 1,
      ramp: true,
    });
    if (!loaded.battle) throw new Error('the reconciled save lost its battle');
    expect(rampStepCost(loaded.battle.grid)).toBe(1);
  });

  it('rebuilds a legacy save whose ramp property is simply absent', () => {
    const loaded = load(withRampFlag(savedFloor(), undefined));
    expect(tileAt(loaded.battle?.grid ?? buildGrid(floor), RAMP)).toMatchObject({
      terrain: 'stone',
      elevation: 1,
      ramp: true,
    });
    if (!loaded.battle) throw new Error('the reconciled save lost its battle');
    expect(rampStepCost(loaded.battle.grid)).toBe(1);
  });

  it('rebuilds when the map has removed a ramp the save still carried', () => {
    // The current floor flattened (3,1) to bare tier-1 stone; the save predates it.
    const rows = floor.rows.map((row, y) => (y === 1 ? `${row.slice(0, 3)}^${row.slice(4)}` : row));
    const loaded = loadWith(contentWithMap({ ...floor, rows }), savedFloor());
    const tile = tileAt(loaded.battle?.grid ?? buildGrid(floor), RAMP);
    expect(tile).toMatchObject({ terrain: 'stone', elevation: 1 });
    expect(tile?.ramp ?? false).toBe(false);
    if (!loaded.battle) throw new Error('the reconciled save lost its battle');
    expect(rampStepCost(loaded.battle.grid)).toBe(2);
  });

  it('treats a missing ramp on a non-ramp tile as false and rebuilds nothing', () => {
    const state = savedFloor();
    const battle = state.battle;
    if (!battle) throw new Error('fixture did not create a battle');
    const flat = tileAt(battle.grid, BELOW);
    if (!flat) throw new Error('the flat fixture is off-grid');
    const dropped: GameState = {
      ...state,
      battle: { ...battle, grid: withTile(battle.grid, BELOW, { ...flat, ramp: undefined }) },
    };

    const parsed = deserialize(serialize(dropped, META));
    if (!parsed.ok) throw new Error(parsed.error);
    const loaded = stateFromBlob(parsed.blob);
    const reconciled = reconcileBattle(CONTENT, loaded);

    // No static difference anywhere, so the save is handed straight back.
    expect(reconciled).toBe(loaded);
    expect(tileAt(reconciled.battle?.grid ?? buildGrid(floor), BELOW)?.ramp ?? false).toBe(false);
  });

  it('keeps temporary terrain journals when a ramp change forces a rebuild', () => {
    const state = savedFloor();
    const battle = state.battle;
    if (!battle) throw new Error('fixture did not create a battle');
    const rampTile = tileAt(battle.grid, RAMP);
    if (!rampTile) throw new Error('the ramp fixture is off-grid');

    const surfacePos = { x: 5, y: 3 };
    const wallPos = { x: 5, y: 2 };
    let grid = withTile(battle.grid, RAMP, { ...rampTile, ramp: false });
    grid = withSurface(grid, surfacePos, { id: 'fire', duration: 2, spread: 0 });
    const wallPrevious = tileAt(grid, wallPos);
    if (!wallPrevious) throw new Error('the wall fixture is off-grid');
    grid = withTile(grid, wallPos, {
      ...wallPrevious,
      terrain: 'wall',
      blocked: true,
      blocksSight: true,
      cover: false,
      surface: null,
    });

    const loaded = load({
      ...state,
      battle: {
        ...battle,
        grid,
        temporaryWalls: [{ pos: wallPos, untilRound: 3, previous: wallPrevious }],
      },
    });
    const out = loaded.battle;
    if (!out) throw new Error('the reconciled save lost its battle');

    // The ramp rebuild ran...
    expect(tileAt(out.grid, RAMP)).toMatchObject({ terrain: 'stone', elevation: 1, ramp: true });
    // ...without dropping the live surface or the wall's restore journal.
    expect(tileAt(out.grid, surfacePos)?.surface).toEqual({ id: 'fire', duration: 2, spread: 0 });
    expect(tileAt(out.grid, wallPos)).toMatchObject({ terrain: 'wall', blocked: true });
    const wall = out.temporaryWalls.find(
      (item) => item.pos.x === wallPos.x && item.pos.y === wallPos.y,
    );
    expect(wall?.untilRound).toBe(3);
    expect(wall?.previous).toMatchObject({ terrain: 'dirt', elevation: 0, blocked: false });
    expect(out.props.length).toBe(battle.props.length);
    for (const prop of out.props) expect(prop.previous).toBeDefined();
  });
});

describe('dead active pointer recovery', () => {
  it('advances a loaded battle whose active pointer is a dead unit', () => {
    const state = currentBattleState('quarry_floor');
    if (!state.battle) throw new Error('fixture did not create a battle');
    const dead = activeUnit(state.battle);
    if (!dead) throw new Error('fixture has no active unit');
    const wounded: GameState = {
      ...state,
      battle: {
        ...state.battle,
        units: state.battle.units.map((unit) => (unit.id === dead.id ? { ...unit, hp: 0 } : unit)),
      },
    };

    const loaded = load(wounded);
    const battle = loaded.battle;
    if (!battle) throw new Error('the recovered battle is missing');
    const active = activeUnit(battle);
    expect(active?.id).not.toBe(dead.id);
    expect(active !== undefined && isAlive(active)).toBe(true);
    // A repair, not a ritual: a second load leaves the living pointer alone.
    expect(reconcileBattle(CONTENT, loaded)).toEqual(loaded);
  });
});
