/**
 * Turn hand-off, shared by the reducer's action tail and save reconciliation.
 *
 * Moves the turn pointer on, runs round upkeep when it wraps, and starts the
 * next unit's turn — skipping anyone who is Frozen or Stunned, which can chain
 * through several units in a row. It lives outside the reducer so a loaded save
 * whose pointer is stuck on a dead unit (F1) advances through the exact same
 * upkeep/skip path instead of a second, drifting copy.
 */

import { advanceTurn, battleOutcome } from '../rules/turnOrder';
import { isAlive } from '../rules/stats';
import type { BattleDraft } from './battleDraft';

export function advanceToNextTurn(draft: BattleDraft): void {
  for (let guard = 0; guard <= draft.order.length + 1; guard++) {
    const advance = advanceTurn(draft.toBattle());
    draft.turnIndex = advance.turnIndex;

    if (advance.roundAdvanced) {
      draft.round = advance.round;
      draft.expireWalls();
      draft.tickTerrain();
      draft.emit({ type: 'roundStarted', round: draft.round });
    }

    if (!advance.unitId) return;
    if (battleOutcome(draft.toBattle()) !== 'active') return;

    const skipped = draft.beginTurn(advance.unitId);
    const unit = draft.unit(advance.unitId);

    // Upkeep can kill (Burning, standing in fire) — move straight on if so.
    if (!unit || !isAlive(unit)) continue;

    if (skipped) {
      draft.message(`${unit.name} cannot act this turn.`);
      draft.emit({ type: 'turnEnded', unitId: unit.id });
      continue;
    }

    draft.emit({ type: 'turnStarted', unitId: advance.unitId, round: draft.round });
    return;
  }
}
