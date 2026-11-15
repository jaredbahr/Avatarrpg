/**
 * Balance report. Runs every Act 1 encounter headlessly, many times, with the
 * enemy AI driving both sides, at the level the slice expects the party to be,
 * on every difficulty (Story and Hard, ADR 0110).
 *
 *   npm run balance            the report, at the settings in the environment
 *   npm run balance:check      the tripwire: a fixed sweep against the baseline
 *   npm run balance:baseline   rewrite the baseline (a deliberate act)
 *
 * Each row prints the win rate with a 95% Wilson interval, then party HP left,
 * rounds and party deaths as mean ± 1.96 standard errors, the share of trials
 * that ended with somebody down, and the 10th percentile of HP left. On Story
 * every row wins every trial, so the win rate cannot show a change; the other
 * measures can. The old "70-85%" win-rate band is not a gate, and whether it
 * still applies is an open decision (#777).
 *
 * The report reads BALANCE_TRIALS (80), BALANCE_SIZES (1,3,6), BALANCE_VARIANTS=1
 * (one row per roster variant), BALANCE_DIFFICULTY (story or hard; both when
 * unset), BALANCE_WORKERS (lanes; up to four by default) and, for the
 * discipline sweep, BALANCE_DISCIPLINE_TRIALS and BALANCE_DISCIPLINE_LEVEL.
 * `--json FILE` writes the rows as JSON.
 *
 * The tripwire (`--check`, ADR 0112) is what CI runs. Its sweep is fixed in
 * `balance/gate.ts` and it refuses the overrides above, so a run is never
 * compared with a baseline made at other settings. It fails on a shift that is
 * both statistically significant and at least a measure's minimum size, on rows
 * the baseline does not know (or the reverse), and on an anomaly (a stalemate,
 * impossible HP). `--write-baseline` rewrites `balance/baseline.json` and prints
 * a before/after table for the pull request. `--baseline FILE` points either at
 * another file.
 *
 * `--scenario FILE` is the paired A/B mode (`balance/scenario.ts`): Story, the
 * authored rosters, baseline against the scenario.
 *
 * BALANCE_TUNING=/path/to/tuning.json overlays a *partial* combat tuning block
 * on the authored one, so a variant can be A/B tested without a code edit:
 *
 *   BALANCE_TUNING=variant.json npm run balance
 *
 * The file is checked against the same zod schema as `src/content/tuning.ts`,
 * so a typo fails here instead of quietly simulating something else.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { CONTENT } from '../src/content';
import { combatTuningOverrideSchema, combatTuningSchema } from '../src/content/tuning.schema';
import { encounterPasses } from '../src/core/sim/balance';
import type { DisciplineReport } from '../src/core/sim/balance';
import { Z95 } from '../src/core/sim/stats';
import type { MeanStats } from '../src/core/sim/stats';
import { DIFFICULTIES } from '../src/core/types';
import type { ContentIndex, Difficulty } from '../src/core/types';
import {
  BASELINE_PATH,
  CHECK_COMMAND,
  GATE_SETTINGS,
  WRITE_COMMAND,
  baselineRowOf,
  baselineSchema,
  buildBaseline,
  compareWithBaseline,
  describeRule,
  formatFailure,
  formatRegeneration,
  formatSensitivity,
  serialiseBaseline,
} from './balance/gate';
import type { Baseline, SweepRow } from './balance/gate';
import { runSweepJobs } from './balance/pool';
import type { SweepJob } from './balance/pool';
import { applyScenario, readScenario, unsupportedKnobs } from './balance/scenario';
import { runScenarioReport, type ScenarioReport, type ScenarioRow } from './balance/report';

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

function optionValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a path`);
  return value;
}

const scenarioPath = optionValue('--scenario') ?? process.env.BALANCE_SCENARIO;
const jsonPath = optionValue('--json');
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
/*
 * The report shows every difficulty (ADR 0110): Story, where the win rate is at
 * its ceiling, and Hard, where it is not. BALANCE_DIFFICULTY=story or =hard
 * narrows it to one.
 */
const difficultyName = process.env.BALANCE_DIFFICULTY;
const difficulties: readonly Difficulty[] = DIFFICULTIES.filter(
  (candidate) => difficultyName === undefined || candidate === difficultyName,
);
if (difficulties.length === 0) {
  console.error(`BALANCE_DIFFICULTY must be one of ${DIFFICULTIES.join(', ')}`);
  process.exit(1);
}
const pad = (s: string, n: number) => s.padEnd(n);
const num = (n: number, w: number) => n.toFixed(1).padStart(w);

function pairedRow(report: ScenarioReport, encounterId: string, partySize: number): ScenarioRow {
  const row = report.rows.find(
    (candidate) => candidate.encounterId === encounterId && candidate.partySize === partySize,
  );
  if (!row) throw new Error(`Missing report row ${encounterId} at party size ${partySize}`);
  return row;
}

if (scenarioPath) {
  try {
    const scenario = readScenario(scenarioPath);
    const limitations = unsupportedKnobs(scenario);
    const scenarioContent = applyScenario(content, scenario);
    const baseline = runScenarioReport(content, sizes, trials);
    const candidate = runScenarioReport(scenarioContent, sizes, trials);

    console.log(`\nBalance scenario: ${scenarioPath}`);
    console.log(
      `Baseline and scenario - ${trials} paired AI-vs-AI trials per encounter and size\n`,
    );
    console.log(
      `${pad('Encounter / size', 32)}${pad('Base win', 10)}${pad('Scen win', 10)}` +
        `${pad('Base rnd', 10)}${pad('Scen rnd', 10)}${pad('Base deaths', 13)}` +
        `${pad('Scen deaths', 13)}${pad('Base HP', 10)}Scen HP`,
    );
    for (const base of baseline.rows) {
      const next = pairedRow(candidate, base.encounterId, base.partySize);
      console.log(
        `${pad(`${base.label} / ${base.partySize}`, 32)}` +
          `${num(base.winRate * 100, 6)}%   ${num(next.winRate * 100, 6)}%   ` +
          `${num(base.meanRounds, 6)}   ${num(next.meanRounds, 6)}   ` +
          `${num(base.meanPartyDeaths, 7)}   ${num(next.meanPartyDeaths, 7)}   ` +
          `${num(base.meanPartyHpRemaining * 100, 5)}%   ${num(next.meanPartyHpRemaining * 100, 5)}%`,
      );
    }

    const allPropIds = new Set(
      [...baseline.rows, ...candidate.rows].flatMap((row) => Object.keys(row.props)),
    );
    if (allPropIds.size > 0) {
      console.log('\nProp events (mean per trial, baseline -> scenario):');
      for (const propId of [...allPropIds].sort()) {
        const sum = (report: ScenarioReport, field: 'ignited' | 'burnedAway' | 'doused'): number =>
          report.rows.reduce((total, row) => total + (row.props[propId]?.[field] ?? 0), 0) /
          report.trials;
        console.log(
          `  ${propId}: ignited ${sum(baseline, 'ignited').toFixed(2)} -> ${sum(candidate, 'ignited').toFixed(2)}, ` +
            `burned away ${sum(baseline, 'burnedAway').toFixed(2)} -> ${sum(candidate, 'burnedAway').toFixed(2)}, ` +
            `doused ${sum(baseline, 'doused').toFixed(2)} -> ${sum(candidate, 'doused').toFixed(2)}`,
        );
      }
      const fire = (report: ScenarioReport, side: 'party' | 'enemy'): number =>
        report.rows.reduce(
          (total, row) => total + row.unattributedEnvironmentalFireDamage[side],
          0,
        );
      console.log(
        `  environmental fire damage (not exactly attributable to props): party ${fire(baseline, 'party').toFixed(1)} -> ${fire(candidate, 'party').toFixed(1)}, ` +
          `enemy ${fire(baseline, 'enemy').toFixed(1)} -> ${fire(candidate, 'enemy').toFixed(1)}`,
      );
    }

    console.log(
      `\nRuntime: baseline ${(baseline.runtimeMs / 1000).toFixed(1)}s; scenario ${(candidate.runtimeMs / 1000).toFixed(1)}s.`,
    );
    if (limitations.length > 0) {
      console.log('Needs a rules hook (scenario value was not applied):');
      for (const limitation of limitations) {
        console.log(`  - ${limitation.knob}: ${limitation.reason}`);
      }
    }
    if (jsonPath) {
      writeFileSync(
        jsonPath,
        `${JSON.stringify(
          {
            scenario: scenarioPath,
            baseline,
            candidate,
            limitations,
            notes: {
              propFireDamage:
                'Existing damaged events do not identify prop provenance; reported fire damage is all fire damage with a null source.',
            },
          },
          null,
          2,
        )}\n`,
      );
      console.log(`JSON report: ${jsonPath}`);
    }
    process.exit(0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/* The report, the tripwire and the baseline                            */
/* ------------------------------------------------------------------ */

const checking = process.argv.includes('--check');
const writing = process.argv.includes('--write-baseline');
const gated = checking || writing;
const baselinePath = optionValue('--baseline') ?? BASELINE_PATH;

if (checking && writing) {
  console.error('Use --check or --write-baseline, not both.');
  process.exit(1);
}
if (gated) {
  /*
   * The tripwire's settings are fixed (GATE_SETTINGS). An override that was
   * quietly ignored, or quietly applied, would compare a run with a baseline
   * made at other settings, so refuse to start instead.
   */
  const overrides = [
    'BALANCE_TRIALS',
    'BALANCE_SIZES',
    'BALANCE_VARIANTS',
    'BALANCE_DIFFICULTY',
    'BALANCE_TUNING',
  ].filter((name) => process.env[name] !== undefined);
  if (overrides.length > 0) {
    console.error(
      `The balance tripwire runs at fixed settings (${describeSettings(GATE_SETTINGS)}).\n` +
        `Unset ${overrides.join(', ')} to run it, or drop the flag for an ad hoc report.`,
    );
    process.exit(1);
  }
}

interface SweepSettings {
  readonly trials: number;
  readonly sizes: readonly number[];
  readonly difficulties: readonly Difficulty[];
  readonly perVariant: boolean;
}

function describeSettings(settings: SweepSettings): string {
  return (
    `${settings.trials} trials a row; table sizes ${settings.sizes.join(', ')}; ` +
    `${settings.difficulties.join(' and ')}; ` +
    (settings.perVariant ? 'every roster variant on its own row' : 'roster variants unpinned')
  );
}

const settings: SweepSettings = gated ? GATE_SETTINGS : { trials, sizes, difficulties, perVariant };

const pct = (fraction: number, digits = 1) => (fraction * 100).toFixed(digits);
const plusMinus = (stats: MeanStats, scale: number, digits: number) =>
  `${(stats.mean * scale).toFixed(digits)} ±${(Z95 * stats.se * scale).toFixed(digits)}`;

function printSweep(rows: readonly SweepRow[]): void {
  console.log(`\nBalance report - AI-vs-AI, ${describeSettings(settings)}`);
  console.log(
    'Every interval is 95%: Wilson score for a rate [low-high], mean ± 1.96 standard errors for a mean.\n',
  );
  for (const difficulty of settings.difficulties) {
    for (const size of settings.sizes) {
      const block = rows.filter((row) => row.difficulty === difficulty && row.size === size);
      console.log(`--- ${difficulty}, ${size} player${size === 1 ? '' : 's'} ---`);
      console.log(
        `${pad('Encounter', 37)}${pad('Lv', 4)}${pad('Win % [95%]', 22)}${pad('HP left %', 13)}` +
          `${pad('Rounds', 14)}${pad('Deaths', 13)}${pad('>=1 down', 10)}HP p10`,
      );
      for (const { row } of block) {
        const { summary } = row;
        const win =
          `${pct(summary.winRate).padStart(5)} ` +
          `[${pct(summary.winInterval.low)}-${pct(summary.winInterval.high)}]`;
        console.log(
          `${pad(row.label, 37)}${pad(String(row.partyLevel), 4)}${pad(win, 22)}` +
            `${pad(plusMinus(summary.hpLeft, 100, 1), 13)}${pad(plusMinus(summary.rounds, 1, 2), 14)}` +
            `${pad(plusMinus(summary.deaths, 1, 2), 13)}` +
            `${pad(`${pct(summary.trialsWithDeath / summary.trials)}%`, 10)}` +
            `${pct(summary.hpLeftP10)}%`,
        );
      }
      const wins = block.reduce((sum, { row }) => sum + row.summary.wins, 0);
      const total = block.reduce((sum, { row }) => sum + row.summary.trials, 0);
      console.log(`  overall: ${total > 0 ? pct(wins / total) : '0.0'}%\n`);
    }
  }

  const atCeiling = (difficulty: Difficulty) => {
    const block = rows.filter((row) => row.difficulty === difficulty);
    const pinned = block.filter(({ row }) => row.summary.wins === row.summary.trials).length;
    return `${difficulty} ${pinned} of ${block.length}`;
  };
  const pinned = rows.filter(({ row }) => row.summary.wins === row.summary.trials).length;
  console.log(
    `${pinned} of ${rows.length} rows sit at the win-rate ceiling, every trial won ` +
      `(${settings.difficulties.map(atCeiling).join('; ')}).`,
  );
  console.log('A measure at its ceiling cannot show a change, so the tripwire');
  console.log(`(${CHECK_COMMAND}) also reads HP left, rounds and party deaths.`);
  console.log('The old "70-85% for a full table" win-rate band is not a gate. Whether it');
  console.log('still applies, or Story is meant to win every trial, is an open decision (#777).');
  console.log('Both sides are driven by the same AI, which does not set up combos, so treat');
  console.log('these as a floor. ">=1 down" is the share of trials that ended with a party');
  console.log('member down; "HP p10" is the HP left that nine trials in ten beat.');
  if (!settings.perVariant) {
    console.log('Set BALANCE_VARIANTS=1 to report each roster variant separately.');
  }
  console.log('');
}

function readBaseline(path: string): Baseline | null {
  if (!existsSync(path)) return null;
  const parsed = baselineSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
  if (!parsed.success) {
    console.error(`Invalid balance baseline ${path}:`);
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}

async function main(): Promise<void> {
  const started = performance.now();
  const tuning = process.env.BALANCE_TUNING ? content.tuning : null;

  const rowJobs: SweepJob[] = [];
  for (const difficulty of settings.difficulties) {
    for (const size of settings.sizes) {
      for (const encounter of content.encounters.values()) {
        for (const variantId of encounterPasses(encounter, settings.perVariant)) {
          rowJobs.push({
            kind: 'row',
            difficulty,
            size,
            encounterId: encounter.id,
            variantId,
            trials: settings.trials,
          });
        }
      }
    }
  }

  /*
   * Discipline sweep. Every Act 1 encounter is tuned for level 3 or below, so the
   * table above never sees a path at all — this forces a level past the gate and
   * swaps one discipline at a time. Read it for spread, not for absolute numbers:
   * these are fights nobody can currently reach at this level. Writing a baseline
   * does not need it.
   */
  const disciplineLevel = Number(process.env.BALANCE_DISCIPLINE_LEVEL ?? 7);
  const disciplineTrials = Number(process.env.BALANCE_DISCIPLINE_TRIALS ?? 30);
  const disciplineJobs: SweepJob[] = writing
    ? []
    : [...content.disciplines.keys()].map((disciplineId) => ({
        kind: 'discipline',
        disciplineId,
        trials: disciplineTrials,
        partyLevel: disciplineLevel,
      }));

  const results = await runSweepJobs([...rowJobs, ...disciplineJobs], tuning);

  const rows: SweepRow[] = [];
  const paths: DisciplineReport[] = [];
  const anomalies = new Set<string>();
  for (const [index, result] of results.entries()) {
    const job = rowJobs[index];
    if (result.kind === 'discipline') {
      paths.push(result.report);
    } else if (job?.kind === 'row') {
      rows.push({ difficulty: job.difficulty, size: job.size, row: result.row });
      for (const anomaly of result.anomalies) anomalies.add(anomaly);
    }
  }

  printSweep(rows);

  if (paths.length > 0) {
    console.log(
      `--- disciplines, six players at level ${disciplineLevel}, ${disciplineTrials} trials per encounter ---`,
    );
    console.log(
      `${pad('Path', 20)}${pad('Element', 12)}${pad('Win %', 8)}${pad('Rounds', 9)}Deaths`,
    );
    for (const row of [...paths].sort((a, b) => b.winRate - a.winRate)) {
      console.log(
        `${pad(row.label, 20)}${pad(row.element, 12)}` +
          `${num(row.winRate * 100, 5)}   ${num(row.averageRounds, 6)}   ${num(row.averagePartyDeaths, 5)}`,
      );
    }
    const spread =
      Math.max(...paths.map((p) => p.winRate)) - Math.min(...paths.map((p) => p.winRate));
    console.log(`  spread: ${(spread * 100).toFixed(1)} points between the best and worst path\n`);
  }

  if (jsonPath) {
    writeFileSync(
      jsonPath,
      `${JSON.stringify({ settings, rows: rows.map(baselineRowOf) }, null, 2)}\n`,
    );
    console.log(`JSON report: ${jsonPath}`);
  }

  console.log(`Runtime: ${((performance.now() - started) / 1000).toFixed(1)}s.`);

  // An anomaly (a stalemate, impossible HP) is a rules bug whatever the numbers say.
  if (anomalies.size > 0) {
    console.error('Anomalies detected:');
    for (const anomaly of anomalies) console.error(`  - ${anomaly}`);
    process.exit(1);
  }

  if (!gated) return;

  const current = buildBaseline(rows);
  const baseline = readBaseline(baselinePath);

  if (writing) {
    writeFileSync(baselinePath, serialiseBaseline(current));
    console.log(`\nWrote ${baselinePath} (${current.rows.length} rows).`);
    if (!baseline) {
      console.log('There was no baseline before this one, so there is nothing to compare.');
      return;
    }
    console.log('\nBefore and after, for the pull request description:\n');
    console.log(formatRegeneration(compareWithBaseline(baseline, current)));
    return;
  }

  if (!baseline) {
    console.error(
      `\nBALANCE TRIPWIRE FAILED\n\nNo baseline at ${baselinePath}. Write one with:\n\n    ${WRITE_COMMAND}\n`,
    );
    process.exit(1);
  }
  const result = compareWithBaseline(baseline, current);
  if (!result.passed) {
    console.error(formatFailure(result));
    process.exit(1);
  }
  const exact = result.comparisons.filter((comparison) => comparison.verdict.shift === 0).length;
  const largest = result.comparisons.reduce(
    (worst, comparison) =>
      Math.abs(comparison.verdict.z) > Math.abs(worst) && Number.isFinite(comparison.verdict.z)
        ? comparison.verdict.z
        : worst,
    0,
  );
  console.log(
    `\nBalance tripwire passed against ${baselinePath}: ${result.comparisons.length} measures, ` +
      `${exact} unchanged to the digit, largest |z| ${Math.abs(largest).toFixed(2)}.`,
  );
  console.log(describeRule(result));
  console.log(formatSensitivity(result));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exit(1);
});
