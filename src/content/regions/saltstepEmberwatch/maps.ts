/**
 * Saltstep and Emberwatch's maps (RG-02, the pipeline-trial slice).
 *
 * PLACEHOLDER ART. Every map here is top-down with no scene, so it draws its bare board from the
 * shared legend until the region's PixelLab art is generated and approved (a later, separate art
 * PR). The rows are the rules; the art will be drawn to them, not the other way round.
 *
 * - `saltstep_market` (explore, 24 x 16): the market on the water. Stalls on platforms, the quay,
 *   the ferry landing, Jin's freight office and Miri's lantern crates. Its west mouth is the coast
 *   road home to Ba Dan.
 * - `saltstep_pontoon` (combat, 19 x 12): the freight pontoon, the winch fight's board (Scene 2.5).
 *   Water on every side; the party is brought here by the fight and taken back by the story.
 * - `emberwatch_parade` (explore, 24 x 16): the old outpost's parade ground, where the ferry lands.
 * - `emberwatch_power_yard` (combat, 19 x 12): the power yard, SF-2.1's board and an explore map,
 *   with the live line along its north side and the overflowing cistern.
 */
import type { MapDef, Vec2 } from '../../../core/types';
import { LEGEND } from '../../maps/legend';

/** A road mouth: the walkable cells of an exit's cross-section at the map edge. */
const mouth = (x: number, ys: readonly number[]): readonly Vec2[] => ys.map((y) => ({ x, y }));

/** The staggered party entrance every Act I board uses (`maps/combat.ts`). */
const COMBAT_PARTY_SPAWNS: readonly Vec2[] = [
  { x: 1, y: 3 },
  { x: 3, y: 4 },
  { x: 1, y: 5 },
  { x: 3, y: 6 },
  { x: 1, y: 7 },
  { x: 3, y: 8 },
];

/**
 * The region's sprites (`docs/pipeline-trial-log.md`, "Art production"): its own people since the art batches; Miri's
 * crates still borrow the barrel until the objects batch.
 */
const SPRITE = {
  bowlSeller: 'npc.bowlseller',
  tavi: 'npc.tavi',
  freightClerk: 'npc.freightclerk',
  crates: 'prop.barrel',
  customsClerk: 'npc.customsclerk',
  veyra: 'unit.ally.veyra',
  cook: 'npc.cook',
  luli: 'npc.luli',
  // Sabi leads the riggers and wears their sheet (the art list: she shares it).
  sabi: 'unit.enemy.rigger',
} as const;

const ARRIVED = { kind: 'visited', nodeId: 'mq02_saltstep_arrival' } as const;
// Either way in to Scene 2.2: the bowl-seller's own chain, or the one that ends on Tenzo's exchange.
const BOWL_CARRIED = {
  kind: 'any',
  of: [
    { kind: 'visited', nodeId: 'mq02_bowl_seller' },
    { kind: 'visited', nodeId: 'mq02_bowl_seller_tenzo' },
  ],
} as const;
const VOTED = {
  kind: 'any',
  of: [
    { kind: 'flag', key: 'inquiry_public', op: 'set' },
    { kind: 'flag', key: 'inquiry_quiet', op: 'set' },
  ],
} as const;

export const SALTSTEP_MARKET: MapDef = {
  id: 'saltstep_market',
  projection: 'topdown',
  name: 'Saltstep',
  kind: 'explore',
  width: 24,
  height: 16,
  ambience: 'village',
  legend: LEGEND,
  /*
   * The quay runs west to east on rows 4-7; the coast road comes in on its west end (rows 5-6).
   * The platforms (`w`) stand in the water south of it: the bowl stall's, the customs stall's on
   * its mooring, and the ferry landing's to the east. Jin's freight office and the warehouses
   * are the blocks on the north side. Every walkable rim cell is the coast road's mouth.
   */
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTT',
    'TT,,,BBBB,,,,,BBBBB,,,TT',
    'T,,,,BBBB,,,,,BBBBB,,,,T',
    'T,,,,,,,,,,,,,,,,,,,,,,T',
    'T::::::::::::::::::::::T',
    '==::::::::::::::::::::wT',
    '==::::::::::::::::::::wT',
    'T:::::::::::::::::::::wT',
    'TWWwwwwWWWwwwwWWWwwwwwWT',
    'TWWwwwwWWWwwwwWWWwwwwwWT',
    'TWWWwwWWWWWwwWWWWWwwwWWT',
    'TWWWWWWWWWWwwWWWWWWWWWWT',
    'TWWWWWWWWWWwwWWWWWWWWWWT',
    'TWWWWWWWWWWWWWWWWWWWWWWT',
    'TWWWWWWWWWWWWWWWWWWWWWWT',
    'TTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  // West of the coast-road crossing (column 3), so a fresh arrival still walks through it.
  partySpawns: [
    { x: 1, y: 5 },
    { x: 1, y: 6 },
    { x: 2, y: 5 },
    { x: 2, y: 6 },
    { x: 1, y: 4 },
    { x: 2, y: 4 },
  ],
  objective: 'Stop at the bowl stall on the quay.',
  props: [],
  exits: [
    {
      pos: { x: 0, y: 5 },
      toMapId: 'ba_dan_village',
      // Beside the coast-road sign on Ba Dan's south lawn.
      toPos: { x: 16, y: 14 },
      label: 'Coast road → Ba Dan Village',
      direction: 'west',
      area: mouth(0, [5, 6]),
    },
  ],
  edgeContract: 'enforce',
  triggers: [
    {
      // Scene 2.2's first sight of the market, on the first walk in from the coast road.
      id: 'mq02_saltstep_arrival',
      node: 'mq02_saltstep_arrival',
      label: 'Saltstep',
      sprite: 'world.parcel_cart',
      when: { kind: 'not', of: ARRIVED },
      once: true,
      // The whole walkable column, so no route east from the coast road slips past it.
      area: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((y) => ({ x: 3, y })),
    },
  ],
  npcs: [
    {
      // Scene 2.2: she stands where the cart stops.
      id: 'mq02_bowl_seller',
      name: 'Bowl-seller',
      pos: { x: 5, y: 4 },
      sprite: SPRITE.bowlSeller,
      node: 'mq02_bowl_seller',
      // Tenzo's moment (Scene 2.2): the same conversation, ending on his exchange with her.
      routes: [
        { when: { kind: 'partyHas', characterId: 'tenzo' }, node: 'mq02_bowl_seller_tenzo' },
      ],
    },
    {
      id: 'mq02_tavi',
      name: 'Tavi Ren',
      pos: { x: 20, y: 9 },
      sprite: SPRITE.tavi,
      node: 'mq02_tavi',
      // Scene 2.9: once the complaint has started, the ferry goes.
      routes: [{ when: VOTED, node: 'mq02_ferry' }],
    },
    {
      id: 'mq02_freight_clerk',
      name: 'Freight clerk',
      pos: { x: 16, y: 3 },
      sprite: SPRITE.freightClerk,
      node: 'mq02_freight_office',
      routes: [
        // Scene 2.8, after the vote.
        { when: { kind: 'flag', key: 'inquiry_public', op: 'set' }, node: 'mq02_jin_hears_public' },
        { when: { kind: 'flag', key: 'inquiry_quiet', op: 'set' }, node: 'mq02_jin_hears_quiet' },
      ],
    },
    {
      id: 'mq02_miri_crates',
      name: 'Lantern crates',
      pos: { x: 21, y: 7 },
      sprite: SPRITE.crates,
      node: 'mq02_miri_crates',
      // Kaya's opening (the slice's first exchange only): the crates are her sister's shop's.
      routes: [{ when: { kind: 'partyHas', characterId: 'kaya' }, node: 'mq02_miri_crates_kaya' }],
    },
    {
      // Scene 2.3 opens at the customs stall, once the party is carrying the second bowl (2.4
      // needs it). Afterwards the clerk is busy with the packet, and the stall is not shown.
      id: 'mq02_customs_clerk',
      name: 'Customs clerk',
      pos: { x: 12, y: 9 },
      sprite: SPRITE.customsClerk,
      node: 'mq02_stall_drifts',
      when: {
        kind: 'all',
        of: [BOWL_CARRIED, { kind: 'not', of: { kind: 'visited', nodeId: 'mq02_stall_drifts' } }],
      },
    },
  ],
};

export const SALTSTEP_PONTOON: MapDef = {
  id: 'saltstep_pontoon',
  projection: 'topdown',
  name: 'The Freight Pontoon',
  kind: 'combat',
  width: 19,
  height: 12,
  ambience: 'village',
  legend: LEGEND,
  /*
   * The pontoon deck (`w`) with the harbour all round it. The cast-iron pump crate (`c`, cover)
   * stands near the party's end. A two-wide gangway (11-12, rows 4-5) joins the deck to the winch
   * platform; the winch brake is on the gangway itself, (12, 4), where the handlers stand, so
   * stopping the winch means getting through them. The winch (`B`) is on the platform and the
   * barge is the open water off the east edge, where the sling is heading.
   */
  rows: [
    'WWWWWWWWWWWWWWWWWWW',
    'WWwwwwwwwwwWWWWWWWW',
    'WwwwwwcwwwwWWWwwwWW',
    'WwwwwwcwwwwWWwwBBww',
    'WwwwwwwwwwwwwwwBBww',
    'WwwwwwwwwwwwwwwwwwW',
    'WwwwwwwwwwwWWwwwwwW',
    'WwwwwcwwwwwWWwwwwwW',
    'WwwwwcwwwwwWWWwwwWW',
    'WwwwwwwwwwwWWWWWWWW',
    'WWwwwwwwwwwWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWW',
  ],
  partySpawns: COMBAT_PARTY_SPAWNS,
  npcs: [],
  props: [],
  /*
   * The pontoon's east end runs on to the barge's gangway (rows 3-4). That is where the crate is
   * going, not a way off the board: the fight never lets the party leave, and the story walks
   * them back to the market afterwards.
   */
  edges: [{ side: 'east', span: [3, 4], treatment: 'band' }],
  edgeContract: 'enforce',
};

/** The winch brake (Scene 2.5): where a friendly unit must stand at a round's end to stop it. */
export const WINCH_BRAKE_CELLS: readonly Vec2[] = [{ x: 12, y: 4 }];

export const EMBERWATCH_PARADE: MapDef = {
  id: 'emberwatch_parade',
  projection: 'topdown',
  name: 'Emberwatch',
  kind: 'explore',
  width: 24,
  height: 16,
  ambience: 'village',
  legend: LEGEND,
  /*
   * The ferry lands at the jetty in the south-west. North is the barracks wall (`#`) with its
   * painted-over slogans; the parade ground (`:`) fills the middle, under the beans on canvas
   * and the spear-rack trellis. The power yard is through the east gap (rows 7-8).
   */
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTT',
    'T######################T',
    'T,,,,,,,,,,,,,,,,,,,,,,T',
    'T,,::::::::::::::::::,,T',
    'T,,::::::::::::::::::,,T',
    'T,,::::::::::::::::::,,T',
    'T,,::::::::::::::::::,,T',
    'T,,::::::::::::::::::===',
    'T,,::::::::::::::::::===',
    'T,,::::::::::::::::::,,T',
    'T,,,,,,,,,,,,,,,,,,,,,,T',
    'T,,,,,,,,,,,,,,,,,,,,,,T',
    'Twwwwww,,,,,,,,,,,,,,,,T',
    'Twwwwww,,,,,,,,,,,,,,,,T',
    'TWWWWWW,,,,,,,,,,,,,,,,T',
    'TTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  partySpawns: [
    { x: 3, y: 12 },
    { x: 4, y: 12 },
    { x: 3, y: 13 },
    { x: 4, y: 13 },
    { x: 5, y: 12 },
    { x: 5, y: 13 },
  ],
  objective: 'Look around Emberwatch, or go east to the power yard.',
  props: [],
  exits: [
    {
      pos: { x: 23, y: 7 },
      toMapId: 'emberwatch_power_yard',
      toPos: { x: 1, y: 5 },
      label: 'East → The Power Yard',
      direction: 'east',
      area: mouth(23, [7, 8]),
    },
  ],
  edgeContract: 'enforce',
  npcs: [
    {
      id: 'mq03_retired_cook',
      name: 'Retired cook',
      pos: { x: 8, y: 4 },
      sprite: SPRITE.cook,
      node: 'mq03_retired_cook',
    },
    {
      id: 'mq03_tavi',
      name: 'Tavi Ren',
      pos: { x: 7, y: 11 },
      sprite: SPRITE.tavi,
      node: 'mq03_tavi',
    },
  ],
};

export const EMBERWATCH_POWER_YARD: MapDef = {
  id: 'emberwatch_power_yard',
  projection: 'topdown',
  name: 'The Power Yard',
  kind: 'combat',
  width: 19,
  height: 12,
  ambience: 'quarry',
  legend: LEGEND,
  /*
   * The live line runs along the north side on its poles (`F`: you can see and shoot over it, not
   * walk through it). The rain cistern (`W`) has overflowed across the yard: the standing water
   * (`~`) beside the line is SF-2.1's wet ground. The dead copper spur hangs at the back (east),
   * on its own poles. The gate west (rows 5-6) goes back to the parade ground.
   *
   * PLACEHOLDER RULE: a live line that shocks the wet ground beside it needs engine work (the
   * script's build list: "wet ground beside a live line as a surface"). Until then the puddles
   * are ordinary water, so lightning on them shocks as it does on the Forest Road.
   */
  rows: [
    '###################',
    '#FFFFFFFFFFFFFFWWW#',
    '#....~~~~~~....WWW#',
    '#...~~~~~~~~~...~~#',
    '#....~~~~~~~.....F#',
    '=.........~~.....F#',
    '=................F#',
    '#........~~~.....F#',
    '#.......~~~~~....F#',
    '#................##',
    '#.................#',
    '###################',
  ],
  partySpawns: COMBAT_PARTY_SPAWNS,
  objective: 'Talk to Luli in the power yard, or go west to the parade ground.',
  exits: [
    {
      pos: { x: 0, y: 5 },
      toMapId: 'emberwatch_parade',
      toPos: { x: 22, y: 7 },
      label: 'West → Emberwatch',
      direction: 'west',
      area: mouth(0, [5, 6]),
    },
  ],
  edgeContract: 'enforce',
  npcs: [
    {
      id: 'mq03_luli',
      name: 'Luli',
      pos: { x: 3, y: 9 },
      sprite: SPRITE.luli,
      node: 'mq03_luli',
    },
    {
      // SF-2.1, optional: the riggers are at the dead spur until the fight is over.
      id: 'sf21_sabi',
      name: 'Sabi',
      pos: { x: 16, y: 6 },
      sprite: SPRITE.sabi,
      node: 'sf21_wet_ground',
      when: { kind: 'not', of: { kind: 'visited', nodeId: 'sf21_wet_ground' } },
    },
  ],
  props: [],
};

export const SALTSTEP_EMBERWATCH_MAPS: readonly MapDef[] = [
  SALTSTEP_MARKET,
  SALTSTEP_PONTOON,
  EMBERWATCH_PARADE,
  EMBERWATCH_POWER_YARD,
];
