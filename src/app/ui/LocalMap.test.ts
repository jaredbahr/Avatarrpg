import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import type { GameState, MapExit } from '../../core/types';
import { activeTriggers } from '../../core/story/world';
import { nearestExitCell, triggerDestinations } from './LocalMap';

const mouth: MapExit = {
  pos: { x: 19, y: 4 },
  area: [
    { x: 19, y: 4 },
    { x: 19, y: 5 },
    { x: 19, y: 6 },
    { x: 19, y: 7 },
    { x: 19, y: 8 },
  ],
  toMapId: 'quarry_gate',
  toPos: { x: 1, y: 5 },
  label: 'East → Quarry Gate',
};

describe('local map exit buttons', () => {
  it('walks to the mouth cell nearest the party (M2)', () => {
    // Distance is Chebyshev, so only a party outside the mouth's row band
    // picks one row outright; inside it, the tie rule keeps `pos`.
    expect(nearestExitCell(mouth, { x: 20, y: 10 })).toEqual({ x: 19, y: 8 });
    expect(nearestExitCell(mouth, { x: 20, y: 1 })).toEqual({ x: 19, y: 4 });
  });

  it('keeps `pos` on a tie, so the canonical cell still leads (M2)', () => {
    expect(nearestExitCell(mouth, { x: 17, y: 4 })).toEqual({ x: 19, y: 4 });
  });

  it('walks to `pos` for an exit without an area (M2)', () => {
    const single: MapExit = { ...mouth, area: undefined };
    expect(nearestExitCell(single, { x: 20, y: 10 })).toEqual({ x: 19, y: 4 });
  });
});

describe('local map story crossings (#753)', () => {
  function onForestRoad(): GameState {
    const fresh = createGame(CONTENT, {
      seed: 'local-map-crossing',
      party: [{ characterId: 'kaya' }, { characterId: 'bo' }],
      startNode: 'forest_explore',
    });
    return apply(CONTENT, fresh, { type: 'enterNode', nodeId: 'forest_explore' }).state;
  }

  it('offers the pine road first, the crossing a walk east meets first', () => {
    const state = onForestRoad();
    const map = CONTENT.maps.get(state.location.mapId);
    if (!map) return;
    expect(triggerDestinations(CONTENT, map, state).map((item) => item.label)).toEqual([
      'The pine road',
    ]);
  });

  it('offers a walk to the roadblock that stops on its trigger', () => {
    const start = onForestRoad();
    const map = CONTENT.maps.get(start.location.mapId);
    expect(map?.id).toBe('forest_road');
    if (!map) return;
    // Past the pine road's beat, as after the walk out of Ba Dan.
    const state: GameState = {
      ...start,
      story: { ...start.story, visited: [...start.story.visited, 'road_depart'] },
      world: { ...start.world, fired: [...start.world.fired, 'forest_road:road_depart'] },
    };
    const crossings = triggerDestinations(CONTENT, map, state);
    const roadblock = crossings.find((item) => item.label === 'Quarry workers blocking the road');
    expect(roadblock).toBeDefined();
    if (!roadblock) return;
    // Walking there through the reducer's own command meets the fight, as a tap would.
    const walked = apply(CONTENT, state, { type: 'walkTo', pos: roadblock.pos });
    expect(walked.state.story.nodeId).toBe('battle_forest_road');
  });

  it('lists only armed crossings', () => {
    const state = onForestRoad();
    const map = CONTENT.maps.get(state.location.mapId);
    if (!map) return;
    const armed = new Set(activeTriggers(map, state).map((trigger) => trigger.label));
    for (const crossing of triggerDestinations(CONTENT, map, state))
      expect(armed.has(crossing.label)).toBe(true);
    const done = {
      ...state,
      world: { ...state.world, fired: (map.triggers ?? []).map((t) => `${map.id}:${t.id}`) },
    };
    expect(triggerDestinations(CONTENT, map, done)).toEqual([]);
  });
});
