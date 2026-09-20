import { describe, expect, it } from 'vitest';
import type { StrokeEmitterDef } from '../../content/fx';
import { resolveFx } from '../../content/fx';
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

describe('flowing water whip', () => {
  it('keeps shared Pull and Octopus water bounded, including ink and zero-length aims', () => {
    for (const id of ['fx.water.pull', 'fx.water.octopus']) {
      const recipe = resolveFx(id);
      const defs = [...(recipe.travel?.emitters ?? []), ...recipe.area].filter(
        (def): def is StrokeEmitterDef => def.kind === 'strokes' && def.shape === 'whip',
      );
      expect(defs.some((def) => def.ink)).toBe(true);
      for (const def of defs) {
        const from = { x: 2, y: 3 },
          to = { x: 3, y: 3 };
        const shapes = sampleStrokes(def, def.duration / 2, 3, from, to);
        expect(shapes.length).toBeLessThanOrEqual(4);
        for (const shape of shapes) {
          expect(shape.closed && shape.fill).toBe(true);
          expect(shape.points.every(Number.isFinite)).toBe(true);
          expect(
            shape.points.every((p, i) =>
              i % 2 === 0 ? p >= 1.8 && p <= 3.2 : p >= 2.4 && p <= 3.4,
            ),
          ).toBe(true);
        }
        expect(sampleStrokes(def, def.duration / 2, 3, from, from)).toEqual([]);
      }
    }
  });
  it('retains the single taut dark metal cable without water highlights or beads', () => {
    const def = resolveFx('fx.earth.cable').travel!.emitters.find(
      (e) => e.kind === 'strokes',
    ) as StrokeEmitterDef;
    expect(def.color).toBe('dark');
    expect(def.ink).toBe(true);
    const shapes = sampleStrokes(def, def.duration / 2, 3, { x: 2, y: 3 }, { x: 5, y: 3 });
    expect(shapes).toHaveLength(1);
    expect(shapes[0]!.points).toHaveLength(60);
  });
  const def: StrokeEmitterDef = {
    kind: 'strokes',
    shape: 'whip',
    duration: 600,
    count: 1,
    width: 0.17,
    reach: 1,
    color: 'base',
    ink: false,
    blend: 'normal',
    layer: 'over',
  };
  it('keeps exact hand and contact endpoints through the existing out/return clock', () => {
    const from = { x: 5, y: 5 };
    for (const to of [
      { x: 9, y: 5 },
      { x: 1, y: 5 },
      { x: 5, y: 1 },
      { x: 5, y: 9 },
    ])
      for (const t of [0.1, 0.5, 0.9]) {
        const shapes = sampleStrokes(def, t * 600, 7, from, to),
          body = shapes[0]!;
        expect(body.points.slice(0, 2)).toEqual([from.x, from.y]);
        const tip = {
          x: from.x + (to.x - from.x) * Math.sin(Math.PI * t),
          y: from.y + (to.y - from.y) * Math.sin(Math.PI * t),
        };
        expect(
          body.points.some(
            (x, i) => i % 2 === 0 && Math.hypot(x - tip.x, body.points[i + 1]! - tip.y) < 1e-6,
          ),
        ).toBe(true);
        expect(shapes).toHaveLength(4);
        expect(shapes.every((s) => s.points.every(Number.isFinite))).toBe(true);
      }
    expect(sampleStrokes(def, 601, 7, from, { x: 9, y: 5 })).toEqual([]);
    expect(sampleStrokes(def, 300, 7, from, from)).toEqual([]);
  });
  it('samples continuous flow reproducibly without frame history', () => {
    const from = { x: 1, y: 1 },
      to = { x: 5, y: 3 };
    const a = sampleStrokes(def, 210, 17, from, to),
      b = sampleStrokes(def, 211, 17, from, to);
    expect(sampleStrokes(def, 210, 17, from, to)).toEqual(a);
    expect(Math.max(...a[0]!.points.map((p, i) => Math.abs(p - b[0]!.points[i]!)))).toBeLessThan(
      0.03,
    );
    const highlights = sampleStrokes({ ...def, color: 'accent', width: 0.055 }, 210, 17, from, to);
    expect(highlights).toHaveLength(3);
    expect(highlights.every((s) => s.alpha >= 0 && s.alpha <= 1)).toBe(true);
  });
});
