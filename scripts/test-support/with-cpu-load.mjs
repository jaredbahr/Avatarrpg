#!/usr/bin/env node
/**
 * Runs a command while every core is kept busy, to show that a test's verdict does not depend on
 * how fast the machine is (#796).
 *
 *   node scripts/test-support/with-cpu-load.mjs -- npx vitest run src/core/rules/aiWall.test.ts
 *   node scripts/test-support/with-cpu-load.mjs --procs 16 --repeat 5 -- npm test
 *
 * `--procs` is the number of busy-loop processes (default: twice the core count). `--repeat` runs
 * the command that many times and reports each exit code. The exit code is the first failure's.
 * The burners are killed when the command ends and when this script is interrupted.
 */
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';

const args = process.argv.slice(2);
const split = args.indexOf('--');
const options = split < 0 ? [] : args.slice(0, split);
const command = split < 0 ? args : args.slice(split + 1);

function option(name, fallback) {
  const at = options.indexOf(name);
  if (at < 0) return fallback;
  const value = Number(options[at + 1]);
  if (!Number.isInteger(value) || value < 0) {
    console.error(`with-cpu-load: ${name} needs a whole number.`);
    process.exit(2);
  }
  return value;
}

const procs = option('--procs', availableParallelism() * 2);
const repeat = option('--repeat', 1);
if (command.length === 0) {
  console.error('Usage: with-cpu-load.mjs [--procs N] [--repeat N] -- <command> [args...]');
  process.exit(2);
}

const burners = Array.from({ length: procs }, () =>
  spawn(process.execPath, ['-e', 'for (;;) {}'], { stdio: 'ignore' }),
);
const stop = () => {
  for (const burner of burners) burner.kill('SIGKILL');
};
process.on('exit', stop);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stop();
    process.exit(130);
  });
}

function run() {
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), { stdio: 'inherit' });
    child.on('error', (error) => {
      console.error(`with-cpu-load: ${error.message}`);
      resolve(127);
    });
    child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

console.error(
  `with-cpu-load: ${procs} busy processes on ${availableParallelism()} cores, ${repeat} run(s)`,
);
const codes = [];
for (let index = 0; index < repeat; index++) {
  const started = Date.now();
  const code = await run();
  codes.push(code);
  console.error(
    `with-cpu-load: run ${index + 1}/${repeat} exit ${code} after ${Math.round((Date.now() - started) / 1000)} s`,
  );
}
stop();
console.error(`with-cpu-load: exit codes ${codes.join(' ')}`);
process.exit(codes.find((code) => code !== 0) ?? 0);
