import { describe, expect, it } from 'vitest';
import type { Unit, Vec2 } from '../../core/types';
import { unitAt } from '../../core/rules/grid';
import {
  combatFocusPosition,
  fallenFacing,
  moveHoverFootprint,
  occupiedUnitAt,
  overlayMemoHoverKey,
} from './CombatScene';

function unit(id: string, pos: Vec2, extra: Partial<Unit> = {}): Unit {
  return {
    id,
    name: id,
    faction: 'party',
    element: 'fire',
    characterId: null,
    enemyId: null,
    disciplineId: null,
    level: 1,
    xp: 0,
    pos,
    size: 1,
    hp: 10,
    ap: 2,
    move: 3,
    bankedAp: 0,
    pendingAp: 0,
    base: { maxHp: 10, maxAp: 2, maxMove: 3, power: 1, defense: 1, speed: 1, focus: 1 },
    abilities: [],
    cooldowns: {},
    statuses: [],
    ai: 'none',
    temporary: false,
    sprite: 'unit.test',
    ...extra,
  };
}

describe('held knockout facing', () => {
  it("keeps a mirrored sheet's bare knockout the way the unit fell", () => {
    expect(fallenFacing('ko', -1)).toBe(-1);
    expect(fallenFacing('ko', 1)).toBe(1);
  });

  it('never mirrors a knockout authored per heading', () => {
    expect(fallenFacing('koSouthWest', -1)).toBe(1);
  });
});

describe('combat overlay memo key', () => {
  it('tracks hover after a non-target tap, but pins a valid pending target', () => {
    const hover = { x: 4, y: 3 };
    expect(overlayMemoHoverKey(true, false, hover)).toBe('4,3');
    expect(overlayMemoHoverKey(true, true, hover)).toBe('');
    expect(overlayMemoHoverKey(false, false, hover)).toBe('');
  });

  it('invalidates a gated 2x2 move ghost when hover changes', () => {
    expect(overlayMemoHoverKey(false, false, { x: 4, y: 3 }, true)).toBe('4,3');
    expect(overlayMemoHoverKey(false, false, { x: 5, y: 3 }, true)).toBe('5,3');
    expect(overlayMemoHoverKey(false, false, { x: 4, y: 3 })).toBe('');
    expect(moveHoverFootprint({ x: 4, y: 3 }, 2, true)).toEqual([
      { x: 4, y: 3 },
      { x: 5, y: 3 },
      { x: 4, y: 4 },
      { x: 5, y: 4 },
    ]);
    expect(moveHoverFootprint({ x: 4, y: 3 }, 2, false)).toEqual([
      { x: 4, y: 3 },
      { x: 5, y: 3 },
    ]);
  });

  it('preserves the legacy size-2 focus midpoint until square footprints are enabled', () => {
    const unit = { pos: { x: 4, y: 3 }, size: 2 as const };
    expect(combatFocusPosition(unit, false)).toEqual({ x: 4.5, y: 3 });
    expect(combatFocusPosition(unit, true)).toEqual(unit.pos);
  });
});

describe('long-press unit lookup', () => {
  it('finds a defeated unit that the living-unit lookup skips', () => {
    const tile = { x: 4, y: 2 };
    const units = [unit('hero', { x: 1, y: 1 }), unit('fallen', tile, { hp: 0 })];
    // Holding on a body is how a player reads its sheet; `unitAt` never sees it.
    expect(unitAt(units, tile)).toBeUndefined();
    expect(occupiedUnitAt(units, tile)?.id).toBe('fallen');
  });

  it('opens the living unit standing where another fell', () => {
    const tile = { x: 4, y: 2 };
    // The body comes first in the list: array order must not pick it.
    const units = [unit('fallen', tile, { hp: 0 }), unit('standing', tile)];
    expect(occupiedUnitAt(units, tile)?.id).toBe('standing');
  });

  it('picks a size-2 unit on a cell other than its anchor', () => {
    const big = unit('big', { x: 5, y: 3 }, { size: 2 });
    expect(occupiedUnitAt([big], { x: 6, y: 3 })?.id).toBe('big');
    expect(occupiedUnitAt([big], { x: 7, y: 3 })).toBeUndefined();
  });
});
