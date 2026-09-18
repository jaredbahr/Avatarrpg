import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import type { GameEvent, GameState, Vec2 } from '../types';
import { createGame } from './createGame';
import { apply } from './reducer';
import { serialize, deserialize, stateFromBlob } from '../save/serialize';
import { buildGrid, tileAt } from '../rules/grid';

/**
 * Walking the village. The rules of a walk have not changed: the reducer
 * still refuses a blocked tile, still approaches an NPC before talking and
 * still leaves by the gate. What is new is that a walk is reported as an
 * event carrying the route, so the party can be seen crossing the tiles
 * instead of appearing at the far end. Nothing in the rules reads it.
 */

function inVillage(): GameState {
  const fresh = createGame(CONTENT, {
    seed: 'explore',
    party: [
      { characterId: 'kaya', level: 1, autoChoose: true },
      { characterId: 'bo', level: 1, autoChoose: true },
    ],
    startNode: 'village_explore',
  });
  return apply(CONTENT, fresh, { type: 'enterNode', nodeId: 'village_explore' }).state;
}

const walks = (events: readonly GameEvent[]) =>
  events.filter((e): e is Extract<GameEvent, { type: 'partyWalked' }> => e.type === 'partyWalked');

describe('walking the village', () => {
  it('uses Gao’s shopfront after loading older village positions, including a new boundary cell', () => {
    const map = CONTENT.maps.get('ba_dan_village');
    const gao = map?.npcs.find((npc) => npc.id === 'shopkeeper_gao');
    if (!map || !gao) throw new Error('Missing village merchant');
    expect(gao.pos).toEqual({ x: 9, y: 4 });
    for (const pos of [
      { x: 7, y: 3 },
      { x: 7, y: 4 },
      { x: 10, y: 7 },
    ]) {
      const before = { ...inVillage(), location: { mapId: map.id, pos } };
      const loaded = deserialize(
        serialize(before, {
          label: 'Village',
          summary: 'Before shopfront placement',
          savedAt: 1,
          session: { players: [{ name: 'One', unitId: 'p0' }], soloPlay: false },
        }),
      );
      if (!loaded.ok) throw new Error('Could not reload village save');
      const restored = stateFromBlob(loaded.blob);
      expect(restored.location).toEqual(before.location);
      const result = apply(CONTENT, restored, { type: 'walkTo', pos: gao.pos });
      expect(result.state.screen).toBe('dialogue');
      expect(result.state.story.nodeId).toBe('gao_friendly');
      expect(result.state.location.pos).not.toEqual(gao.pos);
      for (const walk of walks(result.events))
        for (const step of walk.path) expect(tileAt(buildGrid(map), step)?.blocked).toBe(false);
    }
  });
  it('reports the route from where the party stood to where it ends', () => {
    const state = inVillage();
    const start = state.location.pos;
    const goal: Vec2 = { x: start.x + 3, y: start.y };
    const { state: after, events } = apply(CONTENT, state, { type: 'walkTo', pos: goal });

    expect(after.location).toEqual({ mapId: 'ba_dan_village', pos: goal });
    const [walk] = walks(events);
    expect(walk).toBeDefined();
    if (!walk) return;
    expect(walk.unitId).toBe(state.party[0]?.id);
    expect(walk.from).toEqual(start);
    expect(walk.path[walk.path.length - 1]).toEqual(goal);
    expect(walk.path.length).toBeGreaterThanOrEqual(3);
    // The route is a walk: every step is one tile from the last.
    let previous = start;
    for (const step of walk.path) {
      expect(Math.max(Math.abs(step.x - previous.x), Math.abs(step.y - previous.y))).toBe(1);
      previous = step;
    }
  });

  it('reports nothing for a refused or empty walk', () => {
    const state = inVillage();
    const wall = { x: 6, y: 1 };
    const refused = apply(CONTENT, state, { type: 'walkTo', pos: wall });
    expect(refused.state.location.pos).toEqual(state.location.pos);
    expect(walks(refused.events)).toHaveLength(0);
    expect(refused.events.some((e) => e.type === 'message')).toBe(true);

    const still = apply(CONTENT, state, { type: 'walkTo', pos: state.location.pos });
    expect(walks(still.events)).toHaveLength(0);
  });

  it('walks up to an NPC before the conversation opens', () => {
    const state = inVillage();
    const elder = CONTENT.maps.get('ba_dan_village')?.npcs.find((n) => n.id === 'elder_mira');
    expect(elder).toBeDefined();
    if (!elder) return;
    const { state: after, events } = apply(CONTENT, state, { type: 'walkTo', pos: elder.pos });

    expect(
      Math.max(
        Math.abs(after.location.pos.x - elder.pos.x),
        Math.abs(after.location.pos.y - elder.pos.y),
      ),
    ).toBe(1);
    expect(after.screen).toBe('dialogue');
    const [walk] = walks(events);
    expect(walk?.path[walk.path.length - 1]).toEqual(after.location.pos);
    // The walk comes before the story moves on, so it plays before the scene changes.
    expect(events.findIndex((e) => e.type === 'partyWalked')).toBeLessThan(
      events.findIndex((e) => e.type === 'storyNodeEntered'),
    );
  });

  it('walks onto the gate and then leaves', () => {
    const state = inVillage();
    const exit = CONTENT.maps.get('ba_dan_village')?.exit;
    expect(exit).toBeDefined();
    if (!exit) return;
    const { state: after, events } = apply(CONTENT, state, { type: 'walkTo', pos: exit.pos });
    expect(after.story.nodeId).toBeNull();
    expect(after.location.mapId).toBe('forest_road');
    const [walk] = walks(events);
    expect(walk?.path[walk.path.length - 1]).toEqual(exit.pos);
    expect(events.findIndex((e) => e.type === 'partyWalked')).toBeLessThan(
      events.findIndex((e) => e.type === 'screenChanged'),
    );
  });
});
