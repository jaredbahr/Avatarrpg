import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { nearbyExploreTarget } from './guidance';

function villageAt(pos: { x: number; y: number }) {
  const initial = createGame(CONTENT, {
    seed: 'nearby-guidance',
    party: [{ characterId: 'kaya', level: 1, autoChoose: true }],
    startNode: 'village_explore',
  });
  const state = apply(CONTENT, initial, { type: 'enterNode', nodeId: 'village_explore' }).state;
  return { ...state, location: { ...state.location, pos } };
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
});
