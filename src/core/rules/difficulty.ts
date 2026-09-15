/**
 * Scaling a fight to the table.
 *
 * Encounters are authored for `baselinePartySize`. Two levers adjust them:
 *
 *  1. **Reinforcements** add bodies above the baseline. Visible, fair, and the
 *     right answer for trash — six players against three bandits is a queue.
 *  2. **This file** adjusts enemy durability, which covers the two cases
 *     reinforcements cannot:
 *       - *Below* the baseline, there is nothing to remove without deleting
 *         the encounter's teaching (the deserter *is* the oil lesson), so the
 *         enemies present get thinner instead.
 *       - A boss cannot be duplicated, so it grows with the table instead.
 *
 * The simulator is why both exist. Measured across table sizes, the boss went
 * from a 35% win rate at three players to 98% at six — the trash scaled and
 * the boss did not, so the fight got easier the more people turned up. Solo
 * play sat at 0% on two encounters, which is not "hard mode", it is a wall.
 *
 * None of this is shown to players. It is the difference between a fight being
 * fair at your table and being a formality or a brick wall.
 */

import type { UnitStats } from '../types';

/** Durability lost per party member below the encounter's baseline. */
export const UNDER_STRENGTH_STEP = 0.15;

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 3;

/**
 * Bosses scale faster than linearly with the table. Doubling the party does
 * more than double its effective output: everyone focuses the same target
 * while the boss can still only answer one or two of them per turn. Measured
 * at a straight ratio the boss sat at 63% against three players and 93%
 * against six.
 */
export const BOSS_SCALE_EXPONENT = 1.4;

export interface ScaleContext {
  readonly baselinePartySize: number;
  readonly partySize: number;
  /** Bosses grow with the table because a second one cannot be added. */
  readonly isBoss: boolean;
}

/**
 * Multiplier applied to an enemy's max HP for this table. 1 means unchanged.
 *
 * A boss scales *proportionally* rather than in small steps, because what it
 * is really scaling against is the table's action economy: six players get
 * twice the AP per round that three do, so a boss facing six needs roughly
 * twice the health bar to last the same number of rounds. A flat per-player
 * bonus measured 35% at three players and 93% at six — the fight got easier
 * the more people showed up.
 */
export function enemyHpScale(ctx: ScaleContext): number {
  const baseline = Math.max(1, ctx.baselinePartySize);

  if (ctx.isBoss) {
    const ratio = (ctx.partySize / baseline) ** BOSS_SCALE_EXPONENT;
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, ratio));
  }

  const under = Math.max(0, baseline - ctx.partySize);
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, 1 - UNDER_STRENGTH_STEP * under));
}

/**
 * How many authored enemies to leave out for an under-strength table.
 *
 * Thinner enemies alone are not enough below the baseline: a solo player
 * against three bandits is outnumbered three to one on actions, and measured
 * 0% on two encounters. One enemy leaves per missing party member, from the
 * *end* of the authored list — encounters are written with their teaching
 * enemy first (the deserter *is* the oil lesson), so the last ones listed are
 * the ones that can go. At least one always remains.
 *
 * One-for-one keeps the curve monotone. A coarser step (one per two missing)
 * measured *worse* at two players than at one, because a solo table crossed
 * the threshold and a pair did not.
 */
export function enemiesToDrop(baselinePartySize: number, partySize: number): number {
  return Math.max(0, baselinePartySize - partySize);
}

/** Applies the table scaling to a stat block. Only HP moves; damage does not. */
export function scaleForTable(stats: UnitStats, ctx: ScaleContext): UnitStats {
  const scale = enemyHpScale(ctx);
  if (scale === 1) return stats;
  return { ...stats, maxHp: Math.max(1, Math.round(stats.maxHp * scale)) };
}
