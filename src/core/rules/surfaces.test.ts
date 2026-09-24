import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { FOREST_ROAD } from '../../content/maps/combat';
import type { Grid, SurfaceId } from '../types';
import { positionHasCover } from './damage';
import { DEFAULT_TILE, buildGrid, tileAt, withSurface } from './grid';
import { applyImpact, tickSurfaces } from './surfaces';

function openGrid(width: number, height: number): Grid {
  return { width, height, tiles: Array.from({ length: width * height }, () => DEFAULT_TILE) };
}

/** A 3x3 stretch of open ground with one surface on the centre tile. */
function ground(surface: { id: SurfaceId; duration: number; spread: number } | null): Grid {
  return withSurface(openGrid(3, 3), { x: 1, y: 1 }, surface);
}

const centre = { x: 1, y: 1 };

describe('tickSurfaces', () => {
  it('counts a lone timed surface down and expires it', () => {
    const start = ground({ id: 'mud', duration: 3, spread: 0 });

    const first = tickSurfaces(CONTENT, start);
    expect(tileAt(first.grid, centre)?.surface?.duration).toBe(2);
    expect(first.changes).toEqual([]);
    expect(tileAt(first.grid, centre)?.surface?.id).toBe('mud');

    const second = tickSurfaces(CONTENT, first.grid);
    expect(tileAt(second.grid, centre)?.surface?.duration).toBe(1);
    expect(second.changes).toEqual([]);

    const third = tickSurfaces(CONTENT, second.grid);
    expect(tileAt(third.grid, centre)?.surface).toBeNull();
    expect(third.changes).toHaveLength(1);
    expect(third.changes[0]).toMatchObject({ from: 'mud', to: null, comboId: 'expire' });

    const fourth = tickSurfaces(CONTENT, third.grid);
    expect(fourth.grid).toBe(third.grid);
    expect(fourth.changes).toEqual([]);
  });

  it('leaves a permanent surface untouched and returns the unchanged grid', () => {
    const start = ground({ id: 'water', duration: -1, spread: 0 });

    const reaction = tickSurfaces(CONTENT, start);
    expect(reaction.grid).toBe(start);
    expect(reaction.changes).toEqual([]);
    expect(tileAt(reaction.grid, centre)?.surface).toEqual({
      id: 'water',
      duration: -1,
      spread: 0,
    });
  });

  it('returns the same grid object when nothing is timed', () => {
    const start = openGrid(3, 3);

    const reaction = tickSurfaces(CONTENT, start);
    expect(reaction.grid).toBe(start);
    expect(reaction.changes).toEqual([]);
  });
});

describe('rubble cover', () => {
  /*
   * The forest heap cell is authored `r`: rubble on spoil. Cover is not a
   * permanent property of that tile — it comes from the live surface's
   * `grantsCover` — so a cell water turns to mud, or one whose rubble has
   * cleared, must stop giving cover.
   */
  const HEAP = { x: 7, y: 3 };

  it('grants cover from the live rubble surface', () => {
    const grid = buildGrid(FOREST_ROAD);
    expect(tileAt(grid, HEAP)?.cover ?? false).toBe(false);
    expect(tileAt(grid, HEAP)?.surface?.id).toBe('rubble');
    expect(positionHasCover(CONTENT, grid, HEAP)).toBe(true);
  });

  it('stops granting cover once water turns the rubble to mud', () => {
    const muddy = applyImpact(CONTENT, buildGrid(FOREST_ROAD), [HEAP], 'water').grid;
    expect(tileAt(muddy, HEAP)?.surface?.id).toBe('mud');
    expect(positionHasCover(CONTENT, muddy, HEAP)).toBe(false);
  });

  it('stops granting cover once the rubble clears', () => {
    const cleared = withSurface(buildGrid(FOREST_ROAD), HEAP, null);
    expect(positionHasCover(CONTENT, cleared, HEAP)).toBe(false);
  });
});
