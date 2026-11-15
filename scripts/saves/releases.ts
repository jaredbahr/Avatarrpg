/**
 * The release fixtures (ADR 0112): what the story was when each release
 * shipped, and saves written by it.
 *
 * `src/core/save/fixtures/releases/index.json` lists the releases oldest
 * first. Each has a folder holding `history.json` (a `HistorySnapshot`) and
 * its saves; the first release's saves are the format corpus, `golden/v5`,
 * which is where it says they are. Every file's SHA-256 is in the index, so a
 * release that has been regenerated or edited fails `saveHistory.test.ts`.
 *
 * A release is frozen once and never again:
 *
 *   npm run saves:release -- <id> ["<note>"]
 *
 * writes a new folder from today's content (the golden route's eighteen saves,
 * stamped with today's history revision) and appends it to the index. It
 * refuses an id that exists. Importing this file writes nothing.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { FLAG_BACKFILLS, HISTORY_REV } from '../../src/content/story/flagBackfills';
import type { HistorySnapshot } from '../../src/content/story/saveHistory';
import { HISTORY_NOW } from '../../src/content/story/saveHistoryNow';
import { generateGoldenSaves, GOLDEN_CHECKPOINTS } from './make-golden';
import type { GoldenCheckpoint } from './make-golden';

export const RELEASES_ROOT = fileURLToPath(
  new URL('../../src/core/save/fixtures/releases/', import.meta.url),
);

export interface ReleaseEntry {
  readonly id: string;
  /** The folder holding the saves, relative to the release's own folder. */
  readonly saves: string;
  /** File name to SHA-256: `history.json` and every save. */
  readonly files: Readonly<Record<string, string>>;
}

export interface ReleaseSave {
  /** `<release id>/<file name>`. */
  readonly name: string;
  readonly file: string;
  readonly json: string;
  /** The golden route checkpoint the file name says it stands at, if it is one. */
  readonly checkpoint: GoldenCheckpoint | null;
  readonly partySize: 1 | 4 | null;
}

export interface Release {
  readonly entry: ReleaseEntry;
  readonly snapshot: HistorySnapshot;
  readonly saves: readonly ReleaseSave[];
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function readIndex(root: string): ReleaseEntry[] {
  const path = join(root, 'index.json');
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as ReleaseEntry[]) : [];
}

function saveFiles(directory: string): string[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json') && name !== 'history.json')
    .sort();
}

/** Every release, oldest first, with its snapshot and saves read from disk. */
export function loadReleases(root = RELEASES_ROOT): Release[] {
  return readIndex(root).map((entry) => {
    const folder = join(root, entry.id);
    const savesAt = resolve(folder, entry.saves);
    const snapshot = JSON.parse(
      readFileSync(join(folder, 'history.json'), 'utf8'),
    ) as HistorySnapshot;
    const saves = saveFiles(savesAt).map((file): ReleaseSave => {
      const match = /^party-(1|4)-(.+)\.json$/.exec(file);
      const checkpoint = GOLDEN_CHECKPOINTS.find((name) => name === match?.[2]) ?? null;
      return {
        name: `${entry.id}/${file}`,
        file,
        json: readFileSync(join(savesAt, file), 'utf8'),
        checkpoint,
        partySize: match && checkpoint ? (Number(match[1]) as 1 | 4) : null,
      };
    });
    return { entry, snapshot, saves };
  });
}

/** Every way the files on disk differ from what the index froze. Empty means untouched. */
export function frozenProblems(root = RELEASES_ROOT): string[] {
  const problems: string[] = [];
  const index = readIndex(root);
  const ids = new Set<string>();
  for (const entry of index) {
    if (ids.has(entry.id)) problems.push(`release ${entry.id} is listed twice`);
    ids.add(entry.id);
    const folder = join(root, entry.id);
    const savesAt = resolve(folder, entry.saves);
    const onDisk = new Map<string, string>();
    if (existsSync(join(folder, 'history.json')))
      onDisk.set('history.json', readFileSync(join(folder, 'history.json'), 'utf8'));
    if (existsSync(savesAt))
      for (const file of saveFiles(savesAt))
        onDisk.set(file, readFileSync(join(savesAt, file), 'utf8'));
    for (const [file, hash] of Object.entries(entry.files)) {
      const text = onDisk.get(file);
      if (text === undefined) problems.push(`release ${entry.id}: ${file} is missing`);
      else if (sha256(text) !== hash)
        problems.push(
          `release ${entry.id}: ${file} has changed since it was frozen. A release is never regenerated or edited; freeze a new one instead.`,
        );
    }
    for (const file of onDisk.keys())
      if (!Object.hasOwn(entry.files, file))
        problems.push(`release ${entry.id}: ${file} is not in the index`);
  }
  if (existsSync(root))
    for (const item of readdirSync(root, { withFileTypes: true }))
      if (item.isDirectory() && !ids.has(item.name))
        problems.push(`fixtures/releases/${item.name} is not listed in index.json`);
  return problems;
}

/** The snapshot of today's story, as a release would freeze it. */
export function snapshotNow(
  release: string,
  frozen: string,
  commit: string,
  note: string,
): HistorySnapshot {
  return {
    release,
    frozen,
    commit,
    note,
    historyRev: HISTORY_REV,
    rules: FLAG_BACKFILLS,
    regions: HISTORY_NOW.regions,
    writes: HISTORY_NOW.writes,
  };
}

async function pretty(value: unknown, filepath: string): Promise<string> {
  const options = await resolveConfig(filepath);
  return format(JSON.stringify(value), { ...options, parser: 'json', filepath });
}

/** Freezes a release into `root`. `frozen` and `commit` are passed in; nothing here reads a clock. */
export async function freezeRelease(
  id: string,
  options: {
    readonly note: string;
    readonly frozen: string;
    readonly commit: string;
    readonly root?: string;
  },
): Promise<ReleaseEntry> {
  const root = options.root ?? RELEASES_ROOT;
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(id))
    throw new Error(`"${id}" is not a release id: lower-case letters, digits, dots and dashes`);
  const index = readIndex(root);
  const folder = join(root, id);
  if (index.some((entry) => entry.id === id) || existsSync(folder))
    throw new Error(`Release ${id} is already frozen. A release is never regenerated.`);

  const files: Record<string, string> = {};
  const history = await pretty(
    snapshotNow(id, options.frozen, options.commit, options.note),
    join(folder, 'history.json'),
  );
  const saves = await generateGoldenSaves(HISTORY_REV);
  mkdirSync(join(folder, 'saves'), { recursive: true });
  writeFileSync(join(folder, 'history.json'), history, { flag: 'wx' });
  files['history.json'] = sha256(history);
  for (const save of saves) {
    writeFileSync(join(folder, 'saves', save.filename), save.json, { flag: 'wx' });
    files[save.filename] = sha256(save.json);
  }
  const entry: ReleaseEntry = { id, saves: 'saves', files };
  writeFileSync(
    join(root, 'index.json'),
    await pretty([...index, entry], join(root, 'index.json')),
  );
  return entry;
}

async function main(args: readonly string[]): Promise<void> {
  const [id, note] = args;
  if (!id || args.length > 2)
    throw new Error(
      'Usage: npm run saves:release -- <id> ["<note>"]   (an id such as 2027-01-family-1)',
    );
  const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  const entry = await freezeRelease(id, {
    note: note ?? '',
    frozen: new Date().toISOString().slice(0, 10),
    commit,
  });
  process.stdout.write(
    `${JSON.stringify({ release: id, commit, historyRev: HISTORY_REV, files: Object.keys(entry.files).length })}\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
