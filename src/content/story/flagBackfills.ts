/**
 * How an older save answers history the story started recording after it was
 * written (#773, ADR 0112).
 *
 * When a flag that something reads gains a write in a region a release has
 * already shipped, saves of that release may be past the scene and can never
 * come to hold the flag. Where the save's own history shows what the answer
 * is, declare it here: `when` is a `Condition` over what that save does hold (a
 * visited node, an older flag), and `set` (or `adjust`, for a standing key) is
 * what it is given on load (`core/save/backfill.ts`). A rule with `node`
 * instead of `key` counts a scene as visited, for a scene added to a road the
 * save has already walked (`LATE_SCENES` in `flags.ts`).
 *
 * `rev` is the history revision the rule introduces: the next whole number.
 * Add rules at the end and never edit one that a release has shipped; a save
 * loaded since then has already been given its answer. Every save file records
 * the revision of the build that wrote it, so a rule reaches each older save
 * exactly once and never a save played on content that sets the flag itself.
 *
 * The flag's registry entry (`flags.ts`) points here with
 * `oldSaves: { answer: 'backfill' }`, a scene's `LATE_SCENES` entry likewise. `saveHistory.test.ts` holds the rules to
 * the registry and to every release snapshot, and proves each one reaches the
 * frozen saves it was written for.
 *
 * Kept apart from the registry so the app ships these few rules without it.
 *
 * Example, for a flag `gao_ledger_returned` now set in `sq03_return`, an old
 * `flags` node:
 *
 *   { rev: 1, key: 'gao_ledger_returned', when: { kind: 'visited', nodeId: 'sq03_return' }, set: true }
 */

import { historyRevOf } from '../../core/save/backfill';
import type { BackfillRule } from '../../core/save/backfill';

export const FLAG_BACKFILLS: readonly BackfillRule[] = [
  {
    // SQ-01 begins when Pella hands over Bo-shan's packing list, a scene spliced after
    // `pella_asked`. A save from before it existed that she has already asked can never be handed
    // the list, so the sled would never appear for it. Only while the side story is still open:
    // after the rescue the list has nothing left to do.
    rev: 1,
    node: 'sq01_packing_list',
    when: {
      kind: 'all',
      of: [
        { kind: 'flag', key: 'pella_asked', op: 'set' },
        { kind: 'flag', key: 'act1_complete', op: 'unset' },
      ],
    },
  },
];

/** What a save written by this build records as its history revision. */
export const HISTORY_REV = historyRevOf(FLAG_BACKFILLS);
