#!/usr/bin/env node
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { setTimeout, clearTimeout } from 'node:timers';
import { aggregate, analyzeChunk, renderMarkdown } from './bundle-report-lib.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const childTimeoutMs = Number(process.env.BUNDLE_REPORT_CHILD_TIMEOUT_MS ?? 300_000);
if (!Number.isInteger(childTimeoutMs) || childTimeoutMs < 1 || childTimeoutMs > 300_000) {
  console.error(
    'bundle:report: BUNDLE_REPORT_CHILD_TIMEOUT_MS must be an integer from 1 to 300000.',
  );
  process.exit(1);
}
const args = process.argv.slice(2);
let baseRef = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--base' && args[i + 1]) {
    if (baseRef !== null) fail('Use --base once.');
    baseRef = args[++i];
  } else fail(`Unknown or incomplete argument: ${args[i]}`);
}

function fail(message) {
  console.error(`bundle:report: ${message}`);
  process.exit(1);
}

function git(cwd, gitArgs) {
  return execFileSync('git', gitArgs, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  }).trim();
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

function sourceMapRef(code) {
  const text = code.toString('utf8');
  const match =
    /(?:\/\/[#@]\s*sourceMappingURL=([^\s]+)|\/\*[#@]\s*sourceMappingURL=([^\s*]+)\s*\*\/)\s*$/.exec(
      text,
    );
  return match?.[1] ?? match?.[2] ?? null;
}

function reportDist(dist, sourceRoot) {
  if (!existsSync(dist)) throw new Error(`${dist} is missing. Run \`npm run build\` first.`);
  const files = listFiles(dist);
  const js = files.filter((file) => file.endsWith('.js'));
  if (!js.length) throw new Error(`No shipped JavaScript found under ${dist}.`);
  const chunks = js.map((file) => {
    const code = readFileSync(file);
    const mapRef = sourceMapRef(code);
    let mapFile;
    let mapValue;
    if (mapRef?.startsWith('data:')) {
      const match = /^data:application\/json(?:;charset=[^;,]+)?(;base64)?,(.*)$/i.exec(mapRef);
      if (!match) throw new Error(`Unsupported inline sourcemap for ${file}.`);
      mapValue = Buffer.from(match[2], match[1] ? 'base64' : 'utf8').toString('utf8');
      if (!match[1]) mapValue = decodeURIComponent(mapValue);
    } else if (mapRef) {
      mapFile = resolve(dirname(file), decodeURIComponent(mapRef));
      if (!mapFile.startsWith(`${resolve(dist)}\\`) && !mapFile.startsWith(`${resolve(dist)}/`)) {
        throw new Error(`Sourcemap escapes dist/: ${mapRef}`);
      }
      if (!existsSync(mapFile)) throw new Error(`Sourcemap is missing for ${file}: ${mapRef}`);
    }
    return analyzeChunk({
      file: file.slice(dist.length + 1),
      mapFile,
      mapValue,
      mapBasePath: file,
      rootDir: sourceRoot,
      content: code,
    });
  });
  return aggregate(chunks);
}

let child = null;
let interrupted = false;
let childTreeStopped = true;
let escalationTimer;
const ownedWorktrees = new Map();
function interrupt(signal) {
  interrupted = true;
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
    });
    childTreeStopped = result.status === 0 || result.error?.code === 'ESRCH';
  } else {
    try {
      process.kill(-child.pid, signal);
      childTreeStopped = false;
      escalationTimer = setTimeout(() => {
        if (!child?.pid) return;
        try {
          process.kill(-child.pid, 'SIGKILL');
          childTreeStopped = true;
        } catch (error) {
          childTreeStopped = error.code === 'ESRCH';
        }
      }, 10_000);
    } catch (error) {
      childTreeStopped = error.code === 'ESRCH';
    }
  }
}
process.on('SIGINT', () => interrupt('SIGINT'));
process.on('SIGTERM', () => interrupt('SIGTERM'));

function runNpm(commandArgs, cwd) {
  if (interrupted) throw new Error('Interrupted before child process start.');
  const hasNpmCli = Boolean(process.env.npm_execpath);
  const command = hasNpmCli ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = hasNpmCli ? [process.env.npm_execpath, ...commandArgs] : commandArgs;
  const useShell = !hasNpmCli && process.platform === 'win32';
  const timeoutMs = commandArgs[0] === 'run' ? childTimeoutMs : 300_000;
  return new Promise((resolveRun, rejectRun) => {
    child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: useShell,
      windowsHide: true,
      detached: process.platform !== 'win32',
    });
    const pid = child.pid;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      interrupt('SIGTERM');
    }, timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timer);
      child = null;
      rejectRun(error);
    });
    child.once('exit', async (code, signal) => {
      clearTimeout(timer);
      if (escalationTimer) clearTimeout(escalationTimer);
      if (process.platform !== 'win32' && pid) {
        try {
          process.kill(-pid, 0);
          process.kill(-pid, 'SIGKILL');
          childTreeStopped = false;
          for (let i = 0; i < 20; i++) {
            await new Promise((resolveWait) => setTimeout(resolveWait, 100));
            try {
              process.kill(-pid, 0);
            } catch (error) {
              if (error.code === 'ESRCH') childTreeStopped = true;
              break;
            }
          }
        } catch (error) {
          if (error.code === 'ESRCH') childTreeStopped = true;
          else childTreeStopped = false;
        }
      }
      child = null;
      if (!childTreeStopped) {
        rejectRun(
          new Error(
            'Could not confirm owned child process tree shutdown; worktree cleanup is disabled.',
          ),
        );
        return;
      }
      if (timedOut)
        rejectRun(new Error(`npm ${commandArgs.join(' ')} exceeded the ${timeoutMs} ms limit.`));
      else if (interrupted)
        rejectRun(new Error('Interrupted; owned child process tree was stopped.'));
      else if (code !== 0)
        rejectRun(new Error(`npm ${commandArgs.join(' ')} exited ${code ?? signal}.`));
      else resolveRun();
    });
  });
}

function cleanWorktree() {
  const status = git(repo, ['status', '--porcelain', '--untracked-files=all']);
  if (status) throw new Error('--base requires a clean worktree, including untracked files.');
}

async function buildCommit(commit, directory) {
  git(repo, ['worktree', 'add', '--detach', directory, commit]);
  ownedWorktrees.set(directory, commit);
  await runNpm(['ci', '--no-audit', '--no-fund'], directory);
  await runNpm(['run', 'build'], directory);
  return reportDist(join(directory, 'dist'), directory);
}

let tempRoot;
let cleanupErrors = [];
try {
  let markdown;
  if (baseRef) {
    cleanWorktree();
    const currentSha = git(repo, ['rev-parse', 'HEAD']);
    const baseSha = git(repo, ['rev-parse', '--verify', '--end-of-options', `${baseRef}^{commit}`]);
    tempRoot = mkdtempSync(join(tmpdir(), `avatar-bundle-report-${process.pid}-`));
    const currentWorktree = join(tempRoot, 'current');
    const baseWorktree = join(tempRoot, 'base');
    const current = await buildCommit(currentSha, currentWorktree);
    const base = await buildCommit(baseSha, baseWorktree);
    markdown = `Current commit: \`${currentSha}\` · base commit: \`${baseSha}\`\n\n${renderMarkdown(current, base)}`;
  } else {
    let revision = 'unknown';
    try {
      revision = git(repo, ['rev-parse', 'HEAD']);
    } catch {
      /* report can run from a source archive */
    }
    markdown = `Analyzed existing \`dist/\` output (repository HEAD: \`${revision}\`; output build provenance is not inferred).\n\n${renderMarkdown(reportDist(join(repo, 'dist'), repo))}`;
  }
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
} catch (error) {
  console.error(`bundle:report: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (tempRoot) {
    if (!childTreeStopped) {
      cleanupErrors.push(
        'owned child process tree shutdown was not confirmed; temporary worktrees retained',
      );
    }
    for (const name of childTreeStopped ? ['current', 'base'] : []) {
      const worktree = join(tempRoot, name);
      if (existsSync(worktree)) {
        const expected = ownedWorktrees.get(worktree);
        if (!expected) {
          cleanupErrors.push(
            `retained worktree ${worktree}: not recorded as an owned Git worktree`,
          );
        } else {
          try {
            const actual = git(worktree, ['rev-parse', 'HEAD']);
            if (actual !== expected) {
              cleanupErrors.push(
                `retained worktree ${worktree}: HEAD changed from ${expected} to ${actual}`,
              );
            } else {
              const status = git(worktree, ['status', '--porcelain', '--untracked-files=all']);
              if (status) {
                cleanupErrors.push(
                  `retained worktree ${worktree}: tracked or non-ignored files changed during build`,
                );
              } else {
                git(repo, ['worktree', 'remove', '--force', worktree]);
              }
            }
          } catch (error) {
            cleanupErrors.push(`retained worktree ${worktree}: ${error.message}`);
          }
        }
      }
    }
    if (cleanupErrors.length === 0) {
      try {
        rmdirSync(tempRoot);
      } catch (error) {
        cleanupErrors.push(`temporary directory ${tempRoot}: ${error.message}`);
      }
    } else {
      cleanupErrors.push(`owned artifacts retained for recovery at ${tempRoot}`);
    }
    if (cleanupErrors.length) {
      console.error(`bundle:report cleanup failed: ${cleanupErrors.join('; ')}`);
      process.exitCode = 1;
    }
  }
}
