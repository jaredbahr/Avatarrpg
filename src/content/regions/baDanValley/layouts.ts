/**
 * Ba Dan valley's top-down layouts (ADR 0104 §3): what the content validation checks against each
 * map's rows and what the ground packer bakes. CI and the packer import this; the shipped runtime
 * never does (it would pull the terrain classifier into the bundle).
 */
import type { TopDownLayout } from '../../topdownLayout';
import { BA_DAN_TOPDOWN_TERRAIN } from '../../scenes/baDan.topdown.terrain';
import { BA_DAN_TOPDOWN_OBJECTS, BA_DAN_TOPDOWN_SLOTS } from '../../scenes/baDan.topdown';
import { FOREST_TOPDOWN_OBJECTS } from '../../scenes/forestRoad.topdown';
import {
  MOUTHS as FOREST_MOUTHS,
  MOUTH_REACH as FOREST_MOUTH_REACH,
  classifyPoint as classifyForest,
} from '../../scenes/forestRoad.topdown.terrain';
import {
  CUTTING_TOPDOWN_OBJECTS,
  QUARRY_FLOOR_TOPDOWN_OBJECTS,
  QUARRY_GATE_TOPDOWN_OBJECTS,
} from '../../scenes/quarry.topdown';
import {
  CUTTING_TERRAIN,
  QUARRY_FLOOR_TERRAIN,
  QUARRY_GATE_TERRAIN,
  quarryTerrain,
} from '../../scenes/quarry.topdown.terrain';

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

/** The quarry gate, the Cutting and the Driller floor (T5): terraced terrain, the prototype's objects. */
export const QUARRY_GATE_TOPDOWN_LAYOUT: TopDownLayout = {
  mapId: 'quarry_gate',
  terrain: quarryTerrain(QUARRY_GATE_TERRAIN),
  objects: QUARRY_GATE_TOPDOWN_OBJECTS,
  slots: [],
};
export const CUTTING_TOPDOWN_LAYOUT: TopDownLayout = {
  mapId: 'ambush_road',
  terrain: quarryTerrain(CUTTING_TERRAIN),
  objects: CUTTING_TOPDOWN_OBJECTS,
  slots: [],
};
export const QUARRY_FLOOR_TOPDOWN_LAYOUT: TopDownLayout = {
  mapId: 'quarry_floor',
  terrain: quarryTerrain(QUARRY_FLOOR_TERRAIN),
  objects: QUARRY_FLOOR_TOPDOWN_OBJECTS,
  slots: [],
};

export const BA_DAN_VALLEY_LAYOUTS: readonly TopDownLayout[] = [
  BA_DAN_TOPDOWN_LAYOUT,
  FOREST_TOPDOWN_LAYOUT,
  QUARRY_GATE_TOPDOWN_LAYOUT,
  CUTTING_TOPDOWN_LAYOUT,
  QUARRY_FLOOR_TOPDOWN_LAYOUT,
];
