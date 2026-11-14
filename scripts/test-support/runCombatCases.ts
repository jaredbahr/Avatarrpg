import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { build } from 'esbuild';
import type { SimOptions, SimResult } from '../../src/core/sim/runCombat';

type CombatCase = Pick<SimOptions, 'seed' | 'encounterId' | 'party'>;
type IndexedCase = { index: number; options: CombatCase };
type CombatResult = Pick<
  SimResult,
  'anomalies' | 'outcome' | 'rounds' | 'partyHpRemaining' | 'partyHpTotal'
>;
type ResultRow = { index: number; result: CombatResult };

function startLane(source: string) {
  const worker = new Worker(source, { eval: true, execArgv: [] });
  let pending:
    { resolve: (rows: ResultRow[]) => void; reject: (error: unknown) => void } | undefined;
  let failure: Error | undefined;

  function fail(error: Error) {
    failure ??= error;
    pending?.reject(error);
    pending = undefined;
  }

  worker.on('error', fail);
  worker.on('messageerror', fail);
  worker.on('exit', (code) => fail(new Error(`Combat worker exited with code ${code}`)));
  worker.on('message', (rows: ResultRow[]) => {
    pending?.resolve(rows);
    pending = undefined;
  });

  return {
    run(cases: IndexedCase[]) {
      return new Promise<ResultRow[]>((resolve, reject) => {
        if (failure) throw failure;
        pending = { resolve, reject };
        worker.postMessage(cases);
      });
    },
    stop: () => worker.terminate(),
  };
}

export function createCombatCasePool() {
  const workers: ReturnType<typeof startLane>[] = [];
  let source: string | undefined;
  let stopping: Promise<number[]> | undefined;
  let running = false;

  function close() {
    if (stopping) return stopping;
    const current = workers.splice(0);
    stopping = Promise.all(current.map((worker) => worker.stop())).finally(() => {
      stopping = undefined;
    });
    return stopping;
  }

  async function run(cases: readonly CombatCase[], signal: AbortSignal): Promise<CombatResult[]> {
    signal.throwIfAborted();
    if (cases.length === 0) return [];
    if (running) throw new Error('Combat batches must run serially');
    running = true;
    const onAbort = () => void close().catch(() => undefined);
    signal.addEventListener('abort', onAbort, { once: true });
    try {
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
      signal.throwIfAborted();
      const count = Math.min(4, availableParallelism(), cases.length);
      while (workers.length < count) workers.push(startLane(source));
      const stripes = Array.from({ length: count }, () => [] as IndexedCase[]);
      for (const [index, options] of cases.entries()) {
        stripes[index % count]!.push({ index, options });
      }
      const rows = await Promise.all(stripes.map((stripe, lane) => workers[lane]!.run(stripe)));
      signal.throwIfAborted();
      const ordered = rows.flat().sort((a, b) => a.index - b.index);
      if (ordered.length !== cases.length || ordered.some((row, index) => row.index !== index)) {
        throw new Error('Incomplete combat results');
      }
      return ordered.map(({ result }) => result);
    } catch (error) {
      await close();
      signal.throwIfAborted();
      throw error;
    } finally {
      signal.removeEventListener('abort', onAbort);
      running = false;
    }
  }

  return { run, close };
}
