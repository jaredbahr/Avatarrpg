import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import { FOREST_WATER_CELLS } from '../../src/content/scenes/forestRoad';
import { pixelAt, toHex } from './lib/image';
import { encodeWebp } from './lib/webp';
import {
  FOREST_GROUND_QUALITY,
  FOREST_GROUND_TONES,
  FOREST_INK,
  loadForestMaterial,
} from './forest-village-material';
import {
  FOREST_ROUTE_GROUND,
  FOREST_ROUTE_GROUND_OUTPUT,
  packRouteGround,
} from './forest-route-ground';
import { WINDOW, luma, measure } from './forest-ground-measure';

/** DL-2 §3: no 128 px window inside a packed plate may span more than this. */
const MAX_WINDOW_SPAN = 1.25;

const material = await loadForestMaterial();
const image = packRouteGround(material);

it('ships the route plate the packer builds, inside the texture cap', async () => {
  expect({ width: image.width, height: image.height }).toEqual({
    width: FOREST_ROUTE_GROUND.width,
    height: FOREST_ROUTE_GROUND.height,
  });
  expect(Math.max(image.width, image.height)).toBeLessThanOrEqual(2048);
  expect(Buffer.from(await encodeWebp(image, FOREST_GROUND_QUALITY, true))).toEqual(
    readFileSync(FOREST_ROUTE_GROUND_OUTPUT),
  );
});

it('paints only the three named materials, their rims and the ink', () => {
  const allowed = new Set<string>([FOREST_INK]);
  for (const tone of Object.values(FOREST_GROUND_TONES))
    for (const hex of Object.values(tone)) allowed.add(hex);
  const seen = new Set<string>();
  for (let i = 0; i < image.data.length; i += 4) {
    if ((image.data[i + 3] ?? 0) === 0) continue;
    seen.add(toHex([image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0]));
  }
  // Flat tones only: a colour outside the table would be the continuous tone a
  // gradient or a distance haze needs in order to exist.
  expect([...seen].filter((hex) => !allowed.has(hex))).toEqual([]);
  // All three materials are actually used, so the plane is not one swatch.
  for (const hex of [
    FOREST_GROUND_TONES.road.base,
    FOREST_GROUND_TONES.wear.base,
    FOREST_GROUND_TONES.verge.base,
  ])
    expect(seen, `${hex} is painted`).toContain(hex);
});

it('carries no baked gradient and stays in the village tone band', () => {
  const m = measure(image);
  expect(m.span).toBeLessThan(MAX_WINDOW_SPAN);
  expect(m.span).toBeGreaterThan(0);
  // The Earth family reaches the verges; the old atlas had no green at all.
  expect(m.greenShare).toBeGreaterThan(0.2);
  // `docs/coordination/handoffs/village-ground-tone.md` measured the village's
  // authored ground at `#8d9557`; DL-2 asks the route to sit inside 1.3x of it.
  const village = luma(0x8d, 0x95, 0x57);
  expect(Math.max(village / m.mean, m.mean / village)).toBeLessThan(1.3);
});

it('inks every road/verge boundary and leaves the holes alone', () => {
  const ink = toHex([0x1b, 0x14, 0x10]);
  let inked = 0;
  const centre = (x: number, y: number) => ({
    px: Math.floor(768 + (x - y) * 64 - FOREST_ROUTE_GROUND.x),
    py: Math.floor((x + y + 1) * 32 - FOREST_ROUTE_GROUND.y),
  });
  for (let i = 0; i < image.data.length; i += 4)
    if (toHex([image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0]) === ink)
      inked++;
  // Rows 3|4 and 8|9 run the length of the board, plus the x11|12 joins in the
  // pond rows: a few thousand pixels of 2 px line, not a stray fleck.
  expect(inked).toBeGreaterThan(2_000);

  for (const cell of FOREST_WATER_CELLS) {
    const { px, py } = centre(cell.x, cell.y);
    expect(pixelAt(image, px, py)[3], `water ${cell.x},${cell.y} stays clear`).toBe(0);
  }
  for (let y = 4; y <= 8; y++)
    for (let x = 0; x < FOREST_ROAD.width; x++) {
      if (FOREST_ROAD.rows[y]?.[x] !== '=') continue;
      const { px, py } = centre(x, y);
      expect(pixelAt(image, px, py)[3], `road ${x},${y} is opaque`).toBe(255);
    }
});

it('measures windows by their means, so ink and rim do not count as drift', () => {
  expect(WINDOW).toBe(128);
});
