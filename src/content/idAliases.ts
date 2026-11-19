/**
 * Retired content ids and what replaced them (`src/core/save/aliases.ts`).
 *
 * Every id a save can hold is in `ids.ledger.json` for good. To rename or
 * remove one, keep the ledger as it is and add a row here: the retired id on
 * the left, a live id of the same kind on the right. A loaded save is
 * rewritten through this table before anything else reads it, so a family's
 * old campaign carries on where it stopped.
 *
 * NPCs and triggers are keyed `<map id>:<id>`. Renaming a map moves its NPCs
 * and triggers with it; no row is needed for them unless their own ids change.
 *
 * `savedIds.test.ts` holds this table to the ledger and the content: every
 * target exists, no row shadows a live id, and no chain loops.
 */
import type { IdAliases } from '../core/save/aliases';

export const ID_ALIASES: IdAliases = {
  story: {
    // MQ-02's hero chains folded onto the plain ones; the hero's lines now follow a `branchWhen`.
    mq02_coast_road_jinu: 'mq02_coast_road',
    mq02_coast_dorin_jinu: 'mq02_coast_dorin',
    mq02_coast_receipt_jinu: 'mq02_coast_receipt',
    mq02_coast_dorin_receipt_jinu: 'mq02_coast_dorin_receipt',
    mq02_bowl_seller_tenzo: 'mq02_bowl_seller',
    mq02_bowl_set_down_tenzo: 'mq02_bowl_set_down',
    mq02_bowl_custom_tenzo: 'mq02_bowl_custom',
    mq02_bowl_who_tenzo: 'mq02_bowl_who',
    mq02_bowl_pump_woman_tenzo: 'mq02_bowl_pump_woman',
    mq02_miri_crates_kaya: 'mq02_miri_crates',
  },
};
