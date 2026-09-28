/**
 * Reproducibly packs the approved painted bend effects (ADR 0055, step 4)
 * into one effect atlas page, and writes the `BendEffectDef`s that draw it as
 * JSON that validates against `src/content/bends.ts`.
 *
 * Usage:
 *   node --import tsx scripts/art/bend-effects.ts --source <vfx-proto> [--pin]
 *
 * The source is the approved VFX prototype Jared signed off (v8.1, "WAYYY
 * BETTER"): the painted layer sprites under `assets/` and the renderer that
 * composited them, `scripts/render_v7.py`. The packer redraws nothing. Every
 * cel below is one `stamp` or `anchored` call of that renderer, or two of them
 * drawn on one centre, taken from the frames the approved GIFs show, at the
 * scale and opacity the renderer used, and moved to the game's scale: the
 * prototype draws a 320 px character cel at 1.35x and the game at 0.75x, so an
 * effect packs at 0.75 / 1.35 of its prototype size and keeps its size against
 * the character exactly. What depends on the board (rotation toward the
 * target, the path, the stretch of a water segment between two hand
 * positions) stays out of the pixels: each cel records its pivot and how the
 * runtime turns or stretches it, in the atlas JSON beside its rectangle.
 * Particles, ground shadows and the flash's brightening were code in the
 * prototype and stay code (steps 5 and 6).
 *
 * The timing is the prototype's too: each layer's `frameMs` are the bend cels
 * the prototype drew it on, read from the pinned r9 timing, which every
 * shipped heading must still carry, except the earth tumble's travel loop,
 * which is hard-coded at 100 ms a cel. Speeds and heights are the prototype's
 * 3-tile south-east throw in tiles (one tile is one board step, 96 x 48 px),
 * and every effect lands 120 prototype px above the target's feet, where the
 * renderer's `destination` put it.
 *
 * Any directory is not accepted: every numbered PNG in the source folders the
 * build reads, the three timing files and the renderer must match their
 * SHA-256 in the checked-in pin file, and a missing, stray or changed file
 * stops the build before anything is written. `--pin` writes the pin file
 * once and refuses when one exists. The build then records the SHA-256 of
 * every decoded atlas cel in the same file, which `art:validate` holds the
 * shipped WebP to. Every check runs before the first file is written, and two
 * builds write byte-identical files.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { HEADINGS } from '../../src/content/assets/clips';
import { ASSETS } from '../../src/content/assets/manifest';
import type {
  BendEffectDef,
  BendEffectLayer,
  BendSetDef,
  HeadingBendDef,
} from '../../src/content/bends';
import {
  bendEffectDefSchema,
  effectCelName,
  validateBendSets,
  validateEffectCels,
} from '../../src/content/bends';
import { BEND_FX } from '../../src/content/fxCels';
import type { BendFxCelMeta } from '../../src/render/fx/bendFx';
import { atlasJsonText } from '../../src/render/sheets/atlasJson';
import { BEND_CHARACTERS, layoutBendPages } from './bend-sprites';
import { SCALE, WEBP_QUALITY, checkSources, sha256 } from './g-sprites';
import { MARGIN } from './lib/align';
import type { Image } from './lib/image';
import { newImage, pixelAt, readPng, setPixel } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { decodeWebp, encodeWebp } from './lib/webp';
import { borderTouched, celHash } from './validate';

/** The prototype drew the 320 px character cels, and its effects, at 1.35x. */
export const PROTO_SCALE = 1.35;
/** Game pixels per prototype pixel: the G cels' 0.75 against the prototype's 1.35. */
export const GAME_SCALE = SCALE / PROTO_SCALE;
/** One board step of the prototype, in its pixels: `STEP = (96, 48)`. */
export const PROTO_TILE = Math.hypot(96, 48);

export interface EffectPins {
  /** SHA-256 of each source file, relative to the prototype. */
  readonly sources: Readonly<Record<string, string>>;
  /** SHA-256 of each decoded atlas cel's RGBA, written by this script. */
  readonly frames: Readonly<Record<string, string>>;
}

export const EFFECT_PINS = 'art/source/bend-effects/pins.json';

/** The folders whose numbered PNGs make the approved source set. */
export const SOURCE_FOLDERS = [
  'assets/kaya-old-vfx-reference',
  'assets/v6-art/earth-crack',
  'assets/v6-art/earth-emerge',
  'assets/v6-art/earth-tumble',
  'assets/v6-art/earth-shatter',
  'assets/v6-art/water-whip',
  'assets/v6-art/water-coil',
  'assets/v6-art/water-bolt',
  'assets/v6-art/water-splash',
] as const;

type Element = 'fire' | 'earth' | 'water';
const ELEMENTS: readonly Element[] = ['fire', 'earth', 'water'];

/** The approved renderer and the r9 timing it played every element at. */
export const TIMING_FILES: Readonly<Record<Element, string>> = {
  fire: 'assets/final-fire-cels/timing-r9.json',
  earth: 'assets/final-earth-cels/timing-r9.json',
  water: 'assets/final-water-cels/timing-r9.json',
};
export const RENDERER = 'scripts/render_v7.py';

/* ------------------------------------------------------------------ */
/* Resampling, as the prototype's Pillow calls did it                   */
/* ------------------------------------------------------------------ */

/** Python's `round`: halves go to the even neighbour, as Pillow's sizes did. */
export function pyRound(value: number): number {
  const floor = Math.floor(value);
  const rest = value - floor;
  if (rest > 0.5) return floor + 1;
  if (rest < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/**
 * Resizes with an area (box) filter on premultiplied alpha, so a painted edge
 * keeps its colour instead of darkening into the transparent pixels around
 * it. Only sums, products and quotients: every platform computes the same
 * bytes, which the decoded-cel pins depend on.
 */
export function resize(source: Image, width: number, height: number): Image {
  if (width < 1 || height < 1) throw new Error(`Cannot resize to ${width}x${height}.`);
  const weights = (from: number, to: number): { first: number; w: number[] }[] => {
    const step = from / to;
    return Array.from({ length: to }, (_, index) => {
      const start = index * step;
      const end = start + step;
      const first = Math.floor(start);
      const w: number[] = [];
      for (let s = first; s < end && s < from; s++) {
        w.push((Math.min(end, s + 1) - Math.max(start, s)) / step);
      }
      return { first, w };
    });
  };
  const columns = weights(source.width, width);
  const rows = weights(source.height, height);
  // Horizontal pass into premultiplied floats: alpha, then colour times alpha.
  const mid = new Float64Array(width * source.height * 4);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < width; x++) {
      const { first, w } = columns[x] ?? { first: 0, w: [] };
      let a = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      w.forEach((weight, k) => {
        const i = (y * source.width + first + k) * 4;
        const alpha = (source.data[i + 3] ?? 0) * weight;
        a += alpha;
        r += (source.data[i] ?? 0) * alpha;
        g += (source.data[i + 1] ?? 0) * alpha;
        b += (source.data[i + 2] ?? 0) * alpha;
      });
      const o = (y * width + x) * 4;
      mid[o] = r;
      mid[o + 1] = g;
      mid[o + 2] = b;
      mid[o + 3] = a;
    }
  }
  const out = newImage(width, height);
  for (let y = 0; y < height; y++) {
    const { first, w } = rows[y] ?? { first: 0, w: [] };
    for (let x = 0; x < width; x++) {
      let a = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      w.forEach((weight, k) => {
        const i = ((first + k) * width + x) * 4;
        r += (mid[i] ?? 0) * weight;
        g += (mid[i + 1] ?? 0) * weight;
        b += (mid[i + 2] ?? 0) * weight;
        a += (mid[i + 3] ?? 0) * weight;
      });
      const alpha = Math.min(255, Math.round(a));
      if (alpha === 0) continue;
      const channel = (sum: number) => Math.min(255, Math.max(0, Math.round(sum / a)));
      setPixel(out, x, y, [channel(r), channel(g), channel(b), alpha]);
    }
  }
  return out;
}

/** The prototype's `with_alpha`: alpha times `opacity`, floored, as `value * opacity // 255`. */
export function withOpacity(image: Image, opacity: number): Image {
  if (opacity >= 255) return image;
  const out = newImage(image.width, image.height);
  out.data.set(image.data);
  for (let i = 3; i < out.data.length; i += 4) {
    out.data[i] = Math.floor(((out.data[i] ?? 0) * opacity) / 255);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The cels, one prototype draw each                                    */
/* ------------------------------------------------------------------ */

/**
 * One draw of the approved renderer. `scale` and `offset` are in the
 * prototype's terms (its `scale` argument, its pixels); the packer moves them
 * to the game's.
 */
export interface Draw {
  /** The source PNG, relative to the prototype. */
  readonly file: string;
  /**
   * How the renderer cut the sprite: `ref` is `crop_ref` (the ink plus 3 px),
   * `ink` the bare ink (`getbbox`), `whole` the cel as painted.
   */
  readonly cut: 'ref' | 'ink' | 'whole';
  readonly scale: number;
  readonly opacity: number;
  /**
   * The sprite point placed on the cel's pivot: its centre (`stamp`), or the
   * painted anchor in source pixels (`anchored`).
   */
  readonly anchor: 'centre' | { readonly x: number; readonly y: number };
  /** Where this draw sits from the pivot, in prototype pixels. */
  readonly offset?: { readonly x: number; readonly y: number };
  /**
   * A water segment's thickness in prototype pixels: the ink is fitted to it
   * across and keeps its aspect along, and the runtime stretches it along.
   */
  readonly thickness?: number;
}

export interface CelRecipe {
  readonly draws: readonly Draw[];
  /** How the runtime turns or stretches the cel; the pivot is measured. */
  readonly meta?: Omit<BendFxCelMeta, 'pivot'>;
}

export interface SequenceRecipe {
  readonly name: string;
  readonly cels: readonly CelRecipe[];
}

const REF = 'assets/kaya-old-vfx-reference';
const V6 = 'assets/v6-art';
const ref = (frame: number): string => `${REF}/${String(frame).padStart(2, '0')}.png`;
const v6 = (piece: string, frame: number): string =>
  `${V6}/${piece}/${String(frame).padStart(2, '0')}.png`;

/** `stamp(image, FIRE[frame], centre, scale, angle, opacity)` */
const fire = (frame: number, scale: number, opacity = 255, offset?: Draw['offset']): Draw => ({
  file: ref(frame),
  cut: 'ref',
  scale,
  opacity,
  anchor: 'centre',
  ...(offset ? { offset } : {}),
});

/** `anchored(image, PAINTED[piece][frame], anchor, at, SCALE, opacity=...)` */
const painted = (
  piece: string,
  frame: number,
  anchor: { x: number; y: number },
  opacity = 255,
): Draw => ({ file: v6(piece, frame), cut: 'whole', scale: PROTO_SCALE, opacity, anchor });

/** `painted_water_segment(image, PAINTED['water-whip'][frame], start, end, thickness, opacity)` */
const segment = (frame: number, thickness: number, opacity: number): CelRecipe => ({
  draws: [
    {
      file: v6('water-whip', frame),
      cut: 'ink',
      scale: 1,
      opacity,
      anchor: 'centre',
      thickness,
    },
  ],
  // The ink runs tail to tip along +x; the renderer fit it between two points
  // at 1.12 times their distance, centred on their midpoint. The packer turns
  // that into the stretch of the whole cel, margin and all.
  meta: { facing: 0, segment: SEGMENT_OVERSHOOT },
});

/** `painted_water_segment` laid the ink over 1.12 times the distance it spans. */
export const SEGMENT_OVERSHOOT = 1.12;

/** The fire refs were painted pointing 32 degrees clockwise of +x. */
const FIRE_FACING = 32;
/** The earth and water anchors the v6 art's `meta.json` names. */
const CRACK = { x: 64, y: 32 };
const EMERGE_BASE = { x: 50, y: 86 };
const ROCK = { x: 48, y: 48 };
const SHATTER = { x: 64, y: 64 };
const SPLASH = { x: 63, y: 63 };
const BOLT_HEAD = { x: 124, y: 32 };

/** The fire burst at `age` 0-2 after contact: `fire_fx`'s two impact stamps on one centre. */
const burst = (age: number): CelRecipe => ({
  draws: [
    fire(9, 1.45 + age * 0.3, 255 - age * 72),
    fire(age === 0 ? 11 : 10, 1.2 + age * 0.22, 220 - age * 60, { x: 8, y: 8 }),
  ],
});

export const EFFECT_IDS: Readonly<Record<Element, string>> = {
  fire: 'fx.fire.fireball',
  earth: 'fx.earth.rock',
  water: 'fx.water.bolt',
};

const seq = (element: Element, name: string): string => `${EFFECT_IDS[element]}/${name}`;

/** Every packed sequence, in atlas order. */
export const SEQUENCES: readonly SequenceRecipe[] = [
  // Fire: `fire_fx`. The jab launches FIRE[2] and flies FIRE[8]; the cross
  // launches and flies FIRE[5]; both burst the same way.
  {
    name: seq('fire', 'jab-launch'),
    cels: [{ draws: [fire(2, 1.35)], meta: { facing: FIRE_FACING } }],
  },
  {
    name: seq('fire', 'jab-ball'),
    cels: [{ draws: [fire(8, 1.18)], meta: { facing: FIRE_FACING } }],
  },
  {
    name: seq('fire', 'cross-launch'),
    cels: [{ draws: [fire(5, 1.35)], meta: { facing: FIRE_FACING } }],
  },
  {
    name: seq('fire', 'cross-ball'),
    cels: [{ draws: [fire(5, 1.18)], meta: { facing: FIRE_FACING } }],
  },
  { name: seq('fire', 'burst'), cels: [burst(0), burst(1), burst(2)] },
  // Earth: `earth_fx`. The stomp opens the crack (crack 5, then 8 held and
  // faded); the rock rises in it (emerge 5), hangs at the drive hand (emerge
  // 6), tumbles and shatters (2, 4, 6). The approved GIF shows tumble cels 9
  // and 0 (`(frame * 3) % 12` on bend cels 7 and 8); 3 and 6, on the same
  // stride, close them into a loop for longer flights. Packing those two is a
  // supervisor-accepted exception to "only the approved frames" (ADR 0055).
  {
    name: seq('earth', 'crack'),
    cels: [
      { draws: [painted('earth-crack', 5, CRACK)] },
      { draws: [painted('earth-crack', 8, CRACK)] },
      { draws: [painted('earth-crack', 8, CRACK, 220)] },
      { draws: [painted('earth-crack', 8, CRACK, 155)] },
      { draws: [painted('earth-crack', 8, CRACK, 90)] },
    ],
  },
  { name: seq('earth', 'emerge'), cels: [{ draws: [painted('earth-emerge', 5, EMERGE_BASE)] }] },
  { name: seq('earth', 'hang'), cels: [{ draws: [painted('earth-emerge', 6, ROCK)] }] },
  {
    name: seq('earth', 'tumble'),
    cels: [9, 0, 3, 6].map((frame) => ({ draws: [painted('earth-tumble', frame, ROCK)] })),
  },
  {
    name: seq('earth', 'shatter'),
    cels: [0, 1, 2].map((age) => ({
      draws: [painted('earth-shatter', Math.min(2 + age * 2, 6), SHATTER, 255 - age * 30)],
    })),
  },
  // Water: `water_fx`. The gather trails the palm as painted whip segments
  // (the newest, and on later cels the one before it) and curls at the hand;
  // the lash leaves the palm; the bolt flies; the splash lands and settles.
  {
    name: seq('water', 'gather-lead'),
    cels: [segment(3, 16, 182), segment(1, 18, 199), segment(3, 20, 216)],
  },
  { name: seq('water', 'gather-trail'), cels: [segment(0, 18, 182), segment(2, 20, 199)] },
  {
    name: seq('water', 'coil'),
    cels: [
      {
        draws: [
          { file: v6('water-coil', 3), cut: 'whole', scale: 0.42, opacity: 215, anchor: 'centre' },
        ],
        meta: { angle: -8 },
      },
    ],
  },
  { name: seq('water', 'lash'), cels: [segment(4, 34, 230)] },
  {
    name: seq('water', 'bolt'),
    cels: [0, 3].map((frame) => ({
      draws: [painted('water-bolt', frame, BOLT_HEAD, 224)],
      meta: { facing: 0 },
    })),
  },
  {
    name: seq('water', 'splash'),
    cels: [0, 1].map((age) => ({
      draws: [painted('water-splash', age * 4, SPLASH, 224 - age * 22)],
    })),
  },
  { name: seq('water', 'puddle'), cels: [{ draws: [painted('water-splash', 8, SPLASH, 180)] }] },
];

/** Every source file a draw reads. */
export function drawnFiles(sequences: readonly SequenceRecipe[] = SEQUENCES): string[] {
  const files = new Set<string>();
  for (const s of sequences) for (const c of s.cels) for (const d of c.draws) files.add(d.file);
  return [...files].sort();
}

/** The sprite a draw starts from: the renderer's cut of the source. */
function cut(source: Image, how: Draw['cut'], label: string): Image {
  if (how === 'whole') return source;
  const ink = alphaBounds(source, 1);
  if (!ink) throw new Error(`${label} is empty.`);
  if (how === 'ink') return crop(source, ink);
  const pad = 3;
  const x0 = Math.max(0, ink.x - pad);
  const y0 = Math.max(0, ink.y - pad);
  const x1 = Math.min(source.width, ink.x + ink.width + pad);
  const y1 = Math.min(source.height, ink.y + ink.height + pad);
  return crop(source, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * One cel: every draw at the game's scale on one canvas around the pivot,
 * trimmed to the ink plus the art bible's margin. The pivot is where the
 * renderer placed the draws' anchor, in the trimmed cel's pixels.
 */
export function packEffectCel(
  recipe: CelRecipe,
  read: (file: string) => Image,
  label: string,
): { image: Image; meta: BendFxCelMeta } {
  const placed = recipe.draws.map((draw) => {
    const sprite = cut(read(draw.file), draw.cut, `${label} ${draw.file}`);
    let width: number;
    let height: number;
    if (draw.thickness !== undefined) {
      height = pyRound(draw.thickness * GAME_SCALE);
      width = pyRound((sprite.width * draw.thickness * GAME_SCALE) / sprite.height);
    } else {
      width = Math.max(1, pyRound(sprite.width * draw.scale * GAME_SCALE));
      height = Math.max(1, pyRound(sprite.height * draw.scale * GAME_SCALE));
    }
    const image = withOpacity(resize(sprite, width, height), draw.opacity);
    const at =
      draw.anchor === 'centre'
        ? { x: width / 2, y: height / 2 }
        : {
            x: (draw.anchor.x * width) / sprite.width,
            y: (draw.anchor.y * height) / sprite.height,
          };
    const offset = {
      x: (draw.offset?.x ?? 0) * GAME_SCALE,
      y: (draw.offset?.y ?? 0) * GAME_SCALE,
    };
    return { image, at, offset };
  });
  // A single draw sits at its own origin, so its pivot keeps the fraction;
  // a composite places each draw on whole pixels round a shared pivot, as
  // the renderer's `round` did.
  const single = placed.length === 1;
  const pad = 64;
  const size = Math.max(...placed.map((p) => Math.max(p.image.width, p.image.height))) + 2 * pad;
  const canvas = newImage(size, size);
  const pivot = single
    ? { x: (placed[0]?.at.x ?? 0) + pad, y: (placed[0]?.at.y ?? 0) + pad }
    : { x: size / 2, y: size / 2 };
  for (const p of placed) {
    const left = single ? pad : pyRound(pivot.x + p.offset.x - p.at.x);
    const top = single ? pad : pyRound(pivot.y + p.offset.y - p.at.y);
    for (let y = 0; y < p.image.height; y++) {
      for (let x = 0; x < p.image.width; x++) {
        const src = pixelAt(p.image, x, y);
        if (src[3] === 0) continue;
        const dst = pixelAt(canvas, left + x, top + y);
        setPixel(canvas, left + x, top + y, over(src, dst));
      }
    }
  }
  const ink = alphaBounds(canvas, 1);
  if (!ink) throw new Error(`${label} packs to nothing.`);
  const box = {
    x: ink.x - MARGIN,
    y: ink.y - MARGIN,
    width: ink.width + 2 * MARGIN,
    height: ink.height + 2 * MARGIN,
  };
  const image = newImage(box.width, box.height);
  for (let y = 0; y < ink.height; y++)
    for (let x = 0; x < ink.width; x++)
      setPixel(image, x + MARGIN, y + MARGIN, pixelAt(canvas, ink.x + x, ink.y + y));
  const segment = recipe.meta?.segment;
  const meta: BendFxCelMeta = {
    pivot: { x: round3(pivot.x - box.x), y: round3(pivot.y - box.y) },
    ...recipe.meta,
    // A segment's ink spans `segment` times the distance; the cel is wider by its margins.
    ...(segment === undefined ? {} : { segment: round3((segment * box.width) / ink.width) }),
  };
  return { image, meta };
}

/** Straight-alpha source-over, rounded like Pillow's `alpha_composite`. */
function over(src: readonly number[], dst: readonly number[]): [number, number, number, number] {
  const sa = (src[3] ?? 0) / 255;
  const da = (dst[3] ?? 0) / 255;
  const a = sa + da * (1 - sa);
  if (a === 0) return [0, 0, 0, 0];
  const mix = (c: number) => Math.round(((src[c] ?? 0) * sa + (dst[c] ?? 0) * da * (1 - sa)) / a);
  return [mix(0), mix(1), mix(2), Math.round(a * 255)];
}

/* ------------------------------------------------------------------ */
/* The effects                                                          */
/* ------------------------------------------------------------------ */

export interface R9Timing {
  readonly ms_per_frame: readonly number[];
}

/** The prototype's board motion, in its pixels, turned into tiles. */
const tiles = (px: number, places = 3): number => {
  const k = 10 ** places;
  return Math.round((px / PROTO_TILE) * k) / k;
};
/** The prototype's `SHAKES` offsets, as an amplitude in tiles. */
export const shake = (dx: number, dy: number): number => tiles(Math.hypot(dx, dy));
/** The prototype's local brightening (`Brightness(1.75)`): the cel added onto itself at 0.75. */
export const PROTO_FLASH = 0.75;
/**
 * Where the prototype landed every effect: `destination = (TARGET[0],
 * TARGET[1] - 120)`, 120 of its pixels above the target's feet, moved to
 * unit-cel pixels at the game's scale.
 */
export const IMPACT_OFFSET = { x: 0, y: round3(-120 * GAME_SCALE) };

/**
 * The effects, built from the r9 timing: `ms(f, g)` is the time the prototype
 * held bend cels `f..g`, which is how long it drew a layer's cel. Travel speed
 * is the prototype's 3-tile throw over the cels it flew across.
 */
export function effectDefs(timing: Readonly<Record<Element, R9Timing>>): BendEffectDef[] {
  const ms =
    (element: Element) =>
    (first: number, last = first) => {
      let total = 0;
      for (let frame = first; frame <= last; frame++) {
        const held = timing[element].ms_per_frame[frame];
        if (held === undefined) throw new Error(`${element} timing has no cel ${frame}.`);
        total += held;
      }
      return total;
    };
  const layer = (
    element: Element,
    name: string,
    phase: BendEffectLayer['phase'],
    z: BendEffectLayer['z'],
    origin: BendEffectLayer['origin'],
    frameMs: number[],
    release?: number,
  ): BendEffectLayer => ({
    phase,
    z,
    sequence: seq(element, name),
    frameMs,
    origin,
    blend: 'normal',
    ...(release === undefined ? {} : { release }),
  });
  const speed = (tilesFlown: number, flightMs: number): number =>
    Math.round((tilesFlown / (flightMs / 1000)) * 10) / 10;

  const f = ms('fire');
  const e = ms('earth');
  const w = ms('water');
  // The jab flies bend cels 2-4 and bursts on 5-7; the cross flies 6-8 and
  // bursts on 9-11. One speed serves both: the mean of the two flights.
  const fire: BendEffectDef = {
    id: EFFECT_IDS.fire,
    element: 'fire',
    layers: [
      layer('fire', 'jab-launch', 'launch', 'underActor', 'socket', [f(2)], 0),
      layer('fire', 'jab-ball', 'travel', 'overActor', 'previousPhaseEnd', [f(3, 4)], 0),
      layer('fire', 'burst', 'impact', 'overActor', 'targetTile', [f(5), f(6), f(7)], 0),
      layer('fire', 'cross-launch', 'launch', 'underActor', 'socket', [f(6)], 1),
      layer('fire', 'cross-ball', 'travel', 'overActor', 'previousPhaseEnd', [f(7, 8)], 1),
      layer('fire', 'burst', 'impact', 'overActor', 'targetTile', [f(9), f(10), f(11)], 1),
    ],
    trajectory: {
      kind: 'arc',
      speedTilesPerSecond: speed(3, (f(2, 4) + f(6, 8)) / 2),
      heightTiles: tiles(22, 2),
      spin: 0,
    },
    impact: {
      sequence: seq('fire', 'burst'),
      flash: PROTO_FLASH,
      shakeTiles: shake(-3, 2),
      offsetPx: IMPACT_OFFSET,
    },
  };
  // The stomp (release 0) opens the crack on bend cel 4 and it fades out by
  // cel 10; the rock rises in it on cel 5, hangs at the drive (release 1) on
  // cel 6, flies 6-8 and shatters on 9-11. The painted tumble is the spin. Its
  // loop's 100 ms a cel is hard-coded here, not read from the r9 timing: the
  // prototype drew one tumble cel per bend cel, and the loop has no bend cels.
  const earth: BendEffectDef = {
    id: EFFECT_IDS.earth,
    element: 'earth',
    layers: [
      layer('earth', 'crack', 'launch', 'ground', 'socket', [e(4), e(5, 7), e(8), e(9), e(10)], 0),
      layer('earth', 'emerge', 'gather', 'underActor', 'previousPhaseEnd', [e(5)], 1),
      layer('earth', 'hang', 'launch', 'underActor', 'socket', [e(6)], 1),
      layer('earth', 'tumble', 'travel', 'overActor', 'previousPhaseEnd', [100, 100, 100, 100], 1),
      layer('earth', 'shatter', 'impact', 'overActor', 'targetTile', [e(9), e(10), e(11)], 1),
    ],
    trajectory: {
      kind: 'arc',
      speedTilesPerSecond: speed(3, e(6, 8)),
      heightTiles: tiles(96, 2),
      spin: 0,
    },
    impact: {
      sequence: seq('earth', 'shatter'),
      flash: PROTO_FLASH,
      shakeTiles: shake(4, -3),
      offsetPx: IMPACT_OFFSET,
    },
  };
  // The gather trails the palm on bend cels 2-4 and curls on 4; the lash
  // leaves on 5, a third of the way and at most 1.5 tiles; the bolt flies
  // the rest over 6-7 and splashes on 8-9; the puddle is left on 10.
  const water: BendEffectDef = {
    id: EFFECT_IDS.water,
    element: 'water',
    layers: [
      layer('water', 'gather-lead', 'gather', 'underActor', 'socket', [w(2), w(3), w(4)]),
      layer('water', 'gather-trail', 'gather', 'underActor', 'socket', [w(3), w(4)]),
      layer('water', 'coil', 'gather', 'underActor', 'socket', [w(4)]),
      layer('water', 'lash', 'launch', 'underActor', 'socket', [w(5)]),
      layer('water', 'bolt', 'travel', 'overActor', 'previousPhaseEnd', [w(6), w(7)]),
      layer('water', 'splash', 'impact', 'overActor', 'targetTile', [w(8), w(9)]),
      layer('water', 'puddle', 'residue', 'overActor', 'targetTile', [w(10)]),
    ],
    trajectory: {
      kind: 'whipBolt',
      whipFraction: 0.333,
      whipMaxTiles: 1.5,
      boltSpeedTilesPerSecond: speed(2, w(6, 7)),
    },
    impact: {
      sequence: seq('water', 'splash'),
      flash: PROTO_FLASH,
      shakeTiles: shake(-3, 2),
      offsetPx: IMPACT_OFFSET,
    },
    residue: { sequence: seq('water', 'puddle'), durationMs: w(10), gameplaySurface: false },
  };
  return [fire, earth, water];
}

/* ------------------------------------------------------------------ */
/* Sources and pins                                                     */
/* ------------------------------------------------------------------ */

/** Every file the build pins, relative to the prototype: every numbered PNG of each folder. */
export function effectSourceFiles(source: string): string[] {
  const files: string[] = [RENDERER, ...Object.values(TIMING_FILES)];
  for (const folder of SOURCE_FOLDERS) {
    const dir = join(source, folder);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir).sort()) {
      if (/^\d+\.png$/i.test(entry)) files.push(`${folder}/${entry}`);
    }
  }
  return files;
}

/** Problems with a source set against the pins; empty is clean. */
export function checkEffectSources(source: string, pins: EffectPins): string[] {
  // The pinned files and the ones on disk: a pinned file that is gone is
  // missing, and a numbered PNG nobody pinned is a stray.
  const files = [...new Set([...effectSourceFiles(source), ...Object.keys(pins.sources)])].sort();
  const problems = checkSources(source, files, pins.sources, 'effect source');
  for (const file of drawnFiles()) {
    if (!pins.sources[file]) problems.push(`effect source ${file} is drawn but not pinned`);
  }
  return problems;
}

/** Writes a fresh pin file for a source set. Refuses to overwrite one. */
export function pinEffectSources(source: string, pinsPath = EFFECT_PINS): void {
  if (existsSync(pinsPath))
    throw new Error(`${pinsPath} exists; a pin file is never rewritten by --pin.`);
  const files = effectSourceFiles(source);
  const missing = [...Object.values(TIMING_FILES), RENDERER, ...drawnFiles()].filter(
    (file) => !existsSync(join(source, file)),
  );
  if (missing.length > 0) throw new Error(`${source} is not the prototype:\n${missing.join('\n')}`);
  const pins: EffectPins = {
    sources: Object.fromEntries(
      files.map((file) => [file, sha256(readFileSync(join(source, file)))]),
    ),
    frames: {},
  };
  mkdirSync(resolve(pinsPath, '..'), { recursive: true });
  writeFileSync(pinsPath, `${JSON.stringify(pins, null, 2)}\n`);
}

/* ------------------------------------------------------------------ */
/* The build                                                            */
/* ------------------------------------------------------------------ */

export interface EffectBuildOptions {
  /** `public/`: the pages go to `BEND_FX.pages`, the effects to `BEND_FX.data`. */
  readonly publicDir: string;
  readonly pinsPath?: string;
  /** The shipped bend sets the effects must serve; defaults to the three party sets. */
  readonly sets?: readonly BendSetDef[];
  readonly log?: (line: string) => void;
}

/** The shipped party bend sets, as `public/art/units/<name>-bend.json`. */
export function shippedSets(publicDir = 'public'): BendSetDef[] {
  return Object.values(BEND_CHARACTERS).map(
    (who) =>
      JSON.parse(
        readFileSync(join(publicDir, 'art/units', `${who.name}-bend.json`), 'utf8'),
      ) as BendSetDef,
  );
}

export async function buildEffects(
  source: string,
  options: EffectBuildOptions,
): Promise<{ effects: BendEffectDef[]; bytes: Record<string, number> }> {
  const log = options.log ?? console.log;
  const pinsPath = options.pinsPath ?? EFFECT_PINS;
  if (!existsSync(pinsPath)) throw new Error(`${pinsPath} is missing; pin the sources with --pin.`);
  const pins = JSON.parse(readFileSync(pinsPath, 'utf8')) as EffectPins;
  const problems = checkEffectSources(source, pins);
  if (problems.length > 0)
    throw new Error(`Effect sources do not match ${pinsPath}:\n${problems.join('\n')}`);

  const timing = Object.fromEntries(
    ELEMENTS.map((element) => [
      element,
      JSON.parse(readFileSync(join(source, TIMING_FILES[element]), 'utf8')) as R9Timing,
    ]),
  ) as Record<Element, R9Timing>;
  const sets = options.sets ?? shippedSets(options.publicDir);
  // Every shipped heading still plays the timing the effects were drawn to.
  for (const set of sets) {
    const want = timing[set.element as Element]?.ms_per_frame.join();
    for (const heading of HEADINGS) {
      if (set.facings[heading].frameMs.join() !== want)
        throw new Error(`${set.id} ${heading} is not timed as the approved ${set.element} bend.`);
    }
  }

  const effects = effectDefs(timing);
  for (const effect of effects) {
    const parsed = bendEffectDefSchema.safeParse(effect);
    if (!parsed.success) throw new Error(`${effect.id} fails its schema: ${parsed.error.message}`);
  }
  // The sets the bend packer writes name these effects: check them as it will.
  const renamed = sets.map((set) => {
    const who = Object.values(BEND_CHARACTERS).find((c) => c.key === set.unitAsset);
    if (!who) throw new Error(`${set.id} draws no party character.`);
    const facings = { ...set.facings };
    for (const heading of HEADINGS) {
      const facing: HeadingBendDef = set.facings[heading];
      facings[heading] = {
        ...facing,
        attacks: facing.attacks.map((attack) => ({ ...attack, effectId: who.effectId })),
      };
    }
    return { ...set, facings };
  });
  const setProblems = validateBendSets(renamed, effects, Object.keys(ASSETS));
  if (setProblems.length > 0) throw new Error(`Bend effects:\n${setProblems.join('\n')}`);

  const cache = new Map<string, Image>();
  const read = (file: string): Image => {
    let image = cache.get(file);
    if (!image) {
      image = readPng(join(source, file));
      cache.set(file, image);
    }
    return image;
  };
  const cels = new Map<string, Image>();
  const metas = new Map<string, BendFxCelMeta>();
  for (const sequence of SEQUENCES) {
    sequence.cels.forEach((recipe, index) => {
      const name = effectCelName(sequence.name, index);
      const { image, meta } = packEffectCel(recipe, read, name);
      cels.set(name, image);
      metas.set(name, meta);
    });
  }
  const celProblems = validateEffectCels(effects, [...cels.keys()]);
  if (celProblems.length > 0) throw new Error(`Effect cels:\n${celProblems.join('\n')}`);

  const layouts = layoutBendPages(cels);
  if (layouts.length !== BEND_FX.pages.length)
    throw new Error(
      `The effects pack to ${layouts.length} pages; BEND_FX registers ${BEND_FX.pages.length}.`,
    );
  const frameHashes: Record<string, string> = {};
  const bytes: Record<string, number> = {};
  const writes: { file: string; content: Uint8Array | string; line: string }[] = [];
  for (const [index, layout] of layouts.entries()) {
    const jsonFile = BEND_FX.pages[index] ?? '';
    const imageFile = jsonFile.replace(/\.json$/, '.webp');
    const atlas = newImage(layout.width, layout.height);
    for (const [frame, rect] of layout.frames) {
      const pixels = cels.get(frame);
      if (!pixels) throw new Error(`No pixels prepared for ${frame}.`);
      for (let y = 0; y < rect.h; y++)
        for (let x = 0; x < rect.w; x++)
          setPixel(atlas, rect.x + x, rect.y + y, pixelAt(pixels, x, y));
    }
    const webp = await encodeWebp(atlas, WEBP_QUALITY, true);
    const decoded = await decodeWebp(webp);
    for (const [frame, rect] of layout.frames) {
      if (borderTouched(decoded, rect, MARGIN))
        throw new Error(`${frame} decodes with art inside its ${MARGIN} px margin.`);
      if (!alphaBounds(crop(decoded, { x: rect.x, y: rect.y, width: rect.w, height: rect.h }), 1))
        throw new Error(`${frame} decodes empty.`);
      frameHashes[frame] = celHash(decoded, rect);
    }
    const base = imageFile.split('/').pop() ?? imageFile;
    const atlasJson = JSON.parse(
      atlasJsonText(layout.frames, base, layout.width, layout.height),
    ) as { frames: Record<string, Record<string, unknown>> };
    for (const [frame, entry] of Object.entries(atlasJson.frames)) entry.fx = metas.get(frame);
    const json = `${JSON.stringify(atlasJson)}\n`;
    bytes[imageFile] = webp.length;
    bytes[jsonFile] = Buffer.byteLength(json);
    writes.push(
      {
        file: join(options.publicDir, imageFile),
        content: webp,
        line: `wrote ${imageFile} (${layout.width}x${layout.height}, ${layout.frames.size} cels, ${webp.length} B)`,
      },
      { file: join(options.publicDir, jsonFile), content: json, line: `wrote ${jsonFile}` },
    );
  }
  const data = `${JSON.stringify(effects)}\n`;
  bytes[BEND_FX.data] = Buffer.byteLength(data);
  writes.push(
    {
      file: join(options.publicDir, BEND_FX.data),
      content: data,
      line: `wrote ${BEND_FX.data} (${bytes[BEND_FX.data]} B)`,
    },
    {
      file: pinsPath,
      content: `${JSON.stringify({ ...pins, frames: frameHashes }, null, 2)}\n`,
      line: `wrote ${pinsPath} cel pins`,
    },
  );
  for (const { file, content, line } of writes) {
    mkdirSync(resolve(file, '..'), { recursive: true });
    writeFileSync(file, content);
    log(line);
  }
  return { effects, bytes };
}

function argValue(argv: readonly string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at < 0 ? undefined : argv[at + 1];
}

if (process.argv[1]?.endsWith('bend-effects.ts')) {
  const argv = process.argv.slice(2);
  const sourceArg = argValue(argv, '--source');
  if (!sourceArg) throw new Error('Pass --source <vfx-proto>.');
  const source = resolve(sourceArg);
  if (argv.includes('--pin')) {
    pinEffectSources(source);
    console.log(`wrote ${EFFECT_PINS} source pins`);
  } else {
    await buildEffects(source, { publicDir: resolve('public') });
  }
}
