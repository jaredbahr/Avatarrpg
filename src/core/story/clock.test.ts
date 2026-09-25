/**
 * The world clock (ADR 0047 §1).
 *
 * `advancePhase` moves forward to the next occurrence of a phase — never
 * backward, never a no-op, and it touches nothing but `world.clock`.
 */

import { describe as suite, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../state/createGame';
import type { DayPhase, GameState } from '../types';
import { advancePhase } from './clock';

function game(phase: DayPhase = 'midday'): GameState {
  const state = createGame(CONTENT, {
    seed: 'clock',
    party: ['kaya', 'bo', 'nilak'].map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
  return { ...state, world: { ...state.world, clock: { day: 1, phase } } };
}

suite('advancePhase', () => {
  it('moves forward within the same day without touching the day number', () => {
    const result = advancePhase(game('midday'), 'evening');
    expect(result.world.clock).toEqual({ day: 1, phase: 'evening' });
  });

  it('crosses night into dawn and increments the day', () => {
    const result = advancePhase(game('evening'), 'dawn');
    expect(result.world.clock).toEqual({ day: 2, phase: 'dawn' });
  });

  it('increments the day when stepping from night to dawn', () => {
    const result = advancePhase(game('night'), 'dawn');
    expect(result.world.clock).toEqual({ day: 2, phase: 'dawn' });
  });

  it('treats a target already reached as a full cycle away, not a no-op', () => {
    const result = advancePhase(game('dawn'), 'dawn');
    expect(result.world.clock).toEqual({ day: 2, phase: 'dawn' });
  });

  it('replaces only the clock, leaving the rest of the state identical', () => {
    const before = game('midday');
    const result = advancePhase(before, 'evening');
    expect(result.rng).toBe(before.rng);
    expect(result.flags).toBe(before.flags);
    expect(result.party).toBe(before.party);
  });
});
