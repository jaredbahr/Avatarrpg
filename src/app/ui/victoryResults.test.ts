import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import type { GameState } from '../../core/types';
import { victoryNote, victoryResults } from './victoryResults';

/** The Forest Road, entered through the story and won outright. */
function wonForestRoad(): GameState {
  const party = ['kaya', 'sura', 'bo'].map((characterId) => ({ characterId }));
  const fresh = createGame(CONTENT, { seed: 'victory-card', party, startNode: '' });
  const entered = apply(CONTENT, fresh, { type: 'enterNode', nodeId: 'battle_forest_road' }).state;
  const battle = entered.battle;
  if (!battle) throw new Error('the Forest Road did not open a fight');
  return {
    ...entered,
    battle: {
      ...battle,
      phase: 'victory',
      units: battle.units.map((u) => (u.faction === 'enemy' ? { ...u, hp: 0 } : u)),
    },
  };
}

describe('victoryResults', () => {
  it('reports what the real resolve will pay each hero, without resolving', () => {
    const state = wonForestRoad();
    const rows = victoryResults(CONTENT, state);
    expect(state.battle?.phase).toBe('victory');

    const resolved = apply(CONTENT, state, { type: 'resolveBattle' });
    expect(rows.map((row) => row.unit.id)).toEqual(resolved.state.party.map((unit) => unit.id));
    for (const row of rows) {
      const after = resolved.state.party.find((unit) => unit.id === row.unit.id)!;
      const before = state.party.find((unit) => unit.id === row.unit.id)!;
      expect(row.xp).toBe(after.xp - before.xp);
      expect(row.xp).toBeGreaterThan(0);
      expect(row.newLevel).toBe(after.level > before.level ? after.level : null);
    }
  });

  it('names the level-up and what it brought', () => {
    const rows = victoryResults(CONTENT, wonForestRoad());
    const levelled = rows.find((row) => row.newLevel !== null);
    if (!levelled) throw new Error('the Forest Road no longer levels anyone up');
    expect(victoryNote(levelled)).toMatch(/^(Learned .+|A new move to choose|A path to choose)/);
  });

  it('counts down to the next level when nothing changed', () => {
    const note = victoryNote({
      unit: { level: 2 } as never,
      xp: 40,
      newLevel: null,
      learned: [],
      choice: null,
      toNext: 60,
      progress: 0.4,
    });
    expect(note).toBe('60 XP to level 3.');
  });

  it('has nothing to say outside a won fight', () => {
    const state = wonForestRoad();
    expect(
      victoryResults(CONTENT, { ...state, battle: { ...state.battle!, phase: 'defeat' } }),
    ).toEqual([]);
  });
});
