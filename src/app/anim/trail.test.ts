import { describe, expect, it } from 'vitest';
import { BA_DAN_VILLAGE } from '../../content/maps/village';
import { buildGrid, distance, posKey, tileAt } from '../../core/rules/grid';
import { PartyTrail, placeParty } from './trail';

const grid = buildGrid(BA_DAN_VILLAGE);
const spawn = BA_DAN_VILLAGE.partySpawns[0] ?? { x: 3, y: 7 };

describe('placeParty', () => {
  const exit = BA_DAN_VILLAGE.exit?.pos ?? { x: 23, y: 7 };

  it('seats the leader on the spawn and the others in a line, each on a free tile beside the last', () => {
    const seats = placeParty(grid, spawn, 4);
    expect(seats).toHaveLength(4);
    expect(seats[0]).toEqual(spawn);
    expect(new Set(seats.map(posKey)).size).toBe(4);
    seats.forEach((seat, index) => {
      expect(tileAt(grid, seat)?.blocked).toBeFalsy();
      const previous = seats[index - 1];
      if (previous) expect(distance(seat, previous)).toBe(1);
    });
  });

  it('leads the line straight away from the exit', () => {
    expect(placeParty(grid, spawn, 4, { awayFrom: exit })).toEqual([
      { x: 3, y: 7 },
      { x: 2, y: 7 },
      { x: 1, y: 7 },
      { x: 0, y: 7 },
    ]);
  });

  it('keeps off the tiles it is told to avoid', () => {
    const avoid = [{ x: 2, y: 7 }];
    const seats = placeParty(grid, spawn, 3, { awayFrom: exit, avoid });
    expect(seats.map(posKey)).not.toContain(posKey(avoid[0] ?? spawn));
    expect(distance(seats[1] ?? spawn, spawn)).toBe(1);
  });

  it('is the same every time', () => {
    expect(placeParty(grid, spawn, 6)).toEqual(placeParty(grid, spawn, 6));
  });

  it('stacks a party larger than the open ground on the last tile taken', () => {
    // A two-tile pocket: nothing else walkable round it.
    const pocket = buildGrid({
      ...BA_DAN_VILLAGE,
      width: 3,
      height: 4,
      rows: ['TTT', 'T,T', 'T,T', 'TTT'],
      partySpawns: [{ x: 1, y: 1 }],
      npcs: [],
      exit: undefined,
    });
    expect(placeParty(pocket, { x: 1, y: 1 }, 4)).toEqual([
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 2 },
      { x: 1, y: 2 },
    ]);
  });
});

describe('PartyTrail', () => {
  const exit = BA_DAN_VILLAGE.exit?.pos ?? { x: 23, y: 7 };
  const a = { x: 3, y: 7 };
  const b = { x: 4, y: 7 };
  const c = { x: 4, y: 8 };
  const p1 = { x: 3, y: 6 };
  const p2 = { x: 3, y: 5 };
  const p3 = { x: 3, y: 4 };

  it('moves every follower one tile further back than the one before, along the walked route', () => {
    const trail = new PartyTrail([a, b, c]);
    const routes = trail.walk([p1, p2, p3], 3);
    expect(trail.positions(3)).toEqual([p3, p2, p1]);
    expect(routes).toEqual([
      { index: 1, from: b, path: [a, p1, p2] },
      { index: 2, from: c, path: [b, a, p1] },
    ]);
  });

  it('shuffles the line up by one for a single step', () => {
    const trail = new PartyTrail([a, b, c]);
    trail.walk([p1, p2, p3], 3);
    const q = { x: 4, y: 4 };
    const routes = trail.walk([q], 3);
    expect(trail.positions(3)).toEqual([q, p3, p2]);
    expect(routes).toEqual([
      { index: 1, from: p2, path: [p3] },
      { index: 2, from: p1, path: [p2] },
    ]);
  });

  it('does nothing for an empty walk and repeats the last tile for a short line', () => {
    const trail = new PartyTrail([a]);
    expect(trail.walk([], 3)).toEqual([]);
    expect(trail.positions(3)).toEqual([a, a, a]);
    expect(trail.head).toEqual(a);
    const routes = trail.walk([p1], 3);
    expect(trail.positions(3)).toEqual([p1, a, a]);
    // Nobody's place changed: the two behind still share the old tile.
    expect(routes).toEqual([]);
  });

  it('walks every follower for exactly as many steps as the leader', () => {
    const trail = new PartyTrail(placeParty(grid, spawn, 4, { awayFrom: exit }));
    const walk = [p1, p2, p3, { x: 3, y: 3 }, { x: 4, y: 3 }];
    for (const route of trail.walk(walk, 4)) expect(route.path).toHaveLength(walk.length);
  });
});
