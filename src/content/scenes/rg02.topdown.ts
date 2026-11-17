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
  // The warehouse on the north side, and Jin's freight office with its freight stacked beside it.
  piece('warehouse', 'warehouse', 'house', block(5, 8, 1, 2), true),
  piece('jin_office', 'jin_office', 'house', block(14, 16, 1, 2), true),
  piece('freight_a', 'tool_crates', 'prop', [[17, 1]], true),
  piece('freight_b', 'tool_crates', 'prop', [[18, 1]], true),
  piece('freight_c', 'tool_crates', 'prop', [[17, 2]], true),
  piece('freight_d', 'tool_crates', 'prop', [[18, 2]], true),
  // Tavi's ferry, moored off the landing.
  piece('ferry', 'ferry', 'flat', [[20, 11]], false, { base: 10 }),
  // The stalls on their platforms: the broth stall's, the customs stall on its mooring behind the clerk, the fish
  // stall by the landing; the tide pole at the end of the customs pier; a bollard on each outer platform.
  piece(
    'broth_stall',
    'stall_broth',
    'prop',
    [
      [5, 9],
      [6, 9],
    ],
    true,
  ),
  piece('customs_stall', 'customs_stall', 'prop', [[12, 8]], true),
  piece(
    'fish_stall',
    'stall_fish',
    'prop',
    [
      [17, 9],
      [18, 9],
    ],
    true,
  ),
  piece('tide_pole', 'level_pole', 'prop', [[11, 12]], true, { x: 4, base: -14 }),
  piece('bollard_west', 'bollard', 'prop', [[5, 10]], true, { x: -4, base: -14 }),
  piece('bollard_east', 'bollard', 'prop', [[18, 10]], true, { base: -8 }),
  // The quay: two lamps at the water's edge, and the day's nets, baskets, rope and a handcart along its edges.
  piece('lamp_west', 'dock_lamp', 'prop', [[7, 7]], true, { base: -14 }),
  piece('lamp_east', 'dock_lamp', 'prop', [[16, 7]], true, { base: -14 }),
  piece('handcart', 'handcart', 'prop', [[8, 4]], true),
  piece('baskets_north', 'fish_baskets', 'prop', [[11, 4]], true),
  { ...piece('baskets_east', 'fish_baskets', 'prop', [[19, 4]], true), flip: true },
  piece('rope', 'rope_coil', 'prop', [[9, 7]], true, { base: -14 }),
  piece('nets', 'net_pile', 'prop', [[14, 7]], true, { base: -14 }),
];

/* ------------------------------------------------------------------ */
/* The freight pontoon                                                 */
/* ------------------------------------------------------------------ */

export const SALTSTEP_PONTOON_TERRAIN = new Rg02Terrain({
  mapId: 'saltstep_pontoon',
  rows: SALTSTEP_PONTOON.rows,
  chars: { W: RG.water, w: RG.deck, c: RG.deck, B: RG.deck },
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
  // The barge waiting off the platform, where the sling is heading.
  piece('barge', 'barge', 'flat', [[15, 9]], false, { base: 30 }),
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
  // The public workshop bench in the south-west corner.
  piece('bench', 'workshop_bench', 'prop', [[1, 10]], true),
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
