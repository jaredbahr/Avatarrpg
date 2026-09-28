/**
 * Balance report. Runs every Act 1 encounter headlessly, many times, with the
 * enemy AI driving both sides, and prints the party win rate at the level the
 * slice expects the party to be. Target band is 70-85%.
 *
 *   npm run balance
 *
 * CI runs this for the printed report; the hard assertions live in
 * `src/core/sim/runCombat.test.ts` so a regression fails the test suite too.
 *
 * BALANCE_TUNING=/path/to/tuning.json overlays a *partial* combat tuning block
 * on the authored one, so a variant can be A/B tested without a code edit:
 *
 *   BALANCE_TUNING=variant.json npm run balance
 *
 * The file is checked against the same zod schema as `src/content/tuning.ts`,
 * so a typo fails here instead of quietly simulating something else.
 */
import { readFileSync } from 'node:fs';
import { CONTENT } from '../src/content';
import { combatTuningOverrideSchema, combatTuningSchema } from '../src/content/tuning';
import { runDisciplineSweep, runTableSizeSweep } from '../src/core/sim/balance';
import type { ContentIndex } from '../src/core/types';

/** The override file's JSON, or a readable exit when it cannot be read. */
function readTuningFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(`Could not read tuning override ${path}:`, error);
    process.exit(1);
  }
}

/** The authored content, with any `BALANCE_TUNING` overlay applied on top. */
function withTuningOverride(base: ContentIndex, path: string | undefined): ContentIndex {
  if (!path) return base;

  const override = combatTuningOverrideSchema.safeParse(readTuningFile(path));
  if (!override.success) {
    console.error(`Invalid tuning override ${path}:`);
    for (const issue of override.error.issues) {
      console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    process.exit(1);
  }

  const merged = combatTuningSchema.safeParse({ ...base.tuning, ...override.data });
  if (!merged.success) {
    console.error(`Tuning override ${path} produces an invalid block:`);
    for (const issue of merged.error.issues) {
      console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    process.exit(1);
  }

  console.log(`Tuning override: ${path}`);
  return { ...base, tuning: merged.data };
}

const content = withTuningOverride(CONTENT, process.env.BALANCE_TUNING);

const trials = Number(process.env.BALANCE_TRIALS ?? 80);
const sizes = (process.env.BALANCE_SIZES ?? '1,3,6').split(',').map(Number);
/*
 * BALANCE_VARIANTS=1 reports every roster variant on its own line instead of
 * averaging over whichever ones the seeds happened to draw. The budget rule in
 * validateContent proves variants *cost* the same; this is the only thing that
 * proves they *play* the same.
 */
const perVariant = process.env.BALANCE_VARIANTS === '1';
const sweep = runTableSizeSweep(content, sizes, { trials, perVariant });

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
const paths = runDisciplineSweep(content, {
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
