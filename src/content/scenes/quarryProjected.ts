import type { MapScene, SceneScenery, Vec2 } from '../../core/types';
import { CUTTING_EXTERIOR_RIM } from './quarryExteriorRims';
import { CUTTING_GROUND_REGIONS, DRILLER_GROUND_REGIONS } from './quarryRouteGround';

// Shared exterior painting, clipped clear of the authoritative 20 x 12 floor.
// The Cutting, the Driller floor and the gatehouse all sit on the same
// projected terrace, so one reviewed surround serves all three; a scene that
// omits it shows the board's diamond edge against bare backdrop.
export const QUARRY_SURROUND = [
  { url: 'art/maps/quarry-surround/west.webp', x: -320, y: -560, width: 1344, height: 1664 },
  { url: 'art/maps/quarry-surround/east.webp', x: 1024, y: -560, width: 1344, height: 1664 },
];

const routeGround = (
  directory: string,
  regions: readonly {
    name: string;
    bytes: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }[],
) =>
  regions.map(({ name, bytes: _bytes, ...region }) => ({
    url: `art/maps/${directory}/${name}.webp`,
    ...region,
  }));

const quarryGateWallRoot = 'art/maps/quarry-gate-scene/';
type QuarryWallVariant = 'interior' | 'end';

/** The two permanent stone stacks added to the Driller's playable interior. */
export const DRILLER_FLOOR_WALL_CELLS = [
  { x: 8, y: 4 },
  { x: 11, y: 7 },
] as const satisfies readonly Vec2[];

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
  wall: true,
  fadeWhenOccluding: true,
});

const DRILLER_FLOOR_WALLS: readonly SceneScenery[] = [
  drillerWall(DRILLER_FLOOR_WALL_CELLS[0], 'end'),
  drillerWall(DRILLER_FLOOR_WALL_CELLS[1], 'end'),
];

/**
 * A shallow, closed loading stub sits behind the mixed-height rear rim. Its
 * exterior footprint is decorative only: it must never make row 0 traversable
 * or flatten the playable ledges beneath it.
 */
export const DRILLER_REAR_LOADING_SCENERY: readonly SceneScenery[] = [
  {
    id: 'driller-rear-loading',
    url: 'art/maps/driller-floor-scene/rear-loading.webp',
    x: 1652,
    y: 382,
    width: 370,
    height: 249,
    footprint: DRILLER_REAR_LOADING_CELLS,
    depth: { x: 16.5, y: -0.5 },
    exterior: true,
  },
];

/**
 * The reviewed projected ground pages for The Cutting. Dynamic water, oil,
 * mud, rubble and props remain authored overlays on top of these pages.
 */
export const CUTTING_SCENE: MapScene = {
  groundMode: 'partial',
  ground: [...QUARRY_SURROUND, ...routeGround('cutting-scene', CUTTING_GROUND_REGIONS)],
  scenery: CUTTING_EXTERIOR_RIM,
};

/** The same scene contract for the Driller floor, including its intentional rear gap. */
export const DRILLER_FLOOR_SCENE: MapScene = {
  groundMode: 'partial',
  ground: [...QUARRY_SURROUND, ...routeGround('driller-floor-scene', DRILLER_GROUND_REGIONS)],
  // The surround owns the exterior mass; these walls and the rear stub own the
  // new structural context without changing the playable floor.
  scenery: [...DRILLER_FLOOR_WALLS, ...DRILLER_REAR_LOADING_SCENERY],
};
