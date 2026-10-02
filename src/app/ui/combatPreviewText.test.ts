import { describe, expect, it } from 'vitest';
import {
  formatHitBreakdownRows,
  formatLedgeDrop,
  formatPropConsequence,
  formatShoveMovement,
} from './combatPreviewText';
import type { PropForecast } from '../../core/rules/reactions';

describe('combat preview text', () => {
  it('says whether hay catches, is put out, or is destroyed', () => {
    const prop: PropForecast = {
      id: 'hay-1',
      propId: 'hay_bale',
      name: 'Hay Bale',
      from: { x: 12, y: 5 },
      to: { x: 12, y: 5 },
      destroyed: false,
      catchesFire: true,
      doused: false,
      moved: false,
      coverRemoved: false,
      hpBefore: 5,
      hpAfter: 5,
      breakLabel: null,
      affectedAllies: [],
      affectedEnemies: [],
    };

    expect(formatPropConsequence(prop)).toBe('Hay Bale catches fire');
    expect(formatPropConsequence({ ...prop, catchesFire: false, doused: true, hpAfter: 1 })).toBe(
      'Hay Bale is put out',
    );
    expect(
      formatPropConsequence({
        ...prop,
        destroyed: true,
        catchesFire: false,
        to: null,
        hpAfter: null,
        breakLabel: 'The hay goes up in a rush of flame.',
      }),
    ).toBe('The hay goes up in a rush of flame.');
  });

  it('describes shove movement without raw grid coordinates', () => {
    expect(formatShoveMovement('Mercenary', 'push', 1, 1, null, [], 'caster')).toBe(
      'Mercenary: pushed 1 tile away',
    );
    expect(formatShoveMovement('Mercenary', 'pull', 2, 2, null, ['water'], 'caster')).toBe(
      'Mercenary: pulled into the water',
    );
    expect(formatShoveMovement('Mercenary', 'pull', 1, 1, null, [], 'caster')).toBe(
      'Mercenary: pulled 1 tile closer',
    );
  });

  it('states fully blocked pushes and pulls without a zero-tile fraction', () => {
    expect(formatShoveMovement('Mercenary', 'push', 0, 1, 'obstacle', [], 'caster')).toBe(
      "Mercenary can't be pushed — blocked",
    );
    expect(formatShoveMovement('Mercenary', 'pull', 0, 2, 'obstacle', [], 'caster')).toBe(
      "Mercenary can't be pulled — blocked",
    );
  });

  it('states the completed distance when movement is partly blocked', () => {
    expect(formatShoveMovement('Mercenary', 'push', 1, 2, 'obstacle', [], 'caster')).toBe(
      'Mercenary: pushed 1 of 2 tiles away (blocked)',
    );
    expect(formatShoveMovement('Mercenary', 'pull', 1, 2, 'obstacle', [], 'area')).toBe(
      'Mercenary: pulled 1 of 2 tiles (blocked)',
    );
  });

  it('uses neutral movement with correct plurals for area movement', () => {
    expect(formatShoveMovement('Mercenary', 'push', 2, 2, null, [], 'area')).toBe(
      'Mercenary: knocked 2 tiles',
    );
    expect(formatShoveMovement('Mercenary', 'pull', 2, 2, null, [], 'area')).toBe(
      'Mercenary: pulled 2 tiles',
    );
  });

  it('uses neutral movement for a prop-break push', () => {
    expect(formatShoveMovement('Mercenary', 'push', 1, 2, 'obstacle', [], 'propBreak')).toBe(
      'Mercenary: knocked 1 of 2 tiles (blocked)',
    );
  });

  it('distinguishes centre and adjacent stops from obstacles', () => {
    expect(formatShoveMovement('Mercenary', 'push', 0, 1, 'centre', [], 'area')).toBe(
      'Mercenary stays put — at the centre',
    );
    expect(formatShoveMovement('Mercenary', 'pull', 0, 3, 'adjacent', [], 'caster')).toBe(
      'Mercenary is already next to the caster',
    );
    expect(formatShoveMovement('Mercenary', 'pull', 0, 2, 'adjacent', [], 'area')).toBe(
      'Mercenary is already next to the centre',
    );
    expect(formatShoveMovement('Kaya', 'pull', 0, 2, 'centre', [], 'caster')).toBe(
      'Kaya stays put',
    );
    // A pull that ends beside the caster moved; it says how far, not "already".
    expect(formatShoveMovement('Grumbler', 'pull', 1, 3, 'adjacent', [], 'caster')).toBe(
      'Grumbler: pulled 1 tile closer',
    );
    expect(formatShoveMovement('Grumbler', 'pull', 2, 3, 'adjacent', [], 'caster')).toBe(
      'Grumbler: pulled 2 tiles closer',
    );
  });

  it('states partial water movement and its obstacle', () => {
    expect(formatShoveMovement('Mercenary', 'push', 1, 2, 'obstacle', ['water'], 'caster')).toBe(
      'Mercenary: pushed into the water (1 of 2 tiles; blocked)',
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
