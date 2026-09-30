import { describe, expect, it } from 'vitest';
import { formatHitBreakdownRows, formatLedgeDrop, formatShoveMovement } from './combatPreviewText';

describe('combat preview text', () => {
  it('describes shove movement without raw grid coordinates', () => {
    expect(formatShoveMovement('Mercenary', 'push', 1, 1, false, [], 'caster')).toBe(
      'Mercenary: pushed 1 tile away',
    );
    expect(formatShoveMovement('Mercenary', 'pull', 2, 2, false, ['water'], 'caster')).toBe(
      'Mercenary: pulled into the water',
    );
    expect(formatShoveMovement('Mercenary', 'pull', 1, 1, false, [], 'caster')).toBe(
      'Mercenary: pulled 1 tile closer',
    );
  });

  it('states fully blocked pushes and pulls without a zero-tile fraction', () => {
    expect(formatShoveMovement('Mercenary', 'push', 0, 1, true, [], 'caster')).toBe(
      "Mercenary can't be pushed — blocked",
    );
    expect(formatShoveMovement('Mercenary', 'pull', 0, 2, true, [], 'caster')).toBe(
      "Mercenary can't be pulled — blocked",
    );
  });

  it('states the completed distance when movement is partly blocked', () => {
    expect(formatShoveMovement('Mercenary', 'push', 1, 2, true, [], 'caster')).toBe(
      'Mercenary: pushed 1 of 2 tiles away (blocked)',
    );
  });

  it('uses neutral movement for a blast-driven push', () => {
    expect(formatShoveMovement('Mercenary', 'push', 1, 1, false, [], 'blast')).toBe(
      'Mercenary: knocked 1 tile',
    );
  });

  it('uses neutral movement for a prop-break push', () => {
    expect(formatShoveMovement('Mercenary', 'push', 1, 2, true, [], 'prop')).toBe(
      'Mercenary: knocked 1 of 2 tiles (blocked)',
    );
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
