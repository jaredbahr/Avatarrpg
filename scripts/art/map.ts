/**
 * A map painting to the WebP the game loads (ADR 0009).
 *
 *   npm run art:map -- --map forest_road [--in art/raw/maps | --in <file>]
 *     [--out public/art/maps] [--px 96] [--quality 82]
 *
 * Reads `art/raw/maps/<id>.png` (or `.jpg`, or the file `--in` names),
 * checks it has the map's aspect, cutting a centred band off a near miss
 * of up to a tenth and saying so, downsizes it with the same box filter
 * the sheets go through to `width x px` by `height x px`, writes it as WebP
 * and prints the `backdrop` line to put on the map. Generate at the target
 * size or larger: the filter never upscales.
 * `--px` defaults to the largest multiple of 8 that keeps the painting 1920
 * wide (96 for a 20-wide fight, 80 for the 24-wide village), inside the 2048
 * px texture every iPad takes.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ALL_MAPS } from '../../src/content';
import type { MapDef } from '../../src/core/types';
import { readImage } from './lib/image';
import { scaleTo } from './lib/scale';
import type { Bounds } from './lib/trim';
import { aspectCrop, crop } from './lib/trim';
import { encodeWebp } from './lib/webp';

/** The widest painting shipped: under the 2048 px texture cap with room to spare. */
export const PAINTING_WIDTH = 1920;
export const DEFAULT_QUALITY = 82;

/** The pixels a tile that keep a map's painting `PAINTING_WIDTH` wide, in eights. */
export function defaultPixelsPerTile(map: { width: number }): number {
  return Math.max(32, Math.min(256, Math.floor(PAINTING_WIDTH / map.width / 8) * 8));
}

/** The most a painting may be off the map's aspect and still be cropped to it rather than refused. */
export const MAX_ASPECT_OFF = 0.1;

export interface PaintingFit {
  /** The centred box to cut, or null when the painting already has the aspect. */
  readonly crop: Bounds | null;
  /** Why the painting cannot be used, or null. */
  readonly problem: string | null;
  /** What was cut, for the report. */
  readonly note: string | null;
}

/**
 * Whether a painting can become the map's backdrop: the aspect within 1% is
 * taken as is, within `MAX_ASPECT_OFF` is cropped to the map (a generator
 * that only offers 16:9 loses a band off the sides of a 5:3 map), further
 * off is refused because the layout was not kept; then the crop must still
 * be at least the delivery size, since the filter never scales up.
 */
export function fitPainting(
  raw: { width: number; height: number },
  map: { id: string; width: number; height: number },
  px: number,
): PaintingFit {
  const wantW = map.width * px;
  const wantH = map.height * px;
  const wantAspect = map.width / map.height;
  const off = Math.abs(raw.width / raw.height - wantAspect) / wantAspect;
  let box: Bounds = { x: 0, y: 0, width: raw.width, height: raw.height };
  let note: string | null = null;
  if (off > MAX_ASPECT_OFF) {
    return {
      crop: null,
      note: null,
      problem:
        `${map.id}: the painting is ${raw.width}x${raw.height}, ${Math.round(off * 100)}% off the map's ` +
        `${map.width}:${map.height} aspect; regenerate it from the layout image at ${wantW}x${wantH} or a multiple.`,
    };
  }
  if (off > 0.01) {
    box = aspectCrop(raw, map.width, map.height);
    const dx = raw.width - box.width;
    const dy = raw.height - box.height;
    const tiles =
      dx > 0
        ? (dx / (box.width / map.width)).toFixed(2)
        : (dy / (box.height / map.height)).toFixed(2);
    note =
      `${map.id}: the painting is ${raw.width}x${raw.height}, ${Math.round(off * 100)}% off the map's aspect; ` +
      `cut ${dx > 0 ? `${dx} px off the sides` : `${dy} px off the top and bottom`} (${tiles} tiles) to ${box.width}x${box.height}. ` +
      `If that moved an edge that matters, regenerate from the layout image instead.`;
  }
  if (box.width < wantW || box.height < wantH) {
    return {
      crop: null,
      note,
      problem: `${map.id}: ${box.width}x${box.height} is smaller than ${wantW}x${wantH}; the filter never upscales, so generate larger.`,
    };
  }
  return { crop: off > 0.01 ? box : null, note, problem: null };
}

/** The `backdrop` line for a map, as the content wants it. */
export function backdropLine(map: MapDef, px: number): string {
  return `backdrop: { url: 'art/maps/${map.id}.webp', pixelsPerTile: ${px} },`;
}

interface Args {
  map: string;
  in: string;
  out: string;
  px: number;
  quality: number;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { map: '', in: 'art/raw/maps', out: 'public/art/maps', px: 0, quality: 0 };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!flag?.startsWith('--')) continue;
    const name = flag.slice(2);
    if (value === undefined) throw new Error(`--${name} needs a value`);
    i += 1;
    switch (name) {
      case 'map':
      case 'in':
      case 'out':
        args[name] = value;
        break;
      case 'px':
      case 'quality':
        args[name] = Number(value);
        if (!Number.isFinite(args[name])) throw new Error(`--${name} must be a number`);
        break;
      default:
        throw new Error(`Unknown option --${name}`);
    }
  }
  if (!args.map) throw new Error('--map is required, e.g. --map forest_road');
  return args;
}

/** `--in` as a file, or the map's PNG or JPEG inside the folder it names. */
function findSource(where: string, mapId: string): string | null {
  if (/\.(png|jpe?g)$/i.test(where)) return existsSync(where) ? resolve(where) : null;
  for (const ext of ['png', 'jpg', 'jpeg']) {
    const candidate = resolve(where, `${mapId}.${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);
  const map = ALL_MAPS.find((m) => m.id === args.map);
  if (!map) {
    console.error(`No map "${args.map}". Maps: ${ALL_MAPS.map((m) => m.id).join(', ')}.`);
    return 1;
  }
  const px = args.px || defaultPixelsPerTile(map);
  const quality = args.quality || DEFAULT_QUALITY;
  const source = findSource(args.in, map.id);
  if (!source) {
    console.error(
      `Nothing at ${resolve(args.in, `${map.id}.png`)}: save the painting there first.`,
    );
    return 1;
  }

  const raw = readImage(source);
  const wantW = map.width * px;
  const wantH = map.height * px;
  const fit = fitPainting(raw, map, px);
  if (fit.note) console.warn(fit.note);
  if (fit.problem) {
    console.error(fit.problem);
    return 1;
  }
  const framed = fit.crop ? crop(raw, fit.crop) : raw;

  const scaled =
    framed.width === wantW && framed.height === wantH ? framed : scaleTo(framed, wantW, wantH);
  const bytes = await encodeWebp(scaled, quality);
  const target = resolve(args.out, `${map.id}.webp`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);

  const kb = Math.round(bytes.length / 1024);
  console.warn(`wrote ${target} (${wantW}x${wantH}, ${kb} KB at quality ${quality})`);
  if (bytes.length > 1024 * 1024) {
    console.warn(
      'Over 1 MB: five paintings at this size would break the 4 MB family budget. Try --quality 75.',
    );
  }
  console.warn(`Put this on the map in src/content/maps/:\n  ${backdropLine(map, px)}`);
  console.warn('Then: npm run art:validate && npm run check:assets');
  return 0;
}

if (process.argv[1]?.endsWith('map.ts')) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    },
  );
}
