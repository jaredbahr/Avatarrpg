import { deepStrictEqual } from 'node:assert';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { backgroundFigures, exitCells, visibleNpcs } from '../story/world';
import { RngCursor, seedFromString } from '../rng';
import type { Command, GameState, MapDef, Vec2 } from '../types';
import { isValidTarget, resolveAim, targetableTiles, usableAbilities } from '../rules/abilities';
import { buildGrid, posKey, reachable, type MoveContext } from '../rules/grid';
import { isAlive, canMove } from '../rules/stats';
import { BattleDraft } from './battleDraft';
import { createGame } from './createGame';
import { apply } from './reducer';
import { disciplineUnlocked } from '../rules/leveling';
import { optionAvailable } from '../story/storyEngine';
import { STANDARD_PARTY } from '../sim/runCombat';

const TABLE_SIZES = [1, 2, 3, 4, 5, 6] as const;
const TRIALS_PER_SIZE = 34;
const MIN_ACCEPTED_COMMANDS = 50;
const MAX_DIALOGUE_COMMANDS = 80;

type PhaseCounts = {
  accepted: number;
  exploration: number;
  combat: number;
  dialogue: number;
  commands: Partial<Record<Command['type'], number>>;
  resolvedBattle: boolean;
  continuedExplore: boolean;
};

function pathPart(key: PropertyKey): string {
  return typeof key === 'symbol' ? `[${String(key)}]` : `.${String(key)}`;
}

/** Protects a cloned GameState graph, never CONTENT or caller-owned commands. */
function deepFreezeStateGraph<T>(value: T, path = '$', seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object') return value;
  const object = value as object;
  if (seen.has(object)) return value;
  seen.add(object);

  if (ArrayBuffer.isView(object) || object instanceof ArrayBuffer) {
    throw new TypeError(`Unsupported binary state value at ${path}`);
  }

  if (object instanceof Map) {
    for (const [key, entry] of object.entries()) {
      if (key !== null && typeof key === 'object') {
        deepFreezeStateGraph(key, `${path}<map-key>`, seen);
      }
      if (entry !== null && typeof entry === 'object') {
        deepFreezeStateGraph(entry, `${path}<map-value>`, seen);
      }
    }
    Object.defineProperties(object, {
      set: {
        configurable: false,
        enumerable: false,
        writable: false,
        value: () => {
          throw new TypeError(`Cannot mutate frozen Map at ${path}`);
        },
      },
      delete: {
        configurable: false,
        enumerable: false,
        writable: false,
        value: () => {
          throw new TypeError(`Cannot mutate frozen Map at ${path}`);
        },
      },
      clear: {
        configurable: false,
        enumerable: false,
        writable: false,
        value: () => {
          throw new TypeError(`Cannot mutate frozen Map at ${path}`);
        },
      },
    });
  } else if (object instanceof Set) {
    for (const entry of object.values()) {
      if (entry !== null && typeof entry === 'object') {
        deepFreezeStateGraph(entry, `${path}<set-value>`, seen);
      }
    }
    Object.defineProperties(object, {
      add: {
        configurable: false,
        enumerable: false,
        writable: false,
        value: () => {
          throw new TypeError(`Cannot mutate frozen Set at ${path}`);
        },
      },
      delete: {
        configurable: false,
        enumerable: false,
        writable: false,
        value: () => {
          throw new TypeError(`Cannot mutate frozen Set at ${path}`);
        },
      },
      clear: {
        configurable: false,
        enumerable: false,
        writable: false,
        value: () => {
          throw new TypeError(`Cannot mutate frozen Set at ${path}`);
        },
      },
    });
  } else {
    for (const key of Reflect.ownKeys(object)) {
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      if (descriptor && 'value' in descriptor) {
        const child = descriptor.value;
        if (child !== null && typeof child === 'object') {
          deepFreezeStateGraph(child, `${path}${pathPart(key)}`, seen);
        }
      }
    }
  }

  Object.freeze(object);
  return value;
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function assertInputUnchanged(actual: unknown, before: unknown, context: string): void {
  try {
    deepStrictEqual(actual, before);
  } catch (error) {
    throw new Error(`${context}: input differs from its pre-call snapshot`, { cause: error });
  }
}

function hasEventType(result: ReturnType<typeof apply>, types: readonly string[]): boolean {
  return result.events.some((event) => types.includes(event.type));
}

function assertSemanticAcceptance(
  before: GameState,
  command: Command,
  result: ReturnType<typeof apply>,
  context: string,
): void {
  const messageOnly =
    result.events.length > 0 && result.events.every((event) => event.type === 'message');
  if (messageOnly && command.type !== 'chooseLevelUp') {
    throw new Error(`${context}: reducer returned only a refusal/message for ${command.type}`);
  }

  let accepted = false;
  switch (command.type) {
    case 'enterNode':
    case 'chooseOption':
      accepted = hasEventType(result, ['storyNodeEntered']);
      break;
    case 'advanceDialogue':
      accepted = hasEventType(result, ['dialogueAdvanced', 'storyNodeEntered']);
      break;
    case 'walkTo':
      accepted = hasEventType(result, ['partyWalked']);
      break;
    case 'move':
      accepted = hasEventType(result, ['unitMoved']);
      break;
    case 'useAbility':
      accepted = hasEventType(result, ['abilityUsed']);
      break;
    case 'endTurn':
      accepted = hasEventType(result, ['turnEnded']);
      break;
    case 'runAiTurn':
      accepted =
        hasEventType(result, ['turnEnded', 'turnStarted', 'roundStarted', 'battleEnded']) &&
        (before.battle?.round !== result.state.battle?.round ||
          before.battle?.turnIndex !== result.state.battle?.turnIndex ||
          before.battle?.phase !== result.state.battle?.phase);
      break;
    case 'resolveBattle':
      accepted =
        result.state.battle === null &&
        hasEventType(result, ['storyNodeEntered', 'screenChanged', 'xpGained']);
      break;
    case 'chooseLevelUp':
      accepted =
        result.state.party.some(
          (unit) => unit.id === command.unitId && unit.abilities.includes(command.abilityId),
        ) && before.pendingChoices.length === result.state.pendingChoices.length + 1;
      break;
    case 'chooseDiscipline':
      accepted = hasEventType(result, ['disciplineChosen']);
      break;
    case 'startBattle':
      accepted = hasEventType(result, ['battleStarted']);
      break;
    case 'setFlags':
      accepted = hasEventType(result, ['flagSet']);
      break;
    case 'wait':
      accepted = hasEventType(result, ['phaseChanged']);
      break;
    case 'setDifficulty':
      accepted = result.state.difficulty === command.difficulty;
      break;
  }
  if (!accepted) {
    throw new Error(`${context}: no semantic acceptance proof for ${JSON.stringify(command)}`);
  }
}

/** Call the real reducer on an isolated frozen input and always check its input afterward. */
function applyWithoutMutation(
  state: GameState,
  command: Command,
  context: string,
): ReturnType<typeof apply> {
  const protectedInput = structuredClone(state);
  const before = structuredClone(protectedInput);
  deepFreezeStateGraph(protectedInput);

  let result: ReturnType<typeof apply> | undefined;
  let thrown: unknown;
  try {
    result = apply(CONTENT, protectedInput, command);
  } catch (error) {
    thrown = error;
  }

  assertInputUnchanged(protectedInput, before, context);
  if (thrown !== undefined) {
    throw new Error(`${context}: apply threw for a legal command: ${describeError(thrown)}`, {
      cause: thrown,
    });
  }
  if (!result) throw new Error(`${context}: apply returned no result`);
  expect(result.state, `${context}: accepted command must change state`).not.toEqual(before);
  assertSemanticAcceptance(state, command, result, context);
  return result;
}

function applyAndCount(
  state: GameState,
  command: Command,
  context: string,
  counts: PhaseCounts,
): ReturnType<typeof apply> {
  const result = applyWithoutMutation(state, command, context);
  counts.accepted++;
  counts.commands[command.type] = (counts.commands[command.type] ?? 0) + 1;
  return result;
}

function chooseBattleCommand(state: GameState, chooser: RngCursor): Command {
  const battle = state.battle;
  if (!battle || battle.phase !== 'active') throw new Error('Expected an active battle');
  const unitId = battle.order[battle.turnIndex];
  const unit = battle.units.find((candidate) => candidate.id === unitId);
  if (!unit || !isAlive(unit) || unit.faction !== 'party') return { type: 'runAiTurn' };

  const categories: Command[][] = [[{ type: 'endTurn', unitId: unit.id }]];
  const draft = new BattleDraft(CONTENT, battle, new RngCursor(chooser.state));
  const moveContext: MoveContext = draft.moveContext(unit);
  if (unit.move > 0 && canMove(CONTENT, unit)) {
    const moves = [...reachable(moveContext, unit.pos, unit.move).values()]
      .filter((destination) => destination.path.length > 0)
      .map((destination) => ({
        type: 'move' as const,
        unitId: unit.id,
        path: destination.path,
      }));
    if (moves.length > 0) categories.push(moves);
  }

  const abilities: Command[] = [];
  for (const ability of usableAbilities(CONTENT, unit)) {
    const targets = new Map<string, Vec2>();
    for (const tapped of targetableTiles(CONTENT, battle, unit, ability)) {
      const target = resolveAim(CONTENT, battle, unit, ability, tapped);
      if (!isValidTarget(CONTENT, battle, unit, ability, target).ok) continue;
      targets.set(posKey(target), target);
    }
    for (const target of targets.values()) {
      abilities.push({ type: 'useAbility', unitId: unit.id, abilityId: ability.id, target });
    }
  }
  if (abilities.length > 0) categories.push(abilities);

  const category = chooser.pick(categories);
  return chooser.pick(category);
}

function advanceStory(state: GameState, context: string, counts: PhaseCounts): GameState {
  for (let guard = 0; guard < MAX_DIALOGUE_COMMANDS; guard++) {
    if (state.pendingChoices.length > 0) {
      const choice = state.pendingChoices[0];
      if (!choice) throw new Error(`${context}: missing pending choice`);
      let command: Command;
      if (choice.kind === 'ability') {
        const abilityId = choice.options[0];
        if (!abilityId) throw new Error(`${context}: empty pending ability choice`);
        command = { type: 'chooseLevelUp', unitId: choice.unitId, abilityId };
      } else {
        const disciplineId = choice.options.find((id) => {
          const discipline = CONTENT.disciplines.get(id);
          return discipline !== undefined && disciplineUnlocked(discipline, state.flags);
        });
        if (!disciplineId) throw new Error(`${context}: no unlocked pending discipline option`);
        command = { type: 'chooseDiscipline', unitId: choice.unitId, disciplineId };
      }
      const step = applyAndCount(state, command, context, counts);
      state = step.state;
      counts.dialogue++;
      continue;
    }

    if (state.screen !== 'dialogue') return state;
    const node = CONTENT.story.get(state.story.nodeId ?? '');
    let command: Command = { type: 'advanceDialogue' };
    if (node?.kind === 'choice') {
      const optionIndex = node.options.findIndex((option) => optionAvailable(state, option));
      if (optionIndex < 0) throw new Error(`${context}: story choice has no available option`);
      command = { type: 'chooseOption', optionIndex };
    }
    const step = applyAndCount(state, command, context, counts);
    state = step.state;
    counts.dialogue++;
  }
  throw new Error(
    `${context}: dialogue or pending choice exceeded ${MAX_DIALOGUE_COMMANDS} commands`,
  );
}

function explorationContext(state: GameState, map: MapDef): MoveContext {
  const blocked = new Set<string>(
    [...visibleNpcs(CONTENT, map, state), ...backgroundFigures(CONTENT, map, state)].map((who) =>
      posKey(who.pos),
    ),
  );
  for (const trigger of map.triggers ?? []) {
    for (const pos of trigger.area) blocked.add(posKey(pos));
  }
  for (const exit of map.exits ?? []) {
    for (const pos of exitCells(exit)) blocked.add(posKey(pos));
  }
  if (map.exit) blocked.add(posKey(map.exit.pos));
  return {
    grid: buildGrid(map),
    blocked,
    surfaces: CONTENT.surfaces,
    size: 1,
    climbCost: CONTENT.tuning.climbCost,
  };
}

function walkToSeededSafeCell(
  state: GameState,
  chooser: RngCursor,
  context: string,
  counts: PhaseCounts,
): GameState {
  if (state.screen !== 'explore') throw new Error(`${context}: expected exploration after battle`);
  const map = CONTENT.maps.get(state.location.mapId);
  if (!map) throw new Error(`${context}: no exploration map loaded`);
  const moveContext = explorationContext(state, map);
  const destinations = [
    ...reachable(
      moveContext,
      state.location.pos,
      moveContext.grid.width * moveContext.grid.height,
    ).values(),
  ].filter((cell) => cell.path.length > 0);
  if (destinations.length === 0) {
    throw new Error(
      `${context}: no legal safe exploration destination from ${posKey(state.location.pos)}`,
    );
  }
  const destination = chooser.pick(destinations);
  const step = applyAndCount(state, { type: 'walkTo', pos: destination.pos }, context, counts);
  expect(
    step.events.some((event) => event.type === 'partyWalked'),
    `${context}: walk must move`,
  ).toBe(true);
  counts.exploration++;
  return step.state;
}

function runSequence(tableSize: (typeof TABLE_SIZES)[number], trial: number): PhaseCounts {
  const seedLabel = `issue-482:table-${tableSize}:trial-${trial}`;
  const seed = seedFromString(seedLabel);
  const chooser = new RngCursor(seedFromString(`${seedLabel}:commands`));
  const counts: PhaseCounts = {
    accepted: 0,
    exploration: 0,
    combat: 0,
    dialogue: 0,
    commands: {},
    resolvedBattle: false,
    continuedExplore: false,
  };
  const context = `seed=${seedLabel}, party=${tableSize}`;

  let state = createGame(CONTENT, {
    seed,
    party: STANDARD_PARTY.slice(0, tableSize).map((slot) => ({ ...slot, autoChoose: true })),
    startNode: 'village_explore',
  });
  const enter = applyAndCount(
    state,
    { type: 'enterNode', nodeId: 'village_explore' },
    context,
    counts,
  );
  state = enter.state;
  counts.exploration++;

  const leaveVillage = applyAndCount(
    state,
    { type: 'walkTo', pos: { x: 23, y: 7 } },
    context,
    counts,
  );
  state = leaveVillage.state;
  counts.exploration++;
  expect(state.location.mapId, `${context}: route should reach Forest Road`).toBe('forest_road');

  state = applyAndCount(state, { type: 'walkTo', pos: { x: 19, y: 4 } }, context, counts).state;
  counts.exploration++;
  state = advanceStory(state, context, counts);
  expect(state.screen, `${context}: road introduction should return to exploration`).toBe(
    'explore',
  );

  state = applyAndCount(state, { type: 'walkTo', pos: { x: 19, y: 4 } }, context, counts).state;
  counts.exploration++;
  expect(state.battle?.encounterId, `${context}: real story trigger should start the ambush`).toBe(
    'enc_forest_road',
  );

  let combatSteps = 0;
  while (state.battle?.phase === 'active' && counts.accepted < MIN_ACCEPTED_COMMANDS) {
    const command = chooseBattleCommand(state, chooser);
    const step = applyAndCount(state, command, `${context}, combat-step=${combatSteps}`, counts);
    state = step.state;
    counts.combat++;
    combatSteps++;
  }
  expect(combatSteps, `${context}: battle must exercise actual combat commands`).toBeGreaterThan(0);

  if (state.battle?.phase === 'active') {
    expect(
      counts.accepted,
      `${context}: an active battle may stop only after meeting the quota`,
    ).toBeGreaterThanOrEqual(MIN_ACCEPTED_COMMANDS);
  } else {
    expect(
      state.battle?.phase,
      `${context}: battle should reach victory or defeat`,
    ).not.toBeUndefined();
    const resolved = applyAndCount(state, { type: 'resolveBattle' }, context, counts);
    state = resolved.state;
    counts.combat++;
    counts.resolvedBattle = true;
    state = advanceStory(state, context, counts);
    expect(state.screen, `${context}: battle result should return to exploration`).toBe('explore');
  }

  let roamSteps = 0;
  while (
    counts.accepted < MIN_ACCEPTED_COMMANDS &&
    counts.resolvedBattle &&
    roamSteps < MIN_ACCEPTED_COMMANDS
  ) {
    state = walkToSeededSafeCell(state, chooser, `${context}, roam-step=${roamSteps}`, counts);
    counts.continuedExplore = counts.resolvedBattle;
    roamSteps++;
  }
  if (counts.resolvedBattle && !counts.continuedExplore) {
    state = walkToSeededSafeCell(state, chooser, `${context}, post-resolution-walk`, counts);
    counts.continuedExplore = true;
  }
  expect(counts.accepted, `${context}: accepted command quota`).toBeGreaterThanOrEqual(
    MIN_ACCEPTED_COMMANDS,
  );
  expect(counts.exploration, `${context}: exploration commands`).toBeGreaterThan(0);
  expect(counts.combat, `${context}: combat commands`).toBeGreaterThan(0);
  return counts;
}

describe('reducer input immutability', () => {
  it('preserves every frozen state across mixed exploration and combat sequences', () => {
    const startedAt = performance.now();
    let sequenceCount = 0;
    let acceptedCount = 0;
    let resolvedBattleCount = 0;
    let continuedExploreCount = 0;
    for (const tableSize of TABLE_SIZES) {
      const tableCommands: Partial<Record<Command['type'], number>> = {};
      for (let trial = 0; trial < TRIALS_PER_SIZE; trial++) {
        const counts = runSequence(tableSize, trial);
        expect(counts.accepted, `table=${tableSize} trial=${trial}`).toBeGreaterThanOrEqual(
          MIN_ACCEPTED_COMMANDS,
        );
        acceptedCount += counts.accepted;
        for (const [type, count] of Object.entries(counts.commands)) {
          const commandType = type as Command['type'];
          tableCommands[commandType] = (tableCommands[commandType] ?? 0) + (count ?? 0);
        }
        if (counts.resolvedBattle) resolvedBattleCount++;
        if (counts.continuedExplore) continuedExploreCount++;
        sequenceCount++;
      }
      for (const family of ['walkTo', 'move', 'useAbility', 'endTurn', 'runAiTurn'] as const) {
        expect(
          tableCommands[family],
          `party=${tableSize}: command family ${family}`,
        ).toBeGreaterThan(0);
      }
    }
    expect(sequenceCount).toBe(204);
    expect(acceptedCount).toBeGreaterThanOrEqual(204 * MIN_ACCEPTED_COMMANDS);
    expect(resolvedBattleCount, 'corpus includes naturally completed battles').toBeGreaterThan(0);
    expect(
      continuedExploreCount,
      'corpus includes post-resolution exploration walks',
    ).toBeGreaterThan(0);
    expect(
      performance.now() - startedAt,
      'the full 204-sequence property must complete in under 20 seconds',
    ).toBeLessThan(20_000);
  }, 20_000);

  it('guards nested objects, arrays, Maps, Sets, and their contents', () => {
    const key = { id: 'nested-key' };
    const member = { value: 1 };
    const state = {
      nested: [{ count: 1 }],
      lookup: new Map([[key, member]]),
      tags: new Set([{ label: 'kept' }]),
    };
    deepFreezeStateGraph(state);

    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.nested)).toBe(true);
    const firstNested = state.nested[0];
    if (!firstNested) throw new Error('Expected a frozen nested array member');
    expect(Object.isFrozen(firstNested)).toBe(true);
    expect(Object.isFrozen(key)).toBe(true);
    expect(Object.isFrozen(member)).toBe(true);
    expect([...state.tags].every((entry) => Object.isFrozen(entry))).toBe(true);
    expect(() => {
      key.id = 'changed';
    }).toThrow(TypeError);
    expect(() => {
      member.value = 2;
    }).toThrow(TypeError);
    expect(() => state.lookup.set(key, { value: 2 })).toThrow(TypeError);
    expect(() => state.lookup.delete(key)).toThrow(TypeError);
    expect(() => state.lookup.clear()).toThrow(TypeError);
    expect(() => state.tags.add({ label: 'new' })).toThrow(TypeError);
    const firstTag = [...state.tags][0];
    if (!firstTag) throw new Error('Expected a frozen Set member');
    expect(() => {
      firstTag.label = 'changed';
    }).toThrow(TypeError);
    expect(() => state.tags.delete(firstTag)).toThrow(TypeError);
    expect(() => state.tags.clear()).toThrow(TypeError);
    expect(() => {
      firstNested.count = 2;
    }).toThrow(TypeError);
  });

  it('uses the structural oracle to catch an intrinsic Map.set bypass', () => {
    const context = 'intrinsic Map.set bypass';
    const state = { lookup: new Map([['key', { value: 1 }]]) };
    const before = structuredClone(state);
    deepFreezeStateGraph(state);
    assertInputUnchanged(state, before, context);

    Map.prototype.set.call(state.lookup, 'bypassed', { value: 2 });

    expect(() => assertInputUnchanged(state, before, context)).toThrow(
      `${context}: input differs from its pre-call snapshot`,
    );
  });

  it('uses the structural oracle to catch an intrinsic Set.add bypass', () => {
    const context = 'intrinsic Set.add bypass';
    const state = { tags: new Set([{ label: 'original' }]) };
    const before = structuredClone(state);
    deepFreezeStateGraph(state);
    assertInputUnchanged(state, before, context);

    Set.prototype.add.call(state.tags, { label: 'bypassed' });

    expect(() => assertInputUnchanged(state, before, context)).toThrow(
      `${context}: input differs from its pre-call snapshot`,
    );
  });

  it('rejects unsupported binary views with their graph path', () => {
    const fixtures = [
      {
        label: 'nested object',
        value: { nested: { bytes: new Uint8Array([1, 2]) } },
        path: '$.nested.bytes',
      },
      {
        label: 'array member object',
        value: [{ bytes: new Uint8Array([1, 2]) }],
        path: '$.0.bytes',
      },
      {
        label: 'Map key object',
        value: new Map([[{ bytes: new Uint8Array([1, 2]) }, 'value']]),
        path: '$<map-key>.bytes',
      },
      {
        label: 'Map value object',
        value: new Map([['key', { bytes: new Uint8Array([1, 2]) }]]),
        path: '$<map-value>.bytes',
      },
      {
        label: 'Set value object',
        value: new Set([{ bytes: new Uint8Array([1, 2]) }]),
        path: '$<set-value>.bytes',
      },
    ] as const;

    for (const fixture of fixtures) {
      let thrown: unknown;
      try {
        deepFreezeStateGraph(fixture.value);
      } catch (error) {
        thrown = error;
      }
      expect(thrown, fixture.label).toBeInstanceOf(TypeError);
      expect(thrown, fixture.label).toMatchObject({
        message: `Unsupported binary state value at ${fixture.path}`,
      });
    }
  });
});
