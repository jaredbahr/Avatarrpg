import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { RngCursor, seedFromString } from '../rng';
import { BattleDraft } from '../state/battleDraft';
import { createBattle, createGame } from '../state/createGame';
import type { Grid, Tile, Unit, Vec2 } from '../types';
import {
  DEFAULT_TILE,
  findPath,
  neighbors,
  posKey,
  reachable,
  standCost,
  tileAt,
  type MoveContext,
  type ReachableCell,
} from './grid';

const ENCOUNTERS = ['enc_forest_road', 'enc_quarry_gate', 'enc_ambush', 'enc_grumbler'];
const SURFACES = [null, 'water', 'mud', 'oil', 'rubble', 'ice'] as const;

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function positions(grid: Grid): Vec2[] {
  return Array.from({ length: grid.width * grid.height }, (_, index) => ({
    x: index % grid.width,
    y: Math.floor(index / grid.width),
  }));
}

/** Deliberately enumerate the footprint without the production footprint helpers. */
function cells(ctx: MoveContext, anchor: Vec2): Vec2[] {
  const out: Vec2[] = [];
  for (let y = 0; y < (ctx.squareFootprints === false ? 1 : ctx.size); y++) {
    for (let x = 0; x < ctx.size; x++) out.push({ x: anchor.x + x, y: anchor.y + y });
  }
  return out;
}

function checkOccupancy(
  ctx: MoveContext,
  mover: Unit,
  units: readonly Unit[],
  label: string,
): void {
  const expected = new Set(
    units
      .filter((unit) => unit.hp > 0 && unit.id !== mover.id)
      .flatMap((unit) => cells({ ...ctx, size: unit.size }, unit.pos).map(posKey)),
  );
  expect([...ctx.blocked].sort(), `${label}: living allies/enemies, excluding mover`).toEqual(
    [...expected].sort(),
  );
}

/**
 * Graph edges come from the rules contract, never enterCost/pathCost/reachable.
 * Flattening heights lets standCost supply occupancy/surface cost for transient
 * straddles. Cross-check that shared primitive against raw tiles at every anchor.
 */
function reference(ctx: MoveContext, label: string) {
  const anchors = positions(ctx.grid);
  const index = (p: Vec2) => p.y * ctx.grid.width + p.x;
  const flat = {
    ...ctx,
    grid: { ...ctx.grid, tiles: ctx.grid.tiles.map((t) => ({ ...t, elevation: 0 })) },
  };
  const base = anchors.map((p) => {
    let raw: number | null = 1;
    const footprint = cells(ctx, p).map((cell) => ({ cell, tile: tileAt(ctx.grid, cell) }));
    for (const { cell, tile } of footprint) {
      if (!tile || tile.blocked || ctx.blocked.has(posKey(cell))) {
        raw = null;
        break;
      }
      raw = Math.max(
        raw,
        1 + (tile.surface ? (ctx.surfaces.get(tile.surface.id)?.moveCost ?? 0) : 0),
      );
    }
    check(standCost(flat, p) === raw, `${label}: footprint cost at ${posKey(p)}`);
    const level = footprint[0]?.tile?.elevation;
    const mayStand =
      ctx.squareFootprints === false || footprint.every(({ tile }) => tile?.elevation === level);
    check(standCost(ctx, p) === (mayStand ? raw : null), `${label}: standing at ${posKey(p)}`);
    return raw;
  });
  const step = (from: Vec2, to: Vec2): number | null => {
    const destination = tileAt(ctx.grid, to) ? base[index(to)] : null;
    if (destination === null || destination === undefined) return null;
    let surcharge = 0;
    const origins = cells(ctx, from);
    const targets = cells(ctx, to);
    for (let i = 0; i < origins.length; i++) {
      const origin = origins[i];
      const target = targets[i];
      const a = origin && tileAt(ctx.grid, origin);
      const b = target && tileAt(ctx.grid, target);
      if (!a || !b || Math.abs(a.elevation - b.elevation) >= 2) return null;
      if (b.elevation > a.elevation && !a.ramp && !b.ramp) {
        if (ctx.climbCost === undefined) return null;
        surcharge = Math.max(surcharge, ctx.climbCost);
      }
    }
    return destination + surcharge;
  };
  const edge = (from: Vec2, to: Vec2): number | null => {
    if (Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) !== 1) return null;
    if (from.x !== to.x && from.y !== to.y) {
      if (step(from, { x: to.x, y: from.y }) === null) return null;
      if (step(from, { x: from.x, y: to.y }) === null) return null;
    }
    return step(from, to);
  };
  const shortest = (start: Vec2, budget: number): Map<string, number> => {
    // Dense O(V²) Dijkstra: no production sorted frontier or stored paths.
    const distances = anchors.map(() => Infinity);
    const settled = new Set<number>();
    distances[index(start)] = 0;
    for (;;) {
      let chosen = -1;
      let minimum = Infinity;
      for (let i = 0; i < distances.length; i++) {
        const value = distances[i] ?? Infinity;
        if (!settled.has(i) && value < minimum) {
          chosen = i;
          minimum = value;
        }
      }
      if (chosen < 0 || minimum > budget) break;
      settled.add(chosen);
      const from = anchors[chosen];
      check(from !== undefined, `${label}: missing graph vertex`);
      for (const to of neighbors(ctx.grid, from)) {
        const cost = edge(from, to);
        if (cost !== null && minimum + cost < (distances[index(to)] ?? Infinity)) {
          distances[index(to)] = minimum + cost;
        }
      }
    }
    const stops = new Map<string, number>([[posKey(start), 0]]);
    for (const p of anchors) {
      const cost = distances[index(p)] ?? Infinity;
      if (cost <= budget && standCost(ctx, p) !== null) stops.set(posKey(p), cost);
    }
    return stops;
  };
  return { edge, shortest };
}

const coverage = {
  cases: 0,
  real: 0,
  large: 0,
  moving: 0,
  diagonal: 0,
  weighted: 0,
  transit: 0,
  allies: 0,
  enemies: 0,
  props: 0,
};

function compare(ctx: MoveContext, start: Vec2, budget: number, label: string): void {
  const oracle = reference(ctx, label);
  const expected = oracle.shortest(start, budget);
  const actual = reachable(ctx, start, budget);
  expect([...actual.keys()].sort(), label).toEqual([...expected.keys()].sort());
  const inspect = (entry: ReachableCell, goal: Vec2) => {
    let from = start;
    let total = 0;
    for (const to of entry.path) {
      const cost = oracle.edge(from, to);
      check(cost !== null, `${label}: illegal path edge ${posKey(from)} -> ${posKey(to)}`);
      total += cost;
      if (from.x !== to.x && from.y !== to.y) coverage.diagonal++;
      if (cost > 1) coverage.weighted++;
      if (standCost(ctx, to) === null) coverage.transit++;
      from = to;
    }
    check(
      posKey(from) === posKey(goal) && posKey(entry.pos) === posKey(goal),
      `${label}: path endpoint`,
    );
    check(
      total === entry.cost && total === expected.get(posKey(goal)),
      `${label}: path minimum cost`,
    );
    check(total <= budget, `${label}: over-budget path`);
    check(
      entry.path.length === 0 || posKey(entry.path[0] ?? start) !== posKey(start),
      `${label}: path includes start`,
    );
  };
  for (const entry of actual.values()) inspect(entry, entry.pos);
  // Check every goal, including unreachable anchors and the self special case.
  // Tied shortest paths need not have identical coordinates.
  for (const goal of positions(ctx.grid)) {
    const path = findPath(ctx, start, goal, budget);
    const cost = expected.get(posKey(goal));
    check(
      (path !== null) === (cost !== undefined),
      `${label}: findPath existence for ${posKey(goal)}`,
    );
    if (path) inspect(path, goal);
  }
  coverage.cases++;
  if (ctx.size === 2) coverage.large++;
  if (actual.size > 1) coverage.moving++;
}

function battle(encounter: string, seed: string) {
  const game = createGame(CONTENT, {
    seed,
    party: ['kaya', 'bo', 'nilak'].map((characterId) => ({
      characterId,
      level: 3,
      autoChoose: true,
    })),
    flags: { pella_asked: true, ruon_traded: true },
    startNode: '',
  });
  const rng = new RngCursor(game.rng);
  return createBattle(CONTENT, game, encounter, rng);
}

describe('movement against an independent seeded graph oracle (#517)', () => {
  it('matches 1,024 varied tiny boards and 32 authored combat contexts', () => {
    const template = battle('enc_forest_road', 'movement-517:templates');
    const party = template.units.find((u) => u.faction === 'party');
    const enemy = template.units.find((u) => u.faction === 'enemy');
    check(party !== undefined && enemy !== undefined, 'missing combat templates');
    for (let trial = 0; trial < 1024; trial++) {
      const label = `movement-517:tiny:${trial}`;
      const rng = new RngCursor(seedFromString(label));
      const width = rng.int(5, 8);
      const height = rng.int(4, 7);
      const size = trial % 2 === 0 ? 2 : 1;
      const grid = {
        width,
        height,
        tiles: Array.from({ length: width * height }, (_, i): Tile => {
          const x = i % width;
          const y = Math.floor(i / width);
          const surface = rng.pick(SURFACES);
          const elevation = trial % 4 < 2 ? Number(x >= Math.floor(width / 2)) : Math.floor(y / 2);
          return {
            ...DEFAULT_TILE,
            elevation,
            ramp: rng.chance(0.2),
            blocked: rng.chance(0.08),
            surface: surface ? { id: surface, duration: -1, spread: 0 } : null,
          };
        }),
      };
      const mover: Unit = { ...party, id: 'mover', pos: { x: 0, y: 0 }, size };
      // A real, flat start without filtering on production reachability.
      const empty: MoveContext = {
        grid,
        size,
        blocked: new Set(),
        surfaces: CONTENT.surfaces,
        climbCost: trial % 3,
        squareFootprints: true,
      };
      for (const p of cells(empty, mover.pos)) {
        const tile = tileAt(grid, p);
        check(tile !== undefined, `${label}: start outside board`);
        grid.tiles[p.y * width + p.x] = { ...tile, elevation: 0, blocked: false };
      }
      const units = [mover];
      const taken = new Set(cells(empty, mover.pos).map(posKey));
      for (const body of [party, enemy]) {
        const bodySize = rng.chance(0.3) ? 2 : 1;
        const options = rng.shuffle(positions(grid));
        const pos = options.find(
          (p) => standCost({ ...empty, size: bodySize, blocked: taken }, p) !== null,
        );
        if (!pos) continue;
        const unit: Unit = { ...body, id: `${body.faction}-blocker`, pos, size: bodySize };
        units.push(unit);
        for (const p of cells({ ...empty, size: bodySize }, pos)) taken.add(posKey(p));
        if (body.faction === 'party') coverage.allies++;
        else coverage.enemies++;
      }
      const draft = new BattleDraft(CONTENT, { ...template, grid, units, props: [] }, rng);
      const ctx = { ...draft.moveContext(mover), climbCost: empty.climbCost };
      checkOccupancy(ctx, mover, draft.units, label);
      compare(ctx, mover.pos, trial % 16, `${label}, size=${size}, budget=${trial % 16}`);
    }
    for (const encounter of ENCOUNTERS) {
      for (let trial = 0; trial < 8; trial++) {
        const label = `movement-517:${encounter}:${trial}`;
        const rng = new RngCursor(seedFromString(label));
        const draft = new BattleDraft(CONTENT, battle(encounter, label), rng);
        const mover =
          trial % 2 === 0
            ? (draft.units.find((u) => u.size === 2) ?? draft.units[0])
            : rng.pick(draft.units);
        check(mover !== undefined, `${label}: missing mover`);
        for (const prop of draft.props) {
          if (CONTENT.props.get(prop.propId)?.blocksMove) {
            check(tileAt(draft.grid, prop.pos)?.blocked === true, `${label}: prop was not baked`);
            coverage.props++;
          }
        }
        const ctx = draft.moveContext(mover);
        checkOccupancy(ctx, mover, draft.units, label);
        compare(ctx, mover.pos, trial * 2, label);
        coverage.real++;
      }
    }
    expect(coverage.cases).toBe(1056);
    expect(coverage.real).toBe(32);
    for (const category of ['large', 'moving', 'allies', 'enemies'] as const)
      expect(coverage[category], category).toBeGreaterThan(100);
    for (const category of ['diagonal', 'weighted', 'transit', 'props'] as const)
      expect(coverage[category], category).toBeGreaterThan(0);
  }, 15_000);

  it('pins straddling, both diagonal guards, worst costs, ramps, cliffs and self paths', () => {
    const grid: Grid = {
      width: 8,
      height: 5,
      tiles: Array.from({ length: 40 }, (_, i) => ({
        ...DEFAULT_TILE,
        elevation: i % 8 >= 3 ? 1 : 0,
      })),
    };
    const ctx: MoveContext = {
      grid,
      size: 2,
      blocked: new Set(),
      surfaces: CONTENT.surfaces,
      climbCost: 1,
      squareFootprints: true,
    };
    const start = { x: 1, y: 1 };
    expect(standCost(ctx, { x: 2, y: 1 })).toBeNull();
    expect(reachable(ctx, start, 4).has('2,1')).toBe(false);
    expect(findPath(ctx, start, { x: 3, y: 1 }, 4)?.cost).toBe(4);
    expect(findPath(ctx, start, { x: 3, y: 1 }, 3)).toBeNull();
    expect(findPath(ctx, start, start, 0)).toEqual({ pos: start, cost: 0, path: [] });
    expect([...reachable(ctx, start, 0).keys()]).toEqual(['1,1']);
    const small: Grid = {
      width: 3,
      height: 3,
      tiles: Array.from({ length: 9 }, () => ({ ...DEFAULT_TILE })),
    };
    const single = { ...ctx, grid: small, size: 1 as const };
    expect([...reachable(single, { x: 1, y: 1 }, 1).keys()].sort()).toEqual([
      '0,0',
      '0,1',
      '0,2',
      '1,0',
      '1,1',
      '1,2',
      '2,0',
      '2,1',
      '2,2',
    ]);
    for (const guard of [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]) {
      const guarded = { ...single, blocked: new Set([posKey(guard)]) };
      expect(findPath(guarded, { x: 0, y: 0 }, { x: 1, y: 1 }, 1)).toBeNull();
      const cliff = {
        ...small,
        tiles: small.tiles.map((t, i) =>
          i === guard.y * 3 + guard.x ? { ...t, elevation: 2 } : t,
        ),
      };
      expect(findPath({ ...single, grid: cliff }, { x: 0, y: 0 }, { x: 1, y: 1 }, 1)).toBeNull();
    }
    // A flat 2x2 destination with four climbs and four water cells costs 2+3,
    // never the sum of cell costs; the intermediate straddle is traversable.
    const wet = {
      ...grid,
      tiles: grid.tiles.map((t) => ({
        ...t,
        surface: { id: 'water' as const, duration: -1, spread: 0 },
      })),
    };
    const costly = { ...ctx, grid: wet, climbCost: 3 };
    expect(standCost(costly, { x: 3, y: 1 })).toBe(2);
    expect(findPath(costly, start, { x: 3, y: 1 }, 10)?.cost).toBe(10);
    const ramps = { ...grid, tiles: grid.tiles.map((t) => ({ ...t, ramp: true })) };
    expect(findPath({ ...ctx, grid: ramps }, start, { x: 3, y: 1 }, 2)?.cost).toBe(2);
    const cliff = { ...grid, tiles: grid.tiles.map((t) => ({ ...t, elevation: t.elevation * 2 })) };
    expect(findPath({ ...ctx, grid: cliff }, start, { x: 3, y: 1 }, 99)).toBeNull();
  });
});
