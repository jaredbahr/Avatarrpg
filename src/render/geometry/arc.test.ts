import { describe, expect, it } from 'vitest';
import { headAt } from '../fx/simulate';
import { ARC_STEPS, aimArcPoints, arcHeading, arrowheadPolygon } from './arc';

describe('aimArcPoints', () => {
  const from = { x: 1.5, y: 4.5 };
  const to = { x: 7.5, y: 4.5 };

  it('pins both ends and lobs the midpoint by the arc', () => {
    const points = aimArcPoints(from, to, 0.6);
    expect(points).toHaveLength(ARC_STEPS + 1);
    expect(points[0]).toEqual(from);
    expect(points[ARC_STEPS]).toEqual(to);
    const apex = points[ARC_STEPS / 2];
    expect(apex?.x).toBeCloseTo(4.5, 6);
    expect(apex?.y).toBeCloseTo(4.5 - 0.6, 6);
  });

  it('flies straight when the arc is zero', () => {
    for (const p of aimArcPoints(from, to, 0)) expect(p.y).toBeCloseTo(4.5, 6);
  });

  it("is the projectile's own curve, sample for sample", () => {
    const points = aimArcPoints(from, { x: 3.5, y: 1.5 }, 0.9, 8);
    points.forEach((p, i) => {
      const head = headAt(from, { x: 3.5, y: 1.5 }, i / 8, 0.9);
      expect(p.x).toBeCloseTo(head.x, 9);
      expect(p.y).toBeCloseTo(head.y, 9);
    });
  });

  it('arrives heading down its last step', () => {
    const level = arcHeading(aimArcPoints(from, to, 0));
    expect(level.x).toBeCloseTo(1, 6);
    expect(level.y).toBeCloseTo(0, 6);
    const lobbed = arcHeading(aimArcPoints(from, to, 1));
    expect(lobbed.y).toBeGreaterThan(0);
    expect(Math.hypot(lobbed.x, lobbed.y)).toBeCloseTo(1, 6);
    expect(arcHeading([])).toEqual({ x: 1, y: 0 });
  });
});

describe('arrowheadPolygon', () => {
  it('points along the tangent with its tip just past the point', () => {
    const polygon = arrowheadPolygon({ x: 10, y: 10 }, { x: 1, y: 0 }, 64);
    expect(polygon).toHaveLength(8);
    expect(polygon[0]).toBeGreaterThan(10);
    // The two barbs sit symmetrically either side of the line of flight.
    expect(polygon[3]).toBeCloseTo(10 - (polygon[7] ?? 0) + 10, 6);
    expect(polygon[2]).toBeCloseTo(polygon[6] ?? 0, 6);
  });
});
