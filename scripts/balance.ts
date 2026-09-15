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
import { runTableSizeSweep } from '../src/core/sim/balance';

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

if (anomalies.length > 0) {
  console.error('Anomalies detected:');
  for (const a of [...new Set(anomalies)]) console.error(`  - ${a}`);
  process.exit(1);
}
