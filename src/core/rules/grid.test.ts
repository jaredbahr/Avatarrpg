import { describe, expect, it } from 'vitest';
import type { Grid } from '../types';
import { DEFAULT_TILE, pathCost, posKey, reachable, withTile } from './grid';
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
