/**
 * Raw generated poses to frames the packer can use.
 *
 *   npx tsx scripts/art/normalise.ts --unit unit.fire.kaya [--key 00ff00|auto]
 *     [--tolerance 70] [--px 128] [--width 1] [--height 0.78] [--out art/normalised]
 *
 * Reads every `art/raw/<unit>/<clip>/<index>.png`, keys the background out,
 * trims to the figure, scales by ONE factor for the whole unit (the idle
 * pose's height becomes `--height` of the frame's baseline, so a crouch
 * does not come out larger than a stand), stands the feet on the baseline
 * and pads to the frame. Writes `art/normalised/<unit>/<clip>/<index>.png`
 * and a report; a frame with a problem is written anyway and named, so the
 * fix is a regeneration and not a guess.
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CLIP_NAMES } from '../../src/content/assets/clips';
import { placeOnBaseline, BASELINE, MARGIN } from './lib/align';
import { readPng, writePng } from './lib/image';
import type { KeyOptions } from './lib/key';
import { DEFAULT_KEY, keyDistance, keyOut } from './lib/key';
import { cornerColor } from './lib/key';
import { toHex } from './lib/image';
import { scaleBy } from './lib/scale';
import { alphaBounds, crop } from './lib/trim';

interface Args {
  unit: string;
  key: string;
  tolerance: number;
  px: number;
  width: number;
  height: number;
  raw: string;
  out: string;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    unit: '',
    key: DEFAULT_KEY.color,
    tolerance: DEFAULT_KEY.tolerance,
    px: 128,
    width: 1,
    height: 0.78,
    raw: 'art/raw',
    out: 'art/normalised',
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!flag?.startsWith('--')) continue;
    const name = flag.slice(2);
    if (value === undefined) throw new Error(`--${name} needs a value`);
    i += 1;
    switch (name) {
      case 'unit':
      case 'key':
      case 'raw':
      case 'out':
        args[name] = value;
        break;
      case 'tolerance':
      case 'px':
      case 'width':
      case 'height':
        args[name] = Number(value);
        if (!Number.isFinite(args[name])) throw new Error(`--${name} must be a number`);
        break;
      default:
        throw new Error(`Unknown option --${name}`);
    }
  }
  if (!args.unit) throw new Error('--unit is required, e.g. --unit unit.fire.kaya');
  return args;
}

/**
 * Every `<clip>/<index>.png` under the unit's raw folder, in clip-table
 * order, and the files that were passed over so a loose name ("Idle A.png",
 * a JPG) is seen rather than silently skipped.
 */
function rawFrames(dir: string): {
  frames: { clip: string; index: number; path: string }[];
  ignored: string[];
} {
  const frames: { clip: string; index: number; path: string }[] = [];
  const ignored: string[] = [];
  for (const clip of CLIP_NAMES) {
    const clipDir = join(dir, clip);
    if (!existsSync(clipDir)) continue;
    for (const file of readdirSync(clipDir).sort()) {
      const match = /^(\d+)\.png$/.exec(file);
      if (!match) {
        ignored.push(`${clip}/${file}`);
        continue;
      }
      frames.push({ clip, index: Number(match[1]), path: join(clipDir, file) });
    }
  }
  return { frames, ignored };
}

export function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  const rawDir = resolve(args.raw, args.unit);
  const { frames, ignored } = rawFrames(rawDir);
  for (const file of ignored) {
    console.log(`  ignored ${file}: frames are <clip>/<index>.png, numbered from 0, PNG only`);
  }
  if (frames.length === 0) {
    console.error(`No frames under ${rawDir}: expected <clip>/<index>.png, e.g. idle/0.png`);
    return 1;
  }

  const keyOptions: KeyOptions = { ...DEFAULT_KEY, color: args.key, tolerance: args.tolerance };
  // A background that is not the key would be kept and the figure cut instead.
  const first = frames[0];
  if (first) {
    const raw = readPng(first.path);
    const distance = keyDistance(raw, keyOptions);
    if (distance > keyOptions.tolerance + keyOptions.feather) {
      console.error(
        `${first.clip}/${first.index}: the corners are ${toHex(cornerColor(raw))}, not ${keyOptions.color} ` +
          `(${Math.round(distance)} apart). Pass --key auto, or --key with the background's colour.`,
      );
      return 1;
    }
  }
  const frameWidth = Math.round(args.px * args.width);
  const frameHeight = Math.round(args.px * 1.5);
  const baseline = Math.round(frameHeight * BASELINE);

  // Key and trim everything first, so the scale can come from the idle pose.
  const keyed = frames.map((frame) => {
    const image = keyOut(readPng(frame.path), keyOptions);
    const bounds = alphaBounds(image);
    return { ...frame, figure: bounds ? crop(image, bounds) : null };
  });
  const idle = keyed.find((f) => f.clip === 'idle' && f.index === 0)?.figure ?? keyed[0]?.figure;
  if (!idle) {
    console.error('Every frame keyed out to nothing. Is --key the background colour?');
    return 1;
  }
  const target = Math.round((baseline - MARGIN) * args.height);
  const scale = Math.min(1, target / idle.height);
  console.log(
    `${args.unit}: ${frames.length} frames, frame ${frameWidth}x${frameHeight}, idle ${idle.width}x${idle.height} px -> scale ${scale.toFixed(4)}`,
  );

  let failures = 0;
  // The filter never scales up, so a small figure lands short in every frame.
  if (idle.height < target) {
    failures += 1;
    console.log(
      `  idle/0: the figure is ${idle.height} px tall and would stand ${target} px in the frame; ` +
        `generate at 4x (512x768 for a one-tile unit) so it can be scaled down, not up`,
    );
  }
  for (const frame of keyed) {
    const outDir = resolve(args.out, args.unit, frame.clip);
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, `${frame.index}.png`);
    if (!frame.figure) {
      failures += 1;
      console.log(`  ${frame.clip}/${frame.index}: EMPTY after keying, skipped`);
      continue;
    }
    const scaled = scale < 1 ? scaleBy(frame.figure, scale) : frame.figure;
    const placed = placeOnBaseline(scaled, frameWidth, frameHeight);
    writePng(outPath, placed.image);
    if (placed.problems.length > 0) {
      failures += 1;
      console.log(`  ${frame.clip}/${frame.index}: ${placed.problems.join('; ')}`);
    } else {
      console.log(`  ${frame.clip}/${frame.index}: ok`);
    }
  }
  console.log(failures ? `${failures} frame(s) need attention.` : 'All frames fit.');
  return failures ? 1 : 0;
}

if (process.argv[1]?.endsWith('normalise.ts')) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
