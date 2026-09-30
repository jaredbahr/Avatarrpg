import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { describeEvent } from './log';

describe('obscurement miss log', () => {
  it('adds the cloud or weather sentence without changing a clear miss', () => {
    const base = { type: 'attackMissed' as const, unitId: 'Kaya', targetId: 'Bandit' };
    expect(describeEvent(CONTENT, null, base)).toBe('Kaya misses Bandit.');
    expect(
      describeEvent(CONTENT, null, {
        ...base,
        obscurement: { inside: -25, through: 0, attacker: 0, weather: 0, total: -25 },
      }),
    ).toBe('Kaya misses Bandit. Lost in the steam.');
    expect(
      describeEvent(CONTENT, null, {
        ...base,
        obscurement: { inside: 0, through: 0, attacker: 0, weather: -10, total: -10 },
      }),
    ).toBe('Kaya misses Bandit. The sand takes it.');
  });
});
