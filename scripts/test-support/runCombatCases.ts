import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { build } from 'esbuild';
import type { SimOptions, SimResult } from '../../src/core/sim/runCombat';

type CombatCase = Pick<SimOptions, 'seed' | 'encounterId' | 'party'>;
type CombatResult = Pick<
  SimResult,
  'anomalies' | 'outcome' | 'rounds' | 'partyHpRemaining' | 'partyHpTotal'
>;
type ResultRow = { index: number; result: CombatResult };

let source: string | undefined;

export async function runCombatCases(
  cases: readonly CombatCase[],
  signal: AbortSignal,
): Promise<CombatResult[]> {
  signal.throwIfAborted();
  if (cases.length === 0) return [];
  if (source === undefined) {
    const entry = fileURLToPath(new URL('./combatWorker.ts', import.meta.url));
    const bundle = await build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      platform: 'node',
      target: 'node22',
      format: 'cjs',
      sourcemap: 'inline',
    });
    source = bundle.outputFiles[0]!.text;
  }
  const workerSource = source;
  const count = Math.min(4, availableParallelism(), cases.length);
  const workers: Worker[] = [];
  let stopping: Promise<number[]> | undefined;
  const stop = () => (stopping ??= Promise.all(workers.map((worker) => worker.terminate())));
  const onAbort = () => void stop().catch(() => undefined);
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    signal.throwIfAborted();
    const stripes = Array.from(
      { length: count },
      () => [] as { index: number; options: CombatCase }[],
    );
    for (const [index, options] of cases.entries()) {
      stripes[index % count]!.push({ index, options });
    }
    const rows = await Promise.all(
      stripes.map(
        (stripe) =>
          new Promise<ResultRow[]>((resolve, reject) => {
            const worker = new Worker(workerSource, {
              eval: true,
              execArgv: [],
              workerData: stripe,
            });
            workers.push(worker);
            let result: ResultRow[] | undefined;
            worker.once('message', (message: ResultRow[]) => {
              result = message;
            });
            worker.once('error', reject);
            worker.once('messageerror', reject);
            worker.once('exit', (code) => {
              if (code === 0 && result?.length === stripe.length) resolve(result);
              else
                reject(new Error(`Combat worker exited with code ${code} or incomplete results`));
            });
          }),
      ),
    );
    signal.throwIfAborted();
    const ordered = rows.flat().sort((a, b) => a.index - b.index);
    if (ordered.length !== cases.length || ordered.some((row, index) => row.index !== index)) {
      throw new Error('Incomplete combat results');
    }
    return ordered.map(({ result }) => result);
  } finally {
    signal.removeEventListener('abort', onAbort);
    await stop();
  }
}
