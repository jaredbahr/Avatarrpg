import { describe, expect, it } from 'vitest';
import { actorHealthBar } from './actorSilhouette';
import { FOOT_LINE, headroomFromPixels } from '../sheets/bake';

describe('upright actor health bar', () => {
  it('clears the actual opaque silhouette through scale, pose and elevation changes', () => {
    const pixelsPerTile = 128;
    const frameHeight = 192;
    const topRow = 20;
    const anchorY = 0.9;
    const pixels = new Uint8ClampedArray(128 * frameHeight * 4);
    pixels[(topRow * 128 + 64) * 4 + 3] = 255;
    const headroom = headroomFromPixels(pixels, 128, frameHeight, pixelsPerTile, anchorY);
    for (const tile of [48, 64, 96, 144]) {
      for (const scale of [0.92, 1, 1.25, 1.25 * 1.08]) {
        for (const poseY of [-0.1, 0, 0.04]) {
          const y = 300 + (poseY - 2 * 0.06) * tile;
          const top =
            y +
            FOOT_LINE * tile -
            ((anchorY * frameHeight - topRow) / pixelsPerTile) * tile * scale;
          const bar = actorHealthBar(100, y, tile, tile, scale, headroom);
          expect(bar.silhouetteTop).toBeCloseTo(top, 8);
          expect(bar.y + bar.height + 1).toBeLessThan(top);
          expect(top - (bar.y + bar.height + 1)).toBeCloseTo(Math.max(2, tile * 0.04), 8);
        }
      }
    }
  });

  it('keeps the two-cell boss bar centered and clear without treating width as height', () => {
    const solo = actorHealthBar(50, 200, 96, 96, 1, 0.5);
    const boss = actorHealthBar(50, 200, 192, 96, 1, 0.5);
    expect(boss.x + boss.width / 2).toBe(146);
    expect(boss.width).toBe(solo.width * 2);
    expect(boss.y).toBe(solo.y);
  });

  it('clears scaled painter fallback bounds and moves exactly with the upright pose', () => {
    const base = actorHealthBar(0, 100, 96, 96, 1.25);
    const shifted = actorHealthBar(12, 83, 96, 96, 1.25);
    const fallbackTop = 100 + FOOT_LINE * 96 * (1 - 1.25);
    expect(base.y + base.height + 1).toBeLessThan(fallbackTop);
    expect(shifted.y - base.y).toBe(-17);
    expect(shifted.x - base.x).toBe(12);
  });
});
