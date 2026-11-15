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
import { writerPlaceholder } from './placeholders';
import { WINCH_BRAKE_CELLS } from './maps';

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
      label: writerPlaceholder('Stop the winch'),
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
    tip: writerPlaceholder(
      'Stand at the winch brake when a round ends, before the crate reaches the barge.',
    ),
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
];
