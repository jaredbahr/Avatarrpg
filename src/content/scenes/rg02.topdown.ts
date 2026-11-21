/**
 * Saltstep and Emberwatch's top-down layouts (RG-02, ADR 0104 §3): each board's terrain and the pieces placed on it,
 * beside the maps' rows, which stay the authority for collision. CI and the ground packer read these
 * (`scripts/art/topdown/boards/rg02.ts`); the shipped runtime draws the packed scene and never imports them.
 */
import type { Vec2 } from '../../core/types';
import type { TopDownLayout, TopDownObject } from '../topdownLayout';
import {
  EMBERWATCH_PARADE,
  EMBERWATCH_POWER_YARD,
  SALTSTEP_MARKET,
  SALTSTEP_PLATFORM,
  RIVER_ROAD,
  RIVER_ROAD_BRIDGE,
  RIVER_ROAD_BRIDGE_CROP,
  SALTSTEP_PONTOON,
} from '../regions/saltstepEmberwatch/maps';
import { MOUTH_REACH, RG, Rg02Terrain, mouth } from './rg02.topdown.terrain';

const C = 40;

/** A piece standing on `cells`, centred on them, its base on their bottom edge. */
function piece(
  id: string,
  sprite: string,
  kind: TopDownObject['kind'],
  cells: readonly [number, number][],
  solid: boolean,
  nudge: { readonly x?: number; readonly base?: number } = {},
): TopDownObject {
  const xs = cells.map(([x]) => x),
    ys = cells.map(([, y]) => y);
  const x = ((Math.min(...xs) + Math.max(...xs) + 1) / 2) * C + (nudge.x ?? 0);
  const base = (Math.max(...ys) + 1) * C + (nudge.base ?? 0);
  return {
    id,
    sprite,
    kind,
    x,
    base,
    footprint: cells.map(([cx, cy]) => ({ x: cx, y: cy })),
    solid,
    depth: { x: x / C, y: base / C },
  };
}

const block = (x0: number, x1: number, y0: number, y1: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]);
  return out;
};

/** A piece standing past the playable edge (the town beyond the market, the boats beyond the bay). */
const ext = (
  id: string,
  sprite: string,
  kind: TopDownObject['kind'],
  cells: readonly [number, number][],
  nudge: { readonly x?: number; readonly base?: number } = {},
): TopDownObject => ({ ...piece(id, sprite, kind, cells, false, nudge), exterior: true });
const flip = (o: TopDownObject): TopDownObject => ({ ...o, flip: true });
/**
 * A flat piece with height (a boat, a rock, a piling, a buoy) laid in the plate with its own contact line and short
 * cast, as a prop is: "almost everything gets a shadow" (owner, 2026-11-21; #931). Gulls sitting on the water too
 * (owner on #933: "give the gulls one").
 */
const grounded = (o: TopDownObject): TopDownObject => ({ ...o, grounded: true });

/* ------------------------------------------------------------------ */
/* Saltstep market (`docs/places/saltstep_market.md`), stage 4         */
/* ------------------------------------------------------------------ */

export const SALTSTEP_MARKET_TERRAIN = new Rg02Terrain({
  mapId: 'saltstep_market',
  rows: SALTSTEP_MARKET.rows,
  // The harbour town on the water: grass behind the quay (`,`), the packed-earth coast road and shore lane (`=`, `.`),
  // the quay's sand (`:`), the pole walk and the platform ring on planks over the harbour (`w`, `W`). Past the grid the
  // rows carry on: the town off the top, the headland the road comes down, the open harbour south and east.
  chars: {
    ',': RG.grass,
    '.': RG.earth,
    '=': RG.earth,
    ':': RG.sand,
    w: RG.deck,
    W: RG.water,
    // The town's edge (`U`) is the rim: the map edge falls into the void (ADR 0103), the ground's earth face hanging
    // over it. Stage 5 stands the house backs and trees on its lip.
    U: RG.void,
    // GREY STAND-INS until the set-piece plan (stage 5): the other blocked cells (the buildings `B`, the bowl stall
    // `n`, the platforms' posts `k`) are one-tier blocks of plain flagstone with a cut face and a short hard cast,
    // blocked terrain with no piece on them. Stage 5 puts the brief's pieces there and the ground goes back under them.
    B: RG.stone,
    n: RG.stone,
    k: RG.stone,
  },
  beyond: RG.void,
  // the coast road's packed earth is a road the mouth runs out on; the grass is the soil
  earthTerrain: 'D',
  raised: { B: 1, n: 1, k: 1 },
  rock: 'Bnk',
  mouths: [
    mouth('coast-road', 'west', [
      { x: 0, y: 5 },
      { x: 0, y: 6 },
    ]),
  ],
});

/** The cells of a rectangle that the market's rows make walkable. */
const marketSpan = (x0: number, x1: number, y0: number, y1: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const ch = SALTSTEP_MARKET.rows[y]?.[x] ?? 'W';
      if (!'UBnkW'.includes(ch)) out.push([x, y]);
    }
  return out;
};

/**
 * The market's desire lines (the brief's "Daily life"), worn paler where feet go. Only the lines: the rest of the quay,
 * the grass and the platforms stay calm (`docs/level-design-core.md` G2, G3).
 */
export const SALTSTEP_MARKET_WORN: readonly (readonly [number, number])[] = [
  // the coast road into the cart stop, and on round the bowl stall (everyone's first stop)
  ...marketSpan(0, 4, 5, 6),
  ...marketSpan(6, 8, 6, 7),
  // the pole walk out over the water (the main route)
  ...marketSpan(7, 8, 8, 10),
  // the west platform's heart, boats to racks to stalls (short, wet, heavily worn)
  ...marketSpan(7, 10, 11, 12),
  // the south walk round the ring
  ...marketSpan(9, 21, 14, 14),
  // the east platform and up the ferry jetty
  ...marketSpan(21, 24, 12, 13),
  ...marketSpan(25, 27, 11, 11),
  ...marketSpan(26, 27, 7, 10),
  // back along the shore to the arrival (the loop)
  ...marketSpan(9, 25, 6, 6),
  // the shore lane, carts to the freight office and the freight side (wide)
  ...marketSpan(2, 21, 4, 4),
  ...marketSpan(14, 19, 5, 5),
];

export const SALTSTEP_MARKET_TOPDOWN_LAYOUT: TopDownLayout = {
  mapId: 'saltstep_market',
  terrain: {
    kind: 'classified',
    classify: SALTSTEP_MARKET_TERRAIN.classify,
    mouths: SALTSTEP_MARKET_TERRAIN.config.mouths,
    mouthReach: MOUTH_REACH,
  },
  // no set pieces yet: stage 5 places the brief's pieces as boxes on the grey stand-ins
  objects: [],
  slots: [],
};

/* ------------------------------------------------------------------ */
/* The freight pontoon                                                 */
/* ------------------------------------------------------------------ */

export const SALTSTEP_PONTOON_TERRAIN = new Rg02Terrain({
  mapId: 'saltstep_pontoon',
  rows: SALTSTEP_PONTOON.rows,
  chars: { W: RG.water, w: RG.deck, c: RG.deck, B: RG.deck, k: RG.deck },
  beyond: RG.water,
  mouths: [],
});

export const SALTSTEP_PONTOON_OBJECTS: readonly TopDownObject[] = [
  // The winch and the crane with the tenth crate in its sling, on the platform (the `B` cells).
  piece(
    'winch',
    'winch',
    'prop',
    [
      [15, 3],
      [15, 4],
    ],
    true,
  ),
  piece(
    'crane',
    'crane_sling',
    'prop',
    [
      [16, 3],
      [16, 4],
    ],
    true,
  ),
  // The cover (`c`): the cast-iron pump crate and freight at the party's end.
  piece('cover_a', 'tool_crates', 'prop', [[6, 2]], false),
  piece('pump_crate', 'pump_crate', 'prop', [[6, 3]], false),
  piece('cover_b', 'tool_crates', 'prop', [[5, 7]], false),
  piece('cover_c', 'tool_crates', 'prop', [[5, 8]], false),
  // The landmark: the big cargo barge moored alongside the platform, where the sling is heading.
  grounded(piece('big_barge', 'big_barge', 'flat', block(13, 16, 9, 9), false, { base: 22 })),
  // The freight quay behind the deck (`k`, row 0): the dock crane, the gantry, cargo under tarps, drums and crates,
  // and the yard running on past the edge.
  piece('quay_crane', 'dock_crane', 'prop', [[1, 0]], true, { base: -14 }),
  piece('quay_cargo_a', 'cargo_stack', 'prop', [[2, 0]], true),
  piece('quay_drums', 'oil_drums', 'prop', [[3, 0]], true),
  piece('quay_gantry', 'pulley_gantry', 'prop', block(4, 5, 0, 0), true),
  piece('quay_crates', 'crate_stack', 'prop', [[6, 0]], true),
  flip(piece('quay_cargo_b', 'cargo_stack', 'prop', [[7, 0]], true)),
  piece('quay_barrels', 'barrels', 'prop', [[8, 0]], true),
  piece('quay_crates_b', 'tool_crates', 'prop', [[9, 0]], true),
  piece('quay_drums_b', 'oil_drums', 'prop', [[10, 0]], true),
  piece('quay_pots', 'lobster_pots', 'prop', [[0, 0]], true, { x: -4, base: -14 }),
  ext('yard_warehouse', 'ek_warehouse', 'house', block(0, 3, -2, -2), { base: 8 }),
  ext('yard_crane', 'dock_crane', 'prop', [[5, -1]], { base: -4 }),
  ext('yard_cargo_a', 'cargo_stack', 'prop', [[6, -1]], { base: -6 }),
  ext('yard_cargo_b', 'cargo_stack', 'prop', [[7, -2]], { base: 4 }),
  ext('yard_crates', 'crate_stack', 'prop', [[8, -1]], { base: -10 }),
  ext('yard_drums', 'oil_drums', 'prop', [[9, -2]], { base: 6 }),
  ext('yard_gantry', 'pulley_gantry', 'prop', block(9, 10, -1, -1), { x: 10, base: -2 }),
  ext('yard_barrels', 'barrels', 'prop', [[1, -1]], { base: -2 }),
  ext('yard_pots', 'lobster_pots', 'prop', [[4, -1]], { base: -8 }),
  ext('yard_crates_b', 'tool_crates', 'prop', [[4, -2]], { base: 2 }),
  ext('yard_cargo_c', 'cargo_stack', 'prop', [[10, -2]], { x: 6, base: 8 }),
  ext('yard_crates_c', 'crate_stack', 'prop', [[0, -1]], { x: -10, base: -6 }),
  ext('yard_drums_b', 'oil_drums', 'prop', [[3, -1]], { base: -12 }),
  ext('yard_cart', 'handcart', 'prop', [[7, -1]], { x: 8, base: -14 }),
  ext('yard_rack', 'drying_rack', 'prop', [[8, -2]], { base: 6 }),
  ext('east_cargo', 'cargo_stack', 'prop', [[19, 3]], { x: 8, base: -4 }),
  ext('east_drums', 'oil_drums', 'prop', [[20, 3]], { x: 4, base: 6 }),
  // Chains lying on the deck where the handlers work (flat, under the fight).
  grounded(piece('chain_a', 'chain_pile', 'flat', [[3, 9]], false)),
  grounded(piece('chain_b', 'chain_pile', 'flat', [[9, 2]], false)),
  grounded(flip(piece('chain_c', 'chain_pile', 'flat', [[17, 6]], false))),
  // The pontoon stands on piles: posts in the water round its edge, rope lines across the gaps, buoys and boats.
  ...(
    [
      [0, 2],
      [0, 5],
      [0, 8],
      [1, 10],
      [4, 11],
      [7, 11],
      [10, 11],
      [11, 2],
      [11, 9],
      [13, 2],
      [12, 7],
      [14, 8],
      [18, 6],
      [18, 2],
      [12, 1],
    ] as const
  ).map(([x, y], i) => {
    const pile = grounded(piece(`pile_${x}_${y}`, 'pilings', 'flat', [[x, y]], false));
    return i % 2 ? flip(pile) : pile;
  }),
  piece('rope_gap', 'rope_line', 'flat', [[11, 6]], false, { x: 20 }),
  piece('rope_south', 'rope_line', 'flat', [[12, 9]], false, { x: 20 }),
  grounded(piece('buoy_a', 'buoy', 'flat', [[15, 1]], false)),
  grounded(piece('buoy_b', 'buoy', 'flat', [[2, 11]], false)),
  grounded(piece('buoy_c', 'buoy', 'flat', [[13, 10]], false)),
  grounded(piece('rowboat', 'rowboat', 'flat', [[16, 1]], false)),
  grounded(piece('gulls', 'gulls', 'flat', [[8, 11]], false)),
  grounded(ext('far_sailboat', 'sailboat', 'flat', [[3, 13]])),
  grounded(ext('far_rowboat', 'rowboat', 'flat', [[14, 13]])),
  grounded(ext('far_gulls', 'gulls', 'flat', [[20, 10]])),
];

/* ------------------------------------------------------------------ */
/* SF-2.2's tipping platform (`docs/places/saltstep_platform.md`)      */
/* ------------------------------------------------------------------ */

export const SALTSTEP_PLATFORM_TERRAIN = new Rg02Terrain({
  mapId: 'saltstep_platform',
  rows: SALTSTEP_PLATFORM.rows,
  // the deck, its raised north step (`h`, ramps `H`) and the cells its counter stub and bollards stand on (`F`)
  chars: { W: RG.water, w: RG.deck, h: RG.deck, H: RG.deck, F: RG.deck },
  beyond: RG.water,
  mouths: [],
});

/** The north step, one up (the map's elevation 1), a ramp at each end: drawn by the board's `raised`. */
export const SALTSTEP_PLATFORM_RAISED: readonly (readonly [number, number, boolean])[] = [
  3, 4, 5, 6, 7, 8, 9, 10, 11,
].map((x) => [x, 2, x === 3 || x === 11] as const);

export const SALTSTEP_PLATFORM_OBJECTS: readonly TopDownObject[] = [
  // The focal point: the old stall's counter stub down the seam the deck tips on, open at both ends.
  piece(
    'counter',
    'counter_side',
    'prop',
    [
      [7, 4],
      [7, 5],
      [7, 6],
    ],
    true,
  ),
  // Two mooring bollards at diagonal corners, where boats tie on.
  piece('bollard_nw', 'bollard', 'prop', [[3, 3]], true, { x: 4, base: -12 }),
  flip(piece('bollard_se', 'bollard', 'prop', [[11, 7]], true, { x: -10, base: -16 })),
  // The market's signature, seen from here: a painted tide pole in the water off the north-east corner, flat like the
  // piles, since it stands in open water where nobody walks.
  grounded(piece('tide_pole', 'level_pole', 'flat', [[12, 1]], false)),
  // Moored loose: piles in the water round it, a buoy or two, gulls, and Tavi's boat off the south side.
  ...(
    [
      [2, 3],
      [2, 7],
      [12, 4],
      [12, 7],
      [5, 8],
      [10, 8],
    ] as const
  ).map(([x, y], i) => {
    const pile = grounded(piece(`pile_${x}_${y}`, 'pilings', 'flat', [[x, y]], false));
    return i % 2 ? flip(pile) : pile;
  }),
  grounded(piece('rowboat', 'rowboat', 'flat', [[7, 9]], false)),
  grounded(piece('buoy_a', 'buoy', 'flat', [[1, 1]], false)),
  grounded(piece('buoy_b', 'buoy', 'flat', [[13, 9]], false)),
  grounded(piece('gulls', 'gulls', 'flat', [[2, 9]], false)),
  grounded(ext('far_sailboat', 'sailboat', 'flat', [[11, 12]])),
  grounded(ext('far_rowboat', 'rowboat', 'flat', [[1, 12]])),
];

export const SALTSTEP_PLATFORM_TOPDOWN_LAYOUT: TopDownLayout = {
  mapId: 'saltstep_platform',
  terrain: {
    kind: 'classified',
    classify: SALTSTEP_PLATFORM_TERRAIN.classify,
    mouths: [],
    mouthReach: MOUTH_REACH,
  },
  objects: SALTSTEP_PLATFORM_OBJECTS,
  slots: [],
};

export const SALTSTEP_PONTOON_TOPDOWN_LAYOUT: TopDownLayout = {
  mapId: 'saltstep_pontoon',
  terrain: {
    kind: 'classified',
    classify: SALTSTEP_PONTOON_TERRAIN.classify,
    mouths: [],
    mouthReach: MOUTH_REACH,
  },
  objects: SALTSTEP_PONTOON_OBJECTS,
  slots: [],
};

/* ------------------------------------------------------------------ */
/* Emberwatch parade ground                                            */
/* ------------------------------------------------------------------ */

export const EMBERWATCH_PARADE_TERRAIN = new Rg02Terrain({
  mapId: 'emberwatch_parade',
  rows: EMBERWATCH_PARADE.rows,
  // the barracks wall's row (`#`) stands on packed earth; the parade square and the east gate are the old flagstones
  chars: {
    T: RG.void,
    '#': RG.earth,
    ',': RG.earth,
    u: RG.earth,
    q: RG.earth,
    ':': RG.stone,
    '=': RG.stone,
    w: RG.deck,
    W: RG.water,
  },
  beyond: RG.void,
  mouths: [
    mouth('power-yard', 'east', [
      { x: 23, y: 7 },
      { x: 23, y: 8 },
    ]),
  ],
});

/** A run of the outpost wall: two cells a section, the sections overlapping so the wall reads as one. */
const wallRun = (from: number, to: number): TopDownObject[] => {
  const out: TopDownObject[] = [];
  for (let x = from, i = 0; x <= to; x += 2, i++) {
    const cells: [number, number][] =
      x + 1 <= to
        ? [
            [x, 1],
            [x + 1, 1],
          ]
        : [[x, 1]];
    const wall = piece(`wall_${x}`, 'fn_wall', 'prop', cells, true);
    out.push(i % 2 ? flip(wall) : wall);
  }
  return out;
};

export const EMBERWATCH_PARADE_OBJECTS: readonly TopDownObject[] = [
  // The north side (`#`): the outpost wall either side of the barracks, the spear-rack trellis the volunteers grow
  // beans on, and the landmark, the old signal tower jutting out at the east corner.
  ...wallRun(1, 8),
  piece('trellis', 'spear_trellis', 'prop', [[9, 1]], true),
  piece('barracks', 'fn_barracks', 'house', block(10, 13, 1, 1), true),
  ...wallRun(14, 20),
  piece('signal_tower', 'fn_signal_tower', 'prop', block(21, 22, 1, 1), true),
  // Faded banners on the lane under the wall, and braziers at the square's four corners (`u`).
  piece('banner_w', 'fn_banner', 'prop', [[4, 2]], true),
  flip(piece('banner_e', 'fn_banner', 'prop', [[19, 2]], true)),
  piece('brazier_nw', 'fn_brazier', 'prop', [[2, 3]], true),
  piece('brazier_ne', 'fn_brazier', 'prop', [[21, 3]], true),
  piece('brazier_sw', 'fn_brazier', 'prop', [[2, 9]], true),
  piece('brazier_se', 'fn_brazier', 'prop', [[21, 9]], true),
  piece('weapon_rack', 'weapon_rack', 'prop', [[22, 4]], true),
  piece('lamp_w', 'outpost_lamp', 'prop', [[7, 2]], true),
  piece('lamp_e', 'outpost_lamp', 'prop', [[16, 2]], true),
  piece('east_crates', 'crate_stack', 'prop', [[22, 5]], true),
  piece('east_barrels', 'barrels', 'prop', [[22, 6]], true),
  piece('west_crates', 'tool_crates', 'prop', [[1, 7]], true),
  piece('banner_sw', 'fn_banner', 'prop', [[6, 10]], true),
  piece('brazier_s_a', 'fn_brazier', 'prop', [[9, 10]], true),
  piece('brazier_s_b', 'fn_brazier', 'prop', [[14, 10]], true),
  flip(piece('banner_se', 'fn_banner', 'prop', [[17, 10]], true)),
  piece('tent_b', 'fn_tent', 'prop', block(11, 12, 14, 14), true, { base: -12 }),
  piece('south_barrels', 'barrels', 'prop', [[10, 14]], true, { base: -12 }),
  // The west rock spur (`q`).
  piece(
    'spur_west',
    'rock_spur',
    'prop',
    [
      [1, 3],
      [1, 4],
    ],
    true,
    { x: -8 },
  ),
  piece('boulders_w_a', 'boulders', 'prop', [[1, 5]], true, { x: -6 }),
  flip(piece('boulders_w_b', 'boulders', 'prop', [[1, 6]], true, { x: -4 })),
  // The south half: dummies, the trough and the flag mast; tents and supplies; targets; the sparring ring; the
  // lantern shrine by the jetty; the south-east rocks.
  piece('dummy_a', 'training_dummy', 'prop', [[2, 10]], true),
  flip(piece('dummy_b', 'training_dummy', 'prop', [[2, 11]], true)),
  piece('trough', 'water_trough', 'prop', block(21, 22, 10, 10), true),
  piece('flag_mast', 'fn_flag_mast', 'prop', [[19, 11]], true),
  piece('tent', 'fn_tent', 'prop', block(14, 15, 12, 12), true),
  piece('supply_crates', 'tool_crates', 'prop', [[16, 12]], true),
  piece('supply_barrels', 'barrels', 'prop', [[17, 12]], true),
  piece('target_a', 'straw_target', 'prop', [[18, 13]], true),
  flip(piece('target_b', 'straw_target', 'prop', [[16, 14]], true, { base: -12 })),
  piece('shrine', 'fn_lantern_shrine', 'prop', [[8, 14]], true, { base: -12 }),
  piece('spur_se_a', 'rock_spur', 'prop', block(21, 22, 12, 12), true),
  flip(piece('spur_se_b', 'rock_spur', 'prop', block(20, 22, 13, 13), true)),
  piece('boulders_se', 'boulders', 'prop', block(19, 20, 14, 14), true, { base: -12 }),
  flip(piece('spur_se_c', 'rock_spur', 'prop', block(21, 22, 14, 14), true, { base: -12 })),
  // Flat on the ground: the cook's beans drying on an old tent canvas, the sparring ring.
  piece(
    'beans',
    'bean_canvas',
    'flat',
    [
      [6, 3],
      [7, 3],
    ],
    false,
  ),
  piece('sparring_ring', 'sparring_ring', 'flat', block(9, 11, 11, 12), false),
  // The bay off the jetty: Tavi's ferry, a rowing boat, rocks, gulls.
  grounded(piece('ferry', 'ferry', 'flat', [[3, 15]], false)),
  grounded(piece('rowboat', 'rowboat', 'flat', [[0, 13]], false, { x: 8 })),
  grounded(piece('rocks_bay', 'shore_rocks', 'flat', [[6, 15]], false)),
  grounded(piece('gulls', 'gulls', 'flat', [[1, 15]], false)),
];

export const EMBERWATCH_PARADE_TOPDOWN_LAYOUT: TopDownLayout = {
  mapId: 'emberwatch_parade',
  terrain: {
    kind: 'classified',
    classify: EMBERWATCH_PARADE_TERRAIN.classify,
    mouths: EMBERWATCH_PARADE_TERRAIN.config.mouths,
    mouthReach: MOUTH_REACH,
  },
  objects: EMBERWATCH_PARADE_OBJECTS,
  slots: [],
};

/* ------------------------------------------------------------------ */
/* Emberwatch power yard                                               */
/* ------------------------------------------------------------------ */

export const EMBERWATCH_POWER_YARD_TERRAIN = new Rg02Terrain({
  mapId: 'emberwatch_power_yard',
  rows: EMBERWATCH_POWER_YARD.rows,
  // the void (`#`) is the rim, its gate (`=`) flagstones; the shed (`U`) and the clutter (`d`) stand on packed earth; the cistern (`W`) stands on the mud; the overflow (`~`) lies in puddles
  chars: {
    '#': RG.void,
    '.': RG.earth,
    d: RG.earth,
    '=': RG.stone,
    '~': RG.puddle,
    F: RG.earth,
    W: RG.earth,
    U: RG.earth,
  },
  // the shed and the clutter stand on the yard's own edge: past them the ground falls away
  ends: 'Udu',
  beyond: RG.void,
  mouths: [
    mouth('parade', 'west', [
      { x: 0, y: 5 },
      { x: 0, y: 6 },
    ]),
  ],
});

export const EMBERWATCH_POWER_YARD_OBJECTS: readonly TopDownObject[] = [
  // The landmark: Luli's generator shed in the north-west corner, where the live line starts.
  piece('generator_shed', 'generator_shed', 'prop', block(1, 4, 0, 2), true),
  // The live line along the north side (`F`): a pole every two cells, each carrying its span of cable east.
  ...[5, 7, 9, 11, 13].map((x) =>
    piece(
      `line_${x}`,
      'line_pole',
      'prop',
      [
        [x, 1],
        [x + 1, 1],
      ],
      true,
    ),
  ),
  // Spare stock behind the line: coils, transformer drums, reels and crates of insulators.
  piece('back_drum_a', 'transformer_drum', 'prop', [[5, 0]], true),
  piece('back_coils_a', 'copper_coils', 'prop', [[6, 0]], true),
  piece('back_insulators_a', 'insulator_crate', 'prop', [[7, 0]], true),
  piece('back_drum_b', 'transformer_drum', 'prop', [[8, 0]], true),
  flip(piece('back_reel_b', 'cable_reel', 'prop', [[9, 0]], true)),
  piece('back_sign', 'warning_sign', 'prop', [[10, 0]], true),
  flip(piece('back_coils_b', 'copper_coils', 'prop', [[11, 0]], true)),
  piece('back_drum_c', 'transformer_drum', 'prop', [[12, 0]], true),
  flip(piece('back_insulators_b', 'insulator_crate', 'prop', [[13, 0]], true)),
  piece('back_oil', 'oil_drums', 'prop', [[14, 0]], true),
  // Past the north edge, the yard's overflow: more stock left out on the bare ground.
  ext('beyond_drum_a', 'transformer_drum', 'prop', [[2, -1]]),
  flip(ext('beyond_reel_a', 'cable_reel', 'prop', [[4, -1]])),
  ext('beyond_coils', 'copper_coils', 'prop', [[7, -1]]),
  ext('beyond_oil', 'oil_drums', 'prop', [[10, -1]]),
  ext('beyond_reel_b', 'cable_reel', 'prop', [[12, -1]]),
  ext('beyond_drum_b', 'transformer_drum', 'prop', [[14, -1]]),
  // The overflowing rain cistern (`W`), and the dead copper spur on its own poles at the back (east).
  piece('cistern', 'cistern', 'prop', block(15, 17, 1, 2), true),
  piece('spur_north', 'copper_spur', 'prop', block(17, 17, 4, 6), true),
  // the south spur stands back from the yard's corner, so its shadow falls on the yard and not into the rim
  piece('spur_south', 'copper_spur', 'prop', block(17, 17, 7, 8), true, { x: -8, base: -16 }),
  // The west side, either side of the gate: the switch panel by the shed, stock down to the corner.
  piece('switch_panel', 'switch_panel', 'prop', [[0, 4]], true),
  piece('west_reel', 'cable_reel', 'prop', [[0, 7]], true),
  piece('west_drum', 'transformer_drum', 'prop', [[0, 8]], true),
  piece('west_insulators', 'insulator_crate', 'prop', [[0, 9]], true),
  piece('west_oil', 'oil_drums', 'prop', [[0, 10]], true, { base: -12 }),
  // The public workshop bench by the south-west corner, a row up so its shadow falls on the yard.
  piece('bench', 'workshop_bench', 'prop', [[1, 9]], true),
  // The low rocky rise on the south side; the last row's pieces stand back so their shadows stay on the ground.
  piece('rise_a', 'rock_spur', 'prop', block(7, 8, 10, 10), true, { base: -12 }),
  piece('rise_b', 'boulders', 'prop', block(9, 10, 10, 10), true, { base: -12 }),
  piece('south_oil', 'oil_drums', 'prop', [[11, 11]], true, { base: -12 }),
  piece('south_reel', 'cable_reel', 'prop', [[12, 11]], true, { base: -12 }),
  piece('south_crates', 'crate_stack', 'prop', [[13, 11]], true, { base: -12 }),
  piece('south_sign', 'warning_sign', 'prop', [[14, 11]], true, { base: -12 }),
  piece('south_insulators', 'insulator_crate', 'prop', [[15, 11]], true, { base: -12 }),
  piece('south_barrels', 'barrels', 'prop', [[16, 11]], true, { base: -12 }),
  piece('east_drum', 'transformer_drum', 'prop', [[17, 9]], true, { base: -12 }),
  flip(piece('east_reel', 'cable_reel', 'prop', [[18, 9]], true, { x: -6, base: -12 })),
  // Cables across the yard from the shed, and from the stock in the south-east corner.
  piece('cable_shed', 'cable_run', 'flat', block(2, 4, 3, 3), false),
  flip(piece('cable_east', 'cable_run', 'flat', block(14, 16, 9, 9), false)),
];

export const EMBERWATCH_POWER_YARD_TOPDOWN_LAYOUT: TopDownLayout = {
  mapId: 'emberwatch_power_yard',
  terrain: {
    kind: 'classified',
    classify: EMBERWATCH_POWER_YARD_TERRAIN.classify,
    mouths: EMBERWATCH_POWER_YARD_TERRAIN.config.mouths,
    mouthReach: MOUTH_REACH,
  },
  objects: EMBERWATCH_POWER_YARD_OBJECTS,
  slots: [],
};

/* ------------------------------------------------------------------ */
/* The river road (`docs/places/river_road.md`), stage 4: the ground   */
/* ------------------------------------------------------------------ */

export const RIVER_ROAD_TERRAIN = new Rg02Terrain({
  mapId: 'river_road',
  rows: RIVER_ROAD.rows,
  // Open countryside: grass under the trees (`T`) and the bank's boulders (`U`), the packed-earth road (`=`) and its
  // pull-offs (`.`, and the camp's crates `F`), the gravel bars and the ford (`:`, `~`), the plank bridge and the
  // landing (`w`, water under their pieces), and the cliff at the bend and the lookout's rise (`X`, `^`, `S`) as grey rock, the cliff and the rise raised (`raised`). Past the grid the
  // rows carry on: the wooded hills to the north, the river to the south, the road out of each end.
  chars: {
    ',': RG.grass,
    T: RG.grass,
    U: RG.grass,
    '.': RG.earth,
    '=': RG.earth,
    F: RG.earth,
    ':': RG.sand,
    '~': RG.puddle, // the ford's clear shallows over pebbles
    W: RG.water,
    // The plank bridge and the landing's jetty are pieces (`plank_bridge`, `country_jetty`) laid over the water, so
    // the plate paints water under them rather than a baked plank patch round their edges. The cells still read as
    // deck on the map, so the party walks across.
    w: RG.water,
    X: RG.stone,
    '^': RG.stone,
    S: RG.stone,
  },
  beyond: RG.grass,
  earthTerrain: 'D',
  // the face's height in tiers, not the rules' elevation (the legend's): the bend's cliff shows three tiers of face, a
  // wall that hides the bend, and no one climbs it; the lookout's rise is one tier, walked up its ramp (`S`)
  // (`docs/places/river_road.md`, decision 9; owner, 2026-11-20: "make the cliff taller")
  raised: { X: 3, '^': 1 },
  rock: 'X',
  mouths: [
    mouth('emberwatch', 'west', [
      { x: 0, y: 5 },
      { x: 0, y: 6 },
    ]),
  ],
});

/** The cells the river road's walkers wear: every road and pull-off cell, the lookout's ramp, and the landing's path. */
export const RIVER_ROAD_WORN: readonly (readonly [number, number])[] = [
  ...RIVER_ROAD.rows.flatMap((row, y) =>
    [...row].flatMap((ch, x): [number, number][] => ('=.FS'.includes(ch) ? [[x, y]] : [])),
  ),
  // the footpath down the bank from the shade stop to the landing
  [7, 7],
  [7, 8],
  [7, 9],
  // the worn track off the bend up to the lookout
  [34, 2],
  [35, 2],
];

/** A small stable hash of a cell, for the trees' and boulders' flip and nudge. */
const cellHash = (x: number, y: number): number => ((x * 73856093) ^ (y * 19349663)) >>> 0;

/**
 * A kit piece placed on a stage-5 plan member's box (`riverRoad.setpieces.ts`): centred on the box, standing on its
 * south edge, its footprint the cells the box covers. Sizes and positions are the plan's, so the art lands where the
 * boxes were approved.
 */
function onBox(
  id: string,
  sprite: string,
  kind: TopDownObject['kind'],
  box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  extra: {
    readonly solid?: boolean;
    readonly deck?: boolean;
    readonly flip?: boolean;
    readonly base?: number;
    /** Shown only while the map's gate holds (ADR 0123). */
    readonly gate?: string;
    /** A flat piece with height: grounded into the plate with its own contact and cast (owner, 2026-11-21). */
    readonly grounded?: boolean;
  } = {},
): TopDownObject {
  // whole world pixels: a fractional box (9.2 + 0.6 cells) would put the piece between pixels, and the plate's
  // raster drops a piece drawn at a fractional row
  const x = Math.round((box.x + box.w / 2) * C);
  const base = Math.round((box.y + box.h) * C) + (extra.base ?? 0);
  const cells: Vec2[] = [];
  for (let cy = Math.floor(box.y); cy < Math.ceil(box.y + box.h - 1e-9); cy++)
    for (let cx = Math.floor(box.x); cx < Math.ceil(box.x + box.w - 1e-9); cx++)
      cells.push({ x: cx, y: cy });
  return {
    id,
    sprite,
    kind,
    x,
    base,
    footprint: cells,
    solid: extra.solid ?? false,
    ...(extra.deck ? { deck: true } : {}),
    ...(extra.flip ? { flip: true } : {}),
    ...(extra.gate !== undefined ? { gate: extra.gate } : {}),
    ...(extra.grounded ? { grounded: true } : {}),
    depth: { x: x / C, y: base / C },
  };
}

/**
 * The river road's pieces (stage 6 of `docs/level-design.md`): the kit made for it (`tools/rrobj.py`, cleaned into
 * `assets/objects_rr/`), Ba Dan's valley trees and trough for the wooded hills and the shade stop, and the coast's crates
 * and boulders, each on the stage-5 box it was planned as. The blocked cells come from the rows: a tree on every `T`
 * (the big shade tree on the shade stop's), a boulder on every `U` and crates or the trough on every `F`. The cliff's
 * `X` cells are the RG-02 baker's raised rock (`raised` on the terrain; the owner's choice, 2026-11-20), blocked terrain
 * with no piece on them but the rockfall at its foot. SF-2.3's camp and pole come and go with the story through the
 * map's `sceneGates` (ADR 0123): never baked into the plate, each gate's ground ships as an overlay.
 */
export const RIVER_ROAD_OBJECTS: readonly TopDownObject[] = [
  ...RIVER_ROAD.rows.flatMap((row, y) =>
    [...row].flatMap((ch, x): TopDownObject[] => {
      const h = cellHash(x, y);
      const turn = (o: TopDownObject): TopDownObject => (h % 2 ? flip(o) : o);
      if (ch === 'T') {
        if (x === 10 && y === 3)
          return [piece('shade-tree', 'shade_tree', 'tree', [[x, y]], true, { base: -2 })];
        return [
          turn(
            piece(
              `pine_${x}_${y}`,
              h % 3 === 0 ? 'tree_broadleaf' : 'tree_pine',
              'tree',
              [[x, y]],
              true,
              {
                // a tree beside the stream leans its trunk away from the water, where its roots are
                x: row[x - 1] === 'W' ? 8 : row[x + 1] === 'W' ? -8 : (h % 9) - 4,
                base: -((h >> 4) % 5),
              },
            ),
          ),
        ];
      }
      if (ch === 'U')
        return [turn(piece(`boulders_${x}_${y}`, 'boulders', 'prop', [[x, y]], true))];
      if (ch === 'F')
        return x === 12 && y === 3
          ? [piece('shade-trough', 'trough_ek', 'prop', [[x, y]], true)]
          : [piece(`crates_${x}_${y}`, 'crate_stack', 'prop', [[x, y]], true)];
      // the cliff is baked rock (`raised`); at its foot, one fallen heap along row 2's three cells
      if (ch !== 'X' || y !== 2 || x !== 30) return [];
      return [
        piece(
          'bend-cliff-foot',
          'rockfall',
          'prop',
          [
            [30, 2],
            [31, 2],
            [32, 2],
          ],
          true,
          // the face hangs about 12 px over the road's edge: the heap lies at its foot, not on the wall
          { base: 10 },
        ),
      ];
    }),
  ),
  // the landing
  // the jetty's boards meet the gravel: stood 10 px up its row, so no strip of water opens between bank and planks
  onBox(
    'landing-jetty',
    'country_jetty',
    'walkway',
    { x: 6, y: 10, w: 3, h: 1 },
    { deck: true, base: -10 },
  ),
  onBox(
    'landing-boat',
    'river_rowboat',
    'flat',
    { x: 3.6, y: 10.1, w: 2.2, h: 0.8 },
    { grounded: true },
  ),
  onBox('landing-net-rack', 'net_rack', 'prop', { x: 8.2, y: 9.1, w: 1.6, h: 0.6 }),
  // the shade stop
  onBox('shade-log-bench', 'log_bench', 'prop', { x: 8.2, y: 3.35, w: 1.6, h: 0.5 }),
  onBox('shade-hitching-post', 'hitching_post', 'prop', { x: 13.4, y: 3.4, w: 0.25, h: 0.25 }),
  // the bridge (a walkway: the RG-02 baker lays it flat into the plate, no cast), and the borrowed barrier across it
  onBox('bridge-deck', 'plank_bridge', 'walkway', { x: 19, y: 5, w: 2, h: 2 }, { deck: true }),
  // the lowered barrier (`toll_bar_diag`): its post and crate at the deck's south-west corner, inside the rails, and
  // the striped arm angling across the planks to its forked stick at the north-east; a deck piece, since the plate
  // under the bridge is water
  // SF-2.3's states come and go with the story (ADR 0123; the gates are `RIVER_ROAD.sceneGates`): the pole is down
  // until the cart goes through, the camp stands until the toll is won, and Carry on leaves one sack by the fire. The
  // camp's crates (`F`) stay whatever happens: the rows block their cells for good.
  onBox(
    'bridge-toll-pole',
    'toll_bar_diag',
    'prop',
    { x: 19.2, y: 5.5, w: 1.1, h: 1.3 },
    { deck: true, gate: 'pole_down' },
  ),
  // the pole raised (`toll_bar_up`), its post and crate where the lowered one's stand
  onBox(
    'bridge-toll-pole-up',
    'toll_bar_up',
    'prop',
    { x: 19.1, y: 6.5, w: 0.6, h: 0.3 },
    { deck: true, gate: 'pole_up' },
  ),
  // the guards' camp. Every piece with height is grounded, its contact line and a short cast from its own base
  // (owner, 2026-11-21: "almost everything gets a shadow"); the low ones stay in the plate, under the figures.
  onBox(
    'camp-cold-fire',
    'cold_fire',
    'flat',
    { x: 24, y: 3, w: 1, h: 1 },
    { gate: 'camp', grounded: true },
  ),
  onBox(
    'camp-bedroll-1',
    'bedroll',
    'flat',
    { x: 22, y: 2, w: 1, h: 1 },
    { gate: 'camp', grounded: true },
  ),
  onBox(
    'camp-bedroll-2',
    'bedroll',
    'flat',
    { x: 26, y: 3, w: 1, h: 1 },
    { flip: true, gate: 'camp', grounded: true },
  ),
  onBox(
    'camp-bedroll-3',
    'bedroll',
    'flat',
    { x: 24, y: 4, w: 1, h: 1 },
    { gate: 'camp', grounded: true },
  ),
  onBox(
    'camp-rubbish',
    'rubbish_heap',
    'flat',
    { x: 26, y: 2, w: 1, h: 1 },
    { gate: 'camp', grounded: true },
  ),
  // the pot sits on the ground at the fire's east side, clear of the toll sign
  onBox('camp-pot', 'cook_pot', 'prop', { x: 25.05, y: 3.35, w: 0.4, h: 0.4 }, { gate: 'camp' }),
  onBox(
    'camp-toll-sign',
    'toll_sign',
    'prop',
    { x: 21.2, y: 3.5, w: 0.6, h: 0.3 },
    { gate: 'camp' },
  ),
  // the one sack the guards took on Carry on, set down by the cold fire
  onBox(
    'camp-cabbage-sack',
    'cabbage_sack',
    'prop',
    { x: 24.1, y: 2.45, w: 0.6, h: 0.4 },
    { gate: 'sack' },
  ),
  // the ford, and the far bank
  onBox('ford-stones', 'stepping_stones', 'flat', { x: 20, y: 8, w: 2, h: 1 }, { grounded: true }),
  onBox('ford-log', 'fallen_log', 'flat', { x: 20, y: 9.2, w: 2, h: 0.6 }, { grounded: true }),
  onBox('far-bank-driftwood', 'driftwood', 'flat', { x: 26, y: 8, w: 1, h: 1 }, { grounded: true }),
  // the lookout
  // the flat rock stands on the rise's top, back from its lip (the plan's box, 0.3 of a cell north)
  onBox('lookout-rock', 'flat_rock', 'prop', { x: 36.4, y: 1.9, w: 1.4, h: 0.6 }),
  onBox('lookout-milestone', 'milestone', 'prop', { x: 35.3, y: 1.4, w: 0.4, h: 0.4 }),
  // the plan's box is on the rise's rock, where no tree roots: it grows from the last grass at the rise's west foot
  onBox('lookout-tree', 'bent_tree', 'tree', { x: 34, y: 0, w: 1, h: 1 }, { base: -8 }),
];

export const RIVER_ROAD_TOPDOWN_LAYOUT: TopDownLayout = {
  mapId: 'river_road',
  terrain: {
    kind: 'classified',
    classify: RIVER_ROAD_TERRAIN.classify,
    mouths: RIVER_ROAD_TERRAIN.config.mouths,
    mouthReach: MOUTH_REACH,
  },
  objects: RIVER_ROAD_OBJECTS,
  slots: [],
};

/* ------------------------------------------------------------------ */
/* SF-2.3's board: the river road's bridge section, cropped            */
/* ------------------------------------------------------------------ */

const CROP = RIVER_ROAD_BRIDGE_CROP;

/** The river road's ground, on the crop's rows: the same classes, the same raised rock, no road mouths (a fight). */
export const RIVER_ROAD_BRIDGE_TERRAIN = new Rg02Terrain({
  ...RIVER_ROAD_TERRAIN.config,
  mapId: 'river_road_bridge',
  rows: RIVER_ROAD_BRIDGE.rows,
  mouths: [],
  // the road's own noise, so the crop's edges, banks and faces are the road's to the pixel
  noiseOffset: { x: CROP.x * C, y: CROP.y * C },
});

/** The river road's worn cells that fall inside the crop, moved onto the crop's grid. */
export const RIVER_ROAD_BRIDGE_WORN: readonly (readonly [number, number])[] =
  RIVER_ROAD_WORN.flatMap(([x, y]): [number, number][] => {
    const cx = x - CROP.x,
      cy = y - CROP.y;
    return cx >= 0 && cy >= 0 && cx < CROP.width && cy < CROP.height ? [[cx, cy]] : [];
  });

/** The river road's gates (`RIVER_ROAD.sceneGates`) that hold while the toll is being fought. */
const BEFORE_THE_TOLL: ReadonlySet<string> = new Set(['camp', 'pole_down']);

/** A piece without its gate. */
function ungated(o: TopDownObject): TopDownObject {
  if (o.gate === undefined) return o;
  const copy: { -readonly [K in keyof TopDownObject]?: TopDownObject[K] } = { ...o };
  delete copy.gate;
  return copy as TopDownObject;
}

/**
 * The river road's own pieces, moved onto the crop: everything that stands on a cell of it, and, past its west and east
 * edges, what stands within the plate's two-cell margin, so the trees and the shade stop carry on past the board's edge
 * as they do on the road. A piece that is not wholly on the board is `exterior`; one wholly off it stops no feet.
 */
export const RIVER_ROAD_BRIDGE_OBJECTS: readonly TopDownObject[] = RIVER_ROAD_OBJECTS.flatMap(
  (gated): TopDownObject[] => {
    // the fight is the toll as it stands: the camp and the lowered pole, always (ADR 0123); never what comes after
    if (gated.gate !== undefined && !BEFORE_THE_TOLL.has(gated.gate)) return [];
    const o = ungated(gated);
    const cells = o.footprint.map((c) => ({ x: c.x - CROP.x, y: c.y - CROP.y }));
    const on = (c: Vec2): boolean => c.x >= 0 && c.y >= 0 && c.x < CROP.width && c.y < CROP.height;
    const near = cells.every(
      (c) => c.x >= -2 && c.x < CROP.width + 2 && c.y >= 0 && c.y < CROP.height,
    );
    if (!cells.some(on) && !near) return [];
    const moved: TopDownObject = {
      ...o,
      x: o.x - CROP.x * C,
      base: o.base - CROP.y * C,
      footprint: cells,
      depth: { x: o.depth.x - CROP.x, y: o.depth.y - CROP.y },
    };
    if (cells.every(on)) return [moved];
    return [{ ...moved, exterior: true, solid: o.solid && cells.some(on) }];
  },
);

export const RIVER_ROAD_BRIDGE_TOPDOWN_LAYOUT: TopDownLayout = {
  mapId: 'river_road_bridge',
  terrain: {
    kind: 'classified',
    classify: RIVER_ROAD_BRIDGE_TERRAIN.classify,
    mouths: [],
    mouthReach: MOUTH_REACH,
  },
  objects: RIVER_ROAD_BRIDGE_OBJECTS,
  slots: [],
};
