import { describe, expect, it } from 'vitest';
import type { Grid } from '../types';
import {
  DEFAULT_TILE,
  hasLineOfSight,
  pathCost,
  posKey,
  reachable,
  withSurface,
  withTile,
} from './grid';
import type { MoveContext } from './grid';

function openGrid(width: number, height: number): Grid {
  return { width, height, tiles: Array.from({ length: width * height }, () => DEFAULT_TILE) };
}

describe('diagonal movement', () => {
  const start = { x: 0, y: 0 };
  const goal = { x: 1, y: 1 };

  it('allows a diagonal when both adjacent cells are passable', () => {
    const ctx: MoveContext = {
      grid: openGrid(3, 3),
      blocked: new Set(),
      surfaces: new Map(),
      size: 1,
    };

    expect(pathCost(ctx, start, [goal])).toBe(1);
    expect(reachable(ctx, start, 1).has(posKey(goal))).toBe(true);
  });

  it('cannot slip diagonally between two units', () => {
    const ctx: MoveContext = {
      grid: openGrid(3, 3),
      blocked: new Set([posKey({ x: 1, y: 0 }), posKey({ x: 0, y: 1 })]),
      surfaces: new Map(),
      size: 1,
    };

    expect(pathCost(ctx, start, [goal])).toBeNull();
    expect(reachable(ctx, start, 1).has(posKey(goal))).toBe(false);
  });

  it('checks the whole footprint of a two-tile unit at each corner', () => {
    const grid = withTile(openGrid(4, 3), { x: 2, y: 0 }, { ...DEFAULT_TILE, blocked: true });
    const ctx: MoveContext = {
      grid,
      blocked: new Set(),
      surfaces: new Map(),
      size: 2,
    };

    expect(pathCost(ctx, start, [goal])).toBeNull();
    expect(reachable(ctx, start, 1).has(posKey(goal))).toBe(false);
  });
});

describe('line of sight and obscurement', () => {
  const from = { x: 0, y: 1 };
  const to = { x: 4, y: 1 };

  it('looks through a steam cloud, which obscures rather than blocks', () => {
    const grid = withSurface(
      openGrid(5, 3),
      { x: 2, y: 1 },
      { id: 'steam', duration: 2, spread: 0 },
    );
    expect(hasLineOfSight(grid, from, to)).toBe(true);
  });

  it('still stops at a wall', () => {
    const grid = withTile(
      openGrid(5, 3),
      { x: 2, y: 1 },
      { ...DEFAULT_TILE, blocked: true, blocksSight: true },
    );
    expect(hasLineOfSight(grid, from, to)).toBe(false);
  });
});
