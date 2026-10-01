import { describe, expect, it } from 'vitest';
import { combatFocusPosition, moveHoverFootprint, overlayMemoHoverKey } from './CombatScene';

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
