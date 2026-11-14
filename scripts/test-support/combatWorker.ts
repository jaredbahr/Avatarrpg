import { parentPort } from 'node:worker_threads';
import { CONTENT } from '../../src/content';
import { runCombat } from '../../src/core/sim/runCombat';
import type { CombatCase } from './runCombatCases';
import { verifyTurnCycle } from './turnCycle';

type IndexedCase = { index: number; options: CombatCase };

const port = parentPort!;
port.on('message', (cases: IndexedCase[]) => {
  const rows = cases.map(({ index, options }) => {
    const checked = options.checkTurnCycle ? verifyTurnCycle(CONTENT, options) : undefined;
    const { anomalies, outcome, rounds, partyHpRemaining, partyHpTotal } =
      checked?.result ?? runCombat(CONTENT, options);
    return {
      index,
      result: {
        anomalies,
        outcome,
        rounds,
        partyHpRemaining,
        partyHpTotal,
        ...(checked ? { turnCycle: checked.coverage } : {}),
      },
    };
  });
  port.postMessage(rows);
});
