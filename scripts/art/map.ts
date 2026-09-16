/**
 * A map painting to the WebP the game loads (ADR 0009).
 *
 *   npm run art:map -- --map forest_road [--in art/raw/maps] [--out public/art/maps]
 *     [--px 96] [--quality 82]
 *
 * Reads `art/raw/maps/<id>.png`, checks it has the map's aspect, downsizes it
 * with the same box filter the sheets go through to `width x px` by
 * `height x px`, writes it as WebP and prints the `backdrop` line to put on
 * the map. Generate at the target size or larger: the filter never upscales.
 * `--px` defaults to the largest multiple of 8 that keeps the painting 1920
 * wide (96 for a 20-wide fight, 80 for the 24-wide village), inside the 2048
 * px texture every iPad takes.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ALL_MAPS } from '../../src/content';
import type { MapDef } from '../../src/core/types';
import { readPng } from './lib/image';
import { scaleTo } from './lib/scale';
import { encodeWebp } from './lib/webp';

/** The widest painting shipped: under the 2048 px texture cap with room to spare. */
export const PAINTING_WIDTH = 1920;
export const DEFAULT_QUALITY = 82;

/** The pixels a tile that keep a map's painting `PAINTING_WIDTH` wide, in eights. */
export function defaultPixelsPerTile(map: { width: number }): number {
  return Math.max(32, Math.min(256, Math.floor(PAINTING_WIDTH / map.width / 8) * 8));
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

export async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);
  const map = ALL_MAPS.find((m) => m.id === args.map);
  if (!map) {
    console.error(`No map "${args.map}". Maps: ${ALL_MAPS.map((m) => m.id).join(', ')}.`);
    return 1;
  }
  const px = args.px || defaultPixelsPerTile(map);
  const quality = args.quality || DEFAULT_QUALITY;
  const source = resolve(args.in, `${map.id}.png`);
  if (!existsSync(source)) {
    console.error(`Nothing at ${source}: save the painting there first.`);
    return 1;
  }

  const raw = readPng(source);
  const wantW = map.width * px;
  const wantH = map.height * px;
  const aspect = raw.width / raw.height;
  const wantAspect = map.width / map.height;
  if (Math.abs(aspect - wantAspect) > wantAspect * 0.01) {
    console.error(
      `${map.id}.png is ${raw.width}x${raw.height}, which is not the map's ${map.width}:${map.height} aspect; ` +
        `generate it at ${wantW}x${wantH} or a multiple.`,
    );
    return 1;
  }
  if (raw.width < wantW || raw.height < wantH) {
    console.error(
      `${map.id}.png is ${raw.width}x${raw.height}; it has to be at least ${wantW}x${wantH} (never upscaled).`,
    );
    return 1;
  }

  const scaled = raw.width === wantW && raw.height === wantH ? raw : scaleTo(raw, wantW, wantH);
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
