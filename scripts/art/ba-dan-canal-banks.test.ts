import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init } from '@jsquash/webp/decode.js';
import { expect, it } from 'vitest';
import {
  BA_DAN_CANAL_BANK_RADIUS,
  BA_DAN_CANAL_BANKS,
  BA_DAN_WATER_CELLS,
} from '../../src/content/scenes/baDan';
import { pixelAt } from './lib/image';
import type { Image } from './lib/image';
import { encodeWebp } from './lib/webp';
import {
  BED_MOTTLE,
  BED_SHADE,
  BED_SHELF,
  bedShade,
  canalInset,
  canalMetric,
  canalPosition,
  kerbShade,
  packCanalBanks,
  pavingAt,
  OUTPUT,
  SOURCE,
  WET_RIM,
} from './ba-dan-canal-banks';

const cells = BA_DAN_CANAL_BANKS;

async function decodeWebp(bytes: Buffer): Promise<Image> {
  const require = createRequire(import.meta.url);
  await init(
    await WebAssembly.compile(
      readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm')),
    ),
  );
  // A copy, so the decoder is handed a plain `ArrayBuffer` instead of a view of
  // the file buffer, which the type system can only call `ArrayBufferLike`.
  const view = new Uint8Array(bytes.byteLength);
  view.set(bytes);
  const decoded = await decode(view.buffer);
  return { width: decoded.width, height: decoded.height, data: new Uint8Array(decoded.data) };
}

/** World pixel of a water cell's diamond centre inside this plate. */
function cellCentre(cell: { x: number; y: number }): { px: number; py: number } {
  return {
    px: 1024 + (cell.x - cell.y) * 64 - cells.x,
    py: (cell.x + cell.y + 1) * 32 - cells.y,
  };
}

function luma(pixel: readonly number[]): number {
  return (pixel[0] ?? 0) * 0.3 + (pixel[1] ?? 0) * 0.55 + (pixel[2] ?? 0) * 0.15;
}

function chroma(pixel: readonly number[]): number {
  return Math.max(...pixel.slice(0, 3)) - Math.min(...pixel.slice(0, 3));
}

it('reads a water cell as one tile diamond, not its screen-space bounding box', () => {
  for (const cell of BA_DAN_WATER_CELLS) {
    const corner = { x: cell.x + 0.5, y: cell.y + 0.5 };
    const at = (u: number, v: number): number => canalMetric(corner.x + u, corner.y + v);
    expect(at(0, 0)).toBe(0);
    // Half a cell out is the diamond's own vertex; a whole cell out across the
    // channel is the next cell's centre. An L1 sum in this rotated space would
    // call 0.6 a water pixel in both cases, which is the screen-space
    // bounding-box bug this guards.
    expect(at(0.5, 0)).toBe(1);
    expect(at(0, 0.5)).toBe(1);
    expect(at(0.5, 0.5)).toBe(1);
    expect(at(0, 0.6)).toBeCloseTo(1.2, 6);
    // Across the channel is always dry ground; along it, the next cell is water.
    expect(at(0, 1)).toBe(2);
    const along = BA_DAN_WATER_CELLS.some((other) => other.x === cell.x + 1 && other.y === cell.y);
    expect(at(1, 0)).toBe(along ? 0 : 2);
  }
  // Every diamond centre lands on a plate pixel inside the packed envelope.
  for (const cell of BA_DAN_WATER_CELLS) {
    const { px, py } = cellCentre(cell);
    expect(px).toBeGreaterThan(0);
    expect(py).toBeGreaterThan(0);
    expect(px).toBeLessThan(cells.width);
    expect(py).toBeLessThan(cells.height);
    const { x, y } = canalPosition(px, py);
    // The cell's centre falls on a pixel's own corner, so the pixel that carries
    // it sits half a pixel away: well inside the diamond, at its deepest.
    expect(canalMetric(x, y)).toBeLessThan(0.03);
  }
});

it('packs the canal bed and kerb reproducibly from the tracked courtyard paving', async () => {
  const source = await decodeWebp(readFileSync(SOURCE));
  const { image, bedPixels, kerbPixels, wetRimPixels, deepestShade } = packCanalBanks(source);
  expect(image.width).toBe(cells.width);
  expect(image.height).toBe(cells.height);
  const packed = readFileSync(OUTPUT);
  expect(Buffer.from(await encodeWebp(image, 88, true))).toEqual(packed);

  /*
   * The plate's own file has to carry the same bed: decode what ships rather
   * than trusting the in-memory pack, because the runtime reads the file.
   */
  const shipped = await decodeWebp(packed);
  let clearWater = 0;
  let leaksOutside = 0;
  let shadeMismatch = 0;
  let sampled = 0;
  for (let py = 0; py < cells.height; py++)
    for (let px = 0; px < cells.width; px++) {
      const { x, y } = canalPosition(px, py);
      const metric = canalMetric(x, y);
      const alpha = pixelAt(shipped, px, py)[3];
      if (metric <= 1) {
        if (alpha !== 255) clearWater++;
        continue;
      }
      if (metric > BA_DAN_CANAL_BANK_RADIUS && alpha !== 0) leaksOutside++;
    }
  expect({ clearWater, leaksOutside }).toEqual({ clearWater: 0, leaksOutside: 0 });

  /*
   * Nothing on the bed is a new colour: every channel pixel is the courtyard's
   * own paving pixel scaled by one shade and the water's own red/blue shift, so
   * the shades implied by its channels have to agree.
   */
  for (let py = 0; py < cells.height; py += 3)
    for (let px = 0; px < cells.width; px += 3) {
      const { x, y } = canalPosition(px, py);
      if (canalMetric(x, y) > 1) continue;
      const paving = pavingAt(source, x, y);
      const bed = pixelAt(image, px, py);
      if ((paving[1] ?? 0) < 64 || (paving[0] ?? 0) < 64) continue;
      const fromGreen = (bed[1] ?? 0) / (paving[1] ?? 1);
      // `BED_COOL` red ×0.88, blue ×1.12: the same shade read off each channel
      // has to land together once those shifts are divided back out.
      const fromRed = (bed[0] ?? 0) / ((paving[0] ?? 1) * 0.88);
      const fromBlue = (bed[2] ?? 0) / ((paving[2] ?? 1) * 1.12);
      sampled++;
      if (
        Math.abs(fromGreen - fromRed) > 0.05 ||
        Math.abs(fromGreen - fromBlue) > 0.05 ||
        fromGreen < 0.2 ||
        fromGreen > 1
      )
        shadeMismatch++;
    }
  expect(sampled).toBeGreaterThan(500);
  expect(shadeMismatch).toBe(0);

  // Every permanent water cell is opaque bed; the six diamonds are the whole bed.
  expect(bedPixels).toBe(BA_DAN_WATER_CELLS.length * 4096);
  expect(kerbPixels).toBeGreaterThan(bedPixels * 0.5);
  expect(wetRimPixels).toBeGreaterThan(0);
  // The deepest point of the channel is the shelf minus its full shade, plus or
  // minus the seeded mottle — never some other value the shading never reaches.
  expect(deepestShade).toBeGreaterThan(BED_SHELF - BED_SHADE - BED_MOTTLE - 0.02);
  expect(deepestShade).toBeLessThan(BED_SHELF - BED_SHADE + BED_MOTTLE + 0.02);
});

it('shades the middle of the channel deeper than its shelf under the kerb', async () => {
  const inset = canalInset(cells.width, cells.height);
  const shipped = await decodeWebp(readFileSync(OUTPUT));
  for (const cell of BA_DAN_WATER_CELLS) {
    const { px, py } = cellCentre(cell);
    const middle = inset[py * cells.width + px] ?? 0;
    // The cell's northern vertex sits on the waterline, where the shelf is.
    const edge = inset[(py - 32) * cells.width + px] ?? 0;
    expect(middle).toBeGreaterThan(edge + 20);
    expect(bedShade(cell.x + 0.5, cell.y + 0.5, middle)).toBeLessThan(
      bedShade(cell.x + 0.5, cell.y + 0.5, edge),
    );
    // And the packed plate carries that gradient through to the pixels.
    const shelf = pixelAt(shipped, px, py - 26);
    const deepest = pixelAt(shipped, px, py);
    expect(shelf[3]).toBe(255);
    expect(deepest[3]).toBe(255);
    expect(luma(shelf)).toBeGreaterThan(luma(deepest) + 15);
  }
});

it('dresses the kerb as its own wet stone and keeps the outer edge dry', () => {
  const wet = kerbShade(0);
  const dry = kerbShade(BA_DAN_CANAL_BANK_RADIUS - 1);
  expect(wet.wetness).toBeCloseTo(1, 6);
  expect(dry.wetness).toBeCloseTo(0, 6);
  expect(wet.shade).toBeLessThan(dry.shade);
  let previous = 0;
  for (let step = 0; step <= 20; step++) {
    const { shade } = kerbShade((step / 20) * (BA_DAN_CANAL_BANK_RADIUS - 1));
    expect(shade).toBeGreaterThanOrEqual(previous);
    previous = shade;
  }
});

it('dresses the coping as its own stone: greyer than the paving, darker when wet', async () => {
  const shipped = await decodeWebp(readFileSync(OUTPUT));
  const source = await decodeWebp(readFileSync(SOURCE));
  let dressed = 0;
  let samples = 0;
  let wetLuma = 0;
  let dryLuma = 0;
  let wetCount = 0;
  let dryCount = 0;
  for (let py = 0; py < cells.height; py++)
    for (let px = 0; px < cells.width; px++) {
      const { x, y } = canalPosition(px, py);
      const edge = canalMetric(x, y) - 1;
      if (edge <= 0) continue;
      const plate = pixelAt(shipped, px, py);
      if (plate[3] !== 255) continue;
      // `pavingAt` is the plate's own source position, so a kerb pixel has to be
      // that pixel with its saturation pulled toward grey.
      const from = pavingAt(source, x, y);
      samples++;
      if (chroma(plate) < chroma(from) * 0.95) dressed++;
      if (edge <= WET_RIM) {
        wetLuma += luma(plate);
        wetCount++;
      } else if (edge > BA_DAN_CANAL_BANK_RADIUS - 1 - WET_RIM) {
        dryLuma += luma(plate);
        dryCount++;
      }
    }
  expect(samples).toBeGreaterThan(1000);
  expect(dressed).toBeGreaterThan(samples * 0.6);
  expect(wetCount).toBeGreaterThan(0);
  expect(dryCount).toBeGreaterThan(0);
  expect(wetLuma / wetCount).toBeLessThan(dryLuma / dryCount);
});
