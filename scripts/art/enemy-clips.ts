/**
 * Reproducibly packs an enemy G unit's hit reactions (all eight headings) and
 * knockouts (the four screen diagonals) onto pages of its G sheet, and writes
 * the clips that draw them beside it (ADR 0059, ADR 0063). The enemy twin of
 * `g-clips.ts`, which does the same for the party from the bend's 320 px
 * canvas; an enemy's takes are 192 px PixelLab cels, so they go through the G
 * build's own 75% nearest-neighbour map (`normalise` in `g-sprites.ts`) with
 * the placement of the unit's idle, and the unit stands on the same feet at
 * the same size as its idle and walk.
 *
 * The source is `art/source/thug-actions-g/cels` (see `assemble.py`): each
 * take as `<clip>/NN.png` with its `timing.json`. Frame 0 of every take is the
 * unit's own idle cel 0 for the heading (the build checks its hash against the
 * idle pin), a hit ends on it again, and the rest are toned PixelLab cels
 * drawn from the stance's own skeleton moved by CMU capture. A hit timing file
 * that does not credit mocap.cs.cmu.edu stops the build, as the party's does.
 *
 * Each take's cels share one trimmed rectangle (the take's ink plus the art
 * bible's margin) with the foot anchor recorded as a fraction of it. A cel
 * whose pixels repeat an earlier cel's is packed once and named twice, and an
 * undeclared repeat stops the build. The take's hit-stop is added to its
 * contact frame's time. Each set (knockouts, then hits) has its own page, so
 * adding a set never re-encodes another's.
 *
 * Every cel and timing file must match its SHA-256 in the checked-in pin file
 * and a missing, stray or changed one stops the build before anything is
 * written. `--pin` writes the pin file when there is none and never rewrites
 * one; the build records the SHA-256 of every decoded atlas cel in it, which
 * `art:validate` holds the shipped WebP to.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ClipName, Heading } from '../../src/content/assets/clips';
import {
  HEADINGS,
  KO_HEADINGS,
  headingClip,
  hitClip,
  koClip,
} from '../../src/content/assets/clips';
import { atlasJsonText } from '../../src/render/sheets/atlasJson';
import { layoutBendPages } from './bend-sprites';
import type { Box } from './bend-sprites';
import type { EnemyGHeading } from './enemy-g';
import {
  FRAME_H,
  FRAME_W,
  OFFSET_X,
  OFFSET_Y,
  SCALE,
  WEBP_QUALITY,
  checkSources,
  sha256,
} from './g-sprites';
import { MARGIN } from './lib/align';
import type { Image } from './lib/image';
import { newImage, pixelAt, readPng, setPixel } from './lib/image';
import { alphaBounds } from './lib/trim';
import { decodeWebp, encodeWebp } from './lib/webp';
import { celHash } from './validate';

export interface EnemyClipPins {
  /** SHA-256 of each source cel, relative to the source (`<clip>/NN.png`). */
  readonly cels: Readonly<Record<string, string>>;
  /** SHA-256 of each take's timing file, relative to the source. */
  readonly timing: Readonly<Record<string, string>>;
  /** The frozen tone the generated cels were toned with. */
  readonly tone: { readonly tool: string; readonly params: string };
  /** SHA-256 of each decoded atlas cel's RGBA, written by the build, per set. */
  readonly frames: Readonly<Record<string, string>>;
}

/** One packed clip, a `ClipDef` as the sheet's `clipData` carries it. */
export interface PackedClip {
  readonly frames: readonly string[];
  readonly fps: number;
  readonly loop: false;
  readonly frameMs: readonly number[];
  readonly frameSize: { readonly w: number; readonly h: number };
  readonly anchor: { readonly x: number; readonly y: number };
}

export const ENEMY_CLIP_SETS = ['ko', 'hit'] as const;
export type EnemyClipSet = (typeof ENEMY_CLIP_SETS)[number];

export interface EnemyClipUnit {
  /** The unit asset key the atlas frames are named under. */
  readonly key: string;
  /** Output stem: `<name>-g-2` is the knockouts, `<name>-g-3` the hits, `<name>-g-clips.json` the data. */
  readonly name: string;
  /** The pin file, relative to the repo root. */
  readonly pins: string;
  /** The cel folder, relative to the repo root. */
  readonly source: string;
  /** The frozen tone the generated cels were toned with. */
  readonly tone: { readonly tool: string; readonly params: string };
  readonly headings: readonly EnemyGHeading[];
  /** The idle cel 0 pins of the unit's own sheet, to hold frame 0 to: `idle/<direction>/0.png`. */
  readonly idlePins: string;
}

/** The G heading of each direction folder. */
const HEADING_OF: Readonly<Record<string, Heading>> = {
  east: 'east',
  'north-east': 'northEast',
  north: 'north',
  'north-west': 'northWest',
  west: 'west',
  'south-west': 'southWest',
  south: 'south',
  'south-east': 'southEast',
};

export interface EnemyTake {
  readonly set: EnemyClipSet;
  readonly clip: ClipName;
  readonly heading: EnemyGHeading;
}

/** Every take a set packs: a knockout on each diagonal, or a hit in each heading. */
export function enemyTakes(unit: EnemyClipUnit, set: EnemyClipSet): EnemyTake[] {
  const headings = set === 'ko' ? KO_HEADINGS : HEADINGS;
  return headings.map((heading) => {
    const h = unit.headings.find((candidate) => HEADING_OF[candidate.direction] === heading);
    if (!h) throw new Error(`${unit.name} has no ${heading} heading.`);
    return { set, clip: set === 'ko' ? koClip(heading) : hitClip(heading), heading: h };
  });
}

export const takeFolder = (take: EnemyTake): string => take.clip;
export const timingFile = (take: EnemyTake): string => `${take.clip}/timing.json`;
export const celFile = (take: EnemyTake, index: number): string =>
  `${take.clip}/${String(index).padStart(2, '0')}.png`;

export interface EnemyTiming {
  readonly take: string;
  readonly kind: EnemyClipSet;
  readonly n_frames: number;
  readonly ms_per_frame: readonly number[];
  readonly hitstop: { readonly frame: number; readonly ms: number };
  readonly last_frame_holds: boolean;
  readonly cel: { readonly size: readonly [number, number] };
  readonly attribution?: string;
}

const CMU = /mocap\.cs\.cmu\.edu/;

export function parseTiming(text: string, label: string, set: EnemyClipSet): EnemyTiming {
  const raw = JSON.parse(text) as Partial<EnemyTiming>;
  const n = raw.n_frames;
  if (!CMU.test(raw.attribution ?? '') || /mocapdata/i.test(text))
    throw new Error(`${label} does not credit CMU capture; a clip ships no other motion.`);
  if (
    raw.kind !== set ||
    raw.last_frame_holds !== (set === 'ko') ||
    typeof n !== 'number' ||
    !Array.isArray(raw.ms_per_frame) ||
    raw.ms_per_frame.length !== n ||
    !raw.ms_per_frame.every((ms) => Number.isFinite(ms) && ms > 0) ||
    typeof raw.hitstop?.frame !== 'number' ||
    typeof raw.hitstop.ms !== 'number' ||
    raw.hitstop.frame < 0 ||
    raw.hitstop.frame >= n ||
    raw.cel?.size?.[0] !== 192 ||
    raw.cel.size[1] !== 192
  )
    throw new Error(`${label} is not a ${set} timing file with ${String(n)} frames.`);
  return raw as EnemyTiming;
}

/** Each frame's hold in ms: the timing's, with the hit-stop added to its contact frame. */
export function frameHolds(timing: EnemyTiming): number[] {
  return timing.ms_per_frame.map(
    (ms, frame) => ms + (frame === timing.hitstop.frame ? timing.hitstop.ms : 0),
  );
}

/** A hit ends on its first cel, the stance it returns to. */
const HIT_HOLDS: Readonly<Record<number, number>> = { 4: 0 };

/** A 192 px cel through the G map (75% nearest-neighbour), unplaced: 144 px, origin at the placement. */
function scaleCel(source: Image): Image {
  if (source.width !== 192 || source.height !== 192)
    throw new Error(`Expected a 192x192 PixelLab cel; got ${source.width}x${source.height}.`);
  const side = Math.round(192 * SCALE);
  const out = newImage(side, side);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const rgba = pixelAt(source, Math.floor(x / SCALE), Math.floor(y / SCALE));
      setPixel(out, x, y, rgba[3] === 0 ? [0, 0, 0, 0] : rgba);
    }
  return out;
}

const round = (value: number, places: number): number => {
  const k = 10 ** places;
  return Math.round(value * k) / k;
};

/** The foot point on a 128x192 G cel: the sheet's anchor (0.5, 0.85). */
const FOOT = { x: 0.5 * FRAME_W, y: 0.85 * FRAME_H };

export interface PackedTake {
  readonly clip: PackedClip;
  readonly box: Box;
  /** The distinct packed cels, by frame name, in play order. */
  readonly cels: ReadonlyMap<string, Image>;
}

export const frameName = (key: string, clip: ClipName, index: number): string =>
  `${key}/${clip}/${index}`;

const rgbaKey = (image: Image): string => sha256(image.data);

export function packTake(
  unit: EnemyClipUnit,
  take: EnemyTake,
  timing: EnemyTiming,
  sources: readonly Image[],
): PackedTake {
  const label = `${unit.name} ${take.clip}`;
  if (sources.length !== timing.n_frames)
    throw new Error(`${label}: ${sources.length} cels for ${timing.n_frames} timed frames.`);
  // The idle's own placement, so frame 0 stands exactly where the idle cel stands.
  const ox = OFFSET_X + take.heading.headingDx;
  const oy = OFFSET_Y + take.heading.idleDy;
  const scaled = sources.map(scaleCel);

  const holds = take.set === 'hit' ? HIT_HOLDS : {};
  const cel = new Map<number, number>();
  const firstSeen = new Map<string, number>();
  sources.forEach((image, index) => {
    const key = rgbaKey(image);
    const earlier = firstSeen.get(key);
    const declared = (holds as Record<number, number>)[index];
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

  // The take's rectangle in G-cel pixels: its ink over every cel, plus the margin.
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const unique = [...new Set(cel.values())];
  for (const index of unique) {
    const image = scaled[index];
    const ink = image && alphaBounds(image, 1);
    if (!ink) throw new Error(`${label}: cel ${index} is empty.`);
    x0 = Math.min(x0, ox + ink.x);
    y0 = Math.min(y0, oy + ink.y);
    x1 = Math.max(x1, ox + ink.x + ink.width);
    y1 = Math.max(y1, oy + ink.y + ink.height);
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
    const image = scaled[index];
    if (!image) continue;
    const packed = newImage(box.w, box.h);
    for (let y = 0; y < box.h; y++)
      for (let x = 0; x < box.w; x++) {
        const sx = box.x + x - ox;
        const sy = box.y + y - oy;
        if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue;
        setPixel(packed, x, y, pixelAt(image, sx, sy));
      }
    const other = packedSeen.get(rgbaKey(packed));
    if (other !== undefined)
      throw new Error(`${label}: cels ${other} and ${index} pack to the same pixels.`);
    packedSeen.set(rgbaKey(packed), index);
    cels.set(frameName(unit.key, take.clip, index), packed);
  }

  const frameMs = frameHolds(timing);
  const total = frameMs.reduce((sum, ms) => sum + ms, 0);
  const clip: PackedClip = {
    frames: sources.map((_, index) => frameName(unit.key, take.clip, cel.get(index) ?? index)),
    fps: round((sources.length * 1000) / total, 6),
    loop: false,
    frameMs,
    frameSize: { w: box.w, h: box.h },
    anchor: { x: round((FOOT.x - box.x) / box.w, 6), y: round((FOOT.y - box.y) / box.h, 6) },
  };
  return { clip, box, cels };
}

/* ------------------------------------------------------------------ */
/* The build                                                            */
/* ------------------------------------------------------------------ */

function readTimings(
  source: string,
  unit: EnemyClipUnit,
  set: EnemyClipSet,
): Map<string, EnemyTiming> {
  const timings = new Map<string, EnemyTiming>();
  for (const take of enemyTakes(unit, set)) {
    const path = join(source, timingFile(take));
    if (existsSync(path))
      timings.set(take.clip, parseTiming(readFileSync(path, 'utf8'), path, set));
  }
  return timings;
}

/** Every source file a set's build reads, relative to the source. */
export function enemyClipFiles(
  unit: EnemyClipUnit,
  set: EnemyClipSet,
  timings: ReadonlyMap<string, EnemyTiming>,
): { timing: string[]; cels: string[] } {
  const takes = enemyTakes(unit, set);
  const cels: string[] = [];
  for (const t of takes) {
    const n = timings.get(t.clip)?.n_frames ?? 0;
    for (let i = 0; i < n; i++) cels.push(celFile(t, i));
  }
  return { timing: takes.map(timingFile), cels };
}

/** Any PNG in a take's cel folder the build does not read: a stray cel. */
function strayCels(source: string, unit: EnemyClipUnit, files: readonly string[]): string[] {
  const problems: string[] = [];
  for (const set of ENEMY_CLIP_SETS)
    for (const t of enemyTakes(unit, set)) {
      const dir = join(source, takeFolder(t));
      if (!existsSync(dir)) continue;
      for (const entry of readdirSync(dir).sort()) {
        const file = `${takeFolder(t)}/${entry}`;
        if (entry.toLowerCase().endsWith('.png') && !files.includes(file))
          problems.push(`clip cel ${file} is in ${source} but not in the timing`);
      }
    }
  return problems;
}

function allFiles(source: string, unit: EnemyClipUnit): { timing: string[]; cels: string[] } {
  const timing: string[] = [];
  const cels: string[] = [];
  for (const set of ENEMY_CLIP_SETS) {
    const files = enemyClipFiles(unit, set, readTimings(source, unit, set));
    timing.push(...files.timing);
    cels.push(...files.cels);
  }
  return { timing, cels };
}

/** Problems with a source set against the pins; empty is clean. */
export function checkEnemyClipSources(
  source: string,
  unit: EnemyClipUnit,
  pins: EnemyClipPins,
): string[] {
  const timingFiles = ENEMY_CLIP_SETS.flatMap((set) => enemyTakes(unit, set).map(timingFile));
  const timingProblems = checkSources(source, timingFiles, pins.timing, 'clip timing');
  if (timingProblems.length > 0) return timingProblems;
  const files = allFiles(source, unit);
  const problems = [
    ...checkSources(source, files.cels, pins.cels, 'clip cel'),
    ...strayCels(source, unit, files.cels),
  ];
  // Frame 0 of every take is the unit's own idle cel 0, held to the idle's pin.
  const idle = JSON.parse(readFileSync(unit.idlePins, 'utf8')) as {
    pixellab: Readonly<Record<string, string>>;
  };
  for (const set of ENEMY_CLIP_SETS)
    for (const t of enemyTakes(unit, set)) {
      const want = idle.pixellab[`idle/${t.heading.direction}/0.png`];
      const got = pins.cels[celFile(t, 0)];
      if (!want || want !== got)
        problems.push(`${t.clip} frame 0 is not ${t.heading.direction}'s idle cel 0`);
    }
  if (pins.tone?.params !== unit.tone.params)
    problems.push('the pin file does not record the frozen tone parameters');
  return problems;
}

/** Writes a fresh pin file. Refuses to overwrite one. */
export function pinEnemyClipSources(source: string, unit: EnemyClipUnit, pinsPath: string): void {
  if (existsSync(pinsPath))
    throw new Error(`${pinsPath} exists; a pin file is never rewritten by --pin.`);
  const files = allFiles(source, unit);
  const missing = [...files.timing, ...files.cels].filter(
    (file) => !existsSync(join(source, file)),
  );
  const problems = [
    ...missing.map((file) => `${file} is missing`),
    ...strayCels(source, unit, files.cels),
  ];
  if (problems.length > 0)
    throw new Error(`${source} is not a complete clip set:\n${problems.join('\n')}`);
  const hash = (file: string) => sha256(readFileSync(join(source, file)));
  const pins: EnemyClipPins = {
    cels: Object.fromEntries(files.cels.map((file) => [file, hash(file)])),
    timing: Object.fromEntries(files.timing.map((file) => [file, hash(file)])),
    tone: unit.tone,
    frames: {},
  };
  mkdirSync(resolve(pinsPath, '..'), { recursive: true });
  writeFileSync(pinsPath, `${JSON.stringify(pins, null, 2)}\n`);
}

export const enemyClipPageStem = (name: string, set: EnemyClipSet): string =>
  `${name}-g-${ENEMY_CLIP_SETS.indexOf(set) + 2}`;
export const enemyClipDataFile = (name: string): string => `art/units/${name}-g-clips.json`;

export interface EnemyClipBuildOptions {
  readonly outDir: string;
  readonly dataPath: string;
  readonly pinsPath?: string;
  readonly log?: (line: string) => void;
}

export async function buildEnemyClips(
  unit: EnemyClipUnit,
  source: string,
  options: EnemyClipBuildOptions,
): Promise<{ clips: Record<string, PackedClip>; bytes: Record<string, number>; pages: string[] }> {
  const pinsPath = options.pinsPath ?? unit.pins;
  const log = options.log ?? console.log;
  if (!existsSync(pinsPath)) throw new Error(`${pinsPath} is missing; pin the sources with --pin.`);
  const pins = JSON.parse(readFileSync(pinsPath, 'utf8')) as EnemyClipPins;
  const problems = checkEnemyClipSources(source, unit, pins);
  if (problems.length > 0)
    throw new Error(`${unit.name} clip sources do not match ${pinsPath}:\n${problems.join('\n')}`);

  const clips: Record<string, PackedClip> = {};
  const setCels = new Map<EnemyClipSet, Map<string, Image>>();
  for (const set of ENEMY_CLIP_SETS) {
    const timings = readTimings(source, unit, set);
    const cels = new Map<string, Image>();
    for (const take of enemyTakes(unit, set)) {
      const timing = timings.get(take.clip);
      if (!timing) throw new Error(`${unit.name} ${take.clip} has no timing.`);
      const sources = Array.from({ length: timing.n_frames }, (_, i) =>
        readPng(join(source, celFile(take, i))),
      );
      const packed = packTake(unit, take, timing, sources);
      clips[take.clip] = packed.clip;
      for (const [frame, image] of packed.cels) cels.set(frame, image);
    }
    setCels.set(set, cels);
  }

  // Each set's cels are encoded and checked as they decode before anything is written.
  const frameHashes: Record<string, string> = {};
  const bytes: Record<string, number> = {};
  const pages: string[] = [];
  const writes: { file: string; content: Uint8Array | string; line: string }[] = [];
  for (const set of ENEMY_CLIP_SETS) {
    const layouts = layoutBendPages(setCels.get(set) ?? new Map());
    if (layouts.length !== 1)
      throw new Error(`${unit.name} ${set} needs ${layouts.length} pages; the sheet lists one.`);
    const layout = layouts[0];
    if (!layout) continue;
    const stem = enemyClipPageStem(unit.name, set);
    const atlas = newImage(layout.width, layout.height);
    for (const [frame, rect] of layout.frames) {
      const pixels = setCels.get(set)?.get(frame);
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
    for (const [frame, rect] of layout.frames) frameHashes[frame] = celHash(decoded, rect);
    writes.push(
      {
        file: join(options.outDir, `${stem}.webp`),
        content: webp,
        line: `wrote ${stem}.webp (${layout.width}x${layout.height}, ${layout.frames.size} cels, ${webp.length} B)`,
      },
      { file: join(options.outDir, `${stem}.json`), content: json, line: `wrote ${stem}.json` },
    );
  }
  writes.push(
    {
      file: options.dataPath,
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
  return { clips, bytes, pages };
}

export { headingClip, FRAME_W, FRAME_H };
