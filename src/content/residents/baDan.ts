/**
 * Ba Dan's residents (ADR 0047 §3, §4, §8; W5a, tiles W5c).
 *
 * Anchors are narrative codes bound to tiles on today's two Ba Dan maps. Each
 * tile was chosen against the painted scene, not the ASCII rows alone: the
 * `w` cells and the `=` notches inside the house footprints (the ADR's
 * `bd04.court` candidate at x=9, rows 10-11, and the north dwelling's (12,3))
 * are drawn inside a wall, so nobody stands there. Every house's door is on
 * its east face, and its steps come down at the tile diagonally in front of
 * the step (Gao (10,3), Mira (16,3), Pella's household (10,13)); the private
 * anchors use those tiles as their doors. See the W5c anchor table in the
 * slice report for the tile-by-tile reasoning.
 *
 * The schedule is the ADR's §8 table, itself the guide's §05.1 workday with
 * the recorded adaptations. The guide's §05.2 states are applied first, as it
 * asks, and in Slice A they reduce to four things:
 *
 * - **The five missing** (Bo-shan, Leto, Amri, Hesra, Senn) are held until
 *   their per-person release by having no record at all: no resident, no
 *   NpcDef, no placement, and the identity register rejects their keys (W0).
 *   Their release is Slice B's per-person state, not a global flag here.
 * - **Occupation** (before `act1_complete`, including an Act I defeat, which is
 *   a resolver-only state today) changes nobody's place, only the visible
 *   evidence: `variants` on the slots (short stock, a road watched for
 *   returnees, a shared household table).
 * - **Return** (`act1_complete` before every homecoming is heard, the guide's
 *   "first safe night"): the `mission` holds keep each owner of a homecoming
 *   at a public anchor in every phase until it is visited, and the evening
 *   slots show the returnees' supper.
 * - **Recovery** (every homecoming heard): the ordinary schedule, unchanged.
 *   Per-person recovery is Slice B.
 *
 * Activity keys are presentation keys (pose, prop, bark); nothing evaluates
 * them. Placements are derived by `resolveResidents` and never saved.
 */

import type {
  BackgroundRole,
  Condition,
  ResidentDef,
  ResidentSlot,
  WorldAnchor,
} from '../../core/types';
import { RIVERSIDE_ID } from '../maps/riverside';
import { VILLAGE_HOMECOMINGS_COMPLETE } from '../story/return';

const VILLAGE = 'ba_dan_village';

/* ------------------------------------------------------------------ */
/* Conditions                                                          */
/* ------------------------------------------------------------------ */

const flag = (key: string): Condition => ({ kind: 'flag', key, op: 'set' });
const visited = (nodeId: string): Condition => ({ kind: 'visited', nodeId });
const not = (of: Condition): Condition => ({ kind: 'not', of });
const all = (...of: Condition[]): Condition => ({ kind: 'all', of });
const any = (...of: Condition[]): Condition => ({ kind: 'any', of });

const VICTORY = flag('act1_complete');
/** §05.2 "Missing, rescue unresolved": the quarry still holds the five. */
const OCCUPIED = not(VICTORY);
/** §05.2 "Act I defeat, occupation continues". Resolver-only: the loss is terminal today. */
const DEFEATED = flag('act1_lost');
/** §05.2 "First safe night": the workers are home and not every homecoming is heard. */
const HOMECOMING = all(VICTORY, not(VILLAGE_HOMECOMINGS_COMPLETE));

/** Mira's required conversations (§4): `mira_intro`, then `mira_epilogue` after victory. */
const MIRA_HELD = any(not(visited('mira_intro')), all(VICTORY, not(visited('mira_epilogue'))));
const GAO_HELD = all(VICTORY, not(any(visited('gao_home'), visited('gao_home_cold'))));
const PELLA_HELD = all(VICTORY, not(visited('pella_home')));
const DORIN_HELD = all(VICTORY, not(visited('dorin_home')));

/* ------------------------------------------------------------------ */
/* Anchors (§3; tiles W5c)                                             */
/* ------------------------------------------------------------------ */

const tile = (id: string, place: string, mapId: string, x: number, y: number): WorldAnchor => ({
  id,
  place,
  site: { kind: 'map', mapId, pos: { x, y } },
});

const door = (id: string, place: string, x: number, y: number): WorldAnchor => ({
  id,
  place,
  site: { kind: 'private', door: { mapId: VILLAGE, pos: { x, y } } },
});

export const BA_DAN_ANCHORS: readonly WorldAnchor[] = [
  // Mira's Table: the square's paving beside the canal, next to the bench
  // rest spot (10,5). No table or awning art yet.
  tile('bd01.table', 'BD01', VILLAGE, 11, 5),
  // Gao's shopfront: the lane in front of his display, below the shop steps.
  tile('bd02.shopfront', 'BD02', VILLAGE, 9, 4),
  // The rear room: the merchant house's steps come down at (10,3).
  door('home.gao', 'BD02', 10, 3),
  // D5: Mira lives in the north dwelling; its door steps come down at (16,3).
  door('home.mira', 'BD01-HOME', 16, 3),
  // D6: the gate post on the south verge of the east road, off the cart
  // track, with the road and the east exit in view; the handover tile is the
  // verge beside it, on the village side.
  tile('bd03.post', 'BD03', VILLAGE, 20, 9),
  tile('bd03.handover', 'BD03', VILLAGE, 19, 9),
  // D5: Pella's household is the south-west dwelling. The court is the lawn
  // in front of its door, clear of both houses' walls; the household adult
  // stands beside it, nearer the door. The door tile (10,13) stays free.
  tile('bd04.court', 'BD04', VILLAGE, 11, 12),
  tile('bd04.yard', 'BD04', VILLAGE, 11, 13),
  door('home.pella', 'BD04', 10, 13),
  // No school on any map (§3): Pella goes to class down the south lane.
  door('bd05.school', 'BD05', 11, 15),
  // Dorin's home is "off the gate lane" (guide NPC-04) and Hanru's is BD16:
  // interim doors in the tree line just south of the gate, never an exit.
  door('home.dorin', 'DORIN-HOME', 22, 11),
  door('home.hanru', 'BD16', 22, 10),
  // The riverside: Mira's walk on the open bank east of the banyan, and the
  // safe place to watch the otter, dry ground two tiles back from the reeds,
  // in Mira's line of sight.
  tile('bd06.bank', 'BD06', RIVERSIDE_ID, 15, 9),
  tile('bd06.watch', 'BD06', RIVERSIDE_ID, 16, 14),
  // D3: Dorin's drill on the east-bank practice ground, between the posts.
  tile('rv.practice', 'RV-PRACTICE', RIVERSIDE_ID, 32, 12),
];

/* ------------------------------------------------------------------ */
/* Residents (§8)                                                      */
/* ------------------------------------------------------------------ */

type SlotExtra = Omit<Partial<ResidentSlot>, 'anchor' | 'activity'>;

const talk = (anchor: string, npc: string, activity: string, extra: SlotExtra = {}) =>
  ({ anchor, activity, npc, interrupt: 'talk', ...extra }) satisfies ResidentSlot;

const busy = (anchor: string, npc: string, activity: string, extra: SlotExtra = {}) =>
  ({ anchor, activity, npc, interrupt: 'finish-then-talk', ...extra }) satisfies ResidentSlot;

const WATCH = { service: 'gate_watch' } as const;

const MIRA: ResidentDef = {
  id: 'lw.npc.mira',
  name: 'Mira',
  source: { established: 'NPC-01', runtimeNpcIds: ['elder_mira', 'riverside_mira'] },
  home: 'home.mira',
  fallback: talk('bd01.table', 'elder_mira', 'table'),
  schedule: {
    dawn: busy('bd01.table', 'elder_mira', 'set_bowls', {
      variants: [{ when: HOMECOMING, activity: 'set_extra_bowls' }],
    }),
    morning: talk('bd01.table', 'elder_mira', 'public_concerns', {
      variants: [
        { when: DEFEATED, activity: 'post_road_notice' },
        { when: OCCUPIED, activity: 'concerns_about_the_missing' },
      ],
    }),
    midday: talk('bd01.table', 'elder_mira', 'shared_meal'),
    afternoon: talk('bd06.bank', 'riverside_mira', 'river_walk'),
    evening: talk('bd01.table', 'elder_mira', 'table_company', {
      variants: [{ when: HOMECOMING, activity: 'returnee_supper' }],
    }),
    night: 'home',
  },
  overrides: [
    {
      // Until `mira_intro`, and after victory until `mira_epilogue` (§4).
      id: 'mira_required',
      tier: 'mission',
      when: MIRA_HELD,
      slots: {},
      all: talk('bd01.table', 'elder_mira', 'waiting_to_talk'),
    },
  ],
};

const GAO: ResidentDef = {
  id: 'lw.npc.gao',
  name: 'Gao',
  source: { established: 'NPC-02', runtimeNpcIds: ['shopkeeper_gao'] },
  home: 'home.gao',
  fallback: talk('bd02.shopfront', 'shopkeeper_gao', 'shopfront'),
  schedule: {
    dawn: busy('bd02.shopfront', 'shopkeeper_gao', 'plant_into_light'),
    morning: talk('bd02.shopfront', 'shopkeeper_gao', 'shop_service', {
      variants: [
        { when: DEFEATED, activity: 'honest_stock_check' },
        { when: OCCUPIED, activity: 'short_stock_service' },
      ],
    }),
    midday: talk('bd02.shopfront', 'shopkeeper_gao', 'break_sign'),
    afternoon: talk('bd02.shopfront', 'shopkeeper_gao', 'stock_and_repairs', {
      // LW-S-BD-01 (§8): once the plant scene is completed, its pose stays.
      variants: [
        {
          when: { kind: 'flag', key: 'scene.bd01_plant_chair', op: 'eq', value: 'completed' },
          activity: 'plant_on_chair_idle',
        },
      ],
    }),
    evening: talk('bd02.shopfront', 'shopkeeper_gao', 'threshold_accounts', {
      variants: [{ when: HOMECOMING, activity: 'threshold_welcome' }],
    }),
    night: 'home',
  },
  overrides: [
    {
      id: 'gao_homecoming',
      tier: 'mission',
      when: GAO_HELD,
      slots: {},
      all: talk('bd02.shopfront', 'shopkeeper_gao', 'waiting_to_talk'),
    },
  ],
};

const PELLA: ResidentDef = {
  id: 'lw.npc.pella',
  name: 'Pella',
  source: { established: 'NPC-03', runtimeNpcIds: ['kid_pella', 'riverside_pella'] },
  home: 'home.pella',
  fallback: talk('bd04.court', 'kid_pella', 'court'),
  schedule: {
    dawn: talk('bd04.court', 'kid_pella', 'breakfast'),
    // Private: the school notice (W6) stands in for her.
    morning: { anchor: 'bd05.school', activity: 'school', interrupt: 'observe' },
    midday: talk('bd04.court', 'kid_pella', 'household_meal'),
    afternoon: talk('bd06.watch', 'riverside_pella', 'watch_the_otter'),
    evening: talk('bd04.court', 'kid_pella', 'supper', {
      variants: [
        { when: OCCUPIED, activity: 'shared_household_supper' },
        { when: HOMECOMING, activity: 'family_supper' },
      ],
    }),
    night: 'home',
  },
  overrides: [
    {
      id: 'pella_homecoming',
      tier: 'mission',
      when: PELLA_HELD,
      slots: {},
      all: talk('bd04.court', 'kid_pella', 'waiting_to_talk'),
    },
    {
      // Supervision (§4): Pella goes to the river only with Mira there. While
      // Mira is held at her table, Pella stays at the family court.
      id: 'pella_supervised',
      tier: 'care',
      when: MIRA_HELD,
      slots: { afternoon: talk('bd04.court', 'kid_pella', 'court_play') },
    },
  ],
};

const DORIN: ResidentDef = {
  id: 'lw.npc.dorin',
  name: 'Dorin',
  source: { established: 'NPC-04', runtimeNpcIds: ['guard_dorin', 'riverside_dorin'] },
  home: 'home.dorin',
  fallback: talk('bd03.handover', 'guard_dorin', 'off_watch'),
  schedule: {
    dawn: talk('bd03.post', 'guard_dorin', 'take_over_watch', WATCH),
    morning: talk('bd03.post', 'guard_dorin', 'watch_arrivals', {
      ...WATCH,
      variants: [{ when: OCCUPIED, activity: 'watch_for_returnees' }],
    }),
    // D3: the drill is his midday relief; the relief watch holds the post.
    midday: talk('rv.practice', 'riverside_dorin', 'footing_drill'),
    afternoon: talk('bd03.post', 'guard_dorin', 'watch', WATCH),
    evening: talk('bd03.handover', 'guard_dorin', 'handover_notes'),
    night: 'home',
  },
  overrides: [
    {
      // §4: the post, carrying the watch, by day; the handover tile, with no
      // service, in the evening and at night, so Hanru keeps the night watch.
      id: 'dorin_homecoming',
      tier: 'mission',
      when: DORIN_HELD,
      slots: {
        dawn: talk('bd03.post', 'guard_dorin', 'waiting_to_talk', WATCH),
        morning: talk('bd03.post', 'guard_dorin', 'waiting_to_talk', WATCH),
        midday: talk('bd03.post', 'guard_dorin', 'waiting_to_talk', WATCH),
        afternoon: talk('bd03.post', 'guard_dorin', 'waiting_to_talk', WATCH),
      },
      all: talk('bd03.handover', 'guard_dorin', 'waiting_to_talk'),
    },
  ],
};

/** Bounded (guide §19.7): the evening and night watch, and the dawn handover. Never in daylight. */
const HANRU: ResidentDef = {
  id: 'lw.npc.hanru',
  name: 'Hanru',
  source: { runtimeNpcIds: ['guard_hanru'] },
  home: 'home.hanru',
  fallback: talk('bd03.handover', 'guard_hanru', 'off_watch'),
  schedule: {
    dawn: talk('bd03.handover', 'guard_hanru', 'handover_repeat'),
    morning: 'home',
    midday: 'home',
    afternoon: 'home',
    evening: talk('bd03.post', 'guard_hanru', 'take_watch', WATCH),
    night: talk('bd03.post', 'guard_hanru', 'night_watch', WATCH),
  },
};

/** Declaration order breaks ties within a tier (§2). */
export const BA_DAN_RESIDENTS: readonly ResidentDef[] = [MIRA, GAO, PELLA, DORIN, HANRU];

/* ------------------------------------------------------------------ */
/* Background roles                                                    */
/* ------------------------------------------------------------------ */

export const BA_DAN_BACKGROUND_ROLES: readonly BackgroundRole[] = [
  {
    // D3: the trained relief roster covers Dorin's midday relief.
    id: 'bg.relief_watch',
    label: 'Relief watch',
    sprite: 'npc.guard',
    slots: {
      midday: { anchor: 'bd03.post', activity: 'relief_watch', interrupt: 'observe', ...WATCH },
    },
  },
  {
    // §4: the adult with Pella at the family court. An unnamed stand-in until
    // Nala arrives; it says nothing about Pella's parents.
    id: 'bg.pella_household',
    label: "Pella's household",
    sprite: 'npc.household',
    slots: {},
    accompanies: {
      resident: 'lw.npc.pella',
      anchors: ['bd04.court'],
      slot: { anchor: 'bd04.yard', activity: 'household_chores', interrupt: 'observe' },
    },
  },
];
