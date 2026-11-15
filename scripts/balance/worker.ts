/**
 * One lane of the balance sweep. It loads the content once, then answers one
 * job at a time. Every trial's seed comes from its row and trial number, so
 * which lane ran a row, and in what order, cannot change a result.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { CONTENT } from '../../src/content';
import { partyOfSize, runDisciplineRow, runEncounterRow } from '../../src/core/sim/balance';
import type { CombatTuning, ContentIndex } from '../../src/core/types';
import type { SweepJob, SweepJobResult } from './pool';

const { tuning } = workerData as { tuning: CombatTuning | null };
const content: ContentIndex = tuning ? { ...CONTENT, tuning } : CONTENT;

function run(job: SweepJob): SweepJobResult {
  if (job.kind === 'discipline') {
    const discipline = content.disciplines.get(job.disciplineId);
    if (!discipline) throw new Error(`Unknown discipline "${job.disciplineId}"`);
    return {
      kind: 'discipline',
      report: runDisciplineRow(content, discipline, {
        trials: job.trials,
        partyLevel: job.partyLevel,
      }),
    };
  }
  const encounter = content.encounters.get(job.encounterId);
  if (!encounter) throw new Error(`Unknown encounter "${job.encounterId}"`);
  const { row, anomalies } = runEncounterRow(content, encounter, job.variantId, {
    trials: job.trials,
    party: partyOfSize(job.size),
    difficulty: job.difficulty,
  });
  return { kind: 'row', row, anomalies: [...new Set(anomalies)] };
}

const port = parentPort;
if (!port) throw new Error('The balance worker must run as a worker thread');
port.on('message', (job: SweepJob) => port.postMessage(run(job)));
