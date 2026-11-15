import { describe, expect, it } from 'vitest';
import type { Tile, TileRank } from './boardCursor';
import { cycleCursor, cycleOrder, stepCursor } from './boardCursor';

const t = (x: number, y: number): Tile => ({ x, y });
const from = t(5, 5);

describe('stepCursor', () => {
  it('takes the adjacent legal tile when there is one', () => {
    const tiles = [t(6, 5), t(7, 5), t(6, 6)];
    expect(stepCursor(tiles, from, 'right')).toEqual(t(6, 5));
    expect(stepCursor(tiles, from, 'down')).toEqual(t(6, 6));
  });

  it('prefers the nearest tile inside the 45 degree cone', () => {
    // (8,5) is straight ahead, (7,7) is on the cone edge but costs more.
    expect(stepCursor([t(7, 7), t(8, 5)], from, 'right')).toEqual(t(8, 5));
    // (7,9) is outside the cone and must lose to a farther tile inside it.
    expect(stepCursor([t(7, 9), t(10, 6)], from, 'right')).toEqual(t(10, 6));
  });

  it('falls back to a tile outside the cone only when the cone is empty', () => {
    expect(stepCursor([t(7, 9), t(4, 5)], from, 'right')).toEqual(t(7, 9));
  });

  it('never returns a tile behind or exactly sideways', () => {
    expect(stepCursor([t(4, 5), t(5, 9), t(5, 1)], from, 'right')).toBeNull();
    expect(stepCursor([t(5, 5)], from, 'up')).toBeNull();
    expect(stepCursor([], from, 'left')).toBeNull();
  });

  it('does not depend on the order of the candidates', () => {
    const tiles = [t(8, 4), t(8, 6), t(7, 3), t(9, 5), t(7, 8)];
    const expected = stepCursor(tiles, from, 'right');
    expect(expected).not.toBeNull();
    expect(stepCursor([...tiles].reverse(), from, 'right')).toEqual(expected);
    const shuffled = [t(7, 8), t(8, 6), t(9, 5), t(7, 3), t(8, 4)];
    expect(stepCursor(shuffled, from, 'right')).toEqual(expected);
  });
});

describe('cycleOrder', () => {
  const rankOf = new Map<string, TileRank>([
    ['1,1', 1],
    ['9,9', 0],
    ['2,2', 2],
    ['3,0', 0],
  ]);
  const rank = (tile: Tile): TileRank => rankOf.get(`${tile.x},${tile.y}`) ?? 2;

  it('orders by rank, then distance, then reading order', () => {
    const order = cycleOrder([t(2, 2), t(9, 9), t(1, 1), t(3, 0)], t(0, 0), rank);
    expect(order).toEqual([t(3, 0), t(9, 9), t(1, 1), t(2, 2)]);
  });

  it('breaks distance ties in reading order, y then x', () => {
    const order = cycleOrder([t(2, 1), t(1, 2), t(2, 0), t(0, 2)], t(0, 0), () => 2);
    expect(order).toEqual([t(2, 0), t(2, 1), t(0, 2), t(1, 2)]);
  });

  it('does not mutate its input', () => {
    const input = [t(3, 3), t(1, 1)];
    const copy = [...input];
    cycleOrder(input, t(0, 0), () => 2);
    expect(input).toEqual(copy);
  });
});

describe('cycleCursor', () => {
  const order = [t(1, 1), t(2, 2), t(3, 3)];

  it('steps forward and back, wrapping at both ends', () => {
    expect(cycleCursor(order, t(1, 1), 1)).toEqual(t(2, 2));
    expect(cycleCursor(order, t(3, 3), 1)).toEqual(t(1, 1));
    expect(cycleCursor(order, t(2, 2), -1)).toEqual(t(1, 1));
    expect(cycleCursor(order, t(1, 1), -1)).toEqual(t(3, 3));
  });

  it('starts at the first entry forward and the last backward from nowhere', () => {
    expect(cycleCursor(order, null, 1)).toEqual(t(1, 1));
    expect(cycleCursor(order, null, -1)).toEqual(t(3, 3));
    expect(cycleCursor(order, t(9, 9), 1)).toEqual(t(1, 1));
    expect(cycleCursor(order, t(9, 9), -1)).toEqual(t(3, 3));
  });

  it('returns null for an empty order', () => {
    expect(cycleCursor([], null, 1)).toBeNull();
    expect(cycleCursor([], t(1, 1), -1)).toBeNull();
  });
});
