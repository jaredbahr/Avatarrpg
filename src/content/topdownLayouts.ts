/**
 * The top-down layouts (ADR 0104 §3), by map: what the content validation checks against each map's
 * rows and what the ground packer bakes. CI and the packer import this; the shipped runtime never
 * does (it would pull the terrain classifier into the bundle), so it is not part of `CONTENT_BUNDLE`.
 */
import type { TopDownLayout } from './topdownLayout';
import { BA_DAN_TOPDOWN_TERRAIN } from './scenes/baDan.topdown.terrain';
import { BA_DAN_TOPDOWN_OBJECTS, BA_DAN_TOPDOWN_SLOTS } from './scenes/baDan.topdown';
import { FOREST_TOPDOWN_OBJECTS } from './scenes/forestRoad.topdown';
import {
  MOUTHS as FOREST_MOUTHS,
  MOUTH_REACH as FOREST_MOUTH_REACH,
  classifyPoint as classifyForest,
} from './scenes/forestRoad.topdown.terrain';

export const BA_DAN_TOPDOWN_LAYOUT: TopDownLayout = {
  mapId: 'ba_dan_village',
  terrain: BA_DAN_TOPDOWN_TERRAIN,
  objects: BA_DAN_TOPDOWN_OBJECTS,
  slots: BA_DAN_TOPDOWN_SLOTS,
};

export const FOREST_TOPDOWN_LAYOUT: TopDownLayout = {
  mapId: 'forest_road',
  terrain: {
    kind: 'forest-floor',
    classify: classifyForest,
    mouths: FOREST_MOUTHS,
    mouthReach: FOREST_MOUTH_REACH,
  },
  objects: FOREST_TOPDOWN_OBJECTS,
  slots: [],
};

export const TOPDOWN_LAYOUTS: readonly TopDownLayout[] = [
  BA_DAN_TOPDOWN_LAYOUT,
  FOREST_TOPDOWN_LAYOUT,
];
