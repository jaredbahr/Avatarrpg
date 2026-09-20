/**
 * A portrait candidate to the 512 px PNG the game loads.
 *
 *   npm run art:portrait -- --key kaya --in art/raw/incoming/kaya.png
 *     [--out public/art/portraits] [--size 512]
 *
 * Reads a PNG or a JPEG, cuts the largest centred square when it is not one,
 * composites anything clear onto the parchment the packs ask for, downsizes
 * with the box filter (never up: generate at 1024 or larger), writes
 * `public/art/portraits/<name>.png` and prints the manifest line with the
 * palette the manifest already carries for that portrait, so nothing is
 * left to guess or to typo.
 */

import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { PNG } from 'pngjs';
import { ASSETS } from '../../src/content/assets/manifest';
import { flatten, readImage, toHex } from './lib/image';
import { cornerColor } from './lib/key';
import { scaleTo } from './lib/scale';
import { crop, squareCrop } from './lib/trim';

/** The flat background every portrait pack asks for. */
export const PARCHMENT = '#f4e9d8';
/** How far the corners may sit from the parchment before the medallion's rim will show it. */
const PARCHMENT_TOLERANCE = 40;
/** Past this a 512 px portrait is not flat-shaded, and seventeen of them strain the family budget. */
const HEAVY_BYTES = 300 * 1024;
const PORTRAITS = 17;

interface Args {
  key: string;
  in: string;
  out: string;
  size: number;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { key: '', in: '', out: 'public/art/portraits', size: 512 };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!flag?.startsWith('--')) continue;
    const name = flag.slice(2);
    if (value === undefined) throw new Error(`--${name} needs a value`);
    i += 1;
    switch (name) {
      case 'key':
      case 'in':
      case 'out':
        args[name] = value;
        break;
      case 'size':
        args.size = Number(value);
        if (!Number.isFinite(args.size) || args.size < 16)
          throw new Error('--size must be a number');
        break;
      default:
        throw new Error(`Unknown option --${name}`);
    }
  }
  if (!args.key) throw new Error('--key is required, e.g. --key kaya');
  if (!args.in) throw new Error('--in is required: the candidate PNG or JPEG');
  return args;
}

/** The manifest line an image portrait needs, with the palette the entry already carries. */
export function manifestLine(key: string, url: string): string {
  const entry = ASSETS[key];
  const palette = entry && 'palette' in entry && entry.palette ? entry.palette : 'neutral';
  return `'${key}': { kind: 'image', url: '${url}', palette: '${palette}' },`;
}

export function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  const key = args.key.startsWith('portrait.') ? args.key : `portrait.${args.key}`;
  if (!ASSETS[key]) {
    const known = Object.keys(ASSETS)
      .filter((k) => k.startsWith('portrait.'))
      .map((k) => k.slice('portrait.'.length));
    console.error(`No portrait "${key}". Portraits: ${known.join(', ')}.`);
    return 1;
  }
  const name = key.slice('portrait.'.length);

  const raw = readImage(args.in);
  if (Math.min(raw.width, raw.height) < args.size) {
    console.error(
      `${args.in} is ${raw.width}x${raw.height}; a portrait is generated at 1024 or larger and scaled down, never up.`,
    );
    return 1;
  }

  const box = squareCrop(raw);
  const squared = box.width === raw.width && box.height === raw.height ? raw : crop(raw, box);
  if (squared !== raw) {
    const dx = raw.width - box.width;
    const dy = raw.height - box.height;
    console.warn(
      `cut ${dx > 0 ? `${dx} px off the sides` : `${dy} px off the top and bottom`} to make ${box.width}x${box.height} square`,
    );
  }
  const flat = flatten(squared, PARCHMENT);
  const corner = cornerColor(flat);
  const [pr, pg, pb] = [0xf4, 0xe9, 0xd8];
  if (Math.hypot(corner[0] - pr, corner[1] - pg, corner[2] - pb) > PARCHMENT_TOLERANCE) {
    console.warn(
      `the corners are ${toHex(corner)}, not the parchment ${PARCHMENT}: the medallion's rim will show it. ` +
        'Fine for a near miss; a scene or a vignette is a regeneration.',
    );
  }
  const scaled = flat.width === args.size ? flat : scaleTo(flat, args.size, args.size);

  const png = new PNG({ width: scaled.width, height: scaled.height });
  png.data = Buffer.from(scaled.data);
  const bytes = PNG.sync.write(png, { deflateLevel: 9 });
  mkdirSync(resolve(args.out), { recursive: true });
  const target = resolve(args.out, `${name}.png`);
  writeFileSync(target, bytes);

  const kb = Math.round(statSync(target).size / 1024);
  // The url is what follows `public/`, wherever that folder is.
  const resolved = resolve(args.out).split(sep).join('/');
  const marker = '/public/';
  const site = resolved.includes(marker)
    ? resolved.slice(resolved.lastIndexOf(marker) + marker.length)
    : resolved;
  console.warn(`wrote ${target} (${scaled.width}x${scaled.height}, ${kb} KB)`);
  if (bytes.length > HEAVY_BYTES) {
    console.warn(
      `Heavy for a flat-shaded bust: ${PORTRAITS} at ${kb} KB would be ${Math.round((kb * PORTRAITS) / 1024)} MB of the 4 MB family. ` +
        'Check the background is flat and the shading has no gradients.',
    );
  }
  console.warn(
    `Put this in src/content/assets/manifest.ts:\n  ${manifestLine(key, `${site}/${name}.png`)}`,
  );
  console.warn('Then: npm run art:validate && npm run build && npm run check:assets');
  return 0;
}

if (process.argv[1]?.endsWith('portrait.ts')) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
