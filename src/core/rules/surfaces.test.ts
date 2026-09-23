import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import type { Grid, SurfaceId } from '../types';
import { DEFAULT_TILE, tileAt, withSurface } from './grid';
import { tickSurfaces } from './surfaces';

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
