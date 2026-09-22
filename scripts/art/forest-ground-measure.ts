/**
 * Measure a shipped ground plate against the DL-2 ground-language contract.
 *
 * Three numbers, all read off the pixels the game actually ships:
 *
 * 1. **Window span.** A baked gradient or a distance haze is a *low frequency*
 *    change across the plate, so it is read with window means, not per-pixel
 *    extremes: every 128x128 window whose opaque coverage is at least half is
 *    reduced to one mean luminance, and the plate's span is the ratio of the
 *    brightest such window to the darkest. Ink lines and rim lights live inside
 *    a window and must not count against it — they are the look, not the drift.
 *    The contract in `SUBSYSTEMS/dl2-ground-language-plan.md` §3 is <= 1.25x.
 * 2. **Plate mean**, over opaque pixels, for the cross-scene 1.3x tone band.
 * 3. **Earth-family green share**: the fraction of opaque pixels whose green
 *    channel leads both others by a margin, so a verge that has gone ochre is
 *    visible as a number rather than as an opinion.
 *
 *   npx tsx scripts/art/forest-ground-measure.ts <plate.webp|png> [more...]
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init as initWebpDecode } from '@jsquash/webp/decode.js';
import { readImage, toHex } from './lib/image';
import type { Image } from './lib/image';

/** Rec. 709 luma on the stored sRGB bytes, the same weighting the art docs use. */
export function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Opaque enough to be this plate's own painting rather than its feather. */
export const OPAQUE = 200;
export const WINDOW = 128;
/** Windows are stepped, not tiled, so a gradient cannot hide between them. */
export const STEP = 32;

export interface Measurement {
  readonly opaque: number;
  readonly mean: number;
  readonly meanHex: string;
  readonly span: number;
  readonly brightest: { x: number; y: number; mean: number } | null;
  readonly darkest: { x: number; y: number; mean: number } | null;
  readonly greenShare: number;
}

export function measure(image: Image): Measurement {
  let opaque = 0;
  let sum = 0;
  let sr = 0,
    sg = 0,
    sb = 0;
  let green = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    if ((image.data[i + 3] ?? 0) < OPAQUE) continue;
    const r = image.data[i] ?? 0,
      g = image.data[i + 1] ?? 0,
      b = image.data[i + 2] ?? 0;
    opaque++;
    sum += luma(r, g, b);
    sr += r;
    sg += g;
    sb += b;
    if (g > r + 6 && g > b + 12) green++;
  }
  let brightest: { x: number; y: number; mean: number } | null = null;
  let darkest: { x: number; y: number; mean: number } | null = null;
  for (let y = 0; y + WINDOW <= image.height; y += STEP)
    for (let x = 0; x + WINDOW <= image.width; x += STEP) {
      let count = 0,
        total = 0;
      for (let wy = 0; wy < WINDOW; wy++) {
        const row = (y + wy) * image.width;
        for (let wx = 0; wx < WINDOW; wx++) {
          const i = (row + x + wx) * 4;
          if ((image.data[i + 3] ?? 0) < OPAQUE) continue;
          count++;
          total += luma(image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0);
        }
      }
      // A window that is mostly feather or mostly hole is not a sample of the
      // plate's tone; half coverage is the bar the other ground passes used.
      if (count < (WINDOW * WINDOW) / 2) continue;
      const mean = total / count;
      if (!brightest || mean > brightest.mean) brightest = { x, y, mean };
      if (!darkest || mean < darkest.mean) darkest = { x, y, mean };
    }
  return {
    opaque,
    mean: opaque ? sum / opaque : 0,
    meanHex: opaque ? toHex([sr / opaque, sg / opaque, sb / opaque]) : '#000000',
    span: brightest && darkest && darkest.mean > 0 ? brightest.mean / darkest.mean : 0,
    brightest,
    darkest,
    greenShare: opaque ? green / opaque : 0,
  };
}

let decoderReady: Promise<void> | null = null;

export async function readPlate(path: string): Promise<Image> {
  if (!path.endsWith('.webp')) return readImage(path);
  if (!decoderReady) {
    const require = createRequire(import.meta.url);
    const wasm = readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'));
    decoderReady = WebAssembly.compile(wasm).then((module) => initWebpDecode(module));
  }
  await decoderReady;
  const bytes = readFileSync(path);
  const decoded = await decode(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  return { width: decoded.width, height: decoded.height, data: new Uint8Array(decoded.data) };
}

if (process.argv[1]?.endsWith('forest-ground-measure.ts')) {
  for (const path of process.argv.slice(2)) {
    const image = await readPlate(path);
    const m = measure(image);
    const place = (w: { x: number; y: number; mean: number } | null): string =>
      w ? `${w.mean.toFixed(1)} @ ${w.x},${w.y}` : 'none';
    console.log(
      [
        path,
        `  ${image.width}x${image.height}, ${m.opaque} opaque px`,
        `  mean luma ${m.mean.toFixed(1)}  mean colour ${m.meanHex}`,
        `  window span ${m.span.toFixed(3)}x  brightest ${place(m.brightest)}  darkest ${place(m.darkest)}`,
        `  earth-green share ${(m.greenShare * 100).toFixed(1)}%`,
      ].join('\n'),
    );
  }
}
