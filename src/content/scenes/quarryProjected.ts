import type { MapScene, SceneScenery, Vec2 } from '../../core/types';
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

const quarryGateWallRoot = 'art/maps/quarry-gate-scene/';
type QuarryWallVariant = 'interior' | 'end';

/** The two permanent stone stacks added to the Driller's playable interior. */
export const DRILLER_FLOOR_WALL_CELLS: readonly Vec2[] = [
  { x: 8, y: 4 },
  { x: 11, y: 7 },
];

/** Reserved exterior anchor row for the art-owned loading/rail strip. */
export const DRILLER_REAR_LOADING_CELLS: readonly Vec2[] = [
  { x: 14, y: -1 },
  { x: 15, y: -1 },
  { x: 16, y: -1 },
  { x: 17, y: -1 },
  { x: 18, y: -1 },
  { x: 19, y: -1 },
];

const drillerWall = (cell: Vec2, variant: QuarryWallVariant): SceneScenery => ({
  id: `driller-wall-${cell.x}-${cell.y}`,
  url: `${quarryGateWallRoot}wall-${variant}.webp`,
  x: 768 + (cell.x - cell.y) * 64 - 64,
  y: (cell.x + cell.y + 1) * 32 - 144,
  width: 128,
  height: 176,
  footprint: [cell],
  depth: { x: cell.x + 0.5, y: cell.y + 0.5 },
  fadeWhenOccluding: true,
});

const DRILLER_FLOOR_WALLS: readonly SceneScenery[] = [
  drillerWall(DRILLER_FLOOR_WALL_CELLS[0] ?? { x: 8, y: 4 }, 'end'),
  drillerWall(DRILLER_FLOOR_WALL_CELLS[1] ?? { x: 11, y: 7 }, 'end'),
];

/**
 * The rear strip is registered by the separate art handoff once its source is
 * available. Keeping the hook here makes the footprint and layering contract
 * explicit without shipping a missing URL.
 */
export const DRILLER_REAR_LOADING_SCENERY: readonly SceneScenery[] = [];

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
  // The surround owns the exterior mass; these walls own the new interior cover.
  scenery: [...DRILLER_FLOOR_WALLS, ...DRILLER_REAR_LOADING_SCENERY],
};
