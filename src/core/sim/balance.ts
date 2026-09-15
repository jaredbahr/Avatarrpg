/**
 * Balance report.
 *
 * Runs every encounter many times and reports the party win rate at the level
 * the slice expects. The target band is 70-85%: high enough that a family of
 * four does not get wiped on a Tuesday, low enough that the fights are real.
 *
 * Remember what this measures. Both sides are driven by the same AI, and the
 * AI does not spot the combos — it will not deliberately soak a target so the
 * firebender can chain lightning through the puddle. A human party plays
 * better than these numbers, so treat the band as a floor, not a target.
 */

import type { ContentIndex } from '../types';
import type { PartySlot } from '../state/createGame';
import { STANDARD_PARTY, runCombat, seedFor } from './runCombat';

export interface EncounterReport {
  readonly encounterId: string;
  /** Null for the authored roster; set when one variant was pinned. */
  readonly variantId: string | null;
  readonly label: string;
  readonly partyLevel: number;
  readonly winRate: number;
  readonly averageRounds: number;
  readonly averagePartyDeaths: number;
  /** Fraction of the party's total HP still standing at the end, on average. */
  readonly averageHpRemaining: number;
  readonly stalemates: number;
}

export interface BalanceReport {
  readonly encounters: readonly EncounterReport[];
  readonly overallWinRate: number;
  readonly anomalies: readonly string[];
  readonly trials: number;
}

export interface BalanceOptions {
  readonly trials?: number;
  readonly party?: readonly PartySlot[];
  /** Overrides each encounter's expected level, for a "what if" sweep. */
  readonly partyLevel?: number;
  /**
   * Report every roster variant separately instead of letting the seed draw.
   *
   * Without this, an encounter with variants samples whichever one each seed
   * happened to pick, the win rate becomes an average over rosters, and a
   * variant that is budget-legal but win-rate-illegal hides inside it. The
   * budget rule in validateContent proves variants cost the same; only this
   * proves they *play* the same.
   */
  readonly perVariant?: boolean;
}

/**
 * Party rosters at each supported table size, drawn from the same pool so the
 * comparison is about numbers rather than about which characters got picked.
 *
 * Measuring only at six players hides the case that actually matters: the
 * encounter rosters are authored for a small table and *scaled up*, so a
 * regression will usually show at one size and not the other.
 */
export function partyOfSize(size: number): PartySlot[] {
  const pool = ['bo', 'nilak', 'kaya', 'riko', 'nima', 'sura'];
  return pool.slice(0, Math.max(1, Math.min(pool.length, size))).map((characterId) => ({
    characterId,
  }));
}

export interface TableSizeReport {
  readonly size: number;
  readonly report: BalanceReport;
}

/** Runs the whole report at every table size the game supports. */
export function runTableSizeSweep(
  content: ContentIndex,
  sizes: readonly number[],
  options: BalanceOptions = {},
): TableSizeReport[] {
  return sizes.map((size) => ({
    size,
    report: runBalanceReport(content, { ...options, party: partyOfSize(size) }),
  }));
}

export function runBalanceReport(
  content: ContentIndex,
  options: BalanceOptions = {},
): BalanceReport {
  const trials = options.trials ?? 60;
  const party = options.party ?? STANDARD_PARTY;

  const encounters: EncounterReport[] = [];
  const anomalies: string[] = [];
  let wins = 0;
  let total = 0;

  for (const encounter of content.encounters.values()) {
    /*
     * One pass per variant when asked, otherwise a single unpinned pass.
     *
     * The authored roster gets its own pass whenever it can still spawn — which
     * is whenever every variant is conditional, since an encounter falls back to
     * what it was written as when none of them are eligible. Reporting only the
     * variants would have hidden the quarry gate's normal fight entirely behind
     * the one that needs a firebender to trigger it.
     */
    const baseCanSpawn =
      encounter.variants.length === 0 || encounter.variants.every((v) => v.when !== undefined);
    const passes: (string | null)[] = options.perVariant
      ? [...(baseCanSpawn ? [null] : []), ...encounter.variants.map((v) => v.id)]
      : [null];

    for (const variantId of passes) {
      let encounterWins = 0;
      let rounds = 0;
      let deaths = 0;
      let hp = 0;
      let stalemates = 0;

      for (let trial = 0; trial < trials; trial++) {
        const result = runCombat(content, {
          seed: seedFor(`${encounter.id}:${variantId ?? ''}`, trial),
          encounterId: encounter.id,
          party,
          partyLevel: options.partyLevel ?? encounter.expectedLevel,
          ...(variantId ? { variantId } : {}),
        });

        if (result.outcome === 'victory') encounterWins++;
        if (result.outcome === 'stalemate') stalemates++;
        rounds += result.rounds;
        deaths += result.partyDeaths;
        hp += result.partyHpTotal > 0 ? result.partyHpRemaining / result.partyHpTotal : 0;
        anomalies.push(...result.anomalies);
      }

      encounters.push({
        encounterId: encounter.id,
        variantId,
        label: variantId ? `${encounter.name} (${variantId})` : encounter.name,
        partyLevel: options.partyLevel ?? encounter.expectedLevel,
        winRate: encounterWins / trials,
        averageRounds: rounds / trials,
        averagePartyDeaths: deaths / trials,
        averageHpRemaining: hp / trials,
        stalemates,
      });

      wins += encounterWins;
      total += trials;
    }
  }

  return {
    encounters,
    overallWinRate: total > 0 ? wins / total : 0,
    // Repeated anomalies across trials say the same thing; report each once.
    anomalies: [...new Set(anomalies)],
    trials,
  };
}
