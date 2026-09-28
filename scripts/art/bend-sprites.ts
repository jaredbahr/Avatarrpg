/**
 * Reproducibly packs a G party member's approved eight-heading bend (ADR 0055)
 * into extra atlas pages beside the locomotion and stance pages, and writes
 * the bend set the pages draw as JSON that validates against
 * `src/content/bends.ts`.
 *
 * Usage:
 *   node --import tsx scripts/art/bend-sprites.ts --character <kaya|sura|bo> \
 *     --source <bend-r10-8dir/<name>> [--pin]
 *
 * The source is the r10 hand-off: `final/<heading>/NN.png`, 320 px cels, and
 * `timing-<heading>.json` beside them. Sura's and Bo's cels arrive toned and
 * are never re-toned; Kaya's are never toned. The cels are read-only.
 *
 * Registration is measured, not assumed. Each heading's frame 0 is the
 * approved stance cel drawn somewhere on the 320 px canvas; the packer finds
 * where by matching frame 0's alpha, pixel for pixel, against the packed
 * stance cel the G build shipped (itself held to its decoded-cel pin), and
 * then samples every cel through the same 75% nearest-neighbour map the G
 * build uses for the stance (`g-sprites.ts`). So the bend starts and ends on
 * the stance's feet at the stance's size. Frame 0 and the last frame must
 * match the packed stance within `STANCE_TOLERANCE`, or the build stops.
 *
 * Each heading's cels share one trimmed rectangle (the heading's ink plus the
 * art bible's margin), with the foot anchor recorded as a fraction of it.
 * Sockets are moved into that rectangle's pixels. A cel whose pixels repeat an
 * earlier cel's is packed once and named twice in `frames`: a hold is timing,
 * never a second cel. A repeat that is not declared in `holds` stops the
 * build, and so does a declared hold that is not a repeat.
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
import type { ClipName, Heading } from '../../src/content/assets/clips';
import { HEADINGS, headingClip } from '../../src/content/assets/clips';
import { ASSETS } from '../../src/content/assets/manifest';
import type {
  BendAttackCue,
  BendElement,
  BendFrameSockets,
  BendKeyRole,
  BendSetDef,
  BendSocket,
  HeadingBendDef,
} from '../../src/content/bends';
import {
  BEND_SOCKETS,
  EFFECTS_NOT_YET_AUTHORED,
  bendSetDefSchema,
  validateBendSets,
} from '../../src/content/bends';
import { atlasJsonText, parseAtlasJson } from '../../src/render/sheets/atlasJson';
import type { AtlasFrame } from '../../src/render/sheets/atlasJson';
import {
  CHARACTERS,
  FRAME_H,
  FRAME_W,
  OFFSET_X,
  OFFSET_Y,
  SCALE,
  WEBP_QUALITY,
  checkSources,
  sha256,
} from './g-sprites';
import type { GPins } from './g-sprites';
import { MARGIN } from './lib/align';
import type { Image } from './lib/image';
import { newImage, pixelAt, readPng, setPixel } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { decodeWebp, encodeWebp } from './lib/webp';
import { celHash } from './validate';

/** The largest texture every device in the matrix takes. */
const MAX_PAGE = 2048;
/** The source cel the r10 hand-off draws on. */
export const SOURCE_SIZE = 320;
/** How far registration searches around the ink-corner guess, in source px. */
const SEARCH = 8;

/**
 * How closely frame 0 and the last frame must reproduce the shipped stance
 * cel. Alpha is exact (the WebP pages keep alpha lossless), so the feet, the
 * outline and the size are pixel-identical. Colour may differ only by the
 * lossy encoding of the stance page: a mean channel difference of at most
 * `meanRgb`, no channel shifted on average by more than `bias` (codec noise
 * averages out; a re-tone does not), and at most `outlierShare` of the
 * opaque pixels off by more than `outlierRgb`. Measured on the r10 sets:
 * mean 2.9-5.4, bias 0.13-0.84, outliers 0-0.55%; the shipped bend page's
 * decoded frame 0 against the stance page, both lossy, is held to the same.
 */
export interface StanceTolerance {
  readonly meanRgb: number;
  readonly bias: number;
  readonly outlierRgb: number;
  readonly outlierShare: number;
}
export const STANCE_TOLERANCE: StanceTolerance = {
  meanRgb: 6,
  bias: 1.5,
  outlierRgb: 48,
  outlierShare: 0.01,
};

export interface BendPins {
  /** SHA-256 of each source cel, relative to the source set (`final/<dir>/NN.png`). */
  readonly cels: Readonly<Record<string, string>>;
  /** SHA-256 of each timing file, relative to the source set. */
  readonly timing: Readonly<Record<string, string>>;
  /** SHA-256 of each decoded atlas cel's RGBA, written by this script. */
  readonly frames: Readonly<Record<string, string>>;
}

/** One heading as the G build placed its stance, and its source folder name. */
export interface BendHeading {
  readonly heading: Heading;
  /** `south-east`: the source folder and timing suffix. */
  readonly direction: string;
  /** The stance clip whose cel 0 frame 0 must reproduce. */
  readonly stance: ClipName;
  /** The G build's vertical shift for this heading's stance: idle dy plus stance dy. */
  readonly dy: number;
}

export interface BendCharacter {
  readonly name: string;
  /** The unit asset key the atlas frames are named under. */
  readonly key: string;
  readonly element: BendElement;
  /** The pin file, relative to the repo root. */
  readonly pins: string;
  /** The G pin file whose decoded stance cels registration reads. */
  readonly gPins: string;
  /** The G stance page, relative to `public/`. */
  readonly stancePage: string;
  readonly attackId: string;
  readonly effectId: string;
  /** The shared role of each key frame the timing names (ADR 0055). */
  readonly roles: Readonly<Record<string, BendKeyRole>>;
  /**
   * Frames that repeat an earlier cel on purpose, per source folder: frame ->
   * the cel it holds. The last frame's return to frame 0 is expected everywhere.
   */
  readonly holds: Readonly<Record<string, Readonly<Record<number, number>>>>;
  readonly headings: readonly BendHeading[];
}

const DIRECTION_HEADING: Readonly<Record<string, Heading>> = {
  east: 'east',
  'north-east': 'northEast',
  north: 'north',
  'north-west': 'northWest',
  west: 'west',
  'south-west': 'southWest',
  south: 'south',
  'south-east': 'southEast',
};

function gHeadings(name: keyof typeof CHARACTERS): BendHeading[] {
  return CHARACTERS[name].headings.map((h) => {
    const heading = DIRECTION_HEADING[h.direction];
    if (!heading) throw new Error(`No heading for ${h.direction}.`);
    return { heading, direction: h.direction, stance: h.stance, dy: h.idleDy + h.stanceDy };
  });
}

const EVERY_DIRECTION = Object.keys(DIRECTION_HEADING);
/** Kaya's cross holds its contact drawing a second cel (r9 f7, kept in every r10 facing). */
const CROSS_HOLD = Object.fromEntries(EVERY_DIRECTION.map((d) => [d, { 7: 6 }]));

export const BEND_CHARACTERS: Readonly<Record<'kaya' | 'sura' | 'bo', BendCharacter>> = {
  kaya: {
    name: 'kaya',
    key: 'unit.fire.kaya',
    element: 'fire',
    pins: 'art/source/kaya-bend/pins.json',
    gPins: CHARACTERS.kaya.pins,
    stancePage: 'art/units/kaya-g-2.json',
    attackId: 'fire-strike',
    effectId: 'fx.fire.jet',
    // F1 is the jab and F3 the cross: both strike peaks, so both contacts.
    roles: { F1: 'contact', F2: 'anticipation', F3: 'contact', F4: 'recovery' },
    holds: CROSS_HOLD,
    headings: gHeadings('kaya'),
  },
  sura: {
    name: 'sura',
    key: 'unit.water.sura',
    element: 'water',
    pins: 'art/source/sura-bend/pins.json',
    gPins: CHARACTERS.sura.pins,
    stancePage: 'art/units/sura-g-2.json',
    attackId: 'water-strike',
    effectId: 'fx.water.whip',
    // W4 is the push's peak and its release on one frame: a contact.
    roles: { W2: 'anticipation', W3: 'anticipation', W4: 'contact', W5: 'recovery' },
    // South and north-west hold the W4 drawing through f6 (r10 cleanup swaps).
    holds: { south: { 6: 5 }, 'north-west': { 6: 5 } },
    headings: gHeadings('sura'),
  },
  bo: {
    name: 'bo',
    key: 'unit.earth.bo',
    element: 'earth',
    pins: 'art/source/bo-bend/pins.json',
    gPins: CHARACTERS.bo.pins,
    stancePage: 'art/units/bo-g-2.json',
    attackId: 'earth-strike',
    effectId: 'fx.earth.slab',
    roles: { E2: 'anticipation', E3: 'contact', E4: 'contact', E5: 'recovery' },
    holds: {},
    headings: gHeadings('bo'),
  },
};

/* ------------------------------------------------------------------ */
/* The r10 timing file                                                 */
/* ------------------------------------------------------------------ */

interface R10Attack {
  readonly name: string;
  readonly frame: number;
  readonly socket: string;
  readonly hitstop_ms: number;
  readonly launch_frame: number;
}

export interface R10Timing {
  readonly n_frames: number;
  readonly ms_per_frame: readonly number[];
  readonly key_frames: Readonly<Record<string, number>>;
  readonly smear_frame?: number;
  readonly attacks: readonly R10Attack[];
  readonly sockets_per_frame: readonly Readonly<Record<string, unknown>>[];
}

export const timingFile = (direction: string): string => `timing-${direction}.json`;
export const celFile = (direction: string, index: number): string =>
  `final/${direction}/${String(index).padStart(2, '0')}.png`;

function parseTiming(text: string, label: string): R10Timing {
  const raw = JSON.parse(text) as Partial<R10Timing>;
  const n = raw.n_frames;
  if (
    typeof n !== 'number' ||
    !Array.isArray(raw.ms_per_frame) ||
    raw.ms_per_frame.length !== n ||
    !Array.isArray(raw.sockets_per_frame) ||
    raw.sockets_per_frame.length !== n ||
    !Array.isArray(raw.attacks) ||
    !raw.key_frames
  )
    throw new Error(`${label} is not an r10 timing file with ${String(n)} frames.`);
  return raw as R10Timing;
}

/* ------------------------------------------------------------------ */
/* The map from a source cel to the packed one                          */
/* ------------------------------------------------------------------ */

/**
 * Where a heading's stance sits in its source cels: the 192 px stance cel's
 * corner at (`ox`, `oy`), and the G build's vertical shift `dy`.
 */
export interface Registration {
  readonly ox: number;
  readonly oy: number;
  readonly dy: number;
}

/**
 * The source pixel a G-cel pixel samples: exactly `g-sprites.ts`'s
 * `normalise`, extended past the 192 px stance cel so a reaching fist is kept.
 */
export function sourcePixel(x: number, y: number, reg: Registration): [number, number] {
  return [
    Math.floor((x - OFFSET_X) / SCALE) + reg.ox,
    Math.floor((y - OFFSET_Y - reg.dy) / SCALE) + reg.oy,
  ];
}

/** A continuous source point in G-cel pixels (a 128x192 stance cel's frame). */
export function sourceToG(
  p: { x: number; y: number },
  reg: Registration,
): { x: number; y: number } {
  return {
    x: (p.x - reg.ox) * SCALE + OFFSET_X,
    y: (p.y - reg.oy) * SCALE + OFFSET_Y + reg.dy,
  };
}

/** A rectangle in G-cel pixels. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Samples `source` into `box` (G-cel pixels), nearest-neighbour, clear stays clear. */
export function packCel(source: Image, reg: Registration, box: Box): Image {
  const out = newImage(box.w, box.h);
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const [sx, sy] = sourcePixel(box.x + x, box.y + y, reg);
      const rgba = pixelAt(source, sx, sy);
      if (rgba[3] !== 0) setPixel(out, x, y, rgba);
    }
  }
  return out;
}

/** Everything a source cel can reach, in G-cel pixels. */
function reach(reg: Registration, width: number, height: number): Box {
  const a = sourceToG({ x: 0, y: 0 }, reg);
  const b = sourceToG({ x: width, y: height }, reg);
  const x = Math.floor(a.x) - 1;
  const y = Math.floor(a.y) - 1;
  return { x, y, w: Math.ceil(b.x) + 1 - x, h: Math.ceil(b.y) + 1 - y };
}

/**
 * Finds where frame 0 draws the stance: the one offset at which frame 0,
 * sampled into the G cel, has exactly the shipped stance cel's alpha. The
 * search is seeded at the offset that lines the two ink corners up.
 */
export function register(frame0: Image, stance: Image, dy: number, label: string): Registration {
  if (stance.width !== FRAME_W || stance.height !== FRAME_H)
    throw new Error(`${label}: the stance cel is ${stance.width}x${stance.height}.`);
  const stanceInk = alphaBounds(stance, 1);
  const frameInk = alphaBounds(frame0, 1);
  if (!stanceInk || !frameInk) throw new Error(`${label}: frame 0 or the stance cel is empty.`);
  const guess = {
    ox: frameInk.x - Math.floor((stanceInk.x - OFFSET_X) / SCALE),
    oy: frameInk.y - Math.floor((stanceInk.y - OFFSET_Y - dy) / SCALE),
  };
  const found: Registration[] = [];
  for (let oy = guess.oy - SEARCH; oy <= guess.oy + SEARCH; oy++) {
    for (let ox = guess.ox - SEARCH; ox <= guess.ox + SEARCH; ox++) {
      const reg = { ox, oy, dy };
      let same = true;
      for (let y = 0; y < FRAME_H && same; y++) {
        for (let x = 0; x < FRAME_W; x++) {
          const [sx, sy] = sourcePixel(x, y, reg);
          if (pixelAt(frame0, sx, sy)[3] !== pixelAt(stance, x, y)[3]) {
            same = false;
            break;
          }
        }
      }
      if (same) found.push(reg);
    }
  }
  const [reg] = found;
  if (found.length !== 1 || !reg)
    throw new Error(
      `${label}: frame 0 does not register on the packed stance cel ` +
        `(${found.length} offsets reproduce its alpha within ${SEARCH} px of the ink corner).`,
    );
  return reg;
}

/**
 * How far a packed cel, cut to the G cel, is from the shipped stance cel: the
 * alpha that differs, the mean colour difference, the share of big misses,
 * and any ink outside the G cel.
 */
export function stanceDifference(
  packed: Image,
  box: Box,
  stance: Image,
  tolerance: StanceTolerance = STANCE_TOLERANCE,
): { alpha: number; meanRgb: number; bias: number; outliers: number; outside: number } {
  let alpha = 0;
  let sum = 0;
  const signed = [0, 0, 0];
  let opaque = 0;
  let big = 0;
  let outside = 0;
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const gx = box.x + x;
      const gy = box.y + y;
      const a = pixelAt(packed, x, y);
      if (gx < 0 || gy < 0 || gx >= FRAME_W || gy >= FRAME_H) {
        if (a[3] !== 0) outside++;
        continue;
      }
      const b = pixelAt(stance, gx, gy);
      if (a[3] !== b[3]) alpha++;
      if (a[3] === 0 || b[3] === 0) continue;
      const diff = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
      sum += (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3;
      for (let c = 0; c < 3; c++) signed[c] = (signed[c] ?? 0) + (a[c] ?? 0) - (b[c] ?? 0);
      if (diff > tolerance.outlierRgb) big++;
      opaque++;
    }
  }
  // Every stance pixel the box does not cover must be clear.
  for (let y = 0; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      const inBox = x >= box.x && y >= box.y && x < box.x + box.w && y < box.y + box.h;
      if (!inBox && pixelAt(stance, x, y)[3] !== 0) alpha++;
    }
  }
  return {
    alpha,
    meanRgb: opaque === 0 ? 0 : sum / opaque,
    bias: opaque === 0 ? 0 : Math.max(...signed.map((total) => Math.abs(total) / opaque)),
    outliers: opaque === 0 ? 0 : big / opaque,
    outside,
  };
}

/** Throws unless `packed` reproduces the shipped stance cel within the tolerance. */
export function assertStance(
  packed: Image,
  box: Box,
  stance: Image,
  label: string,
  tolerance: StanceTolerance = STANCE_TOLERANCE,
): ReturnType<typeof stanceDifference> {
  const d = stanceDifference(packed, box, stance, tolerance);
  if (
    d.alpha !== 0 ||
    d.outside !== 0 ||
    d.meanRgb > tolerance.meanRgb ||
    d.bias > tolerance.bias ||
    d.outliers > tolerance.outlierShare
  ) {
    throw new Error(
      `${label} does not match the packed stance: ${d.alpha} alpha px differ, ` +
        `${d.outside} ink px lie outside the stance cel, mean colour difference ` +
        `${d.meanRgb.toFixed(2)} (at most ${tolerance.meanRgb}), channel bias ` +
        `${d.bias.toFixed(2)} (at most ${tolerance.bias}), ${(d.outliers * 100).toFixed(2)}% ` +
        `of pixels off by more than ${tolerance.outlierRgb} (at most ${tolerance.outlierShare * 100}%).`,
    );
  }
  return d;
}

const round = (value: number, places: number): number => {
  const k = 10 ** places;
  return Math.round(value * k) / k;
};

/** A source socket in packed-cel pixels: the G map, then the heading's box. */
export function packSocket(
  p: { x: number; y: number },
  reg: Registration,
  box: Box,
): { x: number; y: number } {
  const g = sourceToG(p, reg);
  return { x: round(g.x - box.x, 3), y: round(g.y - box.y, 3) };
}

/* ------------------------------------------------------------------ */
/* One heading                                                          */
/* ------------------------------------------------------------------ */

interface PackedHeading {
  readonly def: HeadingBendDef;
  /** The distinct packed cels, by frame name, in play order. */
  readonly cels: ReadonlyMap<string, Image>;
}

const rgbaKey = (image: Image): string => sha256(image.data);

/** The name a heading's cel packs under: `<key>/bend<Heading>/<source frame>`. */
export function bendFrameName(key: string, heading: Heading, index: number): string {
  return `${key}/bend${heading[0]?.toUpperCase() ?? ''}${heading.slice(1)}/${index}`;
}

/** Anchor fraction and root to six places, sockets to three: a stable, readable file. */
function packHeading(
  character: BendCharacter,
  h: BendHeading,
  timing: R10Timing,
  sources: readonly Image[],
  stance: Image,
): PackedHeading {
  const label = `${character.name} ${h.direction}`;
  const [first] = sources;
  const last = sources.length - 1;
  if (!first || sources.length !== timing.n_frames)
    throw new Error(`${label}: ${sources.length} cels for ${timing.n_frames} timed frames.`);
  for (const [index, cel] of sources.entries()) {
    if (cel.width !== SOURCE_SIZE || cel.height !== SOURCE_SIZE)
      throw new Error(`${label} cel ${index} is ${cel.width}x${cel.height}, not ${SOURCE_SIZE}.`);
  }
  const reg = register(first, stance, h.dy, label);

  // Every repeat is declared, and every declaration is a repeat.
  const holds = character.holds[h.direction] ?? {};
  const cel = new Map<number, number>();
  const firstSeen = new Map<string, number>();
  sources.forEach((image, index) => {
    const key = rgbaKey(image);
    const earlier = firstSeen.get(key);
    const declared = index === last ? 0 : holds[index];
    if (earlier === undefined) {
      if (index === last || declared !== undefined)
        throw new Error(
          `${label}: frame ${index} should repeat cel ${declared ?? 0} and does not.`,
        );
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

  // The heading's rectangle: its ink over every cel, plus the margin.
  const whole = reach(reg, SOURCE_SIZE, SOURCE_SIZE);
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
    cels.set(bendFrameName(character.key, h.heading, index), packed);
  }
  const stanceCel = cels.get(bendFrameName(character.key, h.heading, 0));
  if (!stanceCel) throw new Error(`${label}: no frame 0.`);
  assertStance(stanceCel, box, stance, `${label} frame 0 and frame ${last}`);

  // The foot anchor: the manifest's anchor on a 128x192 G cel.
  const sheet = ASSETS[character.key];
  if (sheet?.kind !== 'sheet') throw new Error(`${character.key} is not a sheet.`);
  const foot = { x: sheet.anchor.x * FRAME_W, y: sheet.anchor.y * FRAME_H };
  const root = {
    x: round((foot.x - OFFSET_X) / SCALE + reg.ox, 6),
    y: round((foot.y - OFFSET_Y - reg.dy) / SCALE + reg.oy, 6),
  };
  const anchor = { x: round((foot.x - box.x) / box.w, 6), y: round((foot.y - box.y) / box.h, 6) };

  const roles = character.roles;
  const names = Object.keys(timing.key_frames).sort();
  if (names.join() !== Object.keys(roles).sort().join())
    throw new Error(`${label}: key frames ${names.join()} are not ${Object.keys(roles).join()}.`);
  const keyFrames = Object.fromEntries(
    names.map((name) => [
      name,
      { frame: timing.key_frames[name] ?? -1, role: roles[name] ?? 'contact' },
    ]),
  );

  const socketsPerFrame = timing.sockets_per_frame.map((row, frame): BendFrameSockets => {
    if (row.frame !== frame || row.ms !== timing.ms_per_frame[frame])
      throw new Error(`${label}: socket row ${frame} disagrees with the timing.`);
    const sockets: Partial<Record<BendSocket, { x: number; y: number }>> = {};
    for (const socket of BEND_SOCKETS) {
      const value = row[socket];
      if (value === undefined) continue;
      if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite))
        throw new Error(`${label}: socket ${socket} on frame ${frame} is not a point.`);
      sockets[socket] = packSocket({ x: value[0] as number, y: value[1] as number }, reg, box);
    }
    return { frame, sockets };
  });

  const attack: BendAttackCue = {
    id: character.attackId,
    effectId: character.effectId,
    releases: timing.attacks.map((a) => {
      if (!(BEND_SOCKETS as readonly string[]).includes(a.socket))
        throw new Error(`${label}: attack ${a.name} leaves from unknown socket ${a.socket}.`);
      return {
        frame: a.frame,
        launchFrame: a.launch_frame,
        socket: a.socket as BendSocket,
        launchHoldMs: a.hitstop_ms,
        // r10 times one hold, at launch; the impact hold is the effects' to set.
        impactHoldMs: 0,
      };
    }),
    damageRelease: timing.attacks.length - 1,
  };

  const def: HeadingBendDef = {
    frames: sources.map((_, index) =>
      bendFrameName(character.key, h.heading, cel.get(index) ?? index),
    ),
    frameMs: [...timing.ms_per_frame],
    sourceSize: { width: SOURCE_SIZE, height: SOURCE_SIZE },
    root,
    scale: SCALE,
    frameSize: { width: box.w, height: box.h },
    anchor,
    keyFrames,
    ...(timing.smear_frame === undefined ? {} : { smearFrame: timing.smear_frame }),
    attacks: [attack],
    socketsPerFrame,
  };
  return { def, cels };
}

/* ------------------------------------------------------------------ */
/* Pages                                                                */
/* ------------------------------------------------------------------ */

/**
 * Shelf-packs the cels in order, left to right and top to bottom, opening a
 * page when one is full. No rotation, no reordering: the same cels always
 * land in the same places.
 */
export function layoutBendPages(
  cels: ReadonlyMap<string, Image>,
  maxSize = MAX_PAGE,
): { width: number; height: number; frames: Map<string, AtlasFrame> }[] {
  const pages: { width: number; height: number; frames: Map<string, AtlasFrame> }[] = [];
  let page = { width: 0, height: 0, frames: new Map<string, AtlasFrame>() };
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const [name, image] of cels) {
    const { width: w, height: h } = image;
    if (w > maxSize || h > maxSize) throw new Error(`${name} is ${w}x${h}; a page is ${maxSize}.`);
    if (x + w > maxSize) {
      x = 0;
      y += shelf;
      shelf = 0;
    }
    if (y + h > maxSize) {
      pages.push(page);
      page = { width: 0, height: 0, frames: new Map() };
      x = 0;
      y = 0;
      shelf = 0;
    }
    page.frames.set(name, { x, y, w, h });
    page.width = Math.max(page.width, x + w);
    page.height = Math.max(page.height, y + h);
    x += w;
    shelf = Math.max(shelf, h);
  }
  if (page.frames.size > 0) pages.push(page);
  return pages;
}

/* ------------------------------------------------------------------ */
/* The build                                                            */
/* ------------------------------------------------------------------ */

/** Every source file a character's build reads, relative to its set. */
export function bendSourceFiles(
  character: BendCharacter,
  timings: ReadonlyMap<string, R10Timing>,
): { timing: string[]; cels: string[] } {
  const timing = character.headings.map((h) => timingFile(h.direction));
  const cels: string[] = [];
  for (const h of character.headings) {
    const n = timings.get(h.direction)?.n_frames ?? 0;
    for (let i = 0; i < n; i++) cels.push(celFile(h.direction, i));
  }
  return { timing, cels };
}

/** Any PNG in a heading's folder the build does not read: a stray cel. */
function strayCels(source: string, character: BendCharacter, files: readonly string[]): string[] {
  const problems: string[] = [];
  for (const h of character.headings) {
    const dir = join(source, 'final', h.direction);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir).sort()) {
      const file = `final/${h.direction}/${entry}`;
      if (entry.toLowerCase().endsWith('.png') && !files.includes(file))
        problems.push(`bend cel ${file} is in ${source} but not in the timing`);
    }
  }
  return problems;
}

function readTimings(source: string, character: BendCharacter): Map<string, R10Timing> {
  const timings = new Map<string, R10Timing>();
  for (const h of character.headings) {
    const path = join(source, timingFile(h.direction));
    if (existsSync(path)) timings.set(h.direction, parseTiming(readFileSync(path, 'utf8'), path));
  }
  return timings;
}

/** Problems with a source set against the character's pins; empty is clean. */
export function checkBendSources(
  source: string,
  character: BendCharacter,
  pins: BendPins,
): string[] {
  const timingFiles = character.headings.map((h) => timingFile(h.direction));
  const timingProblems = checkSources(source, timingFiles, pins.timing, 'bend timing');
  // A timing that does not match its pin says nothing about how many cels to expect.
  if (timingProblems.length > 0) return timingProblems;
  const files = bendSourceFiles(character, readTimings(source, character));
  return [
    ...checkSources(source, files.cels, pins.cels, 'bend cel'),
    ...strayCels(source, character, files.cels),
  ];
}

/** Writes a fresh pin file for a source set. Refuses to overwrite one. */
export function pinBendSources(source: string, character: BendCharacter, pinsPath: string): void {
  if (existsSync(pinsPath))
    throw new Error(`${pinsPath} exists; a pin file is never rewritten by --pin.`);
  const files = bendSourceFiles(character, readTimings(source, character));
  const hash = (file: string) => sha256(readFileSync(join(source, file)));
  const pins: BendPins = {
    cels: Object.fromEntries(files.cels.map((file) => [file, hash(file)])),
    timing: Object.fromEntries(files.timing.map((file) => [file, hash(file)])),
    frames: {},
  };
  const problems = strayCels(source, character, files.cels);
  if (files.timing.some((file) => !existsSync(join(source, file))) || problems.length > 0)
    throw new Error(`${source} is not a complete bend set:\n${problems.join('\n')}`);
  mkdirSync(resolve(pinsPath, '..'), { recursive: true });
  writeFileSync(pinsPath, `${JSON.stringify(pins, null, 2)}\n`);
}

/** The shipped stance cel of each heading, held to its G pin. */
export async function shippedStance(
  character: BendCharacter,
  publicDir = 'public',
): Promise<(h: BendHeading) => Image> {
  const atlas = parseAtlasJson(readFileSync(join(publicDir, character.stancePage), 'utf8'));
  const imagePath = join(publicDir, character.stancePage, '..', atlas.image);
  const page = await decodeWebp(new Uint8Array(readFileSync(imagePath)));
  const gPins = (JSON.parse(readFileSync(character.gPins, 'utf8')) as GPins).frames;
  return (h) => {
    const name = `${character.key}/${h.stance}/0`;
    const rect = atlas.frames.get(name);
    if (!rect) throw new Error(`${name} is not on ${character.stancePage}.`);
    if (gPins[name] !== celHash(page, rect))
      throw new Error(`${name} on ${character.stancePage} does not match its G pin.`);
    return crop(page, { x: rect.x, y: rect.y, width: rect.w, height: rect.h });
  };
}

export interface BendBuildOptions {
  /** Where the pages and the bend JSON go: `public/art/units`. */
  readonly outDir: string;
  /** The pin file; defaults to the character's. */
  readonly pinsPath?: string;
  /** The packed stance cel frame 0 must reproduce, per heading. */
  readonly stance: (h: BendHeading) => Image;
  /** Unit asset keys the set is checked against; defaults to the manifest's. */
  readonly knownUnitAssets?: readonly string[];
  readonly log?: (line: string) => void;
}

/** The files a build writes, relative to `outDir`, in the order it writes them. */
export const bendOutputs = (name: string, pages: number): string[] => [
  ...Array.from({ length: pages }, (_, i) => {
    const stem = i === 0 ? `${name}-g-bend` : `${name}-g-bend-${i + 1}`;
    return [`${stem}.webp`, `${stem}.json`];
  }).flat(),
  `${name}-bend.json`,
];

export async function buildBend(
  character: BendCharacter,
  source: string,
  options: BendBuildOptions,
): Promise<{ set: BendSetDef; pages: string[]; bytes: Record<string, number> }> {
  const { name, key } = character;
  const pinsPath = options.pinsPath ?? character.pins;
  const log = options.log ?? console.log;
  if (!existsSync(pinsPath)) throw new Error(`${pinsPath} is missing; pin the sources with --pin.`);
  const pins = JSON.parse(readFileSync(pinsPath, 'utf8')) as BendPins;
  const problems = checkBendSources(source, character, pins);
  if (problems.length > 0)
    throw new Error(`${name} bend sources do not match ${pinsPath}:\n${problems.join('\n')}`);

  const timings = readTimings(source, character);
  const facings: Partial<Record<Heading, HeadingBendDef>> = {};
  const cels = new Map<string, Image>();
  // Pack in the contract's heading order, so pages read the same as the data.
  const ordered = HEADINGS.map((heading) => {
    const h = character.headings.find((candidate) => candidate.heading === heading);
    if (!h) throw new Error(`${name} has no ${heading} heading.`);
    return h;
  });
  for (const h of ordered) {
    const timing = timings.get(h.direction);
    if (!timing) throw new Error(`${name} ${h.direction} has no timing.`);
    const sources = Array.from({ length: timing.n_frames }, (_, i) =>
      readPng(join(source, celFile(h.direction, i))),
    );
    if (h.stance !== headingClip('stance', h.heading))
      throw new Error(`${name} ${h.direction} draws stance ${h.stance}.`);
    const packed = packHeading(character, h, timing, sources, options.stance(h));
    facings[h.heading] = packed.def;
    for (const [frame, image] of packed.cels) cels.set(frame, image);
  }

  const set: BendSetDef = {
    id: `${name}.bend`,
    unitAsset: key,
    element: character.element,
    facings: facings as Record<Heading, HeadingBendDef>,
  };
  const parsed = bendSetDefSchema.safeParse(set);
  if (!parsed.success)
    throw new Error(`${name} bend set fails its schema: ${parsed.error.message}`);
  const known = options.knownUnitAssets ?? Object.keys(ASSETS);
  const setProblems = validateBendSets([set], EFFECTS_NOT_YET_AUTHORED, known, [...cels.keys()]);
  if (setProblems.length > 0) throw new Error(`${name} bend set:\n${setProblems.join('\n')}`);

  // Every page is encoded and checked as it decodes before anything is
  // written, so a failed check leaves the shipped files as they were.
  const layouts = layoutBendPages(cels);
  const files = bendOutputs(name, layouts.length);
  const frameHashes: Record<string, string> = {};
  const bytes: Record<string, number> = {};
  const pageFiles: string[] = [];
  const writes: { file: string; content: Uint8Array | string; line: string }[] = [];
  let worstMean = 0;
  let worstBias = 0;
  for (const [index, layout] of layouts.entries()) {
    const imageFile = files[index * 2] ?? '';
    const jsonFile = files[index * 2 + 1] ?? '';
    const atlas = newImage(layout.width, layout.height);
    for (const [frame, rect] of layout.frames) {
      const pixels = cels.get(frame);
      if (!pixels) throw new Error(`No pixels prepared for ${frame}.`);
      for (let y = 0; y < rect.h; y++)
        for (let x = 0; x < rect.w; x++)
          setPixel(atlas, rect.x + x, rect.y + y, pixelAt(pixels, x, y));
    }
    const webp = await encodeWebp(atlas, WEBP_QUALITY, true);
    const json = `${JSON.stringify(JSON.parse(atlasJsonText(layout.frames, imageFile, layout.width, layout.height)))}\n`;
    bytes[imageFile] = webp.length;
    bytes[jsonFile] = Buffer.byteLength(json);
    pageFiles.push(jsonFile);
    const decoded = await decodeWebp(webp);
    for (const [frame, rect] of layout.frames) {
      frameHashes[frame] = celHash(decoded, rect);
      // The shipped stance frame is checked again as it decodes.
      if (frame.endsWith('/0')) {
        const heading = HEADINGS.find((candidate) => frame === bendFrameName(key, candidate, 0));
        const h = ordered.find((candidate) => candidate.heading === heading);
        const def = heading ? facings[heading] : undefined;
        if (h && def) {
          const box = boxOf(def, character);
          const cel = crop(decoded, { x: rect.x, y: rect.y, width: rect.w, height: rect.h });
          const d = assertStance(
            cel,
            box,
            options.stance(h),
            `${name} ${h.direction} decoded frame 0`,
          );
          worstMean = Math.max(worstMean, d.meanRgb);
          worstBias = Math.max(worstBias, d.bias);
          log(
            `  ${h.direction} decoded frame 0: alpha exact, mean ${d.meanRgb.toFixed(2)} ` +
              `(at most ${STANCE_TOLERANCE.meanRgb}), bias ${d.bias.toFixed(2)} ` +
              `(at most ${STANCE_TOLERANCE.bias}), outliers ${(d.outliers * 100).toFixed(2)}%`,
          );
        }
      }
    }
    writes.push(
      {
        file: join(options.outDir, imageFile),
        content: webp,
        line: `wrote ${imageFile} (${layout.width}x${layout.height}, ${layout.frames.size} cels, ${webp.length} B)`,
      },
      { file: join(options.outDir, jsonFile), content: json, line: `wrote ${jsonFile}` },
    );
  }
  log(
    `${name} decoded frame 0, worst heading: mean ${worstMean.toFixed(2)} of ` +
      `${STANCE_TOLERANCE.meanRgb}, bias ${worstBias.toFixed(2)} of ${STANCE_TOLERANCE.bias}`,
  );
  const dataFile = files[files.length - 1] ?? `${name}-bend.json`;
  const data = `${JSON.stringify(set)}\n`;
  bytes[dataFile] = Buffer.byteLength(data);
  writes.push(
    {
      file: join(options.outDir, dataFile),
      content: data,
      line: `wrote ${dataFile} (${bytes[dataFile]} B)`,
    },
    {
      file: pinsPath,
      content: `${JSON.stringify({ ...pins, frames: frameHashes }, null, 2)}\n`,
      line: `wrote ${pinsPath} cel pins`,
    },
  );

  mkdirSync(options.outDir, { recursive: true });
  for (const { file, content, line } of writes) {
    writeFileSync(file, content);
    log(line);
  }
  return { set, pages: pageFiles, bytes };
}

/**
 * A heading's rectangle in G-cel pixels, recovered from its data: the foot
 * anchor is the manifest's anchor on the G cel.
 */
export function boxOf(def: HeadingBendDef, character: BendCharacter): Box {
  const sheet = ASSETS[character.key];
  if (sheet?.kind !== 'sheet') throw new Error(`${character.key} is not a sheet.`);
  const foot = { x: sheet.anchor.x * FRAME_W, y: sheet.anchor.y * FRAME_H };
  return {
    x: Math.round(foot.x - def.anchor.x * def.frameSize.width),
    y: Math.round(foot.y - def.anchor.y * def.frameSize.height),
    w: def.frameSize.width,
    h: def.frameSize.height,
  };
}

function argValue(argv: readonly string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at < 0 ? undefined : argv[at + 1];
}

if (process.argv[1]?.endsWith('bend-sprites.ts')) {
  const argv = process.argv.slice(2);
  const name = argValue(argv, '--character');
  const character =
    name && Object.hasOwn(BEND_CHARACTERS, name)
      ? BEND_CHARACTERS[name as keyof typeof BEND_CHARACTERS]
      : null;
  if (!character)
    throw new Error(`Pass --character <${Object.keys(BEND_CHARACTERS).join('|')}>; got ${name}.`);
  const sourceArg = argValue(argv, '--source');
  if (!sourceArg) throw new Error('Pass --source <bend-r10-8dir/<name>>.');
  const source = resolve(sourceArg);
  if (argv.includes('--pin')) {
    pinBendSources(source, character, character.pins);
    console.log(`wrote ${character.pins} source pins`);
  } else {
    await buildBend(character, source, {
      outDir: resolve('public/art/units'),
      stance: await shippedStance(character),
    });
  }
}
