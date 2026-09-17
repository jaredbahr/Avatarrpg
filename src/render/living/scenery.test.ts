import { describe, expect, it } from 'vitest';
import { behindScenery, RIVERSIDE_SCENERY, sceneryShade } from './scenery';

describe('riverside foreground registration', () => {
  it('cools the character in the painted tree shadow, with a soft edge into sunlight', () => {
    expect(sceneryShade(8.4, 11.5)).toBe(1);
    expect(sceneryShade(16.5, 12.86)).toBe(0);
    const edge = sceneryShade(12.3, 11.5);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);
  });
  it('covers the new canopy route while keeping the square and bridge open', () => {
    expect(behindScenery(13.5, 9.3)).toBe(true);
    expect(behindScenery(16.5, 12.3)).toBe(false);
    expect(behindScenery(24.5, 11.5)).toBe(false);
    expect(behindScenery(10.5, 13)).toBe(false);
  });
  it('keeps clipping geometry inside the painting and gives each object a contact depth', () => {
    for (const layer of RIVERSIDE_SCENERY) {
      expect(layer.depth).toBeGreaterThan(0);
      expect(layer.depth).toBeLessThanOrEqual(24);
      for (const polygon of layer.outlines) {
        expect(polygon.length).toBeGreaterThan(2);
        for (const [x, y] of polygon) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(36);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(24);
        }
      }
    }
  });
});
