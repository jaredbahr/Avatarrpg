import { describe, expect, it } from 'vitest';
import { CONTENT } from './index';
import { partyOfSize } from '../core/sim/balance';
import { battleReturnTile } from '../core/story/battleReturn';
import type { MapDef, Vec2 } from '../core/types';
import { topDownMap, withTopDownMaps } from './topdown';

const PARTY_SIZES = [1, 2, 3, 4, 5, 6] as const;

function leadsToBattle(nodeId: string, seen = new Set<string>()): boolean {
  if (seen.has(nodeId)) return false;
  seen.add(nodeId);
  const node = CONTENT.story.get(nodeId);
  if (!node) return false;
  switch (node.kind) {
    case 'battle':
      return true;
    case 'dialogue':
    case 'flags':
      return leadsToBattle(node.next, seen);
    case 'branch':
      return leadsToBattle(node.ifSet, new Set(seen)) || leadsToBattle(node.ifUnset, new Set(seen));
    default:
      return false;
  }
}

function battleCrossings(map: MapDef): readonly Vec2[] {
  return (map.triggers ?? [])
    .filter((trigger) => leadsToBattle(trigger.node))
    .flatMap((trigger) => trigger.area);
}

describe('top-down rules parity', () => {
  it('preserves battle return tiles across every rubble map, crossing, and party size', () => {
    const rubbleMaps = [...CONTENT.maps.values()].filter(
      (map) => map.kind === 'combat' && (map.scene?.paintedRubble?.length ?? 0) > 0,
    );
    expect(rubbleMaps.length).toBeGreaterThan(0);

    const presentations = new Map(
      rubbleMaps.map((map) => [
        map.id,
        { projection: 'topdown' as const, scene: { ground: [], scenery: [] } },
      ]),
    );
    const topDownContent = withTopDownMaps(CONTENT, presentations);

    for (const map of rubbleMaps) {
      const crossings = battleCrossings(map);
      expect(crossings.length, `${map.id} battle crossings`).toBeGreaterThan(0);
      const topDown = topDownContent.maps.get(map.id);
      expect(topDown, `${map.id} top-down map`).toBeDefined();
      if (!topDown) continue;

      for (const partySize of PARTY_SIZES) {
        // battleReturnTile is geometry-based and has no roster parameter; cover every supported
        // table size here so future party-dependent seating changes keep the same style contract.
        expect(partyOfSize(partySize)).toHaveLength(partySize);
        for (const crossing of crossings) {
          expect(
            battleReturnTile(CONTENT, topDown, crossing),
            `${map.id} crossing ${crossing.x},${crossing.y} with party size ${partySize}`,
          ).toEqual(battleReturnTile(CONTENT, map, crossing));
        }
      }
    }
  });

  it('lets a top-down presentation override a carried rules field', () => {
    const map = [...CONTENT.maps.values()].find((candidate) => candidate.scene?.paintedRubble);
    expect(map).toBeDefined();
    if (!map?.scene?.paintedRubble) return;

    const presentationRubble: readonly Vec2[] = [{ x: 1, y: 1 }];
    const topDown = topDownMap(map, {
      projection: 'topdown',
      scene: { ground: [], scenery: [], paintedRubble: presentationRubble },
    });
    expect(topDown.scene?.paintedRubble).toBe(presentationRubble);
  });
});
