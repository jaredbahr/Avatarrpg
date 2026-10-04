import { describe, expect, it } from 'vitest';
import type { Grid } from '../core/types';
import { DEFAULT_TILE } from '../core/rules/grid';
import {
  FALLEN_ALPHA,
  FALLEN_KNOCKOUT_ALPHA,
  cliffEdgesFor,
  fallenAlpha,
  floaterOutlineWidth,
  floaterScale,
  placeFloaters,
  unitMarkerGroundPoint,
} from './view';

describe('floating number pop', () => {
  it.each([0.5, 1, 2])(
    'keeps the Pixi outline at two screen pixels at camera scale %s',
    (scale) => {
      expect(floaterOutlineWidth(scale) * scale).toBeCloseTo(2, 9);
    },
  );

  it('pops in past full size, settles, and holds for the rise', () => {
    expect(floaterScale(0)).toBeCloseTo(0.6, 9);
    expect(floaterScale(0.1)).toBeCloseTo(1.3, 9);
    expect(floaterScale(0.22)).toBeCloseTo(1, 9);
    expect(floaterScale(0.7)).toBe(1);
    // Emphasis scales the whole curve: a crit is bigger throughout.
    expect(floaterScale(0.7, 1.35)).toBe(1.35);
    expect(floaterScale(0.1, 1.35)).toBeCloseTo(1.3 * 1.35, 9);
  });

  it('offsets two close numbers sideways', () => {
    const placed = placeFloaters(
      [
        { pos: { x: 2, y: 3 }, text: '-8', color: '#fff', progress: 0.2 },
        { pos: { x: 2, y: 3 }, text: '-4', color: '#fff', progress: 0.35 },
      ],
      undefined,
      1.5,
    );
    expect(placed.map((floater) => floater.offsetX)).toEqual([-0.22, 0.22]);
    expect(placed.map((floater) => floater.textScale)).toEqual([1.5, 1.5]);
  });

  it('does not separate numbers outside the 250ms window', () => {
    const placed = placeFloaters([
      { pos: { x: 2, y: 3 }, text: '-8', color: '#fff', progress: 0.1 },
      { pos: { x: 2, y: 3 }, text: '-4', color: '#fff', progress: 0.5 },
    ]);
    expect(placed.map((floater) => floater.offsetX)).toEqual([0, 0]);
  });
});

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

describe('cliff edge presentation', () => {
  it('marks only orthogonal boundaries with a two-tier break', () => {
    const tiles = Array.from({ length: 9 }, () => ({ ...DEFAULT_TILE }));
    tiles[1] = { ...DEFAULT_TILE, elevation: 1 };
    tiles[2] = { ...DEFAULT_TILE, elevation: 2 };
    tiles[5] = { ...DEFAULT_TILE, elevation: 2 };
    const grid: Grid = { width: 3, height: 3, tiles };

    expect(cliffEdgesFor(grid)).toEqual([
      { pos: { x: 2, y: 1 }, side: 'west' },
      { pos: { x: 2, y: 1 }, side: 'south' },
    ]);
  });

  it('does not hatch blocked masses whose elevation is scenery, not footing', () => {
    const tiles = Array.from({ length: 4 }, () => ({ ...DEFAULT_TILE }));
    tiles[0] = { ...DEFAULT_TILE, elevation: 2, blocked: true };
    tiles[1] = { ...DEFAULT_TILE, elevation: 0 };
    tiles[2] = { ...DEFAULT_TILE, elevation: 0 };
    tiles[3] = { ...DEFAULT_TILE, elevation: 2, blocked: true };
    const grid: Grid = { width: 2, height: 2, tiles };

    expect(cliffEdgesFor(grid)).toEqual([]);
  });
});
