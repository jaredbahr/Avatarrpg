import { parentPort } from 'node:worker_threads';
import { CONTENT } from '../../src/content';
import { runCombat } from '../../src/core/sim/runCombat';
import type { SimOptions } from '../../src/core/sim/runCombat';

type IndexedCase = { index: number; options: Pick<SimOptions, 'seed' | 'encounterId' | 'party'> };

const port = parentPort!;
port.on('message', (cases: IndexedCase[]) => {
  const rows = cases.map(({ index, options }) => {
    const { anomalies, outcome, rounds, partyHpRemaining, partyHpTotal } = runCombat(
      CONTENT,
      options,
    );
    return { index, result: { anomalies, outcome, rounds, partyHpRemaining, partyHpTotal } };
  });
  port.postMessage(rows);
});
