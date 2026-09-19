import type { MapScene } from '../../core/types';
import { CUTTING_EXTERIOR_RIM, DRILLER_FLOOR_EXTERIOR_RIM } from './quarryExteriorRims';

const westGround = (directory: string) => ({
  url: `art/maps/${directory}/ground-west.webp`,
  x: -128,
  y: -192,
  width: 1152,
  height: 1280,
});

const eastGround = (directory: string) => ({
  url: `art/maps/${directory}/ground-east.webp`,
  x: 1024,
  y: -192,
  width: 1152,
  height: 1280,
});

/**
 * The reviewed projected ground pages for The Cutting. Dynamic water, oil,
 * mud, rubble and props remain authored overlays on top of these pages.
 */
export const CUTTING_SCENE: MapScene = {
  ground: [westGround('cutting-scene'), eastGround('cutting-scene')],
  scenery: CUTTING_EXTERIOR_RIM,
};

/** The same scene contract for the Driller floor, including its intentional rear gap. */
export const DRILLER_FLOOR_SCENE: MapScene = {
  ground: [westGround('driller-floor-scene'), eastGround('driller-floor-scene')],
  scenery: DRILLER_FLOOR_EXTERIOR_RIM,
};
