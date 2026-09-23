/**
 * Test support only (nothing in the game imports it): binds one existing
 * NpcDef to a synthetic resident who stands on that NpcDef's tile in every
 * phase, so reducer-level tests can exercise the conversation pin (ADR 0047
 * §4) before any real resident records exist (W5a).
 */

import type { ContentIndex, ResidentDef, ResidentSlot, WorldAnchor } from '../types';

export const TEST_RESIDENT = 'test.speaker';
export const TEST_ANCHOR = 'test.stand';

export function withBoundNpc(content: ContentIndex, mapId: string, npcId: string): ContentIndex {
  const map = content.maps.get(mapId);
  const npc = map?.npcs.find((n) => n.id === npcId);
  if (!map || !npc) throw new Error(`No npc "${npcId}" on "${mapId}"`);
  const anchors: WorldAnchor[] = [
    { id: TEST_ANCHOR, place: 'TEST', site: { kind: 'map', mapId, pos: npc.pos } },
    { id: 'test.home', place: 'TEST', site: { kind: 'private', door: { mapId, pos: npc.pos } } },
  ];
  const slot: ResidentSlot = {
    anchor: TEST_ANCHOR,
    activity: 'stand',
    npc: npcId,
    interrupt: 'talk',
  };
  const resident: ResidentDef = {
    id: TEST_RESIDENT,
    name: npc.name,
    source: { runtimeNpcIds: [npcId] },
    home: 'test.home',
    fallback: slot,
    schedule: {
      dawn: slot,
      morning: slot,
      midday: slot,
      afternoon: slot,
      evening: slot,
      night: slot,
    },
  };
  const bound = {
    ...map,
    npcs: map.npcs.map((n) => (n.id === npcId ? { ...n, resident: TEST_RESIDENT } : n)),
  };
  return {
    ...content,
    maps: new Map([...content.maps, [mapId, bound]]),
    anchors: new Map(anchors.map((a) => [a.id, a])),
    residents: new Map([[resident.id, resident]]),
  };
}
