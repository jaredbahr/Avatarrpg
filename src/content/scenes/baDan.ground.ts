/**
 * Ba Dan's ground (stage 4 of `docs/level-design.md`, ADR 0120): what the village's ground says, as data the shared
 * ground baker paints (`scripts/art/topdown/boards/ground.ts`) and the placement checks read (`groundChecks.ts`).
 * The rows in `maps/village.ts` stay the rules; this lays the ground over them.
 *
 * A pale quarry village, light from the upper left, the ground calm so the figures and the set pieces carry the
 * contrast (core G2): grass, the pale limestone dust of the square and lanes, the east road's old paving, the canal
 * dug in a clean kerb, the tea terrace cut into the hillside, the quarry hillside's pale face along the north, and
 * the rim falling into the void. The tracks are the brief's desire lines; the aprons its set pieces' ground. Houses,
 * walls, the table, the trough, the posts and the stone blocks are flat plinths until their set pieces stand there
 * (stage 5).
 */
import { BA_DAN_VILLAGE } from '../maps/village';
import {
  edgeGrowth,
  GroundTerrain,
  groundMouth,
  INHERIT,
  type GroundApron,
  type GroundGrowth,
  type GroundSpec,
  type GroundTrack,
} from '../ground';

/** The brief's desire lines (`docs/places/ba_dan_village.md`, "Daily life"), in cells (a cell's centre is +0.5). */
export const BA_DAN_TRACKS: readonly GroundTrack[] = [
  // the carts from the quarry: the old paving under it, rutted and worn pale
  // the stone carts' road in from the quarry: packed earth, two wheel ruts and a worn middle, narrowing through the gate
  {
    id: 'east_road',
    line: [
      [32, 9.55],
      [29.5, 9.6],
      [27.5, 9.6],
      [23.5, 9.5],
      [21, 8.7],
      [17.5, 8.6],
    ],
    width: 2,
    widths: [1.5, 1.4, 1.9, 2, 2, 1.8],
    wear: 3,
    ruts: true,
  },
  // everyone eats here three times a day: the most worn ground in the village
  { id: 'square_table', disk: [14, 9.5], r: 2.6, wear: 3 },
  {
    id: 'mira_door',
    line: [
      [13.5, 7.5],
      [13.6, 8.4],
    ],
    width: 1,
    wear: 3,
  },
  {
    id: 'shop_front',
    line: [
      [20.5, 7.5],
      [18, 8.3],
    ],
    width: 1.4,
    wear: 2,
  },
  {
    id: 'west_lane',
    line: [
      [12, 9.5],
      [8.6, 9.6],
      [5.5, 9.5],
    ],
    width: 1.4,
    wear: 2,
  },
  // the old road, little used since the ford flooded: it fades into the water
  {
    id: 'old_ford_road',
    line: [
      [5.5, 9.5],
      [3, 9.7],
      [1, 9.6],
    ],
    width: 1,
    wear: 1,
  },
  {
    id: 'terrace_steps',
    line: [
      [9.5, 4.5],
      [9.8, 6.4],
      [11, 7.6],
    ],
    width: 1,
    wear: 2,
  },
  // behind the houses: a crisp narrow short cut
  {
    id: 'back_path',
    line: [
      [9.5, 3.5],
      [15, 3.45],
      [20, 3.55],
      [24.6, 3.5],
    ],
    width: 1,
    wear: 1,
  },
  {
    id: 'side_gate',
    line: [
      [24.6, 3.5],
      [27.5, 3.5],
    ],
    width: 1,
    wear: 1,
  },
  {
    id: 'bridge',
    line: [
      [13.9, 11],
      [13.9, 14.4],
    ],
    width: 2,
    wear: 3,
  },
  {
    id: 'south_lane_west',
    line: [
      [13.5, 14.5],
      [8, 14.6],
      [2.5, 14.5],
    ],
    width: 1.2,
    wear: 2,
  },
  {
    id: 'south_lane_east',
    line: [
      [13.5, 14.6],
      [16, 15.5],
      [22, 15.45],
      [28.5, 15.5],
    ],
    width: 1.2,
    wear: 2,
  },
  {
    id: 'river_path',
    line: [
      [18.9, 15.5],
      [18.9, 18],
      [19, 20],
      [19, 23],
    ],
    width: 1.4,
    wear: 2,
  },
  {
    id: 'wash_steps',
    line: [
      [12.5, 10.6],
      [10.6, 11.0],
      [9, 11.3],
    ],
    width: 1,
    wear: 1,
  },
  // the watch stands at the wall's bell post (29,8): worn round it, the road through the gate less so beside it
  { id: 'gate_post', ring: [28.6, 8.5], r: 0.5, wear: 2 },
  {
    id: 'hut_yard',
    line: [
      [26.5, 7.5],
      [27, 8.5],
    ],
    width: 1,
    wear: 1,
  },
  // from the bridge down across the back lane, between Amri's and Senn's houses, to the coast-road sign on the rim
  {
    id: 'coast_sign',
    line: [
      [13.5, 15],
      [13.5, 18.2],
      [12.3, 18.8],
      [12, 19.5],
      [12, 21.6],
    ],
    width: 1,
    wear: 1,
  },
  // the brief's "mason's yard -> the east road": stone carried out of the yard to the lane
  {
    id: 'mason_yard',
    line: [
      [5.6, 7.5],
      [6.5, 8.4],
      [7.4, 9.4],
    ],
    width: 1.2,
    wear: 2,
  },
  // the house with the bent shutter, past the gardens' corner: its door's stub down to the lane
  {
    id: 'bent_shutter_door',
    line: [
      [24.5, 17.5],
      [24.6, 16.5],
      [24.4, 15.6],
    ],
    width: 1,
    wear: 1,
  },
  // the back lane (row 18): Senn's door east to the river path (his recovery spot is at the riverside)
  {
    id: 'senn_door',
    line: [
      [14.5, 18.5],
      [16.5, 18.55],
      [18.4, 18.5],
    ],
    width: 1,
    wear: 1,
  },
  // the back lane west: Amri's door to the coast path, and up it over the bridge to the square
  {
    id: 'back_lane',
    line: [
      [9.5, 18.5],
      [12.1, 18.5],
    ],
    width: 1,
    wear: 1,
  },
];

/** Every house door's packed stub (`home.*` and the other private doors), Ba Dan's own set pieces' ground. */
const door = (id: string, anchor: string, x: number, y: number, r = 0.7): GroundApron => ({
  id,
  anchor,
  kind: 'packed',
  at: [x + 0.5, y + 0.5],
  r,
});

export const BA_DAN_APRONS: readonly GroundApron[] = [
  // Gao's trough: carts water here, a dark damp ring with hoofprints out into the road
  { id: 'trough', anchor: 'trough', kind: 'wet', at: [21.5, 7.6], r: 1.2 },
  door('shop_door', 'bd02.shopfront', 20, 7, 1),
  door('mira_door', 'home.mira', 13, 7, 0.8),
  door('hut_door', 'bd03.post', 27, 8, 0.55),
  { id: 'shrine', anchor: 'shrine', kind: 'packed', at: [25.5, 8.1], r: 0.5 },
  // the mason's yard: the one place pale chips lie
  { id: 'mason_yard', anchor: 'home.hesra', kind: 'chips', rect: [5, 6, 8, 8] },
  // the vegetable gardens: common strips, one per household, rows east-west
  { id: 'gardens', anchor: 'gardens', kind: 'tilled', rect: [26, 2, 28, 4] },
  // the wash steps: the kerb darker and damp at the water
  { id: 'wash_steps', anchor: 'wash_steps', kind: 'damp', rect: [8, 11, 11, 11] },
  // grass surviving in the square's corners nobody walks, so the square reads as a place with edges
  { id: 'square_ne', anchor: 'square', kind: 'sward', rect: [15, 7, 17, 7] },
  { id: 'square_se', anchor: 'square', kind: 'sward', rect: [15, 11, 17, 11] },
  // the wash steps: treads cut down the north bank into the canal
  { id: 'wash_treads', anchor: 'wash_steps', kind: 'treads', rect: [9, 12, 10, 12] },
  // the ford: wet mud where the old road goes under
  { id: 'ford', anchor: 'ford', kind: 'mud', at: [1.2, 10], r: 1.4 },
  door('gao_back', 'home.gao', 22, 3),
  door('pella_door', 'home.pella', 9, 14),
  door('school_door', 'bd05.school', 6, 15),
  door('dorin_door', 'home.dorin', 26, 7, 0.5),
  door('hanru_door', 'home.hanru', 26, 15),
  door('amri_door', 'home.amri', 9, 18),
  // the two households on Gao's ledger, unnamed on purpose (SQ-03): a plain doorstep each, no `home.*` anchor
  door('blue_door', 'quarry_blue_door', 16, 15),
  door('bent_shutter_door', 'quarry_bent_shutter', 24, 17),
  door('leto_door', 'home.leto', 4, 15),
  door('hesra_door', 'home.hesra', 5, 7),
  door('senn_door', 'home.senn', 14, 18),
];

/** Where the walkable ground is, for the growth along the rim's tree line. */
const OPEN = ',.=';

/** Weeds where nobody walks (core G6). The baker never draws them on a track or in the welcome ground. */
export const BA_DAN_GROWTH: readonly GroundGrowth[] = [
  // the foot of every house's north (back) wall
  ...edgeGrowth('back_wall', BA_DAN_VILLAGE.rows, 'B', OPEN, ['north'], 0.12, 0.3, 0.07),
  // the inside of the east wall
  {
    id: 'east_wall',
    line: [
      [28.84, 3.1],
      [28.84, 8.7],
    ],
    width: 0.32,
    density: 0.08,
  },
  {
    id: 'east_wall_south',
    line: [
      [28.84, 11.2],
      [28.84, 11.9],
    ],
    width: 0.32,
    density: 0.05,
  },
  // the gardens' fence posts
  {
    id: 'garden_fence_south',
    line: [
      [25, 6.1],
      [29, 6.1],
    ],
    width: 0.3,
    density: 0.07,
  },
  {
    id: 'garden_fence_west',
    line: [
      [24.88, 1.9],
      [24.88, 6.1],
    ],
    width: 0.3,
    density: 0.07,
  },
  // round the shrine's base
  { id: 'shrine', ring: [25.5, 7.45], r: 0.62, density: 0.07 },
  // the rim's tree line
  ...edgeGrowth(
    'tree_line',
    BA_DAN_VILLAGE.rows,
    'T',
    OPEN,
    ['north', 'south', 'east', 'west'],
    -0.12,
    0.38,
    0.05,
  ),
];

export const BA_DAN_GROUND_SPEC: GroundSpec = {
  mapId: 'ba_dan_village',
  rows: BA_DAN_VILLAGE.rows,
  seed: 1300,
  classes: [
    { id: 'void', tile: { set: 'cliff32', key: 'LLLL' }, reads: 'void', terrain: 'V' },
    // the grass: the village's own approved set, calmed
    { id: 'grass', tile: { set: 'gc32', key: 'c0000' }, reads: 'ground', terrain: 'G', calm: 0.62 },
    // the square and the lanes: pale limestone dust, nearly white by noon
    {
      id: 'dust',
      tile: { set: 'q_floor32b', key: 'LLLL' },
      reads: 'ground',
      terrain: 'D',
      calm: 0.36,
      grade: [0.98, 0.97, 0.95],
      // packed darker where feet go, loose and pale at its fringes and against walls
      wears: 'packs',
      drifts: true,
    },
    // the east road: the stone carts' packed earth, calm, darker than the square's dust
    {
      id: 'road',
      tile: { set: 'q_floor32b', key: 'LLLL' },
      reads: 'ground',
      terrain: 'D',
      calm: 0.22,
      grade: [0.86, 0.82, 0.76],
      wears: 'packs',
    },
    // the bridge's paving, the only paving on the board: the village's approved cobble, calmed and warmed
    {
      id: 'cobble',
      tile: { set: 'gc32', key: 'c1111' },
      reads: 'ground',
      terrain: 'C',
      calm: 0.24,
      grade: [1.16, 1.08, 0.94],
    },
    // the rim's tree line: shaded ground, darker and cooler, where the trees will stand
    {
      id: 'shade',
      tile: { set: 'gc32', key: 'c0000' },
      reads: 'ground',
      terrain: 'G',
      calm: 0.55,
      grade: [0.66, 0.72, 0.74],
    },
    // the quarry hillside above the north rim: pale stone scree, darker and calmer than the lawn
    {
      id: 'hill',
      tile: { set: 'q_floor32b', key: 'LLLL' },
      reads: 'face',
      terrain: 'G',
      calm: 0.3,
      grade: [0.63, 0.63, 0.61],
    },
    { id: 'water', tile: { set: 'canal32', key: 'c0000' }, reads: 'water', terrain: 'W' },
    // the tea terrace's flags
    {
      id: 'terrace',
      tile: { set: 'flag32', key: 'c0000' },
      reads: 'ground',
      terrain: 'C',
      calm: 0.5,
      grade: [1.22, 1.17, 1.05],
    },
    // the flat plinths that stand in for houses, walls and pieces until stage 5
    {
      id: 'plinth',
      tile: { set: 'flag32', key: 'c0000' },
      reads: 'rock',
      terrain: 'C',
      calm: 0.1,
      grade: [0.8, 0.76, 0.74],
    },
  ],
  chars: {
    ',': 'grass',
    '.': 'dust',
    '=': 'road',
    T: 'shade',
    X: 'hill',
    W: 'water',
    // the made shapes lie on whatever their neighbours lie on, so nothing of theirs spills past their edges
    '~': INHERIT,
    '^': INHERIT,
    S: INHERIT,
    B: INHERIT,
    l: INHERIT,
    // walls and fences stand in the grass
    '#': 'grass',
    F: 'grass',
  },
  fallback: 'grass',
  made: {
    '~': { class: 'water', made: { shape: 'cell' }, draw: 'water', kerb: 6 },
    '^': { class: 'terrace', made: { shape: 'cell' }, draw: 'terrace', face: 9 },
    S: { class: 'terrace', made: { shape: 'cell' }, draw: 'steps' },
    B: { class: 'plinth', made: { shape: 'cell', inset: 2 }, draw: 'plinth' },
    '#': { class: 'plinth', made: { shape: 'link', width: 14, links: '#l' }, draw: 'plinth' },
    F: { class: 'plinth', made: { shape: 'link', width: 6, links: 'F#' }, draw: 'plinth' },
    l: { class: 'plinth', made: { shape: 'link', width: 26, links: 'l#' }, draw: 'plinth' },
  },
  // the bridge: the square's paving carried over the canal on its two cells, a built causeway between kerbs
  structures: [
    {
      id: 'bridge',
      box: [13, 12, 14, 13],
      made: { class: 'cobble', made: { shape: 'cell' }, draw: 'deck' },
      under: 'dust',
    },
  ],
  beyond: 'void',
  // the tree line and the canal run one cell past the grid, then the rim falls into the void
  ends: 'T~',
  margin: { left: 2, right: 2, top: 3, bottom: 2 },
  hill: { class: 'hill', height: 24, outcrops: 12 },
  tracks: BA_DAN_TRACKS,
  aprons: BA_DAN_APRONS,
  growth: BA_DAN_GROWTH,
  // the welcome ground: calm grass kept empty for the crowd inside the east gate
  quiet: [[18, 10, 28, 12]],
  mouths: [
    groundMouth('east-road', 'east', [
      { x: 31, y: 9 },
      { x: 31, y: 10 },
    ]),
    groundMouth('river-path', 'south', [
      { x: 18, y: 22 },
      { x: 19, y: 22 },
    ]),
  ],
  mouthReach: 3,
  palette: 'ba_dan',
};

export const BA_DAN_GROUND = new GroundTerrain(BA_DAN_GROUND_SPEC);
