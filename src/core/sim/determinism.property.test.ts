import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { ENCOUNTERS } from '../../content/encounters';
import { RngCursor, seedFromString } from '../rng';
import type { Command, FlagValue, GameEvent, GameState } from '../types';
import { apply } from '../state/reducer';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import { resolveAim, usableAbilities, targetableTiles } from '../rules/abilities';
import { occupiedCells, posKey, reachable, type MoveContext } from '../rules/grid';
import { canMove, isAlive } from '../rules/stats';
import { deserialize, serialize, stateFromBlob } from '../save/serialize';

const COMMANDS_PER_SEQUENCE = 24;
const SEQUENCE_COUNT = 3;
const SAVE_META = {
  label: 'Determinism property test',
  summary: 'Seeded mid-battle replay',
  savedAt: 1_700_000_000_000,
  session: { players: [{ name: 'Test', unitId: 'p0' }], soloPlay: false },
};

function initialState(encounterId: string, seed: number): GameState {
  const flags: Record<string, FlagValue> =
    encounterId === 'enc_grumbler' ? { ruon_traded: true } : {};
  const seeded = createGame(CONTENT, {
    seed,
    party: [
      { characterId: 'kaya', autoChoose: true },
      { characterId: 'bo', autoChoose: true },
    ],
    startNode: '',
    flags,
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(CONTENT, seeded, encounterId, rng);
  return {
    ...seeded,
    screen: 'combat',
    rng: rng.state,
    battle: {
      ...battle,
      units: battle.units.map((unit) =>
        unit.faction === 'party' ? { ...unit, ai: 'none' } : unit,
      ),
    },
  };
}

function chooseCommand(state: GameState, chooser: RngCursor): Command {
  const battle = state.battle;
  if (!battle || battle.phase !== 'active')
    throw new Error('cannot choose outside an active battle');
  const unitId = battle.order[battle.turnIndex];
  const unit = battle.units.find((candidate) => candidate.id === unitId);
  if (!unit || !isAlive(unit) || unit.faction !== 'party') return { type: 'runAiTurn' };

  const choices: Command[][] = [[{ type: 'endTurn', unitId: unit.id }]];
  const chooserDraft = new BattleDraft(CONTENT, battle, new RngCursor(chooser.state));
  const moveContext: MoveContext = chooserDraft.moveContext(unit);
  if (unit.move > 0 && canMove(CONTENT, unit)) {
    const destinations = [...reachable(moveContext, unit.pos, unit.move).values()].filter(
      (cell) => cell.path.length > 0,
    );
    if (destinations.length > 0) {
      choices.push(
        destinations.map((destination) => ({
          type: 'move',
          unitId: unit.id,
          path: destination.path,
        })),
      );
    }
  }
  const abilityChoices: Command[] = [];
  for (const ability of usableAbilities(CONTENT, unit)) {
    const canonicalTargets = new Map<string, { x: number; y: number }>();
    for (const target of targetableTiles(CONTENT, battle, unit, ability)) {
      const aim = resolveAim(CONTENT, battle, unit, ability, target);
      canonicalTargets.set(posKey(aim), aim);
    }
    for (const target of canonicalTargets.values()) {
      abilityChoices.push({ type: 'useAbility', unitId: unit.id, abilityId: ability.id, target });
    }
  }
  if (abilityChoices.length > 0) choices.push(abilityChoices);
  const category = chooser.pick(choices);
  return chooser.pick(category);
}

function actorStamp(state: GameState): string {
  const battle = state.battle;
  const id = battle?.order[battle.turnIndex] ?? 'none';
  const unit = battle?.units.find((candidate) => candidate.id === id);
  return `${id}:${unit && isAlive(unit) ? 'alive' : 'dead'}`;
}

function runSequence(
  initial: GameState,
  commands: readonly Command[],
  expectedActors?: readonly string[],
): { state: GameState; events: GameEvent[] } {
  let state = initial;
  const events: GameEvent[] = [];
  for (const [index, command] of commands.entries()) {
    if (!state.battle || state.battle.phase !== 'active') break;
    const expectedActor = expectedActors?.[index];
    if (expectedActor && actorStamp(state) !== expectedActor) {
      throw new Error(
        `command ${index} actor diverged: expected ${expectedActor}, got ${actorStamp(state)}`,
      );
    }
    const before = state;
    const step = apply(CONTENT, state, command);
    const refusal = step.events.find((event) => event.type === 'message');
    if (refusal && step.state === before) {
      throw new Error(
        `generated command was refused: ${JSON.stringify(command)} (${refusal.text})`,
      );
    }
    if (step.events.length === 0 || step.state === before) {
      throw new Error(`generated command was a no-op: ${JSON.stringify(command)}`);
    }
    events.push(...step.events);
    state = step.state;
  }
  return { state, events };
}

function shortestFailingPrefix(
  initial: GameState,
  commands: readonly Command[],
  states: readonly GameState[],
  eventsByCommand: readonly (readonly GameEvent[])[],
  actors: readonly string[],
  checkpoint: number,
): string {
  for (let end = 1; end <= commands.length; end++) {
    try {
      const prefix = commands.slice(0, end);
      const replay = runSequence(initial, prefix, actors.slice(0, end));
      const replayAgain = runSequence(initial, prefix, actors.slice(0, end));
      const expectedEvents = eventsByCommand.slice(0, end).flat();
      expect(replay.events).toEqual(expectedEvents);
      expect(replay.state).toEqual(states[end]);
      expect(replayAgain.events).toEqual(expectedEvents);
      expect(replayAgain.state).toEqual(states[end]);
      if (end > checkpoint && checkpoint > 0) {
        const savedState = states[checkpoint];
        if (savedState?.battle?.phase !== 'active') continue;
        const encoded = serialize(savedState, SAVE_META);
        const loaded = deserialize(encoded);
        if (!loaded.ok) throw new Error(loaded.error);
        const resumed = runSequence(
          stateFromBlob(loaded.blob),
          prefix.slice(checkpoint),
          actors.slice(checkpoint, end),
        );
        const expectedWithSave = [
          ...eventsByCommand.slice(0, checkpoint).flat(),
          ...resumed.events,
        ];
        expect(expectedWithSave).toEqual(expectedEvents);
        expect(resumed.state).toEqual(states[end]);
      }
    } catch {
      return JSON.stringify(commands.slice(0, end));
    }
  }
  return JSON.stringify(commands);
}

describe('seeded legal-command determinism', () => {
  it.each(ENCOUNTERS.map(({ id }) => [id]))(
    'replays %s and resumes a mid-battle save',
    (encounterId) => {
      const seenCommands = new Set<Command['type']>();
      for (let sequence = 0; sequence < SEQUENCE_COUNT; sequence++) {
        const seed = seedFromString(`issue-463:${encounterId}:${sequence}`);
        const initial = initialState(encounterId, seed);
        const initialSnapshot = structuredClone(initial);
        if (encounterId === 'enc_grumbler') {
          const boss = initial.battle?.units.find((unit) => unit.enemyId === 'grumbler');
          expect(boss?.size, `seed ${seed} must spawn the size-2 Grumbler`).toBe(2);
          expect(
            boss ? occupiedCells(boss).length : 0,
            `seed ${seed} must occupy four boss cells`,
          ).toBe(4);
        }
        const chooser = new RngCursor(seedFromString(`commands:${encounterId}:${sequence}`));
        let recording = initial;
        const commands: Command[] = [];
        const recordedActors: string[] = [];
        const recordedStates: GameState[] = [initial];
        const eventsByCommand: GameEvent[][] = [];
        for (let index = 0; index < COMMANDS_PER_SEQUENCE; index++) {
          if (!recording.battle || recording.battle.phase !== 'active') break;
          recordedActors.push(actorStamp(recording));
          const command = chooseCommand(recording, chooser);
          commands.push(command);
          seenCommands.add(command.type);
          const step = apply(CONTENT, recording, command);
          const refusal = step.events.find((event) => event.type === 'message');
          if (
            (refusal && step.state === recording) ||
            step.events.length === 0 ||
            step.state === recording
          ) {
            throw new Error(
              `seed ${seed}: rejected/no-op after command prefix ${JSON.stringify(commands)} (${JSON.stringify(command)})`,
            );
          }
          eventsByCommand.push([...step.events]);
          recording = step.state;
          recordedStates.push(recording);
        }
        expect(initial, `seed ${seed} command selection must not mutate its initial state`).toEqual(
          initialSnapshot,
        );

        const checkpointRng = new RngCursor(
          seedFromString(`checkpoint:${encounterId}:${sequence}`),
        );
        const checkpoint = checkpointRng.int(2, Math.max(2, commands.length - 2));
        expect(
          commands.length,
          `seed ${seed} should leave recorded commands after its checkpoint`,
        ).toBeGreaterThanOrEqual(6);
        expect(
          checkpoint,
          `seed ${seed} must have commands remaining after its checkpoint`,
        ).toBeLessThan(commands.length);
        try {
          const recordedEvents = eventsByCommand.flat();
          const uninterrupted = runSequence(initial, commands, recordedActors);
          expect(uninterrupted.events).toEqual(recordedEvents);
          expect(uninterrupted.state).toEqual(recording);
          const replay = runSequence(initial, commands, recordedActors);
          expect(replay.events).toEqual(uninterrupted.events);
          expect(replay.state).toEqual(uninterrupted.state);

          const beforeSaveState = recordedStates[checkpoint];
          expect(
            beforeSaveState?.battle?.phase,
            `seed ${seed} checkpoint must be an active battle`,
          ).toBe('active');
          if (!beforeSaveState) throw new Error(`seed ${seed} missing recorded checkpoint`);
          const serialized = serialize(beforeSaveState, SAVE_META);
          const loaded = deserialize(serialized);
          expect(loaded.ok, `seed ${seed} checkpoint save should deserialize`).toBe(true);
          if (!loaded.ok) throw new Error(loaded.error);
          const resumed = runSequence(
            stateFromBlob(loaded.blob),
            commands.slice(checkpoint),
            recordedActors.slice(checkpoint),
          );
          expect([...eventsByCommand.slice(0, checkpoint).flat(), ...resumed.events]).toEqual(
            uninterrupted.events,
          );
          expect(resumed.state).toEqual(uninterrupted.state);
        } catch (error) {
          const prefix = shortestFailingPrefix(
            initial,
            commands,
            recordedStates,
            eventsByCommand,
            recordedActors,
            checkpoint,
          );
          throw new Error(`seed ${seed} failed; shortest failing command prefix: ${prefix}`, {
            cause: error,
          });
        }
      }
      for (const kind of ['move', 'useAbility', 'endTurn'] as const) {
        expect(seenCommands, `${encounterId} should exercise legal ${kind} commands`).toContain(
          kind,
        );
      }
    },
  );
});
