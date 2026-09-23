/**
 * The `wait` command (ADR 0047 §1).
 *
 * Waiting changes time and nothing else: it is refused for every reason the
 * ADR lists, and a successful wait moves the clock forward without touching
 * HP, XP, flags or RNG.
 */

import { describe as suite, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import type { BattleState, DayPhase, GameState } from '../types';
import { createGame } from './createGame';
import { apply } from './reducer';

/** Explore, on the village courtyard one tile from Mira's table at (10,5). */
function exploring(): GameState {
  const base = createGame(CONTENT, {
    seed: 'wait',
    party: ['kaya', 'bo', 'nilak'].map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
  return {
    ...base,
    screen: 'explore',
    location: { mapId: 'ba_dan_village', pos: { x: 10, y: 6 } },
    story: { ...base.story, nodeId: 'village_explore' },
  };
}

const wait = (state: GameState, until: DayPhase) => apply(CONTENT, state, { type: 'wait', until });

/** A wait that must be refused: same state, a message, no clock change. */
function expectRefused(state: GameState, until: DayPhase = 'evening'): void {
  const result = wait(state, until);
  expect(result.state).toEqual(state);
  expect(result.state.world.clock).toEqual(state.world.clock);
  expect(result.events.some((event) => event.type === 'phaseChanged')).toBe(false);
  expect(result.events).toContainEqual({ type: 'message', text: expect.any(String) });
}

suite('wait', () => {
  it('advances the clock and emits a phase event, changing nothing else', () => {
    const state = exploring();
    const result = wait(state, 'evening');

    expect(result.state.world.clock).toEqual({ day: 1, phase: 'evening' });
    expect(result.events).toContainEqual({
      type: 'phaseChanged',
      from: 'midday',
      to: 'evening',
      day: 1,
    });
    // Time only: no HP, XP, flags or RNG.
    expect(result.state.flags).toBe(state.flags);
    expect(result.state.party).toBe(state.party);
    expect(result.state.rng).toBe(state.rng);
    expect(result.state.log).toContain('Evening falls.');
  });

  it('is refused when the screen is not explore', () => {
    expectRefused({ ...exploring(), screen: 'dialogue' });
  });

  it('is refused during a battle', () => {
    const battle = { encounterId: 'test', units: [], order: [] } as unknown as BattleState;
    expectRefused({ ...exploring(), battle });
  });

  it('is refused when the story cursor is on a conversation', () => {
    const state = exploring();
    expectRefused({ ...state, story: { ...state.story, nodeId: 'mira_intro' } });
  });

  it('is refused when the target is already the current phase', () => {
    expectRefused(exploring(), 'midday');
  });

  it('is refused when the leader is not near a rest spot', () => {
    const state = exploring();
    expectRefused({ ...state, location: { ...state.location, pos: { x: 3, y: 7 } } });
  });

  it('is deterministic: the same command from the same state gives the same result', () => {
    const state = exploring();
    const first = wait(state, 'evening');
    const second = wait(state, 'evening');
    expect(first.state.rng).toBe(state.rng);
    expect(second.state.rng).toBe(state.rng);
    expect(first.state).toEqual(second.state);
    expect(first.events).toEqual(second.events);
  });
});
