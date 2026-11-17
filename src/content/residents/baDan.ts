/**
 * Ba Dan's residents (ADR 0047 §3, §4, §8; W5a, tiles W5c).
 *
 * Anchors are narrative codes bound to tiles on today's two Ba Dan maps. Each
 * tile was chosen against the painted scene, not the ASCII rows alone: the
 * `w` cells and the `=` notches inside the house footprints (the ADR's
 * `bd04.court` candidate at x=9, rows 10-11, and the north dwelling's (12,3))
 * are drawn inside a wall, so nobody stands there. Every house's door is on
 * its front, the south face, as the top-down houses draw it (ADR 0104, T3; the
 * owner moved them on 2026-11-06), and its step comes down on the cell below
 * the door (Gao (7,4), Mira (13,4), Pella's household (8,14)); the private
 * anchors use those tiles as their doors. Until the top-down style is the
 * default (T6) the oblique painting shows its east-face steps, so a resident
 * going home there steps from the front wall. See the W5c anchor table in the
 * slice report for the tile-by-tile reasoning.
 *
 * The schedule is the ADR's §8 table, a workday with the recorded
 * adaptations. The ADR's story states are applied first, and in Slice A they
 * reduce to four things:
 *
 * - **The five returnees** (Bo-shan, Leto, Amri, Hesra, Senn) are composed
 *   below from Slice B's profile-backed records. An absent key reads as
 *   `missing`, so their NpcDefs remain invisible until an authored transition
 *   releases each person.
 * - **Occupation** (before `act1_complete`) changes nobody's place, only the
 *   visible evidence: `variants` on the slots (short stock, a road watched for
 *   returnees, a shared household table).
 * - **Defeat** (`act1_lost`: a Driller loss, resumable since the owner's
 *   2026-11-14 decision, story bible C-01 and C-16): occupation continues, and
 *   Dorin is away driving Bo-shan's cart (saga outline, decision 10), so Hanru
 *   keeps the gate by day as well as by night; the relief watch still covers
 *   midday.
 * - **Return** (`act1_complete` before every homecoming is heard, the first
 *   safe night): the `mission` holds keep each owner of a homecoming
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
import { RETURNEE_ANCHORS, RETURNEE_RESIDENTS } from './returnees';

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
/** §05.2 "Act I defeat, occupation continues": a Driller loss, carried on from (C-01). */
const DEFEATED = flag('act1_lost');
/** §05.2 "First safe night": the workers are home and not every homecoming is heard. */
const HOMECOMING = all(VICTORY, not(VILLAGE_HOMECOMINGS_COMPLETE));

/** Mira's required conversations (§4): `mira_intro`, then `mira_epilogue` after victory. */
const MIRA_HELD = any(not(visited('mira_intro')), all(VICTORY, not(visited('mira_epilogue'))));
const GAO_HELD = all(VICTORY, not(any(visited('gao_home'), visited('gao_home_cold'))));
const PELLA_HELD = all(VICTORY, not(visited('pella_home')));
/**
 * Pella sits at Mira's table for the first talk there (DLG-01). Opening
 * `mira_intro` visits it at once, but a conversation freezes resident motion
 * until it ends (`residentMotion.ts`), so she stays beside Mira for the whole
 * talk and walks back to her own day afterwards.
 */
const PELLA_AT_TABLE = not(visited('mira_intro'));
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
  // Mira's Table: the square's open cell west of the table's two blocked cells (13..14, 9), beside the
  // rest spot at (13,9). No table or awning art yet.
  tile('bd01.table', 'BD01', VILLAGE, 12, 9),
  // Pella's seat at Mira's table for the first talk (DLG-01): the cell south-east of the table, clear of
  // the rest spot and the party's spawn.
  tile('bd01.bench', 'BD01', VILLAGE, 14, 10),
  // Gao's shopfront: the road in front of his shop, west of the trough (21,7).
  tile('bd02.shopfront', 'BD02', VILLAGE, 20, 7),
  // The rear room: the back path behind his shop, north of its row (22,3).
  door('home.gao', 'BD02', 22, 3),
  // D5: Mira lives in the north dwelling on the square; its front door's step is at (13,7).
  door('home.mira', 'BD01-HOME', 13, 7),
  // D6: the gate post inside the east wall, on the north side of the road under the guard hut (27,8), and
  // the handover tile beside it, on the village side (26,8). Column x=28 is the welcome trigger's, so
  // neither stands on it.
  tile('bd03.post', 'BD03', VILLAGE, 27, 8),
  tile('bd03.handover', 'BD03', VILLAGE, 26, 8),
  // D5: Pella's household is the family home past the canal, door at (9,14). The court is the lane
  // in front of the houses, the household adult stands beside it at the yard.
  tile('bd04.court', 'BD04', VILLAGE, 12, 15),
  tile('bd04.yard', 'BD04', VILLAGE, 13, 16),
  door('home.pella', 'BD04', 9, 14),
  // No school on any map (§3): Pella goes to class down the lane past the canal.
  door('bd05.school', 'BD05', 6, 15),
  // Dorin lives by the gate, on the north-east, between the shrine (25,7) and the guard hut (27..28, 6..7)
  // (writing pass, provisional); Hanru's is BD16, past the canal on the east lane.
  door('home.dorin', 'DORIN-HOME', 26, 7),
  door('home.hanru', 'BD16', 26, 15),
  // The riverside: Mira's walk on the open bank east of the banyan, and the
  // safe place to watch the otter, dry ground two tiles back from the reeds,
  // in Mira's line of sight.
  tile('bd06.bank', 'BD06', RIVERSIDE_ID, 15, 9),
  tile('bd06.watch', 'BD06', RIVERSIDE_ID, 16, 14),
  // D3: Dorin's drill on the east-bank practice ground, between the posts.
  tile('rv.practice', 'RV-PRACTICE', RIVERSIDE_ID, 32, 12),
  ...RETURNEE_ANCHORS,
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
    midday: talk('bd01.table', 'elder_mira', 'shared_meal', {
      // Canon's return table: after a loss, a mutual-aid meal.
      variants: [{ when: DEFEATED, activity: 'mutual_aid_meal' }],
    }),
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
      // Mira's table (DLG-01): Pella waits beside Mira for the first talk,
      // which she is part of, then goes back to her own day.
      id: 'pella_at_table',
      tier: 'mission',
      when: PELLA_AT_TABLE,
      slots: {},
      all: talk('bd01.bench', 'kid_pella', 'waiting_at_table'),
    },
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

/** The post Dorin is held at in every daylight phase (`dorin_homecoming`). */
const DORIN_POST = talk('bd03.post', 'guard_dorin', 'waiting_to_talk', WATCH);

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
        dawn: DORIN_POST,
        morning: DORIN_POST,
        midday: DORIN_POST,
        afternoon: DORIN_POST,
      },
      all: talk('bd03.handover', 'guard_dorin', 'waiting_to_talk'),
    },
    {
      // After a Driller loss he drives Bo-shan's cart until MQ-11 (decision 10).
      id: 'dorin_driving',
      tier: 'presence',
      when: DEFEATED,
      slots: {},
      all: 'absent',
    },
  ],
};

/** Hanru's post by day while Dorin is away with the cart. */
const HANRU_DAY = talk('bd03.post', 'guard_hanru', 'day_watch', WATCH);

/**
 * Bounded (ADR 0047 §8): the evening and night watch, and the dawn handover. Never in daylight,
 * except after a Driller loss, when Dorin is away (`hanru_day_watch`).
 */
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
  overrides: [
    {
      // Dorin is away after a Driller loss: Hanru takes his watches. The relief
      // watch keeps midday, so Hanru still gets home once a day.
      id: 'hanru_day_watch',
      tier: 'presence',
      when: DEFEATED,
      slots: { dawn: HANRU_DAY, morning: HANRU_DAY, afternoon: HANRU_DAY },
    },
  ],
};

/** Declaration order breaks ties within a tier (§2). */
export const BA_DAN_RESIDENTS: readonly ResidentDef[] = [
  MIRA,
  GAO,
  PELLA,
  DORIN,
  HANRU,
  ...RETURNEE_RESIDENTS,
];

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
