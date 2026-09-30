import { describe, expect, it } from 'vitest';
import { formatHitBreakdownRows, formatLedgeDrop, formatShoveMovement } from './combatPreviewText';

describe('combat preview text', () => {
  it('describes shove movement without raw grid coordinates', () => {
    expect(formatShoveMovement('Mercenary', 'push', { x: 1, y: 2 }, { x: 2, y: 1 }, 1, [])).toBe(
      'Mercenary: pushed 1 tile north-east',
    );
    expect(
      formatShoveMovement('Mercenary', 'pull', { x: 3, y: 1 }, { x: 1, y: 1 }, 2, ['water']),
    ).toBe('Mercenary: pulled into the water');
  });

  it('hides harmless drops and explains damage clamped by the HP floor', () => {
    expect(formatLedgeDrop('Mercenary', 2, 0, 3)).toBeNull();
    expect(formatLedgeDrop('Mercenary', 2, 1, 3)).toBe(
      "Mercenary drops 2 → 1 damage (can't fall below 1 HP)",
    );
    expect(formatLedgeDrop('Mercenary', 2, 6, 3)).toBe('Mercenary drops 2 → 6 damage');
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
