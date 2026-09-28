import { describe, expect, it } from 'vitest';
import type { MapExit } from '../../core/types';
import { nearestExitCell } from './LocalMap';

const mouth: MapExit = {
  pos: { x: 19, y: 4 },
  area: [
    { x: 19, y: 4 },
    { x: 19, y: 5 },
    { x: 19, y: 6 },
    { x: 19, y: 7 },
    { x: 19, y: 8 },
  ],
  toMapId: 'quarry_gate',
  toPos: { x: 1, y: 5 },
  label: 'East → Quarry Gate',
};

describe('local map exit buttons', () => {
  it('walks to the mouth cell nearest the party (M2)', () => {
    // Distance is Chebyshev, so only a party outside the mouth's row band
    // picks one row outright; inside it, the tie rule keeps `pos`.
    expect(nearestExitCell(mouth, { x: 20, y: 10 })).toEqual({ x: 19, y: 8 });
    expect(nearestExitCell(mouth, { x: 20, y: 1 })).toEqual({ x: 19, y: 4 });
  });

  it('keeps `pos` on a tie, so the canonical cell still leads (M2)', () => {
    expect(nearestExitCell(mouth, { x: 17, y: 4 })).toEqual({ x: 19, y: 4 });
  });

  it('walks to `pos` for an exit without an area (M2)', () => {
    const single: MapExit = { ...mouth, area: undefined };
    expect(nearestExitCell(single, { x: 20, y: 10 })).toEqual({ x: 19, y: 4 });
  });
});
