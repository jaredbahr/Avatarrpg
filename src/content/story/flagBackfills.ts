/**
 * How an older save answers a flag it passed without holding (#773).
 *
 * A save already past every scene that sets a flag can never come to hold it.
 * When content still ahead of such a save reads the flag, its answer has to be
 * declared here: a constant, or `value` (default `true`) when a `Condition`
 * over what that save does hold is met, and unset otherwise. `setters` are the
 * flag's `story:` setters from the registry (`flags.ts`); a rule applies on
 * load (`core/save/backfill.ts`) only once the save has visited one of them.
 *
 * `flagContinuity.test.ts` fails, naming the flag, its readers and the save,
 * when a frozen save meets a flag it can neither hold nor still set and that
 * has no rule here. `flagBackfills.test.ts` holds each rule to the registry.
 *
 * Kept apart from the registry so the app loads these few rules without the
 * whole registry.
 */

import type { FlagBackfillRule } from '../../core/save/backfill';

export const FLAG_BACKFILLS: readonly FlagBackfillRule[] = [
  {
    // A save that chose the escort holds `ruon_spared` and not this. It answers
    // by the scene it walked through: traded only if it saw `trade_chosen`.
    key: 'ruon_traded',
    setters: ['ruon_choice'],
    backfill: { when: { kind: 'visited', nodeId: 'trade_chosen' } },
  },
];
