/**
 * Reproducibly integrates a party member's PixelLab G locomotion set
 * (ADR 0050; Sura and Bo, ADR 0051).
 *
 * Usage:
 *   node --import tsx scripts/art/g-sprites.ts --character <kaya|sura|bo> --source <party-consistency/<name>>
 *
 * The source cels remain read-only. They are nearest-neighbour scaled to 75%,
 * kept in their root-locked 192 px coordinate system, and packed beside the
 * character's existing cast/KO action cels.
 *
 * Any directory is not accepted: every PixelLab cel and every preserved
 * action cel must match its SHA-256 in the character's checked-in pin file,
 * and a missing, extra-pinned or changed cel stops the build before anything
 * is written. The build then records the SHA-256 of every decoded atlas cel
 * in the same file, which `art:validate` holds the shipped WebP to.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ClipName } from '../../src/content/assets/clips';
import { atlasJsonText } from '../../src/render/sheets/atlasJson';
import { layoutSheet } from '../../src/render/sheets/layout';
import type { Image } from './lib/image';
import { newImage, pixelAt, readPng, setPixel } from './lib/image';
import { decodeWebp, encodeWebp } from './lib/webp';
import { celHash } from './validate';

const FRAME_W = 128;
const FRAME_H = 192;
const SCALE = 0.75;
const OFFSET_X = -8;
const OFFSET_Y = 31;
/** The lossy encoding every G atlas ships at (ADR 0050, ADR 0051). */
export const WEBP_QUALITY = 90;

export interface GPins {
  /** SHA-256 of each PixelLab source cel, relative to the `--source` set. */
  readonly pixellab: Readonly<Record<string, string>>;
  /** SHA-256 of each preserved action cel, relative to the character's `actions` folder. */
  readonly actions: Readonly<Record<string, string>>;
  /** SHA-256 of each decoded atlas cel's RGBA, written by this script. */
  readonly frames: Readonly<Record<string, string>>;
}

/**
 * One heading of a G set: the source folder, its idle, walk and rest clips,
 * the walk cel reused as the walk-to-idle rest transition, and the placement
 * in packed pixels.
 *
 * Every number is measured on the placed cels, by one rule for every
 * character (ADR 0050, as amended by ADR 0051):
 *
 * - `walkDy` puts the walk's planted sole on the idle's baseline:
 *   `-round(planted_sole_minus_baseline x 0.75)` from the scripted gates on
 *   the delivered set (party-consistency `checks.json`), so a walk that
 *   measured 5 source px below the idle baseline (Kaya south) is raised 4 px.
 *   North is the exception: seen from behind, the planted sole is the leading
 *   foot, a stride up-screen of where the figure stands, and lowering Kaya's
 *   walk to it (the gates' 5 px) dropped her head and body 6 px on the first
 *   cel. Every north walk is drawn level with its idle and stays where it was
 *   drawn: Kaya's mean lowest row sits 0.6 px below her idle's, her mean head
 *   row 0.4 px below. Where the sole rule leaves a walk's mean lowest row
 *   more than 3.5 px below idle cel 0's (art:validate allows 4), the walk is
 *   raised the fewest pixels that bring it inside: the up-screen diagonals,
 *   whose trailing foot hangs below the stance.
 * - `walkDx` aligns the walk's head and torso with idle's: where the mean
 *   upper-body offset (the best-overlap registration of each cel's top 45%
 *   against idle cel 0's) exceeds 2 px, the walk moves by its rounding. The
 *   west walks are drawn 6-8 px left of their idles.
 * - `restCel` is the walk cel whose placed silhouette best overlaps idle
 *   cel 0 among the cels that stand like idle: lowest row within 3 px of
 *   idle's, lowest foot centred within 10 px of the anchor column, and head
 *   and torso within 4 px of idle's. Without the filter the best overlap can
 *   be a contact pose with the trailing foot 24 px off the column, or a lone
 *   leading foot 16 px off it, which stops the figure beside its feet.
 * - `idleDy` moves a whole heading, idle included, only where its idle
 *   stands outside art:validate's 6 px standing tolerance, by the least that
 *   brings it inside. Otherwise idle is the reference and never moves.
 *
 * A constant shift moves no foot relative to another, so the distance
 * phasing and the measured root travel are unchanged.
 */
export interface GHeading {
  readonly direction: string;
  readonly idle: ClipName;
  readonly walk: ClipName;
  readonly rest: ClipName;
  readonly restCel: number;
  readonly walkDx: number;
  readonly walkDy: number;
  readonly idleDy: number;
}

export interface GCharacter {
  /** The unit asset key the atlas frames are named under. */
  readonly key: string;
  /** Output stem: `public/art/units/<name>-g.webp` and `.json`. */
  readonly name: string;
  /** The pin file, relative to the repo root. */
  readonly pins: string;
  /** The preserved legacy cast/KO cels, relative to the repo root. */
  readonly actions: string;
  readonly headings: readonly GHeading[];
}

/** Rest cel, walk dx, walk dy and idle dy for each heading, in `HEADING_ROWS` order. */
type Placement = readonly [number, number, number, number?];

const HEADING_ROWS = [
  ['east', 'idle', 'walk', 'rest'],
  ['north-east', 'idleNorthEast', 'walkNorthEast', 'restNorthEast'],
  ['north', 'idleNorth', 'walkNorth', 'restNorth'],
  ['north-west', 'idleNorthWest', 'walkNorthWest', 'restNorthWest'],
  ['west', 'idleWest', 'walkWest', 'restWest'],
  ['south-west', 'idleSouthWest', 'walkSouthWest', 'restSouthWest'],
  ['south', 'idleSouth', 'walkSouth', 'restSouth'],
  ['south-east', 'idleSouthEast', 'walkSouthEast', 'restSouthEast'],
] as const satisfies readonly (readonly [string, ClipName, ClipName, ClipName])[];

function headings(placements: readonly Placement[]): GHeading[] {
  if (placements.length !== HEADING_ROWS.length)
    throw new Error('A G set places all eight headings.');
  return HEADING_ROWS.map(([direction, idle, walk, rest], i) => {
    const [restCel, walkDx, walkDy, idleDy = 0] = placements[i] ?? [0, 0, 0];
    return { direction, idle, walk, rest, restCel, walkDx, walkDy, idleDy };
  });
}

export const CHARACTERS: Readonly<Record<'kaya' | 'sura' | 'bo', GCharacter>> = {
  kaya: {
    key: 'unit.fire.kaya',
    name: 'kaya',
    pins: 'art/source/kaya-g/pins.json',
    actions: 'art/source/kaya-actions',
    // E, NE, N, NW, W, SW, S, SE: [rest cel, walk dx, walk dy, idle dy]
    headings: headings([
      [9, 0, 0],
      [9, 0, -2],
      [10, 0, 0],
      [2, 0, -1],
      [3, 6, 0],
      [3, 0, -1],
      [10, 0, -4],
      [9, 0, -1],
    ]),
  },
  sura: {
    key: 'unit.water.sura',
    name: 'sura',
    pins: 'art/source/sura-g/pins.json',
    actions: 'art/source/sura-actions',
    // Sura's north idle stands 7 px above the anchor line; the heading moves 1 px down.
    headings: headings([
      [3, 0, 1],
      [3, 0, -2],
      [10, 2, 0, 1],
      [9, 2, 0],
      [9, 8, 0],
      [4, 3, 0],
      [10, 0, -3],
      [9, 0, -1],
    ]),
  },
  bo: {
    key: 'unit.earth.bo',
    name: 'bo',
    pins: 'art/source/bo-g/pins.json',
    actions: 'art/source/bo-actions',
    headings: headings([
      [3, 0, 1],
      [8, 0, -1],
      [10, 3, 0],
      [9, 0, 0],
      [3, 6, 1],
      [4, 3, 0],
      [2, 0, -4],
      // The rules give 1 px down, which puts cel 6's leading foot 11 px below
      // the line, past art:validate's 10 px sunk-stride bound; it stays at 0.
      [9, 0, 0],
    ]),
  },
};

/** Every source file a character's build reads, relative to its set. */
export function sourceFiles(character: GCharacter): { pixellab: string[]; actions: string[] } {
  const pixellab: string[] = [];
  for (const { direction } of character.headings) {
    for (let i = 0; i < 4; i++) pixellab.push(`idle/${direction}/${i}.png`);
    for (let i = 0; i < 12; i++)
      pixellab.push(`walk/${direction}/${String(i).padStart(2, '0')}.png`);
  }
  return { pixellab, actions: ['cast/0.png', 'cast/1.png', 'cast/2.png', 'ko/0.png'] };
}

export const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

/**
 * Problems with a source set against its pins: an unpinned file the build
 * needs, a pinned file it does not, and any file missing or changed.
 */
export function checkSources(
  root: string,
  files: readonly string[],
  pins: Readonly<Record<string, string>>,
  label: string,
): string[] {
  const problems: string[] = [];
  for (const file of files) {
    const want = pins[file];
    const path = join(root, file);
    if (!want) problems.push(`${label} ${file} has no pin`);
    else if (!existsSync(path)) problems.push(`${label} ${file} is missing from ${root}`);
    else if (sha256(readFileSync(path)) !== want)
      problems.push(`${label} ${file} does not match its pin`);
  }
  for (const file of Object.keys(pins)) {
    if (!files.includes(file)) problems.push(`${label} pin ${file} is not a file the build reads`);
  }
  return problems;
}

function argValue(argv: readonly string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at < 0 ? undefined : argv[at + 1];
}

function characterArg(argv: readonly string[]): GCharacter {
  const name = argValue(argv, '--character');
  const character =
    name && Object.hasOwn(CHARACTERS, name) ? CHARACTERS[name as keyof typeof CHARACTERS] : null;
  if (!character)
    throw new Error(`Pass --character <${Object.keys(CHARACTERS).join('|')}>; got ${name}.`);
  return character;
}

function sourceArg(argv: readonly string[]): string {
  const value = argValue(argv, '--source');
  if (!value) throw new Error('Pass --source <party-consistency/<name>>.');
  return resolve(value);
}

function blit(target: Image, source: Image, x0: number, y0: number): void {
  for (let y = 0; y < source.height; y++)
    for (let x = 0; x < source.width; x++) setPixel(target, x0 + x, y0 + y, pixelAt(source, x, y));
}

function crop(source: Image, x0: number, y0: number, width: number, height: number): Image {
  const out = newImage(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelAt(source, x0 + x, y0 + y);
      if (a === 0) {
        setPixel(out, x, y, [0, 0, 0, 0]);
        continue;
      }
      // The superseded action atlases used soft procedural anti-aliasing. A
      // small lossless-looking channel reduction keeps those four legacy
      // poses from consuming more bytes than all 128 flat PixelLab cels.
      setPixel(out, x, y, [
        Math.min(255, Math.round(r / 16) * 16),
        Math.min(255, Math.round(g / 16) * 16),
        Math.min(255, Math.round(b / 16) * 16),
        Math.min(255, Math.round(a / 32) * 32),
      ]);
    }
  }
  return out;
}

function normalise(source: Image, dx = 0, dy = 0): Image {
  if (source.width !== 192 || source.height !== 192)
    throw new Error(`Expected a 192x192 PixelLab cel; got ${source.width}x${source.height}.`);
  const out = newImage(FRAME_W, FRAME_H);
  const scaled = Math.round(192 * SCALE);
  for (let y = 0; y < scaled; y++) {
    for (let x = 0; x < scaled; x++) {
      const rgba = pixelAt(source, Math.floor(x / SCALE), Math.floor(y / SCALE));
      setPixel(out, OFFSET_X + dx + x, OFFSET_Y + dy + y, rgba[3] === 0 ? [0, 0, 0, 0] : rgba);
    }
  }
  return out;
}

export async function buildG(character: GCharacter, source: string): Promise<void> {
  const { key, name } = character;
  const legacyActions = resolve(character.actions);
  const pins = JSON.parse(readFileSync(character.pins, 'utf8')) as GPins;
  const files = sourceFiles(character);
  const problems = [
    ...checkSources(source, files.pixellab, pins.pixellab, 'PixelLab'),
    ...checkSources(legacyActions, files.actions, pins.actions, 'action'),
  ];
  if (problems.length > 0) {
    throw new Error(`${name} G sources do not match ${character.pins}:\n${problems.join('\n')}`);
  }

  const frames = new Map<string, Image>();
  const counts: Partial<Record<ClipName, number>> = { cast: 3, ko: 1 };

  for (const h of character.headings) {
    counts[h.idle] = 4;
    counts[h.walk] = 12;
    counts[h.rest] = 1;
    const walkCel = (i: number) =>
      normalise(
        readPng(join(source, 'walk', h.direction, `${String(i).padStart(2, '0')}.png`)),
        h.walkDx,
        h.walkDy + h.idleDy,
      );
    for (let i = 0; i < 4; i++)
      frames.set(
        `${key}/${h.idle}/${i}`,
        normalise(readPng(join(source, 'idle', h.direction, `${i}.png`)), 0, h.idleDy),
      );
    for (let i = 0; i < 12; i++) frames.set(`${key}/${h.walk}/${i}`, walkCel(i));
    frames.set(`${key}/${h.rest}/0`, walkCel(h.restCel));
  }

  for (const [clip, count] of [
    ['cast', 3],
    ['ko', 1],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const legacy = readPng(join(legacyActions, clip, `${i}.png`));
      frames.set(`${key}/${clip}/${i}`, crop(legacy, 0, 0, legacy.width, legacy.height));
    }
  }

  const layout = layoutSheet(key, counts, FRAME_W, FRAME_H);
  const atlas = newImage(layout.width, layout.height);
  for (const [frame, rect] of layout.frames) {
    const pixels = frames.get(frame);
    if (!pixels) throw new Error(`No pixels prepared for ${frame}.`);
    blit(atlas, pixels, rect.x, rect.y);
  }

  const outDir = resolve('public/art/units');
  mkdirSync(outDir, { recursive: true });
  const webp = await encodeWebp(atlas, WEBP_QUALITY, true);
  writeFileSync(join(outDir, `${name}-g.webp`), webp);
  writeFileSync(
    join(outDir, `${name}-g.json`),
    `${JSON.stringify(JSON.parse(atlasJsonText(layout.frames, `${name}-g.webp`, layout.width, layout.height)))}\n`,
  );
  const decoded = await decodeWebp(webp);
  const frameHashes: Record<string, string> = {};
  for (const [frame, rect] of layout.frames) frameHashes[frame] = celHash(decoded, rect);
  writeFileSync(character.pins, `${JSON.stringify({ ...pins, frames: frameHashes }, null, 2)}\n`);
  console.log(
    `wrote ${name}-g.webp (${layout.width}x${layout.height}, ${Math.round(webp.length / 1024)} KiB), ${name}-g.json and ${character.pins} cel pins`,
  );
}

if (process.argv[1]?.endsWith('g-sprites.ts')) {
  const argv = process.argv.slice(2);
  await buildG(characterArg(argv), sourceArg(argv));
}
