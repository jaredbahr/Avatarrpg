import { describe, expect, it } from 'vitest';
import type { StrokeEmitterDef } from '../../content/fx';
import { sampleStrokes } from './simulate';

describe('travelling elemental silhouettes', () => {
  for (const shape of ['gust', 'flame'] as const) {
    const def: StrokeEmitterDef = {
      kind: 'strokes',
      shape,
      duration: 300,
      count: shape === 'gust' ? 3 : 1,
      width: 0.04,
      reach: 0.9,
      color: 'white',
      ink: false,
      blend: 'normal',
      layer: 'over',
    };
    it(`${shape} reaches the aimed point on its flight clock in all directions`, () => {
      const from = { x: 5, y: 5 };
      for (const to of [
        { x: 9, y: 5 },
        { x: 1, y: 5 },
        { x: 5, y: 1 },
        { x: 5, y: 9 },
      ]) {
        for (const t of [0.1, 0.5, 1]) {
          const strokes = sampleStrokes(def, t * 300, 7, from, to);
          const tip = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
          for (const stroke of strokes) {
            const distances = stroke.points
              .filter((_, i) => i % 2 === 0)
              .map((x, i) => Math.hypot(x - tip.x, (stroke.points[i * 2 + 1] ?? 0) - tip.y));
            expect(Math.min(...distances)).toBeLessThan(shape === 'gust' ? 0.06 : 0.000001);
            expect(Math.max(...distances)).toBeLessThan(1.2);
            expect(stroke.points.every(Number.isFinite)).toBe(true);
            expect(stroke.alpha).toBeGreaterThanOrEqual(0);
            expect(stroke.alpha).toBeLessThanOrEqual(1);
          }
        }
      }
      expect(sampleStrokes(def, 301, 7, from, { x: 9, y: 5 })).toEqual([]);
    });
    it(`${shape} preserves a lob's midpoint and handles a zero-length aim`, () => {
      const from = { x: 1, y: 3 },
        to = { x: 5, y: 3 };
      const stroke = sampleStrokes(def, 150, 7, from, to, 0.7)[shape === 'gust' ? 1 : 0];
      expect(
        stroke?.points.some(
          (x, i) =>
            i % 2 === 0 &&
            Math.abs(x - 3) < 0.000001 &&
            Math.abs((stroke.points[i + 1] ?? 0) - 2.3) < 0.000001,
        ),
      ).toBe(true);
      expect(sampleStrokes(def, 150, 7, from, from)).toEqual([]);
    });
  }
});
