/**
 * Saltstep and Emberwatch's fights (RG-02, the trial slice).
 *
 * - `enc_mq02_winch` (Scene 2.5, main line): the freight handlers on the pontoon, with Veyra fighting
 *   beside the party as an AI guest (ADR 0116). Won by holding the winch brake at a round's end or
 *   by defeating the handlers; lost if the crate reaches the barge (six rounds).
 * - `enc_sf21_wet_ground` (SF-2.1, optional): Sabi's riggers in the power yard. It pays its XP on a
 *   win and on "Carry on" alike.
 *
 * Both are tuned for level 4, where every Act I route ends (570 XP; `progression.test.ts`), inside
 * the region's placeholder band. Neither has been through the balance simulator's sweep yet.
 */
import type { EncounterDef, EncounterPlacement } from '../../../core/types';
import { WINCH_BRAKE_CELLS } from './maps';
import { SF22_XP_PER_HEAD } from './sf22';
import { SF23_XP_PER_HEAD } from './sf23';

const at = (x: number, y: number, enemyId: string): EncounterPlacement => ({
  enemyId,
  pos: { x, y },
});

export const SALTSTEP_EMBERWATCH_ENCOUNTERS: readonly EncounterDef[] = [
  {
    id: 'enc_mq02_winch',
    name: 'The Sling',
    mapId: 'saltstep_pontoon',
    expectedLevel: 4,
    /*
     * The handlers hold the gangway and the winch: one stands on the brake itself, (12, 4), so the
     * party has to shift or drop it before anyone can take the brake (Veyra's Shield Bash pushes),
     * one beside it, and three behind on the platform (tuned 2026-11-15: a first-time table
     * usually wins, holding the brake around rounds 3 to 5).
     */
    enemies: [
      at(12, 4, 'freight_handler'),
      at(12, 5, 'freight_handler'),
      at(13, 4, 'freight_handler'),
      at(14, 5, 'freight_handler'),
      at(16, 6, 'freight_handler'),
    ],
    allies: [],
    /*
     * Veyra (AN-01): an AI guest, as the script says, built from her placeholder enemy record
     * (`veyra_guest` in `enemies.ts`) at the party's level, tagged "Guest" in the HUD like any
     * guest (ADR 0116). She starts with the party at the west end of the deck. "Veyra cannot be
     * lost": `loseIfGuestFalls` stays unset, so a fallen guest stays down and the fight goes on.
     */
    guests: [{ enemyId: 'veyra_guest', pos: { x: 2, y: 5 }, level: { partyOffset: 0 } }],
    /*
     * The script's other win and its other loss (ADR 0116, objective fights, #827): a party member
     * or Veyra standing at the winch brake when a round ends stops the winch and wins; not won by
     * the end of round six, the crate reaches the barge and the fight is lost. Defeating the
     * handlers still wins too.
     */
    objective: {
      kind: 'holdAtRoundEnd',
      cells: WINCH_BRAKE_CELLS,
      label: 'Stop the winch at the brake',
    },
    loseAfterRound: 6,
    conditionalEnemies: [],
    // Three heroes and Veyra: a guest counts as a friendly body in the roster scaling (ADR 0116).
    baselinePartySize: 4,
    /*
     * One more handler for a table of five or six. Kept to one so the fight stays below the
     * largest roster in the game (the ambush), which `scripts/perf/core-bench.ts` measures.
     */
    reinforcements: [at(14, 6, 'freight_handler')],
    variants: [],
    intro:
      'Across the pontoon, the freight handlers have the tenth crate in a crane sling. It swings out over the water. One strap is already fraying.',
    tip: 'The winch brake is on the gangway, and a handler is standing on it. Veyra can shove him off. Have a hero or Veyra on the brake when a round ends and the winch stops. You have six rounds before the crate reaches the barge. Defeating every handler wins too.',
  },
  {
    id: 'enc_sf21_wet_ground',
    name: 'Wet Ground',
    mapId: 'emberwatch_power_yard',
    expectedLevel: 4,
    enemies: [
      at(14, 3, 'line_rigger'),
      at(15, 6, 'line_rigger'),
      at(14, 8, 'line_rigger'),
      at(16, 10, 'line_rigger'),
    ],
    allies: [],
    conditionalEnemies: [],
    baselinePartySize: 3,
    reinforcements: [at(13, 2, 'line_rigger'), at(16, 9, 'line_rigger'), at(13, 10, 'line_rigger')],
    variants: [],
    intro:
      'The rain cistern has overflowed across the yard, and Luli’s live line runs along one side of it.',
    // The combo's first hint (the script: "something in this yard reacts to water"; #622).
    tip: 'Something in this yard reacts to water.',
  },
  {
    /*
     * SF-2.2, the tipping platform (optional; ADR 0122, `docs/places/saltstep_platform.md`): a
     * friendly bout. 0 HP or a shove into the harbour is out, nobody is helped up, and the deck
     * tips toward the heavier half at each round's end (the seam is column 7). A token 15 XP a head,
     * won or carried on (owner, 2026-11-19): every other side fight played, a table ends the slice
     * on 983 XP, and RG-02's band stops at level 5 (1,000).
     */
    id: 'enc_sf22_platform',
    name: 'The tipping platform',
    mapId: 'saltstep_platform',
    expectedLevel: 4,
    xpPerHead: SF22_XP_PER_HEAD,
    enemies: [at(9, 4, 'ferry_apprentice'), at(9, 6, 'ferry_apprentice'), at(9, 5, 'channel_hand')],
    allies: [],
    conditionalEnemies: [],
    baselinePartySize: 3,
    // One more each side per extra hero, so the halves start even and nothing tips at once.
    reinforcements: [
      at(10, 5, 'channel_hand'),
      at(10, 3, 'ferry_apprentice'),
      at(10, 7, 'channel_hand'),
    ],
    variants: [],
    bout: { outOn: ['water_deep'], tipping: { axis: 'x', pivot: 7 } },
    // Hard keeps +3 power and no extra AP here, as at Edge-on: the shared profile's +2 AP is two more
    // shoves a turn, which on a deck this size decides the bout in a round.
    hard: { power: 3, ap: 0 },
    intro:
      'The midday lull. The spare platform rides loose on its moorings, and it leans toward whoever stands on it. Half the market has found a reason to be near the rail.',
    tip: 'A shove toward the water leaves a fighter teetering on the edge. Shove them again after their turn and they are in, and out of the bout. If you are the one teetering, step back from the edge. Blue squares show where the deck will tip when the round ends.',
  },
  {
    /*
     * SF-2.3, the bridge toll (optional; `docs/places/river_road.md`, "Fight needs (SF-2.3)"), on a 19 by 12 crop of
     * the river road round the bridge (`river_road_bridge`). The guards hold the bridge, a two-wide choke, with a
     * crossbow back in the camp behind its crates; the corporal stands by the cold fire. The party comes from the west
     * bank and can flank by the ford. A table of three meets the corporal and three guards; a table of six meets the
     * script's corporal and six. A token 15 XP a head, won or carried on, as SF-2.2's.
     */
    id: 'enc_sf23_bridge_toll',
    name: 'The bridge toll',
    mapId: 'river_road_bridge',
    expectedLevel: 4,
    xpPerHead: SF23_XP_PER_HEAD,
    enemies: [
      at(8, 5, 'toll_guard'),
      at(8, 6, 'toll_guard'),
      at(10, 2, 'toll_crossbow'),
      at(14, 3, 'toll_corporal'),
    ],
    allies: [],
    conditionalEnemies: [],
    baselinePartySize: 3,
    reinforcements: [at(9, 4, 'toll_guard'), at(14, 2, 'toll_crossbow'), at(11, 7, 'toll_guard')],
    variants: [],
    intro: 'PLACEHOLDER (story): the pole across the bridge, the guards behind it.',
    tip: 'The guards hold the bridge. The stream is shallow at the ford, downstream: cross there to come at them from the side. The corporal’s Rally makes a guard hit harder, so reach him early.',
  },
];
