import type { MapScene, SceneScenery, Vec2 } from '../../core/types';
import { rubbleHeap } from './forestRoad';
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
 * The cover cells (legend `r`) of The Cutting and the Driller floor, checked
 * against the authoritative map rows in `quarryProjected.test.ts`. Each stands
 * the route's painted heap on the spill its ground pages lay round it, exactly
 * as the forest's two do, so real cover is the most legible thing on the board
 * rather than a faint diamond among decorative heaps.
 */
export const CUTTING_RUBBLE_CELLS: readonly Vec2[] = [
  { x: 8, y: 2 },
  { x: 12, y: 3 },
  { x: 6, y: 8 },
  { x: 12, y: 9 },
];
export const DRILLER_RUBBLE_CELLS: readonly Vec2[] = [
  { x: 8, y: 1 },
  { x: 11, y: 1 },
  { x: 2, y: 4 },
  { x: 2, y: 7 },
  { x: 8, y: 10 },
  { x: 11, y: 10 },
];

/** The Cutting's pool (legend `~`), checked against the map rows in `quarryProjected.test.ts`. */
export const CUTTING_WATER_CELLS: readonly Vec2[] = [
  { x: 7, y: 5 },
  { x: 8, y: 5 },
  { x: 9, y: 5 },
  { x: 10, y: 5 },
  { x: 7, y: 6 },
  { x: 8, y: 6 },
  { x: 9, y: 6 },
  { x: 10, y: 6 },
];
/**
 * The pool's plate: its eight cells plus the narrow dry margin round them, at
 * the forest pond's 16-pixel pad (`FOREST_POND_PATCH`). It is packed at twice
 * this size, as the forest's is.
 */
export const CUTTING_POOL_PATCH = { x: 752, y: 368, width: 416, height: 224 } as const;

/**
 * The reviewed projected ground pages for The Cutting, the pool's bank and bed
 * (packed like the forest pond's), and the painted heap on each cover cell. The
 * live water film, oil, mud and props remain overlays on top of these.
 */
export const CUTTING_SCENE: MapScene = {
  groundMode: 'partial',
  paintedRubble: CUTTING_RUBBLE_CELLS,
  ground: [
    ...QUARRY_SURROUND,
    ...routeGround('cutting-scene', CUTTING_GROUND_REGIONS),
    { url: 'art/maps/cutting-scene/pool-bank.webp', ...CUTTING_POOL_PATCH },
    ...CUTTING_RUBBLE_CELLS.map(rubbleHeap),
  ],
  scenery: CUTTING_EXTERIOR_RIM,
};

/** The same scene contract for the Driller floor, including its intentional rear gap. */
export const DRILLER_FLOOR_SCENE: MapScene = {
  groundMode: 'partial',
  paintedRubble: DRILLER_RUBBLE_CELLS,
  ground: [
    ...QUARRY_SURROUND,
    ...routeGround('driller-floor-scene', DRILLER_GROUND_REGIONS),
    ...DRILLER_RUBBLE_CELLS.map(rubbleHeap),
  ],
  // The surround owns the exterior mass; these walls and the rear stub own the
  // new structural context without changing the playable floor.
  scenery: [...DRILLER_FLOOR_WALLS, ...DRILLER_REAR_LOADING_SCENERY],
};
