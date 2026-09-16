import { describe, expect, it } from 'vitest';
import { deviation, sampleAt, sampleFraction, smoothPath } from './curve';

const path = (...cells: [number, number][]) => cells.map(([x, y]) => ({ x, y }));

describe('smoothPath', () => {
  it('starts at the unit and ends at the last tile, at their centres', () => {
    const curve = smoothPath({ x: 1, y: 3 }, path([2, 3], [3, 3], [3, 4]));
    expect(curve.points[0]).toEqual({ x: 1.5, y: 3.5 });
    expect(curve.points[curve.points.length - 1]).toEqual({ x: 3.5, y: 4.5 });
    expect(sampleAt(curve, 0).pos).toEqual({ x: 1.5, y: 3.5 });
    expect(sampleAt(curve, curve.length).pos).toEqual({ x: 3.5, y: 4.5 });
  });

  it('has monotonic arc length', () => {
    const curve = smoothPath({ x: 0, y: 0 }, path([1, 0], [2, 1], [2, 2], [1, 3]));
    for (let i = 1; i < curve.cumulative.length; i++) {
      expect(curve.cumulative[i]).toBeGreaterThan(curve.cumulative[i - 1] ?? 0);
    }
    expect(curve.length).toBe(curve.cumulative[curve.cumulative.length - 1]);
  });

  it('is a straight line for a straight walk', () => {
    const curve = smoothPath({ x: 0, y: 5 }, path([1, 5], [2, 5], [3, 5]));
    for (const p of curve.points) expect(p.y).toBe(5.5);
    expect(curve.length).toBeCloseTo(3, 6);
  });

  it('never strays more than a fifth of a tile from the tile centres', () => {
    const from = { x: 0, y: 0 };
    const walk = path([1, 0], [2, 0], [2, 1], [2, 2], [3, 3], [4, 3], [4, 2]);
    const curve = smoothPath(from, walk);
    expect(deviation(curve, from, walk)).toBeLessThan(0.2);
  });

  it('stays inside the tiles it visits around a right-angle turn', () => {
    const from = { x: 0, y: 0 };
    const walk = path([1, 0], [1, 1]);
    const curve = smoothPath(from, walk);
    const visited = [from, ...walk];
    for (const p of curve.points) {
      const inside = visited.some(
        (t) => p.x >= t.x && p.x <= t.x + 1 && p.y >= t.y && p.y <= t.y + 1,
      );
      expect(inside, `${p.x},${p.y}`).toBe(true);
    }
  });

  it('handles a single-step move and an empty one', () => {
    const one = smoothPath({ x: 4, y: 4 }, path([5, 4]));
    expect(one.length).toBeCloseTo(1, 6);
    expect(sampleFraction(one, 0.5).pos).toEqual({ x: 5, y: 4.5 });

    const none = smoothPath({ x: 4, y: 4 }, []);
    expect(none.length).toBe(0);
    expect(sampleAt(none, 0.5).pos).toEqual({ x: 4.5, y: 4.5 });
  });
});

describe('sampleAt', () => {
  it('reports the direction of travel', () => {
    const curve = smoothPath({ x: 0, y: 0 }, path([1, 0], [2, 0]));
    const { tangent } = sampleAt(curve, 1);
    expect(tangent.x).toBeCloseTo(1, 6);
    expect(tangent.y).toBeCloseTo(0, 6);
  });

  it('clamps beyond either end', () => {
    const curve = smoothPath({ x: 0, y: 0 }, path([0, 1]));
    expect(sampleAt(curve, -5).pos).toEqual({ x: 0.5, y: 0.5 });
    expect(sampleAt(curve, 50).pos).toEqual({ x: 0.5, y: 1.5 });
  });

  it('ends at the last tile exactly, whatever the fraction rounding', () => {
    const curve = smoothPath({ x: 2, y: 2 }, path([3, 3], [4, 3]));
    expect(sampleFraction(curve, 1).pos).toEqual({ x: 4.5, y: 3.5 });
  });
});
