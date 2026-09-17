import { describe, expect, it } from 'vitest';
import { chaikin, contourLoops, isHole, signedArea, simplify, traceRegions } from './contour';

const tiles = (...cells: [number, number][]) => cells.map(([x, y]) => ({ x, y }));

/** Every point of `loop` lies inside the bounding box of `tiles`, with a margin. */
function withinBox(loop: readonly { x: number; y: number }[], cells: { x: number; y: number }[]) {
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const maxX = Math.max(...cells.map((c) => c.x)) + 1;
  const maxY = Math.max(...cells.map((c) => c.y)) + 1;
  return loop.every((p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
}

describe('traceRegions', () => {
  it('outlines one tile as one loop of four corners', () => {
    const loops = traceRegions(tiles([3, 4]));
    expect(loops).toHaveLength(1);
    expect(loops[0]).toEqual([
      { x: 3, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ]);
  });

  it('outlines a 2x2 block as one loop with no interior edges', () => {
    const loops = traceRegions(tiles([0, 0], [1, 0], [0, 1], [1, 1]));
    expect(loops).toHaveLength(1);
    // Eight corner points before simplification: the four corners plus the
    // midpoints where two tiles meet along a side.
    expect(loops[0]).toHaveLength(8);
    expect(simplify(loops[0] ?? [])).toHaveLength(4);
  });

  it('keeps tiles that touch only at a corner as separate loops', () => {
    const loops = traceRegions(tiles([0, 0], [1, 1]));
    expect(loops).toHaveLength(2);
    for (const loop of loops) expect(loop).toHaveLength(4);
  });

  it('traces a ring as an outer loop plus a hole', () => {
    const ring = tiles([0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]);
    const loops = traceRegions(ring);
    expect(loops).toHaveLength(2);
    const holes = loops.filter(isHole);
    const outers = loops.filter((loop) => !isHole(loop));
    expect(holes).toHaveLength(1);
    expect(outers).toHaveLength(1);
    // The hole is the middle tile's square, walked the other way round.
    expect(Math.abs(signedArea(holes[0] ?? []))).toBe(2);
    expect(Math.abs(signedArea(outers[0] ?? []))).toBe(18);
  });

  it('orients outer loops clockwise in screen space', () => {
    const loops = traceRegions(tiles([5, 5], [6, 5]));
    expect(loops).toHaveLength(1);
    expect(isHole(loops[0] ?? [])).toBe(false);
  });

  it('returns nothing for no tiles', () => {
    expect(traceRegions([])).toEqual([]);
  });
});

describe('chaikin', () => {
  it('doubles the point count per pass on a closed loop', () => {
    const square = tiles([0, 0], [1, 0], [1, 1], [0, 1]);
    expect(chaikin(square, 1, true)).toHaveLength(8);
    expect(chaikin(square, 2, true)).toHaveLength(16);
  });

  it('keeps a closed loop inside its own bounding box', () => {
    const cells = tiles([0, 0], [1, 0], [2, 0], [2, 1]);
    for (const loop of contourLoops(cells)) expect(withinBox(loop, cells)).toBe(true);
  });

  it('leaves straight edges straight', () => {
    // A 1x3 strip: every rounded point on the long sides stays on y = 0 or y = 1.
    const loops = contourLoops(tiles([0, 0], [1, 0], [2, 0]));
    const loop = loops[0] ?? [];
    const onLongSide = loop.filter((p) => p.x > 0.5 && p.x < 2.5);
    expect(onLongSide.length).toBeGreaterThan(0);
    for (const p of onLongSide) expect(p.y === 0 || p.y === 1).toBe(true);
  });

  it('rounds a corner within a quarter tile of it', () => {
    const loop = contourLoops(tiles([0, 0]))[0] ?? [];
    // No point reaches the corner (0, 0): the cut starts a quarter tile along
    // each edge and the second pass brings the curve to about 0.2 of it.
    const nearest = Math.min(...loop.map((p) => Math.hypot(p.x, p.y)));
    expect(nearest).toBeGreaterThan(0.15);
    expect(nearest).toBeLessThan(0.3);
    // And nothing leaves the tile's own square.
    for (const p of loop) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });

  it('rounds a long side only at its ends, whatever its length', () => {
    const strip = tiles(...Array.from({ length: 12 }, (_, i) => [i, 0] as [number, number]));
    const loop = contourLoops(strip)[0] ?? [];
    // Away from the two ends every point sits exactly on the top or bottom edge.
    const middle = loop.filter((p) => p.x > 1 && p.x < 11);
    expect(middle.length).toBeGreaterThan(0);
    for (const p of middle) expect(p.y === 0 || p.y === 1).toBe(true);
  });

  it('pins the endpoints of an open polyline', () => {
    const open = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];
    const smoothed = chaikin(open, 2, false);
    expect(smoothed[0]).toEqual({ x: 0, y: 0 });
    expect(smoothed[smoothed.length - 1]).toEqual({ x: 1, y: 1 });
  });

  it('keeps the winding of a loop', () => {
    const cells = tiles([0, 0], [1, 0], [0, 1]);
    for (const raw of traceRegions(cells)) {
      const rounded = chaikin(simplify(raw), 2, true);
      expect(Math.sign(signedArea(rounded))).toBe(Math.sign(signedArea(raw)));
    }
  });
});
