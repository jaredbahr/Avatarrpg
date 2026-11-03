import { describe, expect, it } from 'vitest';
import { crispRatio, drawArt, scaleModeFor } from './pixelSampling';

function context(matrix: { a: number; b: number; c: number; d: number }) {
  const ctx = {
    imageSmoothingEnabled: true,
    seen: [] as boolean[],
    getTransform: () => ({ ...matrix, e: 0, f: 0 }),
  };
  return ctx as unknown as CanvasRenderingContext2D & { seen: boolean[] };
}

describe('pixel sampling (ADR 0088)', () => {
  it('is nearest only on a whole number of device pixels per source pixel', () => {
    for (const ratio of [1, 2, 3, 4, -2, 2.0004]) expect(crispRatio(ratio)).toBe(true);
    for (const ratio of [0.5, 0.75, 1.5, 4 / 3, 2.25, 2.1]) expect(crispRatio(ratio)).toBe(false);
    expect(scaleModeFor(3)).toBe('nearest');
    expect(scaleModeFor(1.5)).toBe('linear');
  });

  it('reads the context transform and restores the smoothing setting', () => {
    const cases: [{ a: number; b: number; c: number; d: number }, number, number, boolean][] = [
      // dpr 2, a 1 px plate drawn at 1.5 CSS px per px: 3 device px.
      [{ a: 2, b: 0, c: 0, d: 2 }, 100, 150, false],
      // dpr 1, a 2 px party sheet at scale 1: half a device px, so smoothed.
      [{ a: 1, b: 0, c: 0, d: 1 }, 128, 64, true],
      // A mirrored figure is still whole pixels.
      [{ a: -2, b: 0, c: 0, d: 2 }, 128, 128, false],
      // A sheared shadow never is.
      [{ a: 2, b: 0.4, c: -1, d: 1 }, 100, 100, true],
    ];
    for (const [matrix, source, dest, smoothed] of cases) {
      const ctx = context(matrix);
      drawArt(ctx, source, dest, () => ctx.seen.push(ctx.imageSmoothingEnabled));
      expect(ctx.seen).toEqual([smoothed]);
      expect(ctx.imageSmoothingEnabled).toBe(true);
    }
  });
});
