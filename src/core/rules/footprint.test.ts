import { describe, expect, it } from 'vitest';
import { SQUARE_FOOTPRINTS, footprintCells, footprintFoot, shoveStep } from './footprint';

/**
 * The footprint helper, below the game rules. `size` is a side length: 1 is one
 * tile, 2 is a 2x2 block anchored on its top-left cell. Until A-6 flips
 * `SQUARE_FOOTPRINTS`, size 2 resolves to the legacy 2x1 pair, and the tests
 * pass the shape in as a parameter rather than mutating that constant.
 */
describe('unit footprints', () => {
  it('is a single tile at size 1, whichever shape is active', () => {
    expect(footprintCells({ x: 3, y: 4 }, 1)).toEqual([{ x: 3, y: 4 }]);
    expect(footprintCells({ x: 3, y: 4 }, 1, true)).toEqual([{ x: 3, y: 4 }]);
  });

  it('lays a 2x2 out row-major from its top-left anchor', () => {
    expect(footprintCells({ x: 2, y: 5 }, 2, true)).toEqual([
      { x: 2, y: 5 },
      { x: 3, y: 5 },
      { x: 2, y: 6 },
      { x: 3, y: 6 },
    ]);
  });

  it('keeps the legacy 2x1 while the A-6 gate is off', () => {
    expect(SQUARE_FOOTPRINTS).toBe(false);
    const legacy = [
      { x: 2, y: 5 },
      { x: 3, y: 5 },
    ];
    expect(footprintCells({ x: 2, y: 5 }, 2)).toEqual(legacy);
    expect(footprintCells({ x: 2, y: 5 }, 2, false)).toEqual(legacy);
  });

  it('puts the foot at the centre of the front row for each shape', () => {
    expect(footprintFoot({ x: 0, y: 0 }, 1)).toEqual({ x: 0.5, y: 0.5 });
    // Square gate on: the front row is the block's bottom row.
    expect(footprintFoot({ x: 4, y: 2 }, 2, true)).toEqual({ x: 5, y: 3.5 });
    // Legacy 2x1: one row, so the foot stays on the anchor row.
    expect(footprintFoot({ x: 4, y: 2 }, 2, false)).toEqual({ x: 5, y: 2.5 });
    // The default follows the gate constant.
    expect(footprintFoot({ x: 4, y: 2 }, 2)).toEqual({ x: 5, y: 2.5 });
  });
});

describe('shove direction', () => {
  it('is the anchor sign for size 1 either way', () => {
    for (const square of [false, true]) {
      expect(shoveStep({ x: 5, y: 5 }, { x: 7, y: 3 }, 1, 'push', square)).toEqual({ x: -1, y: 1 });
      expect(shoveStep({ x: 5, y: 5 }, { x: 7, y: 3 }, 1, 'pull', square)).toEqual({ x: 1, y: -1 });
    }
  });

  it('treats an origin level with the 2x2 middle as no motion on that axis', () => {
    expect(shoveStep({ x: 4, y: 4 }, { x: 5, y: 4 }, 2, 'push', true)).toEqual({ x: 0, y: 0 });
    expect(shoveStep({ x: 4, y: 4 }, { x: 1, y: 4 }, 2, 'push', true)).toEqual({ x: 1, y: 0 });
  });

  it('pushes a 2x2 away diagonally and pulls it straight back', () => {
    expect(shoveStep({ x: 4, y: 4 }, { x: 2, y: 3 }, 2, 'push', true)).toEqual({ x: 1, y: 1 });
    expect(shoveStep({ x: 4, y: 4 }, { x: 2, y: 3 }, 2, 'pull', true)).toEqual({ x: -1, y: -1 });
  });

  it('keeps the legacy 2x1 on the anchor sign until A-6', () => {
    expect(shoveStep({ x: 4, y: 4 }, { x: 5, y: 4 }, 2, 'push', false)).toEqual({ x: -1, y: 0 });
  });
});
