/**
 * Saltstep and Emberwatch's top-down layouts (RG-02, ADR 0104 §3): each board's terrain and the pieces placed on it,
 * beside the maps' rows, which stay the authority for collision. CI and the ground packer read these
 * (`scripts/art/topdown/boards/rg02.ts`); the shipped runtime draws the packed scene and never imports them.
 */
import type { TopDownLayout, TopDownObject } from '../topdownLayout';
import {
  EMBERWATCH_PARADE,
  EMBERWATCH_POWER_YARD,
  SALTSTEP_MARKET,
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

/* ------------------------------------------------------------------ */
/* Saltstep market                                                     */
/* ------------------------------------------------------------------ */

export const SALTSTEP_MARKET_TERRAIN = new Rg02Terrain({
  mapId: 'saltstep_market',
  rows: SALTSTEP_MARKET.rows,
  chars: {
    T: RG.void,
    ',': RG.earth,
    B: RG.earth,
    U: RG.earth,
    '.': RG.earth,
    ':': RG.sand,
    '=': RG.sand,
    n: RG.sand,
    w: RG.deck,
    k: RG.deck,
    W: RG.water,
  },
  beyond: RG.void,
  mouths: [
    mouth('coast-road', 'west', [
      { x: 0, y: 5 },
      { x: 0, y: 6 },
    ]),
  ],
});

// TODO(region): the market's objects and layout come back at its dressing stage, placed as set pieces from
// `docs/places/saltstep_market.md`. The earlier layout (drawn to the 24 x 16 rows) is in the history of #844.

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
  piece('big_barge', 'big_barge', 'flat', block(13, 16, 9, 9), false, { base: 22 }),
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
  piece('chain_a', 'chain_pile', 'flat', [[3, 9]], false),
  piece('chain_b', 'chain_pile', 'flat', [[9, 2]], false),
  flip(piece('chain_c', 'chain_pile', 'flat', [[17, 6]], false)),
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
    const pile = piece(`pile_${x}_${y}`, 'pilings', 'flat', [[x, y]], false);
    return i % 2 ? flip(pile) : pile;
  }),
  piece('rope_gap', 'rope_line', 'flat', [[11, 6]], false, { x: 20 }),
  piece('rope_south', 'rope_line', 'flat', [[12, 9]], false, { x: 20 }),
  piece('buoy_a', 'buoy', 'flat', [[15, 1]], false),
  piece('buoy_b', 'buoy', 'flat', [[2, 11]], false),
  piece('buoy_c', 'buoy', 'flat', [[13, 10]], false),
  piece('rowboat', 'rowboat', 'flat', [[16, 1]], false),
  piece('gulls', 'gulls', 'flat', [[8, 11]], false),
  ext('far_sailboat', 'sailboat', 'flat', [[3, 13]]),
  ext('far_rowboat', 'rowboat', 'flat', [[14, 13]]),
  ext('far_gulls', 'gulls', 'flat', [[20, 10]]),
];

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
  piece('ferry', 'ferry', 'flat', [[3, 15]], false),
  piece('rowboat', 'rowboat', 'flat', [[0, 13]], false, { x: 8 }),
  piece('rocks_bay', 'shore_rocks', 'flat', [[6, 15]], false),
  piece('gulls', 'gulls', 'flat', [[1, 15]], false),
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
