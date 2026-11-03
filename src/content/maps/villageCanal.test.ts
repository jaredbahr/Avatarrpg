import { expect, it } from 'vitest';
import { CONTENT } from '../index';
import { BA_DAN_VILLAGE } from './village';
import { BA_DAN_WATER_CELLS } from '../scenes/baDan';
import { BA_DAN_ROUTINES, PARKED_ROUTINES } from '../residents/routines';
import { PartyTrail, placeParty } from '../../app/anim/trail';
import { buildGrid, findPath, pathCost, posKey, tileAt } from '../../core/rules/grid';
import { createGame } from '../../core/state/createGame';
import { reconcileWorld } from '../../core/save/reconcile';
import { DAY_PHASES } from '../../core/types';
import type { Vec2 } from '../../core/types';
import { exitCells, visibleNpcs } from '../../core/story/world';

const map = BA_DAN_VILLAGE;
const grid = buildGrid(map);
const ctx = { grid, blocked: new Set<string>(), surfaces: CONTENT.surfaces, size: 1 as const };
const spawn = map.partySpawns[0] ?? { x: 3, y: 7 };
const water = new Set(BA_DAN_WATER_CELLS.map(posKey));
const base = createGame(CONTENT, {
  seed: 'village-canal',
  party: ['kaya', 'bo', 'nilak', 'sura'].map((characterId) => ({ characterId })),
  startNode: 'village_explore',
});

function dry(path: readonly Vec2[]) {
  for (const cell of path) {
    expect(water.has(posKey(cell)), `water at ${posKey(cell)}`).toBe(false);
    expect(tileAt(grid, cell)?.blocked, `blocked at ${posKey(cell)}`).toBe(false);
  }
}

it('blocks the painted canal without blocking sight or either authored crossing', () => {
  for (const cell of BA_DAN_WATER_CELLS) {
    expect(tileAt(grid, cell)).toMatchObject({ blocked: true, blocksSight: false });
  }
  for (const x of [9, 13]) {
    expect(tileAt(grid, { x, y: 6 })?.blocked).toBe(false);
    const route = findPath(ctx, { x, y: 7 }, { x, y: 5 }, Infinity);
    expect(route?.path).toContainEqual({ x, y: 6 });
  }
});

it('keeps every resident routine leg, including parked errands, on dry legal ground', () => {
  for (const routine of [...BA_DAN_ROUTINES, ...PARKED_ROUTINES]) {
    const site = CONTENT.anchors.get(routine.anchor)?.site;
    if (site?.kind !== 'map') throw new Error(routine.anchor);
    let from = site.pos;
    for (const leg of routine.legs) {
      dry([from, ...leg.path]);
      expect(pathCost(ctx, from, leg.path), routine.id).not.toBeNull();
      from = leg.path.at(-1) ?? from;
    }
  }
});

it('keeps all public resident anchors, exits and rest spots reachable across the canal', () => {
  const targets = [
    ...[...CONTENT.anchors.values()].flatMap(({ site }) =>
      site.kind === 'map' && site.mapId === map.id ? [site.pos] : [],
    ),
    ...(map.exits ?? []).flatMap(exitCells),
    ...(map.exit ? [map.exit.pos] : []),
    ...(map.restSpots ?? []).map((spot) => spot.pos),
  ];
  for (const target of targets) {
    const route = findPath(ctx, spawn, target, Infinity);
    expect(route, posKey(target)).not.toBeNull();
    dry(route?.path ?? []);
  }
  for (const phase of DAY_PHASES) {
    for (const complete of [false, true]) {
      const state = {
        ...base,
        flags: { ...base.flags, act1_complete: complete },
        world: { ...base.world, clock: { day: 1, phase } },
      };
      for (const npc of visibleNpcs(CONTENT, map, state)) {
        const route = findPath(ctx, spawn, npc.pos, Infinity);
        expect(route, `${phase}: ${npc.id}`).not.toBeNull();
        dry(route?.path ?? []);
      }
    }
  }
});

it('takes the party and follower trail over both crossings without entering canal water', () => {
  for (const x of [9, 13]) {
    const start = { x, y: 8 };
    const goal = { x, y: 4 };
    const trail = new PartyTrail(placeParty(grid, start, 4, { awayFrom: goal }));
    for (const target of [goal, start]) {
      const from = trail.head ?? start;
      const route = findPath(ctx, from, target, Infinity);
      expect(route).not.toBeNull();
      const path = route?.path ?? [];
      expect(path).toContainEqual({ x, y: 6 });
      dry([from, ...path]);
      const plan = trail.planWalk(path, 4, grid);
      expect(plan).not.toBeNull();
      for (const follower of plan?.batches.flat() ?? []) {
        dry([follower.from, ...follower.path]);
        expect(
          pathCost(ctx, follower.from, follower.path),
          JSON.stringify(follower),
        ).not.toBeNull();
      }
      for (const follower of trail.settle(grid)) dry([follower.from, ...follower.path]);
      dry(trail.positions(4));
    }
  }
});

it('reconciles a legacy save on canal cell (5,6) onto reachable dry ground, idempotently', () => {
  const saved = {
    ...base,
    screen: 'explore' as const,
    location: { mapId: map.id, pos: { x: 5, y: 6 } },
  };
  const repaired = reconcileWorld(CONTENT, saved);
  expect(saved.location.pos).toEqual({ x: 5, y: 6 });
  expect(repaired.location.pos).not.toEqual(saved.location.pos);
  dry([repaired.location.pos]);
  expect(findPath(ctx, spawn, repaired.location.pos, Infinity)).not.toBeNull();
  expect(reconcileWorld(CONTENT, repaired)).toEqual(repaired);
});
