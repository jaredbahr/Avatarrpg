import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import {
  BA_DAN_CANAL_BANK_RADIUS,
  BA_DAN_CANAL_BANKS,
  BA_DAN_WATER_CELLS,
} from '../../src/content/scenes/baDan';
import { pixelAt } from './lib/image';
import { decodeWebp } from './lib/webp';
import { bedShade, canalInset, canalMetric, canalPosition, kerbShade } from './ba-dan-canal-banks';
import { packWater, readMaster, shippedPath } from './ba-dan-water';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const cells = BA_DAN_CANAL_BANKS;

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

it('ships the painted canal plate: the master, encoded, with the geometric footprint', async () => {
  const master = readMaster('canal-banks');
  expect(master.width).toBe(cells.width);
  expect(master.height).toBe(cells.height);
  const packed = readFileSync(shippedPath('canal-banks'));
  expect(Buffer.from(await packWater('canal-banks'))).toEqual(packed);

  // The runtime reads the file, so hold the decoded pixels to the metric.
  const shipped = await decodeWebp(packed);
  let clearWater = 0;
  let leaksOutside = 0;
  let shorelineBand = 0;
  let bedPixels = 0;
  for (let py = 0; py < cells.height; py++)
    for (let px = 0; px < cells.width; px++) {
      const { x, y } = canalPosition(px, py);
      const metric = canalMetric(x, y);
      const alpha = pixelAt(shipped, px, py)[3];
      if (metric <= 1) {
        bedPixels++;
        if (alpha !== 255) clearWater++;
        continue;
      }
      if (metric > BA_DAN_CANAL_BANK_RADIUS && alpha !== 0) leaksOutside++;
      if (metric <= BA_DAN_CANAL_BANK_RADIUS && alpha === 255) shorelineBand++;
    }
  expect({ clearWater, leaksOutside }).toEqual({ clearWater: 0, leaksOutside: 0 });
  // Every permanent water cell is opaque painted water; the six diamonds are the whole bed.
  expect(bedPixels).toBe(BA_DAN_WATER_CELLS.length * 4096);
  expect(shorelineBand).toBeGreaterThan(bedPixels * 0.5);
});

it('paints water, not paving: each cell centre is cool and the shoreline band is not', async () => {
  const shipped = await decodeWebp(readFileSync(shippedPath('canal-banks')));
  for (const cell of BA_DAN_WATER_CELLS) {
    const { px, py } = cellCentre(cell);
    const water = pixelAt(shipped, px, py);
    // Blue over red: a flat blue-green wash on warm paving reads the other way.
    expect((water[2] ?? 0) - (water[0] ?? 0)).toBeGreaterThan(30);
  }
});

it('shades the middle of the channel deeper than its shelf under the kerb', async () => {
  const inset = canalInset(cells.width, cells.height);
  const shipped = await decodeWebp(readFileSync(shippedPath('canal-banks')));
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
