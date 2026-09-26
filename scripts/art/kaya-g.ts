/**
 * Reproducibly integrates the PixelLab Kaya G locomotion set.
 *
 * Usage:
 *   node --import tsx scripts/art/kaya-g.ts --source <party-consistency/kaya>
 *
 * The source cels remain read-only. They are nearest-neighbour scaled to 75%,
 * kept in their root-locked 192 px coordinate system, and packed beside Kaya's
 * existing cast/KO action cels.
 *
 * Any directory is not accepted: every PixelLab cel and every preserved
 * action cel must match its SHA-256 in the checked-in `PINS` file, and a
 * missing, extra-pinned or changed cel stops the build before anything is
 * written. The build then records the SHA-256 of every decoded atlas cel in
 * the same file, which `art:validate` holds the shipped WebP to.
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

const KEY = 'unit.fire.kaya';
const FRAME_W = 128;
const FRAME_H = 192;
const SCALE = 0.75;
const OFFSET_X = -8;
const OFFSET_Y = 31;
export const PINS = 'art/source/kaya-g/pins.json';
const LEGACY_ACTIONS = 'art/source/kaya-actions';

export interface KayaGPins {
  /** SHA-256 of each PixelLab source cel, relative to the `--source` set. */
  readonly pixellab: Readonly<Record<string, string>>;
  /** SHA-256 of each preserved action cel, relative to `art/source/kaya-actions`. */
  readonly actions: Readonly<Record<string, string>>;
  /** SHA-256 of each decoded atlas cel's RGBA, written by this script. */
  readonly frames: Readonly<Record<string, string>>;
}

/**
 * Per direction: the source folder, its idle, walk and rest clips, the walk
 * cel reused as the walk-to-idle rest transition, and the walk's vertical
 * correction in packed pixels.
 *
 * The transition is the walk cel whose silhouette, as placed, best overlaps
 * idle cel 0 (max IoU). The correction puts the walk's planted sole on the
 * idle's baseline: it is `-round(planted_sole_minus_baseline x 0.75)` from the
 * scripted gates on the delivered set (party-consistency `checks.json`), so a
 * walk that measured 6.1 source px above the idle baseline (north) is lowered
 * 5 px and one that measured 5 px below it (south) is raised 4 px. It moves
 * the walk and rest cels only; idle is the reference and never moves.
 */
const DIRECTIONS = [
  ['east', 'idle', 'walk', 'rest', 9, 0],
  ['north-east', 'idleNorthEast', 'walkNorthEast', 'restNorthEast', 1, -1],
  ['north', 'idleNorth', 'walkNorth', 'restNorth', 10, 5],
  ['north-west', 'idleNorthWest', 'walkNorthWest', 'restNorthWest', 8, 1],
  ['west', 'idleWest', 'walkWest', 'restWest', 4, 0],
  ['south-west', 'idleSouthWest', 'walkSouthWest', 'restSouthWest', 4, -1],
  ['south', 'idleSouth', 'walkSouth', 'restSouth', 6, -4],
  ['south-east', 'idleSouthEast', 'walkSouthEast', 'restSouthEast', 9, -1],
] as const satisfies readonly (readonly [string, ClipName, ClipName, ClipName, number, number])[];

/** Every source file the build reads, relative to its set. */
export function sourceFiles(): { pixellab: string[]; actions: string[] } {
  const pixellab: string[] = [];
  for (const [direction] of DIRECTIONS) {
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

function sourceArg(argv: readonly string[]): string {
  const at = argv.indexOf('--source');
  const value = at < 0 ? undefined : argv[at + 1];
  if (!value) throw new Error('Pass --source <party-consistency/kaya>.');
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
      // The superseded action atlas used soft procedural anti-aliasing. A small
      // lossless-looking channel reduction keeps those four legacy poses from
      // consuming more bytes than all 128 flat PixelLab locomotion cels.
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

function normalise(source: Image, dy = 0): Image {
  if (source.width !== 192 || source.height !== 192)
    throw new Error(`Expected a 192x192 PixelLab cel; got ${source.width}x${source.height}.`);
  const out = newImage(FRAME_W, FRAME_H);
  const scaled = Math.round(192 * SCALE);
  for (let y = 0; y < scaled; y++) {
    for (let x = 0; x < scaled; x++) {
      const rgba = pixelAt(source, Math.floor(x / SCALE), Math.floor(y / SCALE));
      setPixel(out, OFFSET_X + x, OFFSET_Y + dy + y, rgba[3] === 0 ? [0, 0, 0, 0] : rgba);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const source = sourceArg(process.argv.slice(2));
  const legacyActions = resolve(LEGACY_ACTIONS);
  const pins = JSON.parse(readFileSync(PINS, 'utf8')) as KayaGPins;
  const files = sourceFiles();
  const problems = [
    ...checkSources(source, files.pixellab, pins.pixellab, 'PixelLab'),
    ...checkSources(legacyActions, files.actions, pins.actions, 'action'),
  ];
  if (problems.length > 0) {
    throw new Error(`Kaya G sources do not match ${PINS}:\n${problems.join('\n')}`);
  }

  const frames = new Map<string, Image>();
  const counts: Partial<Record<ClipName, number>> = { cast: 3, ko: 1 };

  for (const [direction, idleClip, walkClip, restClip, transition, dy] of DIRECTIONS) {
    counts[idleClip] = 4;
    counts[walkClip] = 12;
    counts[restClip] = 1;
    for (let i = 0; i < 4; i++)
      frames.set(
        `${KEY}/${idleClip}/${i}`,
        normalise(readPng(join(source, 'idle', direction, `${i}.png`))),
      );
    for (let i = 0; i < 12; i++)
      frames.set(
        `${KEY}/${walkClip}/${i}`,
        normalise(
          readPng(join(source, 'walk', direction, `${String(i).padStart(2, '0')}.png`)),
          dy,
        ),
      );
    frames.set(
      `${KEY}/${restClip}/0`,
      normalise(
        readPng(join(source, 'walk', direction, `${String(transition).padStart(2, '0')}.png`)),
        dy,
      ),
    );
  }

  for (const [clip, count] of [
    ['cast', 3],
    ['ko', 1],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const legacy = readPng(join(legacyActions, clip, `${i}.png`));
      frames.set(`${KEY}/${clip}/${i}`, crop(legacy, 0, 0, legacy.width, legacy.height));
    }
  }

  const layout = layoutSheet(KEY, counts, FRAME_W, FRAME_H);
  const atlas = newImage(layout.width, layout.height);
  for (const [name, rect] of layout.frames) {
    const frame = frames.get(name);
    if (!frame) throw new Error(`No pixels prepared for ${name}.`);
    blit(atlas, frame, rect.x, rect.y);
  }

  const outDir = resolve('public/art/units');
  mkdirSync(outDir, { recursive: true });
  const webp = await encodeWebp(atlas, 90, true);
  writeFileSync(join(outDir, 'kaya-g.webp'), webp);
  writeFileSync(
    join(outDir, 'kaya-g.json'),
    `${JSON.stringify(JSON.parse(atlasJsonText(layout.frames, 'kaya-g.webp', layout.width, layout.height)))}\n`,
  );
  const decoded = await decodeWebp(webp);
  const frameHashes: Record<string, string> = {};
  for (const [name, rect] of layout.frames) frameHashes[name] = celHash(decoded, rect);
  writeFileSync(PINS, `${JSON.stringify({ ...pins, frames: frameHashes }, null, 2)}\n`);
  console.log(
    `wrote kaya-g.webp (${layout.width}x${layout.height}, ${Math.round(webp.length / 1024)} KiB), kaya-g.json and ${PINS} cel pins`,
  );
}

if (process.argv[1]?.endsWith('kaya-g.ts')) await main();
