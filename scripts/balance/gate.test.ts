import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { encounterPasses, summariseTrials } from '../../src/core/sim/balance';
import { twoSidedTail } from '../../src/core/sim/stats';
import {
  BASELINE_PATH,
  FAMILY_ALPHA,
  GATE_SETTINGS,
  MEASURES,
  WRITE_COMMAND,
  baselineRowOf,
  baselineSchema,
  compareWithBaseline,
  formatFailure,
  formatRegeneration,
  rowKey,
  serialiseBaseline,
} from './gate';
import type { Baseline, BaselineRow } from './gate';

/*
 * No fight is simulated here. The rule is tested on rows written by hand, and
 * the committed baseline on its shape. That the unmodified tree reproduces the
 * baseline is checked by the CI step itself (`npm run balance:check`), which is
 * the only place the full sweep runs.
 */

function row(overrides: Partial<BaselineRow> = {}): BaselineRow {
  return {
    difficulty: 'story',
    size: 3,
    encounterId: 'enc_test',
    variantId: null,
    partyLevel: 3,
    trials: 120,
    wins: 120,
    hpLeft: { mean: 0.7, se: 0.012 },
    rounds: { mean: 5.8, se: 0.12 },
    deaths: { mean: 0.4, se: 0.05 },
    trialsWithDeath: 44,
    hpLeftP10: 0.5,
    ...overrides,
  };
}

function baselineOf(rows: readonly BaselineRow[], trials = 120): Baseline {
  return {
    about: 'test',
    version: 1,
    settings: { trials, sizes: [3], difficulties: ['story', 'hard'], perVariant: true },
    rows: [...rows],
  };
}

const other = row({ encounterId: 'enc_other', variantId: 'spare' });

describe('compareWithBaseline', () => {
  it('passes a run that reproduces the baseline', () => {
    const baseline = baselineOf([row(), other]);
    const result = compareWithBaseline(baseline, baselineOf([row(), other]));
    expect(result.passed).toBe(true);
    expect(result.structural).toEqual([]);
    expect(result.comparisons).toHaveLength(2 * MEASURES.length);
    expect(result.comparisons.every((comparison) => comparison.verdict.shift === 0)).toBe(true);
  });

  it('fails a meaningful shift, and says which row, which measure and by how much', () => {
    const baseline = baselineOf([row(), other]);
    // Ten points of HP gone at the same spread: z is about -5.9.
    const current = baselineOf([row({ hpLeft: { mean: 0.6, se: 0.012 } }), other]);
    const result = compareWithBaseline(baseline, current);

    expect(result.passed).toBe(false);
    expect(result.tripped).toHaveLength(1);
    const tripped = result.tripped[0];
    expect(tripped?.key).toBe('story / 3p / enc_test / base');
    expect(tripped?.measure.id).toBe('hpLeft');
    expect(tripped?.verdict.shift).toBeCloseTo(-0.1, 12);

    const message = formatFailure(result);
    expect(message).toContain('BALANCE TRIPWIRE FAILED');
    expect(message).toContain('story / 3p / enc_test / base');
    expect(message).toContain('HP left');
    // Baseline and current, each with its 95% interval, then the shift and the threshold.
    expect(message).toContain('70.0% [67.6% to 72.4%]');
    expect(message).toContain('60.0% [57.6% to 62.4%]');
    expect(message).toContain('-10.0 pts');
    expect(message).toContain('5.0 pts');
    expect(message).toContain(WRITE_COMMAND);
    expect(message).toContain('deliberate');
    // The row that did not move is not in the table.
    expect(message).not.toContain('enc_other');
  });

  it('fails a fall in the win rate where the win rate can still move', () => {
    const hard = row({ difficulty: 'hard', wins: 108 });
    const result = compareWithBaseline(
      baselineOf([hard]),
      baselineOf([row({ difficulty: 'hard', wins: 78 })]),
    );
    expect(result.tripped.map((comparison) => comparison.measure.id)).toEqual(['winRate']);
    expect(formatFailure(result)).toContain('90.0%');
  });

  it('passes a real but trivial shift: significant, below the minimum effect', () => {
    // Three points of HP with a tiny spread: |z| is 17, the shift is under five points.
    const current = baselineOf([row({ hpLeft: { mean: 0.67, se: 0.00125 } })]);
    const baseline = baselineOf([row({ hpLeft: { mean: 0.7, se: 0.00125 } })]);
    const result = compareWithBaseline(baseline, current);
    const hp = result.comparisons.find((comparison) => comparison.measure.id === 'hpLeft');
    expect(hp?.verdict.significant).toBe(true);
    expect(hp?.verdict.material).toBe(false);
    expect(result.passed).toBe(true);
  });

  it('passes a re-rolled sample: every measure moved, none beyond its noise', () => {
    const current = baselineOf([
      row({
        wins: 118,
        hpLeft: { mean: 0.66, se: 0.013 },
        rounds: { mean: 6.2, se: 0.13 },
        deaths: { mean: 0.55, se: 0.06 },
      }),
    ]);
    const result = compareWithBaseline(baselineOf([row()]), current);
    expect(result.comparisons.every((comparison) => comparison.verdict.shift !== 0)).toBe(true);
    expect(result.tripped).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it('fails on a row the baseline has and the run does not, and the reverse', () => {
    const gone = compareWithBaseline(baselineOf([row(), other]), baselineOf([row()]));
    expect(gone.passed).toBe(false);
    expect(gone.structural).toEqual([
      'story / 3p / enc_other / spare: in the baseline, but this run has no such row',
    ]);
    expect(formatFailure(gone)).toContain('enc_other / spare');

    const added = compareWithBaseline(baselineOf([row()]), baselineOf([row(), other]));
    expect(added.passed).toBe(false);
    expect(added.structural).toEqual([
      'story / 3p / enc_other / spare: this run has the row, the baseline does not',
    ]);
  });

  it('fails on another trial count, another party level or other settings', () => {
    const trials = compareWithBaseline(
      baselineOf([row({ trials: 40, wins: 40 })], 40),
      baselineOf([row()]),
    );
    expect(trials.passed).toBe(false);
    expect(trials.structural).toContain(
      'setting "trials": the baseline was written with 40, this run used 120',
    );
    expect(trials.structural).toContain(
      'story / 3p / enc_test / base: 40 trials in the baseline, 120 in this run',
    );

    const level = compareWithBaseline(baselineOf([row()]), baselineOf([row({ partyLevel: 4 })]));
    expect(level.structural).toEqual([
      'story / 3p / enc_test / base: party level 3 in the baseline, 4 in this run',
    ]);

    const sizes = baselineOf([row()]);
    const widened: Baseline = { ...sizes, settings: { ...sizes.settings, sizes: [3, 6] } };
    expect(compareWithBaseline(sizes, widened).structural).toEqual([
      'setting "sizes": the baseline was written with [3], this run used [3,6]',
    ]);
  });

  it('sets z from the size of the family, so the whole run keeps its false-alarm rate', () => {
    const result = compareWithBaseline(baselineOf([row(), other]), baselineOf([row(), other]));
    expect(result.family).toBe(2 * MEASURES.length);
    expect(twoSidedTail(result.zThreshold) * result.family).toBeLessThanOrEqual(FAMILY_ALPHA);
  });
});

describe('formatRegeneration', () => {
  it('lists what moved for the pull request, marking what would have tripped', () => {
    const baseline = baselineOf([row(), other]);
    const current = baselineOf([
      row({ hpLeft: { mean: 0.6, se: 0.012 } }),
      { ...other, rounds: { mean: 6.4, se: 0.2 } },
    ]);
    const summary = formatRegeneration(compareWithBaseline(baseline, current));
    expect(summary).toContain('story / 3p / enc_test / base');
    expect(summary).toContain('-10.0 pts');
    expect(summary).toContain('enc_other / spare');
    expect(summary).toContain('+0.60');
    expect(summary).toContain('8 measures compared: 2 moved');
    expect(summary).toContain('1 tripped');
  });
});

describe('the baseline file', () => {
  it('writes one row a line and reads back what it wrote', () => {
    const baseline = baselineOf([row(), other]);
    const text = serialiseBaseline(baseline);
    expect(baselineSchema.parse(JSON.parse(text))).toEqual(baseline);
    expect(text.split('\n').filter((line) => line.includes('"encounterId"'))).toHaveLength(2);
  });

  it('rejects a file with a field it does not know', () => {
    const baseline = baselineOf([row()]);
    expect(baselineSchema.safeParse({ ...baseline, extra: 1 }).success).toBe(false);
  });

  it('builds a row from the same trials the report prints', () => {
    const summary = summariseTrials([
      { outcome: 'victory', rounds: 3, partyDeaths: 0, hpLeft: 0.9 },
      { outcome: 'defeat', rounds: 5, partyDeaths: 2, hpLeft: 0 },
    ]);
    const built = baselineRowOf({
      difficulty: 'hard',
      size: 2,
      row: {
        encounterId: 'enc_test',
        variantId: 'spare',
        label: 'Test (spare)',
        partyLevel: 2,
        winRate: summary.winRate,
        averageRounds: summary.rounds.mean,
        averagePartyDeaths: summary.deaths.mean,
        averageHpRemaining: summary.hpLeft.mean,
        stalemates: 0,
        samples: [],
        summary,
      },
    });
    expect(built).toMatchObject({
      difficulty: 'hard',
      size: 2,
      encounterId: 'enc_test',
      variantId: 'spare',
      trials: 2,
      wins: 1,
      hpLeft: { mean: 0.45, se: 0.45 },
      rounds: { mean: 4, se: 1 },
      deaths: { mean: 1, se: 1 },
      trialsWithDeath: 1,
    });
    expect(baselineSchema.shape.rows.element.safeParse(built).success).toBe(true);
  });
});

describe('the committed baseline', () => {
  const path = fileURLToPath(new URL(`../../${BASELINE_PATH}`, import.meta.url));
  const text = readFileSync(path, 'utf8');
  const baseline = baselineSchema.parse(JSON.parse(text));

  it('was written at the settings the tripwire runs', () => {
    expect(baseline.settings).toEqual({
      trials: GATE_SETTINGS.trials,
      sizes: [...GATE_SETTINGS.sizes],
      difficulties: [...GATE_SETTINGS.difficulties],
      perVariant: GATE_SETTINGS.perVariant,
    });
    expect(serialiseBaseline(baseline)).toBe(text);
  });

  it('has exactly one row per difficulty, table size, encounter and roster the game has', () => {
    const expected: string[] = [];
    for (const difficulty of GATE_SETTINGS.difficulties) {
      for (const size of GATE_SETTINGS.sizes) {
        for (const encounter of CONTENT.encounters.values()) {
          for (const variantId of encounterPasses(encounter, true)) {
            expected.push(`${difficulty} / ${size}p / ${encounter.id} / ${variantId ?? 'base'}`);
          }
        }
      }
    }
    expect(baseline.rows.map(rowKey)).toEqual(expected);
    // The rule in CLAUDE.md: a variant is never averaged into its encounter.
    expect(expected).toContain('story / 3p / enc_grumbler / jins_people');
    expect(expected).toContain('story / 3p / enc_grumbler / base');
  });

  it('holds plausible numbers at the trial count it claims', () => {
    for (const entry of baseline.rows) {
      const key = rowKey(entry);
      expect(entry.trials, key).toBe(GATE_SETTINGS.trials);
      expect(entry.wins, key).toBeLessThanOrEqual(entry.trials);
      expect(entry.trialsWithDeath, key).toBeLessThanOrEqual(entry.trials);
      expect(entry.hpLeft.mean, key).toBeGreaterThanOrEqual(0);
      expect(entry.hpLeft.mean, key).toBeLessThanOrEqual(1);
      expect(entry.rounds.mean, key).toBeGreaterThan(0);
      expect(entry.partyLevel, key).toBe(CONTENT.encounters.get(entry.encounterId)?.expectedLevel);
    }
  });

  it('keeps the chance of a false alarm in one run at 1% or lower', () => {
    const result = compareWithBaseline(baseline, baseline);
    expect(result.passed).toBe(true);
    expect(result.family).toBe(baseline.rows.length * MEASURES.length);
    expect(twoSidedTail(result.zThreshold) * result.family).toBeLessThanOrEqual(0.01);
  });
});
