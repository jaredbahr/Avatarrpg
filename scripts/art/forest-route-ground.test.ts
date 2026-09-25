import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import { FOREST_WATER_CELLS } from '../../src/content/scenes/forestRoad';
import { pixelAt, toHex } from './lib/image';
import { encodeWebp } from './lib/webp';
import {
  FOREST_GROUND_QUALITY,
  FOREST_GROUND_TONES,
  FOREST_PIECE_TONES,
  loadForestMaterial,
} from './forest-village-material';
import { SPILL, spillDepth } from './forest-rubble';
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

it('paints only the three named materials, the heap spill and their rims', () => {
  const allowed = new Set<string>();
  for (const tone of Object.values(FOREST_GROUND_TONES))
    for (const hex of Object.values(tone)) allowed.add(hex);
  const spill = new Set<string>(Object.values(FOREST_PIECE_TONES.spill));
  const seen = new Set<string>();
  let strayed = 0;
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const i = (py * image.width + px) * 4;
      if ((image.data[i + 3] ?? 0) === 0) continue;
      const hex = toHex([image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0]);
      seen.add(hex);
      if (!spill.has(hex) || allowed.has(hex)) continue;
      // The spill is the rubble heaps' own ground and lies only round them.
      const wx = FOREST_ROUTE_GROUND.x + px + 0.5,
        wy = FOREST_ROUTE_GROUND.y + py + 0.5;
      const dx = (wx - 768) / 64,
        dy = wy / 32;
      if (spillDepth((dx + dy) / 2, (dy - dx) / 2) <= -SPILL.feather) strayed++;
    }
  // Flat tones only: a colour outside the table would be the continuous tone a
  // gradient or a distance haze needs in order to exist.
  expect([...seen].filter((hex) => !allowed.has(hex) && !spill.has(hex))).toEqual([]);
  expect(strayed, 'spill painted away from a heap').toBe(0);
  // All three materials are actually used, so the plane is not one swatch.
  for (const hex of [
    FOREST_GROUND_TONES.road.base,
    FOREST_GROUND_TONES.wear.base,
    FOREST_GROUND_TONES.verge.base,
    FOREST_PIECE_TONES.spill.base,
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

it('leaves plain road/verge boundaries uninked and the holes clear', () => {
  const ink = toHex([0x1b, 0x14, 0x10]);
  let inked = 0;
  const centre = (x: number, y: number) => ({
    px: Math.floor(768 + (x - y) * 64 - FOREST_ROUTE_GROUND.x),
    py: Math.floor((x + y + 1) * 32 - FOREST_ROUTE_GROUND.y),
  });
  for (let i = 0; i < image.data.length; i += 4)
    if (toHex([image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0]) === ink)
      inked++;
  // The pond, shelf and rubble carry their own gameplay-boundary art.
  expect(inked).toBe(0);

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
