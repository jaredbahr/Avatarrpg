/**
 * Test fixture only: no game code imports it, so it is never bundled. Binds
 * one existing NpcDef to a synthetic resident who stands on that NpcDef's
 * tile in every phase, so reducer-level tests can exercise the conversation
 * pin (ADR 0047 §4) without depending on a real resident's schedule. The real
 * resident who speaks through that NpcDef (Ba Dan's records, W5a) gives way
 * to the synthetic one; every other resident, anchor and role is kept.
 */

import type { ContentIndex, ResidentDef, ResidentSlot, Vec2, WorldAnchor } from '../types';

export const TEST_RESIDENT = 'test.speaker';
export const TEST_ANCHOR = 'test.stand';

/** The NpcDef's authored tile, or for a bound one its resident's fallback tile. */
function standTile(content: ContentIndex, pos: Vec2 | undefined, resident?: string): Vec2 {
  if (pos) return pos;
  const anchor = content.residents.get(resident ?? '')?.fallback.anchor;
  const site = content.anchors.get(anchor ?? '')?.site;
  if (site?.kind !== 'map') throw new Error(`No public tile for resident "${resident}"`);
  return site.pos;
}

export function withBoundNpc(content: ContentIndex, mapId: string, npcId: string): ContentIndex {
  const map = content.maps.get(mapId);
  const npc = map?.npcs.find((n) => n.id === npcId);
  if (!map || !npc) throw new Error(`No npc "${npcId}" on "${mapId}"`);
  const pos = standTile(content, npc.pos, npc.resident);
  const anchors: WorldAnchor[] = [
    { id: TEST_ANCHOR, place: 'TEST', site: { kind: 'map', mapId, pos } },
    { id: 'test.home', place: 'TEST', site: { kind: 'private', door: { mapId, pos } } },
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
  const others = [...content.residents.values()].filter(
    (r) => !r.source.runtimeNpcIds.includes(npcId),
  );
  return {
    ...content,
    maps: new Map([...content.maps, [mapId, bound]]),
    anchors: new Map([...content.anchors, ...anchors.map((a) => [a.id, a] as const)]),
    residents: new Map([...others, resident].map((r) => [r.id, r])),
  };
}
