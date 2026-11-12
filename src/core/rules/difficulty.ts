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
 *
 * The one thing players do choose is the difficulty (ADR 0110): Story, the
 * authored tuning, or Hard. It lives here too, as one profile layered over the
 * table scaling, so this file stays the only place a fight's numbers move.
 */

import type { Difficulty, UnitStats } from '../types';

/** What a new game, and a save from before the setting existed, plays at. */
export const DEFAULT_DIFFICULTY: Difficulty = 'story';

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
 *
 * 1.4 -> 1.3 pays back what capping the bandits' club and sling at 2 AP took
 * off the quarry floor, which was not the direction anyone expected. Weaker
 * trash made that fight *harder*: the party AI scores a target by what it can
 * do to you, so a bandit that can no longer swing four times a turn drops down
 * the list, the quarry bender behind it lives about a quarter of a round
 * longer, and its damage onto the party went 42.5 to 54.2 a fight. Six players
 * measured 74.3% before the cap and 66.3% after, at n=1200 either side — three
 * standard errors apart, not sampling noise.
 *
 * It is an artifact of the simulator's AI rather than a fact about human play:
 * a table clears the trash whether or not it has been graded as scary. But the
 * band is measured with this AI, so the number has to be honest against it.
 * Swept at n=1200: 1.4 -> 66.3%, 1.35 -> 70.9%, 1.3 -> 73.6%, 1.25 -> 76.8%.
 * 1.3 puts the fight back where it was (73.6% against 74.3%) rather than
 * quietly making the Act 1 boss easier than it has always been.
 *
 * Only tables *above* the baseline feel this: at the baseline the ratio is 1,
 * and below it the result clamps to MIN_SCALE at either exponent.
 */
export const BOSS_SCALE_EXPONENT = 1.3;

export interface ScaleContext {
  readonly baselinePartySize: number;
  readonly partySize: number;
  /** Bosses grow with the table because a second one cannot be added. */
  readonly isBoss: boolean;
  /** The table's chosen difficulty. Absent means the default. */
  readonly difficulty?: Difficulty;
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

/**
 * What a boss loses per party member below the baseline, besides health
 * (ADR 0110).
 *
 * Health alone could not make a one-hero Driller winnable. Its HP already
 * clamps to half (40), and a lone hero still lost because the rest of the
 * stat block was built for three: five AP is a slam and a churn between two of
 * that hero's turns, and its earth armour (6 at level 3) against fire on a
 * boss standing in its own mud left Kaya hitting for 1 to 4. Measured solo at
 * 30 trials, Kaya won 7%, Tenzo and Nima 0%, Jinu 77%.
 *
 * Swept: one AP alone moved nobody; one or two defense a step left Kaya at
 * 17% and Nima at 13%; three defense and one AP put every hero in the roster
 * at 87% or better, in three to five rounds. Trash never loses AP or armour:
 * it already leaves the field one for one. At the baseline and above nothing
 * here applies.
 */
export const UNDER_STRENGTH_BOSS_AP = 1;
export const UNDER_STRENGTH_BOSS_DEFENSE = 3;

/** A boss always keeps enough AP for one real attack and a step. */
export const MIN_BOSS_AP = 3;

/**
 * What each difficulty does on top of the table scaling (ADR 0110).
 *
 * Story is the authored tuning, unchanged. Hard makes every enemy hit harder
 * and act more, and last a little longer. It is a layer over the table
 * scaling, not a replacement: a Hard boss still grows with the table and a
 * small Hard table is still thinned, so Hard means the same thing at every
 * size. Nothing in it is per encounter or per enemy.
 *
 * Damage and actions, not health, because the fights must stay short. Health
 * was the first lever tried and the wrong one: 1.25x HP, 1.4x boss HP and +1
 * power still won 99.6% at three players and stretched the Driller back to
 * 8.6 rounds (28 turns), the length #659 had just cut. Building the roster for
 * one more player than the table (a reinforcement and a bigger boss) was worse
 * still: 100% and up to 35 turns. Power and AP move the win rate without
 * moving the clock. Swept at three players, 20 trials per fight (overall win,
 * Driller rounds): +3 power, +2 AP 98%, 6.5; 1.1x HP, +5 power, +2 AP 94%, 7.1;
 * 1.1x HP, 1.2x boss HP, +6 power, +2 AP 90%, 7.9; 1.15x HP, +6 power, +2 AP
 * 86%, 8.2. The middle is shipped; `BALANCE_DIFFICULTY=hard npm run balance`
 * prints it.
 */
export interface DifficultyProfile {
  /** Multiplies every enemy's max HP after the table scaling. */
  readonly hp: number;
  /** Multiplies a boss's max HP after the table scaling, instead of `hp`. */
  readonly bossHp: number;
  /** Added to every enemy's power. */
  readonly power: number;
  /** Added to every enemy's max AP. */
  readonly ap: number;
}

export const DIFFICULTY_PROFILES: Readonly<Record<Difficulty, DifficultyProfile>> = {
  story: { hp: 1, bossHp: 1, power: 0, ap: 0 },
  hard: { hp: 1.1, bossHp: 1.2, power: 5, ap: 2 },
};

/** Max AP for an enemy at this table and difficulty: a boss loses some below the baseline. */
export function enemyApFor(maxAp: number, ctx: ScaleContext): number {
  const profile = DIFFICULTY_PROFILES[ctx.difficulty ?? DEFAULT_DIFFICULTY];
  const authored = maxAp + profile.ap;
  if (!ctx.isBoss) return authored;
  const under = Math.max(0, ctx.baselinePartySize - ctx.partySize);
  if (under === 0) return authored;
  return Math.max(Math.min(authored, MIN_BOSS_AP), authored - UNDER_STRENGTH_BOSS_AP * under);
}

/**
 * Applies the table scaling and the difficulty to a stat block.
 *
 * HP scales with the table for everyone; a boss below the baseline also loses
 * AP and defense. The difficulty layers on top. At Story, at the baseline, the
 * stat block comes back untouched (the same object).
 */
export function scaleForTable(stats: UnitStats, ctx: ScaleContext): UnitStats {
  const profile = DIFFICULTY_PROFILES[ctx.difficulty ?? DEFAULT_DIFFICULTY];
  const scale = enemyHpScale(ctx) * (ctx.isBoss ? profile.bossHp : profile.hp);
  const maxAp = enemyApFor(stats.maxAp, ctx);
  const power = stats.power + profile.power;
  const under = Math.max(0, ctx.baselinePartySize - ctx.partySize);
  const defense = ctx.isBoss
    ? Math.max(0, stats.defense - UNDER_STRENGTH_BOSS_DEFENSE * under)
    : stats.defense;
  if (scale === 1 && maxAp === stats.maxAp && power === stats.power && defense === stats.defense)
    return stats;
  return { ...stats, maxHp: Math.max(1, Math.round(stats.maxHp * scale)), maxAp, power, defense };
}
