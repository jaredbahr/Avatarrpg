import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { TOPDOWN_SCENES } from '../../src/content/topdown';
import {
  BASELINE,
  POLICY,
  assertCoreBenchBudgets,
  caseBudgetIssues,
  createCoreBenchSuite,
  createTopDownBenchSuite,
  measureCoreBenchCase,
  summarizePairs,
} from './core-bench';
import type { BenchBaseline, BenchRow } from './core-bench';
import frozenBaseline from './core-bench-baseline.json';

// Real fixture construction and validation are outside the measured batches.
// Each measured row gets its own ordinary Vitest test budget.
const suite = createCoreBenchSuite();

describe('core benchmark coverage and frozen calibration', () => {
  it('retains the pre-measurement fixed sampling policy', () => {
    expect(POLICY).toEqual({
      warmupBatches: 3,
      samples: 11,
      pathBatch: 32,
      aiBatch: 2,
      ceilingMultiplier: 4,
    });
    expect(BASELINE.calibrationSource).toBe('30815ebb817a410bae375df3c0f7ebc5473f53ce');
    expect(BASELINE.policy).toEqual(POLICY);
  });

  it('covers all four tied-largest real combat grids and proves the global factory roster maximum', () => {
    const maps = [...CONTENT.maps.values()].filter((map) => map.kind === 'combat');
    const largestArea = Math.max(...maps.map((map) => map.width * map.height));
    const largest = maps.filter((map) => map.width * map.height === largestArea);
    expect(suite.coverage.largestMaps.map((map) => map.id).sort()).toEqual(
      largest.map((map) => map.id).sort(),
    );
    expect(suite.coverage.largestMaps).toHaveLength(4);
    expect(suite.coverage.largestMaps.every((map) => map.width === 20 && map.height === 12)).toBe(
      true,
    );
    expect(suite.coverage.assemblies.length).toBeGreaterThanOrEqual(CONTENT.encounters.size);
    for (const encounter of CONTENT.encounters.values()) {
      const assemblies = suite.coverage.assemblies.filter(
        (entry) => entry.encounterId === encounter.id,
      );
      expect(assemblies.length).toBeGreaterThan(0);
      for (const variant of encounter.variants)
        expect(assemblies.some((entry) => entry.variantId === variant.id)).toBe(true);
      for (const conditional of encounter.conditionalEnemies) {
        expect(assemblies.some((entry) => entry.flags[conditional.flag] === true)).toBe(true);
        expect(assemblies.some((entry) => entry.flags[conditional.flag] === false)).toBe(true);
      }
    }
    expect(
      suite.coverage.assemblies.every(
        (entry) => entry.party === 6 && entry.total === entry.party + entry.allies + entry.enemies,
      ),
    ).toBe(true);
    expect(suite.coverage.maximumRoster).toBe(
      Math.max(...suite.coverage.assemblies.map((entry) => entry.total)),
    );
    expect(suite.coverage.maximumRosterKits.length).toBeGreaterThan(0);
    for (const maximum of suite.coverage.maximumRosterKits) {
      expect(maximum.kits.length).toBeGreaterThan(1);
      expect(
        suite.coverage.representatives
          .filter((actor) => actor.assembly === maximum.assembly)
          .map((actor) => actor.kit)
          .sort(),
      ).toEqual(maximum.kits);
    }
    const ids = suite.cases.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const map of largest) {
      expect(ids).toContain(`reachable/${map.id}`);
      expect(ids).toContain(`findPath/${map.id}`);
    }
    expect(suite.cases.filter((entry) => entry.kind === 'enemyTurn')).toHaveLength(
      suite.coverage.representatives.length,
    );
  });

  it('adds only the largest registered logical top-down board after the original eleven cases', () => {
    const registered = [...TOPDOWN_SCENES.keys()].map((id) => {
      const map = CONTENT.maps.get(id);
      if (!map) throw new Error(`Missing registered map ${id}`);
      return { id, width: map.width, height: map.height };
    });
    const maximum = Math.max(...registered.map((map) => map.width * map.height));
    expect(suite.coverage.topDown.included).toBe(true);
    expect(suite.coverage.topDown.registeredMaps).toEqual(registered);
    expect(suite.coverage.topDown.maximumArea).toBe(maximum);
    expect(suite.coverage.topDown.largestMaps).toEqual(
      registered.filter((map) => map.width * map.height === maximum),
    );
    expect(suite.coverage.topDown.largestMaps).toEqual([
      { id: 'ba_dan_village', width: 24, height: 16 },
    ]);
    const supplemental = createTopDownBenchSuite();
    expect(supplemental.cases.map((entry) => entry.id)).toEqual([
      'reachable/topdown/ba_dan_village',
      'findPath/topdown/ba_dan_village',
    ]);
    expect(suite.cases.slice(11).map((entry) => entry.id)).toEqual(
      supplemental.cases.map((entry) => entry.id),
    );
    expect(suite.cases.slice(0, 11).map((entry) => entry.id)).toEqual(
      Object.keys(BASELINE.cases).filter((id) => !id.includes('/topdown/')),
    );
    for (const entry of supplemental.cases) {
      expect(entry.detail).toMatchObject({
        width: 24,
        height: 16,
        reachableBudget: 6,
        props: 0,
        footprintSize: 1,
        peopleIgnoredForTerrainQuery: true,
      });
      expect(entry.detail.cornerSteps).toBeGreaterThanOrEqual(12);
      expect(entry.detail.cornerCost).toBeGreaterThan(0);
      entry.validate();
    }
  });

  it('preserves every original normalized baseline and ceiling through the top-down extension', () => {
    // Immutable acceptance data from the pre-extension original-main capture;
    // supplemental measurements must never replace these eleven quantities.
    const original = Object.fromEntries(
      Object.entries(BASELINE.cases)
        .filter(([id]) => !id.includes('/topdown/'))
        .map(([id, limit]) => [id, [limit.normalizedMedian, limit.ceiling]]),
    );
    expect(original).toEqual({
      'reachable/ambush_road': [51.19345507814065, 204.7738203125626],
      'findPath/ambush_road': [41.260388010128906, 165.04155204051563],
      'reachable/forest_road': [44.05665834268129, 176.22663337072515],
      'findPath/forest_road': [48.337323076581434, 193.34929230632574],
      'reachable/quarry_floor': [49.0313548449687, 196.1254193798748],
      'findPath/quarry_floor': [48.78378325593556, 195.13513302374224],
      'reachable/quarry_gate': [53.705799471576675, 214.8231978863067],
      'findPath/quarry_gate': [49.49213679236998, 197.96854716947993],
      'enemyTurn/enc_ambush/base/{}/e2': [46.708201655432, 186.832806621728],
      'enemyTurn/enc_ambush/base/{}/e4': [90.87394493441677, 363.4957797376671],
      'enemyTurn/enc_ambush/base/{}/e8': [82.9181578425303, 331.6726313701212],
    });
  });

  it('retains original provenance and binds only the supplemental cases to their merged-main capture', () => {
    expect(frozenBaseline.calibrationReportSha256).toBe(
      '675690b43e7376ac68b2bc501bf91ca63588d406a69d1807bf1cc4319c6d7978',
    );
    expect(frozenBaseline.calibrationHarnessSha256).toBe(
      '0e07ca8e26a4d42b4ee61ecd657522c5b2489cb7cf11a3119f2ddfd40dfca015',
    );
    expect(frozenBaseline.supplementalCalibrations).toEqual([
      {
        source: '25c5d611d216c4dead9ba9fae34ff7f797293e42',
        tree: '5754dcd4ab126b1bb06f04eb050302e4f348e9e9',
        caseIds: ['reachable/topdown/ba_dan_village', 'findPath/topdown/ba_dan_village'],
        calibrationReportSha256: '881e0b05545ccdb8aef55a472ae23327e7fe1d1f8ce3a55d06f3158e91d613c9',
        calibrationHarnessSha256:
          'ae7dd67a165fd72365cfaf3570d8bc69fb76af64935c3b4b09858f04bf5d00c8',
        calibrationDriverSha256: 'c1edb713399ff59cb5f7b3cc7938a3481cb8ed5dc201f15e8bb1a1562c253889',
        originalBaselineSha256: '780fe27936856fa5461d79b26ba16cd3fbd673a32e5fb5653911c40d33d4b22a',
      },
    ]);
    expect(
      createHash('sha256')
        .update(readFileSync(new URL('./core-bench.ts', import.meta.url)))
        .digest('hex'),
    ).toBe(frozenBaseline.supplementalCalibrations[0]?.calibrationHarnessSha256);
    expect(BASELINE.cases['reachable/topdown/ba_dan_village']).toEqual({
      normalizedMedian: 9.956649267866029,
      ceiling: 39.826597071464114,
    });
    expect(BASELINE.cases['findPath/topdown/ba_dan_village']).toEqual({
      normalizedMedian: 32.41192900675779,
      ceiling: 129.64771602703115,
    });
  });

  it('requires independently frozen limits for the complete case matrix', () => {
    expect(BASELINE.calibrated).toBe(true);
    expect(Object.keys(BASELINE.cases).sort()).toEqual(suite.cases.map((entry) => entry.id).sort());
    for (const limit of Object.values(BASELINE.cases)) {
      expect(Number.isFinite(limit.normalizedMedian) && limit.normalizedMedian > 0).toBe(true);
      expect(limit.ceiling).toBe(limit.normalizedMedian * 4);
    }
  });
});

describe('same-process normalized core performance', () => {
  it.each(suite.cases)('$id stays within its original frozen ceiling', (entry) => {
    const row = measureCoreBenchCase(entry);
    expect(row.samples).toHaveLength(11);
    expect(
      row.samples.every(
        (sample) =>
          Number.isFinite(sample.workMs) &&
          sample.workMs > 0 &&
          Number.isFinite(sample.referenceMs) &&
          sample.referenceMs > 0,
      ),
    ).toBe(true);
    expect(Number.isFinite(row.checksum) && row.checksum > 0).toBe(true);
    expect(caseBudgetIssues(row)).toEqual([]);
  });

  it('rejects eight actual reachable queries per work operation against the unchanged frozen limit', () => {
    const entry = suite.cases.find((candidate) => candidate.kind === 'reachable');
    if (!entry) throw new Error('Missing real reachable slowdown witness');
    const before = JSON.stringify(BASELINE);
    const slowed = measureCoreBenchCase({
      ...entry,
      workload: () => {
        let checksum = 0;
        for (let repetition = 0; repetition < 8; repetition++) checksum += entry.workload();
        return checksum;
      },
    });
    expect(caseBudgetIssues(slowed)).toEqual([expect.stringContaining('exceeds frozen ceiling')]);
    expect(JSON.stringify(BASELINE)).toBe(before);
  });
});

describe('paired-ratio and budget controls', () => {
  const samples = [
    { workMs: 1, referenceMs: 1 },
    { workMs: 100, referenceMs: 10 },
    { workMs: 100, referenceMs: 1000 },
  ];

  it('takes the median of paired ratios, preserving independent per-pair load scaling', () => {
    const summary = summarizePairs(samples);
    expect(summary.normalizedMedian).toBe(1);
    expect(summary.medianWorkMs / summary.medianReferenceMs).toBe(10);
    const scales = [2, 30, 0.2];
    expect(
      summarizePairs(
        samples.map((sample, index) => ({
          workMs: sample.workMs * (scales[index] ?? 1),
          referenceMs: sample.referenceMs * (scales[index] ?? 1),
        })),
      ).normalizedMedian,
    ).toBe(1);
    expect(
      summarizePairs(samples.map((sample) => ({ ...sample, workMs: sample.workMs * 8 })))
        .normalizedMedian,
    ).toBe(8);
  });

  it.each([0, -1, NaN, Infinity])(
    'rejects invalid measured times without a timer floor: %s',
    (invalid) => {
      expect(() => summarizePairs([{ workMs: invalid, referenceMs: 1 }])).toThrow(
        'positive and finite',
      );
      expect(() => summarizePairs([{ workMs: 1, referenceMs: invalid }])).toThrow(
        'positive and finite',
      );
    },
  );

  it('rejects overflow or underflow of otherwise positive finite paired times', () => {
    expect(() =>
      summarizePairs([{ workMs: Number.MAX_VALUE, referenceMs: Number.MIN_VALUE }]),
    ).toThrow('Paired ratio');
    expect(() =>
      summarizePairs([{ workMs: Number.MIN_VALUE, referenceMs: Number.MAX_VALUE }]),
    ).toThrow('Paired ratio');
  });

  it('rejects missing calibration, matrix omissions and altered sampling without recalibration', () => {
    const row: BenchRow = {
      id: 'control',
      kind: 'reachable',
      mapId: 'control',
      detail: {},
      batch: 32,
      samples: Array.from({ length: 11 }, () => ({ workMs: 1, referenceMs: 1 })),
      medianWorkMs: 1,
      medianReferenceMs: 1,
      normalizedMedian: 1,
      checksum: 1,
    };
    const baseline: BenchBaseline = {
      calibrationSource: 'control',
      calibrated: true,
      policy: POLICY,
      cases: { control: { normalizedMedian: 1, ceiling: 4 } },
    };
    expect(caseBudgetIssues(row, baseline)).toEqual([]);
    expect(caseBudgetIssues(row, { ...baseline, calibrated: false })).toEqual([
      expect.stringContaining('missing independently measured'),
    ]);
    expect(caseBudgetIssues({ ...row, batch: 1 }, baseline)).toEqual([
      expect.stringContaining('changed fixed sampling'),
    ]);
    expect(caseBudgetIssues({ ...row, normalizedMedian: NaN }, baseline)).toEqual([
      expect.stringContaining('invalid measured paired ratio'),
    ]);
    expect(
      caseBudgetIssues(row, {
        ...baseline,
        cases: { control: { normalizedMedian: 1, ceiling: 5 } },
      }),
    ).toEqual([expect.stringContaining('invalid frozen 4x')]);
    expect(
      caseBudgetIssues(row, {
        ...baseline,
        cases: { control: { normalizedMedian: Number.MAX_VALUE, ceiling: Infinity } },
      }),
    ).toEqual([expect.stringContaining('invalid frozen 4x')]);
    const report = { policy: POLICY, coverage: suite.coverage, rows: [row] };
    expect(() => assertCoreBenchBudgets(report, baseline)).not.toThrow();
    expect(() => assertCoreBenchBudgets({ ...report, rows: [] }, baseline)).toThrow('case matrix');
    expect(() =>
      assertCoreBenchBudgets(report, { ...baseline, policy: { ...POLICY, samples: 12 } }),
    ).toThrow('sampling policy');
  });
});
