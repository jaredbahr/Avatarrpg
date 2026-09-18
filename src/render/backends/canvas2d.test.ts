import { describe, expect, it } from 'vitest';
import { uprightSpriteVisible } from './canvas2d';

describe('upright Canvas culling', () => {
  const viewport = { width: 800, height: 600 };
  it('keeps a scaled NPC head visible while its entire ground tile is below the viewport', () => {
    expect(uprightSpriteVisible({ x: 300, y: 620, size: 64 }, viewport, 1, 1.5)).toBe(true);
    expect(uprightSpriteVisible({ x: 300, y: 1000, size: 64 }, viewport, 1, 1.5)).toBe(false);
  });
  it('keeps a two-cell marker at the left edge when its first cell is offscreen', () => {
    expect(uprightSpriteVisible({ x: -130, y: 100, size: 64 }, viewport, 2, 1.5)).toBe(true);
    expect(uprightSpriteVisible({ x: -400, y: 100, size: 64 }, viewport, 2, 1.5)).toBe(false);
  });
  it('culls above and right only once the full conservative bounds leave the view', () => {
    expect(uprightSpriteVisible({ x: 900, y: 100, size: 64 }, viewport, 1, 1.25)).toBe(false);
    expect(uprightSpriteVisible({ x: 300, y: -100, size: 64 }, viewport, 1, 1.25)).toBe(false);
  });
});
