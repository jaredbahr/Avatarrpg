import { describe, expect, it } from 'vitest';
import { BA_DAN_VILLAGE } from '../../content/maps/village';
import { CONTENT } from '../../content';
import { createGame } from '../../core/state/createGame';
import { visibleNpcs } from '../../core/story/world';
import {
  buildGrid,
  distance,
  posKey,
  tileAt,
  pathCost,
  samePos,
  findPath,
} from '../../core/rules/grid';
import { PartyTrail, placeParty, temporalRoutes } from './trail';
import type { FollowerRoute } from './trail';
import { TIMING } from './choreography';
import { strollTiming } from './stroll';
import { smoothPath, sampleFraction } from '../../render/geometry/curve';

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
    // Straight west along the road until the ford at (0,7), then beside it.
    expect(placeParty(grid, spawn, 4, { awayFrom: exit })).toEqual([
      { x: 3, y: 7 },
      { x: 2, y: 7 },
      { x: 1, y: 7 },
      { x: 1, y: 8 },
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

describe('settled party formation', () => {
  const open = buildGrid({
    ...BA_DAN_VILLAGE,
    width: 9,
    height: 9,
    rows: Array.from({ length: 9 }, () => ',,,,,,,,,'),
    npcs: [],
  });
  const members = [4, 3, 2, 1, 0].map((x) => ({ x, y: 4 }));

  it('gathers near the unchanged leader with distinct legal seats and real routes', () => {
    const trail = new PartyTrail(members);
    const avoid = [{ x: 4, y: 3 }];
    const routes = trail.settle(open, avoid);
    expect(routes.length).toBeGreaterThan(0);
    expect(trail.head).toEqual(members[0]);
    expect(new Set(trail.positions(5).map(posKey)).size).toBe(5);
    for (const seat of trail.positions(5)) {
      expect(distance(seat, members[0] ?? { x: 4, y: 4 })).toBeLessThanOrEqual(2);
      expect(avoid.map(posKey)).not.toContain(posKey(seat));
    }
    for (const route of routes) {
      expect(route.from).toEqual(members[route.index]);
      expect(
        pathCost(
          { grid: open, blocked: new Set(avoid.map(posKey)), surfaces: new Map(), size: 1 },
          route.from,
          route.path,
        ),
      ).not.toBeNull();
      expect(route.path.at(-1)).toEqual(trail.positions(5)[route.index]);
    }
    expect(trail.settle(open, avoid)).toEqual([]);
  });

  it('gathers a column beside the leader on the top-down board, none stacked on another', () => {
    // A walk north leaves the line as a column under the leader.
    const column = [4, 5, 6].map((y) => ({ x: 4, y }));
    const trail = new PartyTrail(column);
    const routes = trail.settle(open, [], { beside: true });
    expect(routes.length).toBeGreaterThan(0);
    const seats = trail.positions(3);
    expect(seats[0]).toEqual(column[0]);
    expect(new Set(seats.map(posKey)).size).toBe(3);
    for (const [i, seat] of seats.entries()) {
      expect(distance(seat, column[0] ?? { x: 4, y: 4 })).toBeLessThanOrEqual(2);
      for (const other of seats.slice(0, i))
        expect(other.x === seat.x && Math.abs(other.y - seat.y) === 1, posKey(seat)).toBe(false);
    }
    // Settled, it stays settled.
    expect(trail.settle(open, [], { beside: true })).toEqual([]);
  });

  it('prefers dry resting seats and stays put when every nearby seat is permanent water', () => {
    const pond = {
      ...open,
      tiles: open.tiles.map((tile, index) => {
        const pos = { x: index % open.width, y: Math.floor(index / open.width) };
        return distance(pos, { x: 4, y: 4 }) <= 2 && !samePos(pos, { x: 4, y: 4 })
          ? { ...tile, surface: { id: 'water' as const, duration: -1, spread: 0 } }
          : tile;
      }),
    };
    const start = [
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    const held = new PartyTrail(start);
    expect(held.settle(pond)).toEqual([]);
    expect(held.positions(2)).toEqual(start);
    const shore = {
      ...pond,
      tiles: pond.tiles.map((tile, index) =>
        index === 4 * pond.width + 2 ? { ...tile, surface: null } : tile,
      ),
    };
    const trail = new PartyTrail(start);
    expect(trail.settle(shore)).toHaveLength(1);
    expect(trail.positions(2)[1]).toEqual({ x: 2, y: 4 });
  });

  it('paths from clustered seats on the next walk instead of treating them as breadcrumbs', () => {
    const trail = new PartyTrail(members);
    trail.settle(open);
    const before = trail.positions(5);
    const routes = trail.walk(
      [
        { x: 5, y: 4 },
        { x: 6, y: 4 },
        { x: 6, y: 5 },
      ],
      5,
    );
    for (const route of routes) {
      expect(route.from).toEqual(before[route.index]);
      expect(
        pathCost(
          { grid: open, blocked: new Set(), surfaces: new Map(), size: 1 },
          route.from,
          route.path,
        ),
      ).not.toBeNull();
      expect(route.path.at(-1)).toEqual(trail.positions(5)[route.index]);
    }
    expect(trail.head).toEqual({ x: 6, y: 5 });
  });

  it('does not gather through a blocked diagonal or teleport from disconnected ground', () => {
    const pocket = buildGrid({
      ...BA_DAN_VILLAGE,
      width: 3,
      height: 3,
      rows: [',TT', 'T,T', 'TT,'],
      npcs: [],
    });
    const seats = [
      { x: 0, y: 0 },
      { x: 2, y: 2 },
    ];
    const trail = new PartyTrail(seats);
    expect(trail.settle(pocket)).toEqual([]);
    expect(trail.positions(2)).toEqual(seats);
  });
});

describe('reserved movement batches', () => {
  const open = buildGrid({
    ...BA_DAN_VILLAGE,
    width: 9,
    height: 9,
    rows: Array.from({ length: 9 }, () => ',,,,,,,,,'),
    npcs: [],
  });
  const canalSeats = [
    { x: 11, y: 3 },
    { x: 10, y: 4 },
    { x: 10, y: 5 },
    { x: 9, y: 5 },
    { x: 12, y: 5 },
  ];
  const canalPath = [
    { x: 10, y: 4 },
    { x: 10, y: 5 },
  ];
  const canalNpcs = [
    { x: 11, y: 5 },
    { x: 9, y: 4 },
  ];

  function sample(
    route: { from: { x: number; y: number }; path: readonly { x: number; y: number }[] },
    t: number,
  ) {
    const curve = smoothPath(route.from, route.path);
    const timing = strollTiming(curve.length, TIMING.strollStep);
    const pos = sampleFraction(curve, timing.ease(t / timing.duration)).pos;
    return { x: pos.x - 0.5, y: pos.y - 0.5 };
  }

  it('clears the leader corridor and keeps stationary and moving members separated through a turn', () => {
    const before = [
      { x: 3, y: 4 },
      { x: 4, y: 4 },
      { x: 3, y: 5 },
      { x: 2, y: 4 },
      { x: 2, y: 5 },
    ];
    const trail = new PartyTrail(before);
    const leaderPath = [
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 5, y: 5 },
      { x: 6, y: 5 },
    ];
    const plan = trail.planWalk(leaderPath, 5, open);
    expect(plan).not.toBeNull();
    const positions = [...before];
    const batches = plan?.batches ?? [];
    expect(batches.findIndex((batch) => batch.some((route) => route.index === 0))).toBeGreaterThan(
      0,
    );
    expect(batches.flat().find((route) => route.index === 0)?.path).toEqual(leaderPath);
    for (const batch of batches) {
      for (const route of batch) {
        expect(route.from).toEqual(positions[route.index]);
        expect(
          pathCost(
            { grid: open, blocked: new Set(), surfaces: new Map(), size: 1 },
            route.from,
            route.path,
          ),
        ).not.toBeNull();
      }
      const phaseEnd = Math.max(
        ...batch.map(
          (route) =>
            (route.delayMs ?? 0) +
            strollTiming(smoothPath(route.from, route.path).length, TIMING.strollStep).duration,
        ),
      );
      for (let tick = 0; tick <= phaseEnd + 5; tick += 5) {
        const drawn = positions.map((position, index) => {
          const route = batch.find((candidate) => candidate.index === index);
          return route ? sample(route, tick - (route.delayMs ?? 0)) : position;
        });
        for (let i = 0; i < drawn.length; i++)
          for (let j = i + 1; j < drawn.length; j++) {
            const a = drawn[i];
            const b = drawn[j];
            if (a && b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(0.79);
          }
      }
      for (const route of batch) positions[route.index] = route.path.at(-1) ?? route.from;
    }
    expect(positions).toEqual(trail.positions(5));
    expect(trail.head).toEqual(leaderPath.at(-1));
  });

  it('allows independent clearance routes to share a batch', () => {
    const trail = new PartyTrail([
      { x: 1, y: 4 },
      { x: 3, y: 4 },
      { x: 6, y: 4 },
    ]);
    const path = [2, 3, 4, 5, 6, 7].map((x) => ({ x, y: 4 }));
    const plan = trail.planWalk(path, 3, open);
    expect(plan?.batches[0]?.length).toBe(2);
    expect(plan?.batches[0]?.every((route) => route.index !== 0)).toBe(true);
  });

  it('tries a farther clearance seat when the nearest one traps another follower at the canal', () => {
    const trail = new PartyTrail(canalSeats);
    const plan = trail.planWalk(canalPath, 5, grid, canalNpcs);
    expect(plan).not.toBeNull();
    expect(plan?.batches[0]?.map((route) => route.path.at(-1))).toEqual([
      { x: 13, y: 4 },
      { x: 12, y: 4 },
    ]);
    expect(new Set(trail.positions(5).map(posKey)).size).toBe(5);
    for (const route of plan?.batches.flat() ?? []) {
      expect(
        pathCost(
          { grid, blocked: new Set(canalNpcs.map(posKey)), surfaces: new Map(), size: 1 },
          route.from,
          route.path,
        ),
      ).not.toBeNull();
    }
  });

  it('keeps seats when a follower has a clearance seat but every choice traps the next one', () => {
    const trail = new PartyTrail(canalSeats);
    const avoid = [...canalNpcs, { x: 13, y: 4 }, { x: 13, y: 5 }, { x: 13, y: 6 }];
    expect(trail.planWalk(canalPath, 5, grid, avoid)).toBeNull();
    expect(trail.positions(5)).toEqual(canalSeats);
  });

  it('reports unavailable clearance without changing seats in a one-cell corridor', () => {
    const corridor = buildGrid({
      ...BA_DAN_VILLAGE,
      width: 5,
      height: 3,
      rows: ['TTTTT', 'T,,,T', 'TTTTT'],
      npcs: [],
    });
    const before = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ];
    const trail = new PartyTrail(before);
    expect(
      trail.planWalk(
        [
          { x: 2, y: 1 },
          { x: 3, y: 1 },
        ],
        3,
        corridor,
      ),
    ).toBeNull();
    expect(trail.positions(3)).toEqual(before);
  });
});

describe('temporal movement reservations', () => {
  it('follows a long shared corridor in parallel instead of adding every route duration', () => {
    const seats = [
      { x: 4, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ];
    const routes = seats.map((from, index) => ({
      index,
      from,
      path: Array.from({ length: 12 }, (_, i) => ({ x: from.x + i + 1, y: 2 })),
    }));
    const timed = temporalRoutes(routes, seats);
    expect(timed).not.toBeNull();
    expect(timed?.every((route) => (route.delayMs ?? 0) < 300)).toBe(true);
    const ends =
      timed?.map(
        (route) =>
          (route.delayMs ?? 0) +
          strollTiming(smoothPath(route.from, route.path).length, TIMING.strollStep).duration,
      ) ?? [];
    expect(Math.max(...ends)).toBeLessThan(12 * TIMING.strollStep + 500);
  });

  it('delays crossing trajectories and keeps starts and final holds separated', () => {
    const seats = [
      { x: 1, y: 3 },
      { x: 3, y: 1 },
      { x: 7, y: 7 },
    ];
    const routes = [
      {
        index: 0,
        from: seats[0] ?? { x: 1, y: 3 },
        path: [
          { x: 2, y: 3 },
          { x: 3, y: 3 },
          { x: 4, y: 3 },
          { x: 5, y: 3 },
        ],
      },
      {
        index: 1,
        from: seats[1] ?? { x: 3, y: 1 },
        path: [
          { x: 3, y: 2 },
          { x: 3, y: 3 },
          { x: 3, y: 4 },
          { x: 3, y: 5 },
        ],
      },
    ];
    const timed = temporalRoutes(routes, seats);
    expect(timed).not.toBeNull();
    expect(timed?.[1]?.delayMs).toBeGreaterThan(0);
    expect(timed?.[1]?.delayMs).toBeLessThan(4 * TIMING.strollStep);
    const end = Math.max(
      ...(timed ?? []).map(
        (route) =>
          (route.delayMs ?? 0) +
          strollTiming(smoothPath(route.from, route.path).length, TIMING.strollStep).duration,
      ),
    );
    for (let time = 0; time <= end + 5; time += 5) {
      const positions = (timed ?? []).map((route) => {
        const curve = smoothPath(route.from, route.path);
        const timing = strollTiming(curve.length, TIMING.strollStep);
        const pos = sampleFraction(
          curve,
          timing.ease((time - (route.delayMs ?? 0)) / timing.duration),
        ).pos;
        if (time < (route.delayMs ?? 0))
          expect(pos).toEqual({ x: route.from.x + 0.5, y: route.from.y + 0.5 });
        return pos;
      });
      const a = positions[0];
      const b = positions[1];
      if (a && b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('rejects a stationary final hold that can never clear another member', () => {
    expect(
      temporalRoutes(
        [
          {
            index: 0,
            from: { x: 0, y: 0 },
            path: [
              { x: 1, y: 0 },
              { x: 2, y: 0 },
            ],
          },
        ],
        [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
        ],
      ),
    ).toBeNull();
  });
});

it('keeps the five-leg courtyard audit separated without the serial cadence regression', () => {
  // Where the village's NPCs stand on a new game's first midday (ADR 0047 §8).
  const fresh = createGame(CONTENT, {
    seed: 'courtyard-audit',
    party: [{ characterId: 'kaya' }],
    startNode: 'village_explore',
  });
  const avoid = visibleNpcs(CONTENT, BA_DAN_VILLAGE, fresh).map((npc) => npc.pos);
  const trail = new PartyTrail(
    placeParty(grid, spawn, 5, { awayFrom: BA_DAN_VILLAGE.exit?.pos, avoid }),
  );
  trail.settle(grid, avoid);
  let positions = trail.positions(5);
  let total = 0;
  let serialTotal = 0;
  const checkPhase = (routes: readonly FollowerRoute[]) => {
    const tracks = routes.map((route) => {
      const curve = smoothPath(route.from, route.path);
      return { route, curve, timing: strollTiming(curve.length, TIMING.strollStep) };
    });
    const end = Math.max(
      0,
      ...tracks.map((track) => (track.route.delayMs ?? 0) + track.timing.duration),
    );
    for (let time = 0; time <= end + 5; time += 5) {
      const drawn = positions.map((position, index) => {
        const track = tracks.find((track) => track.route.index === index);
        if (!track) return position;
        const pos = sampleFraction(
          track.curve,
          track.timing.ease((time - (track.route.delayMs ?? 0)) / track.timing.duration),
        ).pos;
        return { x: pos.x - 0.5, y: pos.y - 0.5 };
      });
      for (let i = 0; i < drawn.length; i++)
        for (let j = i + 1; j < drawn.length; j++) {
          const a = drawn[i];
          const b = drawn[j];
          if (a && b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(0.8);
        }
    }
    positions = positions.map((position, index) => {
      const route = routes.find((route) => route.index === index);
      return route?.path.at(-1) ?? position;
    });
    total += end;
    serialTotal += tracks.reduce((sum, track) => sum + track.timing.duration, 0);
  };
  for (const target of [
    { x: 10, y: 7 },
    { x: 10, y: 3 },
    { x: 11, y: 3 },
    { x: 10, y: 5 },
    { x: 10, y: 7 },
  ]) {
    const from = trail.head ?? spawn;
    const walk = findPath(
      { grid, blocked: new Set(avoid.map(posKey)), surfaces: new Map(), size: 1 },
      from,
      target,
      grid.width * grid.height,
    );
    expect(walk).not.toBeNull();
    const plan = trail.planWalk(walk?.path ?? [], 5, grid, avoid);
    expect(plan).not.toBeNull();
    for (const phase of plan?.batches ?? []) checkPhase(phase);
    checkPhase(trail.settle(grid, avoid));
    expect(positions).toEqual(trail.positions(5));
    expect(trail.head).toEqual(target);
  }
  // The canal lengthens legal routes; compare the actual phase schedule with
  // the same routes played serially to guard the five-walker overlap.
  expect(total).toBeLessThan(serialTotal / 2);
});

describe('a follower joining and leaving the line (#696)', () => {
  it('seats a newcomer beside the last member without moving anyone already standing', () => {
    const seats = placeParty(grid, spawn, 3);
    const trail = new PartyTrail(seats);
    trail.resize(4, grid);
    const after = trail.positions(4);
    expect(trail.size).toBe(4);
    expect(after.slice(0, 3)).toEqual(seats);
    const newcomer = after[3];
    const tail = seats[2];
    expect(newcomer && tail && distance(newcomer, tail)).toBe(1);
    expect(new Set(after.map(posKey)).size).toBe(4);
    expect(newcomer && tileAt(grid, newcomer)?.blocked).toBeFalsy();
  });

  it('seats a newcomer exactly where placeParty would have seated a member of that line', () => {
    const trail = new PartyTrail(placeParty(grid, spawn, 2));
    trail.resize(4, grid);
    expect(trail.positions(4)).toEqual(placeParty(grid, spawn, 4));
  });

  it('keeps a newcomer off the tiles it is told to avoid', () => {
    const seats = placeParty(grid, spawn, 3);
    const unrestricted = new PartyTrail(seats);
    unrestricted.resize(4, grid);
    const usual = unrestricted.positions(4)[3];
    expect(usual).toBeDefined();
    const trail = new PartyTrail(seats);
    trail.resize(4, grid, usual ? [usual] : []);
    const moved = trail.positions(4)[3];
    expect(moved && usual && samePos(moved, usual)).toBe(false);
  });

  it('lets a leaver go from the end of the line and leaves everyone else standing', () => {
    const seats = placeParty(grid, spawn, 4);
    const trail = new PartyTrail(seats);
    trail.resize(3, grid);
    expect(trail.size).toBe(3);
    expect(trail.positions(3)).toEqual(seats.slice(0, 3));
  });

  it('walks a follower on the end of the line one tile behind the last member', () => {
    const trail = new PartyTrail(placeParty(grid, spawn, 3));
    trail.resize(4, grid);
    const before = trail.positions(4);
    const path = [
      { x: spawn.x, y: spawn.y + 1 },
      { x: spawn.x, y: spawn.y + 2 },
    ];
    const routes = trail.walk(path, 4);
    // Two steps on, everyone takes the tile two places ahead of them in the line.
    expect(routes.some((route) => route.index === 3)).toBe(true);
    const after = trail.positions(4);
    expect(after[3]).toEqual(before[1]);
    const last = after[2];
    const follower = after[3];
    expect(last && follower && distance(last, follower)).toBe(1);
  });
});
