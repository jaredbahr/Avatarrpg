import { describe, expect, it } from 'vitest';
import { enemyScale, partyScale } from './actorScale';

/** The oblique board's 1.25 figure scale (ADR 0094) retired with it (ADR 0104 T7). */
describe('figure scale', () => {
  it('draws the party at its art size, times its pose', () => {
    expect(partyScale()).toBe(1);
    expect(partyScale(0.9)).toBe(0.9);
  });

  it('draws every enemy at the party’s scale, the Driller included', () => {
    expect(enemyScale('unit.enemy.crossbow', 1)).toBe(1);
    expect(enemyScale('unit.enemy.merc', 1)).toBe(1);
    expect(enemyScale('unit.enemy.driller', 1)).toBe(1);
    expect(enemyScale('unit.enemy.thug', 0.9)).toBe(partyScale(0.9));
  });
});
