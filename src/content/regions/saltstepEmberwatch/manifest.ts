/**
 * Saltstep and Emberwatch. TODO(region): one paragraph on what the region is and where it sits in the saga.
 */
import type { RegionManifest } from '../../regions/types';

export const SALTSTEP_EMBERWATCH: RegionManifest = {
  id: 'saltstep_emberwatch',
  name: 'Saltstep and Emberwatch',
  mapIds: ['saltstep_emberwatch_hub'],
  // TODO(region): the regions this one's exits, story links or fights name.
  neighbours: [],
  // TODO(region): the owner's level band (ADR 0011, #784); every fight here must expect a level in it.
  levelBand: { minLevel: 1, maxLevel: 10, placeholder: true },
  // TODO(region): an area track per map (`MUSIC_TRACKS`); a map with no row keeps what is playing.
  music: {},
  // TODO(region): each map's top-down scene once its board is baked (ADR 0104).
  scenes: {},
  load: () => import('./content').then((module) => module.SALTSTEP_EMBERWATCH_CONTENT),
};
