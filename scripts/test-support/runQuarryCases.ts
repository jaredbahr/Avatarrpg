import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { build } from 'esbuild';
import type { SimOptions, SimResult } from '../../src/core/sim/runCombat';

type QuarryCase = Pick<SimOptions, 'seed' | 'encounterId' | 'party'>;
type QuarryResult = Pick<SimResult, 'anomalies' | 'outcome'>;
type ResultRow = { index: number; result: QuarryResult };

export async function runQuarryCases(
  cases: readonly QuarryCase[],
  signal: AbortSignal,
): Promise<QuarryResult[]> {
  signal.throwIfAborted();
  const entry = fileURLToPath(new URL('./quarryWorker.ts', import.meta.url));
  const bundle = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    sourcemap: 'inline',
  });
  const source = bundle.outputFiles[0]!.text;
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
      () => [] as { index: number; options: QuarryCase }[],
    );
    for (const [index, options] of cases.entries()) {
      const seedMajorIndex = (index % 8) * (cases.length / 8) + Math.floor(index / 8);
      stripes[seedMajorIndex % count]!.push({ index, options });
    }
    const rows = await Promise.all(
      stripes.map(
        (stripe) =>
          new Promise<ResultRow[]>((resolve, reject) => {
            const worker = new Worker(source, { eval: true, execArgv: [], workerData: stripe });
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
                reject(new Error(`Quarry worker exited with code ${code} or incomplete results`));
            });
          }),
      ),
    );
    signal.throwIfAborted();
    const ordered = rows.flat().sort((a, b) => a.index - b.index);
    if (ordered.length !== cases.length || ordered.some((row, index) => row.index !== index)) {
      throw new Error('Incomplete quarry results');
    }
    return ordered.map(({ result }) => result);
  } finally {
    signal.removeEventListener('abort', onAbort);
    await stop();
  }
}
