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
  'Saga · Nation standing',
  'Saga · Disciplines',
  'App · Guidance',
] as const;
export type FlagArc = (typeof FLAG_ARCS)[number];

export type FlagType = 'boolean' | 'number' | 'string';

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
}

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
      'story:welcome_home_mira',
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
    readBy: ['story:after_forest'],
  },
  {
    key: 'world.ducks_seen',
    type: 'boolean',
    values: [true],
    meaning: 'The party met Dema and her displaced turtle-ducks on the Forest Road.',
    arc: 'Demo · Forest Road',
    status: 'live',
    setBy: ['story:forest_ducks_seen'],
    readBy: ['map:forest_road', 'story:demo_complete', 'journal:ducks'],
  },
  {
    key: 'world.discovered.duck_nest',
    type: 'boolean',
    values: [true],
    meaning: 'The party found the turtle-duck nest in the woollen sock.',
    arc: 'Demo · Forest Road',
    status: 'live',
    setBy: ['story:remember_duck_nest'],
    readBy: ['map:forest_road', 'journal:duck_nest'],
  },
  {
    key: 'world.discovered.runoff_marker',
    type: 'boolean',
    values: [true],
    meaning: 'The party read the silted flood marker that asks if the settling pit is blocked.',
    arc: 'Demo · Forest Road',
    status: 'live',
    setBy: ['story:remember_runoff_marker'],
    readBy: ['map:forest_road', 'journal:runoff_marker'],
  },

  /* -------------------------------------------------------- Quarry gate */
  {
    key: 'gate_fire_bluff',
    type: 'boolean',
    values: [true],
    meaning: 'A firebender bluffed the Fire Nation deserter aside at the quarry gate.',
    arc: 'Demo · Quarry gate',
    status: 'live',
    setBy: ['story:gate_bluff'],
    readBy: ['encounter:enc_quarry_gate', 'story:welcome_home_dorin', 'story:demo_complete'],
  },
  {
    key: 'gate_talked_through',
    type: 'boolean',
    values: [true],
    meaning: 'An earthbender talked Captain Ruon into opening the gate; no gate fight.',
    arc: 'Demo · Quarry gate',
    status: 'live',
    setBy: ['story:gate_talked_through'],
    readBy: ['story:welcome_home_dorin', 'story:demo_complete'],
  },
  {
    key: 'ruon_respects_you',
    type: 'boolean',
    values: [true],
    meaning: 'Ruon opened the gate to the party’s earthbender as one stoneworker to another.',
    arc: 'Demo · Quarry gate',
    status: 'informational',
    note: 'Set alongside gate_talked_through. Nothing reads it yet; a later act with Ruon should.',
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
      'story:demo_complete',
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
      'story:plant_chair',
      'story:plant_chair_decline_home',
      'story:plant_chair_decline_road',
      'story:sq03_hook',
      'story:sq03_jar',
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
    meaning: 'Jin’s mercenaries beat the party in the Cutting (escort branch only).',
    arc: 'Demo · The Cutting',
    status: 'informational',
    note: 'Unlike the other losses, no line or recap reads it yet; ruon_carried_you carries the story.',
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
    key: 'world.tea_shared',
    type: 'boolean',
    values: [true],
    meaning: 'The party sat and shared Sen’s tea at the workers’ rest stop.',
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
    meaning: 'The party lost to the Driller: the quarry keeps running and the act ends there.',
    arc: 'Demo · Quarry floor',
    status: 'live',
    setBy: ['story:act1_lost'],
    readBy: ['resident:lw.npc.mira', 'resident:lw.npc.gao'],
  },

  /* ----------------------------------------------------------- Riverside */
  {
    key: 'riverside_shrine_found',
    type: 'boolean',
    values: [true],
    meaning: 'The party found the riverside shrine (“The river belongs to everyone downstream”).',
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
    setBy: ['story:sq01_choice'],
    readBy: [
      'map:ba_dan_village',
      'map:forest_road',
      'story:demo_complete',
      'story:pella_home',
      'story:sq01_sled_again',
      'story:sq01_pella_list',
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
    setBy: ['story:sq03_choice'],
    readBy: ['map:ba_dan_village', 'story:demo_complete', 'story:sq03_jar', 'story:sq03_jar_label'],
  },

  /* ----------------------------------------------- Nation standing (reserved prefix) */
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
    status: 'pending',
    note: 'Raised by the firebender’s bluff at the gate. No Condition reads standing yet.',
    setBy: ['story:gate_parley'],
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
    note: 'Written by CombatScene through FIRST_FIGHT_GUIDANCE.stage; the literal lives in combatGuidance.',
    setBy: ['app:app/scenes/combatGuidance', 'app:app/scenes/CombatScene'],
    readBy: ['app:app/scenes/combatGuidance'],
  },
  {
    key: 'guidance.tip.*',
    type: 'boolean',
    values: [true],
    meaning: 'A one-time combat tip (cover, prop, status, surface.<id>) has been shown.',
    arc: 'App · Guidance',
    status: 'live',
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
