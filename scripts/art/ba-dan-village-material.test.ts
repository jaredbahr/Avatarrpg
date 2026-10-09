import { expect, it } from 'vitest';
import { BA_DAN_VILLAGE } from '../../src/content/maps/village';
import {
  DESIRE_LINES,
  GROUND_TEXEL,
  pavingLip,
  villageBake,
  villageLawnRgb,
  pavingSwatchPoint,
  troddenAt,
  troddenCoverage,
  villageEarthRgb,
  villageGrassRgb,
  villageGroundRgb,
} from './ba-dan-village-material';

/** World pixel of a logical ground point. */
const world = (x: number, y: number): { wx: number; wy: number } => ({
  wx: 1024 + (x - y) * 64,
  wy: (x + y) * 32,
});
const coverageAt = (x: number, y: number): number => {
  const { wx, wy } = world(x, y);
  return troddenCoverage(x, y, wx, wy);
};
const luma = ([r = 0, g = 0, b = 0]: readonly number[]): number =>
  0.299 * r + 0.587 * g + 0.114 * b;

it('samples one deterministic painted grass material on world coordinates', () => {
  expect(GROUND_TEXEL).toBe(1);
  expect(villageGrassRgb(911.5, 417.5)).toEqual(villageGrassRgb(911.5, 417.5));
  // One texel is one world pixel: any point inside it is the same sample.
  expect(villageGrassRgb(910.1, 416.1)).toEqual(villageGrassRgb(910.9, 416.9));
  // Neighbouring pixels are not one flat colour. A single pair can coincide in
  // a painted ramp, so ask it of a row.
  const row = Array.from({ length: 64 }, (_, i) => villageGrassRgb(900.5 + i, 416.5).join(','));
  expect(new Set(row).size, 'neighbouring texels differ').toBeGreaterThan(20);
  // Open lawn, far from any path, is exactly the grass.
  const lawn = world(2.5, 3.5);
  expect(villageGroundRgb(lawn.wx, lawn.wy)).toEqual(villageGrassRgb(lawn.wx, lawn.wy));
  const colours = new Set<string>();
  for (let y = 0; y < 256; y += 8)
    for (let x = 0; x < 256; x += 8) colours.add(villageGrassRgb(x, y).join(','));
  expect(colours.size, 'painted source retains real tonal structure').toBeGreaterThan(100);
  const lumas = [...colours].map((colour) => luma(colour.split(',').map(Number)));
  expect(Math.max(...lumas) - Math.min(...lumas), 'grass stays quieter than scenery').toBeLessThan(
    64,
  );
  const adjacent = Array.from({ length: 128 }, (_, x) => villageGrassRgb(x + 0.5, 96.5));
  expect(
    adjacent.filter((rgb, x) => x > 0 && rgb.join(',') !== adjacent[x - 1]?.join(',')).length,
    'one-pixel blade detail survives sampling',
  ).toBeGreaterThan(80);
});

it('has painted texture at fine scale and no tuft larger than a few pixels', () => {
  // Fine texture: the pixel-to-pixel luma step is small but not flat.
  let steps = 0;
  let total = 0;
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 128; x++) {
      steps += Math.abs(
        luma(villageGrassRgb(2000.5 + x, 500.5 + y)) - luma(villageGrassRgb(2001.5 + x, 500.5 + y)),
      );
      total++;
    }
  expect(steps / total, 'mean one-pixel luma step').toBeGreaterThan(1.2);
  expect(steps / total, 'mean one-pixel luma step').toBeLessThan(6);
  // No oversized motif: the old 12 to 25 px pale star tufts would show as
  // large connected bright regions. Over a 240 x 120 patch, the largest region
  // of pixels 18 levels above the mean is a few pixels across, never 40.
  const width = 240;
  const height = 120;
  const field: number[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) field.push(luma(villageGrassRgb(4000.5 + x, 900.5 + y)));
  const mean = field.reduce((sum, value) => sum + value, 0) / field.length;
  const seen = new Set<number>();
  let largest = 0;
  field.forEach((value, start) => {
    if (value < mean + 18 || seen.has(start)) return;
    let size = 0;
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const at = stack.pop() ?? 0;
      size++;
      const x = at % width;
      const y = Math.floor(at / width);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if ((field[next] ?? 0) >= mean + 18 && !seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    largest = Math.max(largest, size);
  });
  expect(largest, 'largest pale region, in pixels').toBeLessThan(60);
});

it('keeps the enclosed north-door pocket broken, strongest beside paths, grass in the middle', () => {
  // The two-tile pocket (10..12, 4..5) between the north door paths and the
  // row-five cross path. Wear hugs those edges and fades inside the tile; the
  // middle keeps its grass. Sampled along the edges and across the middle,
  // because wear is deliberately patchy and any single point may be a gap.
  let nearEdge = 0;
  let nearEdgeCount = 0;
  let middle = 0;
  let middleMax = 0;
  for (let i = 0; i < 40; i++) {
    const t = 4 + (i + 0.5) / 40;
    nearEdge += coverageAt(10.04, t) + coverageAt(11.96, t);
    nearEdgeCount += 2;
    const s = 10.2 + ((i + 0.5) / 40) * 1.6;
    nearEdge += coverageAt(s, 4.96);
    nearEdgeCount++;
    for (const mid of [
      coverageAt(11, 4.25),
      coverageAt(10.8 + (i % 5) * 0.1, 4.3 + (i % 3) * 0.1),
    ]) {
      middle += mid;
      middleMax = Math.max(middleMax, mid);
    }
  }
  expect(nearEdge / nearEdgeCount, 'wear at the path edges').toBeGreaterThan(0.06);
  expect(middle / 80, 'mean wear mid-pocket').toBeLessThan(0.02);
  expect(middleMax, 'no earth slab through the middle').toBeLessThan(0.1);
});

it('wears by distance to paving, thresholds and stall fronts, never to a tile edge', () => {
  // Along a long paving edge wear forms broken patches: some stretches carry
  // earth and some do not, never a uniform stripe and never none.
  const along: boolean[] = [];
  for (let i = 0; i < 160; i++) {
    const { wx, wy } = world(15.4 + i * 0.05, 9.04);
    along.push(troddenAt(15.4 + i * 0.05, 9.04, wx, wy));
  }
  const worn = along.filter(Boolean).length;
  expect(worn, 'worn stretches').toBeGreaterThan(16);
  expect(worn, 'unworn stretches').toBeLessThan(144);
  // Open lawn is never worn.
  let openLawn = 0;
  for (let i = 0; i < 128; i++) {
    const { wx, wy } = world(2 + (i % 8) * 0.4, 2.2 + Math.floor(i / 8) * 0.1);
    if (troddenAt(2 + (i % 8) * 0.4, 2.2 + Math.floor(i / 8) * 0.1, wx, wy)) openLawn++;
  }
  expect(openLawn).toBe(0);
  // Wear is continuous over tile boundaries: walking across a grass-grass
  // tile edge beside paving, coverage never jumps.
  // (x=13 is a path cell's edge now that the market table has left (13,4): the wear inside
  // a paving cell is hidden under the paving, so only grass-grass edges are held to this.)
  for (const edgeX of [10, 11, 14, 15, 16, 17]) {
    let previous = coverageAt(edgeX - 0.2, 4.97);
    for (let k = 1; k <= 40; k++) {
      const next = coverageAt(edgeX - 0.2 + k * 0.01, 4.97);
      expect(Math.abs(next - previous), `tile edge x=${edgeX}`).toBeLessThan(0.35);
      previous = next;
    }
  }
  expect(villageEarthRgb(200, 300)).not.toEqual(villageGrassRgb(200, 300));
});

it('feathers the irregular earth boundary at one-world-pixel grain', () => {
  // Walk straight across the wear boundary beside the door path at x=9: from
  // the paving edge out into the lawn. Over many rows the boundary has blended
  // paint, finely varied values, and never an abrupt one-pixel jump.
  const values: number[] = [];
  let blended = 0;
  let largestStep = 0;
  for (let row = 0; row < 24; row++) {
    const y = 3.2 + row * 0.07;
    let previous = -1;
    for (let k = 0; k < 40; k++) {
      const x = 9.8 - k * 0.0125;
      const { wx, wy } = world(x, y);
      // Quantise to the world pixel the way a plate does.
      const value = troddenCoverage(x, y, Math.floor(wx) + 0.5, Math.floor(wy) + 0.5);
      values.push(value);
      if (value > 0 && value < 1) blended++;
      if (previous >= 0) largestStep = Math.max(largestStep, Math.abs(value - previous));
      previous = value;
    }
  }
  expect(blended, 'edge contains blended paint').toBeGreaterThan(30);
  expect(new Set(values.map((value) => value.toFixed(3))).size).toBeGreaterThan(8);
  expect(largestStep, 'no ruled one-pixel step').toBeLessThan(0.7);
});

it('reads the paving swatch only from the clean interior of the courtyard plate', () => {
  for (let x = -3; x < 25; x += 0.37)
    for (let y = 0; y < 16; y += 0.41) {
      const point = pavingSwatchPoint(x, y);
      expect(point.x, 'clear of the feathered x5..5.45 columns').toBeGreaterThanOrEqual(5.5);
      expect(point.x).toBeLessThan(10.5);
      expect(point.y, 'clear of the mossy y7 and y9 kerb lines').toBeGreaterThanOrEqual(7.07);
      expect(point.y).toBeLessThan(8.93);
    }
});

it('gives the lawn sparse fine-grain life: flowers, clover, desire lines, never on a tile grid', () => {
  // Flowers are single pixels, pale against the grass; clover is a drift of
  // darker, cooler pixels. Both are a small share of an open lawn.
  let flowers = 0;
  let total = 0;
  const perColumn = new Array<number>(64).fill(0);
  for (let wy = 300; wy < 700; wy++)
    for (let wx = 1200; wx < 1900; wx++) {
      const rgb = villageLawnRgb(wx + 0.5, wy + 0.5);
      const plain = villageGrassRgb(wx + 0.5, wy + 0.5);
      total++;
      if (luma(rgb) > luma(plain) + 40 && rgb[2] > plain[2] + 25) {
        flowers++;
        perColumn[wx % 64] = (perColumn[wx % 64] ?? 0) + 1;
      }
    }
  expect(flowers / total, 'flowers are sparse').toBeLessThan(0.01);
  expect(flowers, 'but there are some').toBeGreaterThan(30);
  // Not aligned to the 64 px tile: no column of the tile holds most of them.
  expect(Math.max(...perColumn) / flowers, 'no tile-aligned column').toBeLessThan(0.12);
  // Desire lines are read from the map and keep to open lawn.
  expect(DESIRE_LINES.length).toBeGreaterThan(3);
  for (const line of DESIRE_LINES)
    for (let i = 0; i <= 20; i++) {
      const x = line.ax + ((line.bx - line.ax) * i) / 20;
      const y = line.ay + ((line.by - line.ay) * i) / 20;
      const key = BA_DAN_VILLAGE.rows[Math.floor(y)]?.[Math.floor(x)];
      // The two ends sit in a stall front's own cell; everything between is open.
      const end = [line.ax, line.bx].some(
        (e, n) =>
          Math.floor(e) === Math.floor(x) && Math.floor(n ? line.by : line.ay) === Math.floor(y),
      );
      if (!end) expect(['B', 'T', 'l', '~', 'W'], `desire line at ${x},${y}`).not.toContain(key);
    }
});

it('darkens and lengthens the grass along structures, not on open lawn', () => {
  // How much darker the lawn is than the plain painted grass in a strip.
  const dark = (x0: number, x1: number, y0: number, y1: number): number => {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < 30; i++)
      for (let k = 0; k < 30; k++) {
        const { wx, wy } = world(x0 + ((x1 - x0) * i) / 30, y0 + ((y1 - y0) * k) / 30);
        sum += luma(villageGrassRgb(wx, wy)) - luma(villageLawnRgb(wx, wy));
        n++;
      }
    return sum / n;
  };
  // A strip along the north-west house's west wall against open lawn two tiles out.
  expect(dark(5.75, 5.95, 1.3, 3.7), 'darker beside the wall').toBeGreaterThan(4);
  // (The bench and rail on the bank stand at row 5, so the strip stops a tile short of them.)
  expect(dark(2.2, 2.6, 2.8, 3.9), 'open lawn keeps the plain grass tone').toBeLessThan(1.5);
});

it('breaks the paving lip softly: dark brown, never a pale green line', () => {
  // The east road's south edge (row 8 against the lawn of row 9, x 15..20):
  // walk inward from the lip over its last few pixels with a pale green input.
  const pale = [196, 208, 150];
  let darker = 0;
  for (let k = 0; k < 6; k++) {
    const { wx, wy } = world(16 + k * 0.37, 8.995);
    if (luma(pavingLip(wx, wy, pale)) < luma(pale) - 8) darker++;
  }
  expect(darker, 'the lip is shaded dark').toBeGreaterThanOrEqual(5);
  // Well inside the paving it is untouched.
  const inside = world(16, 8.5);
  expect(pavingLip(inside.wx, inside.wy, pale)).toEqual(pale);
  // The whole bake is a pure function of the pixel.
  expect(villageBake(1500.5, 500.5, [150, 160, 90])).toEqual(
    villageBake(1500.5, 500.5, [150, 160, 90]),
  );
});
