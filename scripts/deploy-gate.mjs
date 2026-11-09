import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL, URLSearchParams } from 'node:url';

const CI_WORKFLOW_PATH = '.github/workflows/ci.yml';
const REQUIRED_EVENTS = new Set(['push', 'schedule', 'workflow_dispatch']);
const REQUIRED_JOB_NAMES = [
  'Typecheck, lint, unit tests',
  'End-to-end (Chromium touch, WebKit iPad)',
  'Screenshot gallery',
];
const VERIFY_STEPS = [
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
];
const BROWSER_JOB_NAMES = [
  'E2E Chromium touch 1/3',
  'E2E Chromium touch 2/3',
  'E2E Chromium touch 3/3',
  'E2E WebKit iPad 1/3',
  'E2E WebKit iPad 2/3',
  'E2E WebKit iPad 3/3',
];
const MAX_PAGES = 10;
const PAGE_SIZE = 100;

export class GateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GateError';
  }
}

const fail = (message) => {
  throw new GateError(message);
};
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const sameRepo = (a, b) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase();
const validSha = (value) => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
const validId = (value) => Number.isSafeInteger(value) && value > 0;
const successful = (value) => value?.status === 'completed' && value?.conclusion === 'success';
const isoTime = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const appendOutput = async (values, outputPath) => {
  if (!outputPath) return;
  const lines = Object.entries(values).map(([key, value]) => {
    const text = String(value);
    if (!/^[a-z][a-z0-9_]*$/.test(key) || /[\r\n]/.test(text))
      fail('A deployment output value is malformed.');
    return `${key}=${text}`;
  });
  await appendFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
};

function normalizedContext(env) {
  const repo = env.GITHUB_REPOSITORY;
  const [owner, name, ...rest] = typeof repo === 'string' ? repo.split('/') : [];
  if (!owner || !name || rest.length) fail('GITHUB_REPOSITORY is invalid.');
  if (!validSha(env.GITHUB_SHA)) fail('The workflow SHA is not a canonical 40-character commit.');
  if (env.GITHUB_REF !== 'refs/heads/main')
    fail('Pages publication is allowed only from refs/heads/main.');
  if (!REQUIRED_EVENTS.has(env.GITHUB_EVENT_NAME))
    fail('This workflow event is not eligible for Pages publication.');
  if (!env.GITHUB_TOKEN) fail('The read-only GitHub token is unavailable.');
  const apiBase = env.GITHUB_API_URL || 'https://api.github.com';
  let parsed;
  try {
    parsed = new URL(apiBase);
  } catch {
    fail('The GitHub API base URL is invalid.');
  }
  if (
    parsed.origin !== 'https://api.github.com' ||
    !['', '/'].includes(parsed.pathname) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    fail('The GitHub API base URL is invalid.');
  }
  const context = {
    repo: `${owner}/${name}`,
    owner,
    name,
    sha: env.GITHUB_SHA.toLowerCase(),
    ref: env.GITHUB_REF,
    event: env.GITHUB_EVENT_NAME,
    apiBase: 'https://api.github.com',
    token: env.GITHUB_TOKEN,
    runId: Number(env.GITHUB_RUN_ID),
    runAttempt: Number(env.GITHUB_RUN_ATTEMPT),
  };
  if (
    !validId(context.runId) ||
    !Number.isSafeInteger(context.runAttempt) ||
    context.runAttempt < 1
  ) {
    fail('The current Pages workflow run identity is invalid.');
  }
  return context;
}

function makeClient(context, fetchImpl) {
  if (typeof fetchImpl !== 'function') fail('A fetch implementation is required.');
  const root = new URL(context.apiBase);
  const basePath = root.pathname.replace(/\/$/, '');
  const request = async (pathOrUrl) => {
    const url = new URL(`${basePath}/${String(pathOrUrl).replace(/^\/+/, '')}`, root.origin);
    if (url.origin !== root.origin || !url.pathname.startsWith(`${basePath}/`))
      fail('GitHub returned a URL outside the configured API.');
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        redirect: 'manual',
        signal: globalThis.AbortSignal.timeout(10_000),
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${context.token}`,
          'x-github-api-version': '2022-11-28',
        },
      });
    } catch {
      fail('GitHub API request failed or timed out; deployment is blocked.');
    }
    if (response?.redirected === true)
      fail('GitHub redirected an API request; deployment is blocked.');
    if (!response || response.status < 200 || response.status >= 300)
      fail(`GitHub API returned HTTP ${response?.status ?? 'unknown'}; deployment is blocked.`);
    let payload;
    try {
      payload = await response.json();
    } catch {
      fail('GitHub API returned malformed JSON.');
    }
    return payload;
  };
  return { request, root };
}

async function readRepository(context, client) {
  const repo = await client.request(
    `/repos/${encodeURIComponent(context.owner)}/${encodeURIComponent(context.name)}`,
  );
  if (
    !isObject(repo) ||
    !sameRepo(repo.full_name, context.repo) ||
    repo.default_branch !== 'main'
  ) {
    fail('The repository identity or default branch is not the expected main branch.');
  }
  const ref = await client.request(
    `/repos/${encodeURIComponent(context.owner)}/${encodeURIComponent(context.name)}/git/ref/heads/main`,
  );
  const mainSha = ref?.object?.sha;
  if (!validSha(mainSha) || mainSha.toLowerCase() !== context.sha)
    fail('The live main head no longer matches this Pages run SHA.');
}

async function readCiWorkflow(context, client) {
  const workflow = await client.request(
    `/repos/${encodeURIComponent(context.owner)}/${encodeURIComponent(context.name)}/actions/workflows/${encodeURIComponent('ci.yml')}`,
  );
  if (
    !isObject(workflow) ||
    !validId(workflow.id) ||
    workflow.path !== CI_WORKFLOW_PATH ||
    workflow.state !== 'active'
  ) {
    fail('The CI workflow metadata does not identify an active ci.yml workflow.');
  }
  return { id: workflow.id, path: workflow.path };
}

function workflowPathMatches(path) {
  return [
    CI_WORKFLOW_PATH,
    `${CI_WORKFLOW_PATH}@main`,
    `${CI_WORKFLOW_PATH}@refs/heads/main`,
  ].includes(path);
}

function validateRunShape(run, context, workflow) {
  if (
    !isObject(run) ||
    !validId(run.id) ||
    !validId(run.workflow_id) ||
    !validSha(run.head_sha) ||
    typeof run.path !== 'string' ||
    typeof run.event !== 'string' ||
    typeof run.head_branch !== 'string' ||
    !Number.isSafeInteger(run.run_attempt) ||
    run.run_attempt < 1 ||
    !isoTime(run.created_at) ||
    typeof run.status !== 'string' ||
    !(run.conclusion === null || typeof run.conclusion === 'string') ||
    !isObject(run.head_repository) ||
    typeof run.head_repository.full_name !== 'string'
  ) {
    fail('GitHub returned a malformed CI workflow run.');
  }
  if (run.workflow_id !== workflow.id || !workflowPathMatches(run.path)) {
    fail('The CI run identity does not match the active ci.yml workflow.');
  }
  let runUrl;
  try {
    runUrl = new URL(run.html_url);
  } catch {
    fail('GitHub returned an invalid CI evidence URL.');
  }
  const expectedPath = `/${context.owner}/${context.name}/actions/runs/${run.id}`;
  const apiOrigin = new URL(context.apiBase).origin;
  const webOrigin = apiOrigin === 'https://api.github.com' ? 'https://github.com' : apiOrigin;
  if (
    runUrl.protocol !== 'https:' ||
    runUrl.origin !== webOrigin ||
    runUrl.pathname !== expectedPath ||
    runUrl.search ||
    runUrl.hash
  ) {
    fail('GitHub returned an unexpected CI evidence URL.');
  }
}

function runIdentityMatches(run, context, workflow) {
  return (
    run.workflow_id === workflow.id &&
    workflowPathMatches(run.path) &&
    run.head_branch === 'main' &&
    run.head_sha.toLowerCase() === context.sha &&
    sameRepo(run.head_repository.full_name, context.repo) &&
    REQUIRED_EVENTS.has(run.event)
  );
}

async function pagedCollection(client, path, collectionKey, label) {
  const first = await client.request(`${path}?per_page=${PAGE_SIZE}&page=1`);
  if (
    !isObject(first) ||
    !Array.isArray(first[collectionKey]) ||
    !Number.isSafeInteger(first.total_count) ||
    first.total_count < 0
  ) {
    fail(`GitHub returned a malformed ${label} page.`);
  }
  if (first.total_count > PAGE_SIZE * MAX_PAGES)
    fail(`The ${label} result exceeds GitHub's complete pagination limit.`);
  const pages = Math.max(1, Math.ceil(first.total_count / PAGE_SIZE));
  if (pages > MAX_PAGES) fail(`The ${label} result exceeds GitHub's complete pagination limit.`);
  const items = [...first[collectionKey]];
  for (let page = 2; page <= pages; page += 1) {
    const response = await client.request(`${path}?per_page=${PAGE_SIZE}&page=${page}`);
    if (
      !isObject(response) ||
      !Array.isArray(response[collectionKey]) ||
      response.total_count !== first.total_count
    ) {
      fail(`GitHub returned an incomplete or inconsistent ${label} page.`);
    }
    items.push(...response[collectionKey]);
  }
  if (items.length !== first.total_count) fail(`GitHub returned an incomplete ${label} result.`);
  return items;
}

async function listRuns(context, client, workflow) {
  const workflowSlug = encodeURIComponent('ci.yml');
  const path = `/repos/${encodeURIComponent(context.owner)}/${encodeURIComponent(context.name)}/actions/workflows/${workflowSlug}/runs?branch=main&head_sha=${context.sha}`;
  // pagedCollection appends page controls while preserving the workflow filters.
  const runPath = path.slice(0, path.indexOf('?'));
  const query = new URLSearchParams(path.slice(path.indexOf('?') + 1));
  const first = await client.request(`${runPath}?${query}&per_page=${PAGE_SIZE}&page=1`);
  if (
    !isObject(first) ||
    !Array.isArray(first.workflow_runs) ||
    !Number.isSafeInteger(first.total_count) ||
    first.total_count < 0
  ) {
    fail('GitHub returned a malformed CI workflow run page.');
  }
  if (first.total_count > PAGE_SIZE * MAX_PAGES)
    fail('GitHub CI run search is truncated at the 1,000-run API cap.');
  const pages = Math.max(1, Math.ceil(first.total_count / PAGE_SIZE));
  if (pages > MAX_PAGES) fail('GitHub CI run search exceeds the complete pagination limit.');
  const runs = [...first.workflow_runs];
  for (let page = 2; page <= pages; page += 1) {
    const response = await client.request(`${runPath}?${query}&per_page=${PAGE_SIZE}&page=${page}`);
    if (
      !isObject(response) ||
      !Array.isArray(response.workflow_runs) ||
      response.total_count !== first.total_count
    ) {
      fail('GitHub returned an incomplete or inconsistent CI run page.');
    }
    runs.push(...response.workflow_runs);
  }
  if (runs.length !== first.total_count) fail('GitHub returned a truncated CI run search.');
  const ids = new Set();
  for (const run of runs) {
    validateRunShape(run, context, workflow);
    if (ids.has(run.id)) fail('GitHub returned duplicate CI run IDs.');
    ids.add(run.id);
  }
  return runs;
}

function newestEligible(runs, context, workflow) {
  const eligible = runs.filter((run) => runIdentityMatches(run, context, workflow));
  if (!eligible.length) fail('No eligible main CI run exists for this exact SHA.');
  eligible.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
  return eligible[0];
}

function validateJobShape(job, run) {
  if (
    !isObject(job) ||
    !validId(job.id) ||
    typeof job.name !== 'string' ||
    !validId(job.run_id) ||
    job.run_id !== run.id ||
    !validSha(job.head_sha) ||
    job.head_sha.toLowerCase() !== run.head_sha.toLowerCase() ||
    typeof job.status !== 'string' ||
    !(job.conclusion === null || typeof job.conclusion === 'string') ||
    !Array.isArray(job.steps)
  )
    fail('GitHub returned a malformed CI job.');
}

function successfulStep(job, stepName) {
  const matches = job.steps.filter((step) => step?.name === stepName);
  return matches.length === 1 && successful(matches[0]);
}

function validateRequiredJobs(jobs, run) {
  const byName = new Map();
  const jobIds = new Set();
  for (const job of jobs) {
    validateJobShape(job, run);
    if (jobIds.has(job.id)) fail('GitHub returned duplicate CI job IDs.');
    jobIds.add(job.id);
    if (byName.has(job.name)) fail(`CI returned duplicate required job name: ${job.name}.`);
    byName.set(job.name, job);
  }
  for (const name of REQUIRED_JOB_NAMES) {
    const job = byName.get(name);
    if (!job || !successful(job)) fail(`Required CI job did not complete successfully: ${name}.`);
  }
  const verify = byName.get(REQUIRED_JOB_NAMES[0]);
  if (verify.steps.length === 0) fail('The CI verification job has no execution steps.');
  for (const name of VERIFY_STEPS) {
    if (!successfulStep(verify, name))
      fail(`CI verification step did not complete successfully: ${name}.`);
  }
  const e2e = byName.get(REQUIRED_JOB_NAMES[1]);
  const gallery = byName.get(REQUIRED_JOB_NAMES[2]);
  if (!successfulStep(e2e, 'Require the browser suites (or, on a pull request, verify alone)')) {
    fail('The CI browser aggregate did not confirm suite completion.');
  }
  if (
    !successfulStep(gallery, 'Require every gallery shard (or, when they were skipped, verify)')
  ) {
    fail('The CI gallery aggregate did not complete successfully.');
  }
  for (const name of BROWSER_JOB_NAMES) {
    const job = byName.get(name);
    if (
      !job ||
      !successful(job) ||
      job.steps.length === 0 ||
      !successfulStep(job, 'Run e2e suite')
    ) {
      fail(`Actual main browser suite did not complete successfully: ${name}.`);
    }
  }
  const requiredNames = [...REQUIRED_JOB_NAMES, ...BROWSER_JOB_NAMES];
  return { jobIds: requiredNames.map((name) => byName.get(name).id).sort((a, b) => a - b) };
}

async function listAttemptJobs(context, client, run) {
  const path = `/repos/${encodeURIComponent(context.owner)}/${encodeURIComponent(context.name)}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`;
  const jobs = await pagedCollection(client, path, 'jobs', 'CI attempt jobs');
  return validateRequiredJobs(jobs, run);
}

async function getRunById(context, client, runId, workflow) {
  const run = await client.request(
    `/repos/${encodeURIComponent(context.owner)}/${encodeURIComponent(context.name)}/actions/runs/${runId}`,
  );
  validateRunShape(run, context, workflow);
  return run;
}

function evidenceFrom(run, jobIds, context, workflow) {
  return {
    sha: run.head_sha.toLowerCase(),
    ci_run_id: String(run.id),
    ci_run_attempt: String(run.run_attempt),
    ci_workflow_id: String(workflow.id),
    ci_workflow_path: workflow.path,
    ci_event: run.event,
    ci_url: run.html_url,
    ci_job_ids: jobIds.join(','),
    artifact_name: `pages-${run.head_sha.toLowerCase()}-ci${run.id}-a${run.run_attempt}-deploy${context.runId}-a${context.runAttempt}`,
  };
}

export async function selectEvidence(env, fetchImpl = globalThis.fetch) {
  const context = normalizedContext(env);
  if (context.event === 'workflow_dispatch' && context.ref !== 'refs/heads/main')
    fail('Manual Pages dispatch must target main.');
  const client = makeClient(context, fetchImpl);
  await readRepository(context, client);
  const workflow = await readCiWorkflow(context, client);
  const runs = await listRuns(context, client, workflow);
  const selected = newestEligible(runs, context, workflow);
  if (!successful(selected))
    fail(
      'The newest eligible CI run is not completed successfully; no older run will be substituted.',
    );
  const jobs = await listAttemptJobs(context, client, selected);
  const latest = newestEligible(await listRuns(context, client, workflow), context, workflow);
  if (
    latest.id !== selected.id ||
    latest.run_attempt !== selected.run_attempt ||
    !successful(latest)
  ) {
    fail(
      'The newest eligible CI run changed or is not successful; no older run will be substituted.',
    );
  }
  const finalJobs = await listAttemptJobs(context, client, latest);
  if (finalJobs.jobIds.join(',') !== jobs.jobIds.join(','))
    fail('The required CI job identities changed while evidence was collected.');
  const after = await getRunById(context, client, selected.id, workflow);
  if (
    !runIdentityMatches(after, context, workflow) ||
    after.run_attempt !== selected.run_attempt ||
    !successful(after)
  ) {
    fail('The selected CI run changed while its evidence was collected.');
  }
  await readRepository(context, client);
  return evidenceFrom(after, finalJobs.jobIds, context, workflow);
}

export async function revalidateEvidence(env, expected, stage, fetchImpl = globalThis.fetch) {
  const context = normalizedContext(env);
  if (
    !isObject(expected) ||
    !validSha(expected.sha) ||
    expected.sha.toLowerCase() !== context.sha ||
    !validId(Number(expected.ci_run_id)) ||
    !Number.isSafeInteger(Number(expected.ci_run_attempt)) ||
    Number(expected.ci_run_attempt) < 1 ||
    !validId(Number(expected.ci_workflow_id)) ||
    expected.ci_workflow_path !== CI_WORKFLOW_PATH ||
    typeof expected.ci_job_ids !== 'string' ||
    typeof expected.artifact_name !== 'string'
  ) {
    fail(`The frozen deployment identity is invalid at ${stage}.`);
  }
  const client = makeClient(context, fetchImpl);
  await readRepository(context, client);
  const workflow = await readCiWorkflow(context, client);
  if (
    workflow.id !== Number(expected.ci_workflow_id) ||
    workflow.path !== expected.ci_workflow_path
  ) {
    fail(`The active CI workflow identity changed before ${stage}.`);
  }
  const run = await getRunById(context, client, Number(expected.ci_run_id), workflow);
  if (
    !runIdentityMatches(run, context, workflow) ||
    run.run_attempt !== Number(expected.ci_run_attempt) ||
    !successful(run)
  ) {
    fail(`The frozen CI evidence changed before ${stage}.`);
  }
  const jobs = await listAttemptJobs(context, client, run);
  const latest = newestEligible(await listRuns(context, client, workflow), context, workflow);
  if (latest.id !== run.id || latest.run_attempt !== run.run_attempt || !successful(latest)) {
    fail(`The newest eligible CI run changed or is not successful before ${stage}.`);
  }
  const finalJobs = await listAttemptJobs(context, client, latest);
  const expectedJobIds = expected.ci_job_ids.split(',').map((value) => Number(value));
  if (
    expectedJobIds.some((id) => !validId(id)) ||
    new Set(expectedJobIds).size !== expectedJobIds.length ||
    expectedJobIds.join(',') !== [...expectedJobIds].sort((a, b) => a - b).join(',') ||
    jobs.jobIds.join(',') !== expected.ci_job_ids ||
    finalJobs.jobIds.join(',') !== expected.ci_job_ids
  ) {
    fail(`The required CI job identities changed before ${stage}.`);
  }
  const after = await getRunById(context, client, run.id, workflow);
  if (
    !runIdentityMatches(after, context, workflow) ||
    after.run_attempt !== run.run_attempt ||
    !successful(after)
  ) {
    fail(`The selected CI run changed during ${stage} evidence collection.`);
  }
  await readRepository(context, client);
  const current = evidenceFrom(after, finalJobs.jobIds, context, workflow);
  for (const key of [
    'sha',
    'ci_run_id',
    'ci_run_attempt',
    'ci_workflow_id',
    'ci_workflow_path',
    'ci_event',
    'ci_job_ids',
    'artifact_name',
  ]) {
    if (current[key] !== expected[key])
      fail(`The frozen deployment identity changed before ${stage}.`);
  }
  return current;
}

export async function verifyArtifactMetadata(
  env,
  expected,
  artifactId,
  fetchImpl = globalThis.fetch,
) {
  const context = normalizedContext(env);
  if (!validId(Number(artifactId))) fail('The Pages artifact ID is missing or invalid.');
  const client = makeClient(context, fetchImpl);
  const artifacts = await pagedCollection(
    client,
    `/repos/${encodeURIComponent(context.owner)}/${encodeURIComponent(context.name)}/actions/runs/${context.runId}/artifacts`,
    'artifacts',
    'Pages artifact metadata',
  );
  const artifactIds = new Set();
  for (const artifact of artifacts) {
    if (!isObject(artifact) || !validId(artifact.id) || artifactIds.has(artifact.id)) {
      fail('GitHub returned malformed or duplicate Pages artifact metadata.');
    }
    artifactIds.add(artifact.id);
  }
  const named = artifacts.filter((artifact) => artifact.name === expected.artifact_name);
  if (named.length !== 1)
    fail('The selected Pages artifact name is missing or duplicated in this workflow run.');
  const artifact = named[0];
  if (artifact.id !== Number(artifactId))
    fail('The uploaded Pages artifact ID does not uniquely select the named artifact.');
  if (
    !isObject(artifact) ||
    !validId(artifact.id) ||
    typeof artifact.name !== 'string' ||
    typeof artifact.expired !== 'boolean' ||
    !isObject(artifact.workflow_run) ||
    !validSha(artifact.workflow_run.head_sha) ||
    artifact.name !== expected.artifact_name ||
    artifact.expired ||
    artifact.workflow_run.id !== context.runId ||
    artifact.workflow_run.head_sha?.toLowerCase() !== expected.sha ||
    artifact.workflow_run.head_branch !== 'main'
  ) {
    fail('The Pages artifact metadata does not match the frozen SHA and workflow run.');
  }
  return { artifact_id: String(artifact.id), artifact_name: artifact.name };
}

export async function dispatchCommand({
  mode,
  env,
  fetchImpl = globalThis.fetch,
  writeOutput = appendOutput,
}) {
  if (mode === 'select') {
    const evidence = await selectEvidence(env, fetchImpl);
    await writeOutput(evidence, env.GITHUB_OUTPUT);
    return evidence;
  }
  const expected = {
    sha: env.DEPLOY_SHA,
    ci_run_id: env.DEPLOY_CI_RUN_ID,
    ci_run_attempt: env.DEPLOY_CI_RUN_ATTEMPT,
    ci_workflow_id: env.DEPLOY_CI_WORKFLOW_ID,
    ci_workflow_path: env.DEPLOY_CI_WORKFLOW_PATH,
    ci_event: env.DEPLOY_CI_EVENT,
    ci_job_ids: env.DEPLOY_CI_JOB_IDS,
    artifact_name: env.DEPLOY_ARTIFACT_NAME,
  };
  if (mode === 'revalidate') {
    const stage = env.DEPLOY_GATE_STAGE;
    if (!['before-build', 'before-upload', 'before-publish'].includes(stage))
      fail('The deployment gate stage is invalid.');
    const evidence = await revalidateEvidence(env, expected, stage, fetchImpl);
    let artifact;
    if (stage === 'before-publish') {
      artifact = await verifyArtifactMetadata(env, expected, env.DEPLOY_ARTIFACT_ID, fetchImpl);
    }
    await writeOutput(artifact ? { ...evidence, ...artifact } : evidence, env.GITHUB_OUTPUT);
    return artifact ? { evidence, artifact } : { evidence };
  }
  fail('Usage: node scripts/deploy-gate.mjs <select|revalidate>.');
}

async function main() {
  return dispatchCommand({ mode: process.argv[2], env: process.env });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    const message =
      error instanceof GateError ? error.message : 'Unexpected deployment gate error.';
    process.stderr.write(`::error::${message}\n`);
    process.exitCode = 1;
  });
}
