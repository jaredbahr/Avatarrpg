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
  neighbours: [],
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
    // The oblique margin (-0.61) was fitted to one diamond at either side; the top-down plate runs
    // three tiles past the grid into the rim, and `paintExtent` keeps the view inside it.
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
