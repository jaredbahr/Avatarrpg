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
import { apply } from '../state/reducer';
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

  it('logs "Evening falls." through the enterNode command, the same as wait does', () => {
    // enterStoryNode() alone (above) never touches state.log - only the
    // reducer's `apply()` formats events into it. Every path that can reach
    // an authored phase node (a direct enterNode, a dialogue choice, a
    // walked trigger or exit, or a battle's story chain) must log it.
    const result = apply(CONTENT, game('midday'), { type: 'enterNode', nodeId: 'act1_victory' });
    expect(result.state.log).toContain('Evening falls.');
  });

  it('logs only the phase change, not an XP/level-up or a battle start on the same enterNode path', () => {
    // Regression for 8f5b47c: withLog formatted every event, not just
    // phaseChanged, so entering a flags node that also grants XP logged a
    // bare unit id ("p0 reaches level 2!" - describeEvent has no battle
    // roster here to resolve a name from), and entering a battle node
    // logged its intro text and "— Round 1 —" before the battle's own,
    // properly-rostered logging ever runs.
    const xp = apply(CONTENT, game('midday'), { type: 'enterNode', nodeId: 'lost_forest_road' });
    expect(xp.state.log).toEqual([]);
    // The events still fire - only the log line is suppressed.
    expect(xp.events.some((event) => event.type === 'leveledUp')).toBe(true);

    const battle = apply(CONTENT, game('midday'), {
      type: 'enterNode',
      nodeId: 'battle_forest_road',
    });
    expect(battle.state.log).toEqual([]);
    expect(battle.events.some((event) => event.type === 'roundStarted')).toBe(true);
  });
});
