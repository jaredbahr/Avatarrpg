/**
 * Balance report. Runs every Act 1 encounter headlessly, many times, with the
 * enemy AI driving both sides, and prints the party win rate at the level the
 * slice expects the party to be. Target band is 70-85%.
 *
 *   npm run balance
 *
 * CI runs this for the printed report; the hard assertions live in
 * `src/core/sim/runCombat.test.ts` so a regression fails the test suite too.
 */
import { CONTENT } from '../src/content';
import { runDisciplineSweep, runTableSizeSweep } from '../src/core/sim/balance';

const trials = Number(process.env.BALANCE_TRIALS ?? 80);
const sizes = (process.env.BALANCE_SIZES ?? '1,3,6').split(',').map(Number);
/*
 * BALANCE_VARIANTS=1 reports every roster variant on its own line instead of
 * averaging over whichever ones the seeds happened to draw. The budget rule in
 * validateContent proves variants *cost* the same; this is the only thing that
 * proves they *play* the same.
 */
const perVariant = process.env.BALANCE_VARIANTS === '1';
const sweep = runTableSizeSweep(CONTENT, sizes, { trials, perVariant });

const pad = (s: string, n: number) => s.padEnd(n);
const num = (n: number, w: number) => n.toFixed(1).padStart(w);

console.log(`\nBalance report - ${trials} AI-vs-AI trials per encounter, per table size\n`);

const anomalies: string[] = [];

for (const { size, report } of sweep) {
  console.log(`--- ${size} player${size === 1 ? '' : 's'} ---`);
  console.log(
    `${pad('Encounter', 36)}${pad('Lv', 5)}${pad('Win %', 8)}${pad('Rounds', 9)}${pad('Deaths', 8)}HP left`,
  );
  for (const row of report.encounters) {
    console.log(
      `${pad(row.label, 36)}${pad(String(row.partyLevel), 5)}` +
        `${num(row.winRate * 100, 5)}   ${num(row.averageRounds, 6)}   ` +
        `${num(row.averagePartyDeaths, 5)}   ${num(row.averageHpRemaining * 100, 5)}%`,
    );
  }
  console.log(`  overall: ${(report.overallWinRate * 100).toFixed(1)}%\n`);
  anomalies.push(...report.anomalies);
}

console.log('Target band for a full table is 70-85%. Both sides are driven by the');
console.log('same AI, which does not set up combos, so treat these as a floor.');
if (!perVariant) {
  console.log('Set BALANCE_VARIANTS=1 to report each roster variant separately.');
}
console.log('');

/*
 * Discipline sweep. Every Act 1 encounter is tuned for level 3 or below, so the
 * table above never sees a path at all — this forces a level past the gate and
 * swaps one discipline at a time. Read it for spread, not for absolute numbers:
 * these are fights nobody can currently reach at this level.
 */
const disciplineLevel = Number(process.env.BALANCE_DISCIPLINE_LEVEL ?? 7);
const disciplineTrials = Number(process.env.BALANCE_DISCIPLINE_TRIALS ?? 30);
const paths = runDisciplineSweep(CONTENT, {
  trials: disciplineTrials,
  partyLevel: disciplineLevel,
});

console.log(
  `--- disciplines, six players at level ${disciplineLevel}, ${disciplineTrials} trials per encounter ---`,
);
console.log(`${pad('Path', 20)}${pad('Element', 12)}${pad('Win %', 8)}${pad('Rounds', 9)}Deaths`);
for (const row of [...paths].sort((a, b) => b.winRate - a.winRate)) {
  console.log(
    `${pad(row.label, 20)}${pad(row.element, 12)}` +
      `${num(row.winRate * 100, 5)}   ${num(row.averageRounds, 6)}   ${num(row.averagePartyDeaths, 5)}`,
  );
}

const spread = Math.max(...paths.map((p) => p.winRate)) - Math.min(...paths.map((p) => p.winRate));
console.log(`  spread: ${(spread * 100).toFixed(1)} points between the best and worst path\n`);

if (anomalies.length > 0) {
  console.error('Anomalies detected:');
  for (const a of [...new Set(anomalies)]) console.error(`  - ${a}`);
  process.exit(1);
}
