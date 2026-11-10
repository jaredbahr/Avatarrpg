/**
 * Seeded corrupt-save corpus. Keep the seed and case labels in failures so a
 * failing mutation can be replayed without a random search. The budget covers
 * fixture creation, all mutations, loading, reconciliation and reducer steps.
 */
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor, seedFromString } from '../rng';
import { DIRECTIONS } from '../rules/grid';
import { isAlive } from '../rules/stats';
import { activeUnit } from '../rules/turnOrder';
import { createBattle, createGame } from '../state/createGame';
import { apply } from '../state/reducer';
import { currentNode } from '../story/storyEngine';
import type { GameState, StepResult } from '../types';
import { reconcileBattleResult, reconcileDisciplines, reconcileWorld } from './reconcile';
import { deserialize, SAVE_FORMAT_VERSION, serialize, stateFromBlob } from './serialize';

const SEED = 'save-fuzz-485-v1';
const SAMPLES = 32;
const BUDGET_MS = 20_000;
type Raw = Record<string, unknown>;

interface Fixture {
  readonly name: string;
  readonly state: GameState;
  readonly json: string;
}

interface Mutation {
  readonly name: string;
  readonly mutate: (blob: Raw, rng: RngCursor) => string;
  /** These mutations retain a valid save shape, so rejecting everything fails. */
  readonly mustAccept?: boolean;
}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function object(value: unknown): Raw {
  ensure(typeof value === 'object' && value !== null && !Array.isArray(value), 'fixture object');
  return value as Raw;
}

function array(value: unknown): unknown[] {
  ensure(Array.isArray(value), 'fixture array');
  return value;
}

/** Keep the saved party member and its live battle copy consistent. */
function firstMemberCopies(blob: Raw): Raw[] {
  const state = object(blob.state);
  const member = object(array(state.party)[0]);
  const battle = state.battle;
  return [
    member,
    ...(battle === null
      ? []
      : array(object(battle).units)
          .map(object)
          .filter((unit) => unit.id === member.id)),
  ];
}

function edit(change: (blob: Raw, rng: RngCursor) => void): Mutation['mutate'] {
  return (blob, rng) => {
    change(blob, rng);
    return JSON.stringify(blob);
  };
}

function hostileKey(key: '__proto__' | 'constructor'): Mutation['mutate'] {
  return edit((blob, rng) => {
    // Unknown root keys exercise stripping; nested record keys exercise the
    // validator. defineProperty creates an own JSON key without polluting the
    // test's own prototype before the loader even sees it.
    const target = rng.int(0, 1) === 0 ? blob : object(object(blob.state).flags);
    Object.defineProperty(target, key, {
      enumerable: true,
      value: key === '__proto__' ? { polluted: true } : { prototype: { polluted: true } },
    });
  });
}

const MUTATIONS: readonly Mutation[] = [
  {
    name: 'truncate',
    mutate: (blob, rng) => {
      const json = JSON.stringify(blob);
      return json.slice(0, rng.int(0, json.length - 1));
    },
  },
  {
    name: 'flip-key',
    mutate: edit((blob) => {
      blob.summarY = blob.summary;
      delete blob.summary;
    }),
  },
  {
    name: 'delete-key',
    mutate: edit((blob) => {
      delete object(blob.state).flags;
    }),
  },
  {
    name: 'duplicate-key',
    mustAccept: true,
    mutate: (blob, rng) => {
      const json = JSON.stringify(blob);
      // Produce real duplicate JSON keys, rather than overwriting an object
      // property before serializing it. JSON.parse uses the last string.
      return `${json.slice(0, -1)},"summary":"duplicate-${rng.int(0, 1_000_000)}"}`;
    },
  },
  {
    name: 'wrong-string-type',
    mutate: edit((blob, rng) => {
      blob.label = rng.int(-100, 100);
    }),
  },
  {
    name: 'wrong-array-type',
    mutate: edit((blob) => {
      object(blob.state).party = { first: 'not an array' };
    }),
  },
  {
    name: 'huge-array',
    mutate: edit((blob, rng) => {
      // Large enough to exercise array traversal and later log use, with a
      // fixed upper bound so the fuzz test cannot exhaust the process.
      object(blob.state).log = Array.from(
        { length: rng.int(2_048, 4_096) },
        (_, index) => `saved log entry ${index}`,
      );
    }),
  },
  { name: '__proto__', mutate: hostileKey('__proto__') },
  { name: 'constructor', mutate: hostileKey('constructor') },
  {
    name: 'NaN-like-string',
    mutate: edit((blob, rng) => {
      const values = ['NaN', 'Infinity', '-Infinity', '1e309'];
      for (const member of firstMemberCopies(blob)) member.hp = values[rng.int(0, 3)];
    }),
  },
  {
    name: 'negative-hp',
    mutate: edit((blob, rng) => {
      const hp = -rng.int(1, 100);
      for (const member of firstMemberCopies(blob)) member.hp = hp;
    }),
  },
  {
    name: 'out-of-bounds-position',
    mutate: edit((blob, rng) => {
      const state = object(blob.state);
      const pos = { x: rng.int(100_000, 200_000), y: -rng.int(100_000, 200_000) };
      if (state.battle === null) object(state.location).pos = pos;
      else for (const member of firstMemberCopies(blob)) member.pos = pos;
    }),
  },
  {
    name: 'unknown-ability',
    mutate: edit((blob, rng) => {
      const id = `missing-fuzz-ability-${rng.int(0, 1_000_000)}`;
      for (const member of firstMemberCopies(blob))
        member.abilities = [...array(member.abilities), id];
    }),
  },
  {
    name: 'unknown-character',
    mutate: edit((blob, rng) => {
      const id = `missing-fuzz-character-${rng.int(0, 1_000_000)}`;
      for (const member of firstMemberCopies(blob)) member.characterId = id;
    }),
  },
  {
    name: 'future-format',
    mutate: edit((blob, rng) => {
      blob.format = SAVE_FORMAT_VERSION + rng.int(1, 100);
    }),
  },
  {
    name: 'valid-player-name',
    mustAccept: true,
    mutate: edit((blob, rng) => {
      const name = `Saved player ${rng.int(0, 1_000_000)}`;
      for (const member of firstMemberCopies(blob)) member.name = name;
    }),
  },
];

function assertActivePointer(state: GameState): void {
  const battle = state.battle;
  if (!battle || battle.phase !== 'active') return;
  ensure(
    Number.isInteger(battle.turnIndex) &&
      battle.turnIndex >= 0 &&
      battle.turnIndex < battle.order.length,
    `active turn cursor ${battle.turnIndex} is outside its ${battle.order.length} slots`,
  );
  const actor = activeUnit(battle);
  ensure(actor && isAlive(actor), 'active battle has no living actor after reconciliation');
}

/** A changed reference alone is insufficient: require the command's real event. */
function legalStep(state: GameState): StepResult {
  const battle = state.battle;
  if (battle) {
    if (battle.phase !== 'active') {
      const step = apply(CONTENT, state, { type: 'resolveBattle' });
      ensure(step.state.battle === null, 'completed battle did not resolve');
      return step;
    }
    assertActivePointer(state);
    const actor = activeUnit(battle);
    ensure(actor, 'missing actor');
    const step = apply(CONTENT, state, { type: 'endTurn', unitId: actor.id });
    ensure(
      step.events.some((event) => event.type === 'turnEnded' && event.unitId === actor.id),
      'endTurn was refused or did not end the actual actor turn',
    );
    ensure(step.state !== state, 'endTurn made no transition');
    return step;
  }

  if (state.screen === 'explore') {
    for (const delta of DIRECTIONS) {
      const step = apply(CONTENT, state, {
        type: 'walkTo',
        pos: { x: state.location.pos.x + delta.x, y: state.location.pos.y + delta.y },
      });
      if (!step.events.some((event) => event.type === 'partyWalked' && event.path.length > 0))
        continue;
      ensure(step.state !== state, 'walkTo made no transition');
      return step;
    }
    throw new Error('loaded explorer has no legal adjacent walk');
  }

  ensure(currentNode(CONTENT, state)?.kind === 'dialogue', 'fixture has no legal dialogue action');
  const step = apply(CONTENT, state, { type: 'advanceDialogue' });
  ensure(
    step.events.some(
      (event) => event.type === 'dialogueAdvanced' || event.type === 'storyNodeEntered',
    ),
    'advanceDialogue was a no-op',
  );
  ensure(step.state !== state, 'advanceDialogue made no transition');
  return step;
}

function fixtures(sample: number): Fixture[] {
  const fresh = createGame(CONTENT, {
    seed: `${SEED}/${sample}/fresh`,
    party: [{ characterId: 'kaya' }, { characterId: 'bo' }],
    startNode: 'act1_open',
  });
  const entered = apply(CONTENT, fresh, { type: 'enterNode', nodeId: 'village_explore' }).state;
  const exploring = legalStep(entered).state;

  // Vary the seed of serialize.test.ts's real three-turn quarry-gate setup,
  // so every sample generates its own initiative, actions and carried state.
  const seeded = createGame(CONTENT, {
    seed: `${SEED}/${sample}/mid-battle`,
    party: [
      { characterId: 'kaya', level: 2, autoChoose: true },
      { characterId: 'bo', level: 2, autoChoose: true },
    ],
    startNode: 'battle_quarry_gate',
    flags: { ruon_spared: true, act1_scouted: 3, quarry_password: 'lotus' },
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, 'enc_quarry_gate', rng);
  let fighting: GameState = {
    ...seeded,
    screen: 'combat',
    rng: rng.state,
    battle: {
      ...battle,
      units: battle.units.map((unit) =>
        unit.faction === 'party' ? { ...unit, ai: 'aggressive' } : unit,
      ),
    },
  };
  for (let turn = 0; turn < 3 && fighting.battle?.phase === 'active'; turn++) {
    fighting = apply(CONTENT, fighting, { type: 'runAiTurn' }).state;
  }
  ensure(fighting.battle?.phase === 'active', 'round-trip fixture is not mid-battle');

  // Reuse continuity.test.ts's post-Driller homeward setup, not a claimed
  // simulated victory. Enter its authored explore node through the reducer.
  const homeward = createGame(CONTENT, {
    seed: `${SEED}/${sample}/post-Driller`,
    party: [
      { characterId: 'wen', level: 3 },
      { characterId: 'kaya', level: 3 },
    ],
    startNode: 'village_explore',
    flags: { act1_complete: true, ruon_spared: true },
  });
  const afterDriller = apply(CONTENT, homeward, {
    type: 'enterNode',
    nodeId: 'quarry_after_explore',
  }).state;

  const states: readonly (readonly [string, GameState])[] = [
    ['fresh', fresh],
    ['mid-exploration', exploring],
    ['mid-battle', fighting],
    ['post-Driller-continuity-fixture', afterDriller],
  ];
  return states.map(([name, state]) => ({
    name,
    state,
    json: serialize(state, {
      label: 'Fuzz slot',
      summary: 'Seeded save fixture',
      savedAt: 1_700_000_000_000,
      session: { players: state.party.map((unit) => ({ name: unit.name, unitId: unit.id })) },
    }),
  }));
}

function checkLoaded(json: string, mustAccept: boolean): boolean {
  const result = deserialize(json);
  if (!result.ok) {
    ensure(!mustAccept, `valid save rejected: ${result.error}`);
    return false;
  }
  // Match App.adoptSave, including the detailed battle repair before the
  // discipline/world reconciliation (which must remain safe on its own too).
  const battle = reconcileBattleResult(CONTENT, stateFromBlob(result.blob));
  const loaded = reconcileWorld(CONTENT, reconcileDisciplines(CONTENT, battle.state));
  assertActivePointer(loaded);
  const stepped = legalStep(loaded);
  assertActivePointer(stepped.state);
  return true;
}

describe('seeded save corruption', () => {
  it(
    'checks 2080 mutations and usable valid saves within 20 seconds',
    () => {
      const started = performance.now();
      const failures: string[] = [];
      const seen = new Map<string, number>();
      const distinctPayloads = new Set<string>();
      let failureCount = 0;
      let mutations = 0;
      let accepted = 0;

      const run = (label: string, check: () => void): void => {
        try {
          check();
          ensure(({} as Raw).polluted === undefined, 'Object.prototype was polluted');
        } catch (error) {
          failureCount++;
          if (failures.length < 12)
            failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
        }
      };

      ensure(({} as Raw).polluted === undefined, 'pollution predates the corpus');
      for (let sample = 0; sample < SAMPLES; sample++) {
        for (const fixture of fixtures(sample)) {
          run(`${SEED}/${fixture.name}/${sample}/unmodified-control`, () => {
            const control = deserialize(fixture.json);
            ensure(control.ok, 'real fixture was rejected');
            expect(stateFromBlob(control.blob)).toEqual(fixture.state);
            ensure(checkLoaded(fixture.json, true), 'control did not load');
          });

          for (const mutation of MUTATIONS) {
            const label = `${SEED}/${fixture.name}/${mutation.name}/${sample}`;
            const seed = seedFromString(label);
            mutations++;
            seen.set(mutation.name, (seen.get(mutation.name) ?? 0) + 1);
            run(`${label} seed=${seed}`, () => {
              const json = mutation.mutate(object(JSON.parse(fixture.json)), new RngCursor(seed));
              ensure(json !== fixture.json, 'mutation did not change the input');
              // Count the exact input before loading, including cases which
              // later throw or violate an invariant. This cannot hide repeats.
              distinctPayloads.add(createHash('sha256').update(json).digest('hex'));
              if (checkLoaded(json, mutation.mustAccept === true)) accepted++;
            });
          }

          if (fixture.state.battle) {
            // Extra battle-only cases avoid inventing a battle in the other
            // fixtures or counting a mutation of an unused field as coverage.
            const label = `${SEED}/${fixture.name}/invalid-active-cursor/${sample}`;
            const seed = seedFromString(label);
            mutations++;
            seen.set('invalid-active-cursor', (seen.get('invalid-active-cursor') ?? 0) + 1);
            run(`${label} seed=${seed}`, () => {
              const blob = object(JSON.parse(fixture.json));
              const battle = object(object(blob.state).battle);
              const count = array(battle.order).length;
              const values = [0.5, -1, count, count + 1, 2 ** 31, '0', null];
              battle.turnIndex = values[sample % values.length];
              const json = JSON.stringify(blob);
              distinctPayloads.add(createHash('sha256').update(json).digest('hex'));
              if (checkLoaded(json, false)) accepted++;
            });
          }
        }
      }

      const elapsed = performance.now() - started;
      expect(elapsed, `complete ${mutations}-mutation workload, seed=${SEED}`).toBeLessThan(
        BUDGET_MS,
      );
      expect(mutations).toBe(2_080);
      expect(
        distinctPayloads.size,
        'at least 2000 distinct mutated inputs, not repeated cases',
      ).toBeGreaterThanOrEqual(2_000);
      for (const mutation of MUTATIONS) expect(seen.get(mutation.name), mutation.name).toBe(128);
      expect(seen.get('invalid-active-cursor')).toBe(32);
      expect(
        accepted,
        'valid name/duplicate-key mutations must reach real reducer commands',
      ).toBeGreaterThanOrEqual(256);
      expect(failureCount, failures.join('\n')).toBe(0);
      expect(({} as Raw).polluted).toBeUndefined();
    },
    BUDGET_MS,
  );
});
