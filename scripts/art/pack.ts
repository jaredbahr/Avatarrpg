/**
 * Normalised frames to a sheet the game loads.
 *
 *   npx tsx scripts/art/pack.ts --unit unit.fire.kaya [--in art/normalised]
 *     [--out public/art/units] [--name kaya]
 *
 * Lays the unit's frames out with the same `layoutSheet` the runtime baker
 * uses, so a packed sheet and a baked one have the same shape and names,
 * writes `<out>/<name>.png` and `<name>.json` in the TexturePacker hash
 * layout, and prints the manifest `clips` block to paste into
 * `src/content/assets/manifest.ts`.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ClipName } from '../../src/content/assets/clips';
import { CLIP_NAMES } from '../../src/content/assets/clips';
import { atlasJsonText } from '../../src/render/sheets/atlasJson';
import { ASSETS } from '../../src/content/assets/manifest';
import { BAKED_CLIPS } from '../../src/render/sheets/bake';
import { layoutSheet } from '../../src/render/sheets/layout';
import type { Image } from './lib/image';
import { newImage, pixelAt, readPng, setPixel, writePng } from './lib/image';

interface Args {
  unit: string;
  in: string;
  out: string;
  name: string;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { unit: '', in: 'art/normalised', out: 'public/art/units', name: '' };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!flag?.startsWith('--')) continue;
    const name = flag.slice(2);
    if (value === undefined) throw new Error(`--${name} needs a value`);
    i += 1;
    if (name === 'unit' || name === 'in' || name === 'out' || name === 'name') args[name] = value;
    else throw new Error(`Unknown option --${name}`);
  }
  if (!args.unit) throw new Error('--unit is required, e.g. --unit unit.fire.kaya');
  if (!args.name) args.name = args.unit.split('.').pop() ?? args.unit;
  return args;
}

function blit(target: Image, source: Image, x0: number, y0: number): void {
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) setPixel(target, x0 + x, y0 + y, pixelAt(source, x, y));
  }
}

export function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  const inDir = resolve(args.in, args.unit);
  if (!existsSync(inDir)) {
    console.error(`Nothing under ${inDir}: run normalise first.`);
    return 1;
  }

  const frames = new Map<string, Image>();
  const counts: Partial<Record<ClipName, number>> = {};
  let frameWidth = 0;
  let frameHeight = 0;
  for (const clip of CLIP_NAMES) {
    const clipDir = join(inDir, clip);
    if (!existsSync(clipDir)) continue;
    const files = readdirSync(clipDir)
      .filter((f) => /^\d+\.png$/.test(f))
      .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
    files.forEach((file, index) => {
      if (Number.parseInt(file, 10) !== index) {
        throw new Error(`${clip}: frames must be numbered from 0 without gaps; found ${file}`);
      }
      const image = readPng(join(clipDir, file));
      if (frameWidth === 0) {
        frameWidth = image.width;
        frameHeight = image.height;
      } else if (image.width !== frameWidth || image.height !== frameHeight) {
        throw new Error(
          `${clip}/${index} is ${image.width}x${image.height}; the sheet's frames are ${frameWidth}x${frameHeight}`,
        );
      }
      frames.set(`${args.unit}/${clip}/${index}`, image);
    });
    if (files.length > 0) counts[clip] = files.length;
  }
  if (frames.size === 0) {
    console.error(`No frames under ${inDir}.`);
    return 1;
  }

  const layout = layoutSheet(args.unit, counts, frameWidth, frameHeight);
  const atlas = newImage(layout.width, layout.height);
  for (const [name, frame] of layout.frames) {
    const image = frames.get(name);
    if (image) blit(atlas, image, frame.x, frame.y);
  }

  mkdirSync(resolve(args.out), { recursive: true });
  const pngPath = resolve(args.out, `${args.name}.png`);
  const jsonPath = resolve(args.out, `${args.name}.json`);
  writePng(pngPath, atlas);
  writeFileSync(
    jsonPath,
    `${atlasJsonText(layout.frames, `${args.name}.png`, layout.width, layout.height)}\n`,
  );

  const pixelsPerTile = frameHeight / 1.5;
  // The manifest already knows the unit's palette; print it rather than a blank to fill.
  const current = ASSETS[args.unit];
  const palette =
    current && 'palette' in current && current.palette ? current.palette : '<element>';
  const site = resolve(args.out).replace(`${resolve('public')}/`, '');
  console.log(`wrote ${pngPath} (${layout.width}x${layout.height}) and ${jsonPath}`);
  console.log(`\nManifest entry for src/content/assets/manifest.ts:\n`);
  const clipLines = (Object.entries(layout.clips) as [ClipName, string[]][]).map(
    ([clip, names]) => {
      const timing =
        clip === 'walkNorth' || clip === 'walkSouth'
          ? { fps: 4, loop: true }
          : clip === 'idleNorth' || clip === 'idleSouth'
            ? { fps: 1, loop: true }
            : BAKED_CLIPS[clip];
      return `      ${clip}: { frames: ${JSON.stringify(names)}, fps: ${timing.fps}, loop: ${timing.loop} },`;
    },
  );
  console.log(
    [
      `  '${args.unit}': {`,
      `    kind: 'sheet',`,
      `    atlas: '${site}/${args.name}.json',`,
      `    pixelsPerTile: ${pixelsPerTile},`,
      `    footprint: { w: ${Math.round(frameWidth / pixelsPerTile)}, h: 1 },`,
      `    anchor: { x: 0.5, y: 0.85 },`,
      `    facing: 'mirror',`,
      `    palette: '${palette}',`,
      `    clips: {`,
      ...clipLines,
      `    },`,
      `  },`,
    ].join('\n'),
  );
  return 0;
}

if (process.argv[1]?.endsWith('pack.ts')) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
