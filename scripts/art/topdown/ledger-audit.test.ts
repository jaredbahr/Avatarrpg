import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const script = join(repo, 'prototypes/topdown/tools/ledger_audit.py');
const fixturePath = join(repo, 'prototypes/topdown/tools/testdata/ledger-audit-fixture.json');
const fixtureBytes = readFileSync(fixturePath);
const python = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');

function run(args: string[], cwd = repo) {
  return spawnSync(python, ['-I', script, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 10_000,
    windowsHide: true,
  });
}

function withTemporaryLedger(content: string, runTest: (path: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'avatar-ledger-audit-'));
  const path = join(directory, 'ledger.json');
  const tempRoot = resolve(tmpdir());
  const ownedDirectory = resolve(directory);
  if (
    dirname(ownedDirectory) !== tempRoot ||
    !basename(ownedDirectory).startsWith('avatar-ledger-audit-')
  )
    throw new Error(`Refusing to clean unexpected test path: ${directory}`);
  try {
    writeFileSync(path, content, 'utf8');
    runTest(path);
  } finally {
    rmSync(ownedDirectory, { recursive: true, force: true });
  }
}

function fixtureObject() {
  return JSON.parse(fixtureBytes.toString('utf8')) as {
    jobs: Array<Record<string, unknown>>;
  };
}

const invalidFieldCases: Array<[string, (ledger: ReturnType<typeof fixtureObject>) => void]> = [
  [
    'boolean credits',
    (ledger) => {
      const first = ledger.jobs[0];
      if (!first) throw new Error('Fixture has no first job.');
      first.credits = true;
    },
  ],
  [
    'numeric string balance_diff',
    (ledger) => {
      const first = ledger.jobs[0];
      if (!first) throw new Error('Fixture has no first job.');
      first.balance_diff = '10';
    },
  ],
];

describe('PixelLab ledger audit CLI', () => {
  it('separates booked credits, raw snapshot sums, missing deltas, and phase metadata', () => {
    const result = run(['--ledger', fixturePath, '--json']);
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout) as {
      input: { path: string; sha256: string };
      summary: Record<string, unknown>;
      t3_evidence: { present: boolean; job_count: number; has_phase_metadata: boolean };
      phases: Array<{
        prefix: string;
        job_count: number;
        booked_credits: number;
        row_balance_delta_sum: number;
        missing_balance_diff_count: number;
        phase_metadata: Record<string, unknown>;
        flags: Record<string, boolean | null>;
        job_balance_mismatches: Array<{ name: string }>;
      }>;
      unmapped_jobs: string[];
      unmapped_metadata_keys: string[];
      missing_phase_evidence: Array<{ prefix: string; no_jobs: boolean }>;
      exceptions: {
        zero_credit_jobs: string[];
        noncompleted_jobs: string[];
        missing_balance_diff_jobs: string[];
        job_booked_vs_delta_over_20_percent: Array<{ name: string }>;
      };
    };

    expect(report.input.sha256).toBe(createHash('sha256').update(fixtureBytes).digest('hex'));
    expect(report.summary).toMatchObject({
      job_count: 8,
      booked_credits: 19.95,
      row_balance_delta_sum: 20,
      missing_balance_diff_count: 1,
    });
    const t2 = report.phases.find((phase) => phase.prefix === 't2_');
    expect(t2).toMatchObject({
      job_count: 4,
      booked_credits: 13,
      row_balance_delta_sum: 14,
      missing_balance_diff_count: 1,
      flags: {
        booked_credits_vs_phase_delta_differs_over_tolerance: true,
        row_delta_sum_vs_phase_delta_differs_over_tolerance: true,
        booked_credits_vs_declared_ledger_spent_differs_over_tolerance: false,
        metadata_end_vs_last_listed_job_balance_after_differs_over_tolerance: true,
      },
    });
    expect(t2?.job_balance_mismatches.map((item) => item.name)).toEqual(['T2_over20']);
    expect(t2?.phase_metadata).toMatchObject({
      phase_balance_delta_start_minus_end: 10,
      declared_ledger_spent: 13,
      last_listed_job_name_with_balance_after: 't2_missing_delta',
      last_listed_job_balance_after: 86,
    });
    const t3 = report.phases.find((phase) => phase.prefix === 't3_');
    expect(report.t3_evidence).toEqual({ present: true, job_count: 2, has_phase_metadata: true });
    expect(t3).toMatchObject({
      booked_credits: 5,
      row_balance_delta_sum: 5,
      flags: {
        booked_credits_vs_phase_delta_differs_over_tolerance: true,
        row_delta_sum_vs_phase_delta_differs_over_tolerance: true,
        booked_credits_vs_declared_ledger_spent_differs_over_tolerance: true,
        metadata_end_vs_last_listed_job_balance_after_differs_over_tolerance: true,
      },
    });
    expect(report.unmapped_jobs).toEqual(['unmapped_job']);
    expect(report.unmapped_metadata_keys).toContain('t2_note');
    expect(report.missing_phase_evidence).toContainEqual(
      expect.objectContaining({ prefix: 't4_', no_jobs: true }),
    );
    expect(report.missing_phase_evidence.some((item) => item.prefix === 't2_')).toBe(false);
    expect(report.phases.find((phase) => phase.prefix === 't5_')).toMatchObject({
      flags: {
        booked_credits_vs_phase_delta_differs_over_tolerance: true,
        row_delta_sum_vs_phase_delta_differs_over_tolerance: false,
      },
      job_balance_mismatches: [],
    });
    expect(report.exceptions.zero_credit_jobs).toEqual(['t2_zero', 't2_missing_delta']);
    expect(report.exceptions.noncompleted_jobs).toEqual(['t2_missing_delta', 'unmapped_job']);
    expect(report.exceptions.missing_balance_diff_jobs).toEqual(['t2_missing_delta']);
    expect(
      report.exceptions.job_booked_vs_delta_over_20_percent.map((item) =>
        typeof item === 'string' ? item : item.name,
      ),
    ).toEqual(['T2_over20', 'unmapped_job']);

    const first = fixtureBytes.toString('utf8');
    expect(readFileSync(fixturePath, 'utf8')).toBe(first);
  });

  it.each(invalidFieldCases)('rejects %s rather than coercing it', (_label, mutate) => {
    const ledger = fixtureObject();
    mutate(ledger);
    withTemporaryLedger(JSON.stringify(ledger), (path) => {
      const result = run(['--ledger', path, '--json']);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('must be a JSON number');
    });
  });

  it('rejects non-standard non-finite JSON numbers', () => {
    const malformed = fixtureBytes.toString('utf8').replace('"credits": 8', '"credits": NaN');
    expect(malformed).not.toBe(fixtureBytes.toString('utf8'));
    withTemporaryLedger(malformed, (path) => {
      const result = run(['--ledger', path, '--json']);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('non-standard JSON number');
    });
  });

  it('rejects duplicate JSON keys instead of accepting the last value', () => {
    const duplicate = '{"jobs": [], "jobs": []}';
    withTemporaryLedger(duplicate, (path) => {
      const result = run(['--ledger', path, '--json']);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('duplicate JSON object key');
    });
  });

  it('rejects phase metadata keys that collide after case folding', () => {
    const ledger = fixtureObject() as ReturnType<typeof fixtureObject> & Record<string, unknown>;
    ledger.T2_start_balance = 100;
    withTemporaryLedger(JSON.stringify(ledger), (path) => {
      const result = run(['--ledger', path, '--json']);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('case-folded phase metadata collision');
    });
  });
});
