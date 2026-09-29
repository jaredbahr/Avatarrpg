import { describe, expect, it } from 'vitest';
import type { Grid, Tile, Vec2 } from '../types';
import {
  DEFAULT_TILE,
  enterCost,
  hasLineOfSight,
  pathCost,
  posKey,
  reachable,
  standCost,
  withSurface,
  withTile,
} from './grid';
import type { MoveContext } from './grid';

function openGrid(width: number, height: number): Grid {
  return { width, height, tiles: Array.from({ length: width * height }, () => DEFAULT_TILE) };
}

/** A battle-shaped context: `climbCost` is the authored tuning value. */
function battleContext(grid: Grid, climbCost = 1, size: 1 | 2 = 1): MoveContext {
  return { grid, blocked: new Set(), surfaces: new Map(), size, climbCost };
}

function tier(elevation: number, extra: Partial<Tile> = {}): Tile {
  return { ...DEFAULT_TILE, elevation, ...extra };
}

/** An open 4x3 grid with the named cells raised or marked. */
function laidOut(steps: readonly { pos: Vec2; tile: Tile }[]): Grid {
  let grid = openGrid(4, 3);
  for (const step of steps) grid = withTile(grid, step.pos, step.tile);
  return grid;
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

describe('climbing (E4)', () => {
  const start = { x: 1, y: 1 };
  const bench = { x: 2, y: 1 };

  it('charges one extra move point to step up a tier', () => {
    const ctx = battleContext(laidOut([{ pos: bench, tile: tier(1) }]));

    expect(enterCost(ctx, start, bench)).toBe(2);
    expect(pathCost(ctx, start, [bench])).toBe(2);
    // A move point of 1 buys the flat ground only; 2 buys the bench.
    expect(reachable(ctx, start, 1).has(posKey(bench))).toBe(false);
    expect(reachable(ctx, start, 2).get(posKey(bench))).toMatchObject({ cost: 2, climbCost: 1 });
  });

  it('reads the surcharge off the context, never a literal', () => {
    const ctx = battleContext(laidOut([{ pos: bench, tile: tier(1) }]), 3);

    expect(enterCost(ctx, start, bench)).toBe(4);
    expect(reachable(ctx, start, 4).get(posKey(bench))).toMatchObject({ cost: 4, climbCost: 3 });
  });

  it('refuses a climb in a context that carries no climb rule', () => {
    const grid = laidOut([{ pos: bench, tile: tier(1) }]);
    const flat: MoveContext = { grid, blocked: new Set(), surfaces: new Map(), size: 1 };

    expect(enterCost(flat, start, bench)).toBeNull();
  });

  it('does not charge for a flat step or a step down', () => {
    const ctx = battleContext(laidOut([{ pos: { x: 1, y: 0 }, tile: tier(1) }]));

    expect(enterCost(ctx, { x: 1, y: 0 }, start)).toBe(1);
    expect(enterCost(ctx, start, { x: 0, y: 1 })).toBe(1);
  });

  it('waives the climb when either end of the step is a ramp', () => {
    const rampOnTop = laidOut([{ pos: bench, tile: tier(1, { ramp: true }) }]);
    expect(enterCost(battleContext(rampOnTop), start, bench)).toBe(1);
    expect(reachable(battleContext(rampOnTop), start, 1).has(posKey(bench))).toBe(true);

    const rampBelow = laidOut([
      { pos: start, tile: tier(0, { ramp: true }) },
      { pos: bench, tile: tier(1) },
    ]);
    expect(enterCost(battleContext(rampBelow), start, bench)).toBe(1);
  });

  it('refuses a two-tier step in both directions', () => {
    const ctx = battleContext(laidOut([{ pos: bench, tile: tier(2) }]));

    expect(enterCost(ctx, start, bench)).toBeNull();
    expect(enterCost(ctx, bench, start)).toBeNull();
    expect(pathCost(ctx, start, [bench])).toBeNull();
    expect(reachable(ctx, start, 99).has(posKey(bench))).toBe(false);
  });

  it('rejects a saved path that crosses a cliff diagonally', () => {
    const goal = { x: 2, y: 2 };
    const ctx = battleContext(laidOut([{ pos: goal, tile: tier(2) }]));

    expect(pathCost(ctx, start, [goal])).toBeNull();
    expect(reachable(ctx, start, 99).has(posKey(goal))).toBe(false);
  });

  it('refuses a size-2 step when either of its cells fails', () => {
    // The footprint (1,1)+(2,1) steps north to (1,0)+(2,0); the far cell is
    // two tiers up, so the whole step is illegal.
    const ctx = battleContext(laidOut([{ pos: { x: 2, y: 0 }, tile: tier(2) }]), 1, 2);

    expect(enterCost(ctx, { x: 1, y: 1 }, { x: 1, y: 0 })).toBeNull();
  });

  it('charges a size-2 footprint the worst cell of the step once', () => {
    const ctx = battleContext(
      laidOut([
        { pos: { x: 1, y: 0 }, tile: tier(1) },
        { pos: { x: 2, y: 0 }, tile: tier(1) },
      ]),
      1,
      2,
    );

    expect(enterCost(ctx, { x: 1, y: 1 }, { x: 1, y: 0 })).toBe(2);
  });

  it('ignores tiers when only the footprint standing on a cell matters', () => {
    const grid = laidOut([{ pos: bench, tile: tier(2) }]);

    expect(standCost(battleContext(grid), bench)).toBe(1);
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
