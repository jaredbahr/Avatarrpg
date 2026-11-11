/** Every authored ability is a pure query, including illegal aiming probes. */
import { performance } from 'node:perf_hooks';
import { describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../../content';
import * as random from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import { apply } from '../state/reducer';
import type { Ability, BattleState, GameState, KitEntry, Unit, Vec2 } from '../types';
import {
  isValidTarget,
  previewAbility,
  resolveAim,
  targetableTiles,
  unitAbilities,
} from './abilities';
import { scoreAbility, weightsFor } from './ai';
import { inBounds, occupiedCells, posKey } from './grid';
import { isAlive } from './stats';

const BUDGET_MS = 20_000;
const SEEDS = ['preview-purity-a', 'preview-purity-b'] as const;
const DRAW_METHODS = ['float', 'int', 'range', 'chance', 'pick', 'shuffle'] as const;
const DRAW_FUNCTIONS = [
  'nextFloat',
  'nextInt',
  'nextRange',
  'nextChance',
  'pick',
  'shuffle',
] as const;

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Only call on our structured clones, never freeze shared CONTENT data. */
function freezeGraph<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) freezeGraph(nested);
    Object.freeze(value);
  }
  return value;
}

function midBattles(): Array<{ label: string; state: GameState; turns: number }> {
  const fixtures: Array<{ label: string; state: GameState; turns: number }> = [];
  for (const encounter of CONTENT.encounters.values()) {
    for (const seed of SEEDS) {
      const label = `${encounter.id}/${seed}`;
      const game = createGame(CONTENT, {
        seed: label,
        party: ['kaya', 'nilak', 'bo', 'nima', 'riko', 'wen'].map((characterId) => ({
          characterId,
          level: encounter.expectedLevel,
          autoChoose: true,
        })),
        startNode: '',
      });
      const rng = new random.RngCursor(game.rng);
      const battle = createBattle(CONTENT, game, encounter.id, rng);
      let state: GameState = {
        ...game,
        screen: 'combat',
        rng: rng.state,
        battle: {
          ...battle,
          units: battle.units.map((unit) =>
            unit.faction === 'party' ? { ...unit, ai: 'aggressive' } : unit,
          ),
        },
      };
      let turns = 0;
      for (; turns < 18; turns++) {
        const step = apply(CONTENT, state, { type: 'runAiTurn' });
        ensure(step.events.length > 0, `${label}: fixture AI made no progress`);
        // Keep the last actual active state before a terminal result. Nothing
        // is moved or resurrected to make a convenient targeting fixture.
        if (step.state.battle?.phase !== 'active') break;
        state = step.state;
      }
      ensure(turns > 0 && state.battle?.phase === 'active', `${label}: not mid-battle`);
      fixtures.push({ label, state, turns });
    }
  }
  return fixtures;
}

function kitAbilities(kit: readonly KitEntry[]): string[] {
  return kit.flatMap((entry) =>
    'ability' in entry ? [entry.ability] : 'choose' in entry ? [...entry.choose] : [],
  );
}

function referencedAbilities(): Set<string> {
  return new Set([
    ...[...CONTENT.characters.values()].flatMap((character) => kitAbilities(character.kit)),
    ...[...CONTENT.disciplines.values()].flatMap((discipline) => kitAbilities(discipline.kit)),
    ...[...CONTENT.enemies.values()].flatMap((enemy) => [...enemy.abilities]),
    ...CONTENT.universalAbilities,
  ]);
}

function enumerateTargets(battle: BattleState, caster: Unit, ability: Ability) {
  // Self actions have no coordinate choice: the public enumeration is the
  // caster footprint, while isValidTarget deliberately ignores all coordinates.
  const tiles =
    ability.targeting.shape === 'self'
      ? occupiedCells(caster)
      : Array.from({ length: battle.grid.width * battle.grid.height }, (_, index) => ({
          x: index % battle.grid.width,
          y: Math.floor(index / battle.grid.width),
        }));
  const legal: Vec2[] = [];
  const invalid = new Map<string, Vec2>();
  for (const tile of tiles) {
    const aim =
      ability.targeting.shape === 'unit'
        ? resolveAim(CONTENT, battle, caster, ability, tile)
        : tile;
    const check = isValidTarget(CONTENT, battle, caster, ability, aim);
    if (check.ok) legal.push(tile);
    else if (!invalid.has(check.reason)) invalid.set(check.reason, tile);
  }
  return { legal, invalid };
}

function guardedProbe(source: GameState, ability: Ability) {
  const copy = structuredClone(source);
  const battle = copy.battle;
  ensure(battle, 'missing fixture battle');
  const living = battle.units.filter(isAlive);
  const owners = living.filter((unit) => unitAbilities(CONTENT, unit).includes(ability.id));
  const matching = living.filter((unit) => unit.element === ability.element);
  const choices = owners.length > 0 ? owners : matching.length > 0 ? matching : living;
  ensure(choices.length > 0, 'no living fixture caster');

  // Equip the queried ability during fixture setup when the actual mid-battle
  // roster has no owner (later disciplines and other enemy rosters included).
  // This is explicit query-fixture ownership, not claimed earned progression.
  const candidates = choices.map((unit) => {
    const caster: Unit = { ...unit, abilities: [...new Set([...unit.abilities, ability.id])] };
    return { caster, ...enumerateTargets(battle, caster, ability) };
  });
  candidates.sort(
    (a, b) => b.legal.length - a.legal.length || a.caster.id.localeCompare(b.caster.id),
  );
  const best = candidates[0];
  ensure(best, 'missing caster choice');
  expect(new Set(targetableTiles(CONTENT, battle, best.caster, ability).map(posKey))).toEqual(
    new Set(best.legal.map(posKey)),
  );
  const state: GameState = {
    ...copy,
    party: copy.party.map((unit) =>
      unit.id === best.caster.id ? { ...unit, abilities: best.caster.abilities } : unit,
    ),
    battle: {
      ...battle,
      units: battle.units.map((unit) => (unit.id === best.caster.id ? best.caster : unit)),
    },
  };
  ensure(state.battle, 'missing equipped battle');
  const before = structuredClone(state);
  freezeGraph(state);
  const cursor = new random.RngCursor(state.rng);
  const draft = new BattleDraft(CONTENT, state.battle, cursor);
  const beforeDraft = structuredClone(draft.toBattle());
  freezeGraph(draft.toBattle());
  Object.freeze(draft.events);
  Object.freeze(draft);
  const caster = draft.unit(best.caster.id);
  ensure(
    caster && unitAbilities(CONTENT, caster).includes(ability.id),
    'caster does not own ability',
  );
  return {
    state,
    before,
    draft,
    beforeDraft,
    cursor,
    caster,
    legal: best.legal,
    invalid: best.invalid,
  };
}

type Probe = ReturnType<typeof guardedProbe>;

function pureCall<T>(probe: Probe, label: string, query: () => T): T {
  const rng = probe.cursor.state;
  const gameRng = probe.state.rng;
  let result: T;
  try {
    result = query();
  } catch (error) {
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
  ensure(probe.cursor.state === rng, `${label}: actual BattleDraft RNG advanced`);
  ensure(probe.state.rng === gameRng, `${label}: GameState RNG changed`);
  return result;
}

function forbidDraws(): () => void {
  const spies: Array<{ mockRestore: () => void }> = [];
  try {
    for (const method of DRAW_METHODS) {
      spies.push(
        vi.spyOn(random.RngCursor.prototype, method).mockImplementation(() => {
          throw new Error(`RNG draw forbidden: cursor.${method}`);
        }),
      );
    }
    for (const method of DRAW_FUNCTIONS) {
      spies.push(
        vi.spyOn(random, method).mockImplementation(() => {
          throw new Error(`RNG draw forbidden: ${method}`);
        }),
      );
    }
  } catch (error) {
    for (const spy of spies.reverse()) spy.mockRestore();
    throw error;
  }
  return () => {
    for (const spy of spies.reverse()) spy.mockRestore();
  };
}

describe('all-ability preview and AI RNG purity', () => {
  it(
    'covers every legal tile and illegal probes without changing inputs within 20 seconds',
    () => {
      const started = performance.now();
      const fixtures = midBattles();
      const abilities = [...CONTENT.abilities.values()];
      ensure(fixtures.length >= 4 && abilities.length > 0, 'missing generated coverage');
      ensure(
        new Set(fixtures.map(({ state }) => state.battle?.mapId)).size >= 2,
        'need multiple maps',
      );
      ensure(
        fixtures.some(({ state }) => (state.battle?.props.length ?? 0) > 0),
        'missing real props',
      );
      ensure(
        fixtures.some(({ state }) => state.battle?.grid.tiles.some((tile) => tile.surface)),
        'missing real surfaces',
      );
      for (const id of referencedAbilities())
        ensure(CONTENT.abilities.has(id), `missing indexed ability ${id}`);

      const first = abilities[0];
      const fixture = fixtures[0];
      ensure(first && fixture, 'missing oracle fixture');
      const drawControl = guardedProbe(fixture.state, first);
      expect(() => pureCall(drawControl, 'oracle', () => drawControl.cursor.float())).toThrow(
        /actual BattleDraft RNG advanced/,
      );
      const mutationControl = guardedProbe(fixture.state, first);
      const party = mutationControl.state.party[0];
      const unit = mutationControl.draft.units[0];
      ensure(party && unit, 'missing nested mutation controls');
      expect(() => Object.assign(party.base, { maxHp: -1 })).toThrow(TypeError);
      expect(() => Object.assign(unit.pos, { x: -1 })).toThrow(TypeError);
      expect(() => mutationControl.draft.units.pop()).toThrow(TypeError);
      expect(mutationControl.state).toEqual(mutationControl.before);
      expect(mutationControl.draft.toBattle()).toEqual(mutationControl.beforeDraft);

      const coverage = new Map<
        string,
        { legal: number; illegal: number; preview: number; score: number }
      >();
      let totalPreview = 0;
      let totalScore = 0;
      let meaningfulPreview = 0;
      let finiteScore = 0;
      let selfOffBoardAccepted = 0;
      const illegalReasons = new Map<string, number>();
      const restore = forbidDraws();
      try {
        // Prove both the live cursor and a newly constructed preview cursor
        // would trip, as would a direct functional RNG call.
        expect(() => drawControl.cursor.chance(0.5)).toThrow(/RNG draw forbidden/);
        expect(() => new random.RngCursor(0).int(0, 1)).toThrow(/RNG draw forbidden/);
        expect(() => random.nextFloat(0)).toThrow(/RNG draw forbidden/);

        for (const { label, state } of fixtures) {
          for (const ability of abilities) {
            const probe = guardedProbe(state, ability);
            const battle = probe.state.battle;
            ensure(battle, 'missing guarded battle');
            const row = coverage.get(ability.id) ?? { legal: 0, illegal: 0, preview: 0, score: 0 };
            coverage.set(ability.id, row);
            const offBoard = [
              { x: -1, y: -1 },
              { x: battle.grid.width, y: battle.grid.height },
            ];
            const targets = [...probe.legal, ...offBoard, ...probe.invalid.values()];
            const walls = new Map<string, readonly Unit[]>(); // Intentional AI scratch cache.
            for (const [index, target] of targets.entries()) {
              const context = `${label}/${ability.id}/${index}/${posKey(target)}`;
              const aim =
                ability.targeting.shape === 'unit'
                  ? resolveAim(CONTENT, battle, probe.caster, ability, target)
                  : target;
              const check = isValidTarget(CONTENT, battle, probe.caster, ability, aim);
              if (index < probe.legal.length) row.legal++;
              else if (!check.ok) {
                row.illegal++;
                illegalReasons.set(check.reason, (illegalReasons.get(check.reason) ?? 0) + 1);
              } else if (ability.targeting.shape === 'self' && !inBounds(battle.grid, target)) {
                selfOffBoardAccepted++;
              }
              // Self abilities accept coordinates unconditionally; their off-board
              // probes are not falsely reported as rejected illegal targets.
              const preview = pureCall(probe, `${context}/preview`, () =>
                previewAbility(CONTENT, battle, probe.caster, ability, aim),
              );
              row.preview++;
              totalPreview++;
              if (
                preview.targets.length +
                  preview.props.length +
                  preview.shoves.length +
                  preview.reactions.length +
                  preview.terrain.length >
                0
              )
                meaningfulPreview++;
              const score = pureCall(probe, `${context}/score`, () =>
                scoreAbility(
                  probe.draft,
                  probe.caster,
                  ability,
                  aim,
                  weightsFor(probe.caster.ai),
                  walls,
                ),
              );
              row.score++;
              totalScore++;
              if (Number.isFinite(score)) finiteScore++;
            }
            expect(probe.state, `${label}/${ability.id}/original`).toEqual(probe.before);
            expect(probe.draft.toBattle(), `${label}/${ability.id}/draft`).toEqual(
              probe.beforeDraft,
            );
          }
        }
      } finally {
        restore();
      }

      expect([...coverage.keys()].sort()).toEqual([...CONTENT.abilities.keys()].sort());
      for (const ability of abilities) {
        const row = coverage.get(ability.id);
        ensure(row, `uncovered ${ability.id}`);
        expect(row.legal, `${ability.id}: no legal aim reached`).toBeGreaterThan(0);
        if (ability.targeting.shape !== 'self') expect(row.illegal, ability.id).toBeGreaterThan(0);
        expect(row.preview, ability.id).toBe(row.score);
      }
      expect(meaningfulPreview, 'preview queries must reach real effects').toBeGreaterThan(0);
      expect(
        finiteScore,
        'AI queries must reach real scoring paths; -Infinity is also legitimate',
      ).toBeGreaterThan(0);
      process.stdout.write(
        `${JSON.stringify({
          kind: 'preview RNG property coverage',
          fixtures: fixtures.map(({ label, turns }) => ({ label, turns })),
          abilities: coverage.size,
          legalTiles: [...coverage.values()].reduce((sum, row) => sum + row.legal, 0),
          illegalTargets: [...coverage.values()].reduce((sum, row) => sum + row.illegal, 0),
          totalPreview,
          totalScore,
          meaningfulPreview,
          finiteScore,
          selfOffBoardAccepted,
          illegalReasons: Object.fromEntries(illegalReasons),
        })}\n`,
      );
      expect(
        performance.now() - started,
        'complete generation, controls and all-ability workload',
      ).toBeLessThan(BUDGET_MS);
    },
    BUDGET_MS,
  );
});
