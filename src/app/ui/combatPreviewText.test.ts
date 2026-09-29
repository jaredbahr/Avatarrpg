import { describe, expect, it } from 'vitest';
import { formatHitBreakdownRows, formatShoveMovement } from './combatPreviewText';

describe('combat preview text', () => {
  it('inflects push and pull in the named movement sentence', () => {
    expect(formatShoveMovement('Mercenary', 'push', '(12,5)')).toBe('Mercenary: pushes to (12,5)');
    expect(formatShoveMovement('Mercenary', 'pull', '(12,5)')).toBe('Mercenary: pulls to (12,5)');
  });

  it('formats every hit component directly from the breakdown', () => {
    expect(
      formatHitBreakdownRows({
        chance: 65,
        base: 90,
        elevation: 10,
        cover: -20,
        plunging: 10,
        statuses: 5,
        obscurement: { inside: -25, through: -15, attacker: 0, weather: 0, total: -40 },
      }),
    ).toEqual([
      'Base 90',
      'High ground +10',
      'Cover −10 (plunging)',
      'Status effects +5',
      'Target in cloud −25',
      'Shot through cloud −15',
    ]);
  });

  it('shows lower ground and weather penalties, and omits zero components', () => {
    expect(
      formatHitBreakdownRows({
        chance: 70,
        base: 90,
        elevation: -10,
        cover: 0,
        plunging: 0,
        statuses: 0,
        obscurement: { inside: 0, through: 0, attacker: -15, weather: -15, total: -30 },
      }),
    ).toEqual(['Base 90', 'Low ground −10', 'Attacker in cloud −15', 'Weather −15']);
    expect(formatHitBreakdownRows(null)).toEqual([]);
  });
});
