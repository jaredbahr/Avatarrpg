import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { buildGrid, findPath } from '../rules/grid';
import { activeTriggers } from '../story/world';
import { createGame } from './createGame';
import { apply } from './reducer';
import { deserialize, serialize, stateFromBlob } from '../save/serialize';
import type { GameState, Vec2 } from '../types';

const META = { label: 'World', summary: 'On the road', savedAt: 1, session: { players: [] } };
function start(): GameState {
  const state = createGame(CONTENT, {
    seed: 'connected-world',
    party: ['kaya', 'bo', 'nilak'].map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
  return apply(CONTENT, state, { type: 'enterNode', nodeId: 'village_explore' }).state;
}
const walk = (state: GameState, x: number, y: number) =>
  apply(CONTENT, state, { type: 'walkTo', pos: { x, y } });
function finishDialogue(state: GameState): GameState {
  for (let guard = 0; guard < 40 && state.screen === 'dialogue'; guard++) {
    if (CONTENT.story.get(state.story.nodeId ?? '')?.kind !== 'dialogue') return state;
    state = apply(CONTENT, state, { type: 'advanceDialogue' }).state;
  }
  return state;
}
function resolve(state: GameState, lose = false): GameState {
  if (!state.battle) throw new Error('Expected a real battle');
  const encounter = CONTENT.encounters.get(state.battle.encounterId);
  // Check actual arrivals, including travel and optional dialogue, against tuning.
  expect(state.party[0]?.level).toBe(encounter?.expectedLevel);
  return finishDialogue(
    apply(
      CONTENT,
      { ...state, battle: { ...state.battle, phase: lose ? 'defeat' : 'victory' } },
      { type: 'resolveBattle' },
    ).state,
  );
}
function forest(): GameState {
  const arrived = walk(start(), 23, 7).state;
  return finishDialogue(walk(arrived, 19, 4).state);
}

describe('connected world traversal', () => {
  it('walks to another map without needing a story cursor and returns beside its gate', () => {
    const state = start();
    const arrived = walk(state, 23, 7);
    expect(arrived.state.location).toEqual({ mapId: 'forest_road', pos: { x: 1, y: 4 } });
    expect(arrived.state.story.nodeId).toBeNull();
    expect(arrived.state.screen).toBe('explore');
    expect(arrived.state.world.returnPos.ba_dan_village).toEqual({ x: 23, y: 7 });
    const returned = walk(arrived.state, 0, 4).state;
    expect(returned.location).toEqual({ mapId: 'ba_dan_village', pos: { x: 22, y: 7 } });
    expect(returned.party).toEqual(state.party);
    expect(state.world.returnPos).toEqual({});
  });

  it('stops a long walk at the first event crossed, then at the enemies', () => {
    const state = walk(start(), 23, 7).state;
    const intro = walk(state, 19, 4);
    expect(intro.state.story.nodeId).toBe('road_depart');
    expect(intro.state.location.pos.x).toBe(4);
    const ambush = walk(finishDialogue(intro.state), 19, 4);
    expect(ambush.state.battle?.encounterId).toBe('enc_forest_road');
    const event = ambush.events.find((event) => event.type === 'partyWalked');
    expect(event?.path.at(-1)?.x).toBe(8);
    expect(ambush.state.world.fired).toContain('forest_road:battle_forest_road');
  });

  it('shows a reason when a destination is locked even after its walk event was consumed', () => {
    const state = forest();
    const blocked = walk(
      { ...state, world: { ...state.world, fired: ['forest_road:battle_forest_road'] } },
      19,
      4,
    );
    expect(blocked.state.location.mapId).toBe('forest_road');
    expect(blocked.events).toContainEqual({
      type: 'message',
      text: 'Deal with the roadblock before heading to the quarry.',
    });
  });

  it('keeps an optional discovery, a cleared encounter, and route memory through save/load', () => {
    let state = forest();
    state = finishDialogue(walk(state, 3, 1).state);
    expect(state.flags['world.ducks_seen']).toBe(true);
    state = resolve(walk(state, 19, 4).state);
    expect(state.world.cleared).toEqual(['enc_forest_road']);
    const saved = deserialize(serialize(state, META));
    if (!saved.ok) throw new Error(saved.error);
    expect(stateFromBlob(saved.blob)).toEqual(state);
    const beforeXp = state.party.map((unit) => unit.xp);
    state = walk(stateFromBlob(saved.blob), 0, 4).state;
    state = walk(state, 23, 7).state;
    state = walk(state, 19, 4).state;
    expect(state.location.mapId).toBe('quarry_gate');
    expect(state.battle).toBeNull();
    expect(state.party.map((unit) => unit.xp)).toEqual(beforeXp);
  });

  it('upgrades a version 2 save and uses visited story events to prevent replaying old encounters', () => {
    const state = resolve(walk(forest(), 19, 4).state);
    const old = JSON.parse(serialize(state, META));
    old.format = 2;
    old.state.version = 2;
    delete old.state.world;
    const result = deserialize(JSON.stringify(old));
    if (!result.ok) throw new Error(result.error);
    const restored = stateFromBlob(result.blob);
    expect(restored.version).toBe(3);
    const map = CONTENT.maps.get('forest_road');
    if (!map) throw new Error('Missing forest');
    expect(activeTriggers(map, restored)).toEqual([]);
    expect(walk(restored, 19, 4).state.location.mapId).toBe('quarry_gate');
  });

  it('does not let approaching an NPC bypass an event or teleport through a wall', () => {
    const state = forest();
    const base = CONTENT.maps.get('forest_road');
    if (!base) throw new Error('Missing forest');
    const map = {
      ...base,
      npcs: [
        {
          id: 'far',
          pos: { x: 17, y: 4 },
          name: 'Far traveller',
          sprite: 'npc.guard',
          node: 'forest_dema',
        },
      ],
    };
    const content = { ...CONTENT, maps: new Map(CONTENT.maps).set(map.id, map) };
    const result = apply(content, state, { type: 'walkTo', pos: { x: 17, y: 4 } });
    expect(result.state.story.nodeId).toBe('battle_forest_road');
  });

  it('keeps every route and optional conversation reachable from each arrival', () => {
    for (const map of CONTENT.maps.values()) {
      const grid = buildGrid(map);
      const destinations: Vec2[] = [
        ...(map.exits ?? []).map((exit) => exit.pos),
        ...map.npcs.map((npc) => npc.pos),
      ];
      const arrivals = [...CONTENT.maps.values()].flatMap((other) =>
        (other.exits ?? []).filter((exit) => exit.toMapId === map.id).map((exit) => exit.toPos),
      );
      for (const from of arrivals)
        for (const to of destinations) {
          expect(
            findPath(
              { grid, blocked: new Set(), surfaces: CONTENT.surfaces, size: 1 },
              from,
              to,
              grid.width * grid.height,
            ),
            `${map.id}: ${JSON.stringify(from)} -> ${JSON.stringify(to)}`,
          ).not.toBeNull();
        }
    }
  });

  for (const loss of ['forest', 'gate', 'ambush', 'boss']) {
    it(`keeps the ${loss} defeat route playable through real map connections`, () => {
      let state = resolve(walk(forest(), 19, 4).state, loss === 'forest');
      state = walk(state, 19, 4).state;
      state = walk(state, 19, 5).state;
      state = apply(CONTENT, state, { type: 'chooseOption', optionIndex: 0 }).state;
      state = resolve(state, loss === 'gate');
      state = finishDialogue(apply(CONTENT, state, { type: 'chooseOption', optionIndex: 0 }).state);
      state = walk(state, 19, 5).state;
      state = resolve(walk(state, 19, 4).state, loss === 'ambush');
      state = walk(state, 19, 4).state;
      state = finishDialogue(walk(state, 18, 5).state);
      state = resolve(state, loss === 'boss');
      expect(state.screen).toBe('ended');
      expect(state.flags[loss === 'boss' ? 'act1_lost' : 'act1_complete']).toBe(true);
      expect(state.world.cleared).not.toContain(
        {
          forest: 'enc_forest_road',
          gate: 'enc_quarry_gate',
          ambush: 'enc_ambush',
          boss: 'enc_grumbler',
        }[loss],
      );
    });
  }

  for (const parley of [0, 1, 2])
    for (const ruon of [0, 1]) {
      it(`walks the whole region with parley ${parley}, Ruon choice ${ruon}, and returns without farming XP`, () => {
        let state = resolve(walk(forest(), 19, 4).state);
        state = walk(state, 19, 4).state;
        expect(state.location.mapId).toBe('quarry_gate');
        state = walk(state, 19, 5).state;
        expect(state.story.nodeId).toBe('gate_parley');
        state = finishDialogue(
          apply(CONTENT, state, { type: 'chooseOption', optionIndex: parley }).state,
        );
        if (state.battle) state = resolve(state);
        expect(state.story.nodeId).toBe('ruon_choice');
        state = finishDialogue(
          apply(CONTENT, state, { type: 'chooseOption', optionIndex: ruon }).state,
        );
        expect(state.location.mapId).toBe('quarry_gate');
        state = walk(state, 19, 5).state;
        expect(state.location.mapId).toBe('ambush_road');
        // The optional tea conversation does not bypass the ambush or grant XP.
        const xp = state.party[0]?.xp;
        state = finishDialogue(walk(state, 5, 9).state);
        expect(state.flags['world.tea_shared']).toBe(true);
        expect(state.party[0]?.xp).toBe(xp);
        state = walk(state, 19, 4).state;
        if (ruon === 0) {
          expect(state.battle?.encounterId).toBe('enc_ambush');
          state = resolve(state);
          state = walk(state, 19, 4).state;
        }
        expect(state.location.mapId).toBe('quarry_floor');
        const before = state.party.map((unit) => unit.xp);
        // A full return trip remains possible before committing to the boss.
        state = walk(state, 0, 5).state;
        state = walk(state, 0, 4).state;
        state = walk(state, 0, 5).state;
        state = walk(state, 0, 4).state;
        expect(state.location.mapId).toBe('ba_dan_village');
        state = walk(state, 23, 7).state;
        state = walk(state, 19, 4).state;
        state = walk(state, 19, 5).state;
        state = walk(state, 19, 4).state;
        expect(state.party.map((unit) => unit.xp)).toEqual(before);
        state = finishDialogue(walk(state, 18, 5).state);
        expect(state.battle?.encounterId).toBe('enc_grumbler');
        state = resolve(state);
        expect(state.screen).toBe('ended');
        expect(state.flags.act1_complete).toBe(true);
      });
    }
});
