import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { exitDestination, nearbyExits, nearbyExploreTarget } from './guidance';

function villageAt(pos: { x: number; y: number }) {
  const initial = createGame(CONTENT, {
    seed: 'nearby-guidance',
    party: [{ characterId: 'kaya', level: 1, autoChoose: true }],
    startNode: 'village_explore',
  });
  const state = apply(CONTENT, initial, { type: 'enterNode', nodeId: 'village_explore' }).state;
  return { ...state, location: { ...state.location, pos } };
}

function mapAt(mapId: string, pos: { x: number; y: number }) {
  const state = villageAt(pos);
  return { ...state, location: { ...state.location, mapId } };
}

describe('nearby exploration guidance', () => {
  it('prioritizes an open route over the riverside invitation sign', () => {
    const map = CONTENT.maps.get('ba_dan_village');
    if (!map) throw new Error('Missing Ba Dan village');

    const atPortal = nearbyExploreTarget(CONTENT, map, villageAt({ x: 19, y: 14 }));
    expect(atPortal).toMatchObject({
      kind: 'exit',
      destination: 'Riverside',
      exit: { toMapId: 'ba_dan_riverside' },
    });

    const bySign = nearbyExploreTarget(CONTENT, map, villageAt({ x: 18, y: 12 }));
    expect(bySign).toMatchObject({ kind: 'npc', npc: { id: 'riverside_sign' } });
  });

  it('keeps a real person primary at open gates and leaves locked routes inactive', () => {
    const forest = CONTENT.maps.get('forest_road');
    const village = CONTENT.maps.get('ba_dan_village');
    if (!forest || !village) throw new Error('Missing connected maps');

    expect(
      nearbyExploreTarget(CONTENT, forest, mapAt('forest_road', { x: 1, y: 4 })),
    ).toMatchObject({
      kind: 'npc',
      npc: { id: 'dema' },
    });
    // Dorin keeps the gate post in the morning (ADR 0047 §8); at midday he
    // is at his drill and the unnamed relief watch, no NpcDef, holds it. The
    // post is where the east road leaves the square (W8), so it is met on the
    // road there rather than at the exit tile.
    const atGate = villageAt({ x: 19, y: 7 });
    const morning = {
      ...atGate,
      world: { ...atGate.world, clock: { day: 1, phase: 'morning' as const } },
    };
    expect(nearbyExploreTarget(CONTENT, village, morning)).toMatchObject({
      kind: 'npc',
      npc: { id: 'guard_dorin' },
    });
    expect(nearbyExploreTarget(CONTENT, forest, mapAt('forest_road', { x: 18, y: 4 }))).toBeNull();
  });

  it('uses the destination map name when a route label has no arrow', () => {
    expect(
      exitDestination(CONTENT, {
        pos: { x: 0, y: 0 },
        toMapId: 'ba_dan_riverside',
        toPos: { x: 10, y: 19 },
        label: 'Back to the river',
      }),
    ).toBe('Ba Dan · The Riverside');
  });

  it('reaches a route from every cell of a widened road mouth (M2)', () => {
    const village = CONTENT.maps.get('ba_dan_village');
    const forest = CONTENT.maps.get('forest_road');
    if (!village || !forest) throw new Error('Missing connected maps');

    // The east gate's mouth is the two cells of the road at the border, so a
    // leader one tile south of `pos` still gets the route.
    const east = nearbyExits(village, { x: 22, y: 9 });
    expect(east.map((exit) => exit.toMapId)).toEqual(['forest_road']);
    expect(nearbyExploreTarget(CONTENT, village, villageAt({ x: 22, y: 9 }))).toMatchObject({
      kind: 'exit',
      destination: 'Forest Road',
    });

    // The forest keeps its five-row cross-section so each walkable mouth cell
    // leads out rather than being misclassified as an edge band.
    const west = nearbyExits(forest, { x: 1, y: 4 });
    expect(west.map((exit) => exit.toMapId)).toEqual(['ba_dan_village']);
    expect(nearbyExits(forest, { x: 1, y: 7 }).map((exit) => exit.toMapId)).toEqual([
      'ba_dan_village',
    ]);
    // One tile further inland is outside the mouth.
    expect(nearbyExits(forest, { x: 2, y: 4 })).toEqual([]);
  });

  it('keeps a single-tile exit matching only its own tile (M2)', () => {
    const village = CONTENT.maps.get('ba_dan_village');
    if (!village) throw new Error('Missing Ba Dan village');
    const single = village.exits?.find((exit) => exit.toMapId === 'ba_dan_riverside');
    if (!single) throw new Error('Missing the river path');
    expect(nearbyExits(village, single.pos)).toContain(single);
    expect(nearbyExits(village, { x: single.pos.x - 2, y: single.pos.y })).toEqual([]);
  });
});
