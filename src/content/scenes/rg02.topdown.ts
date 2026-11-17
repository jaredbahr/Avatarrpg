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
    u: RG.earth,
    ':': RG.sand,
    '=': RG.sand,
    n: RG.sand,
    w: RG.deck,
    G: RG.deck,
    F: RG.deck,
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

export const SALTSTEP_MARKET_OBJECTS: readonly TopDownObject[] = [
  // The town spilling off the top edge (`U`): Earth Kingdom cottages, shophouses and moon-door houses set loose along
  // row 0 and staggered in front of it, with a pine, a well, a wayside shrine and washing between them, and more roofs
  // and trees beyond the edge.
  piece('town_cottage_a', 'ek_cottage', 'house', block(0, 1, 0, 0), true, { base: -6 }),
  piece('town_pine_a', 'harbour_tree', 'tree', [[2, 0]], true),
  flip(piece('town_shop_a', 'ek_shophouse', 'house', block(3, 4, 0, 0), true, { base: -10 })),
  piece('town_laundry_a', 'laundry_line', 'prop', [[5, 0]], true, { x: 6 }),
  piece('town_cottage_b', 'ek_cottage', 'house', block(6, 7, 0, 0), true, { base: -14 }),
  flip(piece('town_pine_b', 'harbour_tree', 'tree', [[8, 0]], true, { base: -4 })),
  piece('town_shrine', 'wayside_shrine', 'prop', [[9, 0]], true),
  piece('town_shop_b', 'ek_shophouse', 'house', block(10, 11, 0, 0), true, { base: -4 }),
  flip(piece('town_round_a', 'ek_house_round', 'house', [[12, 0]], true, { base: -12 })),
  piece('town_well', 'stone_well', 'prop', [[13, 0]], true),
  flip(piece('town_cottage_c', 'ek_cottage', 'house', block(14, 15, 0, 0), true, { base: -8 })),
  piece('town_pine_c', 'harbour_tree', 'tree', [[16, 0]], true, { base: -2 }),
  piece('town_shop_c', 'ek_shophouse', 'house', block(17, 18, 0, 0), true, { base: -12 }),
  flip(piece('town_laundry_b', 'laundry_line', 'prop', [[19, 0]], true)),
  piece('town_round_b', 'ek_house_round', 'house', [[20, 0]], true, { base: -6 }),
  flip(piece('town_cottage_d', 'ek_cottage', 'house', block(21, 22, 0, 0), true, { base: -2 })),
  flip(piece('town_pine_d', 'harbour_tree', 'tree', [[23, 0]], true, { base: -10 })),
  piece('front_round_w', 'ek_house_round', 'house', [[0, 1]], true),
  piece('front_cottage_mid', 'ek_cottage', 'house', block(11, 12, 1, 1), true),
  flip(piece('front_shop_e', 'ek_shophouse', 'house', block(21, 22, 1, 1), true)),
  piece('front_pine_e', 'harbour_tree', 'tree', [[23, 1]], true, { x: 6 }),
  flip(piece('corner_pine_w', 'harbour_tree', 'tree', [[0, 2]], true, { x: -6 })),
  piece('corner_well_e', 'stone_well', 'prop', [[23, 2]], true, { x: 6 }),
  flip(piece('corner_round_w', 'ek_house_round', 'house', [[0, 3]], true, { x: -8 })),
  ext('beyond_shop_a', 'ek_shophouse', 'house', block(1, 2, -1, -1), { base: -8 }),
  ext('beyond_pine_a', 'harbour_tree', 'tree', [[4, -1]], { base: -2 }),
  flip(ext('beyond_cottage_a', 'ek_cottage', 'house', block(7, 8, -1, -1), { base: -14 })),
  ext('beyond_round_a', 'ek_house_round', 'house', [[10, -1]], { base: -4 }),
  flip(ext('beyond_shop_b', 'ek_shophouse', 'house', block(14, 15, -1, -1), { base: -10 })),
  ext('beyond_pine_b', 'harbour_tree', 'tree', [[18, -1]], { base: -6 }),
  ext('beyond_cottage_b', 'ek_cottage', 'house', block(21, 22, -1, -1), { base: -2 }),
  flip(ext('beyond_round_b', 'ek_house_round', 'house', [[3, -2]], { base: 4 })),
  ext('beyond_pine_c', 'harbour_tree', 'tree', [[6, -2]], { base: 8 }),
  ext('beyond_cottage_c', 'ek_cottage', 'house', block(12, 13, -2, -2), { base: 2 }),
  flip(ext('beyond_round_c', 'ek_house_round', 'house', [[17, -2]], { base: 6 })),
  ext('beyond_pine_d', 'harbour_tree', 'tree', [[20, -2]], { base: 4 }),
  // The landmark: the harbour beacon at the quay's east end, its foot on the rim.
  piece(
    'beacon',
    'beacon_tower',
    'prop',
    [
      [23, 3],
      [23, 4],
    ],
    true,
    { x: 10 },
  ),
  piece('east_crates', 'crate_stack', 'prop', [[22, 4]], true),
  piece('east_barrels', 'barrels', 'prop', [[23, 5]], true, { x: 8 }),
  piece('east_pots', 'lobster_pots', 'prop', [[23, 6]], true, { x: 8 }),
  piece('east_crates_b', 'crate_stack', 'prop', [[23, 7]], true, { x: 8, base: -12 }),
  piece('west_barrels', 'barrels', 'prop', [[0, 4]], true, { x: -6 }),
  piece('west_pots', 'lobster_pots', 'prop', [[0, 7]], true, { x: -6, base: -12 }),
  // The warehouse and Jin's freight office on the lane, its freight stacked beside it.
  piece('warehouse', 'ek_warehouse', 'house', block(5, 8, 1, 2), true),
  piece('jin_office', 'jin_office', 'house', block(14, 16, 1, 2), true),
  piece('freight_a', 'tool_crates', 'prop', [[17, 1]], true),
  piece('freight_b', 'tool_crates', 'prop', [[18, 1]], true),
  piece('freight_c', 'tool_crates', 'prop', [[17, 2]], true),
  piece('freight_d', 'tool_crates', 'prop', [[18, 2]], true),
  // The lane (`u`): drying racks, crates, barrels and a gutting table.
  piece('lane_crates_w', 'crate_stack', 'prop', [[4, 1]], true),
  piece('lane_rack_a', 'drying_rack', 'prop', [[9, 1]], true),
  piece('lane_shrine', 'wayside_shrine', 'prop', [[13, 1]], true),
  piece('lane_laundry', 'laundry_line', 'prop', [[19, 1]], true),
  piece('lane_barrels', 'barrels', 'prop', [[2, 2]], true),
  flip(piece('lane_rack_c', 'drying_rack', 'prop', [[10, 2]], true)),
  piece('lane_table', 'fish_table', 'prop', [[12, 2]], true),
  piece('lane_pots', 'lobster_pots', 'prop', [[20, 2]], true),
  // The quay (`n`): the fish shed, green and gold banners, racks and baskets along the back; lamps, rope, nets and tables along the
  // water. Rows 5-6 stay open.
  piece('handcart', 'handcart', 'prop', [[8, 4]], true),
  piece('fish_shed', 'awning_shed', 'prop', [[10, 4]], true),
  piece('baskets_north', 'fish_baskets', 'prop', [[11, 4]], true),
  piece('banners', 'banner_poles', 'prop', [[13, 4]], true),
  piece('quay_rack', 'drying_rack', 'prop', [[18, 4]], true),
  flip(piece('baskets_east', 'fish_baskets', 'prop', [[19, 4]], true)),
  piece('quay_crates', 'crate_stack', 'prop', [[21, 4]], true),
  piece('quay_pots', 'lobster_pots', 'prop', [[4, 7]], true, { base: -14 }),
  piece('lamp_west', 'dock_lamp', 'prop', [[6, 7]], true, { x: -4, base: -14 }),
  piece('rope', 'rope_coil', 'prop', [[9, 7]], true, { x: 4, base: -14 }),
  piece('quay_barrels', 'barrels', 'prop', [[12, 7]], true, { base: -14 }),
  piece('nets', 'net_pile', 'prop', [[14, 7]], true, { base: -14 }),
  piece('lamp_east', 'dock_lamp', 'prop', [[16, 7]], true, { base: -14 }),
  piece('quay_table', 'fish_table', 'prop', [[20, 7]], true, { base: -14 }),
  // The jetties: the broth stall's, the customs stall behind its clerk, the fish stall by the ferry landing, bollards
  // and the tide pole at the end of the customs pier.
  piece('broth_stall', 'stall_broth', 'prop', block(5, 6, 9, 9), true),
  piece('customs_stall', 'customs_stall', 'prop', [[12, 8]], true),
  piece('fish_stall', 'stall_fish', 'prop', block(19, 20, 8, 8), true),
  piece('bollard_west', 'bollard', 'prop', [[5, 10]], true, { x: -4, base: -14 }),
  piece('bollard_east', 'bollard', 'prop', [[18, 10]], true, { base: -14 }),
  piece('tide_pole', 'level_pole', 'prop', [[12, 13]], true, { x: -4, base: -14 }),
  // The bay: boats moored along the jetties and out on the water, rocks along the shore, gulls.
  piece('ferry', 'ferry', 'flat', [[20, 11]], false, { base: 10 }),
  piece('sailboat_west', 'sailboat', 'flat', [[8, 10]], false),
  flip(piece('sailboat_east', 'sailboat', 'flat', [[22, 10]], false)),
  piece('rowboat_crook', 'rowboat', 'flat', [[17, 11]], false),
  flip(piece('rowboat_pier', 'rowboat', 'flat', [[13, 11]], false)),
  piece('rowboat_west', 'rowboat', 'flat', [[2, 9]], false),
  piece('rowboat_out', 'rowboat', 'flat', [[6, 13]], false),
  piece('gulls_a', 'gulls', 'flat', [[9, 12]], false),
  piece('gulls_b', 'gulls', 'flat', [[15, 14]], false),
  flip(piece('gulls_c', 'gulls', 'flat', [[21, 13]], false)),
  piece('rocks_w', 'shore_rocks', 'flat', [[0, 8]], false),
  flip(piece('rocks_w2', 'shore_rocks', 'flat', [[1, 11]], false)),
  piece('rocks_e', 'shore_rocks', 'flat', [[23, 9]], false),
  flip(piece('rocks_e2', 'shore_rocks', 'flat', [[22, 13]], false)),
  piece('rocks_inlet', 'shore_rocks', 'flat', [[7, 8]], false, { base: -12 }),
  ext('boat_far_a', 'sailboat', 'flat', [[4, 16]]),
  ext('boat_far_b', 'rowboat', 'flat', [[13, 16]], { base: 8 }),
  ext('rocks_far', 'shore_rocks', 'flat', [[19, 16]]),
];

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

export const SALTSTEP_MARKET_TOPDOWN_LAYOUT: TopDownLayout = {
  mapId: 'saltstep_market',
  terrain: {
    kind: 'classified',
    classify: SALTSTEP_MARKET_TERRAIN.classify,
    mouths: SALTSTEP_MARKET_TERRAIN.config.mouths,
    mouthReach: MOUTH_REACH,
  },
  objects: SALTSTEP_MARKET_OBJECTS,
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

/** A run of the parade wall: two cells a section, the sections overlapping so the wall reads as one. */
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
    const wall = piece(`wall_${x}`, 'parade_wall', 'prop', cells, true);
    out.push(i % 2 ? { ...wall, flip: true } : wall);
  }
  return out;
};

export const EMBERWATCH_PARADE_OBJECTS: readonly TopDownObject[] = [
  // The north side (`#`): the old wall either side of the barracks, the spear-rack trellis and an outpost lamp.
  ...wallRun(1, 8),
  piece('trellis', 'spear_trellis', 'prop', [[9, 1]], true),
  piece('barracks', 'barracks', 'house', block(10, 13, 1, 1), true),
  ...wallRun(14, 21),
  piece('lamp', 'outpost_lamp', 'prop', [[22, 1]], true),
  // The training ground round the square: two dummies and the weapon rack on the grass, the trough by the south side.
  piece('dummy_a', 'training_dummy', 'prop', [[1, 4]], true),
  { ...piece('dummy_b', 'training_dummy', 'prop', [[1, 6]], true), flip: true },
  piece('weapon_rack', 'weapon_rack', 'prop', [[22, 4]], true),
  piece(
    'trough',
    'water_trough',
    'prop',
    [
      [21, 10],
      [22, 10],
    ],
    true,
  ),
  // The cook's beans drying on an old tent canvas, beside where he stands.
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
  // the yard's wall (`#`) is the rim, its gate (`=`) flagstones; the cistern (`W`) stands on the mud; the overflow (`~`) lies in puddles
  chars: {
    '#': RG.void,
    '.': RG.earth,
    d: RG.earth,
    '=': RG.stone,
    '~': RG.puddle,
    F: RG.earth,
    W: RG.earth,
  },
  beyond: RG.void,
  mouths: [
    mouth('parade', 'west', [
      { x: 0, y: 5 },
      { x: 0, y: 6 },
    ]),
  ],
});

export const EMBERWATCH_POWER_YARD_OBJECTS: readonly TopDownObject[] = [
  // The live line along the north side (`F`): a pole every two cells, each carrying its span of cable east.
  ...[1, 3, 5, 7, 9, 11, 13].map((x) =>
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
  // The overflowing rain cistern (`W`), and the dead copper spur on its own poles at the back (east).
  piece('cistern', 'cistern', 'prop', block(15, 17, 1, 2), true),
  // The public workshop bench by the south-west corner, a row up so its shadow falls on the yard.
  piece('bench', 'workshop_bench', 'prop', [[1, 9]], true),
  piece('spur_north', 'copper_spur', 'prop', block(17, 17, 4, 6), true),
  // the south spur stands back from the yard's corner, so its shadow falls on the yard and not into the rim
  piece('spur_south', 'copper_spur', 'prop', block(17, 17, 7, 8), true, { x: -8, base: -16 }),
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
