/**
 * Reproducibly packs a G party member's approved knockouts (four screen
 * diagonals) onto a further page of the character's G sheet, and writes the
 * clips that draw them beside it (ADR 0059).
 *
 * Usage:
 *   node --import tsx scripts/art/g-clips.ts --character <kaya|sura|bo> \
 *     --source <models-p0p1/work> [--pin]
 *
 * The source is the P0 hand-off: each take's cels as `<proc|toned>/<take>/NN.png`
 * on the 320 px canvas the bend uses, and its timing as
 * `proc/<take>/timing.json`. Kaya's cels are the untoned `proc` set; Sura's
 * and Bo's are the `toned` set, already toned and never re-toned. The cels
 * are read-only. Bo's north-west knockout is the r2 retake. The hand-off's hit
 * reactions are not packed: their motion is CC BY-SA, which this project
 * does not ship (ADR 0059).
 *
 * Registration is the bend packer's (`bend-sprites.ts`), not a second copy
 * of it: each take's frame 0 is the approved stance cel of its heading, found
 * by matching its alpha pixel for pixel against the packed stance cel the G
 * build shipped, and every cel is sampled through the G build's 75%
 * nearest-neighbour map. Frame 0 must reproduce the shipped stance within
 * `STANCE_TOLERANCE` or the build stops. So a knockout starts on the stance's
 * feet at its size.
 *
 * Each take's cels share one trimmed rectangle, the take's ink plus the art
 * bible's margin, with the foot anchor recorded as a fraction of it: a body
 * lying flat does not fit a standing cel. A cel whose pixels repeat an
 * earlier cel's is packed once and named twice: a hold is timing, never a
 * second cel. A repeat that is not declared in `holds` stops the build, and
 * so does a declared hold that is not a repeat. The take's hit-stop, "hold
 * the contact frame an extra hitstop.ms", is added to that frame's time.
 *
 * Any directory is not accepted: every cel and timing file must match its
 * SHA-256 in the character's checked-in pin file, and a missing, stray or
 * changed file stops the build before anything is written. `--pin` writes the
 * pin file from a source set once, and refuses when one exists. The build
 * then records the SHA-256 of every decoded atlas cel in the same file, which
 * `art:validate` holds the shipped WebP to.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ClipName } from '../../src/content/assets/clips';
import { KO_HEADINGS, koClip } from '../../src/content/assets/clips';
import { ASSETS } from '../../src/content/assets/manifest';
import { atlasJsonText } from '../../src/render/sheets/atlasJson';
import type { BendCharacter, BendHeading, Box } from './bend-sprites';
import {
  BEND_CHARACTERS,
  STANCE_TOLERANCE,
  assertStance,
  layoutBendPages,
  packCel,
  register,
  shippedStance,
  SOURCE_SIZE,
  sourceToG,
} from './bend-sprites';
import { FRAME_H, FRAME_W, WEBP_QUALITY, checkSources, sha256 } from './g-sprites';
import { MARGIN } from './lib/align';
import type { Image } from './lib/image';
import { newImage, pixelAt, readPng, setPixel } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { decodeWebp, encodeWebp } from './lib/webp';
import { celHash } from './validate';

export interface ClipPins {
  /** SHA-256 of each source cel, relative to the source set (`<proc|toned>/<take>/NN.png`). */
  readonly cels: Readonly<Record<string, string>>;
  /** SHA-256 of each take's timing file, relative to the source set. */
  readonly timing: Readonly<Record<string, string>>;
  /** SHA-256 of each decoded atlas cel's RGBA, written by this script. */
  readonly frames: Readonly<Record<string, string>>;
}

/**
 * One packed clip, a `ClipDef` as the sheet's `clipData` carries it: played
 * once, timed cel by cel, trimmed to its own cel. `fps` is unused once
 * `frameMs` is set; it states the clip's mean rate.
 */
export interface PackedClip {
  readonly frames: readonly string[];
  readonly fps: number;
  readonly loop: false;
  readonly frameMs: readonly number[];
  readonly frameSize: { readonly w: number; readonly h: number };
  readonly anchor: { readonly x: number; readonly y: number };
}

/** One approved take: a diagonal's knockout. */
export interface ClipTake {
  readonly clip: ClipName;
  readonly heading: BendHeading;
  /** The take's folder name in the hand-off, e.g. `sura-ko-se`. */
  readonly take: string;
}

export interface ClipCharacter {
  readonly name: 'kaya' | 'sura' | 'bo';
  /** The unit asset key the atlas frames are named under. */
  readonly key: string;
  /** The pin file, relative to the repo root. */
  readonly pins: string;
  /** True for Sura and Bo, whose cels are the toned set. */
  readonly toned: boolean;
  /** The bend character whose headings and shipped stance registration reads. */
  readonly bend: BendCharacter;
  /** Frames that repeat an earlier cel on purpose, per take: frame -> the cel it holds. */
  readonly holds: Readonly<Record<string, Readonly<Record<number, number>>>>;
  /** A take replaced by an approved retake: the default folder name -> the retake's. */
  readonly retakes: Readonly<Record<string, string>>;
}

/** The hand-off's heading abbreviations. */
const ABBREVIATION: Readonly<Record<string, string>> = {
  east: 'e',
  'north-east': 'ne',
  north: 'n',
  'north-west': 'nw',
  west: 'w',
  'south-west': 'sw',
  south: 's',
  'south-east': 'se',
};

export const CLIP_CHARACTERS: Readonly<Record<'kaya' | 'sura' | 'bo', ClipCharacter>> = {
  kaya: {
    name: 'kaya',
    key: 'unit.fire.kaya',
    pins: 'art/source/kaya-clips/pins.json',
    toned: false,
    bend: BEND_CHARACTERS.kaya,
    holds: {},
    retakes: {},
  },
  sura: {
    name: 'sura',
    key: 'unit.water.sura',
    pins: 'art/source/sura-clips/pins.json',
    toned: true,
    bend: BEND_CHARACTERS.sura,
    // The f5 in-between was unusable, so K3 holds through its slot (REPORT §5).
    holds: { 'sura-ko-sw': { 5: 4 } },
    retakes: {},
  },
  bo: {
    name: 'bo',
    key: 'unit.earth.bo',
    pins: 'art/source/bo-clips/pins.json',
    toned: true,
    bend: BEND_CHARACTERS.bo,
    holds: {},
    // He ends flat on his front, legs trailing (REPORT-2 §3).
    retakes: { 'bo-ko-nw': 'bo-ko-nw-r2' },
  },
};

/** Every take a character's build packs: a knockout on each diagonal. */
export function clipTakes(character: ClipCharacter): ClipTake[] {
  return KO_HEADINGS.map((heading) => {
    const h = character.bend.headings.find((candidate) => candidate.heading === heading);
    if (!h) throw new Error(`${character.name} has no ${heading} heading.`);
    const plain = `${character.name}-ko-${ABBREVIATION[h.direction] ?? h.direction}`;
    return { clip: koClip(heading), heading: h, take: character.retakes[plain] ?? plain };
  });
}

/* ------------------------------------------------------------------ */
/* The P0 timing file                                                   */
/* ------------------------------------------------------------------ */

export interface ClipTiming {
  readonly take: string;
  readonly kind: 'ko';
  readonly n_frames: number;
  readonly ms_per_frame: readonly number[];
  readonly hitstop: { readonly frame: number; readonly ms: number };
  readonly last_frame_holds: boolean;
  readonly cel: { readonly size: readonly [number, number] };
}

export const timingFile = (take: string): string => `proc/${take}/timing.json`;
export const celFile = (character: ClipCharacter, take: string, index: number): string =>
  `${character.toned ? 'toned' : 'proc'}/${take}/${String(index).padStart(2, '0')}.png`;

export function parseTiming(text: string, label: string): ClipTiming {
  const raw = JSON.parse(text) as Partial<ClipTiming>;
  const n = raw.n_frames;
  if (
    raw.kind !== 'ko' ||
    raw.last_frame_holds !== true ||
    typeof n !== 'number' ||
    !Array.isArray(raw.ms_per_frame) ||
    raw.ms_per_frame.length !== n ||
    !raw.ms_per_frame.every((ms) => Number.isFinite(ms) && ms > 0) ||
    typeof raw.hitstop?.frame !== 'number' ||
    typeof raw.hitstop.ms !== 'number' ||
    raw.hitstop.frame < 0 ||
    raw.hitstop.frame >= n ||
    raw.cel?.size?.[0] !== SOURCE_SIZE ||
    raw.cel.size[1] !== SOURCE_SIZE
  )
    throw new Error(`${label} is not a P0 knockout timing file with ${String(n)} frames.`);
  return raw as ClipTiming;
}

/** Each frame's hold in ms: the timing's, with the hit-stop added to its contact frame. */
export function frameHolds(timing: ClipTiming): number[] {
  return timing.ms_per_frame.map(
    (ms, frame) => ms + (frame === timing.hitstop.frame ? timing.hitstop.ms : 0),
  );
}

/* ------------------------------------------------------------------ */
/* One take                                                             */
/* ------------------------------------------------------------------ */

/** The name a take's cel packs under: `<key>/<clip>/<source frame>`. */
export const clipFrameName = (key: string, clip: ClipName, index: number): string =>
  `${key}/${clip}/${index}`;

const rgbaKey = (image: Image): string => sha256(image.data);

/** Everything a source cel can reach, in G-cel pixels. */
function reach(reg: { ox: number; oy: number; dy: number }): Box {
  const a = sourceToG({ x: 0, y: 0 }, reg);
  const b = sourceToG({ x: SOURCE_SIZE, y: SOURCE_SIZE }, reg);
  const x = Math.floor(a.x) - 1;
  const y = Math.floor(a.y) - 1;
  return { x, y, w: Math.ceil(b.x) + 1 - x, h: Math.ceil(b.y) + 1 - y };
}

const round = (value: number, places: number): number => {
  const k = 10 ** places;
  return Math.round(value * k) / k;
};

/** The foot point on a 128x192 G cel: the manifest's anchor. */
function footOf(key: string): { x: number; y: number } {
  const sheet = ASSETS[key];
  if (sheet?.kind !== 'sheet') throw new Error(`${key} is not a sheet.`);
  return { x: sheet.anchor.x * FRAME_W, y: sheet.anchor.y * FRAME_H };
}

/** A clip's rectangle in G-cel pixels, recovered from its data. */
export function clipBox(clip: PackedClip, foot: { x: number; y: number }): Box {
  return {
    x: Math.round(foot.x - clip.anchor.x * clip.frameSize.w),
    y: Math.round(foot.y - clip.anchor.y * clip.frameSize.h),
    w: clip.frameSize.w,
    h: clip.frameSize.h,
  };
}

export interface PackedTake {
  readonly clip: PackedClip;
  readonly box: Box;
  /** The distinct packed cels, by frame name, in play order. */
  readonly cels: ReadonlyMap<string, Image>;
}

export function packTake(
  character: ClipCharacter,
  take: ClipTake,
  timing: ClipTiming,
  sources: readonly Image[],
  stance: Image,
): PackedTake {
  const label = `${character.name} ${take.take}`;
  const [first] = sources;
  if (!first || sources.length !== timing.n_frames)
    throw new Error(`${label}: ${sources.length} cels for ${timing.n_frames} timed frames.`);
  for (const [index, cel] of sources.entries()) {
    if (cel.width !== SOURCE_SIZE || cel.height !== SOURCE_SIZE)
      throw new Error(`${label} cel ${index} is ${cel.width}x${cel.height}, not ${SOURCE_SIZE}.`);
  }
  const reg = register(first, stance, take.heading.dy, label);

  // Every repeat is declared, and every declaration is a repeat.
  const holds = character.holds[take.take] ?? {};
  const cel = new Map<number, number>();
  const firstSeen = new Map<string, number>();
  sources.forEach((image, index) => {
    const key = rgbaKey(image);
    const earlier = firstSeen.get(key);
    const declared = holds[index];
    if (earlier === undefined) {
      if (declared !== undefined)
        throw new Error(`${label}: frame ${index} should repeat cel ${declared} and does not.`);
      firstSeen.set(key, index);
      cel.set(index, index);
    } else {
      if (declared !== earlier)
        throw new Error(
          `${label}: frame ${index} duplicates cel ${earlier}; declare a hold or retake it.`,
        );
      cel.set(index, earlier);
    }
  });
  for (const frame of Object.keys(holds).map(Number)) {
    if (frame >= sources.length)
      throw new Error(`${label}: hold on frame ${frame} is past the end.`);
  }

  // The take's rectangle: its ink over every cel, plus the margin.
  const whole = reach(reg);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const unique = [...new Set(cel.values())];
  for (const index of unique) {
    const image = sources[index];
    if (!image) continue;
    const ink = alphaBounds(packCel(image, reg, whole), 1);
    if (!ink) throw new Error(`${label}: cel ${index} is empty.`);
    x0 = Math.min(x0, whole.x + ink.x);
    y0 = Math.min(y0, whole.y + ink.y);
    x1 = Math.max(x1, whole.x + ink.x + ink.width);
    y1 = Math.max(y1, whole.y + ink.y + ink.height);
  }
  const box: Box = {
    x: x0 - MARGIN,
    y: y0 - MARGIN,
    w: x1 - x0 + 2 * MARGIN,
    h: y1 - y0 + 2 * MARGIN,
  };

  const cels = new Map<string, Image>();
  const packedSeen = new Map<string, number>();
  for (const index of unique) {
    const image = sources[index];
    if (!image) continue;
    const packed = packCel(image, reg, box);
    const other = packedSeen.get(rgbaKey(packed));
    if (other !== undefined)
      throw new Error(`${label}: cels ${other} and ${index} pack to the same pixels.`);
    packedSeen.set(rgbaKey(packed), index);
    cels.set(clipFrameName(character.key, take.clip, index), packed);
  }
  const stanceCel = cels.get(clipFrameName(character.key, take.clip, 0));
  if (!stanceCel) throw new Error(`${label}: no frame 0.`);
  assertStance(stanceCel, box, stance, `${label} frame 0`);

  const foot = footOf(character.key);
  const frameMs = frameHolds(timing);
  const total = frameMs.reduce((sum, ms) => sum + ms, 0);
  const clip: PackedClip = {
    frames: sources.map((_, index) =>
      clipFrameName(character.key, take.clip, cel.get(index) ?? index),
    ),
    fps: round((sources.length * 1000) / total, 6),
    loop: false,
    frameMs,
    frameSize: { w: box.w, h: box.h },
    anchor: { x: round((foot.x - box.x) / box.w, 6), y: round((foot.y - box.y) / box.h, 6) },
  };
  if (clipBox(clip, foot).x !== box.x || clipBox(clip, foot).y !== box.y)
    throw new Error(`${label}: the anchor does not recover the clip's rectangle.`);
  return { clip, box, cels };
}

/* ------------------------------------------------------------------ */
/* The build                                                            */
/* ------------------------------------------------------------------ */

/** Every source file a character's build reads, relative to its set. */
export function clipSourceFiles(
  character: ClipCharacter,
  timings: ReadonlyMap<string, ClipTiming>,
): { timing: string[]; cels: string[] } {
  const takes = clipTakes(character);
  const timing = takes.map((t) => timingFile(t.take));
  const cels: string[] = [];
  for (const t of takes) {
    const n = timings.get(t.take)?.n_frames ?? 0;
    for (let i = 0; i < n; i++) cels.push(celFile(character, t.take, i));
  }
  return { timing, cels };
}

/** Any PNG in a take's cel folder the build does not read: a stray cel. */
function strayCels(source: string, character: ClipCharacter, files: readonly string[]): string[] {
  const problems: string[] = [];
  for (const t of clipTakes(character)) {
    const folder = celFile(character, t.take, 0).replace(/\/00\.png$/, '');
    const dir = join(source, folder);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir).sort()) {
      const file = `${folder}/${entry}`;
      if (entry.toLowerCase().endsWith('.png') && !files.includes(file))
        problems.push(`clip cel ${file} is in ${source} but not in the timing`);
    }
  }
  return problems;
}

function readTimings(source: string, character: ClipCharacter): Map<string, ClipTiming> {
  const timings = new Map<string, ClipTiming>();
  for (const t of clipTakes(character)) {
    const path = join(source, timingFile(t.take));
    if (existsSync(path)) timings.set(t.take, parseTiming(readFileSync(path, 'utf8'), path));
  }
  return timings;
}

/** Problems with a source set against the character's pins; empty is clean. */
export function checkClipSources(
  source: string,
  character: ClipCharacter,
  pins: ClipPins,
): string[] {
  const timingFiles = clipTakes(character).map((t) => timingFile(t.take));
  const timingProblems = checkSources(source, timingFiles, pins.timing, 'clip timing');
  // A timing that does not match its pin says nothing about how many cels to expect.
  if (timingProblems.length > 0) return timingProblems;
  const files = clipSourceFiles(character, readTimings(source, character));
  return [
    ...checkSources(source, files.cels, pins.cels, 'clip cel'),
    ...strayCels(source, character, files.cels),
  ];
}

/** Writes a fresh pin file for a source set. Refuses to overwrite one. */
export function pinClipSources(source: string, character: ClipCharacter, pinsPath: string): void {
  if (existsSync(pinsPath))
    throw new Error(`${pinsPath} exists; a pin file is never rewritten by --pin.`);
  const files = clipSourceFiles(character, readTimings(source, character));
  const missing = [...files.timing, ...files.cels].filter(
    (file) => !existsSync(join(source, file)),
  );
  const problems = [
    ...missing.map((file) => `${file} is missing`),
    ...strayCels(source, character, files.cels),
  ];
  if (problems.length > 0)
    throw new Error(`${source} is not a complete clip set:\n${problems.join('\n')}`);
  const hash = (file: string) => sha256(readFileSync(join(source, file)));
  const pins: ClipPins = {
    cels: Object.fromEntries(files.cels.map((file) => [file, hash(file)])),
    timing: Object.fromEntries(files.timing.map((file) => [file, hash(file)])),
    frames: {},
  };
  mkdirSync(resolve(pinsPath, '..'), { recursive: true });
  writeFileSync(pinsPath, `${JSON.stringify(pins, null, 2)}\n`);
}

export interface ClipBuildOptions {
  /** Where the pages go: `public/art/units`. */
  readonly outDir: string;
  /** Where the clip data goes: `public/art/units/<name>-g-clips.json`. */
  readonly dataPath: string;
  /** The pin file; defaults to the character's. */
  readonly pinsPath?: string;
  /** The packed stance cel frame 0 must reproduce, per heading. */
  readonly stance: (h: BendHeading) => Image;
  readonly log?: (line: string) => void;
}

/** The page files a build writes, relative to `outDir`: `<name>-g-3` and on. */
export const clipPageStem = (name: string, page: number): string => `${name}-g-${page + 3}`;

export async function buildClips(
  character: ClipCharacter,
  source: string,
  options: ClipBuildOptions,
): Promise<{
  clips: Record<string, PackedClip>;
  pages: string[];
  bytes: Record<string, number>;
}> {
  const { name, key } = character;
  const pinsPath = options.pinsPath ?? character.pins;
  const log = options.log ?? console.log;
  if (!existsSync(pinsPath)) throw new Error(`${pinsPath} is missing; pin the sources with --pin.`);
  const pins = JSON.parse(readFileSync(pinsPath, 'utf8')) as ClipPins;
  const problems = checkClipSources(source, character, pins);
  if (problems.length > 0)
    throw new Error(`${name} clip sources do not match ${pinsPath}:\n${problems.join('\n')}`);

  const timings = readTimings(source, character);
  const clips: Record<string, PackedClip> = {};
  const boxes = new Map<string, { box: Box; heading: BendHeading }>();
  const cels = new Map<string, Image>();
  for (const take of clipTakes(character)) {
    const timing = timings.get(take.take);
    if (!timing) throw new Error(`${name} ${take.take} has no timing.`);
    const sources = Array.from({ length: timing.n_frames }, (_, i) =>
      readPng(join(source, celFile(character, take.take, i))),
    );
    const packed = packTake(character, take, timing, sources, options.stance(take.heading));
    clips[take.clip] = packed.clip;
    boxes.set(clipFrameName(key, take.clip, 0), { box: packed.box, heading: take.heading });
    for (const [frame, image] of packed.cels) cels.set(frame, image);
  }

  // Every page is encoded and checked as it decodes before anything is
  // written, so a failed check leaves the shipped files as they were.
  const layouts = layoutBendPages(cels);
  const frameHashes: Record<string, string> = {};
  const bytes: Record<string, number> = {};
  const pages: string[] = [];
  const writes: { file: string; content: Uint8Array | string; line: string }[] = [];
  let worstMean = 0;
  let worstBias = 0;
  for (const [index, layout] of layouts.entries()) {
    const stem = clipPageStem(name, index);
    const atlas = newImage(layout.width, layout.height);
    for (const [frame, rect] of layout.frames) {
      const pixels = cels.get(frame);
      if (!pixels) throw new Error(`No pixels prepared for ${frame}.`);
      for (let y = 0; y < rect.h; y++)
        for (let x = 0; x < rect.w; x++)
          setPixel(atlas, rect.x + x, rect.y + y, pixelAt(pixels, x, y));
    }
    const webp = await encodeWebp(atlas, WEBP_QUALITY, true);
    const json = `${JSON.stringify(JSON.parse(atlasJsonText(layout.frames, `${stem}.webp`, layout.width, layout.height)))}\n`;
    bytes[`${stem}.webp`] = webp.length;
    bytes[`${stem}.json`] = Buffer.byteLength(json);
    pages.push(`art/units/${stem}.json`);
    const decoded = await decodeWebp(webp);
    for (const [frame, rect] of layout.frames) {
      frameHashes[frame] = celHash(decoded, rect);
      // Each clip's frame 0 is checked again as it decodes.
      const placed = boxes.get(frame);
      if (!placed) continue;
      const cel = crop(decoded, { x: rect.x, y: rect.y, width: rect.w, height: rect.h });
      const d = assertStance(
        cel,
        placed.box,
        options.stance(placed.heading),
        `${name} decoded ${frame}`,
      );
      worstMean = Math.max(worstMean, d.meanRgb);
      worstBias = Math.max(worstBias, d.bias);
    }
    writes.push(
      {
        file: join(options.outDir, `${stem}.webp`),
        content: webp,
        line: `wrote ${stem}.webp (${layout.width}x${layout.height}, ${layout.frames.size} cels, ${webp.length} B)`,
      },
      { file: join(options.outDir, `${stem}.json`), content: json, line: `wrote ${stem}.json` },
    );
  }
  log(
    `${name} decoded frame 0 of every clip: alpha exact, worst mean ${worstMean.toFixed(2)} of ` +
      `${STANCE_TOLERANCE.meanRgb}, worst bias ${worstBias.toFixed(2)} of ${STANCE_TOLERANCE.bias}`,
  );
  writes.push(
    {
      file: options.dataPath,
      // Compact, as the atlas pages are: the sheet fetches it with them.
      content: `${JSON.stringify(clips)}\n`,
      line: `wrote ${options.dataPath}`,
    },
    {
      file: pinsPath,
      content: `${JSON.stringify({ ...pins, frames: frameHashes }, null, 2)}\n`,
      line: `wrote ${pinsPath} cel pins`,
    },
  );

  mkdirSync(options.outDir, { recursive: true });
  mkdirSync(resolve(options.dataPath, '..'), { recursive: true });
  for (const { file, content, line } of writes) {
    writeFileSync(file, content);
    log(line);
  }
  return { clips, pages, bytes };
}

function argValue(argv: readonly string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at < 0 ? undefined : argv[at + 1];
}

/** Where a character's clip data ships, relative to the site root: the sheet's `clipData`. */
export const clipDataFile = (name: string): string => `art/units/${name}-g-clips.json`;

/** Where a character's clip data lives, relative to the repo root. */
export const clipDataPath = (name: string): string => `public/${clipDataFile(name)}`;

if (process.argv[1]?.endsWith('g-clips.ts')) {
  const argv = process.argv.slice(2);
  const name = argValue(argv, '--character');
  const character =
    name && Object.hasOwn(CLIP_CHARACTERS, name)
      ? CLIP_CHARACTERS[name as keyof typeof CLIP_CHARACTERS]
      : null;
  if (!character)
    throw new Error(`Pass --character <${Object.keys(CLIP_CHARACTERS).join('|')}>; got ${name}.`);
  const sourceArg = argValue(argv, '--source');
  if (!sourceArg) throw new Error('Pass --source <models-p0p1/work>.');
  const source = resolve(sourceArg);
  if (argv.includes('--pin')) {
    pinClipSources(source, character, character.pins);
    console.log(`wrote ${character.pins} source pins`);
  } else {
    await buildClips(character, source, {
      outDir: resolve('public/art/units'),
      dataPath: resolve(clipDataPath(character.name)),
      stance: await shippedStance(character.bend),
    });
  }
}
