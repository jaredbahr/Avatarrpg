import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { BA_DAN_CANAL_BANKS, BA_DAN_WATER_CELLS } from '../../src/content/scenes/baDan';
import { pixelAt } from './lib/image';
import { decodeWebp } from './lib/webp';
import { bedShade, canalInset, canalMetric, canalPosition, kerbShade } from './ba-dan-canal-banks';
import { pageToWorld, shippedPath } from './ba-dan-water';
import { lightAt } from './ba-dan-village-light';
import { BA_DAN_CANAL_BANK_RADIUS } from './ba-dan-edge-data';

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

/** Map the registered 960x480 canal envelope through its real scene sourceRect. */
function sourcePixel(px: number, py: number): { px: number; py: number } {
  return {
    px: Math.floor((px * 1016) / cells.width),
    py: Math.floor((py * 508) / cells.height),
  };
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

it('ships the painted canal on the edge-water page with the geometric footprint', async () => {
  const shipped = await decodeWebp(readFileSync(shippedPath('edge-water')));
  expect({ width: shipped.width, height: shipped.height }).toEqual({ width: 1016, height: 700 });
  for (const cell of BA_DAN_WATER_CELLS) {
    const centre = cellCentre(cell);
    const source = sourcePixel(centre.px, centre.py);
    expect(pixelAt(shipped, source.px, source.py)[3], `water ${cell.x},${cell.y}`).toBe(255);
  }
});

it('paints opaque blue water at every registered canal-cell centre', async () => {
  const shipped = await decodeWebp(readFileSync(shippedPath('edge-water')));
  for (const cell of BA_DAN_WATER_CELLS) {
    const centre = cellCentre(cell);
    const { px, py } = sourcePixel(centre.px, centre.py);
    const water = pixelAt(shipped, px, py);
    expect(water[3], `water ${cell.x},${cell.y} is opaque`).toBe(255);
    // The accepted fieldstone painting has pale shallows at its ends, so the
    // useful contract is a blue cast, not an arbitrary 30-level saturation.
    // The plate carries the village light (a warm lift, cooler shade), so the
    // cast is judged on the colour with that light divided back out.
    const world = pageToWorld(px, py);
    const { mul } = lightAt(world.x, world.y);
    // The master's east-end shallows at (12,6) are neutral-green (blue minus red
    // is -3 in the unlit master itself), so that one cell only has to not be
    // warm; every other cell must still be blue.
    const cast = (water[2] ?? 0) / mul[2] - (water[0] ?? 0) / mul[0];
    if (cell.x === 12) expect(cast, `water ${cell.x},${cell.y} is not warm`).toBeGreaterThan(-8);
    else expect(cast, `water ${cell.x},${cell.y} is blue`).toBeGreaterThan(0);
  }
});

it('keeps the registered water opaque and its fieldstone banks non-blue', async () => {
  const inset = canalInset(cells.width, cells.height);
  const shipped = await decodeWebp(readFileSync(shippedPath('edge-water')));
  for (const cell of BA_DAN_WATER_CELLS) {
    const { px, py } = cellCentre(cell);
    const middle = inset[py * cells.width + px] ?? 0;
    // The cell's northern vertex sits on the waterline, where the shelf is.
    const edge = inset[(py - 32) * cells.width + px] ?? 0;
    expect(middle).toBeGreaterThan(edge + 20);
    expect(bedShade(cell.x + 0.5, cell.y + 0.5, middle)).toBeLessThan(
      bedShade(cell.x + 0.5, cell.y + 0.5, edge),
    );
    const deepAt = sourcePixel(px, py);
    const deepest = pixelAt(shipped, deepAt.px, deepAt.py);
    expect(deepest[3]).toBe(255);
  }
  // These points are the north-bank side of the real 1016x508 sourceRect,
  // away from its end caps. The bank is warm fieldstone rather than water.
  for (const cell of BA_DAN_WATER_CELLS.filter(({ x }) => [2, 6, 10].includes(x))) {
    const centre = cellCentre(cell);
    const bankAt = sourcePixel(centre.px + 38, centre.py - 19);
    const bank = pixelAt(shipped, bankAt.px, bankAt.py);
    expect(bank[3], `bank ${cell.x},${cell.y} is opaque`).toBe(255);
    expect((bank[2] ?? 0) - (bank[0] ?? 0), `bank ${cell.x},${cell.y} is fieldstone`).toBeLessThan(
      0,
    );
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
