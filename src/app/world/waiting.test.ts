import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../../core/state/createGame';
import type { ContentIndex, GameState, MapDef } from '../../core/types';
import { seatHere, waitOffers } from './waiting';

/**
 * A one-tile room whose only tile is its seat, where someone stands in the
 * evening only. Waiting until evening would leave the leader on them with
 * nowhere to step aside, so that one option is refused and the rest are not.
 */
const ROOM: MapDef = {
  id: 'evening_room',
  name: 'Evening room',
  kind: 'explore',
  width: 3,
  height: 3,
  rows: ['###', '#.#', '###'],
  legend: { '#': { terrain: 'wall' }, '.': { terrain: 'dirt' } },
  partySpawns: [{ x: 1, y: 1 }],
  npcs: [
    {
      id: 'evening_visitor',
      name: 'Evening visitor',
      pos: { x: 1, y: 1 },
      sprite: 'npc.elder',
      node: 'village_explore',
      when: { kind: 'phase', in: ['evening'] },
    },
  ],
  props: [],
  ambience: '',
  restSpots: [{ pos: { x: 1, y: 1 }, label: 'the bench' }],
};

const content: ContentIndex = { ...CONTENT, maps: new Map(CONTENT.maps).set(ROOM.id, ROOM) };

function at(mapId: string, x: number, y: number): GameState {
  const base = createGame(CONTENT, {
    seed: 'waiting',
    party: [{ characterId: 'kaya' }],
    startNode: 'village_explore',
  });
  return {
    ...base,
    screen: 'explore',
    story: { ...base.story, nodeId: 'village_explore' },
    location: { mapId, pos: { x, y } },
  };
}

describe('wait offers (ADR 0047 §1)', () => {
  it('lock only the phase the rule refuses, each with its own reason', () => {
    const offers = waitOffers(content, at(ROOM.id, 1, 1));
    expect(offers.map((offer) => offer.phase)).toEqual([
      'afternoon',
      'evening',
      'night',
      'dawn',
      'morning',
    ]);
    expect(offers.map((offer) => offer.refusal)).toEqual([
      null,
      'There is nowhere for the party to stand.',
      null,
      null,
      null,
    ]);
    expect(offers.map((offer) => offer.tomorrow)).toEqual([false, false, false, true, true]);
  });

  it('refuse every phase away from a seat, and know the seat when there', () => {
    const away = at('ba_dan_village', 3, 7);
    expect(new Set(waitOffers(CONTENT, away).map((offer) => offer.refusal))).toEqual(
      new Set(["You can wait only at Mira's table."]),
    );
    expect(seatHere(CONTENT, away)).toBeUndefined();
    expect(seatHere(CONTENT, at('ba_dan_village', 10, 6))?.label).toBe("Mira's table");
  });
});
