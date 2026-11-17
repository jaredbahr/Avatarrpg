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

/**
 * The region's legend: the shared one plus three blocked grounds the dressing stands on, each seen over (a net pile, a
 * dummy, a bench): `n` on the quay's sand, `u` on the parade's grass, `d` on the power yard's dirt, `k` the
 * freight quay's timber.
 */
const RG02_LEGEND: typeof LEGEND = {
  ...LEGEND,
  n: { terrain: 'sand', blocked: true, blocksSight: false },
  u: { terrain: 'grass', blocked: true, blocksSight: false },
  d: { terrain: 'dirt', blocked: true, blocksSight: false },
  // the freight quay's timber edge behind the pontoon: blocked and seen over, as the water it replaces
  k: { terrain: 'wood', blocked: true, blocksSight: false },
};

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
 * The region's sprites (`docs/pipeline-trial-log.md`, "Art production"): its own people and pieces since the art
 * batches.
 */
const SPRITE = {
  bowlSeller: 'npc.bowlseller',
  tavi: 'npc.tavi',
  freightClerk: 'npc.freightclerk',
  crates: 'world.lantern_crates',
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
  legend: RG02_LEGEND,
  /*
   * A fish quay curving along the bay, an outer Earth Kingdom harbour town (the story bible's
   * Tidemark Reach). The town spills off the top edge (`U`: houses, trees, a well, a shrine), with
   * Jin's freight office and the warehouse on the lane behind the quay (`B`); the sand quay runs
   * west to east on rows 4-7, the coast road coming in on its west end (rows 5-6), and the water
   * bites into it at an inlet (row 7). The jetties reach out at different lengths: the broth
   * stall's, the customs pier (the longest), a crooked landing stage and the ferry landing to the
   * east. Stalls (`G`), bollards and the tide pole (`F`) and the quay's scatter (`n`, `u`) are
   * blocked cells their pieces stand on; rows 5-6 and column 3 stay open, and the rim walkable
   * only at the coast road's mouth.
   */
  rows: [
    'UUUUUUUUUUUUUUUUUUUUUUUU',
    'U,,,uBBBBu,UUuBBBBBu,UUU',
    'U,u,,BBBB,u,u,BBBBB,u,,U',
    'U,,,,,,,,,,,,,,,,,,,,,,U',
    'U:::::::n:nn:n::::nn:nUU',
    '==::::::::::::::::::::wU',
    '==::::::::::::::::::::wU',
    'U:::n:nWWn::n:n:n:::n:wU',
    'WWWwwwwWWWwwGwWwWwwGGwwW',
    'WWWwwGGWWWwwwwWwwWwwwwWW',
    'WWWWwFWWWWWwwWWWwWFwwWWW',
    'WWWWWWWWWWWwwWWWwWWWWWWW',
    'WWWWWWWWWWWwwWWWWWWWWWWW',
    'WWWWWWWWWWWwFWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWWWW',
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
  legend: RG02_LEGEND,
  /*
   * The pontoon deck (`w`) with the harbour all round it. The cast-iron pump crate (`c`, cover)
   * stands near the party's end. A two-wide gangway (11-12, rows 4-5) joins the deck to the winch
   * platform; the winch brake is on the gangway itself, (12, 4), where the handlers stand, so
   * stopping the winch means getting through them. The winch (`B`) is on the platform and the
   * barge is the open water off the east edge, where the sling is heading. The freight quay's
   * timber edge (`k`, row 0) runs behind the deck's north side: blocked and seen over, as the
   * water was, so the fight is the same.
   */
  rows: [
    'kkkkkkkkkkkWWWWWWWW',
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
  legend: RG02_LEGEND,
  /*
   * The ferry lands at the jetty in the south-west. North is the barracks wall (`#`) with its
   * painted-over slogans; the parade ground (`:`) fills the middle, under the beans on canvas
   * and the spear-rack trellis. The power yard is through the east gap (rows 7-8).
   * The training dummies, the weapon rack and the water trough (`u`) stand on the grass round
   * the square, which stays clear for a fight.
   */
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTT',
    'T######################T',
    'T,,,,,,,,,,,,,,,,,,,,,,T',
    'T,,::::::::::::::::::,,T',
    'Tu,::::::::::::::::::,uT',
    'T,,::::::::::::::::::,,T',
    'Tu,::::::::::::::::::,,T',
    'T,,::::::::::::::::::===',
    'T,,::::::::::::::::::===',
    'T,,::::::::::::::::::,,T',
    'T,,,,,,,,,,,,,,,,,,,,uuT',
    'T,,,,,,,,,,,,,,,,,,,,,,T',
    'TWwwww,,,,,,,,,,,,,,,,,T',
    'TWWwwwww,,,,,,,,,,,,,,,T',
    'TWWWWww,,,,,,,,,,,,,,,,T',
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
  legend: RG02_LEGEND,
  /*
   * The live line runs along the north side on its poles (`F`: you can see and shoot over it, not
   * walk through it). The rain cistern (`W`) has overflowed across the yard: the standing water
   * (`~`) beside the line is SF-2.1's wet ground. The dead copper spur hangs at the back (east),
   * on its own poles. The gate west (rows 5-6) goes back to the parade ground.
   * The workshop bench (`d`) stands by the south-west corner.
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
    '#d...............##',
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
