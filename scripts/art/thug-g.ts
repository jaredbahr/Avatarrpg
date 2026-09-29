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
 * Each cel goes through the G build's own map (`normalise` in
 * `g-sprites.ts`): 75% nearest-neighbour into the 128x192 cel, in the same
 * root-locked coordinates, so the thug stands on the party's feet at the
 * party's size. The placement is measured by the party's rules (ADR 0050, as
 * amended by ADR 0051 and ADR 0052), on the walks' own `gates.json`:
 *
 * - `idleDy` levels a north idle onto the anchor's foot line: his stood 5 px
 *   above it, as the party's did.
 * - `walkDy` puts the walk's mean planted sole on the idle's baseline, then
 *   moves it the fewest pixels that bring its mean lowest row within 3.5 px
 *   of idle cel 0's; north walks stay level with their idle, as drawn. The
 *   east and west walks were drawn 20 source px higher on the canvas than
 *   their idles and come down 15-16 px. South-west rises 1 px more, which
 *   keeps its leading foot inside `art:validate`'s 10 px sunk-stride bound.
 * - `walkDx` aligns the walk's head and torso with idle's where their mean
 *   best-overlap offset exceeds 2 px: the west walk sits 7 px left of its
 *   idle, as the party's west walks do, and the south-west 4 px (moved 5,
 *   commented below).
 * - `restCel` is the walk cel that stands like idle (lowest row within 3 px
 *   of idle cel 0's, feet within `art:validate`'s 12 px of the anchor
 *   column) and best overlaps idle cel 0.
 *
 * The walk's clip time per tile comes from each walk's measured
 * `speed_px_per_frame` (`walkMsPerTile` in the manifest).
 *
 * The cast, hit and KO cels are the old thug sheet's, copied verbatim into
 * `art/source/thug-actions` and still mirrored like the party's legacy
 * actions; they stood 121 px at the old 1.23 scale, as tall as the G body at
 * the party's oblique scale.
 *
 * Any directory is not accepted: every cel must match its SHA-256 in the
 * checked-in pin file, and a missing, extra-pinned or changed cel stops the
 * build before anything is written. The build then records the SHA-256 of
 * every decoded atlas cel in the same file, which `art:validate` holds the
 * shipped WebP to.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ClipName } from '../../src/content/assets/clips';
import { headingClip } from '../../src/content/assets/clips';
import { atlasJsonText } from '../../src/render/sheets/atlasJson';
import { layoutSheet } from '../../src/render/sheets/layout';
import { FRAME_H, FRAME_W, WEBP_QUALITY, checkSources, normalise, sha256 } from './g-sprites';
import type { Image } from './lib/image';
import { newImage, pixelAt, readPng, setPixel } from './lib/image';
import { decodeWebp, encodeWebp } from './lib/webp';
import { celHash } from './validate';

export const THUG_KEY = 'unit.enemy.thug';
export const THUG_PINS = 'art/source/thug-g/pins.json';
export const THUG_ACTIONS = 'art/source/thug-actions';
/** The frozen tone the hand-off was toned with (REPORT-2 §2). */
export const THUG_TONE = {
  tool: 'models-p0p1/thug/tone/tone_thug.py',
  params: 'd6f5afc6a8cee9a096fafcc29f9532f847065812a61e95cdc9356d0bdda61494',
} as const;

export const IDLE_CELS = 4;
export const WALK_CELS = 8;

export interface ThugHeading {
  readonly direction: string;
  readonly idle: ClipName;
  readonly walk: ClipName;
  readonly rest: ClipName;
  /** The walk folder, relative to the source. */
  readonly walkDir: string;
  readonly restCel: number;
  readonly walkDx: number;
  readonly walkDy: number;
  readonly idleDy: number;
}

export interface ThugPins {
  /** SHA-256 of each toned PixelLab cel, relative to the `--source` set. */
  readonly pixellab: Readonly<Record<string, string>>;
  /** SHA-256 of each preserved action cel, relative to `THUG_ACTIONS`. */
  readonly actions: Readonly<Record<string, string>>;
  readonly tone: { readonly tool: string; readonly params: string };
  /** SHA-256 of each decoded atlas cel's RGBA, written by this script. */
  readonly frames: Readonly<Record<string, string>>;
}

/** [direction, heading of its clips, rest cel, walk dx, walk dy, idle dy] */
const PLACEMENT = [
  ['east', 'east', 2, 0, 15, 0],
  ['north-east', 'northEast', 5, 0, 7, 0],
  ['north', 'north', 6, 2, 0, 5],
  ['north-west', 'northWest', 6, 0, 8, 0],
  ['west', 'west', 5, 7, 16, 0],
  // The rule gives 4 px right, which leaves cel 7's club 1 px inside the
  // margin; 5 still sits its torso within 2 px of idle's.
  ['south-west', 'southWest', 3, 5, 7, 0],
  ['south', 'south', 2, 0, -3, 0],
  ['south-east', 'southEast', 5, 0, 3, 0],
] as const;

export const THUG_HEADINGS: readonly ThugHeading[] = PLACEMENT.map(
  ([direction, heading, restCel, walkDx, walkDy, idleDy]) => ({
    direction,
    idle: headingClip('idle', heading),
    walk: headingClip('walk', heading),
    rest: headingClip('rest', heading),
    // The south-east walk is the r2b retake (REPORT-2 §4).
    walkDir: direction === 'south-east' ? 'walk-se-r2b' : `walk/${direction}`,
    restCel,
    walkDx,
    walkDy,
    idleDy,
  }),
);

const ACTIONS = [
  ['cast', 3],
  ['hit', 1],
  ['ko', 1],
] as const;

/** Every source file the build reads, relative to its set. */
export function thugSourceFiles(): { pixellab: string[]; actions: string[] } {
  const pixellab: string[] = [];
  for (const h of THUG_HEADINGS) {
    for (let i = 0; i < IDLE_CELS; i++) pixellab.push(`idle/${h.direction}/${i}.png`);
    for (let i = 0; i < WALK_CELS; i++)
      pixellab.push(`${h.walkDir}/${String(i).padStart(2, '0')}.png`);
  }
  const actions = ACTIONS.flatMap(([clip, count]) =>
    Array.from({ length: count }, (_, i) => `${clip}/${i}.png`),
  );
  return { pixellab, actions };
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
  const counts: Partial<Record<ClipName, number>> = { cast: 3, hit: 1, ko: 1 };
  for (const h of THUG_HEADINGS) {
    counts[h.idle] = IDLE_CELS;
    counts[h.walk] = WALK_CELS;
    counts[h.rest] = 1;
  }
  return counts;
}

export interface ThugBuildOptions {
  readonly outDir: string;
  readonly pinsPath?: string;
  readonly actions?: string;
  readonly log?: (line: string) => void;
}

export async function buildThug(
  source: string,
  options: ThugBuildOptions,
): Promise<{ bytes: number; frames: Record<string, string> }> {
  const pinsPath = options.pinsPath ?? THUG_PINS;
  const actionsDir = options.actions ?? THUG_ACTIONS;
  const log = options.log ?? console.log;
  if (!existsSync(pinsPath)) throw new Error(`${pinsPath} is missing; pin the sources with --pin.`);
  const pins = JSON.parse(readFileSync(pinsPath, 'utf8')) as ThugPins;
  const files = thugSourceFiles();
  const problems = [
    ...checkSources(source, files.pixellab, pins.pixellab, 'PixelLab'),
    ...checkSources(actionsDir, files.actions, pins.actions, 'action'),
  ];
  if (pins.tone?.params !== THUG_TONE.params)
    problems.push(`${pinsPath} does not record the frozen tone parameters`);
  if (problems.length > 0)
    throw new Error(`thug G sources do not match ${pinsPath}:\n${problems.join('\n')}`);

  const frames = new Map<string, Image>();
  for (const h of THUG_HEADINGS) {
    const walkCel = (i: number) =>
      normalise(
        readPng(join(source, h.walkDir, `${String(i).padStart(2, '0')}.png`)),
        h.walkDx,
        h.walkDy + h.idleDy,
      );
    for (let i = 0; i < IDLE_CELS; i++)
      frames.set(
        `${THUG_KEY}/${h.idle}/${i}`,
        normalise(readPng(join(source, 'idle', h.direction, `${i}.png`)), 0, h.idleDy),
      );
    for (let i = 0; i < WALK_CELS; i++) frames.set(`${THUG_KEY}/${h.walk}/${i}`, walkCel(i));
    frames.set(`${THUG_KEY}/${h.rest}/0`, walkCel(h.restCel));
  }
  for (const [clip, count] of ACTIONS) {
    for (let i = 0; i < count; i++) {
      const cel = readPng(join(actionsDir, clip, `${i}.png`));
      if (cel.width !== FRAME_W || cel.height !== FRAME_H)
        throw new Error(`${clip}/${i} is ${cel.width}x${cel.height}, not ${FRAME_W}x${FRAME_H}.`);
      frames.set(`${THUG_KEY}/${clip}/${i}`, cel);
    }
  }

  const layout = layoutSheet(THUG_KEY, thugCounts(), FRAME_W, FRAME_H);
  const atlas = newImage(layout.width, layout.height);
  for (const [frame, rect] of layout.frames) {
    const pixels = frames.get(frame);
    if (!pixels) throw new Error(`No pixels prepared for ${frame}.`);
    for (let y = 0; y < pixels.height; y++)
      for (let x = 0; x < pixels.width; x++)
        setPixel(atlas, rect.x + x, rect.y + y, pixelAt(pixels, x, y));
  }
  const webp = await encodeWebp(atlas, WEBP_QUALITY, true);
  const json = `${JSON.stringify(JSON.parse(atlasJsonText(layout.frames, 'thug-g.webp', layout.width, layout.height)))}\n`;
  const decoded = await decodeWebp(webp);
  const frameHashes: Record<string, string> = {};
  for (const [frame, rect] of layout.frames) frameHashes[frame] = celHash(decoded, rect);

  mkdirSync(options.outDir, { recursive: true });
  writeFileSync(join(options.outDir, 'thug-g.webp'), webp);
  writeFileSync(join(options.outDir, 'thug-g.json'), json);
  writeFileSync(pinsPath, `${JSON.stringify({ ...pins, frames: frameHashes }, null, 2)}\n`);
  log(`wrote thug-g.webp (${layout.width}x${layout.height}, ${webp.length} B) and thug-g.json`);
  log(`wrote ${pinsPath} cel pins`);
  return { bytes: webp.length, frames: frameHashes };
}

function argValue(argv: readonly string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at < 0 ? undefined : argv[at + 1];
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
