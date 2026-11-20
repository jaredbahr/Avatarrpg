import { describe, expect, it } from 'vitest';
import type { EncounterObjective } from '../../core/types';
import { DEFEAT_ALL_GOAL, objectiveLine, objectiveOverlay, roundsText } from './combatObjective';

/** The combat header's objective line (ADR 0116's 2026-11-15 amendment). Placeholder label. */
const OBJECTIVE: EncounterObjective = {
  kind: 'holdAtRoundEnd',
  cells: [{ x: 5, y: 8 }],
  label: 'Placeholder objective',
};

describe('the objective line', () => {
  it('names the goal and counts the rounds left, the current one included', () => {
    expect(objectiveLine({ objective: OBJECTIVE, loseAfterRound: 6 }, 1)).toEqual({
      label: 'Placeholder objective',
      rounds: '6 rounds left',
      urgent: false,
      spoken: 'Goal: Placeholder objective. 6 rounds left',
    });
  });

  it('says so plainly on the last round, and marks it urgent', () => {
    const line = objectiveLine({ objective: OBJECTIVE, loseAfterRound: 6 }, 6);
    expect(line?.rounds).toBe('Last round!');
    expect(line?.urgent).toBe(true);
  });

  it('has no count without a round limit, and the plain goal without an objective', () => {
    expect(objectiveLine({ objective: OBJECTIVE }, 3)).toMatchObject({
      rounds: null,
      urgent: false,
      spoken: 'Goal: Placeholder objective.',
    });
    expect(objectiveLine({ loseAfterRound: 4 }, 2)?.label).toBe(DEFEAT_ALL_GOAL);
  });

  it('is absent for an ordinary fight', () => {
    expect(objectiveLine({}, 1)).toBeNull();
    expect(objectiveLine(undefined, 1)).toBeNull();
  });

  it('words every count', () => {
    expect(roundsText(null)).toBeNull();
    expect(roundsText(0)).toBe('Last round!');
    expect(roundsText(2)).toBe('2 rounds left');
  });
});

describe('the objective layer', () => {
  it('is the same object frame after frame, so the outline caches hold', () => {
    const encounter = { objective: OBJECTIVE };
    const layer = objectiveOverlay(encounter);
    expect(layer).toEqual({ kind: 'objective', tiles: OBJECTIVE.cells });
    expect(objectiveOverlay(encounter)).toBe(layer);
    expect(objectiveOverlay({})).toBeNull();
  });
});
