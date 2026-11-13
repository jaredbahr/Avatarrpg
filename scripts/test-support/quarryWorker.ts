import { parentPort, workerData } from 'node:worker_threads';
import { CONTENT } from '../../src/content';
import { runCombat } from '../../src/core/sim/runCombat';
import type { SimOptions } from '../../src/core/sim/runCombat';

const cases = workerData as {
  index: number;
  options: Pick<SimOptions, 'seed' | 'encounterId' | 'party'>;
}[];
const rows = cases.map(({ index, options }) => {
  const { anomalies, outcome } = runCombat(CONTENT, options);
  return { index, result: { anomalies, outcome } };
});
parentPort!.postMessage(rows);
