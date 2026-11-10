import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { distanceBetweenUnits, occupiedCells, posKey, reachable, tileAt } from '../rules/grid';
import { SQUARE_FOOTPRINTS } from '../rules/footprint';
import { partyOfSize } from '../sim/balance';
import { evaluate } from '../story/conditions';
import type {
  BattleState,
  Condition,
  ContentIndex,
  EncounterDef,
  EncounterVariant,
  FlagValue,
  GameState,
  MapDef,
  Vec2,
} from '../types';
import { createBattle, createGame, encounterRoster } from './createGame';

/**
 * Enumerate the shipped binary spatial conditions, including conditional
 * blocking props. Refuse a new kind of condition until it has real witnesses;
 * silently treating an unsupported condition as false would omit a roster.
 */
function flagStates(encounter: EncounterDef, map: MapDef): Readonly<Record<string, FlagValue>>[] {
  const keys = new Set(encounter.conditionalEnemies.map((group) => group.flag));
  const add = (condition: Condition | undefined): void => {
    if (!condition) return;
    if (condition.kind === 'flag' && (condition.op === 'set' || condition.op === 'unset')) {
      keys.add(condition.key);
    } else if (condition.kind === 'all' || condition.kind === 'any') {
      condition.of.forEach(add);
    } else if (condition.kind === 'not') {
      add(condition.of);
    } else {
      throw new Error(
        `${encounter.id}: add spatial fixture witnesses for ${JSON.stringify(condition)}`,
      );
    }
  };
  for (const variant of encounter.variants) add(variant.when);
  for (const prop of [
    ...map.props,
    ...encounter.variants.flatMap((variant) => variant.extraProps ?? []),
  ]) {
    add(prop.when);
  }
  return [...keys].sort().reduce<Record<string, FlagValue>[]>(
    (states, key) =>
      states.flatMap((flags) => [
        { ...flags, [key]: false },
        { ...flags, [key]: true },
      ]),
    [{}],
  );
}

interface SpawnCase {
  readonly label: string;
  readonly encounter: EncounterDef;
  readonly state: GameState;
  readonly variant: EncounterVariant | null;
}

function shippedCases(): SpawnCase[] {
  const cases: SpawnCase[] = [];
  for (const encounter of CONTENT.encounters.values()) {
    const map = CONTENT.maps.get(encounter.mapId);
    if (!map) throw new Error(`Missing battlefield ${encounter.mapId}`);
    for (let size = 1; size <= 6; size++) {
      for (const flags of flagStates(encounter, map)) {
        const state = createGame(CONTENT, {
          seed: `encounter-spawns-563:${encounter.id}:${size}`,
          startNode: '',
          flags,
          party: partyOfSize(size).map((slot) => ({
            ...slot,
            level: encounter.expectedLevel,
            autoChoose: true,
          })),
        });
        const eligible = encounter.variants.filter((variant) => evaluate(state, variant.when));
        // Explicit pins also support zero-weight variants. Natural selection
        // uses the base roster when no eligible positive-weight variant exists.
        // Forest's authored roster is covered by its explicit `thugs` variant.
        const variants: readonly (EncounterVariant | null)[] = eligible.some(
          (variant) => variant.weight > 0,
        )
          ? eligible
          : [...eligible, null];
        for (const variant of variants) {
          cases.push({
            label: `${encounter.id}/size-${size}/${variant?.id ?? 'base'}/${JSON.stringify(flags)}`,
            encounter,
            state,
            variant,
          });
        }
      }
    }
  }
  return cases;
}

/** Inspect final assembly: nearby relocation is part of createBattle's contract. */
function spawnProblems(battle: BattleState, content: ContentIndex = CONTENT): string[] {
  const problems: string[] = [];
  const claimed = new Map<string, string>();
  const propCells = new Set(battle.props.map((prop) => posKey(prop.pos)));
  const party = battle.units.filter((unit) => unit.faction === 'party');
  const partyCells = new Set(party.flatMap((unit) => occupiedCells(unit, true).map(posKey)));
  const invalid = new Set<string>();
  for (const unit of battle.units) {
    const cells = occupiedCells(unit, true);
    const elevations = new Set<number>();
    for (const cell of cells) {
      const key = posKey(cell);
      const tile = tileAt(battle.grid, cell);
      if (!tile) {
        problems.push(`${unit.id}: out of bounds at ${key}`);
        invalid.add(unit.id);
      } else {
        elevations.add(tile.elevation);
        if (tile.blocked) {
          problems.push(`${unit.id}: blocked at ${key}`);
          invalid.add(unit.id);
        }
      }
      if (propCells.has(key)) problems.push(`${unit.id}: overlaps prop at ${key}`);
      const prior = claimed.get(key);
      if (prior !== undefined) problems.push(`${unit.id}: overlaps unit ${prior} at ${key}`);
      claimed.set(key, unit.id);
    }
    if (unit.size === 2 && elevations.size > 1) {
      problems.push(`${unit.id}: size-2 footprint is not flat`);
      invalid.add(unit.id);
    }
  }

  for (const enemy of battle.units.filter((unit) => unit.faction === 'enemy')) {
    if (invalid.has(enemy.id)) continue;
    // Positive step costs and a finite grid make Infinity a full component
    // search, not a round/movement-budget assumption. Units are deliberately
    // ignored; prop blockage baked into the actual battle grid remains active.
    const destinations = reachable(
      {
        grid: battle.grid,
        blocked: new Set<string>(),
        surfaces: content.surfaces,
        size: enemy.size,
        squareFootprints: true,
        climbCost: content.tuning.climbCost,
      },
      enemy.pos,
      Infinity,
    );
    const canReachParty = [...destinations.values()].some(({ pos }) => {
      const standing = { ...enemy, pos };
      if (occupiedCells(standing, true).some((cell) => partyCells.has(posKey(cell)))) return false;
      return party.some((friend) => distanceBetweenUnits(standing, friend, true) === 1);
    });
    if (!canReachParty) problems.push(`${enemy.id}: cannot reach a distinct party adjacency`);
  }
  return problems;
}

describe('assembled encounter spawn validity', () => {
  const cases = shippedCases();

  it('covers every shipped encounter, all six table sizes and the shipped square footprint', () => {
    expect(SQUARE_FOOTPRINTS).toBe(true);
    for (const encounter of CONTENT.encounters.values()) {
      for (let size = 1; size <= 6; size++) {
        const matching = cases.filter(
          (entry) => entry.encounter.id === encounter.id && entry.state.party.length === size,
        );
        expect(matching.length, `${encounter.id}/size-${size}`).toBeGreaterThan(0);
        for (const variant of encounter.variants) {
          expect(
            matching.some((entry) => entry.variant?.id === variant.id),
            `${encounter.id}/${variant.id}/size-${size}`,
          ).toBe(true);
        }
      }
    }
    const floor = cases.filter((entry) => entry.encounter.id === 'enc_grumbler');
    expect(floor.some((entry) => entry.state.flags.pella_asked === true)).toBe(true);
    expect(floor.some((entry) => entry.state.flags.pella_asked === false)).toBe(true);
  });

  it.each(cases)('$label', ({ encounter, state, variant }) => {
    const original = structuredClone(state);
    const battle = createBattle(
      CONTENT,
      state,
      encounter.id,
      new RngCursor(state.rng),
      variant ? { variantId: variant.id } : {},
    );
    expect(battle.variantId).toBe(variant?.id ?? null);
    const roster = encounterRoster(encounter, state.flags, state.party.length, variant);
    expect(
      battle.units.filter((unit) => unit.faction === 'party').map((unit) => unit.characterId),
    ).toEqual(state.party.map((unit) => unit.characterId));
    expect(
      battle.units.filter((unit) => unit.faction === 'ally').map((unit) => unit.enemyId),
    ).toEqual(roster.allies.map((placement) => placement.enemyId));
    const enemyIds = battle.units
      .filter((unit) => unit.faction === 'enemy')
      .map((unit) => unit.enemyId);
    expect(enemyIds).toEqual(roster.enemies.map((placement) => placement.enemyId));
    expect(battle.units).toHaveLength(
      state.party.length + roster.allies.length + roster.enemies.length,
    );
    const extra = encounter.reinforcements.slice(
      0,
      Math.max(0, state.party.length + roster.allies.length - encounter.baselinePartySize),
    );
    if (extra.length)
      expect(enemyIds.slice(-extra.length)).toEqual(extra.map((placement) => placement.enemyId));
    // Reinforcements are an immediate roster suffix; there is no delayed-wave
    // API or timer in the current encounter schema or battle creation path.
    if (encounter.id === 'enc_grumbler') {
      expect(battle.props.some((prop) => prop.propId === 'cabbage_cart')).toBe(
        Boolean(state.flags.pella_asked),
      );
    }
    expect(spawnProblems(battle)).toEqual([]);
    expect(state).toEqual(original);
  });
});

/** Real creation with tiny adversarial maps exercises exhausted relocation. */
function adverseBattle(rows: readonly string[], enemyAt: Vec2): BattleState {
  const sourceMap = CONTENT.maps.get('forest_road');
  const sourceEncounter = CONTENT.encounters.get('enc_forest_road');
  if (!sourceMap || !sourceEncounter) throw new Error('Missing spawn negative fixture sources');
  const first = rows[0];
  if (!first) throw new Error('Missing spawn fixture row');
  const map: MapDef = {
    ...sourceMap,
    id: 'spawn_negative_map',
    width: first.length,
    height: rows.length,
    rows,
    legend: { '.': { terrain: 'grass' }, '#': { terrain: 'wall', blocked: true } },
    partySpawns: [{ x: 1, y: 1 }],
    props: [],
  };
  const encounter: EncounterDef = {
    ...sourceEncounter,
    id: 'spawn_negative_encounter',
    mapId: map.id,
    baselinePartySize: 1,
    enemies: [{ enemyId: 'bandit_thug', pos: enemyAt }],
    allies: [],
    conditionalEnemies: [],
    reinforcements: [],
    variants: [],
  };
  const content: ContentIndex = {
    ...CONTENT,
    maps: new Map(CONTENT.maps).set(map.id, map),
    encounters: new Map(CONTENT.encounters).set(encounter.id, encounter),
  };
  const state = createGame(content, {
    seed: 'spawn-negative-563',
    startNode: '',
    party: [{ characterId: 'bo' }],
  });
  return createBattle(content, state, encounter.id, new RngCursor(state.rng));
}

describe('spawn assertions witness invalid final assemblies', () => {
  it('accepts a nearby repair instead of treating authored preference as a final position contract', () => {
    const battle = adverseBattle(['.....', '.....', '.....'], { x: 5, y: 1 });
    expect(battle.units.find((unit) => unit.faction === 'enemy')?.pos).not.toEqual({ x: 5, y: 1 });
    expect(spawnProblems(battle)).toEqual([]);
  });

  it('detects overlapping units when the real placement search exhausts its free cells', () => {
    const battle = adverseBattle(['###', '#.#', '###'], { x: 1, y: 1 });
    expect(spawnProblems(battle)).toEqual(
      expect.arrayContaining([expect.stringContaining('overlaps unit')]),
    );
  });

  it('detects blocked final spawns when every nearby destination is blocked', () => {
    const battle = adverseBattle(['###', '###', '###'], { x: 1, y: 1 });
    expect(spawnProblems(battle)).toEqual(
      expect.arrayContaining([expect.stringContaining('blocked at')]),
    );
  });

  it('detects an out-of-bounds final spawn beyond the repair radius', () => {
    const battle = adverseBattle(['.....', '.....', '.....'], { x: 20, y: 20 });
    expect(spawnProblems(battle)).toEqual(
      expect.arrayContaining([expect.stringContaining('out of bounds')]),
    );
  });

  it('detects a validly placed enemy on an island separated by solid terrain', () => {
    const battle = adverseBattle(['...#...', '...#...', '...#...'], { x: 5, y: 1 });
    expect(spawnProblems(battle)).toEqual([
      expect.stringContaining('cannot reach a distinct party adjacency'),
    ]);
  });
});
