/**
 * A `flags` node's `phase` field (ADR 0047 §1).
 *
 * Entering an authored phase beat moves the world clock forward to the next
 * occurrence of that phase and reports the change. Re-entering the same node
 * is a no-op: the clock only moves when it is not already there, so a revisit
 * cannot churn time.
 */

import { describe as suite, expect, it } from 'vitest';
import { CONTENT, RETURNEE_IDS } from '../../content';
import { RngCursor } from '../rng';
import { apply } from '../state/reducer';
import { createBattle, createGame } from '../state/createGame';
import type { ContentIndex, DayPhase, GameState, StoryNode } from '../types';
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
    // The phase-change path has exactly one logging owner: entering the node
    // logs the line once, and nothing else repeats it.
    expect(result.state.log.filter((line) => line === 'Evening falls.')).toHaveLength(1);
  });

  it('logs a story level-up and a battle start with real names, once each', () => {
    // A direct enterNode has no other logging owner for these: the reward is
    // granted inside enterStoryNode, and the battle's first round banner is
    // emitted when it opens. withLog formats them against the roster that
    // produced them, so the level-up line carries a name, not a raw id.
    const xp = apply(CONTENT, game('midday'), { type: 'enterNode', nodeId: 'lost_forest_road' });
    expect(xp.events.some((event) => event.type === 'leveledUp')).toBe(true);
    const levelLines = xp.state.log.filter((line) => line.includes('reaches level'));
    expect(levelLines.length).toBeGreaterThan(0);
    expect(levelLines.every((line) => !/^p\d+ /.test(line))).toBe(true);
    // The leader's line appears exactly once, and the xpGained event stays quiet.
    expect(levelLines.filter((line) => line.startsWith('Kaya reaches level 2!'))).toHaveLength(1);

    const battle = apply(CONTENT, game('midday'), {
      type: 'enterNode',
      nodeId: 'battle_forest_road',
    });
    expect(battle.events.some((event) => event.type === 'roundStarted')).toBe(true);
    // The banner appears once; the raw intro message still does not enter the log.
    expect(battle.state.log).toEqual(['— Round 1 —']);

    // The startBattle command reaches the same node, so it logs it the same way.
    const started = apply(CONTENT, game('midday'), {
      type: 'startBattle',
      encounterId: 'enc_forest_road',
    });
    expect(started.state.log).toEqual(['— Round 1 —']);
  });

  it('logs the shipped trade reward’s named level-up exactly once', () => {
    const base = game('midday');
    const ready: GameState = {
      ...base,
      // The repro: a level-2 leader sitting exactly at the level-2 threshold.
      party: base.party.map((member) =>
        member.id === 'p0' ? { ...member, level: 2, xp: 100 } : member,
      ),
      story: { ...base.story, nodeId: 'ruon_choice', lineIndex: 0 },
    };

    const result = apply(CONTENT, ready, { type: 'chooseOption', optionIndex: 1 });

    // trade_payment grants 150: 100 XP -> 250, the level-3 threshold.
    expect(result.state.party[0]).toMatchObject({ level: 3, xp: 250 });
    expect(result.state.log.filter((line) => line === 'Kaya reaches level 3!')).toHaveLength(1);
    expect(
      result.state.log.filter((line) => line === 'Kaya has a new technique to choose.'),
    ).toHaveLength(1);
    expect(result.state.log.some((line) => /^p\d+ /.test(line))).toBe(false);
  });

  it('logs a won fight’s level-up exactly once', () => {
    const base = game('midday');
    const ready: GameState = {
      ...base,
      party: base.party.map((member) =>
        member.id === 'p0' ? { ...member, level: 2, xp: 100 } : member,
      ),
    };
    const rng = new RngCursor(ready.rng);
    const battle = createBattle(CONTENT, ready, 'enc_quarry_gate', rng);
    const resolved: GameState = {
      ...ready,
      screen: 'combat',
      rng: rng.state,
      battle: { ...battle, phase: 'victory' },
    };

    const result = apply(CONTENT, resolved, { type: 'resolveBattle' });

    // 450 XP over a baseline of three is 150 each: the same level-3 threshold.
    expect(result.state.log.filter((line) => line === 'Kaya reaches level 3!')).toHaveLength(1);
  });

  it('applies flags, resident profiles, XP and phase at one authored node', () => {
    const completion: StoryNode = {
      id: 'test_atomic_completion',
      kind: 'flags',
      set: { completed: true },
      residentProfiles: Object.fromEntries(RETURNEE_IDS.map((id) => [id, 'returning'])),
      grantXp: 5,
      phase: 'evening',
      next: 'village_explore',
    };
    const content: ContentIndex = {
      ...CONTENT,
      story: new Map([...CONTENT.story, [completion.id, completion]]),
    };
    const before = game('midday');
    const result = enterStoryNode(content, before, completion.id);

    expect(result.state.flags.completed).toBe(true);
    expect(result.state.world.clock.phase).toBe('evening');
    expect(result.state.world.residentProfiles).toMatchObject(
      Object.fromEntries(RETURNEE_IDS.map((id) => [id, 'returning'])),
    );
    expect(result.state.party[0]?.xp).toBe((before.party[0]?.xp ?? 0) + 5);
    expect(before.flags.completed).toBeUndefined();
    expect(before.world.residentProfiles).toEqual({});
  });
});
