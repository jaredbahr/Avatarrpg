import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import * as reducer from '../src/core/state/reducer';
import * as creation from '../src/core/state/createGame';
import { partyOfSize } from '../src/core/sim/balance';
import { DEFAULT_MAX_ROUNDS, SimCommandError, runCombat, seedFor } from '../src/core/sim/runCombat';
import type { SimOptions, SimResult } from '../src/core/sim/runCombat';
import type { ContentIndex, EncounterDef, MapDef } from '../src/core/types';
import { parseSoakArgs } from './soak';
import {
  DEFAULT_SOAK_TRIALS,
  MAX_IDLE_EXAMPLES_PER_CELL,
  SOAK_SIZES,
  readSoakTrials,
  runSoakReport,
} from './soak/report';

afterEach(() => vi.restoreAllMocks());

function successfulResult(options: SimOptions, overrides: Partial<SimResult> = {}): SimResult {
  return {
    outcome: 'victory',
    variantId: options.variantId ?? null,
    rounds: 4,
    turns: 8,
    partyDeaths: 0,
    enemyDeaths: 1,
    partyHpRemaining: 20,
    partyHpTotal: 20,
    events: [],
    signature: 'report fixture',
    anomalies: [],
    diagnostics: { commandCount: 8, idleTurns: [], maxRoundsReached: false },
    ...overrides,
  };
}

function caught(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected an exception');
}

/** Adjacent actors with no abilities prefer staying put on this flat board. */
function waitingFixture(): ContentIndex {
  const character = CONTENT.characters.get('bo');
  const enemy = CONTENT.enemies.get('bandit_thug');
  if (!character || !enemy) throw new Error('Missing fixture definitions');
  const map: MapDef = {
    id: 'soak_waiting',
    name: 'Waiting diagnostics',
    kind: 'combat',
    width: 3,
    height: 3,
    rows: ['...', '...', '...'],
    legend: { '.': { terrain: 'dirt' } },
    partySpawns: [{ x: 1, y: 1 }],
    npcs: [],
    props: [],
    ambience: '',
  };
  const encounter: EncounterDef = {
    id: 'enc_soak_waiting',
    name: 'Waiting diagnostics',
    mapId: map.id,
    expectedLevel: 1,
    enemies: [{ enemyId: enemy.id, pos: { x: 2, y: 1 } }],
    allies: [],
    conditionalEnemies: [],
    baselinePartySize: 1,
    reinforcements: [],
    variants: [],
    intro: '',
    tip: '',
  };
  return {
    ...CONTENT,
    universalAbilities: [],
    characters: new Map([[character.id, { ...character, kit: [] }]]),
    enemies: new Map([[enemy.id, { ...enemy, abilities: [], ai: 'cautious' }]]),
    maps: new Map([[map.id, map]]),
    encounters: new Map([[encounter.id, encounter]]),
  };
}

describe('combat soak report', () => {
  it('defaults to 200 attempts for every pinned roster and size with balance parties and seeds', () => {
    const simulate = vi.fn((_content: ContentIndex, options: SimOptions) =>
      successfulResult(options),
    );
    const onRow = vi.fn();
    const report = runSoakReport(CONTENT, { onRow }, simulate);
    expect(DEFAULT_SOAK_TRIALS).toBe(200);
    expect(report.rows).toHaveLength(48);
    expect(report.summary.attempted).toBe(9600);
    expect(report.summary.completed).toBe(9600);
    expect(report.summary.passed).toBe(true);
    expect(onRow).toHaveBeenCalledTimes(48);
    expect(simulate).toHaveBeenCalledTimes(9600);
    for (const row of report.rows) {
      expect(row.attempted).toBe(200);
      expect(row.party).toEqual(partyOfSize(row.partySize).map((slot) => slot.characterId));
    }
    for (const [, options] of simulate.mock.calls) {
      expect(options.party).toEqual(partyOfSize(options.party.length));
      expect(options.partyLevel).toBe(CONTENT.encounters.get(options.encounterId)?.expectedLevel);
      expect(options.enemyLevel).toBeUndefined();
      expect(options.maxRounds).toBe(DEFAULT_MAX_ROUNDS);
      expect(options.diagnostics).toBe(true);
      expect(options.recordEvents).toBeUndefined();
    }
    expect(simulate.mock.calls[0]?.[1].seed).toBe(seedFor('enc_forest_road:thugs', 0));
    expect(simulate.mock.calls[199]?.[1].seed).toBe(seedFor('enc_forest_road:thugs', 199));
    for (const size of SOAK_SIZES) {
      expect(
        report.rows
          .filter((row) => row.partySize === size)
          .map((row) => [row.encounterId, row.variantId]),
      ).toEqual([
        ['enc_forest_road', 'thugs'],
        ['enc_forest_road', 'slingers'],
        ['enc_forest_road', 'bruisers'],
        ['enc_quarry_gate', null],
        ['enc_quarry_gate', 'bluffed'],
        ['enc_ambush', null],
        ['enc_grumbler', null],
        ['enc_grumbler', 'jins_people'],
      ]);
    }
  });

  it('continues after command and setup throws, and records reproducible result failures', () => {
    let attempt = 0;
    const report = runSoakReport(CONTENT, { trials: 1 }, (_content, options) => {
      attempt++;
      if (attempt === 1)
        throw new SimCommandError(
          options,
          options.variantId ?? null,
          7,
          new Error('command witness'),
        );
      if (attempt === 2) throw new Error('setup witness');
      if (attempt === 3) return successfulResult(options, { variantId: 'wrong_roster' });
      if (attempt === 4) return successfulResult(options, { diagnostics: undefined });
      if (attempt === 5) return successfulResult(options, { anomalies: ['non-finite HP witness'] });
      return successfulResult(options);
    });
    expect(attempt).toBe(48);
    expect(report.summary).toMatchObject({
      attempted: 48,
      completed: 46,
      throws: 2,
      failures: 5,
      passed: false,
    });
    expect(report.failures[0]).toMatchObject({
      encounterId: 'enc_forest_road',
      variantId: 'thugs',
      partySize: 1,
      trial: 0,
      seed: seedFor('enc_forest_road:thugs', 0),
      commandIndex: 7,
      kind: 'throw',
      stage: 'command',
    });
    expect(report.failures[1]).toMatchObject({
      commandIndex: -1,
      kind: 'throw',
      stage: 'setup',
      message: 'setup witness',
    });
    expect(report.failures.map((failure) => failure.kind)).toEqual([
      'throw',
      'throw',
      'variant',
      'diagnostics',
      'anomaly',
    ]);
    expect(report.rows[0]).toMatchObject({ medianRounds: null, maxRounds: null });
    expect(JSON.parse(JSON.stringify(report)).failures).toEqual(report.failures);
  });

  it('allows exactly 1% capped fights per cell and fails above 1% without hiding cap examples', () => {
    const run = (caps: number) => {
      let attempt = 0;
      return runSoakReport(CONTENT, { trials: 100 }, (_content, options) => {
        const capped = attempt++ % 100 < caps;
        return successfulResult(
          options,
          capped
            ? {
                outcome: 'stalemate',
                rounds: DEFAULT_MAX_ROUNDS + 1,
                diagnostics: { commandCount: 8, idleTurns: [], maxRoundsReached: true },
                anomalies: [
                  `encounter ${options.encounterId} did not finish within ${DEFAULT_MAX_ROUNDS} rounds`,
                ],
              }
            : {},
        );
      });
    };
    const atLimit = run(1);
    expect(atLimit.summary).toMatchObject({
      passed: true,
      maxRoundsRate: 0.01,
      failures: 0,
      maxRoundsReached: 48,
    });
    expect(atLimit.maxRoundsCases).toHaveLength(48);
    expect(atLimit.maxRoundsCases[0]).toMatchObject({
      seed: seedFor('enc_forest_road:thugs', 0),
      commandIndex: 7,
    });
    expect(atLimit.summary.maxRounds).toBe(61);
    const overLimit = run(2);
    expect(overLimit.summary).toMatchObject({
      passed: false,
      maxRoundsRate: 0.02,
      maxRoundsReached: 96,
    });
    expect(overLimit.rows.every((row) => !row.passed)).toBe(true);
    expect(overLimit.violations).toHaveLength(48);
  });

  it.each([
    [3, 4],
    [4, 6],
  ])('computes median and maximum across %i trials', (trials, median) => {
    let attempt = 0;
    const values = [2, 4, 8, 10];
    const report = runSoakReport(CONTENT, { trials }, (_content, options) =>
      successfulResult(options, { rounds: values[attempt++ % trials] ?? 0 }),
    );
    expect(report.summary.medianRounds).toBe(median);
    expect(report.summary.maxRounds).toBe(values[trials - 1]);
    for (const row of report.rows) {
      expect(row.medianRounds).toBe(median);
      expect(row.maxRounds).toBe(values[trials - 1]);
    }
  });

  it('bounds idle examples while retaining every idle count and replay command', () => {
    const idleTurns = Array.from({ length: MAX_IDLE_EXAMPLES_PER_CELL + 3 }, (_, commandIndex) => ({
      commandIndex,
      round: 1,
      unitId: 'p0',
      faction: 'party' as const,
    }));
    const report = runSoakReport(CONTENT, { trials: 2 }, (_content, options) =>
      successfulResult(options, {
        diagnostics: { commandCount: 30, idleTurns, maxRoundsReached: false },
      }),
    );
    expect(report.summary.idleTurns).toBe(48 * 2 * idleTurns.length);
    expect(report.summary.passed).toBe(true);
    for (const row of report.rows) {
      expect(row.idleTurns).toBe(2 * idleTurns.length);
      expect(row.idleExamples).toHaveLength(MAX_IDLE_EXAMPLES_PER_CELL);
      expect(row.idleExamples[0]).toMatchObject({
        seed: seedFor(`${row.encounterId}:${row.variantId ?? ''}`, 0),
        commandIndex: 0,
        trial: 0,
      });
    }
  });

  it('rejects invalid trial counts and malformed CLI arguments before a soak starts', () => {
    expect(readSoakTrials(undefined)).toBe(200);
    expect(readSoakTrials('2')).toBe(2);
    for (const value of ['', '0', '-1', '1.5', 'NaN', 'Infinity', '2x', '9007199254740992']) {
      expect(() => readSoakTrials(value), value).toThrow('positive safe integer');
    }
    for (const trials of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const simulate = vi.fn();
      expect(() => runSoakReport(CONTENT, { trials }, simulate)).toThrow('positive safe integer');
      expect(simulate).not.toHaveBeenCalled();
    }
    expect(parseSoakArgs([])).toEqual({ jsonPath: 'soak-report.json', help: false });
    expect(parseSoakArgs(['--json', 'fixture.json'])).toEqual({
      jsonPath: 'fixture.json',
      help: false,
    });
    expect(parseSoakArgs(['--help']).help).toBe(true);
    expect(() => parseSoakArgs(['--json'])).toThrow('requires a path');
    expect(() => parseSoakArgs(['--json', '--help'])).toThrow('requires a path');
    expect(() => parseSoakArgs(['--round-cap', '999'])).toThrow('Unknown soak option');
  });
});

describe('opt-in simulator diagnostics', () => {
  it('preserves complete events, results and reducer RNG states with diagnostics enabled', () => {
    const apply = reducer.apply;
    const rngStates: number[] = [];
    vi.spyOn(reducer, 'apply').mockImplementation((...args) => {
      const step = apply(...args);
      rngStates.push(step.state.rng);
      return step;
    });
    const options: SimOptions = {
      seed: seedFor('soak-diagnostic-parity', 0),
      encounterId: 'enc_forest_road',
      variantId: 'thugs',
      party: partyOfSize(3),
      recordEvents: true,
    };
    const ordinary = runCombat(CONTENT, options);
    const ordinaryRng = [...rngStates];
    rngStates.length = 0;
    const diagnosed = runCombat(CONTENT, { ...options, diagnostics: true });
    expect({ ...diagnosed, diagnostics: undefined }).toEqual({
      ...ordinary,
      diagnostics: undefined,
    });
    expect(diagnosed.events.length).toBeGreaterThan(0);
    expect(rngStates).toEqual(ordinaryRng);
    expect(diagnosed.diagnostics?.commandCount).toBe(diagnosed.turns);
    expect(diagnosed.diagnostics?.maxRoundsReached).toBe(false);
  });

  it('wraps the exact failing command and cause only when diagnostics are requested', () => {
    const apply = reducer.apply;
    const cause = new Error('forced second-command failure');
    const spy = vi.spyOn(reducer, 'apply');
    const options: SimOptions = {
      seed: 495,
      encounterId: 'enc_forest_road',
      variantId: 'thugs',
      party: partyOfSize(3),
    };
    spy.mockImplementationOnce(apply).mockImplementationOnce(() => {
      throw cause;
    });
    expect(caught(() => runCombat(CONTENT, options))).toBe(cause);
    spy
      .mockReset()
      .mockImplementationOnce(apply)
      .mockImplementationOnce(() => {
        throw cause;
      });
    const error = caught(() => runCombat(CONTENT, { ...options, diagnostics: true }));
    expect(error).toBeInstanceOf(SimCommandError);
    expect(error).toMatchObject({
      cause,
      commandIndex: 1,
      seed: 495,
      encounterId: 'enc_forest_road',
      variantId: 'thugs',
    });
  });

  it('reports legal movement deliberately declined by AI, and a real round-cap stop', () => {
    const result = runCombat(waitingFixture(), {
      seed: 495,
      encounterId: 'enc_soak_waiting',
      party: [{ characterId: 'bo' }],
      maxRounds: 1,
      diagnostics: true,
      recordEvents: true,
    });
    expect(
      result.events.filter((event) => event.type === 'unitMoved' || event.type === 'abilityUsed'),
    ).toEqual([]);
    expect(result.diagnostics?.idleTurns).toHaveLength(2);
    expect(result.diagnostics?.idleTurns.map((idle) => idle.commandIndex)).toEqual([0, 1]);
    expect(result.diagnostics?.maxRoundsReached).toBe(true);
    expect(result.outcome).toBe('stalemate');
    expect(result.rounds).toBe(2);
  });

  it('does not count rooted actors without AP or abilities as declining a legal action', () => {
    const createBattle = creation.createBattle;
    vi.spyOn(creation, 'createBattle').mockImplementation((...args) => {
      const battle = createBattle(...args);
      return {
        ...battle,
        units: battle.units.map((unit) => ({
          ...unit,
          ap: 0,
          statuses: [{ id: 'rooted' as const, duration: 99, stacks: 1 }],
        })),
      };
    });
    const result = runCombat(waitingFixture(), {
      seed: 495,
      encounterId: 'enc_soak_waiting',
      party: [{ characterId: 'bo' }],
      maxRounds: 1,
      diagnostics: true,
    });
    expect(result.diagnostics?.commandCount).toBe(2);
    expect(result.diagnostics?.idleTurns).toEqual([]);
  });
});

it('runs two real seeds in every encounter/variant/size cell within 30 seconds', () => {
  const started = performance.now();
  const report = runSoakReport(CONTENT, { trials: 2 });
  const runtimeMs = performance.now() - started;
  expect(report.rows).toHaveLength(48);
  expect(report.summary.attempted).toBe(96);
  expect(report.summary.completed).toBe(96);
  expect(report.failures).toEqual([]);
  expect(report.violations).toEqual([]);
  expect(report.summary.passed).toBe(true);
  expect(report.rows.every((row) => row.attempted === 2 && row.completed === 2)).toBe(true);
  expect(runtimeMs, `96-battle matrix took ${runtimeMs.toFixed(0)}ms`).toBeLessThanOrEqual(30_000);
}, 30_000);
