/**
 * Objective win conditions and round limits (ADR 0116's 2026-11-15 amendment).
 *
 * A test-only copy of the Forest Road with a placeholder objective: hold a road
 * cell at the end of a round to win, or lose when the round limit passes. The
 * bandits start far off on the east side, so nothing reaches the party in the
 * first rounds and each rule can be read on its own. No story text.
 */

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor } from '../rng';
import { isTableControlled } from '../rules/guests';
import {
  objectiveHolder,
  outOfRounds,
  roundEndOutcome,
  roundsLeft,
  standsOnObjective,
} from '../rules/objectives';
import { battleOutcome } from '../rules/turnOrder';
import { runCombat } from '../sim/runCombat';
import type {
  BattleState,
  Command,
  ContentIndex,
  EncounterDef,
  GameEvent,
  GameState,
  Unit,
  Vec2,
} from '../types';
import { createBattle, createGame } from './createGame';
import { apply } from './reducer';
import { OUT_OF_ROUNDS } from './turnFlow';

const BASE = CONTENT.encounters.get('enc_forest_road');
if (!BASE) throw new Error('The Forest Road encounter is missing');

const GOAL: Vec2 = { x: 5, y: 8 };

function objectiveEncounter(overrides: Partial<EncounterDef> = {}): EncounterDef {
  return {
    ...BASE!,
    variants: [],
    reinforcements: [],
    objective: { kind: 'holdAtRoundEnd', cells: [GOAL], label: 'Placeholder objective' },
    loseAfterRound: 3,
    ...overrides,
  };
}

function contentWith(encounter: EncounterDef): ContentIndex {
  return { ...CONTENT, encounters: new Map(CONTENT.encounters).set(encounter.id, encounter) };
}

function battleState(content: ContentIndex, seed = 'objective-hold'): GameState {
  const seeded = createGame(content, {
    seed,
    party: [
      { characterId: 'kaya', level: 2, autoChoose: true },
      { characterId: 'riko', level: 2, autoChoose: true },
    ],
    startNode: 'battle_forest_road',
  });
  const rng = new RngCursor(seeded.rng);
  const battle = createBattle(content, seeded, 'enc_forest_road', rng);
  return { ...seeded, screen: 'combat', rng: rng.state, battle };
}

/** The state with `battle`'s units rewritten by `edit`. */
function withUnits(state: GameState, edit: (unit: Unit) => Unit): GameState {
  const battle = state.battle!;
  return { ...state, battle: { ...battle, units: battle.units.map(edit) } };
}

function active(state: GameState): Unit | undefined {
  const battle = state.battle;
  return battle?.units.find((unit) => unit.id === battle.order[battle.turnIndex]);
}

/** People end their turns at once; the AI plays its own. */
function nextCommand(state: GameState): Command {
  const unit = active(state);
  return unit && isTableControlled(unit)
    ? { type: 'endTurn', unitId: unit.id }
    : { type: 'runAiTurn' };
}

function play(content: ContentIndex, state: GameState, steps = 200) {
  const events: GameEvent[] = [];
  let current = state;
  for (let i = 0; i < steps && current.battle?.phase === 'active'; i++) {
    const step = apply(content, current, nextCommand(current));
    events.push(...step.events);
    current = step.state;
  }
  return { state: current, events };
}

const isKaya = (unit: Unit) => unit.characterId === 'kaya';

describe('objective: holding at the end of a round', () => {
  const content = contentWith(objectiveEncounter());

  it('wins when a party member stands on the cell as the round ends', () => {
    const start = withUnits(battleState(content), (u) => (isKaya(u) ? { ...u, pos: GOAL } : u));
    const { state, events } = play(content, start);
    expect(state.battle?.phase).toBe('victory');
    // Won at the end of round 1, with the bandits still standing.
    expect(state.battle?.round).toBe(1);
    expect(state.battle?.units.some((u) => u.faction === 'enemy' && u.hp > 0)).toBe(true);
    expect(events.filter((e) => e.type === 'battleEnded')).toEqual([
      { type: 'battleEnded', outcome: 'victory' },
    ]);
    expect(state.log.join('\n')).toContain('holds the objective');
  });

  it('does not win mid-round: the other side gets its turns first', () => {
    const start = withUnits(battleState(content), (u) => (isKaya(u) ? { ...u, pos: GOAL } : u));
    // One command short of the round wrapping: still active.
    const order = start.battle!.order.length;
    let current = start;
    for (let i = 0; i < order - 1 && current.battle?.phase === 'active'; i++) {
      current = apply(content, current, nextCommand(current)).state;
    }
    expect(current.battle?.round).toBe(1);
    expect(current.battle?.phase).toBe('active');
  });

  it('a guest on the cell holds it too', () => {
    const guestContent = contentWith(
      objectiveEncounter({ guests: [{ characterId: 'sura', pos: { x: 4, y: 7 }, level: 3 }] }),
    );
    const start = withUnits(battleState(guestContent), (u) =>
      u.faction === 'ally' ? { ...u, pos: GOAL } : u,
    );
    expect(
      objectiveHolder(start.battle!.units, guestContent.encounters.get(BASE!.id)?.objective),
    ).toMatchObject({ faction: 'ally' });
  });

  it('a fallen unit or an enemy on the cell holds nothing', () => {
    const objective = objectiveEncounter().objective;
    const units = battleState(content).battle!.units;
    const fallen = units.map((u) => (isKaya(u) ? { ...u, pos: GOAL, hp: 0 } : u));
    expect(objectiveHolder(fallen, objective)).toBeUndefined();
    const enemyOn = units.map((u, i) =>
      u.faction === 'enemy' && i === units.findIndex((x) => x.faction === 'enemy')
        ? { ...u, pos: GOAL }
        : u,
    );
    expect(objectiveHolder(enemyOn, objective)).toBeUndefined();
  });

  it('reads a 2-tile footprint: any covered cell counts', () => {
    const objective = objectiveEncounter().objective;
    expect(standsOnObjective(objective, { size: 2 }, { x: GOAL.x - 1, y: GOAL.y - 1 })).toBe(true);
    expect(standsOnObjective(objective, { size: 1 }, { x: GOAL.x - 1, y: GOAL.y - 1 })).toBe(false);
  });

  it('holding on the last allowed round still wins', () => {
    const lastRound = contentWith(objectiveEncounter({ loseAfterRound: 1 }));
    const start = withUnits(battleState(lastRound), (u) => (isKaya(u) ? { ...u, pos: GOAL } : u));
    const { state } = play(lastRound, start);
    expect(state.battle?.phase).toBe('victory');
  });

  it('a wiped party loses even with a guest on the cell', () => {
    const guestContent = contentWith(
      objectiveEncounter({ guests: [{ characterId: 'sura', pos: { x: 4, y: 7 }, level: 3 }] }),
    );
    const encounter = guestContent.encounters.get(BASE!.id);
    const battle = battleState(guestContent).battle!;
    const units = battle.units.map((u) =>
      u.faction === 'ally' ? { ...u, pos: GOAL } : u.faction === 'party' ? { ...u, hp: 0 } : u,
    );
    expect(battleOutcome({ ...battle, units }, encounter)).toBe('defeat');
  });
});

describe('objective: the round limit', () => {
  it('loses when the last allowed round ends without a hold', () => {
    const content = contentWith(objectiveEncounter({ loseAfterRound: 2 }));
    const { state, events } = play(content, battleState(content));
    expect(state.battle?.phase).toBe('defeat');
    // The result reads the round that ended, not one that never began.
    expect(state.battle?.round).toBe(2);
    expect(events.filter((e) => e.type === 'roundStarted').map((e) => e.type)).toHaveLength(1);
    expect(state.log).toContain(OUT_OF_ROUNDS);
  });

  it('works on its own, with no objective: win by defeating everyone before it passes', () => {
    const content = contentWith(objectiveEncounter({ objective: undefined, loseAfterRound: 1 }));
    const { state } = play(content, battleState(content));
    expect(state.battle?.phase).toBe('defeat');
    expect(state.battle?.round).toBe(1);
  });

  it('counts rounds left including the current one', () => {
    const encounter = objectiveEncounter({ loseAfterRound: 6 });
    expect(roundsLeft(1, encounter)).toBe(6);
    expect(roundsLeft(6, encounter)).toBe(1);
    expect(roundsLeft(9, encounter)).toBe(0);
    expect(roundsLeft(1, { ...encounter, loseAfterRound: undefined })).toBeNull();
    expect(outOfRounds(6, encounter)).toBe(false);
    expect(outOfRounds(7, encounter)).toBe(true);
  });

  it('a save past the limit (the content shortened it) reads as lost', () => {
    const encounter = objectiveEncounter({ loseAfterRound: 2 });
    const battle: BattleState = { ...battleState(contentWith(encounter)).battle!, round: 3 };
    expect(battleOutcome(battle, encounter)).toBe('defeat');
    expect(battleOutcome({ ...battle, round: 2 }, encounter)).toBe('active');
  });
});

describe('objective: defeating every enemy still wins', () => {
  it('wins at once when the last enemy falls, mid-round', () => {
    const content = contentWith(objectiveEncounter());
    const start = withUnits(battleState(content), (u) =>
      u.faction === 'enemy' ? { ...u, hp: 0 } : u,
    );
    const encounter = content.encounters.get(BASE!.id);
    expect(battleOutcome(start.battle!, encounter)).toBe('victory');
    const step = apply(content, start, nextCommand(start));
    expect(step.state.battle?.phase).toBe('victory');
    expect(step.state.battle?.round).toBe(1);
  });

  it('roundEndOutcome is null while nothing is decided', () => {
    const encounter = objectiveEncounter();
    const units = battleState(contentWith(encounter)).battle!.units;
    expect(roundEndOutcome(units, 1, encounter)).toBeNull();
    expect(roundEndOutcome(units, 3, encounter)).toEqual({ outcome: 'defeat' });
  });
});

describe('objective: determinism', () => {
  it('the same seed and commands give the same events and the same end', () => {
    const content = contentWith(objectiveEncounter({ loseAfterRound: 6 }));
    const first = play(content, battleState(content, 'objective-determinism'));
    const second = play(content, battleState(content, 'objective-determinism'));
    expect(second.events).toEqual(first.events);
    expect(second.state.battle).toEqual(first.state.battle);
    expect(second.state.rng).toEqual(first.state.rng);
  });

  it('the headless simulator plays an objective fight to an end', () => {
    const content = contentWith(objectiveEncounter({ loseAfterRound: 6 }));
    const result = runCombat(content, {
      encounterId: BASE!.id,
      seed: 'objective-sim',
      party: [
        { characterId: 'kaya', level: 2, autoChoose: true },
        { characterId: 'riko', level: 2, autoChoose: true },
      ],
    });
    expect(['victory', 'defeat']).toContain(result.outcome);
    expect(result.rounds).toBeLessThanOrEqual(6);
  });
});
