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

import type { ContentIndex, ElementId } from '../types';
import type { PartySlot } from '../state/createGame';
import { STANDARD_PARTY, runCombat, seedFor } from './runCombat';

export interface EncounterReport {
  readonly encounterId: string;
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
  const trials = options.trials ?? 40;
  const party = options.party ?? STANDARD_PARTY;
  const partyLevel = options.partyLevel ?? 7;

  const reports: DisciplineReport[] = [];

  for (const discipline of content.disciplines.values()) {
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

    reports.push({
      disciplineId: discipline.id,
      label: discipline.name,
      element: discipline.element,
      partyLevel,
      winRate: runs > 0 ? wins / runs : 0,
      averageRounds: runs > 0 ? rounds / runs : 0,
      averagePartyDeaths: runs > 0 ? deaths / runs : 0,
      averageHpRemaining: runs > 0 ? hp / runs : 0,
    });
  }

  return reports;
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
    let encounterWins = 0;
    let rounds = 0;
    let deaths = 0;
    let hp = 0;
    let stalemates = 0;

    for (let trial = 0; trial < trials; trial++) {
      const result = runCombat(content, {
        seed: seedFor(encounter.id, trial),
        encounterId: encounter.id,
        party,
        partyLevel: options.partyLevel ?? encounter.expectedLevel,
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
      label: encounter.name,
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

  return {
    encounters,
    overallWinRate: total > 0 ? wins / total : 0,
    // Repeated anomalies across trials say the same thing; report each once.
    anomalies: [...new Set(anomalies)],
    trials,
  };
}
