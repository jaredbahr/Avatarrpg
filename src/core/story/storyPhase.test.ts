/**
 * A `flags` node's `phase` field (ADR 0047 §1).
 *
 * Entering an authored phase beat moves the world clock forward to the next
 * occurrence of that phase and reports the change. Re-entering the same node
 * is a no-op: the clock only moves when it is not already there, so a revisit
 * cannot churn time.
 */

import { describe as suite, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../state/createGame';
import type { DayPhase, GameState } from '../types';
import { enterStoryNode } from './storyEngine';

function game(phase: DayPhase = 'midday'): GameState {
  const state = createGame(CONTENT, {
    seed: 'story-phase',
    party: ['kaya', 'bo', 'nilak'].map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
  return { ...state, world: { ...state.world, clock: { day: 1, phase } } };
}

suite('an authored phase node', () => {
  it('advances the clock to the authored phase and says so', () => {
    const result = enterStoryNode(CONTENT, game('midday'), 'act1_victory');
    expect(result.state.world.clock).toEqual({ day: 1, phase: 'evening' });
    expect(result.events).toContainEqual({
      type: 'phaseChanged',
      from: 'midday',
      to: 'evening',
      day: 1,
    });
  });

  it('increments the day when the step crosses night into dawn', () => {
    const result = enterStoryNode(CONTENT, game('night'), 'act1_victory');
    expect(result.state.world.clock).toEqual({ day: 2, phase: 'evening' });
    expect(result.events).toContainEqual({
      type: 'phaseChanged',
      from: 'night',
      to: 'evening',
      day: 2,
    });
  });

  it('does nothing the second time through, so a revisit cannot churn the clock', () => {
    const first = enterStoryNode(CONTENT, game('midday'), 'act1_victory');
    const second = enterStoryNode(CONTENT, first.state, 'act1_victory');
    expect(second.state.world.clock).toEqual({ day: 1, phase: 'evening' });
    expect(second.events.filter((event) => event.type === 'phaseChanged')).toEqual([]);
  });
});
