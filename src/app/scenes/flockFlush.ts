import type { BattleState } from '../../core/types';

/** The curtain has lifted and the opening beat is up before the birds go. */
export const FLUSH_DELAY_MS = 700;

/**
 * When the scene's birds burst out of the trees: armed once, as a fresh fight
 * (round 1, first turn) is first in view of the player whose fight it is, so a
 * hot seat's hand-off card does not hide it. A save loaded mid-fight stays quiet.
 */
export function flushTime(
  flushedAt: number | null,
  battle: Pick<BattleState, 'round' | 'turnIndex'>,
  handoff: boolean,
  now: number,
): number | null {
  return flushedAt === null && battle.round === 1 && battle.turnIndex === 0 && !handoff
    ? now + FLUSH_DELAY_MS
    : flushedAt;
}
