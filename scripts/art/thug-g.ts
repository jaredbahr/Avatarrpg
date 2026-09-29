/**
 * Reproducibly builds the thug's G sheet (ADR 0059): the toned PixelLab
 * thug's eight-heading idle and walk, packed as the party's G locomotion is,
 * beside the old sheet's cast, hit and KO cels.
 *
 * Usage:
 *   node --import tsx scripts/art/thug-g.ts --source <models-p0p1/thug/tone/out-v3> [--pin]
 *
 * The source is the thug hand-off toned with the frozen `params-v3.json`
 * (`tone_thug.py`): `idle/<heading>/<i>.png`, four cels a heading, and the
 * root-locked `walk/<heading>/NN.png`, eight a heading, south-east from the
 * `walk-se-r2b` retake. Every cel is 192 px. The cels are read-only and are
 * never re-toned; `--pin` refuses a cel whose hash is not the one its tone
 * manifest wrote with those parameters.
 *
 * The shared enemy packer (`enemy-g.ts`) places and packs every cel, and
 * records the placement rules. On the thug they measure:
 *
 * - `idleDy`: his north idle stood 5 px above the foot line, as the party's
 *   did.
 * - `walkDy`: the east and west walks were drawn 20 source px higher on the
 *   canvas than their idles and come down 15-16 px. South-west rises 1 px
 *   more, which keeps its leading foot inside `art:validate`'s 10 px
 *   sunk-stride bound.
 * - `walkDx`: the west walk sits 7 px left of its idle, as the party's west
 *   walks do, and the south-west 4 px (moved 5, commented below).
 * - `headingDx` is 0 throughout: his south-east feet stand inside the bound.
 *
 * The walk's clip time per tile comes from each walk's measured
 * `speed_px_per_frame` (`walkMsPerTile` in the manifest).
 *
 * The cast, hit and KO cels are the old thug sheet's, copied verbatim into
 * `art/source/thug-actions` and still mirrored like the party's legacy
 * actions; they stood 121 px at the old 1.23 scale, as tall as the G body at
 * the party's oblique scale.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ClipName } from '../../src/content/assets/clips';
import { sha256 } from './g-sprites';
import type { EnemyG, EnemyGBuildOptions, EnemyGPins, EnemyGPlacement } from './enemy-g';
import {
  IDLE_CELS,
  WALK_CELS,
  argValue,
  buildEnemyG,
  enemyCounts,
  enemyHeadings,
  enemySourceFiles,
} from './enemy-g';

export { IDLE_CELS, WALK_CELS };

export const THUG_KEY = 'unit.enemy.thug';
export const THUG_PINS = 'art/source/thug-g/pins.json';
export const THUG_ACTIONS = 'art/source/thug-actions';
/** The frozen tone the hand-off was toned with (REPORT-2 §2). */
export const THUG_TONE = {
  tool: 'models-p0p1/thug/tone/tone_thug.py',
  params: 'd6f5afc6a8cee9a096fafcc29f9532f847065812a61e95cdc9356d0bdda61494',
} as const;

export type ThugPins = EnemyGPins;

/** [direction, heading of its clips, rest cel, walk dx, walk dy, idle dy, heading dx] */
const PLACEMENT: readonly EnemyGPlacement[] = [
  ['east', 'east', 2, 0, 15, 0, 0],
  ['north-east', 'northEast', 5, 0, 7, 0, 0],
  ['north', 'north', 6, 2, 0, 5, 0],
  ['north-west', 'northWest', 6, 0, 8, 0, 0],
  ['west', 'west', 5, 7, 16, 0, 0],
  // The rule gives 4 px right, which leaves cel 7's club 1 px inside the
  // margin; 5 still sits its torso within 2 px of idle's.
  ['south-west', 'southWest', 3, 5, 7, 0, 0],
  ['south', 'south', 2, 0, -3, 0, 0],
  ['south-east', 'southEast', 5, 0, 3, 0, 0],
];

export const THUG: EnemyG = {
  key: THUG_KEY,
  name: 'thug',
  pins: THUG_PINS,
  actions: THUG_ACTIONS,
  tone: THUG_TONE,
  frameW: 128,
  // The south-east walk is the r2b retake (REPORT-2 §4).
  headings: enemyHeadings(PLACEMENT, (direction) =>
    direction === 'south-east' ? 'walk-se-r2b' : `walk/${direction}`,
  ),
};

export const THUG_HEADINGS = THUG.headings;

/** Every source file the build reads, relative to its set. */
export function thugSourceFiles(): { pixellab: string[]; actions: string[] } {
  return enemySourceFiles(THUG);
}

/**
 * The tone manifest's hash for each file, under the frozen parameters: the
 * manifest beside each folder (`idle/`, `walk/`, `walk-se-r2b/`) names its
 * files relative to itself.
 */
function tonedHashes(source: string): { hashes: Map<string, string>; problems: string[] } {
  const hashes = new Map<string, string>();
  const problems: string[] = [];
  for (const folder of ['idle', 'walk', 'walk-se-r2b']) {
    const path = join(source, folder, 'tone-manifest.json');
    if (!existsSync(path)) {
      problems.push(`${folder}/tone-manifest.json is missing`);
      continue;
    }
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as {
      params_sha256?: string;
      files?: Record<string, { out?: string }>;
    };
    if (manifest.params_sha256 !== THUG_TONE.params)
      problems.push(`${folder} was not toned with the frozen parameters`);
    for (const [file, entry] of Object.entries(manifest.files ?? {}))
      if (entry.out) hashes.set(`${folder}/${file}`, entry.out);
  }
  return { hashes, problems };
}

/** Writes a fresh pin file for a source set. Refuses to overwrite one, or to pin an untoned cel. */
export function pinThugSources(source: string, pinsPath = THUG_PINS): void {
  if (existsSync(pinsPath))
    throw new Error(`${pinsPath} exists; a pin file is never rewritten by --pin.`);
  const files = thugSourceFiles();
  const { hashes, problems } = tonedHashes(source);
  const pixellab: Record<string, string> = {};
  for (const file of files.pixellab) {
    const path = join(source, file);
    if (!existsSync(path)) {
      problems.push(`${file} is missing`);
      continue;
    }
    const hash = sha256(readFileSync(path));
    if (hashes.get(file) !== hash) problems.push(`${file} is not the cel its tone manifest wrote`);
    pixellab[file] = hash;
  }
  if (problems.length > 0) throw new Error(`${source} cannot be pinned:\n${problems.join('\n')}`);
  const actions = Object.fromEntries(
    files.actions.map((file) => [file, sha256(readFileSync(join(THUG_ACTIONS, file)))]),
  );
  const pins: ThugPins = { pixellab, actions, tone: THUG_TONE, frames: {} };
  mkdirSync(resolve(pinsPath, '..'), { recursive: true });
  writeFileSync(pinsPath, `${JSON.stringify(pins, null, 2)}\n`);
}

/** The clip frame counts of the one page: locomotion and the legacy actions. */
export function thugCounts(): Partial<Record<ClipName, number>> {
  return enemyCounts(THUG);
}

export type ThugBuildOptions = EnemyGBuildOptions;

export function buildThug(
  source: string,
  options: ThugBuildOptions,
): Promise<{ bytes: number; frames: Record<string, string> }> {
  return buildEnemyG(THUG, source, options);
}

if (process.argv[1]?.endsWith('thug-g.ts')) {
  const argv = process.argv.slice(2);
  const sourceArg = argValue(argv, '--source');
  if (!sourceArg) throw new Error('Pass --source <models-p0p1/thug/tone/out-v3>.');
  const source = resolve(sourceArg);
  if (argv.includes('--pin')) {
    pinThugSources(source);
    console.log(`wrote ${THUG_PINS} source pins`);
  } else {
    await buildThug(source, { outDir: resolve('public/art/units') });
  }
}
