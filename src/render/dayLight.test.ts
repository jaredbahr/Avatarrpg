import { describe, expect, it } from 'vitest';
import { gradePixels, gradeKey, lampGlowBox, lampGlowMask } from './dayLight';
import { gradedRgb, type LampGlowStyle, type LightGrade } from './view';

const GRADE: LightGrade = { multiply: [0.92, 0.8, 0.78], lift: [10 / 255, 0, 14 / 255] };

describe('the grade as a colour operation (ADR 0121)', () => {
  it('multiplies and lifts each channel, leaving alpha and empty pixels alone', () => {
    const data = new Uint8ClampedArray([200, 100, 50, 255, 255, 255, 255, 128, 9, 9, 9, 0]);
    gradePixels(data, GRADE);
    expect(Array.from(data.slice(0, 4))).toEqual([194, 80, 53, 255]);
    expect(Array.from(data.slice(4, 8))).toEqual([245, 204, 213, 128]);
    // Transparent stays exactly as it was: no lift on the void.
    expect(Array.from(data.slice(8, 12))).toEqual([9, 9, 9, 0]);
  });

  it('keys a grade by its values', () => {
    expect(gradeKey(GRADE)).toBe(gradeKey({ ...GRADE }));
    expect(gradeKey(GRADE)).not.toBe(gradeKey({ ...GRADE, lift: [0, 0, 0] }));
  });

  it('grades light added inside graded art by the multiply alone', () => {
    expect(gradedRgb(null, [255, 176, 92])).toEqual([255, 176, 92]);
    expect(gradedRgb(GRADE, [255, 176, 92])).toEqual([235, 141, 72]);
  });
});

describe('a lamp glow on the world-pixel grid (ADR 0121, ADR 0093)', () => {
  const style: LampGlowStyle = {
    radiusX: 8,
    radiusY: 4,
    rings: [
      { scale: 1, alpha: 0.1 },
      { scale: 0.5, alpha: 0.3 },
    ],
    color: [255, 168, 82],
  };

  it('is hard-stepped rings: one level per ring, brightest at the centre, none past the edge', () => {
    const mask = lampGlowMask(style);
    expect(mask.width).toBe(17);
    expect(mask.height).toBe(9);
    const levels = new Set(Array.from(mask.alpha).map((a) => a.toFixed(3)));
    expect([...levels].sort()).toEqual(['0.000', '0.100', '0.300']);
    expect(mask.alpha[4 * 17 + 8]).toBeCloseTo(0.3);
    expect(mask.alpha[0]).toBe(0);
    // Symmetric about the centre pixel both ways.
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 17; x++)
        expect(mask.alpha[y * 17 + x]).toBe(mask.alpha[(8 - y) * 17 + (16 - x)]);
    // Never brighter further out along a row.
    for (let x = 9; x < 17; x++)
      expect(mask.alpha[4 * 17 + x] ?? 0).toBeLessThanOrEqual(mask.alpha[4 * 17 + x - 1] ?? 0);
  });

  it('is placed on whole world pixels, centred on the point', () => {
    const box = lampGlowBox({ x: 29.6775, y: 11.375 }, style, 40);
    expect(box).toEqual({ x: 1187 - 8, y: 455 - 4, w: 17, h: 9 });
    for (const v of Object.values(box)) expect(Number.isInteger(v)).toBe(true);
  });
});
