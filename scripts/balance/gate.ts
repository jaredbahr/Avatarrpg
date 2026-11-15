/**
 * The balance tripwire (ADR 0112): a committed baseline of the report's
 * measures, and the rule that decides whether a new run has moved away from it.
 *
 * The simulator is deterministic, so unchanged code reproduces the baseline
 * digit for digit. But a small change to the AI re-rolls every trajectory, and
 * the new numbers then behave like a fresh sample of the same fight. So each
 * measure is compared as two samples, and a shift fails the gate only when it is
 * both statistically significant and large enough to matter. Drift below that
 * passes without touching the baseline file, which keeps the file out of
 * ordinary pull requests.
 */
import { z } from 'zod';
import type { EncounterReport } from '../../src/core/sim/balance';
import {
  Z95,
  familyZ,
  judgeShift,
  meanInterval,
  meanShiftZ,
  proportionShiftZ,
  wilsonInterval,
} from '../../src/core/sim/stats';
import type { Interval, ShiftVerdict } from '../../src/core/sim/stats';
import { DIFFICULTIES } from '../../src/core/types';
import type { Difficulty } from '../../src/core/types';

export const BASELINE_PATH = 'scripts/balance/baseline.json';
export const CHECK_COMMAND = 'npm run balance:check';
export const WRITE_COMMAND = 'npm run balance:baseline';

/**
 * What the tripwire runs, always. `--check` and `--write-baseline` ignore no
 * environment override silently: they refuse to start if one is set, so a
 * baseline is never compared with a run made at other settings.
 *
 * Sizes 1, 3 and 6 are the lone hero, the party real play fields, and the full
 * table. Every roster variant has its own row, because an unpinned run hides a
 * bad variant inside the average.
 */
export const GATE_SETTINGS = {
  trials: 120,
  sizes: [1, 3, 6],
  difficulties: [...DIFFICULTIES],
  perVariant: true,
} as const;

/** The chance that an unchanged game trips the gate anywhere in one run. */
export const FAMILY_ALPHA = 0.01;

export type MeasureId = 'winRate' | 'hpLeft' | 'rounds' | 'deaths';

export interface MeasureDef {
  readonly id: MeasureId;
  readonly label: string;
  /** The smallest shift worth a person's attention, in the stored unit. */
  readonly minimumEffect: number;
  /** Prints a stored value (a fraction, a count) the way the report shows it. */
  readonly format: (value: number) => string;
  /** The unit after a formatted shift. */
  readonly unit: string;
  /** Multiplies a stored value into the printed unit. */
  readonly scale: number;
}

/**
 * The gated measures and their minimum practical effects (ADR 0112 has the
 * reasoning): five points of win rate, five points of party HP left, half a
 * round, and a quarter of a hero down per fight.
 */
export const MEASURES: readonly MeasureDef[] = [
  {
    id: 'winRate',
    label: 'win rate',
    minimumEffect: 0.05,
    format: (value) => `${(value * 100).toFixed(1)}%`,
    unit: ' pts',
    scale: 100,
  },
  {
    id: 'hpLeft',
    label: 'HP left',
    minimumEffect: 0.05,
    format: (value) => `${(value * 100).toFixed(1)}%`,
    unit: ' pts',
    scale: 100,
  },
  {
    id: 'rounds',
    label: 'rounds',
    minimumEffect: 0.5,
    format: (value) => value.toFixed(2),
    unit: '',
    scale: 1,
  },
  {
    id: 'deaths',
    label: 'party deaths',
    minimumEffect: 0.25,
    format: (value) => value.toFixed(2),
    unit: '',
    scale: 1,
  },
];

const meanSchema = z.object({ mean: z.number(), se: z.number().nonnegative() }).strict();

const baselineRowSchema = z
  .object({
    difficulty: z.enum(DIFFICULTIES),
    size: z.number().int().positive(),
    encounterId: z.string().min(1),
    /** Null is the authored roster. */
    variantId: z.string().min(1).nullable(),
    partyLevel: z.number().int().positive(),
    trials: z.number().int().positive(),
    wins: z.number().int().nonnegative(),
    hpLeft: meanSchema,
    rounds: meanSchema,
    deaths: meanSchema,
    trialsWithDeath: z.number().int().nonnegative(),
    hpLeftP10: z.number(),
  })
  .strict();

export const baselineSchema = z
  .object({
    about: z.string(),
    version: z.literal(1),
    settings: z
      .object({
        trials: z.number().int().positive(),
        sizes: z.array(z.number().int().positive()),
        difficulties: z.array(z.enum(DIFFICULTIES)),
        perVariant: z.boolean(),
      })
      .strict(),
    rows: z.array(baselineRowSchema),
  })
  .strict();

export type BaselineRow = z.infer<typeof baselineRowSchema>;
export type Baseline = z.infer<typeof baselineSchema>;

/** One row of a finished sweep, with where it sits in the sweep. */
export interface SweepRow {
  readonly difficulty: Difficulty;
  readonly size: number;
  readonly row: EncounterReport;
}

/** Five decimals: far below any interval, and short enough to read in a diff. */
const round5 = (value: number): number => Math.round(value * 1e5) / 1e5;

export function baselineRowOf({ difficulty, size, row }: SweepRow): BaselineRow {
  const { summary } = row;
  const mean = (stats: { mean: number; se: number }) => ({
    mean: round5(stats.mean),
    se: round5(stats.se),
  });
  return {
    difficulty,
    size,
    encounterId: row.encounterId,
    variantId: row.variantId,
    partyLevel: row.partyLevel,
    trials: summary.trials,
    wins: summary.wins,
    hpLeft: mean(summary.hpLeft),
    rounds: mean(summary.rounds),
    deaths: mean(summary.deaths),
    trialsWithDeath: summary.trialsWithDeath,
    hpLeftP10: round5(summary.hpLeftP10),
  };
}

export function buildBaseline(rows: readonly SweepRow[]): Baseline {
  return {
    about:
      `Balance tripwire baseline (ADR 0112). Written only by \`${WRITE_COMMAND}\`; do not edit ` +
      'by hand. Rates are counts out of `trials`; means carry their standard error.',
    version: 1,
    settings: {
      trials: GATE_SETTINGS.trials,
      sizes: [...GATE_SETTINGS.sizes],
      difficulties: [...GATE_SETTINGS.difficulties],
      perVariant: GATE_SETTINGS.perVariant,
    },
    rows: rows.map(baselineRowOf),
  };
}

/** One row a line, so a regenerated baseline diffs row by row. */
export function serialiseBaseline(baseline: Baseline): string {
  const rows = baseline.rows.map((row) => `    ${JSON.stringify(row)}`).join(',\n');
  return (
    '{\n' +
    `  "about": ${JSON.stringify(baseline.about)},\n` +
    `  "version": ${baseline.version},\n` +
    `  "settings": ${JSON.stringify(baseline.settings)},\n` +
    `  "rows": [\n${rows}\n  ]\n` +
    '}\n'
  );
}

export function rowKey(row: BaselineRow): string {
  return `${row.difficulty} / ${row.size}p / ${row.encounterId} / ${row.variantId ?? 'base'}`;
}

export interface Comparison {
  readonly key: string;
  readonly measure: MeasureDef;
  readonly baseline: number;
  readonly baselineInterval: Interval;
  readonly current: number;
  readonly currentInterval: Interval;
  readonly verdict: ShiftVerdict;
  /**
   * The smallest shift this comparison could trip on: the minimum shift, or the
   * z threshold times the standard error of the difference when that is larger.
   */
  readonly detectable: number;
}

export interface GateResult {
  /** Reasons the two runs cannot be compared at all. Any one fails the gate. */
  readonly structural: readonly string[];
  readonly comparisons: readonly Comparison[];
  readonly tripped: readonly Comparison[];
  /** Two-sided tests made: rows × measures. */
  readonly family: number;
  readonly zThreshold: number;
  readonly passed: boolean;
}

function measure(row: BaselineRow, id: MeasureId): { value: number; interval: Interval } {
  if (id === 'winRate') {
    return { value: row.wins / row.trials, interval: wilsonInterval(row.wins, row.trials) };
  }
  const stats = { n: row.trials, ...row[id] };
  return { value: stats.mean, interval: meanInterval(stats, Z95) };
}

function shiftZ(before: BaselineRow, after: BaselineRow, id: MeasureId): number {
  if (id === 'winRate') {
    return proportionShiftZ(before.wins, before.trials, after.wins, after.trials);
  }
  return meanShiftZ({ n: before.trials, ...before[id] }, { n: after.trials, ...after[id] });
}

/** The standard error of the difference the z above divides by. */
function shiftNoise(before: BaselineRow, after: BaselineRow, id: MeasureId): number {
  if (id === 'winRate') {
    const pooled = (before.wins + after.wins) / (before.trials + after.trials);
    return Math.sqrt(pooled * (1 - pooled) * (1 / before.trials + 1 / after.trials));
  }
  return Math.hypot(before[id].se, after[id].se);
}

const same = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Compares a run with the baseline.
 *
 * Structure first: a row on one side only, another trial count or another
 * party level means the numbers do not describe the same thing, and that fails
 * with its reason instead of being skipped. Then every measure of every shared
 * row, at the z that holds the whole run's false-alarm rate to `FAMILY_ALPHA`.
 */
export function compareWithBaseline(
  baseline: Baseline,
  current: Baseline,
  measures: readonly MeasureDef[] = MEASURES,
): GateResult {
  const structural: string[] = [];
  const settings: (keyof Baseline['settings'])[] = [
    'trials',
    'sizes',
    'difficulties',
    'perVariant',
  ];
  for (const name of settings) {
    const before = baseline.settings[name];
    const after = current.settings[name];
    const equal =
      Array.isArray(before) && Array.isArray(after) ? same(before, after) : before === after;
    if (!equal) {
      structural.push(
        `setting "${name}": the baseline was written with ${JSON.stringify(before)}, ` +
          `this run used ${JSON.stringify(after)}`,
      );
    }
  }

  const before = new Map(baseline.rows.map((row) => [rowKey(row), row]));
  const after = new Map(current.rows.map((row) => [rowKey(row), row]));
  if (before.size !== baseline.rows.length) structural.push('the baseline lists a row twice');
  for (const key of before.keys()) {
    if (!after.has(key)) structural.push(`${key}: in the baseline, but this run has no such row`);
  }
  for (const key of after.keys()) {
    if (!before.has(key)) structural.push(`${key}: this run has the row, the baseline does not`);
  }

  const shared = [...before].flatMap(([key, row]) => {
    const now = after.get(key);
    return now ? [{ key, row, now }] : [];
  });
  for (const { key, row, now } of shared) {
    if (row.trials !== now.trials) {
      structural.push(`${key}: ${row.trials} trials in the baseline, ${now.trials} in this run`);
    }
    if (row.partyLevel !== now.partyLevel) {
      structural.push(
        `${key}: party level ${row.partyLevel} in the baseline, ${now.partyLevel} in this run`,
      );
    }
  }

  const family = Math.max(before.size, after.size) * measures.length;
  const zThreshold = familyZ(family, FAMILY_ALPHA);
  const comparisons: Comparison[] = [];
  for (const { key, row, now } of shared) {
    for (const definition of measures) {
      const was = measure(row, definition.id);
      const is = measure(now, definition.id);
      comparisons.push({
        key,
        measure: definition,
        baseline: was.value,
        baselineInterval: was.interval,
        current: is.value,
        currentInterval: is.interval,
        verdict: judgeShift(
          is.value - was.value,
          shiftZ(row, now, definition.id),
          zThreshold,
          definition.minimumEffect,
        ),
        detectable: Math.max(
          definition.minimumEffect,
          zThreshold * shiftNoise(row, now, definition.id),
        ),
      });
    }
  }

  const tripped = comparisons.filter((comparison) => comparison.verdict.tripped);
  return {
    structural,
    comparisons,
    tripped,
    family,
    zThreshold,
    passed: structural.length === 0 && tripped.length === 0,
  };
}

/* ------------------------------------------------------------------ */
/* Printing                                                             */
/* ------------------------------------------------------------------ */

function table(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => (row[column] ?? '').length)),
  );
  const line = (cells: readonly string[]) =>
    cells
      .map((cell, column) => cell.padEnd(widths[column] ?? 0))
      .join('  ')
      .trimEnd();
  return [line(header), line(widths.map((width) => '-'.repeat(width))), ...rows.map(line)].join(
    '\n',
  );
}

function withInterval(definition: MeasureDef, value: number, interval: Interval): string {
  return `${definition.format(value)} [${definition.format(interval.low)} to ${definition.format(interval.high)}]`;
}

function signed(definition: MeasureDef, shift: number): string {
  const scaled = shift * definition.scale;
  return `${scaled >= 0 ? '+' : ''}${scaled.toFixed(definition.scale === 100 ? 1 : 2)}${definition.unit}`;
}

function comparisonCells(comparison: Comparison): string[] {
  const { measure: definition, verdict } = comparison;
  return [
    comparison.key,
    definition.label,
    withInterval(definition, comparison.baseline, comparison.baselineInterval),
    withInterval(definition, comparison.current, comparison.currentInterval),
    signed(definition, verdict.shift),
    `${signed(definition, definition.minimumEffect).slice(1)}`,
    Number.isFinite(verdict.z) ? verdict.z.toFixed(1) : verdict.z > 0 ? 'inf' : '-inf',
  ];
}

const COMPARISON_HEADER = [
  'Row (difficulty / table / encounter / roster)',
  'Measure',
  'Baseline [95%]',
  'Current [95%]',
  'Shift',
  'Min shift',
  'z',
];

/** One line saying what the rule is, with this run's numbers in it. */
export function describeRule(result: GateResult): string {
  return (
    `A measure trips when its shift is at least the minimum shift AND |z| >= ` +
    `${result.zThreshold.toFixed(2)} (${result.family} comparisons, a ` +
    `${(FAMILY_ALPHA * 100).toFixed(0)}% chance of any false alarm in one run).`
  );
}

/** The whole failure message: what moved, by how much, and what to do about it. */
export function formatFailure(result: GateResult): string {
  const lines: string[] = ['', 'BALANCE TRIPWIRE FAILED', ''];
  if (result.structural.length > 0) {
    lines.push('This run and the committed baseline do not describe the same sweep:');
    for (const reason of result.structural) lines.push(`  - ${reason}`);
    lines.push('');
  }
  if (result.tripped.length > 0) {
    lines.push(
      `${result.tripped.length} measure${result.tripped.length === 1 ? '' : 's'} moved ` +
        `away from ${BASELINE_PATH}:`,
      '',
      table(COMPARISON_HEADER, result.tripped.map(comparisonCells)),
      '',
      describeRule(result),
      '',
    );
  }
  lines.push(
    'If the change is not intended, this is a regression: fix it.',
    'If it is intended, regenerate the baseline and commit it with the change:',
    '',
    `    ${WRITE_COMMAND}`,
    '',
    'Regenerating is a deliberate act. Paste the before/after table it prints into the pull',
    'request description and say why the fights moved.',
    '',
  );
  return lines.join('\n');
}

/**
 * What a regeneration changed, for the pull request: every measure that moved
 * by at least its minimum shift, tripped or not, then the count of the rest.
 */
export function formatRegeneration(result: GateResult): string {
  const lines: string[] = [];
  if (result.structural.length > 0) {
    lines.push('Structure changed:');
    for (const reason of result.structural) lines.push(`  - ${reason}`);
    lines.push('');
  }
  const moved = result.comparisons.filter((comparison) => comparison.verdict.material);
  if (moved.length > 0) {
    lines.push(
      'Measures that moved by at least their minimum shift (* tripped the gate):',
      '',
      table(
        [...COMPARISON_HEADER, ''],
        moved.map((comparison) => [
          ...comparisonCells(comparison),
          comparison.verdict.tripped ? '*' : '',
        ]),
      ),
      '',
    );
  }
  const exact = result.comparisons.filter((comparison) => comparison.verdict.shift === 0).length;
  lines.push(
    `${result.comparisons.length} measures compared: ${moved.length} moved by at least their ` +
      `minimum shift, ${result.tripped.length} tripped, ${exact} are unchanged to the digit.`,
    describeRule(result),
  );
  return lines.join('\n');
}

/**
 * How fine the gate is, measure by measure: the smallest shift it could trip
 * on in the typical row and in the noisiest one. A noisy row (a long boss
 * fight, a Hard fight that is sometimes lost) needs a bigger shift than the
 * minimum before it is more than noise; this says how much bigger.
 */
export function formatSensitivity(result: GateResult): string {
  const lines = ['Smallest shift the gate can see, per measure (typical row; noisiest row):'];
  for (const definition of MEASURES) {
    const own = result.comparisons
      .filter((comparison) => comparison.measure.id === definition.id)
      .sort((a, b) => a.detectable - b.detectable);
    const middle = own[Math.floor(own.length / 2)];
    const worst = own[own.length - 1];
    if (!middle || !worst) continue;
    lines.push(
      `  ${definition.label.padEnd(13)}${signed(definition, middle.detectable).slice(1)}; ` +
        `${signed(definition, worst.detectable).slice(1)} (${worst.key})`,
    );
  }
  return lines.join('\n');
}
