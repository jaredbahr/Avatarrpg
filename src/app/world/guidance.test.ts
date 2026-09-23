import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { exitDestination, nearbyExploreTarget } from './guidance';

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
    // is at his drill and the unnamed relief watch, no NpcDef, holds it.
    const atGate = villageAt({ x: 22, y: 7 });
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
});
