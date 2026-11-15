/**
 * Runs the balance sweep's rows on worker threads.
 *
 * The sweep is a list of independent rows (one encounter, one roster, one table
 * size, one difficulty), each some hundred fights. A row's result depends only
 * on its own seeds, so the lanes share nothing and the output is the same at
 * any lane count; only the wall time changes.
 */
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import type { DisciplineReport, EncounterReport } from '../../src/core/sim/balance';
import type { CombatTuning, Difficulty } from '../../src/core/types';

export type SweepJob =
  | {
      readonly kind: 'row';
      readonly difficulty: Difficulty;
      readonly size: number;
      readonly encounterId: string;
      readonly variantId: string | null;
      readonly trials: number;
    }
  | {
      readonly kind: 'discipline';
      readonly disciplineId: string;
      readonly trials: number;
      readonly partyLevel: number;
    };

export type SweepJobResult =
  | { readonly kind: 'row'; readonly row: EncounterReport; readonly anomalies: readonly string[] }
  | { readonly kind: 'discipline'; readonly report: DisciplineReport };

/** BALANCE_WORKERS overrides the lane count; the default leaves no core idle up to four. */
export function laneCount(): number {
  const asked = Number(process.env.BALANCE_WORKERS);
  if (Number.isInteger(asked) && asked > 0) return asked;
  return Math.min(4, availableParallelism());
}

/**
 * Runs every job and returns the results in the order the jobs were given.
 * `tuning` is the `BALANCE_TUNING` overlay, if any: plain data, so each lane
 * can lay it over its own copy of the content.
 */
export async function runSweepJobs(
  jobs: readonly SweepJob[],
  tuning: CombatTuning | null,
  lanes: number = laneCount(),
): Promise<SweepJobResult[]> {
  const results = new Array<SweepJobResult | undefined>(jobs.length);
  // Longest first (a six-player fight costs many times a solo one), so the
  // lanes finish together instead of one being left with the big rows.
  const weight = (job: SweepJob | undefined): number =>
    !job ? 0 : job.kind === 'discipline' ? 7 * job.trials : job.size * job.trials;
  const order = jobs.map((_, index) => index).sort((a, b) => weight(jobs[b]) - weight(jobs[a]));
  let next = 0;

  const lane = () =>
    new Promise<void>((resolve, reject) => {
      // The worker inherits this process's `--import tsx`, so it loads TypeScript too.
      const worker = new Worker(new URL('./worker.ts', import.meta.url), {
        workerData: { tuning },
      });
      let current = -1;
      const dispatch = () => {
        current = order[next++] ?? -1;
        const job = jobs[current];
        if (!job) {
          void worker.terminate().then(() => resolve());
          return;
        }
        worker.postMessage(job);
      };
      worker.on('message', (result: SweepJobResult) => {
        results[current] = result;
        dispatch();
      });
      worker.on('error', reject);
      worker.on('messageerror', reject);
      dispatch();
    });

  await Promise.all(Array.from({ length: Math.max(1, Math.min(lanes, jobs.length)) }, lane));

  return results.map((result, index) => {
    if (!result) throw new Error(`Balance job ${index} did not finish`);
    return result;
  });
}
