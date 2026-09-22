/**
 * The forest route's ground material, re-derived from the village's accepted art.
 *
 * DL-2 asks the four scenes to read as one game. The village is the only place
 * in the pipeline where an *accepted* painting is the source of the next one —
 * `ba-dan-neighborhood-ground.ts` decodes `courtyard-ground.webp` and
 * `western-approach-ground.webp` and samples their verified opaque interiors.
 * This module does the same for the forest, and is shared by
 * `forest-route-ground.ts` and `forest-grass-regions.ts` so the route plate and
 * the two grass packs cannot drift from each other across their overlap rows.
 *
 * What is taken from the village is its **structure**, not its key: the shape
 * and rhythm of the painted incident (flagstone joints, tufts in the lawn),
 * read as one of three classes by luminance percentile inside the crop. What is
 * applied is the DL-2 §3 ground table. So the forest road keeps the village's
 * hand and gets the packed-earth family the route is supposed to be, instead of
 * the four-quadrant forest atlas's desert ochre. Because the output is only
 * ever one of a handful of named flat tones, the baked light-to-dark ramp and
 * the far-edge haze the atlas carried (defects 10 and 11) cannot survive the
 * re-key: there is no continuous tone left to hold them.
 *
 * Nothing here writes to the village. The two plates are opened read-only.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init as initWebpDecode } from '@jsquash/webp/decode.js';
import {
  BA_DAN_COURTYARD_GROUND,
  BA_DAN_WESTERN_APPROACH_GROUND,
} from '../../src/content/scenes/baDan';
import { tileNoise } from '../../src/render/painters/shapes';
import { parseHex } from './lib/image';

/**
 * DL-2 §3, the one ground language. Exactly two flat tones per material plus
 * one thin pale rim — the art bible's shading rule, applied to ground for the
 * first time. `road` and `wear` are the packed-earth family; `verge` is the
 * Earth nation family out of `src/render/palettes.ts`.
 */
export const FOREST_GROUND_TONES = {
  road: { base: '#b39064', shadow: '#8e7049', rim: '#c7a87d' },
  /** Path wear: the third material, so the plane is not one mirrored swatch. */
  wear: { base: '#a6845a', shadow: '#7a5f3e', rim: '#c7a87d' },
  verge: { base: '#6f9e4c', shadow: '#4f7538', rim: '#a8c686' },
} as const;
export type ToneName = keyof typeof FOREST_GROUND_TONES;
/** Every outline in this game, never black, never tapered (`docs/art-bible.md`). */
export const FOREST_INK = '#1b1410';

/**
 * How much of a crop becomes the shadow tone and how much the rim. The rim is
 * the bible's *thin* pale edge, so it is the smaller share; the shadow is the
 * painted joint and the tuft shade. Holding these as shares rather than as
 * absolute luminance cuts is what keeps the plate's mean predictable, and
 * therefore what keeps the cross-scene tone band checkable.
 */
export const SHADOW_SHARE = 0.14;
export const RIM_SHARE = 0.14;
/**
 * The darkest slice of a crop, which in the village's paving is the flagstone
 * joint itself rather than the general shade beside it. A material that names a
 * `joint` tone paints this slice with it — that is how DL-2 §3's "joint lines
 * `#9a8c72`" and "tool-mark `#8a7d66`" reach the plate without inventing a
 * second sampling pass. A material that does not name one (every forest tone)
 * falls back to its shadow, which is exactly what the two-cut version did, so
 * the forest plates are unaffected.
 */
export const JOINT_SHARE = 0.05;

/**
 * WebP quality for the three re-keyed ground plates, shared so they cannot
 * drift apart. It is below the 86 the forest atlas needed because there is
 * nothing photographic left to preserve: ten flat tones and an ink line
 * survive a lower setting intact, and the map family is at its 4 MiB budget
 * (`scripts/check-asset-budget.mjs`), which the richer detail would otherwise
 * push over.
 */
export const FOREST_GROUND_QUALITY = 74;

export type Rgb = readonly [number, number, number];

/**
 * One material's flat tones. Two per material plus a thin pale rim is the
 * bible's shading rule; `joint` is the optional darkest slice described at
 * `JOINT_SHARE`, used by the cut-stone families.
 */
export interface ToneSpec {
  readonly base: string;
  readonly shadow: string;
  readonly rim: string;
  readonly joint?: string;
}

/** Which village crop a material reads its structure from. */
export type CropName = 'paving' | 'lawn';

export interface Crop {
  /** Village plate this crop lives on, and where that plate sits in the scene. */
  readonly image: ImageData;
  readonly origin: { readonly x: number; readonly y: number };
  /** Half-open logical tile bounds, verified fully opaque before use. */
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  /** Luminance below this is the shadow tone; above `rim`, the rim tone. */
  shadow: number;
  rim: number;
  /** Below this is the joint tone, for materials that name one. */
  joint: number;
}

/** Rec. 709 luma on the stored sRGB bytes; the same weighting the measure uses. */
function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

let decoderReady: Promise<void> | null = null;
async function readWebp(path: string): Promise<ImageData> {
  if (!decoderReady) {
    const require = createRequire(import.meta.url);
    const wasm = readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'));
    decoderReady = WebAssembly.compile(wasm).then((module) => initWebpDecode(module));
  }
  await decoderReady;
  const bytes = readFileSync(path);
  return decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

/** The village's forward projection, exactly as the neighbourhood packer writes it. */
function villagePixel(crop: Crop, x: number, y: number): readonly number[] {
  const px = Math.floor(1024 + (x - y) * 64 - crop.origin.x);
  const py = Math.floor((x + y) * 32 - crop.origin.y);
  const i = (py * crop.image.width + px) * 4;
  return [
    crop.image.data[i] ?? 0,
    crop.image.data[i + 1] ?? 0,
    crop.image.data[i + 2] ?? 0,
    crop.image.data[i + 3] ?? 0,
  ];
}

/**
 * The two luminance cuts that split this crop into shadow / base / rim at the
 * shares above, plus the guarantee the crop is a usable source: every sample
 * inside it must be fully opaque village interior, never a prop, never water,
 * never one of the plate's own feathers.
 */
export function calibrate(crop: Crop, label: string): void {
  const values: number[] = [];
  for (let y = crop.y0; y < crop.y1; y += 0.01)
    for (let x = crop.x0; x < crop.x1; x += 0.01) {
      const [r, g, b, a] = villagePixel(crop, x, y);
      if ((a ?? 0) < 250)
        throw new Error(
          `${label}: the crop reaches a clear pixel at ${x.toFixed(2)},${y.toFixed(2)}`,
        );
      values.push(luma(r ?? 0, g ?? 0, b ?? 0));
    }
  values.sort((a, b) => a - b);
  crop.shadow = values[Math.floor(values.length * SHADOW_SHARE)] ?? 0;
  crop.rim = values[Math.floor(values.length * (1 - RIM_SHARE))] ?? 255;
  crop.joint = values[Math.floor(values.length * JOINT_SHARE)] ?? 0;
}

/**
 * Which tone a point takes, from the village crop's own painted incident.
 *
 * The crop is walked one whole tile at a time and the tile is chosen by a hash
 * of the destination cell, not by a modulo of it, and is flipped on either axis
 * by the same hash. The old forest packer mirrored one swatch on a fixed period
 * (`forest-route-ground.ts`'s `sample`), which is what made the plane read as a
 * single repeated tile; this cannot, because neighbouring cells draw unrelated
 * tiles of the source in unrelated orientations.
 */
export type StructureClass = 'joint' | 'shadow' | 'base' | 'rim';
export function structure(crop: Crop, x: number, y: number, salt: number): StructureClass {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const width = crop.x1 - crop.x0,
    height = crop.y1 - crop.y0;
  const pick = Math.floor(tileNoise(ix, iy, salt) * width * height);
  let fx = x - ix,
    fy = y - iy;
  if (tileNoise(ix, iy, salt + 1) > 0.5) fx = 1 - fx;
  if (tileNoise(ix, iy, salt + 2) > 0.5) fy = 1 - fy;
  const sx = crop.x0 + (pick % width) + Math.min(0.999, fx);
  const sy = crop.y0 + (Math.floor(pick / width) % height) + Math.min(0.999, fy);
  const [r, g, b] = villagePixel(crop, sx, sy);
  const value = luma(r ?? 0, g ?? 0, b ?? 0);
  if (value < crop.joint) return 'joint';
  return value < crop.shadow ? 'shadow' : value > crop.rim ? 'rim' : 'base';
}

/**
 * The two village crops, calibrated. Shared by the forest and the quarry so
 * every re-keyed plate in DL-2 reads its structure from the same two accepted
 * paintings; only the tone table differs between scenes.
 */
export async function loadVillageCrops(): Promise<Record<CropName, Crop>> {
  const courtyard = await readWebp('public/art/maps/ba-dan-scene/courtyard-ground.webp');
  const western = await readWebp('public/art/maps/ba-dan-scene/western-approach-ground.webp');
  // Both interiors are the ones the village's own packer certifies: broad
  // paving on the western approach's road, and the quiet lawn at x10..11,y4 of
  // the courtyard. Neither holds a prop, a water cell or a feather.
  const paving: Crop = {
    image: western,
    origin: BA_DAN_WESTERN_APPROACH_GROUND,
    x0: 1,
    x1: 6,
    y0: 7,
    y1: 9,
    shadow: 0,
    rim: 255,
    joint: 0,
  };
  const lawn: Crop = {
    image: courtyard,
    origin: BA_DAN_COURTYARD_GROUND,
    x0: 10,
    x1: 12,
    y0: 4,
    y1: 5,
    shadow: 0,
    rim: 255,
    joint: 0,
  };
  calibrate(paving, 'western-approach paving x1..5,y7..8');
  calibrate(lawn, 'courtyard lawn x10..11,y4');
  return { paving, lawn };
}

/**
 * A scene's tone table bound to the village crops: given a material name and a
 * logical point, the flat tone that point takes. `crops` and `salts` say which
 * accepted crop supplies each material's structure and with which tiling hash,
 * so two materials sharing a crop still draw unrelated incident.
 */
export interface VillagePalette<N extends string> {
  readonly colour: (tone: N, x: number, y: number) => Rgb;
  readonly rimOf: (tone: N) => Rgb;
  readonly ink: Rgb;
  readonly cuts: Readonly<Record<CropName, { shadow: number; rim: number; joint: number }>>;
}

export function bindPalette<N extends string>(
  crops: Record<CropName, Crop>,
  table: Readonly<Record<N, ToneSpec>>,
  cropOf: Readonly<Record<N, CropName>>,
  saltOf: Readonly<Record<N, number>>,
): VillagePalette<N> {
  const parsed = {} as Record<N, Record<StructureClass, Rgb>>;
  for (const name of Object.keys(table) as N[]) {
    const spec = table[name];
    parsed[name] = {
      base: parseHex(spec.base),
      shadow: parseHex(spec.shadow),
      rim: parseHex(spec.rim),
      joint: spec.joint ? parseHex(spec.joint) : parseHex(spec.shadow),
    };
  }
  return {
    ink: parseHex(FOREST_INK),
    cuts: {
      paving: {
        shadow: crops.paving.shadow,
        rim: crops.paving.rim,
        joint: crops.paving.joint,
      },
      lawn: { shadow: crops.lawn.shadow, rim: crops.lawn.rim, joint: crops.lawn.joint },
    },
    rimOf: (tone) => parsed[tone].rim,
    colour: (tone, x, y) => parsed[tone][structure(crops[cropOf[tone]], x, y, saltOf[tone])],
  };
}

export interface ForestMaterial {
  /** The flat tone for a logical point of the named material. */
  readonly colour: (tone: ToneName, x: number, y: number) => Rgb;
  /** A material's pale rim tone, for the thin lit edge beside a region's ink. */
  readonly rimOf: (tone: ToneName) => Rgb;
  /** True where the road has been worn to its ruts; drives the third material. */
  readonly worn: (x: number, y: number) => boolean;
  readonly ink: Rgb;
  /** Reported by the packers so the handoff can show what the re-key keyed to. */
  readonly cuts: VillagePalette<ToneName>['cuts'];
}

/**
 * The centre of the five road rows (y 4..8). The ruts run with the road, along
 * x, which is why the wear is a function of y and a slow wander in x rather
 * than a radius: a cart leaves two lines, not a stain.
 */
const ROAD_CENTRE = 6.5;
const RUT_OFFSET = 1.05;
const RUT_HALF = 0.3;

export async function loadForestMaterial(): Promise<ForestMaterial> {
  const palette = bindPalette(
    await loadVillageCrops(),
    FOREST_GROUND_TONES,
    { road: 'paving', wear: 'paving', verge: 'lawn' },
    { road: 17, wear: 17, verge: 31 },
  );
  return {
    ink: palette.ink,
    cuts: palette.cuts,
    rimOf: palette.rimOf,
    colour: palette.colour,
    worn(x: number, y: number): boolean {
      // Two ruts either side of the centre line, wandering by about a tenth of
      // a tile so the pair never reads as a ruled stripe, plus the occasional
      // scuffed cell away from them.
      const wander = 0.12 * Math.sin(x * 1.7) + 0.06 * Math.sin(x * 4.3 + 1.1);
      const rut = Math.min(
        Math.abs(y - (ROAD_CENTRE - RUT_OFFSET) - wander),
        Math.abs(y - (ROAD_CENTRE + RUT_OFFSET) + wander),
      );
      if (rut < RUT_HALF) return true;
      return tileNoise(Math.floor(x), Math.floor(y), 23) > 0.86;
    },
  };
}
