/**
 * Saltstep and Emberwatch's fights (RG-02, the trial slice).
 *
 * - `enc_mq02_winch` (Scene 2.5, main line): the freight handlers on the pontoon, with Veyra fighting
 *   beside the party as an AI guest (ADR 0116). Today it is won by defeating the handlers; the
 *   script's other win, stopping the winch, waits for the objective rule (below).
 * - `enc_sf21_wet_ground` (SF-2.1, optional): Sabi's riggers in the power yard. It pays its XP on a
 *   win and on "Carry on" alike.
 *
 * Both are tuned for level 4, where every Act I route ends (570 XP; `progression.test.ts`), inside
 * the region's placeholder band. Neither has been through the balance simulator's sweep yet.
 */
import type { EncounterDef, EncounterPlacement } from '../../../core/types';
import { writerPlaceholder } from './placeholders';

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
    enemies: [
      at(16, 5, 'freight_handler'),
      at(16, 6, 'freight_handler'),
      at(15, 2, 'freight_handler'),
    ],
    /*
     * Veyra (AN-01): an AI guest, as the script says, built from her placeholder enemy record
     * (`veyra_guest` in `enemies.ts`). ADR 0116's `allies` shorthand: an `ai` guest built from an
     * enemy at the encounter's level (4, the level every Act I route ends on), tagged "Guest" in
     * the HUD like any guest. "Veyra cannot be lost": `loseIfGuestFalls` stays unset, so a fallen
     * guest stays down and the fight goes on.
     *
     * Not `guests: [{ enemyId: 'veyra_guest', pos, level: { partyOffset: 0 } }]`, the form the
     * brief asked for: `src/core/state/encounterSpawns.test.ts` counts only `allies` as the
     * party's side, so the first shipped `guests` entry fails it, and `src/core/` is not this
     * trial's to change (`docs/pipeline-trial-log.md`, friction). Swap back once that test reads
     * guests too.
     */
    allies: [at(5, 5, 'veyra_guest')],
    /*
     * TODO(objective-hold): the script's other win, "a party member or Veyra stands at the winch
     * brake at the end of a round", and its other loss, "the crate reaches the barge" in six
     * rounds, plug in here once `EncounterDef.objective` lands (ADR 0116's next change, PR
     * branch `claude/objective-hold`):
     *
     *   objective: {
     *     kind: 'holdAtRoundEnd',
     *     cells: WINCH_BRAKE_CELLS, // (13, 4), in `maps.ts`
     *     byRound: 6,
     *     label: <the writing pass's top-bar line>,
     *   },
     */
    conditionalEnemies: [],
    // Three heroes and Veyra: a guest counts as a friendly body in the roster scaling (ADR 0116).
    baselinePartySize: 4,
    reinforcements: [
      at(17, 5, 'freight_handler'),
      at(16, 8, 'freight_handler'),
      at(17, 6, 'freight_handler'),
    ],
    variants: [],
    intro:
      'Across the pontoon, the freight handlers have the tenth crate in a crane sling. It swings out over the water. One strap is already fraying.',
    tip: writerPlaceholder('Stop the handlers before the crate reaches the barge.'),
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
