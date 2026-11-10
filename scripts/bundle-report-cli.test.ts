import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures: string[] = [];
const pidFiles: string[] = [];
const ownedChildPids = new Set<number>();
const retainedRoots: Array<{
  path: string;
  fixture: string;
  cliPid: number;
  expectedHeads: Map<string, string>;
}> = [];

function errorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function stopOwnedPid(pid: number) {
  try {
    process.kill(pid, 0);
  } catch (error) {
    if (errorCode(error) === 'ESRCH') return;
    throw error;
  }
  try {
    if (process.platform === 'win32') {
      const result = spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' });
      if (result.status !== 0) {
        try {
          process.kill(pid, 0);
          throw new Error(
            `taskkill returned ${result.status} while owned pid ${pid} is still alive`,
          );
        } catch (error) {
          if (errorCode(error) !== 'ESRCH') throw error;
        }
      }
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch (error) {
    if (errorCode(error) !== 'ESRCH') throw error;
  }
}

function recoverOwnedRoot(root: (typeof retainedRoots)[number]) {
  if (
    dirname(root.path) !== tmpdir() ||
    !basename(root.path).startsWith(`avatar-bundle-report-${root.cliPid}-`)
  ) {
    throw new Error(`Refusing to clean unexpected retained path: ${root.path}`);
  }
  for (const name of ['current', 'base']) {
    const worktree = join(root.path, name);
    if (!existsSync(worktree)) continue;
    const expected = root.expectedHeads.get(name);
    if (!expected) throw new Error(`No expected SHA recorded for owned worktree ${worktree}`);
    const gitMetadata = /^gitdir: (.+)$/m.exec(readFileSync(join(worktree, '.git'), 'utf8'))?.[1];
    if (gitMetadata) {
      const lock = join(gitMetadata, 'locked');
      if (existsSync(lock) && readFileSync(lock, 'utf8') === 'test owns this lock') rmSync(lock);
    }
    if (git(worktree, ['rev-parse', 'HEAD']) !== expected) {
      throw new Error(`Expected SHA mismatch; retaining ${worktree}`);
    }
    if (git(worktree, ['status', '--porcelain', '--untracked-files=all'])) {
      throw new Error(`Nonignored worktree changes; retaining ${worktree}`);
    }
    git(root.fixture, ['worktree', 'remove', '--force', worktree]);
  }
  if (readdirSync(root.path).length !== 0)
    throw new Error(`Unexpected owned files at ${root.path}`);
  rmdirSync(root.path);
}

afterEach(() => {
  let childShutdownConfirmed = true;
  const cleanupErrors: string[] = [];
  for (const pidFile of pidFiles) {
    if (!existsSync(pidFile)) continue;
    const pid = Number(readFileSync(pidFile, 'utf8'));
    if (Number.isInteger(pid) && pid > 0) ownedChildPids.add(pid);
    else {
      childShutdownConfirmed = false;
      cleanupErrors.push(`could not identify owned child from ${pidFile}`);
    }
  }
  for (const pid of ownedChildPids) {
    try {
      stopOwnedPid(pid);
    } catch (error) {
      childShutdownConfirmed = false;
      cleanupErrors.push(`owned child ${pid}: ${errorMessage(error)}`);
    }
  }
  if (childShutdownConfirmed) {
    ownedChildPids.clear();
    for (const pidFile of pidFiles) if (existsSync(pidFile)) rmSync(pidFile);
    pidFiles.length = 0;
  }
  if (childShutdownConfirmed) {
    for (const root of retainedRoots) {
      try {
        recoverOwnedRoot(root);
      } catch (error) {
        cleanupErrors.push(errorMessage(error));
      }
    }
  } else {
    cleanupErrors.push('retained temporary worktrees because child shutdown was not confirmed');
  }
  if (cleanupErrors.length === 0) {
    for (const fixture of fixtures) {
      if (git(fixture, ['worktree', 'list', '--porcelain']).split('worktree ').length !== 2) {
        cleanupErrors.push(`Fixture still has linked worktrees; retaining ${fixture}`);
        continue;
      }
      rmSync(fixture, { recursive: true, force: true });
    }
  }
  if (cleanupErrors.length === 0) {
    retainedRoots.length = 0;
    fixtures.length = 0;
  }
  if (cleanupErrors.length)
    throw new Error(`Test-owned cleanup needs attention: ${cleanupErrors.join('; ')}`);
});

function git(cwd: string, args: string[]) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function writeBuild(folder: string, sourceName: string, fail = false) {
  const body = fail
    ? "throw new Error('fixture build failure');"
    : `import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
writeFileSync('dist/app.js', 'const v=${sourceName.length};\\n//# sourceMappingURL=app.js.map\\n');
writeFileSync('dist/app.js.map', JSON.stringify({ version: 3, sources: ['../src/${sourceName}.ts'], names: [], mappings: 'AAAA' }));`;
  writeFileSync(join(folder, 'build.mjs'), body);
}

function makeFixture() {
  const folder = mkdtempSync(join(tmpdir(), 'bundle-report-cli-test-'));
  fixtures.push(folder);
  mkdirSync(join(folder, 'scripts'));
  copyFileSync(
    join(repo, 'scripts', 'bundle-report.mjs'),
    join(folder, 'scripts', 'bundle-report.mjs'),
  );
  copyFileSync(
    join(repo, 'scripts', 'bundle-report-lib.mjs'),
    join(folder, 'scripts', 'bundle-report-lib.mjs'),
  );
  writeFileSync(join(folder, '.gitignore'), '/dist/\n/node_modules/\n');
  writeFileSync(
    join(folder, 'package.json'),
    JSON.stringify(
      {
        name: 'bundle-report-fixture',
        version: '1.0.0',
        type: 'module',
        scripts: { build: 'node build.mjs' },
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(folder, 'package-lock.json'),
    JSON.stringify(
      {
        name: 'bundle-report-fixture',
        version: '1.0.0',
        lockfileVersion: 3,
        requires: true,
        packages: { '': { name: 'bundle-report-fixture', version: '1.0.0' } },
      },
      null,
      2,
    ),
  );
  writeBuild(folder, 'before');
  git(folder, ['init', '-b', 'main']);
  git(folder, ['config', 'user.name', 'Bundle Report Test']);
  git(folder, ['config', 'user.email', 'bundle-report-test@example.invalid']);
  git(folder, ['add', '.']);
  git(folder, ['commit', '-m', 'fixture base']);
  const base = git(folder, ['rev-parse', 'HEAD']);
  return { folder, base };
}

function invoke(folder: string, args: string[], extraEnv: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [join(folder, 'scripts', 'bundle-report.mjs'), ...args], {
    cwd: folder,
    encoding: 'utf8',
    timeout: 120_000,
    env: { ...process.env, ...extraEnv },
  });
}

describe('bundle report CLI safety and base comparison', () => {
  it('rejects invalid refs and dirty worktrees before making temporary worktrees', () => {
    const { folder, base } = makeFixture();
    const invalid = invoke(folder, ['--base', '--flag']);
    expect(invalid.status).not.toBe(0);
    expect(invalid.stderr).toContain('--end-of-options');
    expect(git(folder, ['worktree', 'list', '--porcelain']).split('worktree ')).toHaveLength(2);

    writeFileSync(join(folder, 'untracked.txt'), 'uncommitted');
    const dirty = invoke(folder, ['--base', base]);
    expect(dirty.status).not.toBe(0);
    expect(dirty.stderr).toContain('requires a clean worktree');
    expect(git(folder, ['worktree', 'list', '--porcelain']).split('worktree ')).toHaveLength(2);

    rmSync(join(folder, 'untracked.txt'));
    mkdirSync(join(folder, 'dist'));
    const map = Buffer.from(
      JSON.stringify({ version: 3, sources: ['../src/inline.ts'], names: [], mappings: 'AAAA' }),
    ).toString('base64');
    writeFileSync(
      join(folder, 'dist', 'app.js'),
      `const x=1;\n//# sourceMappingURL=data:application/json;base64,${map}\n`,
    );
    const inline = invoke(folder, []);
    expect(inline.status, inline.stderr).toBe(0);
    expect(inline.stdout).toContain('`src/inline.ts`');
  });

  it('builds both detached commits, reports added/removed modules, and removes owned worktrees', () => {
    const { folder, base } = makeFixture();
    writeBuild(folder, 'after');
    git(folder, ['add', 'build.mjs']);
    git(folder, ['commit', '-m', 'fixture current']);
    const current = git(folder, ['rev-parse', 'HEAD']);
    const result = invoke(folder, ['--base', base]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Current commit: `' + current + '`');
    expect(result.stdout).toContain('base commit: `' + base + '`');
    expect(result.stdout).toContain('`src/after.ts`');
    expect(result.stdout).toContain('`src/before.ts`');
    expect(git(folder, ['worktree', 'list', '--porcelain']).split('worktree ')).toHaveLength(2);
  });

  it('retains a failed cleanup worktree and reports its exact owned path', () => {
    const { folder, base } = makeFixture();
    const lockAwareBuild = `import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
const common = resolve(execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim());
const gitDir = join(common, 'worktrees', 'current');
mkdirSync(gitDir, { recursive: true });
writeFileSync(join(gitDir, 'locked'), 'test owns this lock');
throw new Error('force the cleanup path');`;
    writeFileSync(join(folder, 'build.mjs'), lockAwareBuild);
    git(folder, ['add', 'build.mjs']);
    git(folder, ['commit', '-m', 'fixture cleanup failure']);
    const expectedHeads = new Map([
      ['current', git(folder, ['rev-parse', 'HEAD'])],
      ['base', base],
    ]);
    const result = invoke(folder, ['--base', base]);
    const retained = /owned artifacts retained for recovery at (.+)/
      .exec(`${result.stdout}\n${result.stderr}`)?.[1]
      ?.trim();
    if (retained) {
      if (typeof result.pid !== 'number')
        throw new Error('CLI process ID was unavailable for owned-path verification.');
      retainedRoots.push({ path: retained, fixture: folder, cliPid: result.pid, expectedHeads });
    }
    expect(result.status).not.toBe(0);
    if (!retained) throw new Error('Expected the report to name its retained owned directory.');
    expect(dirname(retained)).toBe(tmpdir());
    expect(basename(retained)).toMatch(/^avatar-bundle-report-/);
  });

  it('stops a timed-out npm child tree before removing its clean worktree', () => {
    const { folder, base } = makeFixture();
    const pidFile = join(folder, 'sleeper.pid');
    const hangingBuild = `import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
mkdirSync('dist', { recursive: true });
const sleeper = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
writeFileSync(process.env.BUNDLE_REPORT_CHILD_PID_FILE, String(sleeper.pid));
setInterval(() => {}, 1000);`;
    writeFileSync(join(folder, 'build.mjs'), hangingBuild);
    git(folder, ['add', 'build.mjs']);
    git(folder, ['commit', '-m', 'fixture hanging build']);
    pidFiles.push(pidFile);
    const result = invoke(folder, ['--base', base], {
      BUNDLE_REPORT_CHILD_TIMEOUT_MS: '10000',
      BUNDLE_REPORT_CHILD_PID_FILE: pidFile,
    });
    if (!existsSync(pidFile))
      throw new Error('The hanging build did not reach its sleeper-ready signal.');
    const sleeperPid = Number(readFileSync(pidFile, 'utf8'));
    if (Number.isInteger(sleeperPid) && sleeperPid > 0) ownedChildPids.add(sleeperPid);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('exceeded the 10000 ms limit');
    expect(() => process.kill(sleeperPid, 0)).toThrow();
    expect(git(folder, ['worktree', 'list', '--porcelain']).split('worktree ')).toHaveLength(2);
  }, 35_000);
});
