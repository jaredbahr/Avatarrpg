import { describe, expect, it } from 'vitest';
import { FX_CELLS } from '../../content/fx';
import {
  BODY,
  GLOW_HALO_ALPHA,
  INK,
  LIGHT_ROW,
  PIXEL_LADDER,
  SHADE,
  ladderOffset,
  ladderSize,
  rasterCell,
} from './pixelCells';
import { ATLAS_CELL } from './atlas';
import { fadeLevel, harden, strokeBounds } from './pixelStrokes';

describe('the particle pixel ladder', () => {
  it('picks the nearest rung by ratio, clamped to the ladder', () => {
    expect(ladderSize(0.4)).toBe(2);
    expect(ladderSize(6.2)).toBe(6);
    expect(ladderSize(9)).toBe(10);
    expect(ladderSize(13)).toBe(14);
    expect(ladderSize(29)).toBe(28);
    expect(ladderSize(90)).toBe(32);
  });

  it('lays every rung inside its shape square without overlapping', () => {
    const boxes = PIXEL_LADDER.map((rung) => ({ ...ladderOffset(rung), rung }));
    for (const box of boxes) {
      expect(box.x + box.rung).toBeLessThanOrEqual(ATLAS_CELL);
      expect(box.y + box.rung).toBeLessThanOrEqual(ATLAS_CELL);
    }
    for (const a of boxes)
      for (const b of boxes) {
        if (a === b) continue;
        const apart =
          a.x + a.rung <= b.x || b.x + b.rung <= a.x || a.y + a.rung <= b.y || b.y + b.rung <= a.y;
        expect(apart).toBe(true);
      }
  });

  it('draws flat tones, hard alpha and ink only where a rung is large enough', () => {
    const tones = new Set([BODY, SHADE, INK].map((t) => t.join(',')));
    for (const cell of FX_CELLS)
      for (const rung of PIXEL_LADDER) {
        const px = rasterCell(cell, rung);
        expect(px.length).toBe(rung * rung * 4);
        let solid = 0;
        for (let i = 0; i < px.length; i += 4) {
          const a = px[i + 3]!;
          if (a === 0) continue;
          expect([255, GLOW_HALO_ALPHA]).toContain(a);
          expect(tones.has(`${px[i]},${px[i + 1]},${px[i + 2]}`)).toBe(true);
          if (rung < 6) expect(`${px[i]},${px[i + 1]},${px[i + 2]}`).not.toBe(INK.join(','));
          solid += 1;
        }
        expect(solid).toBeGreaterThan(0);
      }
  });

  it('is deterministic', () => {
    expect(rasterCell('puff', 16)).toEqual(rasterCell('puff', 16));
  });

  it('has an uninked copy for light that fits under the inked one and holds no ink', () => {
    for (const rung of PIXEL_LADDER) {
      const at = ladderOffset(rung);
      expect(at.y + rung).toBeLessThanOrEqual(LIGHT_ROW);
      expect(at.y + LIGHT_ROW + rung).toBeLessThanOrEqual(ATLAS_CELL);
    }
    for (const cell of FX_CELLS)
      for (const rung of PIXEL_LADDER) {
        const px = rasterCell(cell, rung, false);
        for (let i = 0; i < px.length; i += 4)
          if (px[i + 3]) expect(`${px[i]},${px[i + 1]},${px[i + 2]}`).not.toBe(INK.join(','));
      }
  });
});

describe('stroke hardening', () => {
  it('keeps a fade in eighths', () => {
    expect([0, 0.05, 0.3, 0.5, 1, 2].map(fadeLevel)).toEqual([0, 0, 0.25, 0.5, 1, 1]);
  });

  it('keeps half-covered pixels solid in the nearer of colour and ink, clears the rest', () => {
    const colour = [200, 50, 40, 255];
    const inkish = [30, 20, 16, 200];
    const underHalf = [200, 50, 40, 100];
    const drawn = new Uint8ClampedArray([...colour, ...inkish, ...underHalf]);
    const out = new Uint8ClampedArray(12);
    harden(drawn, out, [210, 60, 40], [27, 20, 16], 0.5);
    expect([...out]).toEqual([210, 60, 40, 128, 27, 20, 16, 128, 0, 0, 0, 0]);
  });

  it('never lets a fainter layer cover a stronger one', () => {
    const out = new Uint8ClampedArray([1, 2, 3, 255]);
    harden(new Uint8ClampedArray([9, 9, 9, 255]), out, [9, 9, 9], null, 0.5);
    expect([...out]).toEqual([1, 2, 3, 255]);
  });

  it('bounds the visible shapes in world pixels, padded by their width', () => {
    expect(strokeBounds([])).toBeNull();
    const box = strokeBounds([
      { points: [0, 0, 1, 0.5], width: 0.1, alpha: 1, closed: false, fill: false },
      { points: [5, 5, 6, 6], width: 0.1, alpha: 0, closed: false, fill: false },
    ]);
    expect(box).toEqual({ x: -7, y: -7, width: 78, height: 46 });
  });
});
