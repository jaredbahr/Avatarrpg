/**
 * The board cursor (ADR 0115 §3).
 *
 * A keyboard or a gamepad has no pointer, and a free pixel cursor on a tactics
 * board is slow and easy to misplace. So the cursor only ever stands on a tile
 * that means something now (a reachable tile, a legal target, a unit) and a
 * direction takes it to the next such tile that way. Pure: the scene supplies
 * the legal tiles and draws the result.
 */

import type { Direction } from './actions';
import { directionVector } from './actions';

export interface Tile {
  readonly x: number;
  readonly y: number;
}

const same = (a: Tile, b: Tile): boolean => a.x === b.x && a.y === b.y;

/**
 * Where a direction takes the cursor: the adjacent legal tile if there is one,
 * otherwise the nearest legal tile inside the 45° cone that way, otherwise the
 * nearest one anywhere on that side. Null when nothing lies that way, so the
 * cursor stays put rather than wrapping or jumping behind.
 */
export function stepCursor(
  candidates: readonly Tile[],
  from: Tile,
  direction: Direction,
): Tile | null {
  const step = directionVector(direction);
  const adjacent = candidates.find((tile) =>
    same(tile, { x: from.x + step.x, y: from.y + step.y }),
  );
  if (adjacent) return adjacent;

  let best: { tile: Tile; inCone: boolean; cost: number; across: number } | null = null;
  for (const tile of candidates) {
    const dx = tile.x - from.x;
    const dy = tile.y - from.y;
    const along = dx * step.x + dy * step.y;
    if (along <= 0) continue;
    const across = Math.abs(dx * step.y) + Math.abs(dy * step.x);
    const entry = { tile, inCone: across <= along, cost: along + across * 2, across };
    if (!best || betterStep(entry, best)) best = entry;
  }
  return best?.tile ?? null;
}

function betterStep(
  a: { tile: Tile; inCone: boolean; cost: number; across: number },
  b: { tile: Tile; inCone: boolean; cost: number; across: number },
): boolean {
  if (a.inCone !== b.inCone) return a.inCone;
  if (a.cost !== b.cost) return a.cost < b.cost;
  if (a.across !== b.across) return a.across < b.across;
  // Reading order, so the answer never depends on the order the tiles came in.
  return a.tile.y !== b.tile.y ? a.tile.y < b.tile.y : a.tile.x < b.tile.x;
}

/** What stands on a legal tile, for the cycle order: an enemy first, an empty tile last. */
export type TileRank = 0 | 1 | 2;

/**
 * The order `next` and `prev` walk the legal tiles in: tiles holding an enemy,
 * then other occupied tiles, then empty ones; within each, nearest the origin
 * first (in steps, counting a diagonal as one), ties in reading order.
 */
export function cycleOrder<T extends Tile>(
  candidates: readonly T[],
  origin: Tile,
  rank: (tile: T) => TileRank,
): T[] {
  const reach = (tile: Tile): number =>
    Math.max(Math.abs(tile.x - origin.x), Math.abs(tile.y - origin.y));
  return [...candidates].sort(
    (a, b) => rank(a) - rank(b) || reach(a) - reach(b) || a.y - b.y || a.x - b.x,
  );
}

/** The tile after (or before) the cursor in the cycle, wrapping; the first one from nowhere. */
export function cycleCursor<T extends Tile>(
  order: readonly T[],
  current: Tile | null,
  step: 1 | -1,
): T | null {
  if (order.length === 0) return null;
  const index = current ? order.findIndex((tile) => same(tile, current)) : -1;
  if (index < 0) return order[step === 1 ? 0 : order.length - 1] ?? null;
  return order[(index + step + order.length) % order.length] ?? null;
}
