import { partyOfSize } from '../../src/core/sim/balance';
import {
  DEFAULT_MAX_ROUNDS,
  SimCommandError,
  runCombat,
  seedFor,
} from '../../src/core/sim/runCombat';
import type { SimOptions, SimResult } from '../../src/core/sim/runCombat';
import type { ContentIndex, Unit } from '../../src/core/types';

export const DEFAULT_SOAK_TRIALS = 200;
export const SOAK_SIZES = [1, 2, 3, 4, 5, 6] as const;
export const MAX_ROUNDS_RATE = 0.01;
export const MAX_IDLE_EXAMPLES_PER_CELL = 20;

export interface ReplayCase {
  readonly encounterId: string;
  readonly variantId: string | null;
  readonly partySize: number;
  readonly trial: number;
  readonly seed: number | string;
  /** Zero-based apply command index; setup exceptions use -1 and stage 'setup'. */
  readonly commandIndex: number;
}

export interface SoakFailure extends ReplayCase {
  readonly kind: 'throw' | 'variant' | 'diagnostics' | 'anomaly';
  readonly stage: 'setup' | 'command' | 'result';
  readonly message: string;
}

export interface IdleExample extends ReplayCase {
  readonly round: number;
  readonly unitId: string;
  readonly faction: Unit['faction'];
}

export interface RoundSummary {
  /** Null when every attempt threw, rather than reporting invented zero rounds. */
  readonly medianRounds: number | null;
  readonly maxRounds: number | null;
}

export interface SoakCounts extends RoundSummary {
  readonly attempted: number;
  readonly completed: number;
  readonly throws: number;
  readonly maxRoundsReached: number;
  readonly maxRoundsRate: number;
  readonly idleTurns: number;
  readonly failures: number;
  readonly passed: boolean;
}

export interface SoakRow extends SoakCounts {
  readonly encounterId: string;
  readonly variantId: string | null;
  readonly partySize: number;
  readonly partyLevel: number;
  readonly party: readonly string[];
  readonly idleExamples: readonly IdleExample[];
}

export interface SoakReport {
  readonly trials: number;
  readonly roundCap: number;
  readonly maxAllowedRoundsRate: number;
  readonly sizes: readonly number[];
  readonly rows: readonly SoakRow[];
  readonly summary: SoakCounts;
  readonly failures: readonly SoakFailure[];
  readonly maxRoundsCases: readonly ReplayCase[];
  readonly violations: readonly string[];
}

export function readSoakTrials(value: string | undefined): number {
  if (value === undefined) return DEFAULT_SOAK_TRIALS;
  const trials = Number(value);
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(trials)) {
    throw new Error('SOAK_TRIALS must be a positive safe integer');
  }
  return trials;
}

function roundSummary(rounds: readonly number[]): RoundSummary {
  if (rounds.length === 0) return { medianRounds: null, maxRounds: null };
  const sorted = [...rounds].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  const lower = sorted[middle - 1];
  return {
    medianRounds:
      sorted.length % 2 === 0 && lower !== undefined && upper !== undefined
        ? (lower + upper) / 2
        : (upper ?? null),
    maxRounds: sorted[sorted.length - 1] ?? null,
  };
}

/**
 * Uses the balance runner's roster passes, parties, levels, seeds and round cap.
 * The injected runner lets the report's failure handling be tested without
 * changing game rules or needing a real combat bug to exercise an error path.
 */
export function runSoakReport(
  content: ContentIndex,
  options: { readonly trials?: number; readonly onRow?: (row: SoakRow) => void } = {},
  simulate: (content: ContentIndex, options: SimOptions) => SimResult = runCombat,
): SoakReport {
  const trials = options.trials ?? DEFAULT_SOAK_TRIALS;
  if (!Number.isSafeInteger(trials) || trials < 1) {
    throw new Error('Soak trials must be a positive safe integer');
  }

  const rows: SoakRow[] = [];
  const failures: SoakFailure[] = [];
  const maxRoundsCases: ReplayCase[] = [];
  const allRounds: number[] = [];
  const violations: string[] = [];

  for (const partySize of SOAK_SIZES) {
    const party = partyOfSize(partySize);
    for (const encounter of content.encounters.values()) {
      const baseCanSpawn =
        encounter.variants.length === 0 ||
        encounter.variants.every((variant) => variant.when !== undefined);
      const variants: (string | null)[] = [
        ...(baseCanSpawn ? [null] : []),
        ...encounter.variants.map((variant) => variant.id),
      ];

      for (const variantId of variants) {
        const rounds: number[] = [];
        const idleExamples: IdleExample[] = [];
        const firstFailure = failures.length;
        let throws = 0;
        let maxRoundsReached = 0;
        let idleTurns = 0;

        for (let trial = 0; trial < trials; trial++) {
          const seed = seedFor(`${encounter.id}:${variantId ?? ''}`, trial);
          const context = { encounterId: encounter.id, variantId, partySize, trial, seed };
          let result: SimResult;
          try {
            result = simulate(content, {
              seed,
              encounterId: encounter.id,
              party,
              partyLevel: encounter.expectedLevel,
              maxRounds: DEFAULT_MAX_ROUNDS,
              diagnostics: true,
              ...(variantId ? { variantId } : {}),
            });
          } catch (error) {
            throws++;
            failures.push({
              ...context,
              commandIndex: error instanceof SimCommandError ? error.commandIndex : -1,
              stage: error instanceof SimCommandError ? 'command' : 'setup',
              kind: 'throw',
              message: error instanceof Error ? error.message : String(error),
            });
            continue;
          }

          rounds.push(result.rounds);
          allRounds.push(result.rounds);
          const diagnostics = result.diagnostics;
          const commandIndex = (diagnostics?.commandCount ?? result.turns) - 1;
          const finalContext = { ...context, commandIndex };
          if (result.variantId !== variantId) {
            failures.push({
              ...finalContext,
              stage: 'result',
              kind: 'variant',
              message: `Expected roster ${variantId ?? '(authored)'}, got ${result.variantId ?? '(authored)'}`,
            });
          }
          if (!diagnostics) {
            failures.push({
              ...finalContext,
              stage: 'result',
              kind: 'diagnostics',
              message: 'Simulation returned no diagnostics',
            });
          } else {
            if (diagnostics.maxRoundsReached) {
              maxRoundsReached++;
              maxRoundsCases.push(finalContext);
            }
            idleTurns += diagnostics.idleTurns.length;
            for (const idle of diagnostics.idleTurns) {
              if (idleExamples.length >= MAX_IDLE_EXAMPLES_PER_CELL) break;
              idleExamples.push({ ...context, ...idle });
            }
          }

          for (const anomaly of result.anomalies) {
            // The existing runner emits this same message for cap exhaustion.
            // Its gate is the unchanged >1% rate, not an accidental zero cap gate.
            if (
              diagnostics?.maxRoundsReached &&
              anomaly ===
                `encounter ${encounter.id} did not finish within ${DEFAULT_MAX_ROUNDS} rounds`
            ) {
              continue;
            }
            failures.push({
              ...finalContext,
              stage: 'result',
              kind: 'anomaly',
              message: anomaly,
            });
          }
          if (result.outcome === 'stalemate' && !diagnostics?.maxRoundsReached) {
            failures.push({
              ...finalContext,
              stage: 'result',
              kind: 'anomaly',
              message: 'Simulation stalemated before reaching the round cap',
            });
          }
        }

        const failureCount = failures.length - firstFailure;
        const overCapRate = maxRoundsReached / trials > MAX_ROUNDS_RATE;
        const label = `${encounter.id}/${variantId ?? '(authored)'}/${partySize}`;
        if (failureCount > 0) violations.push(`${label}: ${failureCount} failure(s)`);
        if (overCapRate) {
          violations.push(
            `${label}: ${maxRoundsReached}/${trials} fights exceeded the round cap (>1%)`,
          );
        }
        const row: SoakRow = {
          encounterId: encounter.id,
          variantId,
          partySize,
          partyLevel: encounter.expectedLevel,
          party: party.map((slot) => slot.characterId),
          attempted: trials,
          completed: rounds.length,
          throws,
          maxRoundsReached,
          maxRoundsRate: maxRoundsReached / trials,
          idleTurns,
          idleExamples,
          failures: failureCount,
          passed: failureCount === 0 && !overCapRate,
          ...roundSummary(rounds),
        };
        rows.push(row);
        options.onRow?.(row);
      }
    }
  }

  const attempted = rows.reduce((sum, row) => sum + row.attempted, 0);
  return {
    trials,
    roundCap: DEFAULT_MAX_ROUNDS,
    maxAllowedRoundsRate: MAX_ROUNDS_RATE,
    sizes: SOAK_SIZES,
    rows,
    summary: {
      attempted,
      completed: allRounds.length,
      throws: rows.reduce((sum, row) => sum + row.throws, 0),
      maxRoundsReached: maxRoundsCases.length,
      maxRoundsRate: attempted > 0 ? maxRoundsCases.length / attempted : 0,
      idleTurns: rows.reduce((sum, row) => sum + row.idleTurns, 0),
      failures: failures.length,
      passed: violations.length === 0 && attempted > 0,
      ...roundSummary(allRounds),
    },
    failures,
    maxRoundsCases,
    violations,
  };
}
