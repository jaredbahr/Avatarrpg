import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { preview } from 'vite';

const root = process.cwd();
const reportPath = join(root, 'lighthouse-report');
if (existsSync(reportPath)) throw new Error('Previous Lighthouse report is still present');

let interrupt;
let interruption;
const interrupted = new Promise((_, reject) => {
  interrupt = (signal) => {
    interruption ??= new Error(`Interrupted by ${signal}`);
    reject(interruption);
  };
});
const checkInterrupted = () => {
  if (interruption) throw interruption;
};
const onSigint = () => interrupt('SIGINT');
const onSigterm = () => interrupt('SIGTERM');
const onSighup = () => interrupt('SIGHUP');
process.on('SIGINT', onSigint);
process.on('SIGTERM', onSigterm);
process.on('SIGHUP', onSighup);

async function buildStep(bin, args, label, timeoutMs) {
  const child = spawn(process.execPath, [bin, ...args], {
    detached: true,
    windowsHide: true,
    stdio: 'inherit',
  });
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  let finished = false;
  try {
    const result = await Promise.race([
      done,
      interrupted,
      delay(timeoutMs, undefined, { ref: false }).then(() => {
        throw new Error(`${label} exceeded ${timeoutMs / 1_000}s`);
      }),
    ]);
    if (result.code !== 0) throw new Error(`${label} exited ${result.code ?? result.signal}`);
    finished = true;
  } finally {
    if (!finished && child.pid) {
      let terminationError;
      if (process.platform === 'win32') {
        const killed = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          timeout: 5_000,
        });
        if (killed.error) terminationError = killed.error;
        if (killed.status !== 0 && child.exitCode === null && child.signalCode === null) {
          terminationError ??= new Error(
            `taskkill failed for owned ${label} child ${child.pid}: ${killed.status}`,
          );
        }
      } else {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch (error) {
          if (error.code !== 'ESRCH') throw error;
        }
        await Promise.race([done.catch(() => {}), delay(2_000, undefined, { ref: false })]);
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch (error) {
          if (error.code !== 'ESRCH') throw error;
        }
      }
      await Promise.race([
        done.catch(() => {}),
        delay(5_000, undefined, { ref: false }).then(() => {
          throw new Error(`${label} child did not exit`);
        }),
      ]);
      if (terminationError) throw terminationError;
    }
  }
}

async function preinstalledChrome() {
  const path = process.env.CHROME_PATH || chromium.executablePath();
  const file = await stat(path).catch(() => null);
  if (!file?.isFile()) throw new Error(`Preinstalled Chromium executable missing: ${path}`);
  if (process.platform !== 'win32' && !(file.mode & 0o111)) {
    throw new Error(`Chromium is not executable: ${path}`);
  }
  return path;
}

async function debuggingPort(profile) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try {
      const raw = await readFile(join(profile, 'DevToolsActivePort'), 'utf8');
      const port = Number(raw.split(/\r?\n/, 1)[0]);
      if (Number.isInteger(port) && port > 0 && port < 65_536) return port;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await Promise.race([delay(100), interrupted]);
  }
  throw new Error('Chromium did not open a debugging port within 30s');
}

let server;
let context;
let profile;
let partialReport;
let publishedReport = false;
let failure;
try {
  // These are exactly the two commands in package.json's build script, with
  // no npm shell between this owner and either bounded child process.
  await buildStep(
    join(root, 'node_modules/typescript/bin/tsc'),
    ['--noEmit'],
    'Typecheck',
    5 * 60_000,
  );
  checkInterrupted();
  process.env.GH_PAGES_BASE = '/';
  await buildStep(join(root, 'node_modules/vite/bin/vite.js'), ['build'], 'Vite build', 7 * 60_000);
  checkInterrupted();

  server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true } });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Preview has no TCP port');
  const url = `http://127.0.0.1:${address.port}/`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Preview returned HTTP ${response.status}`);
  await response.arrayBuffer();
  checkInterrupted();

  profile = await mkdtemp(join(tmpdir(), 'avatar-lighthouse-'));
  context = await chromium.launchPersistentContext(profile, {
    executablePath: await preinstalledChrome(),
    headless: true,
    timeout: 30_000,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    args: ['--remote-debugging-port=0', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  const port = await debuggingPort(profile);
  checkInterrupted();
  const result = await Promise.race([
    lighthouse(url, {
      port,
      output: 'html',
      onlyCategories: ['performance', 'best-practices'],
      formFactor: 'mobile',
    }),
    interrupted,
    delay(4 * 60_000, undefined, { ref: false }).then(() => {
      throw new Error('Lighthouse exceeded four minutes');
    }),
  ]);
  if (!result || result.lhr.runtimeError) {
    throw new Error(result?.lhr.runtimeError?.message ?? 'Lighthouse produced no result');
  }
  const { lhr, report } = result;
  if (!lhr.categories.performance || !lhr.categories['best-practices']) {
    throw new Error('Lighthouse omitted a requested category');
  }
  if (typeof report !== 'string') throw new Error('Lighthouse omitted its HTML report');
  const json = JSON.stringify(lhr, null, 2) + '\n';
  const limit = 8 * 1024 * 1024;
  if (Buffer.byteLength(report) > limit || Buffer.byteLength(json) > limit) {
    throw new Error('Lighthouse report exceeds the 8 MiB per-file artifact budget');
  }
  partialReport = await mkdtemp(join(root, '.lighthouse-report-'));
  await writeFile(join(partialReport, 'lighthouse-report.html'), report, { flag: 'wx' });
  await writeFile(join(partialReport, 'lighthouse-report.json'), json, { flag: 'wx' });
  checkInterrupted();
  await rename(partialReport, reportPath);
  partialReport = undefined;
  publishedReport = true;
  checkInterrupted();
  for (const id of ['performance', 'best-practices', 'pwa']) {
    const score = lhr.categories[id]?.score;
    console.log(`${id}: ${score == null ? 'unavailable' : Math.round(score * 100)}`);
  }
} catch (error) {
  failure = error;
} finally {
  const cleanupErrors = [];
  let browserClosed = true;
  if (context) {
    try {
      await context.close();
    } catch (error) {
      browserClosed = false;
      cleanupErrors.push(error);
    }
  }
  if (server) {
    try {
      const closed = new Promise((resolve, reject) => {
        server.httpServer.close((error) => (error ? reject(error) : resolve()));
      });
      server.httpServer.closeAllConnections();
      await closed;
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  for (const path of [partialReport, browserClosed ? profile : undefined]) {
    if (!path) continue;
    try {
      await rm(path, { recursive: true });
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (!browserClosed) console.error(`Retained live-browser profile for diagnosis: ${profile}`);
  if (interruption && publishedReport) {
    try {
      await rm(reportPath, { recursive: true });
      publishedReport = false;
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  process.removeListener('SIGINT', onSigint);
  process.removeListener('SIGTERM', onSigterm);
  process.removeListener('SIGHUP', onSighup);
  failure ??= interruption;
  if (cleanupErrors.length) {
    failure = new AggregateError(cleanupErrors, 'Lighthouse cleanup failed', { cause: failure });
  }
}
if (failure) throw failure;
