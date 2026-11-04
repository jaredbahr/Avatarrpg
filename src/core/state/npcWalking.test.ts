/** Real-content core fixtures; these seeded positions are not native-play evidence. */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { previewWalk } from '../../app/world/walking';
import { cachedGrid, distance, pathCost, posKey } from '../rules/grid';
import { reconcileBattleResult, reconcileDisciplines, reconcileWorld } from '../save/reconcile';
import { deserialize, serialize, stateFromBlob } from '../save/serialize';
import { backgroundFigures, visibleNpcs } from '../story/world';
import type { DayPhase, GameState, Vec2 } from '../types';
import { createGame } from './createGame';
import { apply } from './reducer';

const village = (() => {
  const map = CONTENT.maps.get('ba_dan_village');
  if (!map) throw new Error('Missing Ba Dan village');
  return map;
})();

function at(pos: Vec2, phase: DayPhase = 'midday'): GameState {
  const fresh = createGame(CONTENT, {
    seed: 'npc-walking',
    party: [{ characterId: 'kaya' }],
    startNode: 'village_explore',
  });
  const exploring = apply(CONTENT, fresh, {
    type: 'enterNode',
    nodeId: 'village_explore',
  }).state;
  return {
    ...exploring,
    location: { mapId: village.id, pos },
    world: { ...exploring.world, clock: { day: 1, phase } },
  };
}

function occupied(state: GameState): Set<string> {
  return new Set(
    [...visibleNpcs(CONTENT, village, state), ...backgroundFigures(CONTENT, village, state)].map(
      (person) => posKey(person.pos),
    ),
  );
}

function walk(state: GameState, target: Vec2) {
  const unchanged = structuredClone(state);
  const preview = previewWalk(CONTENT, state, target);
  const result = apply(CONTENT, state, { type: 'walkTo', pos: target });
  const movement = result.events.find((event) => event.type === 'partyWalked');
  expect(movement).toBeDefined();
  expect(preview.path).toEqual(movement?.path);
  expect(preview.refusal).toBeNull();
  expect(state).toEqual(unchanged);
  expect(result.state.rng).toEqual(state.rng);
  return { ...result, preview, path: movement?.path ?? [] };
}

function expectClearRoute(state: GameState, path: readonly Vec2[]) {
  const blocked = occupied(state);
  expect.soft(path.filter((pos) => blocked.has(posKey(pos)))).toEqual([]);
  // Check the complete route, including diagonal corner clearance around people.
  expect
    .soft(
      pathCost(
        {
          grid: cachedGrid(village),
          blocked,
          surfaces: CONTENT.surfaces,
          size: 1,
          climbCost: CONTENT.tuning.climbCost,
        },
        state.location.pos,
        path,
      ),
    )
    .not.toBeNull();
}

const metadata = {
  label: 'Slot 1',
  summary: 'Walking around residents',
  savedAt: 1_700_000_000_000,
  session: { players: [{ name: 'Kaya', unitId: 'p0' }], soloPlay: true },
};

function reload(state: GameState): GameState {
  const parsed = deserialize(serialize(state, metadata));
  if (!parsed.ok) throw new Error(parsed.error);
  const battle = reconcileBattleResult(CONTENT, stateFromBlob(parsed.blob));
  expect(battle.warnings).toEqual([]);
  return reconcileWorld(CONTENT, reconcileDisciplines(CONTENT, battle.state));
}

describe('exploration walks around resolved people', () => {
  it('takes the previewed ground route around Gao instead of crossing his shopfront tile', () => {
    const state = at({ x: 8, y: 4 });
    const gao = visibleNpcs(CONTENT, village, state).find((npc) => npc.id === 'shopkeeper_gao');
    expect(gao?.pos).toEqual({ x: 9, y: 4 });
    const result = walk(state, { x: 10, y: 4 });
    expectClearRoute(state, result.path);
    expect(result.path.at(-1)).toEqual({ x: 10, y: 4 });
    expect(result.state.location.pos).toEqual({ x: 10, y: 4 });
    expect(result.state.screen).toBe('explore');
    expect(result.state.world.talk).toBeNull();
    expect(result.events.some((event) => event.type === 'storyNodeEntered')).toBe(false);
  });

  it('keeps the recursive approach to Mira clear and opens her conversation exactly once', () => {
    const state = at({ x: 8, y: 4 });
    const target = { x: 11, y: 5 };
    const result = walk(state, target);
    expectClearRoute(state, result.path);
    expect(result.preview.label).toBe('Elder Mira');
    expect(distance(result.state.location.pos, target)).toBe(1);
    expect(result.path.at(-1)).toEqual(result.state.location.pos);
    expect(result.events.filter((event) => event.type === 'storyNodeEntered')).toEqual([
      { type: 'storyNodeEntered', nodeId: 'mira_intro' },
    ]);
    expect(result.state.screen).toBe('dialogue');
    expect(result.state.story.nodeId).toBe('mira_intro');
    expect(result.state.world.talk).toEqual({
      npcId: 'elder_mira',
      mapId: village.id,
      anchor: 'bd01.table',
    });
  });

  it.each([
    ['bg.relief_watch', { x: 17, y: 5 }, { x: 17, y: 7 }],
    ['bg.pella_household', { x: 11, y: 11 }, { x: 9, y: 14 }],
  ] as const)('routes a ground walk around the resolved %s background role', (id, from, target) => {
    const state = at(from);
    expect(backgroundFigures(CONTENT, village, state).some((role) => role.id === id)).toBe(true);
    const result = walk(state, target);
    expectClearRoute(state, result.path);
    expect(result.state.location.pos).toEqual(target);
    expect(result.state.screen).toBe('explore');
    expect(result.events.some((event) => event.type === 'storyNodeEntered')).toBe(false);
  });

  it('leaves hidden residents and inactive background-role tiles available at night', () => {
    const state = at({ x: 8, y: 4 }, 'night');
    expect(visibleNpcs(CONTENT, village, state).some((npc) => npc.id === 'shopkeeper_gao')).toBe(
      false,
    );
    const pastShop = walk(state, { x: 10, y: 4 });
    expect(pastShop.path).toContainEqual({ x: 9, y: 4 });
    expectClearRoute(state, pastShop.path);

    const yard = at({ x: 11, y: 11 }, 'night');
    expect(backgroundFigures(CONTENT, village, yard)).toEqual([]);
    const pastYard = walk(yard, { x: 9, y: 14 });
    expect(pastYard.path).toContainEqual({ x: 11, y: 13 });
    expectClearRoute(yard, pastYard.path);
  });

  it('still talks directly to an adjacent person without adding movement', () => {
    const state = at({ x: 8, y: 4 });
    const result = apply(CONTENT, state, { type: 'walkTo', pos: { x: 9, y: 4 } });
    expect(result.events.some((event) => event.type === 'partyWalked')).toBe(false);
    expect(result.events.filter((event) => event.type === 'storyNodeEntered')).toHaveLength(1);
    expect(result.state.screen).toBe('dialogue');
    expect(result.state.world.talk?.npcId).toBe('shopkeeper_gao');
    expect(result.state.location.pos).toEqual(state.location.pos);
  });

  it('replays the same ground and conversation commands across the full save load path', () => {
    const state = at({ x: 8, y: 4 });
    const loaded = reload(state);
    expect(loaded).toEqual(state);
    for (const target of [
      { x: 10, y: 4 },
      { x: 11, y: 5 },
    ]) {
      const command = { type: 'walkTo', pos: target } as const;
      const first = apply(CONTENT, state, command);
      expect(apply(CONTENT, state, command)).toEqual(first);
      expect(apply(CONTENT, loaded, command)).toEqual(first);
      expect(reload(first.state)).toEqual(first.state);
    }
  });
});
