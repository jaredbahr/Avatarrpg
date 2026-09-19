import type { MapScene } from '../../core/types';
import { CUTTING_EXTERIOR_RIM } from './quarryExteriorRims';

// Shared exterior painting, clipped clear of the authoritative 20 x 12 floor.
const quarrySurround = [
  { url: 'art/maps/quarry-surround/west.webp', x: -320, y: -560, width: 1344, height: 1664 },
  { url: 'art/maps/quarry-surround/east.webp', x: 1024, y: -560, width: 1344, height: 1664 },
];

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
  ground: [...quarrySurround, westGround('cutting-scene'), eastGround('cutting-scene')],
  scenery: CUTTING_EXTERIOR_RIM,
};

/** The same scene contract for the Driller floor, including its intentional rear gap. */
export const DRILLER_FLOOR_SCENE: MapScene = {
  ground: [...quarrySurround, westGround('driller-floor-scene'), eastGround('driller-floor-scene')],
  // The surround now owns the continuous exterior mass and the open rear recess.
  scenery: [],
};
