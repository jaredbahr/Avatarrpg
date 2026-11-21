/**
 * The flag registry: every story flag the game reads or writes, in one place.
 *
 * The story bible (`docs/story-bible.md`) says what happened; this says what the
 * game remembers about it. A new region checks both before it adds a line that
 * depends on the past.
 *
 * `flags.test.ts` holds the registry to the content, both ways:
 *
 * - every flag set or read anywhere (story effects, every `Condition`, branch
 *   nodes, encounter gates, discipline gates, followers, the journal, and the
 *   app's own `setFlags` commands and guidance state) must have an entry here;
 * - each entry's `setBy` and `readBy` must name exactly the records that touch
 *   it (an app module may also be named where it reaches the key through a
 *   constant the scan cannot follow);
 * - `status` must match what the content does: a `live` flag is both written and
 *   read; anything else says why it is not, in `note`;
 * - every written or compared value must fit `type` and `values`;
 * - no two keys may be a typo apart.
 *
 * Areas are content ids, not files: `story:<node id>`, `map:<map id>`,
 * `encounter:<id>`, `discipline:<id>`, `resident:<id>`, `follower:<id>`,
 * `journal:<note id>`. App code is `app:<path under src, no extension>`.
 *
 * Adding a flag: add the entry first, then the content. The test prints the
 * exact `setBy`/`readBy` it found when they disagree, so paste from there.
 *
 * Reading the past from a later scene (ADR 0112): a save already past a flag's
 * setter can never come to hold it. When a flag that something reads gains a
 * write in a region a release already shipped, its entry says how that
 * release's saves answer (`oldSaves`). `saveHistory.test.ts` holds every
 * release snapshot and every frozen save to that rule.
 */

import type { FlagValue } from '../../core/types';

/**
 * - `live`: written by something and read by something.
 * - `informational`: written, and nothing gates on it yet; `note` names who
 *   cares (a later act, the save, the ending summary).
 * - `pending`: one side is not written yet, such as a gate whose teacher scene
 *   is later content; `note` names what will supply the other side.
 * - `reserved`: neither side exists yet (the standing keys of nations the demo
 *   never meets); kept so the key is spelled once.
 */
export type FlagStatus = 'live' | 'informational' | 'pending' | 'reserved';

/** Where in the saga a flag belongs. Story order, demo first. */
export const FLAG_ARCS = [
  'Demo · Ba Dan',
  'Demo · Forest Road',
  'Demo · Quarry gate',
  'Demo · The Cutting',
  'Demo · Quarry floor',
  'Demo · Walk home',
  'Demo · Riverside',
  'Demo · A Ba Dan day',
  'Side story · SQ-01 Too Many Cabbages',
  'Side story · SQ-02 A Very Official Gate',
  'Side story · SQ-03 Gao’s Other Ledger',
  'Act II · Saltstep',
  'Saga · Nation standing',
  'Saga · Disciplines',
  'App · Guidance',
] as const;
export type FlagArc = (typeof FLAG_ARCS)[number];

export type FlagType = 'boolean' | 'number' | 'string';

/**
 * - `backfill`: a rule in `flagBackfills.ts` gives the save its answer on load.
 * - `open`: every save can still set it (a new scene nobody is locked out of).
 * - `unset`: a save past the setter answers "never happened", and that is the
 *   intended answer; `why` says what the player sees because of it.
 */
export interface OldSavesAnswer {
  /** The newest release (`src/core/save/fixtures/releases/index.json`) this was decided for. */
  readonly upTo: string;
  /**
   * What this answers for. A flag's: the write sites (`story:<node>`, `app:<module>`). A road's
   * (`LATE_EDGES`): the roads (`next=gate_talked_through`). It covers only those it names, so
   * one added later is asked about afresh. Not used by a scene.
   */
  readonly sites?: readonly string[];
  readonly answer: 'backfill' | 'open' | 'unset';
  /**
   * With `unset`: the readers it was decided for (`story:<node>`, `map:<id>`, ...). "Never
   * happened" is the right answer only for readers that have a line for it, so a reader added
   * later is asked about afresh (#813). Required for `unset` wherever the check asks.
   */
  readonly readers?: readonly string[];
  readonly why: string;
}

export interface FlagDef {
  /** The exact key, or a family ending in `.*` for keys the app builds at run time. */
  readonly key: string;
  /** The value's type; a list where it changes type (a stage counter that ends on `'done'`). */
  readonly type: FlagType | readonly FlagType[];
  /** Every value the flag may hold. Omit for any value of `type`. */
  readonly values?: readonly FlagValue[];
  /** One line: what it means that this flag is set. */
  readonly meaning: string;
  readonly arc: FlagArc;
  readonly status: FlagStatus;
  /** Required unless `live`: who reads it, or what will set it, and when. */
  readonly note?: string;
  readonly setBy: readonly string[];
  readonly readBy: readonly string[];
  /**
   * How saves written before the flag's newest write site answer it (ADR 0112).
   * Required once a release has shipped the region without that write and
   * something reads the flag.
   */
  readonly oldSaves?: OldSavesAnswer;
}

/**
 * The first release (`src/core/save/fixtures/releases/`): the story as the
 * commit that wrote the `golden/v5` saves had it, on 2026-11-08.
 */
const GOLDEN_V5 = '2026-11-08-golden-v5';

/* How saves from before each of these answer (ADR 0112). */
const GUIDED_FIGHT_IS_FOR_NEW_GAMES = (
  sites: readonly string[],
  readers: readonly string[],
): OldSavesAnswer => ({
  upTo: GOLDEN_V5,
  sites,
  answer: 'unset',
  readers,
  why: 'Only a new game is offered the guided first fight; an older save plays the Forest Road unguided, as it always did.',
});
const REASON_STAYS_ON_THE_FLOOR = (...sites: string[]): OldSavesAnswer => ({
  upTo: GOLDEN_V5,
  sites,
  answer: 'open',
  why: 'The find waits on its map after the rescue until its hero takes it, and the road back to the quarry stays open.',
});
const SIDE_STORY_WINDOW = (
  sites: readonly string[],
  readers: readonly string[],
): OldSavesAnswer => ({
  upTo: GOLDEN_V5,
  sites,
  answer: 'unset',
  readers,
  why: 'The side story is offered before the rescue. A save already past it answers as a player who walked by, and every reader has a line for that.',
});

/**
 * Scenes that a `visited` condition reads and that were added to a region a
 * release had already shipped (ADR 0112). A save of that release may be past
 * the only road into the scene, so each says how such a save answers, exactly
 * as a flag's `oldSaves` does. `saveHistory.test.ts` asks for an entry.
 */
export const LATE_SCENES: Readonly<Record<string, OldSavesAnswer>> = {
  sq01_packing_list: {
    upTo: GOLDEN_V5,
    answer: 'backfill',
    why: 'Pella hands the list over as she asks about Bo-shan, a scene an older save has already had. A save that was asked and has not finished the rescue is given the list.',
  },
  sq02_return: {
    upTo: GOLDEN_V5,
    answer: 'open',
    why: 'Read only by its own once-only gate on Dorin; it plays for any save that settled the side gate.',
  },
  sq03_jar: {
    upTo: GOLDEN_V5,
    answer: 'open',
    why: 'Read only by its own once-only gate on Gao; it plays for any save that settled the ledger.',
  },
  cutting_culvert: {
    upTo: GOLDEN_V5,
    answer: 'open',
    why: 'The culvert is a crossing in the Cutting that waits until it has been seen, and the Cutting stays open.',
  },
  demo_complete: {
    upTo: GOLDEN_V5,
    answer: 'open',
    why: 'The welcome home waits at the village gate for any save that has walked home and not yet seen it.',
  },
  welcome_home_supper: {
    upTo: GOLDEN_V5,
    answer: 'open',
    why: 'Read only to show Hesra’s boot on the mason’s yard step afterwards, a keepsake and not a gate. A save that has not had the supper still plays it on the walk home and sees the boot after.',
  },
  gao_lost: {
    upTo: '2026-11-15-demo',
    answer: 'open',
    why: 'Read only by its own once-only gate on Gao after a Driller loss. A release save that lost sat on the terminal card, so it has not heard it and hears it first when it carries on.',
  },
  sf11_the_bend: {
    upTo: '2026-11-19-roads',
    answer: 'open',
    why: 'Read only by Bessa’s own once-only gate on the Forest Road. A side fight no release had, so no older save has had it, and it waits on the road for any save past Act I.',
  },
  sf12_the_slab: {
    upTo: '2026-11-19-roads',
    answer: 'open',
    why: 'Read only by Tolma’s own once-only gate in the Cutting. A side fight no release had, so no older save has had it, and it waits on the road for any save past Act I.',
  },
  sf22_rules: {
    upTo: '2026-11-19-roads',
    answer: 'open',
    why: 'Read only by the ferry apprentices’ own once-only gate in the market. A side fight no release had, so no older save has had it, and it waits by the ferry landing.',
  },
  sf23_battle: {
    upTo: '2026-11-19-roads',
    answer: 'open',
    why: 'Read only by the corporal’s own once-only gate on the river road. A side fight no release had, so no older save has had it, and it waits at the guards’ camp.',
  },
  sf23_pole_up: {
    upTo: '2026-11-19-roads',
    answer: 'open',
    why: 'Read only by the river road’s set dressing (ADR 0123): the camp goes and the pole stands raised once the toll is won. A side fight no release had, so no older save has won it, and its saves see the camp and the lowered pole until they do.',
  },
  sf23_one_sack: {
    upTo: '2026-11-19-roads',
    answer: 'open',
    why: 'Read only by the river road’s set dressing (ADR 0123): the pole raised and one sack by the cold fire after Carry on. A side fight no release had, so no older save has carried on from it, and its saves see the lowered pole until they do.',
  },
  look_hesra_boot: {
    upTo: '2026-11-15-demo',
    answer: 'open',
    why: 'Read only by the journal note for the boot by the mason’s yard door. The boot stays there after the supper, so an older save looks at it and gets the note then.',
  },
};

/**
 * Roads opened, in a region a release had already shipped, into a scene that release already
 * had (ADR 0112, #813): `lateEdges` in `saveHistory.ts`. A save of that release went the old
 * way, so whatever the scene (or a scene after it) records, the save lacks. Area to its answer;
 * `sites` names the roads answered (`next=gate_talked_through`). `saveHistory.test.ts` asks for
 * an entry.
 */
export const LATE_EDGES: Readonly<Record<string, OldSavesAnswer>> = {
  'map:saltstep_market': {
    upTo: '2026-11-19-roads',
    sites: ['triggers[#mq02_saltstep_arrival_tidy].node=mq02_saltstep_arrival'],
    answer: 'open',
    why: 'The tidy-cart trigger plays the same arrival scene as the one it splits from; only the cart’s picture differs, so a save that came the old way recorded everything this road would.',
  },
};

/* The hub flag: read nearly everywhere after the quarry. */
const ACT1_COMPLETE_READERS = [
  'map:ba_dan_village',
  'map:ba_dan_riverside',
  'map:forest_road',
  'map:quarry_gate',
  'map:ambush_road',
  'map:quarry_floor',
  // Party voices (`partyVoices.ts`) only speak before the rescue.
  'story:village_explore',
  'story:dorin_directions',
  'story:defeat_forest',
  'story:gate_kinship',
  'story:defeat_gate',
  'story:escort_chosen',
  'story:defeat_ambush',
  'story:quarry_assessment',
  'story:defeat_boss',
  'story:riverside_explore',
  'story:riverside_mira',
  'story:riverside_pella',
  'story:forest_dema',
  'story:forest_dema_again',
  'story:cutting_tea',
  'story:cutting_tea_again',
  'story:discover_duck_nest',
  'story:revisit_duck_nest',
  'story:leave_duck_nest',
  'story:discover_runoff_marker',
  'story:revisit_runoff_marker',
  'story:leave_runoff_marker',
  'story:revisit_tea_station',
  'story:leave_tea_station',
  'story:plant_chair_decline',
  'story:handover_scene',
  'story:handover_repeat',
  'story:hanru_watch',
  'story:hanru_watch_leave',
  'story:school_notice',
  'story:village_leave',
  'story:sq01_leave',
  'resident:lw.npc.mira',
  'resident:lw.npc.gao',
  'resident:lw.npc.pella',
  'resident:lw.npc.dorin',
  'journal:bo_shan_cart',
  'journal:galleries',
  'journal:maker_plate',
];

export const FLAG_REGISTRY: readonly FlagDef[] = [
  /* ------------------------------------------------------------ Ba Dan */
  {
    key: 'pella_asked',
    type: 'boolean',
    values: [true],
    meaning: 'Pella told the party about her brother Bo-shan and his cabbage cart.',
    arc: 'Demo · Ba Dan',
    status: 'live',
    setBy: ['story:pella_asked'],
    readBy: [
      'map:ba_dan_village',
      'map:quarry_floor',
      'story:demo_complete',
      'story:pella_home',
      'journal:bo_shan_cart',
    ],
  },
  {
    key: 'rubbing_given',
    type: 'boolean',
    values: [true],
    meaning: 'The party handed Mira the rubbing of the driller’s Republic City maker’s plate.',
    arc: 'Demo · Walk home',
    status: 'live',
    oldSaves: {
      upTo: GOLDEN_V5,
      sites: ['story:mira_rubbing_given'],
      answer: 'open',
      why: 'Mira asks for the rubbing at the end of her epilogue, which repeats until she has it.',
    },
    setBy: ['story:mira_rubbing_given'],
    readBy: ['map:ba_dan_village'],
  },

  /* ------------------------------------------------------- Forest Road */
  {
    key: 'lost_forest_road',
    type: 'boolean',
    values: [true],
    meaning: 'The party lost the Forest Road ambush and was robbed of its provisions.',
    arc: 'Demo · Forest Road',
    status: 'live',
    setBy: ['story:lost_forest_road'],
    readBy: ['story:after_forest', 'story:sf11_recognised'],
  },
  {
    key: 'world.ducks_seen',
    type: 'boolean',
    values: [true],
    meaning:
      'The party met Lanfen and her displaced turtle ducks on the Forest Road, and heard about the runoff; it opens the gate talk.',
    arc: 'Demo · Forest Road',
    status: 'live',
    setBy: ['story:forest_ducks_seen'],
    readBy: [
      'map:forest_road',
      'story:gate_parley',
      'story:gate_kinship',
      'story:gate_ruon_listens',
      'story:demo_complete',
      'journal:ducks',
    ],
  },
  {
    key: 'world.discovered.duck_nest',
    type: 'boolean',
    values: [true],
    meaning: 'The party found the turtle duck nest in the woollen sock.',
    arc: 'Demo · Forest Road',
    status: 'live',
    setBy: ['story:remember_duck_nest'],
    readBy: ['map:forest_road', 'journal:duck_nest'],
  },
  {
    key: 'world.discovered.runoff_marker',
    type: 'boolean',
    values: [true],
    meaning:
      'The party read the silted flood marker that asks if the settling pit is blocked; it opens the gate talk.',
    arc: 'Demo · Forest Road',
    status: 'live',
    setBy: ['story:remember_runoff_marker'],
    readBy: [
      'map:forest_road',
      'story:gate_parley',
      'story:gate_kinship',
      'story:gate_ruon_listens',
      'journal:runoff_marker',
    ],
  },

  /* -------------------------------------------------------- Quarry gate */
  {
    key: 'gate_fire_bluff',
    type: 'boolean',
    values: [true],
    meaning:
      'A firebender talked Hotaro, the hired guard by the oil barrels, off his post at the quarry gate; the crew fought without him.',
    arc: 'Demo · Quarry gate',
    status: 'live',
    setBy: ['story:gate_bluff'],
    readBy: ['encounter:enc_quarry_gate', 'story:welcome_home_dorin', 'story:demo_complete'],
  },
  {
    key: 'gate_talked_through',
    type: 'boolean',
    values: [true],
    meaning:
      'The party talked Captain Ruon into opening the gate on what it knew about his quarry; no gate fight.',
    arc: 'Demo · Quarry gate',
    status: 'live',
    setBy: ['story:gate_talked_through'],
    readBy: ['story:welcome_home_dorin', 'story:demo_complete'],
  },
  {
    key: 'ruon_respects_you',
    type: 'boolean',
    values: [true],
    meaning:
      'Ruon opened the gate because the party knew what his quarry was doing: Bo’s crew work, Lin Mei’s survey eye, or the runoff the road showed it.',
    arc: 'Demo · Quarry gate',
    status: 'informational',
    note: 'Set alongside gate_talked_through. Nothing reads it yet; Ruon’s account (DLG-08) credits the party’s knowledge of the galleries.',
    setBy: ['story:gate_talked_through'],
    readBy: [],
  },
  {
    key: 'lost_quarry_gate',
    type: 'boolean',
    values: [true],
    meaning: 'The quarry crew drove the party down the switchbacks; Ruon surrendered anyway.',
    arc: 'Demo · Quarry gate',
    status: 'live',
    setBy: ['story:lost_quarry_gate'],
    readBy: ['story:welcome_home_dorin', 'story:demo_complete'],
  },
  {
    key: 'ruon_spared',
    type: 'boolean',
    values: [true],
    meaning: 'The table chose to escort Captain Ruon to Ba Dan for trial (branch A).',
    arc: 'Demo · Quarry gate',
    status: 'live',
    setBy: ['story:ruon_choice'],
    readBy: [
      'map:ambush_road',
      'story:mira_epilogue',
      'story:defeat_boss_drain',
      'story:demo_complete',
      'story:lost_home_table',
      'story:hanru_watch',
      'follower:follower.ruon',
      'journal:gate_wages',
    ],
  },
  {
    key: 'ruon_traded',
    type: 'boolean',
    values: [true],
    meaning: 'The table traded Captain Ruon to Jin for the inner gate key (branch B).',
    arc: 'Demo · Quarry gate',
    status: 'live',
    setBy: ['story:ruon_choice'],
    readBy: [
      'map:ba_dan_village',
      'encounter:enc_grumbler',
      'story:mira_epilogue',
      'story:welcome_home_gao',
      'story:demo_complete',
      'story:gao_lost',
      'story:plant_chair',
      'story:plant_chair_decline_home',
      'story:plant_chair_decline_road',
      'story:sq03_hook',
      'story:sq03_jar',
      'story:sf12_ruon',
      'story:mq02_freight_clerk',
      'journal:gate_wages',
    ],
  },
  {
    key: 'ruon_paid',
    type: 'boolean',
    values: [true],
    meaning: 'Jin paid the party in coin for Ruon (branch B).',
    arc: 'Demo · Quarry gate',
    status: 'informational',
    note: 'Carries the trade payment’s XP. Nothing reads it yet; a later act may remember the coin.',
    setBy: ['story:trade_payment'],
    readBy: [],
  },

  /* --------------------------------------------------------- The Cutting */
  {
    key: 'lost_ambush',
    type: 'boolean',
    values: [true],
    meaning:
      'Jin’s mercenaries beat the party in the Cutting and took Ruon’s dispatch satchel, not Ruon (escort branch only).',
    arc: 'Demo · The Cutting',
    status: 'informational',
    note: 'No line or recap reads it yet; ruon_carried_you and jin_has_satchel carry the story.',
    setBy: ['story:lost_ambush'],
    readBy: [],
  },
  {
    key: 'ruon_carried_you',
    type: 'boolean',
    values: [true],
    meaning: 'Ruon hauled the beaten party to safety over the scree in the Cutting.',
    arc: 'Demo · The Cutting',
    status: 'informational',
    note: '“The sort of thing a later act should remember about him” (act1.ts). Unread until then.',
    setBy: ['story:lost_ambush'],
    readBy: [],
  },
  {
    key: 'jin_has_satchel',
    type: 'boolean',
    values: [true],
    meaning:
      'Jin holds Ruon’s dispatch satchel, his orders and every delivery he signed for: seized in the Cutting, or handed over with him in the trade.',
    arc: 'Demo · The Cutting',
    status: 'informational',
    note: 'Story bible C-10. Nothing reads it yet; MQ-02’s paper trail should, as Jin bargains over evidence.',
    setBy: ['story:lost_ambush', 'story:trade_payment'],
    readBy: [],
  },
  {
    key: 'world.tea_shared',
    type: 'boolean',
    values: [true],
    meaning: 'The party sat and shared Kuan’s tea at the workers’ rest stop.',
    arc: 'Demo · The Cutting',
    status: 'live',
    setBy: ['story:cutting_tea_shared'],
    readBy: ['map:ambush_road', 'story:demo_complete', 'journal:workers_tea'],
  },
  {
    key: 'world.discovered.tea_station',
    type: 'boolean',
    values: [true],
    meaning: 'The party washed the seventh cup at the crews’ tea station.',
    arc: 'Demo · The Cutting',
    status: 'live',
    setBy: ['story:remember_tea_station'],
    readBy: ['map:ambush_road', 'journal:tea_station'],
  },

  /* -------------------------------------------------------- Quarry floor */
  {
    key: 'act1_complete',
    type: 'boolean',
    values: [true],
    meaning: 'The Driller is beaten and the workers are free: the world is in its “after” state.',
    arc: 'Demo · Quarry floor',
    status: 'live',
    setBy: ['story:act1_victory'],
    readBy: ACT1_COMPLETE_READERS,
  },
  {
    key: 'act1_lost',
    type: 'boolean',
    values: [true],
    meaning:
      'The party lost to the Driller and carried on: the quarry stays occupied, the five stay held, and Dorin drives the cart until MQ-11.',
    arc: 'Demo · Quarry floor',
    status: 'live',
    setBy: ['story:act1_lost'],
    readBy: [
      'map:ba_dan_village',
      'map:forest_road',
      'map:quarry_gate',
      'map:ambush_road',
      'story:village_explore',
      'story:riverside_mira',
      'story:forest_explore',
      'story:cutting_after_explore',
      'story:plant_chair_decline_lost',
      'story:hanru_watch',
      'story:sf11_driver',
      'story:sf11_wheels',
      'story:sf11_wheels_won',
      'story:sf11_back',
      'story:sf12_driver',
      'story:sf12_won',
      'story:sf12_back',
      'story:mq02_coast_driver',
      'story:mq02_parcel',
      'story:mq02_stall_reads',
      'story:mq02_pump_driver',
      'story:mq02_galleries',
      'story:mq02_ferry_driver',
      'story:sf21_driver',
      'story:sf23_driver',
      'resident:lw.npc.mira',
      'resident:lw.npc.gao',
      'resident:lw.npc.dorin',
      'resident:lw.npc.hanru',
      'journal:storm_drain',
    ],
  },

  // Each present hero's reason to keep going (reasons.ts; saga outline decision 22).
  {
    key: 'reason.kaya',
    type: 'boolean',
    values: [true],
    meaning:
      'Kaya found her old neighbour’s lantern-workshop stamp on a crate of lamp glass (C-31): a reason to keep going.',
    arc: 'Demo · Quarry floor',
    status: 'live',
    oldSaves: REASON_STAYS_ON_THE_FLOOR('story:reason_kaya_kept'),
    note: 'Hides the find’s marker once seen. PQ-01 should read it when Kaya is in the party.',
    setBy: ['story:reason_kaya_kept'],
    readBy: ['map:quarry_floor'],
  },
  {
    key: 'reason.tenzo',
    type: 'boolean',
    values: [true],
    meaning:
      'Tenzo found the workers’ ration crates, signed for and never opened (C-31): a reason to keep going.',
    arc: 'Demo · Quarry floor',
    status: 'live',
    oldSaves: REASON_STAYS_ON_THE_FLOOR('story:reason_tenzo_kept'),
    note: 'Hides the find’s marker once seen. PQ-02 should read it when Tenzo is in the party.',
    setBy: ['story:reason_tenzo_kept'],
    readBy: ['map:quarry_floor'],
  },
  {
    key: 'reason.nilak',
    type: 'boolean',
    values: [true],
    meaning:
      'Nilak found his old healing house’s emblem on a “medical supplies” crate of restraints (C-31): a reason to keep going.',
    arc: 'Demo · Quarry floor',
    status: 'live',
    oldSaves: REASON_STAYS_ON_THE_FLOOR('story:reason_nilak_kept'),
    note: 'Hides the find’s marker once seen. PQ-03 should read it when Nilak is in the party.',
    setBy: ['story:reason_nilak_kept'],
    readBy: ['map:quarry_floor'],
  },
  {
    key: 'reason.nima',
    type: 'boolean',
    values: [true],
    meaning:
      'Nima found a sanctuary knot on a supply crate diverted from the mountain shelters (C-31): a reason to keep going.',
    arc: 'Demo · Quarry floor',
    status: 'live',
    oldSaves: REASON_STAYS_ON_THE_FLOOR('story:reason_nima_kept'),
    note: 'Hides the find’s marker once seen. PQ-07 should read it when Nima is in the party.',
    setBy: ['story:reason_nima_kept'],
    readBy: ['map:quarry_floor'],
  },
  {
    key: 'reason.bo',
    type: 'boolean',
    values: [true],
    meaning:
      'Bo found Renn and his old crew on next month’s labour roster in the Driller’s cab (C-31): a reason to keep going.',
    arc: 'Demo · Quarry floor',
    status: 'live',
    oldSaves: REASON_STAYS_ON_THE_FLOOR('story:reason_bo_kept'),
    note: 'Hides the find’s marker once seen. PQ-05 should read it when Bo is in the party.',
    setBy: ['story:reason_bo_kept'],
    readBy: ['map:quarry_floor'],
  },
  {
    key: 'reason.wen',
    type: 'boolean',
    values: [true],
    meaning:
      'Wen found her own regulator in the Driller, its manual release taken out (C-31): a reason to keep going.',
    arc: 'Demo · Quarry floor',
    status: 'live',
    oldSaves: REASON_STAYS_ON_THE_FLOOR('story:reason_wen_kept'),
    note: 'Hides the find’s marker once seen. PQ-10 should read it when Wen is in the party.',
    setBy: ['story:reason_wen_kept'],
    readBy: ['map:quarry_floor'],
  },
  {
    key: 'reason.lin_mei',
    type: 'boolean',
    values: [true],
    meaning:
      'Lin Mei found her own survey mark on the gallery plan Grumbler drew through (C-31): a reason to keep going.',
    arc: 'Demo · Quarry floor',
    status: 'live',
    oldSaves: REASON_STAYS_ON_THE_FLOOR('story:reason_lin_mei_kept'),
    note: 'Hides the find’s marker once seen. PQ-06 should read it when Lin Mei is in the party.',
    setBy: ['story:reason_lin_mei_kept'],
    readBy: ['map:quarry_floor'],
  },
  {
    key: 'reason.riko',
    type: 'boolean',
    values: [true],
    meaning:
      'Riko found a hold her teacher taught her, chalked on the guards’ practice board (C-31): a reason to keep going.',
    arc: 'Demo · Quarry floor',
    status: 'live',
    oldSaves: REASON_STAYS_ON_THE_FLOOR('story:reason_riko_kept'),
    note: 'Hides the find’s marker once seen. PQ-09 should read it when Riko is in the party.',
    setBy: ['story:reason_riko_kept'],
    readBy: ['map:quarry_floor'],
  },
  {
    key: 'reason.jinu',
    type: 'boolean',
    values: [true],
    meaning:
      'Jinu found the messengers’ undelivered letters in the gate office (C-31): a reason to keep going.',
    arc: 'Demo · Walk home',
    status: 'live',
    oldSaves: REASON_STAYS_ON_THE_FLOOR('story:reason_jinu_kept'),
    note: 'Hides the find’s marker once seen. PQ-08 should read it when Jinu is in the party.',
    setBy: ['story:reason_jinu_kept'],
    readBy: ['map:quarry_gate'],
  },

  /* ----------------------------------------------------------- Riverside */
  {
    key: 'riverside_shrine_found',
    type: 'boolean',
    values: [true],
    meaning: 'The party found the riverside shrine and the old high-water line cut into it.',
    arc: 'Demo · Riverside',
    status: 'live',
    setBy: ['story:riverside_shrine_found'],
    readBy: ['journal:shrine', 'app:app/village/VillageLife'],
  },
  {
    key: 'riverside_pet',
    type: 'boolean',
    values: [true],
    meaning: 'The party scratched Pebble the otter-turtle behind the shell.',
    arc: 'Demo · Riverside',
    status: 'live',
    setBy: ['app:app/village/VillageLife'],
    readBy: ['journal:pebble', 'app:app/village/VillageLife'],
  },
  {
    key: 'riverside_tea',
    type: 'boolean',
    values: [true],
    meaning: 'The party stopped for jasmine tea on the riverside veranda.',
    arc: 'Demo · Riverside',
    status: 'live',
    setBy: ['app:app/village/VillageLife'],
    readBy: ['journal:veranda', 'app:app/village/VillageLife'],
  },
  {
    key: 'riverside_drill',
    type: 'boolean',
    values: [true],
    meaning: 'The party finished Dorin’s flow-spark-flow footwork drill by the river.',
    arc: 'Demo · Riverside',
    status: 'live',
    setBy: ['app:app/village/VillageLife'],
    readBy: ['story:sq02_return'],
  },

  /* -------------------------------------------------------- A Ba Dan day */
  {
    key: 'scene.bd01_plant_chair',
    type: 'string',
    values: ['completed'],
    meaning: 'Scene memory: the party sat in Gao’s shop while he found the plant a chair.',
    arc: 'Demo · A Ba Dan day',
    status: 'live',
    setBy: ['story:plant_chair_done'],
    readBy: ['map:ba_dan_village', 'resident:lw.npc.gao'],
  },
  {
    key: 'scene.bd03_handover',
    type: 'string',
    values: ['completed'],
    meaning: 'Scene memory: the party saw Dorin and Hanru hand over the gate watch.',
    arc: 'Demo · A Ba Dan day',
    status: 'live',
    setBy: ['story:handover_done'],
    readBy: ['map:ba_dan_village', 'app:app/world/barks'],
  },

  /* ------------------------------------------- SQ-01 Too Many Cabbages */
  {
    key: 'sq01.cabbages',
    type: 'string',
    values: ['families', 'crew', 'leverage'],
    meaning:
      'Where the party sent Bo-shan’s tipped load: home to Ba Dan, partly to the trapped crews, or hidden to bargain with.',
    arc: 'Side story · SQ-01 Too Many Cabbages',
    status: 'live',
    oldSaves: SIDE_STORY_WINDOW(
      ['story:sq01_choice'],
      [
        'map:ba_dan_village',
        'map:forest_road',
        'story:cart_departure',
        'story:demo_complete',
        'story:pella_home',
        'story:sq01_pella_list',
        'story:sq01_sled_again',
        // An old save past the side story shows Bo-shan's cart as it always was: the untidy one.
        'map:saltstep_market',
      ],
    ),
    setBy: ['story:sq01_choice'],
    readBy: [
      'map:ba_dan_village',
      'map:forest_road',
      'story:cart_departure',
      'story:demo_complete',
      'story:pella_home',
      'story:sq01_sled_again',
      'story:sq01_pella_list',
      'map:saltstep_market',
    ],
  },

  /* -------------------------------------- SQ-02 A Very Official Gate */
  {
    key: 'sq02.gate',
    type: 'string',
    values: ['quiet', 'public', 'mocked'],
    meaning:
      'How the backwards side gate was put right: quietly with Dorin, by helping him explain it publicly, or by laughing it open.',
    arc: 'Side story · SQ-02 A Very Official Gate',
    status: 'live',
    oldSaves: SIDE_STORY_WINDOW(
      ['story:sq02_choice'],
      [
        'map:ba_dan_village',
        'story:demo_complete',
        'story:sq02_after',
        'story:sq02_return',
        'story:sq02_return_gate',
      ],
    ),
    setBy: ['story:sq02_choice'],
    readBy: [
      'map:ba_dan_village',
      'story:demo_complete',
      'story:sq02_after',
      'story:sq02_return',
      'story:sq02_return_gate',
    ],
  },

  /* ---------------------------------------- SQ-03 Gao’s Other Ledger */
  {
    key: 'sq03.ledger',
    type: 'string',
    values: ['extension', 'fund', 'praised'],
    meaning:
      'How the party helped Gao carry his neighbours’ debts: a quiet letter for more time, a shared food jar, or praise in the square he asked them not to give.',
    arc: 'Side story · SQ-03 Gao’s Other Ledger',
    status: 'live',
    oldSaves: SIDE_STORY_WINDOW(
      ['story:sq03_choice'],
      ['map:ba_dan_village', 'story:demo_complete', 'story:sq03_jar', 'story:sq03_jar_label'],
    ),
    setBy: ['story:sq03_choice'],
    readBy: ['map:ba_dan_village', 'story:demo_complete', 'story:sq03_jar', 'story:sq03_jar_label'],
  },

  /* ----------------------------------------------- Nation standing (reserved prefix) */
  /* --------------------------------------------- Act II · Saltstep (RG-02, MQ-02) */
  {
    key: 'lost_saltstep_docks',
    type: 'boolean',
    values: [true],
    meaning:
      'The table chose "Carry on" after losing the winch fight at the Saltstep freight pontoon: the tenth crate went to Emberwatch, and Veyra hooked the pay packet out of the water.',
    arc: 'Act II · Saltstep',
    status: 'live',
    setBy: ['story:mq02_winch_lost'],
    readBy: ['story:mq02_safety_materials', 'story:mq02_public_witnesses'],
  },
  {
    key: 'inquiry_public',
    type: 'boolean',
    values: [true],
    meaning:
      'Scene 2.7: the table voted to have the customs clerk read the pay packet out at the level pole. The market heard, and Emberwatch is warned.',
    arc: 'Act II · Saltstep',
    status: 'live',
    setBy: ['story:mq02_vote'],
    readBy: ['map:saltstep_market', 'story:mq02_market_explore'],
  },
  {
    key: 'inquiry_quiet',
    type: 'boolean',
    values: [true],
    meaning:
      'Scene 2.7: the table voted to seal a copy of the pay packet and carry it quietly across the bay. Nobody at Emberwatch is warned.',
    arc: 'Act II · Saltstep',
    status: 'live',
    setBy: ['story:mq02_vote'],
    readBy: ['map:saltstep_market', 'story:mq02_market_explore'],
  },
  {
    key: 'mq03.invited',
    type: 'boolean',
    values: [true],
    meaning:
      'V. Sen’s card has invited the party to Causeway: the cart takes the river road (Scene 3.9).',
    arc: 'Act II · Saltstep',
    status: 'pending',
    note: 'Set by Scene 3.9, An invitation, which is not built yet; it shows the river road sign at Emberwatch.',
    setBy: [],
    readBy: ['map:emberwatch_parade'],
  },
  {
    key: 'standing.earth',
    type: 'number',
    meaning: 'How the Earth Kingdom feels about the party, from -5 (hostile) to 5 (trusted).',
    arc: 'Saga · Nation standing',
    status: 'pending',
    note: 'Moved at the gate and by Ruon’s fate; shown in the log. No Condition reads standing yet.',
    setBy: ['story:gate_parley', 'story:ruon_choice'],
    readBy: [],
  },
  {
    key: 'standing.fire',
    type: 'number',
    meaning: 'How the Fire Nation feels about the party, from -5 (hostile) to 5 (trusted).',
    arc: 'Saga · Nation standing',
    status: 'reserved',
    note: 'Nothing moves it since the gate bluff stopped trading on a nation (owner, 2026-11-14; C-09). Community trust replaces it (C-25).',
    setBy: [],
    readBy: [],
  },
  {
    key: 'standing.water',
    type: 'number',
    meaning: 'How the Water Tribes feel about the party, from -5 (hostile) to 5 (trusted).',
    arc: 'Saga · Nation standing',
    status: 'reserved',
    note: 'The demo never meets the Water Tribes.',
    setBy: [],
    readBy: [],
  },
  {
    key: 'standing.air',
    type: 'number',
    meaning: 'How the Air Nomads feel about the party, from -5 (hostile) to 5 (trusted).',
    arc: 'Saga · Nation standing',
    status: 'reserved',
    note: 'The demo never meets the Air Nomads.',
    setBy: [],
    readBy: [],
  },
  {
    key: 'standing.nonbender',
    type: 'number',
    meaning: 'How non-bending folk at large feel about the party, from -5 to 5.',
    arc: 'Saga · Nation standing',
    status: 'reserved',
    note: 'No choice in the demo moves it.',
    setBy: [],
    readBy: [],
  },

  /* ------------------------------------------------- Rare discipline paths */
  {
    key: 'learned_lightning',
    type: 'boolean',
    values: [true],
    meaning: 'A teacher showed the party’s firebender lightning; opens the Lightning path.',
    arc: 'Saga · Disciplines',
    status: 'pending',
    note: 'Set by an Act 2 teacher scene (disciplines.ts); the demo ends before level 5.',
    setBy: [],
    readBy: ['discipline:lightning_path'],
  },
  {
    key: 'learned_healing',
    type: 'boolean',
    values: [true],
    meaning: 'A teacher showed the party’s waterbender healing; opens the Healing path.',
    arc: 'Saga · Disciplines',
    status: 'pending',
    note: 'Set by an Act 2 teacher scene (disciplines.ts); the demo ends before level 5.',
    setBy: [],
    readBy: ['discipline:healing_path'],
  },
  {
    key: 'learned_metalbending',
    type: 'boolean',
    values: [true],
    meaning: 'A teacher showed the party’s earthbender metal; opens the Metalbending path.',
    arc: 'Saga · Disciplines',
    status: 'pending',
    note: 'Set by an Act 2 teacher scene (disciplines.ts); the demo ends before level 5.',
    setBy: [],
    readBy: ['discipline:metalbending_path'],
  },
  {
    key: 'learned_soundbending',
    type: 'boolean',
    values: [true],
    meaning: 'A teacher showed the party’s airbender sound; opens the Sound Bending path.',
    arc: 'Saga · Disciplines',
    status: 'pending',
    note: 'Set by an Act 2 teacher scene (disciplines.ts); the demo ends before level 5.',
    setBy: [],
    readBy: ['discipline:sound_bending'],
  },
  {
    key: 'learned_engineering',
    type: 'boolean',
    values: [true],
    meaning: 'A mentor took on the party’s non-bender; opens the Engineering path.',
    arc: 'Saga · Disciplines',
    status: 'pending',
    note: 'Set by an Act 2 teacher scene (disciplines.ts); the demo ends before level 5.',
    setBy: [],
    readBy: ['discipline:engineering'],
  },

  /* ------------------------------------------- App-written guidance state */
  {
    key: 'guidance.firstFightEligible',
    type: 'boolean',
    values: [true],
    meaning: 'This is a genuinely new game, so the Forest Road may run the guided first fight.',
    arc: 'App · Guidance',
    status: 'live',
    oldSaves: GUIDED_FIGHT_IS_FOR_NEW_GAMES(['app:app/App'], ['app:app/scenes/combatGuidance']),
    setBy: ['app:app/App'],
    readBy: ['app:app/scenes/combatGuidance'],
  },
  {
    key: 'guidance.firstFightStage',
    type: ['number', 'string'],
    values: [0, 1, 2, 3, 'done'],
    meaning: 'How far the guided first fight has got: move, attack, end turn, then done.',
    arc: 'App · Guidance',
    status: 'live',
    oldSaves: GUIDED_FIGHT_IS_FOR_NEW_GAMES(
      ['app:app/scenes/combatGuidance', 'app:app/scenes/CombatScene'],
      ['app:app/scenes/combatGuidance'],
    ),
    note: 'Written by CombatScene through FIRST_FIGHT_GUIDANCE.stage; the literal lives in combatGuidance.',
    setBy: ['app:app/scenes/combatGuidance', 'app:app/scenes/CombatScene'],
    readBy: ['app:app/scenes/combatGuidance'],
  },
  {
    key: 'guidance.tip.*',
    type: 'boolean',
    values: [true],
    meaning:
      'A one-time combat tip (cover, prop, status, surface.<id>) has been shown, or a "stay safe" hint (defend.heal, defend.guard, defend.retreat) was dismissed.',
    arc: 'App · Guidance',
    status: 'live',
    oldSaves: {
      upTo: GOLDEN_V5,
      sites: ['app:app/scenes/CombatScene'],
      answer: 'unset',
      readers: ['app:app/scenes/CombatScene', 'app:app/scenes/combatGuidance'],
      why: 'Each tip shows once per save. An older save has seen none, so it is shown each tip the first time it applies.',
    },
    setBy: ['app:app/scenes/CombatScene'],
    readBy: ['app:app/scenes/CombatScene', 'app:app/scenes/combatGuidance'],
  },
];

/** Set and never read by a Condition, each with its reason in `note` (#493's allowlist). */
export const INFORMATIONAL_FLAGS: ReadonlySet<string> = new Set(
  FLAG_REGISTRY.filter((flag) => flag.status === 'informational').map((flag) => flag.key),
);

export const FLAG_BY_KEY: ReadonlyMap<string, FlagDef> = new Map(
  FLAG_REGISTRY.map((flag) => [flag.key, flag]),
);
