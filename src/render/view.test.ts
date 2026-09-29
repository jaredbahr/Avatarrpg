import { describe, expect, it } from 'vitest';
import { FALLEN_ALPHA, FALLEN_KNOCKOUT_ALPHA, fallenAlpha, unitMarkerGroundPoint } from './view';

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

describe('the fallen fade (ADR 0059)', () => {
  it('ghosts a standing or legacy pose but only dims a body lying in its G knockout', () => {
    expect(fallenAlpha({ fallen: false, clip: 'koSouthEast' })).toBe(1);
    expect(fallenAlpha({ fallen: true })).toBe(FALLEN_ALPHA);
    expect(fallenAlpha({ fallen: true, clip: 'ko' })).toBe(FALLEN_ALPHA);
    expect(fallenAlpha({ fallen: true, clip: 'stance' })).toBe(FALLEN_ALPHA);
    for (const clip of ['koSouthEast', 'koSouthWest', 'koNorthEast', 'koNorthWest'] as const)
      expect(fallenAlpha({ fallen: true, clip })).toBe(FALLEN_KNOCKOUT_ALPHA);
    expect(FALLEN_KNOCKOUT_ALPHA).toBeGreaterThan(FALLEN_ALPHA);
  });
});
