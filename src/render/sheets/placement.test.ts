/**
 * `placeFrame` is the arithmetic both backends did inline before it (ADR 0055,
 * step 4), so moving them onto it moved no existing frame.
 */

import { describe, expect, it } from 'vitest';
import { placeFrame } from './placement';

/** Canvas 2D's inline rectangle before `placeFrame`: size, then the anchor offset. */
function canvasBefore(
  frame: Parameters<typeof placeFrame>[0],
  ax: number,
  ay: number,
  size: number,
  scale: number,
) {
  const fw = (frame.frame.w / frame.pixelsPerTile) * size * scale;
  const fh = (frame.frame.h / frame.pixelsPerTile) * size * scale;
  return { x: ax - frame.anchor.x * fw, y: ay - frame.anchor.y * fh, w: fw, h: fh };
}

const FRAMES = [
  // A G stance cel, a legacy hero cel, a sharper 256 px sheet's and the 2-tile boss.
  { frame: { x: 0, y: 0, w: 128, h: 192 }, anchor: { x: 0.5, y: 0.85 }, pixelsPerTile: 128 },
  { frame: { x: 384, y: 192, w: 128, h: 192 }, anchor: { x: 0.5, y: 0.85 }, pixelsPerTile: 128 },
  { frame: { x: 0, y: 0, w: 256, h: 384 }, anchor: { x: 0.5, y: 0.85 }, pixelsPerTile: 256 },
  { frame: { x: 0, y: 0, w: 256, h: 192 }, anchor: { x: 0.5, y: 0.85 }, pixelsPerTile: 128 },
];

describe('placeFrame against the inline placement it replaced', () => {
  it('lands every frame where both backends drew it before', () => {
    for (const frame of FRAMES) {
      for (const [size, scale] of [
        [128, 1],
        [77, 1],
        [213.5, 0.75],
        [64, 1.25],
      ] as const) {
        const ax = 311.25 + size / 2;
        const ay = 97.5 + 0.85 * size;
        const before = canvasBefore(frame, ax, ay, size, scale);
        const after = placeFrame(frame, ax, ay, size * scale);
        // Only the product's association changed, so at most a rounding ulp.
        for (const side of ['x', 'y', 'w', 'h'] as const)
          expect(after[side]).toBeCloseTo(before[side], 9);
        // Pixi sized its sprite with the same product before; now from `w` and `h`.
        const pixi = placeFrame(frame, 0, 0, size * scale);
        expect(pixi.w).toBeCloseTo((frame.frame.w / frame.pixelsPerTile) * size * scale, 9);
        expect(pixi.h).toBeCloseTo((frame.frame.h / frame.pixelsPerTile) * size * scale, 9);
      }
    }
  });
});
