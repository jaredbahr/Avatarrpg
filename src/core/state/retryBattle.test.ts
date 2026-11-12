import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { partyOfSize } from '../sim/balance';
import { enterStoryNode } from '../story/storyEngine';
import type { Command, GameEvent, GameState } from '../types';
import { createGame } from './createGame';
import { apply } from './reducer';

const FIGHTS = ['battle_forest_road', 'battle_quarry_gate', 'battle_ambush', 'battle_grumbler'];

function opened(nodeId: string): GameState {
  const state = createGame(CONTENT, {
    seed: `retry-${nodeId}`,
    party: partyOfSize(3),
    startNode: 'forest_explore',
  });
  return enterStoryNode(CONTENT, state, nodeId).state;
}

/** The party stands still and the enemy plays until the fight is lost. */
function loseByWaiting(start: GameState): { state: GameState; commands: Command[] } {
  let state = start;
  const commands: Command[] = [];
  for (let step = 0; step < 2000 && state.battle?.phase === 'active'; step++) {
    const battle = state.battle;
    const unit = battle.units.find((u) => u.id === battle.order[battle.turnIndex]);
    const command: Command =
      unit?.faction === 'party' ? { type: 'endTurn', unitId: unit.id } : { type: 'runAiTurn' };
    commands.push(command);
    state = apply(CONTENT, state, command).state;
  }
  return { state, commands };
}

function replay(start: GameState, commands: readonly Command[]) {
  let state = start;
  const events: GameEvent[] = [];
  for (const command of commands) {
    const step = apply(CONTENT, state, command);
    state = step.state;
    events.push(...step.events);
  }
  return { state, events };
}

describe('Try again after a lost fight (#620)', () => {
  it('rebuilds the opening board and replays the same commands to the same log', () => {
    const start = opened('battle_forest_road');
    const first = replay(start, loseByWaiting(start).commands);
    expect(first.state.battle?.phase).toBe('defeat');

    const retried = apply(CONTENT, first.state, { type: 'retryBattle' }).state;
    expect(retried.battle).toEqual(start.battle);
    expect(retried.rng).toBe(start.rng);
    expect(retried.party).toEqual(start.party);
    expect(retried.story).toEqual(start.story);
    expect(retried.flags).toEqual(start.flags);
    expect(retried.location).toEqual(start.location);
    expect(retried.screen).toBe('combat');

    const second = replay(retried, loseByWaiting(start).commands);
    expect(second.events).toEqual(first.events);
    expect(second.state.battle).toEqual(first.state.battle);
    expect(second.state.rng).toBe(first.state.rng);
  });

  it('opens every fight with a retry seed, and a retried win pays XP once', () => {
    for (const nodeId of FIGHTS) {
      const start = opened(nodeId);
      const battle = start.battle;
      if (!battle) throw new Error(`No battle for ${nodeId}`);
      expect(battle.openingRng).not.toBeNull();
      const lost = { ...start, battle: { ...battle, phase: 'defeat' as const } };
      const retried = apply(CONTENT, lost, { type: 'retryBattle' }).state;
      expect(retried.battle).toEqual(battle);

      const won = apply(
        CONTENT,
        { ...retried, battle: { ...battle, phase: 'victory' as const } },
        { type: 'resolveBattle' },
      );
      const direct = apply(
        CONTENT,
        { ...start, battle: { ...battle, phase: 'victory' as const } },
        { type: 'resolveBattle' },
      );
      expect(won.state.party.map((u) => u.xp)).toEqual(direct.state.party.map((u) => u.xp));
      expect(won.events.filter((e) => e.type === 'xpGained')).toEqual(
        direct.events.filter((e) => e.type === 'xpGained'),
      );
    }
  });

  it('leaves Carry on on the defeat branch', () => {
    for (const nodeId of FIGHTS) {
      const start = opened(nodeId);
      const node = CONTENT.story.get(nodeId);
      if (!start.battle || node?.kind !== 'battle') throw new Error(`No battle for ${nodeId}`);
      const lost = { ...start, battle: { ...start.battle, phase: 'defeat' as const } };
      const carried = apply(CONTENT, lost, { type: 'resolveBattle' });
      expect(carried.events).toContainEqual({ type: 'storyNodeEntered', nodeId: node.onDefeat });
      expect(carried.events.some((e) => e.type === 'xpGained')).toBe(false);
    }
  });

  it('refuses while the fight is on, after a win, and on a save without the seed', () => {
    const start = opened('battle_forest_road');
    const battle = start.battle;
    if (!battle) throw new Error('No battle');
    expect(apply(CONTENT, start, { type: 'retryBattle' }).state).toBe(start);
    const won = { ...start, battle: { ...battle, phase: 'victory' as const } };
    expect(apply(CONTENT, won, { type: 'retryBattle' }).state).toBe(won);
    const old = { ...start, battle: { ...battle, phase: 'defeat' as const, openingRng: null } };
    expect(apply(CONTENT, old, { type: 'retryBattle' }).state).toBe(old);
  });
});
