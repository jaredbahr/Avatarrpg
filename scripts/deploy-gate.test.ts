import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dispatchCommand } from './deploy-gate.mjs';

const SHA = 'd22c4572dd630aaf43152704a93a27ecde516ab7';
const OTHER_SHA = 'e137a48b5528ed97e4d755c2046dba099c4b405f';
const WORKFLOW_ID = 55;
const WORKFLOW_PATH = '.github/workflows/ci.yml';
type RunRecord = {
  id: number;
  workflow_id: number;
  path: string;
  event: string;
  head_branch: string;
  head_sha: string;
  run_attempt: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  head_repository: { full_name: string };
  html_url: string;
};
type WorkflowRecord = { id: number; path: string; state: string };
type StepRecord = { name: string; status: string; conclusion: string };
type JobRecord = {
  id: number;
  run_id: number;
  head_sha: string;
  name: string;
  status: string;
  conclusion: string;
  steps: StepRecord[];
};
type ArtifactRecord = {
  id: number;
  name: string;
  expired: boolean;
  workflow_run: { id: number; head_sha: string; head_branch: string };
};
type EvidenceRecord = {
  sha: string;
  ci_run_id: string;
  ci_run_attempt: string;
  ci_workflow_id: string;
  ci_workflow_path: string;
  ci_event: string;
  ci_url: string;
  ci_job_ids: string;
  artifact_name: string;
};
const context = (event = 'push', overrides: Record<string, string> = {}) => ({
  GITHUB_REPOSITORY: 'jaredbahr/Avatarrpg',
  GITHUB_SHA: SHA,
  GITHUB_REF: 'refs/heads/main',
  GITHUB_EVENT_NAME: event,
  GITHUB_TOKEN: 'fixture-token',
  GITHUB_RUN_ID: '9900',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_API_URL: 'https://api.github.com',
  ...overrides,
});
const run = (overrides: Partial<RunRecord> = {}) => {
  const item = {
    id: 4242,
    workflow_id: WORKFLOW_ID,
    path: `${WORKFLOW_PATH}@main`,
    event: 'push',
    head_branch: 'main',
    head_sha: SHA,
    run_attempt: 1,
    status: 'completed',
    conclusion: 'success',
    created_at: '2026-11-09T09:00:00Z',
    head_repository: { full_name: 'jaredbahr/Avatarrpg' },
    html_url: 'https://github.com/jaredbahr/Avatarrpg/actions/runs/4242',
    ...overrides,
  };
  item.html_url = `https://github.com/jaredbahr/Avatarrpg/actions/runs/${item.id}`;
  return item;
};
const workflow = (overrides: Partial<WorkflowRecord> = {}) => ({
  id: WORKFLOW_ID,
  path: WORKFLOW_PATH,
  state: 'active',
  ...overrides,
});
const step = (name: string, overrides: Partial<StepRecord> = {}): StepRecord => ({
  name,
  status: 'completed',
  conclusion: 'success',
  ...overrides,
});
const requiredJobs = (runId = 4242, headSha = SHA, firstId = 700): JobRecord[] => {
  const verifySteps = [
    'Typecheck',
    'Lint',
    'Format check',
    'Check generated content reference',
    'Unit + content-validation + simulator tests',
    'Build',
    'Check bundle budget (380 KB gzipped)',
    'Check every sheet in the manifest against its files',
    'Check asset budget (4 MB a family, 25 MB precached)',
    'Balance report',
  ].map((name) => step(name));
  const names = [
    'Typecheck, lint, unit tests',
    'End-to-end (Chromium touch, WebKit iPad)',
    'Screenshot gallery',
    'E2E Chromium touch 1/3',
    'E2E Chromium touch 2/3',
    'E2E Chromium touch 3/3',
    'E2E WebKit iPad 1/3',
    'E2E WebKit iPad 2/3',
    'E2E WebKit iPad 3/3',
  ];
  return names.map((name, index) => ({
    id: firstId + index,
    run_id: runId,
    head_sha: headSha,
    name,
    status: 'completed',
    conclusion: 'success',
    steps:
      name === names[0]
        ? verifySteps
        : name === names[1]
          ? [step('Require the browser suites (or, on a pull request, verify alone)')]
          : name === names[2]
            ? [step('Require every gallery shard (or, when they were skipped, verify)')]
            : [step('Run e2e suite')],
  }));
};
const artifactName = (ciId = 4242, ciAttempt = 1, deployId = 9900, deployAttempt = 1) =>
  `pages-${SHA}-ci${ciId}-a${ciAttempt}-deploy${deployId}-a${deployAttempt}`;
const artifact = (overrides: Partial<ArtifactRecord> = {}): ArtifactRecord => ({
  id: 8080,
  name: artifactName(),
  expired: false,
  workflow_run: { id: 9900, head_sha: SHA, head_branch: 'main' },
  ...overrides,
});
const json = (value: unknown, status = 200, extra: { redirected?: boolean } = {}) => ({
  status,
  json: async () => value,
  ...extra,
});
type FixtureOptions = {
  runs?: RunRecord[];
  listResponseSets?: RunRecord[][];
  jobs?: JobRecord[];
  jobsResponseSets?: JobRecord[][];
  details?: RunRecord[];
  workflowMetadata?: WorkflowRecord;
  refSha?: string;
  artifacts?: ArtifactRecord[];
  onRequest?: (url: URL, init: RequestInit | undefined) => void;
};
function githubFixture(options: FixtureOptions = {}) {
  const {
    runs = [run()],
    listResponseSets,
    jobs = requiredJobs(),
    jobsResponseSets,
    details,
    workflowMetadata = workflow(),
    refSha = SHA,
    artifacts = [artifact()],
    onRequest,
  } = options;
  let listCalls = 0;
  let activeRuns = runs;
  let jobsCalls = 0;
  let activeJobs = jobs;
  let detailCalls = 0;
  const requests: Array<{ url: URL; init: RequestInit | undefined }> = [];
  return {
    requests,
    fetch: async (url: URL | string, init?: RequestInit) => {
      const parsed = new URL(url);
      requests.push({ url: parsed, init });
      onRequest?.(parsed, init);
      if (parsed.origin !== 'https://api.github.com')
        throw new Error('Mock received a non-GitHub API origin.');
      if (parsed.pathname === '/repos/jaredbahr/Avatarrpg')
        return json({ full_name: 'jaredbahr/Avatarrpg', default_branch: 'main' });
      if (parsed.pathname === '/repos/jaredbahr/Avatarrpg/git/ref/heads/main')
        return json({ object: { sha: refSha } });
      if (parsed.pathname === `/repos/jaredbahr/Avatarrpg/actions/workflows/ci.yml`)
        return json(workflowMetadata);
      if (parsed.pathname === '/repos/jaredbahr/Avatarrpg/actions/workflows/ci.yml/runs') {
        const page = Number(parsed.searchParams.get('page'));
        if (page === 1) {
          activeRuns = listResponseSets?.[Math.min(listCalls, listResponseSets.length - 1)] ?? runs;
          listCalls += 1;
        }
        const start = (page - 1) * 100;
        return json({
          total_count: activeRuns.length,
          workflow_runs: activeRuns.slice(start, start + 100),
        });
      }
      const detailMatch = parsed.pathname.match(/\/actions\/runs\/(\d+)$/);
      if (detailMatch) {
        const id = Number(detailMatch[1]);
        const result = details?.[Math.min(detailCalls, details.length - 1)];
        detailCalls += 1;
        return json(result ?? runs.find((candidate) => candidate.id === id) ?? run({ id }));
      }
      const jobsMatch = parsed.pathname.match(/\/actions\/runs\/(\d+)\/attempts\/(\d+)\/jobs$/);
      if (jobsMatch) {
        if (
          Number(jobsMatch[1]) !== Number(activeRuns.at(-1)?.id) &&
          !runs.some((candidate) => candidate.id === Number(jobsMatch[1]))
        ) {
          throw new Error('Attempt jobs request did not use a listed CI run.');
        }
        const page = Number(parsed.searchParams.get('page'));
        if (page === 1) {
          activeJobs = jobsResponseSets?.[Math.min(jobsCalls, jobsResponseSets.length - 1)] ?? jobs;
          jobsCalls += 1;
        }
        const start = (page - 1) * 100;
        return json({ total_count: activeJobs.length, jobs: activeJobs.slice(start, start + 100) });
      }
      if (parsed.pathname === '/repos/jaredbahr/Avatarrpg/actions/runs/9900/artifacts')
        return json({ total_count: artifacts.length, artifacts });
      return json({ message: 'unexpected fixture route' }, 404);
    },
  };
}

const capture = () => {
  const values: Array<EvidenceRecord & { artifact_id?: string }> = [];
  return {
    values,
    writeOutput: async (value: EvidenceRecord & { artifact_id?: string }) => {
      values.push({ ...value });
    },
  };
};
const select = (
  fixture: ReturnType<typeof githubFixture>,
  event = 'push',
  overrides: Record<string, string> = {},
) => {
  const output = capture();
  return dispatchCommand({
    mode: 'select',
    env: context(event, overrides),
    fetchImpl: fixture.fetch,
    writeOutput: output.writeOutput,
  }).then((evidence) => ({ evidence, output, fixture }));
};
const revalidateEnv = (
  evidence: EvidenceRecord,
  stage: string,
  overrides: Record<string, string> = {},
) => ({
  ...context('push'),
  DEPLOY_GATE_STAGE: stage,
  DEPLOY_SHA: evidence.sha,
  DEPLOY_CI_RUN_ID: evidence.ci_run_id,
  DEPLOY_CI_RUN_ATTEMPT: evidence.ci_run_attempt,
  DEPLOY_CI_WORKFLOW_ID: evidence.ci_workflow_id,
  DEPLOY_CI_WORKFLOW_PATH: evidence.ci_workflow_path,
  DEPLOY_CI_EVENT: evidence.ci_event,
  DEPLOY_CI_JOB_IDS: evidence.ci_job_ids,
  DEPLOY_ARTIFACT_NAME: evidence.artifact_name,
  ...(stage === 'before-publish' ? { DEPLOY_ARTIFACT_ID: '8080' } : {}),
  ...overrides,
});
const invokeRevalidate = (
  fixture: ReturnType<typeof githubFixture>,
  evidence: EvidenceRecord,
  stage: string,
  overrides: Record<string, string> = {},
) => {
  const output = capture();
  return dispatchCommand({
    mode: 'revalidate',
    env: revalidateEnv(evidence, stage, overrides),
    fetchImpl: fixture.fetch,
    writeOutput: output.writeOutput,
  }).then((result) => ({ result, output }));
};

const expectedEvidence = (event = 'push'): EvidenceRecord => ({
  sha: SHA,
  ci_run_id: '4242',
  ci_run_attempt: '1',
  ci_workflow_id: String(WORKFLOW_ID),
  ci_workflow_path: WORKFLOW_PATH,
  ci_event: event,
  ci_url: 'https://github.com/jaredbahr/Avatarrpg/actions/runs/4242',
  ci_job_ids: '700,701,702,703,704,705,706,707,708',
  artifact_name: artifactName(),
});
const jobAt = (jobs: JobRecord[], index: number): JobRecord => {
  const job = jobs[index];
  if (!job) throw new Error(`Missing fixture job at index ${index}.`);
  return job;
};
const stepAt = (job: JobRecord, index: number): StepRecord => {
  const item = job.steps[index];
  if (!item) throw new Error(`Missing fixture step at index ${index}.`);
  return item;
};
const rejectedRunFixtures: Array<[string, FixtureOptions]> = [
  ['missing exact-SHA CI', { runs: [] }],
  ['wrong SHA', { runs: [run({ head_sha: OTHER_SHA })] }],
  ['verification-only PR', { runs: [run({ event: 'pull_request' })] }],
  [
    'failed newest run without older-green fallback',
    {
      runs: [run({ id: 4241, created_at: '2026-11-08T09:00:00Z' }), run({ conclusion: 'failure' })],
    },
  ],
  [
    'running newest run without older-green fallback',
    {
      runs: [
        run({ id: 4241, created_at: '2026-11-08T09:00:00Z' }),
        run({ status: 'in_progress', conclusion: null }),
      ],
    },
  ],
  [
    'cancelled newest run without older-green fallback',
    {
      runs: [
        run({ id: 4241, created_at: '2026-11-08T09:00:00Z' }),
        run({ conclusion: 'cancelled' }),
      ],
    },
  ],
  ['wrong workflow ID or path', { runs: [run({ workflow_id: 56 })] }],
];
const rejectedBrowserEvidence: Array<[string, (jobs: JobRecord[]) => void]> = [
  [
    'browser shard skipped',
    (jobs) => {
      jobAt(jobs, 3).conclusion = 'skipped';
    },
  ],
  [
    'browser suite step failed',
    (jobs) => {
      stepAt(jobAt(jobs, 8), 0).conclusion = 'failure';
    },
  ],
  [
    'browser suite step skipped',
    (jobs) => {
      stepAt(jobAt(jobs, 8), 0).conclusion = 'skipped';
    },
  ],
  [
    'browser suite step missing',
    (jobs) => {
      jobAt(jobs, 8).steps = [];
    },
  ],
  [
    'browser shard missing',
    (jobs) => {
      jobs.splice(8, 1);
    },
  ],
  [
    'duplicate browser shard',
    (jobs) => {
      jobs.push({ ...jobAt(jobs, 3), id: 999 });
    },
  ],
  [
    'idle schedule with browser shards skipped',
    (jobs) => {
      for (const job of jobs.slice(3)) job.conclusion = 'skipped';
    },
  ],
  [
    'verification step failed',
    (jobs) => {
      stepAt(jobAt(jobs, 0), 0).conclusion = 'failure';
    },
  ],
];

describe('Pages deployment gate command dispatcher', () => {
  it.each(['push', 'schedule', 'workflow_dispatch'])(
    'selects successful %s main CI through the production dispatcher',
    async (event: string) => {
      const fixture = githubFixture({ runs: [run({ event })] });
      const { evidence, output } = await select(fixture, event);
      expect(evidence).toEqual(expectedEvidence(event));
      expect(output.values).toEqual([evidence]);
      expect(fixture.requests.every(({ url }) => url.origin === 'https://api.github.com')).toBe(
        true,
      );
      expect(
        fixture.requests.some(
          ({ url }) =>
            url.pathname.endsWith('/workflows/ci.yml/runs') && !url.searchParams.has('status'),
        ),
      ).toBe(true);
      expect(fixture.requests.some(({ url }) => url.pathname.endsWith('/attempts/1/jobs'))).toBe(
        true,
      );
    },
  );

  it('rejects manual dispatch on a non-main ref before any API request or output', async () => {
    const fixture = githubFixture();
    const output = capture();
    await expect(
      dispatchCommand({
        mode: 'select',
        env: context('workflow_dispatch', { GITHUB_REF: 'refs/heads/preview' }),
        fetchImpl: fixture.fetch,
        writeOutput: output.writeOutput,
      }),
    ).rejects.toThrow(/refs\/heads\/main/);
    expect(fixture.requests).toHaveLength(0);
    expect(output.values).toHaveLength(0);
  });

  it.each(rejectedRunFixtures)(
    'rejects %s in the real select command before emitting outputs',
    async (_label: string, options: FixtureOptions) => {
      const fixture = githubFixture(options);
      const output = capture();
      await expect(
        dispatchCommand({
          mode: 'select',
          env: context(),
          fetchImpl: fixture.fetch,
          writeOutput: output.writeOutput,
        }),
      ).rejects.toThrow();
      expect(output.values).toHaveLength(0);
    },
  );

  it.each(rejectedBrowserEvidence)(
    'rejects a successful aggregate with a %s',
    async (_label: string, mutate: (jobs: JobRecord[]) => void) => {
      const jobs = requiredJobs();
      mutate(jobs);
      const fixture = githubFixture({ jobs });
      await expect(select(fixture, 'schedule')).rejects.toThrow();
    },
  );

  it('accepts required jobs on page two for a uniquely newest run and exact attempt', async () => {
    const olderRuns = Array.from({ length: 100 }, (_, index) =>
      run({
        id: 4100 + index,
        created_at: '2026-11-08T09:00:00Z',
      }),
    );
    const selectedRun = run({ id: 5000, run_attempt: 3, created_at: '2026-11-09T12:00:00Z' });
    const runs = [...olderRuns, selectedRun];
    const fillerJobs = Array.from({ length: 100 }, (_, index) => ({
      id: 9000 + index,
      run_id: selectedRun.id,
      head_sha: SHA,
      name: `Unrelated successful job ${index}`,
      status: 'completed',
      conclusion: 'success',
      steps: [step('Extra')],
    }));
    const jobs = [...fillerJobs, ...requiredJobs(selectedRun.id, SHA, 700)];
    const fixture = githubFixture({ runs, jobs });
    const { evidence } = await select(fixture);
    expect(evidence.ci_run_id).toBe('5000');
    expect(evidence.ci_run_attempt).toBe('3');
    expect(evidence.ci_job_ids).toBe('700,701,702,703,704,705,706,707,708');
    const runPage2 = fixture.requests.filter(
      ({ url }) =>
        url.pathname.endsWith('/workflows/ci.yml/runs') && url.searchParams.get('page') === '2',
    );
    const jobsPage2 = fixture.requests.filter(
      ({ url }) =>
        url.pathname.endsWith('/attempts/3/jobs') && url.searchParams.get('page') === '2',
    );
    expect(runPage2).toHaveLength(2);
    expect(jobsPage2).toHaveLength(2);
    expect(
      fixture.requests.filter(({ url }) => url.pathname.endsWith('/attempts/3/jobs')).length,
    ).toBe(4);
    expect(
      fixture.requests.some(
        ({ url }) => url.pathname === '/repos/jaredbahr/Avatarrpg/actions/runs/5000',
      ),
    ).toBe(true);
  });

  it('rejects a final latest-run listing that changes the same run to failed', async () => {
    const fixture = githubFixture({
      listResponseSets: [[run()], [run({ conclusion: 'failure' })]],
    });
    const output = capture();
    await expect(
      dispatchCommand({
        mode: 'select',
        env: context(),
        fetchImpl: fixture.fetch,
        writeOutput: output.writeOutput,
      }),
    ).rejects.toThrow(/newest eligible CI run changed or is not successful/);
    expect(output.values).toHaveLength(0);
  });

  it('rejects workflow, attempt, terminal status, or job-ID changes during collection', async () => {
    const evidence = expectedEvidence();
    const workflowChanged = githubFixture({ workflowMetadata: workflow({ id: 56 }) });
    await expect(invokeRevalidate(workflowChanged, evidence, 'before-publish')).rejects.toThrow(
      /workflow identity changed/,
    );
    const pathChanged = githubFixture({
      workflowMetadata: workflow({ path: '.github/workflows/other.yml' }),
    });
    await expect(invokeRevalidate(pathChanged, evidence, 'before-publish')).rejects.toThrow(
      /workflow metadata/,
    );

    const attemptChanged = githubFixture({ details: [run(), run({ run_attempt: 2 })] });
    await expect(invokeRevalidate(attemptChanged, evidence, 'before-publish')).rejects.toThrow(
      /selected CI run changed/,
    );

    const workflowChangesDuringRead = githubFixture({ details: [run(), run({ workflow_id: 56 })] });
    await expect(
      invokeRevalidate(workflowChangesDuringRead, evidence, 'before-publish'),
    ).rejects.toThrow(/CI run identity/);

    const terminalStatusChangesDuringRead = githubFixture({
      details: [run(), run({ status: 'in_progress', conclusion: null })],
    });
    await expect(
      invokeRevalidate(terminalStatusChangesDuringRead, evidence, 'before-publish'),
    ).rejects.toThrow(/selected CI run changed/);

    const finalFailure = githubFixture({ listResponseSets: [[run({ conclusion: 'failure' })]] });
    await expect(invokeRevalidate(finalFailure, evidence, 'before-publish')).rejects.toThrow(
      /newest eligible CI run changed or is not successful/,
    );

    const wrongFinalWorkflow = githubFixture({ listResponseSets: [[run({ workflow_id: 56 })]] });
    await expect(invokeRevalidate(wrongFinalWorkflow, evidence, 'before-publish')).rejects.toThrow(
      /CI run identity/,
    );

    const changedJobs = [requiredJobs(), requiredJobs(4242, SHA, 800)];
    const changedJobFixture = githubFixture({ jobsResponseSets: changedJobs });
    await expect(invokeRevalidate(changedJobFixture, evidence, 'before-publish')).rejects.toThrow(
      /job identities changed/,
    );
  });

  it('rejects a changed main head on the real pre-publish dispatcher', async () => {
    const fixture = githubFixture({ refSha: OTHER_SHA });
    await expect(invokeRevalidate(fixture, expectedEvidence(), 'before-publish')).rejects.toThrow(
      /live main head/,
    );
  });

  it('rejects an API base that could redirect the token destination', async () => {
    const fixture = githubFixture();
    await expect(
      select(fixture, 'push', { GITHUB_API_URL: 'http://attacker.invalid' }),
    ).rejects.toThrow(/API base URL/);
    expect(fixture.requests).toHaveLength(0);
  });

  it('rejects failed, redirected, malformed and incomplete API responses', async () => {
    const failFetch = async () => json({}, 503);
    await expect(
      dispatchCommand({
        mode: 'select',
        env: context(),
        fetchImpl: failFetch,
        writeOutput: capture().writeOutput,
      }),
    ).rejects.toThrow(/HTTP 503/);
    const redirect = async () => json({}, 200, { redirected: true });
    await expect(
      dispatchCommand({
        mode: 'select',
        env: context(),
        fetchImpl: redirect,
        writeOutput: capture().writeOutput,
      }),
    ).rejects.toThrow(/redirected/);
    const incomplete = githubFixture({
      runs: Array.from({ length: 101 }, (_, index) => run({ id: 6000 + index })),
    });
    const truncateSecondPage = async (url: URL | string, init?: RequestInit) => {
      const parsed = new URL(url);
      if (
        parsed.pathname.endsWith('/workflows/ci.yml/runs') &&
        parsed.searchParams.get('page') === '2'
      )
        return json({ total_count: 101, workflow_runs: [] });
      return incomplete.fetch(url, init);
    };
    await expect(
      dispatchCommand({
        mode: 'select',
        env: context(),
        fetchImpl: truncateSecondPage,
        writeOutput: capture().writeOutput,
      }),
    ).rejects.toThrow(/truncated|incomplete/);
    const duplicated = githubFixture({ runs: [run(), run()] });
    await expect(select(duplicated)).rejects.toThrow(/duplicate CI run IDs/);
  });

  it('checks selected artifact name, ID, run, head, expiry and duplicate names on real publish revalidation', async () => {
    const evidence = expectedEvidence();
    const missingId = githubFixture();
    await expect(
      invokeRevalidate(missingId, evidence, 'before-publish', { DEPLOY_ARTIFACT_ID: '' }),
    ).rejects.toThrow(/artifact ID is missing or invalid/);
    const wrongId = githubFixture();
    await expect(
      invokeRevalidate(wrongId, evidence, 'before-publish', { DEPLOY_ARTIFACT_ID: '8081' }),
    ).rejects.toThrow(/ID does not uniquely select/);

    const wrongHead = githubFixture({
      artifacts: [
        artifact({ workflow_run: { id: 9900, head_sha: OTHER_SHA, head_branch: 'main' } }),
      ],
    });
    await expect(invokeRevalidate(wrongHead, evidence, 'before-publish')).rejects.toThrow(
      /artifact metadata/,
    );

    const wrongRun = githubFixture({
      artifacts: [artifact({ workflow_run: { id: 9901, head_sha: SHA, head_branch: 'main' } })],
    });
    await expect(invokeRevalidate(wrongRun, evidence, 'before-publish')).rejects.toThrow(
      /artifact metadata/,
    );

    const duplicateName = githubFixture({ artifacts: [artifact(), artifact({ id: 8081 })] });
    await expect(invokeRevalidate(duplicateName, evidence, 'before-publish')).rejects.toThrow(
      /name is missing or duplicated/,
    );

    const expired = githubFixture({ artifacts: [artifact({ expired: true })] });
    await expect(invokeRevalidate(expired, evidence, 'before-publish')).rejects.toThrow(
      /artifact metadata/,
    );
  });

  it('runs all three real revalidation commands and captures their frozen outputs', async () => {
    const fixture = githubFixture();
    const { evidence } = await select(fixture);
    for (const stage of ['before-build', 'before-upload', 'before-publish']) {
      const { output, result } = await invokeRevalidate(fixture, evidence, stage);
      expect(result.evidence).toMatchObject(evidence);
      expect(output.values).toHaveLength(1);
      expect(output.values[0]).toMatchObject(evidence);
      if (stage === 'before-publish')
        expect(output.values[0]).toMatchObject({
          artifact_id: '8080',
          artifact_name: evidence.artifact_name,
        });
    }
  });

  it('checks deploy workflow job ordering and exact output bindings structurally', () => {
    const workflowText = readFileSync(
      new URL('../.github/workflows/deploy.yml', import.meta.url),
      'utf8',
    ).replaceAll('\r\n', '\n');
    const scriptText = readFileSync(new URL('./deploy-gate.mjs', import.meta.url), 'utf8');
    const vitestConfig = readFileSync(new URL('../vitest.config.ts', import.meta.url), 'utf8');
    const jobBlock = (name: string, nextName: string) => {
      const start = workflowText.indexOf(`  ${name}:\n`);
      const end = workflowText.indexOf(`  ${nextName}:\n`, start + 1);
      expect(start).toBeGreaterThanOrEqual(0);
      return workflowText.slice(start, end < 0 ? undefined : end);
    };
    const namedStep = (job: string, name: string) => {
      const start = job.indexOf(`- name: ${name}`);
      const end = job.indexOf('\n      - ', start + 1);
      expect(start).toBeGreaterThanOrEqual(0);
      return job.slice(start, end < 0 ? undefined : end);
    };
    const freshness = jobBlock('freshness', 'build');
    const build = jobBlock('build', 'deploy');
    const deploy = workflowText.slice(workflowText.indexOf('  deploy:\n'));
    expect(freshness).toContain('name: Require successful exact-SHA main CI');
    expect(workflowText.indexOf('name: Require successful exact-SHA main CI')).toBeLessThan(
      workflowText.indexOf('  build:'),
    );
    expect(build.indexOf('name: Revalidate main and CI before install/build')).toBeLessThan(
      build.indexOf('uses: actions/setup-node@v4'),
    );
    expect(build.indexOf('name: Revalidate main and CI before install/build')).toBeLessThan(
      build.indexOf('run: npm ci'),
    );
    expect(build.indexOf('run: npm ci')).toBeLessThan(build.indexOf('run: npm run build'));
    expect(build.indexOf('name: Revalidate main and CI before artifact upload')).toBeLessThan(
      build.indexOf('uses: actions/upload-pages-artifact@v3'),
    );
    expect(deploy.indexOf('name: Final main, CI and artifact identity check')).toBeLessThan(
      deploy.indexOf('uses: actions/deploy-pages@v4'),
    );
    expect(deploy).toContain('artifact_name: ${{ needs.freshness.outputs.artifact_name }}');
    expect(deploy).toContain('DEPLOY_ARTIFACT_ID: ${{ needs.build.outputs.artifact_id }}');
    for (const [job, stepName, expectedStage] of [
      [build, 'Revalidate main and CI before install/build', 'before-build'],
      [build, 'Revalidate main and CI before artifact upload', 'before-upload'],
      [deploy, 'Final main, CI and artifact identity check', 'before-publish'],
    ] as const) {
      const block = namedStep(job, stepName);
      expect(block).toContain(`DEPLOY_GATE_STAGE: ${expectedStage}`);
      expect(block).toContain(
        'DEPLOY_CI_WORKFLOW_ID: ${{ needs.freshness.outputs.ci_workflow_id }}',
      );
      expect(block).toContain(
        'DEPLOY_CI_WORKFLOW_PATH: ${{ needs.freshness.outputs.ci_workflow_path }}',
      );
      expect(block).toContain('DEPLOY_CI_EVENT: ${{ needs.freshness.outputs.ci_event }}');
      expect(block).toContain('DEPLOY_CI_JOB_IDS: ${{ needs.freshness.outputs.ci_job_ids }}');
      expect(block).toContain('run: node scripts/deploy-gate.mjs revalidate');
    }
    expect(scriptText).toContain(
      'await verifyArtifactMetadata(env, expected, env.DEPLOY_ARTIFACT_ID, fetchImpl)',
    );
    expect(scriptText).toContain('export async function dispatchCommand');
    expect(scriptText).toContain(
      'return dispatchCommand({ mode: process.argv[2], env: process.env });',
    );
    expect(vitestConfig).toContain("include: ['src/**/*.test.ts', 'scripts/**/*.test.ts']");
    expect(workflowText).toContain("- cron: '0 10 * * *'");
    expect(workflowText).not.toMatch(/^\s+push:/m);
    expect(workflowText).toContain('continue-on-error: true');
    expect(workflowText).not.toContain('retention-days:');
  });
});
