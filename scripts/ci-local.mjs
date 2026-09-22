/**
 * Local mirror of the `verify` job in .github/workflows/ci.yml. It runs the same
 * steps, in the same order, and stops at the first failure, so a green run here
 * is the evidence a green `verify` job needs. Keep STEPS in sync with that
 * workflow by hand — ci.yml stays the source of truth.
 *
 * It assumes Node 22 (what the workflow pins) and a node_modules installed from
 * the lockfile with `npm ci`; it does not check either.
 */
import { spawnSync } from 'node:child_process';

// Keep this as one array literal so a reader can compare it against the
// `verify` job in .github/workflows/ci.yml at a glance.
const STEPS = [
  { name: 'typecheck', run: 'npm run typecheck' },
  { name: 'lint', run: 'npm run lint' },
  { name: 'format:check', run: 'npm run format:check' },
  { name: 'test', run: 'npm test' },
  { name: 'build', run: 'npm run build' },
  { name: 'bundle budget', run: 'node scripts/check-bundle-size.mjs' },
  { name: 'art:validate', run: 'npm run art:validate' },
  { name: 'check:assets', run: 'npm run check:assets' },
  {
    name: 'balance',
    run: 'npm run balance',
    // The exact env overrides the workflow sets for the cheap tripwire sweep.
    env: { BALANCE_TRIALS: '40', BALANCE_DISCIPLINE_TRIALS: '6' },
  },
];

let failed = false;

for (const [index, step] of STEPS.entries()) {
  console.log(`\n=== ci:local ${index + 1}/${STEPS.length}: ${step.name} ===`);
  const { status, signal, error } = spawnSync(step.run, {
    stdio: 'inherit',
    // shell: true resolves npm.cmd on Windows and npm on Linux, so the command
    // strings stay identical to the workflow on both platforms.
    shell: true,
    env: { ...process.env, ...step.env },
  });
  if (error) {
    console.error(`\nci:local could not start "${step.name}": ${error.message}`);
    process.exitCode = 1;
    failed = true;
    break;
  }
  if (status !== 0) {
    console.error(
      `\nci:local failed at step ${index + 1}/${STEPS.length} "${step.name}" (${
        status === null ? `signal ${signal}` : `exit ${status}`
      }).`,
    );
    process.exitCode = status ?? 1;
    failed = true;
    break;
  }
}

if (!failed) {
  console.log(`\nci:local: all ${STEPS.length} steps passed.`);
}
