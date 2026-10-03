import { expect, it, vi } from 'vitest';
import { FOREST_GROUND_ROWS, FOREST_ROAD } from '../../src/content/maps/combat';
import { FOREST_WATER_CELLS } from '../../src/content/scenes/forestRoad';
import { pixelAt } from './lib/image';
import { expectPackerAlpha, expectShippedPin, readShipped } from './lib/shipped-pin';
import { loadForestMaterial } from './forest-village-material';
import {
  FOREST_ROUTE_GROUND,
  FOREST_ROUTE_GROUND_OUTPUT,
  packRouteGround,
} from './forest-route-ground';
import { WINDOW, luma, measure } from './forest-ground-measure';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

/** DL-2 §3: no 128 px window inside a packed plate may span more than this. */
const MAX_WINDOW_SPAN = 1.25;

const material = await loadForestMaterial();
const image = packRouteGround(material);
const shipped = await readShipped(FOREST_ROUTE_GROUND_OUTPUT);

/** Generated 2026-10-03 (see docs/art/forest-ground-composition.md); not packer output. */
const ROUTE_PIN = {
  bytes: 80928,
  sha256: '8b58560d83532a66092ebeabd9476d7a64be60de820f8a2ab7b6e4de6a2a92be',
};

it('ships the generated route plate on the packer footprint, inside the texture cap', async () => {
  expect({ width: image.width, height: image.height }).toEqual({
    width: FOREST_ROUTE_GROUND.width,
    height: FOREST_ROUTE_GROUND.height,
  });
  expect(Math.max(image.width, image.height)).toBeLessThanOrEqual(2048);
  expectShippedPin(FOREST_ROUTE_GROUND_OUTPUT, ROUTE_PIN);
  await expectPackerAlpha(FOREST_ROUTE_GROUND_OUTPUT, image);
});

/** The logical cell a plate pixel lies in. */
function cellOf(px: number, py: number): { x: number; y: number } {
  const dx = (FOREST_ROUTE_GROUND.x + px + 0.5 - 768) / 64,
    dy = (FOREST_ROUTE_GROUND.y + py + 0.5) / 32;
  return { x: Math.floor((dx + dy) / 2), y: Math.floor((dy - dx) / 2) };
}

/**
 * Every check below reads the decoded shipped plate, which is generated art, so
 * none of them can ask for the packer's flat tones. Measured on the shipped file
 * 2026-10-03: verge cells 0.933 green, road cells 0.010 green, 3 near-black
 * pixels in 474,442 opaque, window span 1.236, mean luma 124.4.
 */
it('shows a green verge and an unmistakably non-green road, not one swatch', () => {
  const share = { ',': { n: 0, green: 0 }, '=': { n: 0, green: 0 } };
  for (let py = 0; py < shipped.height; py++)
    for (let px = 0; px < shipped.width; px++) {
      const [r, g, b, a] = pixelAt(shipped, px, py);
      if (a < 200) continue;
      const { x, y } = cellOf(px, py);
      const key = FOREST_GROUND_ROWS[y]?.[x];
      if (key !== ',' && key !== '=') continue;
      share[key].n++;
      if (g > r + 6 && g > b + 12) share[key].green++;
    }
  expect(share[','].n).toBeGreaterThan(100_000);
  expect(share['='].n).toBeGreaterThan(100_000);
  // The Earth family reaches the verges; the old atlas had no green at all.
  expect(share[','].green / share[','].n, 'verge cells are green').toBeGreaterThan(0.9);
  // The road is stone and earth: the green that remains is moss and edge grass.
  expect(share['='].green / share['='].n, 'road cells are not green').toBeLessThan(0.05);
});

it('carries no baked gradient and stays in the village tone band', () => {
  const m = measure(shipped);
  expect(m.span).toBeLessThan(MAX_WINDOW_SPAN);
  expect(m.span).toBeGreaterThan(0);
  expect(m.greenShare).toBeGreaterThan(0.2);
  // `docs/coordination/handoffs/village-ground-tone.md` measured the village's
  // authored ground at `#8d9557`; DL-2 asks the route to sit inside 1.3x of it.
  const village = luma(0x8d, 0x95, 0x57);
  expect(Math.max(village / m.mean, m.mean / village)).toBeLessThan(1.3);
});

it('leaves plain road/verge boundaries uninked and the holes clear', () => {
  // The old procedural plate held exactly zero `#1b1410` ink. Lossy generated
  // art cannot, so the bar is "no ink line": near-black pixels stay a rounding
  // error (3 of 474,442 measured), far under one in two thousand.
  let dark = 0,
    opaque = 0;
  for (let i = 0; i < shipped.data.length; i += 4) {
    if ((shipped.data[i + 3] ?? 0) < 200) continue;
    opaque++;
    if (luma(shipped.data[i] ?? 0, shipped.data[i + 1] ?? 0, shipped.data[i + 2] ?? 0) < 40) dark++;
  }
  expect(dark / opaque, 'near-black ink pixels').toBeLessThan(0.0005);

  const centre = (x: number, y: number) => ({
    px: Math.floor(768 + (x - y) * 64 - FOREST_ROUTE_GROUND.x),
    py: Math.floor((x + y + 1) * 32 - FOREST_ROUTE_GROUND.y),
  });
  for (const cell of FOREST_WATER_CELLS) {
    const { px, py } = centre(cell.x, cell.y);
    expect(pixelAt(shipped, px, py)[3], `water ${cell.x},${cell.y} stays clear`).toBe(0);
  }
  for (let y = 4; y <= 8; y++)
    for (let x = 0; x < FOREST_ROAD.width; x++) {
      if (FOREST_ROAD.rows[y]?.[x] !== '=') continue;
      const { px, py } = centre(x, y);
      expect(pixelAt(shipped, px, py)[3], `road ${x},${y} is opaque`).toBe(255);
    }
});

it('measures windows by their means, so ink and rim do not count as drift', () => {
  expect(WINDOW).toBe(128);
});
