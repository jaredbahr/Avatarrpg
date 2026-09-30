import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import type { Grid, Tile, Vec2 } from '../types';
import type { Unit } from '../types';
import {
  DEFAULT_TILE,
  DIRECTIONS,
  enterCost,
  pathCost,
  posKey,
  reachable,
  standCost,
  withSurface,
  withTile,
  unitAt,
} from './grid';
import type { MoveContext } from './grid';

/**
 * The 2x2 footprint's movement rules, switch on.
 *
 * A 2x2 may *stand* only on flat ground (all four cells one elevation), but a
 * step may straddle a one-tier rise: it pays `climbCost` for the worst pair of
 * cells once, refuses a two-tier cliff, and ramps waive the climb. That split is
 * what lets a big unit haul itself up a step without resting on the edge.
 */

function openGrid(width: number, height: number): Grid {
  return { width, height, tiles: Array.from({ length: width * height }, () => DEFAULT_TILE) };
}

function squareContext(grid: Grid, size: 1 | 2, climbCost = 1): MoveContext {
  return {
    grid,
    blocked: new Set(),
    surfaces: CONTENT.surfaces,
    size,
    squareFootprints: true,
    climbCost,
  };
}

function legacyContext(grid: Grid, size: 1 | 2, climbCost = 1): MoveContext {
  return { grid, blocked: new Set(), surfaces: CONTENT.surfaces, size, climbCost };
}

function tier(elevation: number, extra: Partial<Tile> = {}): Tile {
  return { ...DEFAULT_TILE, elevation, ...extra };
}

function laidOut(steps: readonly { pos: Vec2; tile: Tile }[], width = 8, height = 6): Grid {
  let grid = openGrid(width, height);
  for (const step of steps) grid = withTile(grid, step.pos, step.tile);
  return grid;
}

describe('2x2 standCost', () => {
  it('picks the same unit through every occupied cell', () => {
    const unit = { id: 'driller', pos: { x: 2, y: 1 }, size: 2, hp: 1 } as Unit;
    for (const pos of [
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ])
      expect(unitAt([unit], pos, true)?.id).toBe('driller');
    expect(unitAt([unit], { x: 2, y: 2 }, false)).toBeUndefined();
  });
  it('needs all four cells free', () => {
    const blocked = laidOut([{ pos: { x: 2, y: 2 }, tile: { ...DEFAULT_TILE, blocked: true } }]);
    expect(standCost(squareContext(openGrid(8, 6), 2), { x: 1, y: 1 })).toBe(1);
    expect(standCost(squareContext(blocked, 2), { x: 1, y: 1 })).toBeNull();
  });

  it('refuses a mixed-elevation footprint', () => {
    const grid = laidOut([{ pos: { x: 2, y: 2 }, tile: tier(1) }]);
    expect(standCost(squareContext(grid, 2), { x: 1, y: 1 })).toBeNull();
    // Anchoring on the raised cell puts a low cell in the block too.
    expect(standCost(squareContext(grid, 2), { x: 2, y: 2 })).toBeNull();
  });

  it('charges the worst surface once for the whole block', () => {
    const grid = withSurface(
      withSurface(openGrid(8, 6), { x: 1, y: 1 }, { id: 'water', duration: -1, spread: 0 }),
      { x: 2, y: 2 },
      { id: 'water', duration: -1, spread: 0 },
    );
    expect(standCost(squareContext(grid, 2), { x: 1, y: 1 })).toBe(2);
  });

  it('refuses a cell another unit holds', () => {
    const ctx: MoveContext = {
      ...squareContext(openGrid(8, 6), 2),
      blocked: new Set([posKey({ x: 2, y: 1 })]),
    };
    expect(standCost(ctx, { x: 1, y: 1 })).toBeNull();
  });

  it('lets the legacy 2x1 straddle a tier while the gate is off', () => {
    const grid = laidOut([{ pos: { x: 2, y: 2 }, tile: tier(1) }]);
    expect(standCost(legacyContext(grid, 2), { x: 1, y: 1 })).toBe(1);
  });
});

describe('2x2 enterCost', () => {
  it('charges 1 for a flat step', () => {
    expect(enterCost(squareContext(openGrid(8, 6), 2), { x: 1, y: 1 }, { x: 2, y: 1 })).toBe(1);
  });

  it('charges the climb once however many cells of the step rise', () => {
    const grid = laidOut([
      { pos: { x: 3, y: 1 }, tile: tier(1) },
      { pos: { x: 3, y: 2 }, tile: tier(1) },
    ]);
    expect(enterCost(squareContext(grid, 2), { x: 1, y: 1 }, { x: 2, y: 1 })).toBe(2);
  });

  it('reads the climb surcharge off the context', () => {
    const grid = laidOut([
      { pos: { x: 3, y: 1 }, tile: tier(1) },
      { pos: { x: 3, y: 2 }, tile: tier(1) },
    ]);
    expect(enterCost(squareContext(grid, 2, 3), { x: 1, y: 1 }, { x: 2, y: 1 })).toBe(4);
  });

  it('refuses a two-tier rise on any pair', () => {
    const grid = laidOut([{ pos: { x: 3, y: 2 }, tile: tier(2) }]);
    expect(enterCost(squareContext(grid, 2), { x: 1, y: 1 }, { x: 2, y: 1 })).toBeNull();
  });

  it('waives the climb for a pair that touches a ramp', () => {
    const ramped = laidOut([
      { pos: { x: 3, y: 1 }, tile: tier(1, { ramp: true }) },
      { pos: { x: 3, y: 2 }, tile: tier(1, { ramp: true }) },
    ]);
    expect(enterCost(squareContext(ramped, 2), { x: 1, y: 1 }, { x: 2, y: 1 })).toBe(1);

    const halfRamped = laidOut([
      { pos: { x: 3, y: 1 }, tile: tier(1, { ramp: true }) },
      { pos: { x: 3, y: 2 }, tile: tier(1) },
    ]);
    expect(enterCost(squareContext(halfRamped, 2), { x: 1, y: 1 }, { x: 2, y: 1 })).toBe(2);
  });
});

describe('2x2 diagonal sweep', () => {
  it('allows every diagonal around the block on open ground', () => {
    const start = { x: 2, y: 2 };
    const stops = reachable(squareContext(openGrid(8, 6), 2), start, 1);
    for (const d of DIRECTIONS) {
      expect(stops.has(posKey({ x: start.x + d.x, y: start.y + d.y }))).toBe(true);
    }
  });

  it('refuses a diagonal that squeezes past a blocked corner', () => {
    const grid = laidOut([{ pos: { x: 3, y: 2 }, tile: { ...DEFAULT_TILE, blocked: true } }]);
    const stops = reachable(squareContext(grid, 2), { x: 2, y: 2 }, 1);
    expect(stops.has(posKey({ x: 3, y: 3 }))).toBe(false);
  });
});

describe('flat standing versus straddling steps', () => {
  it('lets a 2x2 pass through a straddle but not stop on one', () => {
    let grid = openGrid(8, 6);
    for (let y = 0; y < 6; y++) {
      for (let x = 3; x < 8; x++) grid = withTile(grid, { x, y }, tier(1));
    }
    const ctx = squareContext(grid, 2);
    const start = { x: 1, y: 1 };

    const stops = reachable(ctx, start, 4);
    // (2,1) straddles the 0/1 boundary: legal to step through, not to rest on.
    expect(stops.has(posKey({ x: 2, y: 1 }))).toBe(false);
    expect(stops.get(posKey({ x: 3, y: 1 }))?.cost).toBe(4);

    expect(pathCost(ctx, start, [{ x: 2, y: 1 }])).toBeNull();
    expect(
      pathCost(ctx, start, [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
      ]),
    ).toBe(4);
  });
});
