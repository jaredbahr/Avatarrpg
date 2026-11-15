/**
 * Balance report.
 *
 * Runs every encounter many times and reports how the party fared at the level
 * the slice expects: the win rate, and the measures that still move when the
 * win rate is pinned at its ceiling (party HP left, rounds, party deaths).
 * Every trial's outcome is kept, so each number is derived from the same
 * trials and carries an interval (`stats.ts`); `npm run balance:check` compares
 * them with a committed baseline (ADR 0112).
 *
 * The 70-85% win-rate band this file used to state is not a gate. On Story
 * every fight wins every simulated trial, and whether that is the target is an
 * open decision for the owner (#777).
 *
 * Remember what this measures. Both sides are driven by the same AI, and the
 * AI does not spot the combos — it will not deliberately soak a target so the
 * firebender can chain lightning through the puddle. A human party plays
 * better than these numbers, so treat them as a floor.
 */

import type { ContentIndex, Difficulty, DisciplineDef, ElementId, EncounterDef } from '../types';
import type { PartySlot } from '../state/createGame';
import { STANDARD_PARTY, runCombat, seedFor } from './runCombat';
import type { SimOutcome } from './runCombat';
import { meanStats, quantile, wilsonInterval } from './stats';
import type { Interval, MeanStats } from './stats';

/** What one simulated fight contributes to a row. Nothing else is summed. */
export interface TrialSample {
  readonly outcome: SimOutcome;
  readonly rounds: number;
  readonly partyDeaths: number;
  /** Fraction of the party's total HP still standing at the end (0 to 1). */
  readonly hpLeft: number;
}

/**
 * A row's measures, each derived from the same trials.
 *
 * Rates carry a 95% Wilson interval; means carry their standard error, from
 * which the report prints mean ± 1.96 · se. The two tail measures show danger
 * a mean hides: how often anybody went down, and the fight on a bad night.
 */
export interface RowSummary {
  readonly trials: number;
  readonly wins: number;
  readonly winRate: number;
  readonly winInterval: Interval;
  readonly hpLeft: MeanStats;
  readonly rounds: MeanStats;
  readonly deaths: MeanStats;
  /** Trials in which at least one party member was down at the end. */
  readonly trialsWithDeath: number;
  readonly deathRateInterval: Interval;
  /** 10th percentile of HP left: nine fights in ten end better than this. */
  readonly hpLeftP10: number;
  readonly stalemates: number;
}

export function summariseTrials(samples: readonly TrialSample[]): RowSummary {
  const trials = samples.length;
  const wins = samples.filter((sample) => sample.outcome === 'victory').length;
  const trialsWithDeath = samples.filter((sample) => sample.partyDeaths > 0).length;
  const hp = samples.map((sample) => sample.hpLeft);
  return {
    trials,
    wins,
    winRate: trials > 0 ? wins / trials : 0,
    winInterval: wilsonInterval(wins, trials),
    hpLeft: meanStats(hp),
    rounds: meanStats(samples.map((sample) => sample.rounds)),
    deaths: meanStats(samples.map((sample) => sample.partyDeaths)),
    trialsWithDeath,
    deathRateInterval: wilsonInterval(trialsWithDeath, trials),
    hpLeftP10: quantile(hp, 0.1),
    stalemates: samples.filter((sample) => sample.outcome === 'stalemate').length,
  };
}

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
  /** Every trial, in seed order: the data the fields above and `summary` come from. */
  readonly samples: readonly TrialSample[];
  readonly summary: RowSummary;
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
  /** The difficulty every trial plays at. Unset is the default, Story. */
  readonly difficulty?: Difficulty;
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

/* ------------------------------------------------------------------ */
/* Discipline sweep                                                     */
/* ------------------------------------------------------------------ */

export interface DisciplineReport {
  readonly disciplineId: string;
  readonly label: string;
  readonly element: ElementId;
  readonly partyLevel: number;
  readonly winRate: number;
  readonly averageRounds: number;
  readonly averagePartyDeaths: number;
  readonly averageHpRemaining: number;
}

/** The path a party falls back to: an element's one ungated discipline. */
export function defaultDisciplineFor(
  content: ContentIndex,
  element: ElementId,
): string | undefined {
  for (const discipline of content.disciplines.values()) {
    if (discipline.element === element && discipline.requiresFlag === null) return discipline.id;
  }
  return undefined;
}

/**
 * Builds a party in which everyone of `discipline`'s element has taken it and
 * everybody else is on their element's default path. One variable at a time,
 * so a win rate that moves can be blamed on one discipline.
 */
export function partyOnDiscipline(
  content: ContentIndex,
  party: readonly PartySlot[],
  disciplineId: string,
): PartySlot[] {
  const subject = content.disciplines.get(disciplineId);
  return party.map((slot) => {
    const element = content.characters.get(slot.characterId)?.element;
    if (!element) return slot;
    const chosen =
      subject && element === subject.element
        ? disciplineId
        : defaultDisciplineFor(content, element);
    return chosen ? { ...slot, discipline: chosen } : slot;
  });
}

/**
 * Win rate per discipline, above the gate.
 *
 * Act 1's encounters are all tuned for level 3 or below, so the ordinary report
 * never sees a discipline at all — this forces both sides to a level past the
 * gate and swaps one path at a time. What it prints is a *shape* check (is one
 * path miles ahead of the others?), not a statement about a fight anybody can
 * currently reach: these are Act 1 rosters stretched to a level they were never
 * written for.
 *
 * Read the spread, not the rows. At the default trial count one run is worth
 * roughly three points, so anything under about ten points apart is noise. The
 * first real measurement will come from Act 2 encounters actually tuned for
 * level 5+; until those exist this is a tripwire for a path that is obviously
 * broken, nothing finer.
 */
export function runDisciplineSweep(
  content: ContentIndex,
  options: BalanceOptions = {},
): DisciplineReport[] {
  return [...content.disciplines.values()].map((discipline) =>
    runDisciplineRow(content, discipline, options),
  );
}

/** One discipline's line of the sweep: every encounter, `trials` times each. */
export function runDisciplineRow(
  content: ContentIndex,
  discipline: DisciplineDef,
  options: BalanceOptions = {},
): DisciplineReport {
  const trials = options.trials ?? 40;
  const party = options.party ?? STANDARD_PARTY;
  const partyLevel = options.partyLevel ?? 7;
  const roster = partyOnDiscipline(content, party, discipline.id);

  let wins = 0;
  let runs = 0;
  let rounds = 0;
  let deaths = 0;
  let hp = 0;

  for (const encounter of content.encounters.values()) {
    for (let trial = 0; trial < trials; trial++) {
      const result = runCombat(content, {
        seed: seedFor(`${discipline.id}:${encounter.id}`, trial),
        encounterId: encounter.id,
        party: roster,
        partyLevel,
        // Level the opposition with the party, or a level 7 party walks
        // through fights tuned for level 3 and every path reports 100%.
        enemyLevel: partyLevel,
      });
      if (result.outcome === 'victory') wins++;
      rounds += result.rounds;
      deaths += result.partyDeaths;
      hp += result.partyHpTotal > 0 ? result.partyHpRemaining / result.partyHpTotal : 0;
      runs++;
    }
  }

  return {
    disciplineId: discipline.id,
    label: discipline.name,
    element: discipline.element,
    partyLevel,
    winRate: runs > 0 ? wins / runs : 0,
    averageRounds: runs > 0 ? rounds / runs : 0,
    averagePartyDeaths: runs > 0 ? deaths / runs : 0,
    averageHpRemaining: runs > 0 ? hp / runs : 0,
  };
}

/**
 * The passes an encounter gets: one per variant when asked, otherwise a single
 * unpinned pass (null).
 *
 * The authored roster gets its own pass whenever it can still spawn — which
 * is whenever every variant is conditional, since an encounter falls back to
 * what it was written as when none of them are eligible. Reporting only the
 * variants would have hidden the quarry gate's normal fight entirely behind
 * the one that needs a firebender to trigger it.
 */
export function encounterPasses(encounter: EncounterDef, perVariant: boolean): (string | null)[] {
  if (!perVariant) return [null];
  const baseCanSpawn =
    encounter.variants.length === 0 || encounter.variants.every((v) => v.when !== undefined);
  return [...(baseCanSpawn ? [null] : []), ...encounter.variants.map((v) => v.id)];
}

/**
 * One row of the report: one encounter, one pass, `trials` fights.
 *
 * A trial's seed depends only on the encounter, the pass and the trial number,
 * so a longer run extends a shorter one rather than replacing it, and rows can
 * be computed in any order (or in parallel) with the same result.
 */
export function runEncounterRow(
  content: ContentIndex,
  encounter: EncounterDef,
  variantId: string | null,
  options: BalanceOptions = {},
): { readonly row: EncounterReport; readonly anomalies: readonly string[] } {
  const trials = options.trials ?? 60;
  const party = options.party ?? STANDARD_PARTY;
  const partyLevel = options.partyLevel ?? encounter.expectedLevel;
  const samples: TrialSample[] = [];
  const anomalies: string[] = [];
  let rounds = 0;
  let deaths = 0;
  let hp = 0;

  for (let trial = 0; trial < trials; trial++) {
    const result = runCombat(content, {
      seed: seedFor(`${encounter.id}:${variantId ?? ''}`, trial),
      encounterId: encounter.id,
      party,
      partyLevel,
      ...(variantId ? { variantId } : {}),
      ...(options.difficulty ? { difficulty: options.difficulty } : {}),
    });
    const hpLeft = result.partyHpTotal > 0 ? result.partyHpRemaining / result.partyHpTotal : 0;
    samples.push({
      outcome: result.outcome,
      rounds: result.rounds,
      partyDeaths: result.partyDeaths,
      hpLeft,
    });
    rounds += result.rounds;
    deaths += result.partyDeaths;
    hp += hpLeft;
    anomalies.push(...result.anomalies);
  }

  const summary = summariseTrials(samples);
  return {
    row: {
      encounterId: encounter.id,
      variantId,
      label: variantId ? `${encounter.name} (${variantId})` : encounter.name,
      partyLevel,
      winRate: summary.wins / trials,
      averageRounds: rounds / trials,
      averagePartyDeaths: deaths / trials,
      averageHpRemaining: hp / trials,
      stalemates: summary.stalemates,
      samples,
      summary,
    },
    anomalies,
  };
}

export function runBalanceReport(
  content: ContentIndex,
  options: BalanceOptions = {},
): BalanceReport {
  const trials = options.trials ?? 60;

  const encounters: EncounterReport[] = [];
  const anomalies: string[] = [];
  let wins = 0;
  let total = 0;

  for (const encounter of content.encounters.values()) {
    for (const variantId of encounterPasses(encounter, options.perVariant ?? false)) {
      const result = runEncounterRow(content, encounter, variantId, { ...options, trials });
      encounters.push(result.row);
      anomalies.push(...result.anomalies);
      wins += result.row.summary.wins;
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
