import { describe, expect, it } from 'vitest';
import { unitMarkerGroundPoint } from './view';

describe('directional melee marker ground point', () => {
  it('keeps the contact marker under a lunge on elevated terrain', () => {
    const marker = unitMarkerGroundPoint({ x: 320, y: 240 }, 64, 0.06, { x: 0, y: -0.42 });

    expect(marker.x).toBe(320);
    expect(marker.y).toBeCloseTo(209.28, 6);
  });

  it('keeps non-contact markers on the logical elevated tile', () => {
    const marker = unitMarkerGroundPoint({ x: 320, y: 240 }, 64, 0.06);

    expect(marker).toEqual({ x: 320, y: 236.16 });
  });
});
