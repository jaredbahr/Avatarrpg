/**
 * Ba Dan valley: the demo route. Ba Dan and its riverside, the Forest Road, the quarry gate, the
 * Cutting and the Driller's floor, out and home again.
 *
 * One region, not three: the main story (`act1.ts`) and the walk home (`return.ts`) each run the
 * whole route, and the first explore node listed for a map is the one the rules enter
 * (`exploreNodeFor`), so splitting the files by map would reorder the story and change play.
 */
import type { RegionManifest } from '../types';

export const BA_DAN_VALLEY: RegionManifest = {
  id: 'ba_dan_valley',
  name: 'Ba Dan valley',
  mapIds: [
    'ba_dan_village',
    'ba_dan_riverside',
    'forest_road',
    'quarry_gate',
    'ambush_road',
    'quarry_floor',
  ],
  // The coast road from Ba Dan's south lawn to Saltstep, open once Act I is over (`maps/world.ts`).
  neighbours: ['saltstep_emberwatch'],
  // PLACEHOLDER until the owner answers #784: 1-3 matches the demo's fights (levels 1, 2, 3, 3).
  levelBand: { minLevel: 1, maxLevel: 3, placeholder: true },
  // Ba Dan and its riverside share the village theme, so the welcome-home ending plays it too; the
  // Forest Road plays the road theme both ways; the quarry gate, the Cutting and the Driller's floor
  // play the quarry theme, out and on the walk home, until the Forest Road takes over.
  music: {
    ba_dan_village: 'ba-dan',
    ba_dan_riverside: 'ba-dan',
    forest_road: 'road',
    quarry_gate: 'quarry',
    ambush_road: 'quarry',
    quarry_floor: 'quarry',
  },
  scenes: {
    // Ba Dan's ground alone (stage 4 of `docs/places/ba_dan_village.md`, ADR 0120): the plate runs two cells past the
    // grid either side, three above and two below; its set pieces stand on it at stage 5.
    ba_dan_village: { url: 'art/topdown/ba-dan/scene.json', cameraCentreMargin: 1 },
    // The forest plate runs two cells past the grid either side and three above (the pine margin).
    forest_road: { url: 'art/topdown/forest-road/scene.json', cameraCentreMargin: 1 },
    // The quarry's plates run the same two cells past the grid either side and three above (T5).
    quarry_gate: { url: 'art/topdown/quarry-gate/scene.json', cameraCentreMargin: 1 },
    ambush_road: { url: 'art/topdown/cutting/scene.json', cameraCentreMargin: 1 },
    quarry_floor: { url: 'art/topdown/quarry-floor/scene.json', cameraCentreMargin: 1 },
  },
  load: () => import('./content').then((module) => module.BA_DAN_VALLEY_CONTENT),
};
