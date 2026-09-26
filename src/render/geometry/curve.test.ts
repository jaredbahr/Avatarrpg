import { describe, expect, it } from 'vitest';
import { deviation, integrateAlong, sampleAt, sampleFraction, smoothPath } from './curve';
import type { Curve } from './curve';

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

describe('integrateAlong', () => {
  // Three tiles east, then three north: two straight segments and one turn.
  const turn: Curve = {
    points: [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: -3 },
    ],
    cumulative: [0, 3, 6],
    length: 6,
  };
  const byHeading = ({ x, y }: { x: number; y: number }) => (x > 0.5 ? 1500 : y < -0.5 ? 3000 : 0);

  it('sums each segment at its own rate, so a turn is continuous', () => {
    expect(integrateAlong(turn, 2, byHeading)).toBeCloseTo(3000, 9);
    expect(integrateAlong(turn, 3, byHeading)).toBeCloseTo(4500, 9);
    // Just past the corner it has moved on by the north rate's share only,
    // where rate-now times distance would have leapt to 3 x 3000 = 9000.
    expect(integrateAlong(turn, 3.01, byHeading)).toBeCloseTo(4530, 9);
    expect(integrateAlong(turn, 6, byHeading)).toBeCloseTo(13500, 9);
    let previous = 0;
    for (let s = 0; s <= 6; s += 0.05) {
      const value = integrateAlong(turn, s, byHeading);
      expect(value - previous).toBeGreaterThanOrEqual(0);
      expect(value - previous).toBeLessThanOrEqual(3000 * 0.05 + 1e-9);
      previous = value;
    }
  });

  it('clamps to the curve and skips zero-length segments', () => {
    expect(integrateAlong(turn, -1, byHeading)).toBe(0);
    expect(integrateAlong(turn, 99, byHeading)).toBeCloseTo(13500, 9);
    const repeated: Curve = {
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
      cumulative: [0, 0, 2],
      length: 2,
    };
    expect(integrateAlong(repeated, 1, byHeading)).toBeCloseTo(1500, 9);
  });

  it('integrates a single segment as rate times distance, and a point to zero', () => {
    const one = smoothPath({ x: 0, y: 0 }, path([1, 0]));
    expect(integrateAlong(one, 0.4, () => 500)).toBeCloseTo(200, 9);
    const point = smoothPath({ x: 2, y: 2 }, []);
    expect(point.length).toBe(0);
    expect(integrateAlong(point, 0, () => 500)).toBe(0);
    expect(integrateAlong(point, 1, () => 500)).toBe(0);
  });

  it('matches rate times arc length for a constant rate on a smoothed turn', () => {
    const curve = smoothPath({ x: 0, y: 0 }, path([1, 0], [2, 0], [2, 1], [2, 2]));
    for (const s of [0.5, 1.7, 2.4, curve.length]) {
      expect(integrateAlong(curve, s, () => 500)).toBeCloseTo(s * 500, 9);
    }
  });
});
