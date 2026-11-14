/**
 * The shared half of the content index (ADR 0111 §2): everything that is not a region's. The app
 * boots with this and adds regions as it loads them; `index.ts` adds every region at once.
 *
 * Nothing here may import a region's `content.ts`, or the region's data comes back into the boot
 * chunk.
 */
import type { ContentIndex, StatusId, SurfaceId } from '../core/types';
import { ABILITY_BY_ID, UNIVERSAL_ABILITY_IDS } from './abilities';
import { CHARACTER_BY_ID } from './characters';
import { DISCIPLINE_BY_ID } from './disciplines';
import { COMBOS } from './combos';
import { ELEMENT_BY_ID } from './elements';
import { ENEMY_BY_ID } from './enemies';
import { PROP_BY_ID } from './props';
import type { STATUSES } from './statuses';
import { STATUS_BY_ID } from './statuses';
import type { SURFACES } from './surfaces';
import { SURFACE_BY_ID } from './surfaces';
import { COMBAT_TUNING } from './tuning';
import type { RegionContent } from './regions/types';

/** The index fields a region fills. */
export type RegionIndexKey =
  'maps' | 'story' | 'encounters' | 'anchors' | 'residents' | 'backgroundRoles';

/** The index fields every region shares. */
export const CORE_INDEX: Omit<ContentIndex, RegionIndexKey> = {
  elements: ELEMENT_BY_ID,
  abilities: ABILITY_BY_ID,
  characters: CHARACTER_BY_ID,
  disciplines: DISCIPLINE_BY_ID,
  enemies: ENEMY_BY_ID,
  statuses: STATUS_BY_ID as ReadonlyMap<StatusId, (typeof STATUSES)[number]>,
  surfaces: SURFACE_BY_ID as ReadonlyMap<SurfaceId, (typeof SURFACES)[number]>,
  props: PROP_BY_ID,
  combos: COMBOS,
  tuning: COMBAT_TUNING,
  universalAbilities: UNIVERSAL_ABILITY_IDS,
};

/** Mutable maps of the region fields, so a loader can fill them in place. */
export interface RegionIndex {
  readonly maps: Map<string, RegionContent['maps'][number]>;
  readonly story: Map<string, RegionContent['story'][number]>;
  readonly encounters: Map<string, RegionContent['encounters'][number]>;
  readonly anchors: Map<string, RegionContent['anchors'][number]>;
  readonly residents: Map<string, RegionContent['residents'][number]>;
  readonly backgroundRoles: Map<string, RegionContent['backgroundRoles'][number]>;
}

export function emptyRegionIndex(): RegionIndex {
  return {
    maps: new Map(),
    story: new Map(),
    encounters: new Map(),
    anchors: new Map(),
    residents: new Map(),
    backgroundRoles: new Map(),
  };
}

/**
 * Refills `index` with `regions`, in the order given. Callers pass regions in `REGIONS` order, so
 * any subset of loaded regions iterates exactly as the full index does with the others left out:
 * a first-match read (`exploreNodeFor`) gives the full index's answer whenever that answer is in a
 * loaded region.
 */
export function fillRegionIndex(index: RegionIndex, regions: readonly RegionContent[]): void {
  for (const map of Object.values(index)) map.clear();
  for (const region of regions) {
    for (const map of region.maps) index.maps.set(map.id, map);
    for (const node of region.story) index.story.set(node.id, node);
    for (const encounter of region.encounters) index.encounters.set(encounter.id, encounter);
    for (const anchor of region.anchors) index.anchors.set(anchor.id, anchor);
    for (const resident of region.residents) index.residents.set(resident.id, resident);
    for (const role of region.backgroundRoles) index.backgroundRoles.set(role.id, role);
  }
}
