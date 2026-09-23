import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FOREST_RUBBLE_CELLS } from '../../src/content/scenes/forestRoad';
import { toHex } from './lib/image';
import { encodeWebp } from './lib/webp';
import {
  FOREST_GROUND_QUALITY,
  FOREST_GROUND_TONES,
  FOREST_INK,
  FOREST_PIECE_TONES,
  loadForestMaterial,
} from './forest-village-material';
import {
  FOREST_RUBBLE_OUTPUT,
  FOREST_RUBBLE_PLATE,
  RUBBLE_BED,
  packRubble,
  rubbleChunks,
} from './forest-rubble';
import { measure } from './forest-ground-measure';

const material = await loadForestMaterial();
const image = packRubble(material);
const opaqueAt = (px: number, py: number): boolean =>
  (image.data[(py * image.width + px) * 4 + 3] ?? 0) > 0;

it('ships the rubble plate the packer builds, at its registered size', async () => {
  // The two placements in `forestRoad.ts` scale this plate into their own
  // cells, so its size is registration: changing it would move the heaps.
  expect({ width: image.width, height: image.height }).toEqual({
    width: FOREST_RUBBLE_PLATE.width,
    height: FOREST_RUBBLE_PLATE.height,
  });
  expect(FOREST_RUBBLE_CELLS).toHaveLength(2);
  expect(Buffer.from(await encodeWebp(image, FOREST_GROUND_QUALITY, true))).toEqual(
    readFileSync(FOREST_RUBBLE_OUTPUT),
  );
});

it('paints broken stone in the spoil and road keys over shaded earth, and the ink', () => {
  const allowed = new Set<string>([
    FOREST_INK,
    ...Object.values(FOREST_PIECE_TONES.spoil),
    ...Object.values(FOREST_GROUND_TONES.road),
    ...Object.values(FOREST_PIECE_TONES.trodden),
    FOREST_PIECE_TONES.margin.shadow,
  ]);
  const seen = new Map<string, number>();
  let opaque = 0,
    red = 0,
    blue = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    if ((image.data[i + 3] ?? 0) === 0) continue;
    opaque++;
    red += image.data[i] ?? 0;
    blue += image.data[i + 2] ?? 0;
    const hex = toHex([image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0]);
    seen.set(hex, (seen.get(hex) ?? 0) + 1);
  }
  expect([...seen.keys()].filter((hex) => !allowed.has(hex))).toEqual([]);
  // Both kinds of chunk show, each with its lit facet, its shadowed facet and
  // its chip highlight; the gaps and the contact shadow are the earth in shade.
  for (const hex of [
    ...Object.values(FOREST_PIECE_TONES.spoil),
    ...Object.values(FOREST_GROUND_TONES.road),
    FOREST_PIECE_TONES.margin.shadow,
    FOREST_INK,
  ])
    expect(seen.get(hex) ?? 0, `${hex} is painted`).toBeGreaterThan(200);
  // Warmer than spoil on its own: the heap must not read as the cold grey it
  // replaced once the runtime rubble wash is laid over it.
  const spoilRed = Number.parseInt(FOREST_PIECE_TONES.spoil.base.slice(1, 3), 16);
  const spoilBlue = Number.parseInt(FOREST_PIECE_TONES.spoil.base.slice(5, 7), 16);
  expect((red - blue) / opaque).toBeGreaterThan(spoilRed - spoilBlue);
});

it('piles a crowned heap inside its own cell with no baked gradient', () => {
  // Every painted pixel lies inside the cell's diamond, which in this plate is
  // the full width and one and a half times the height of the plate.
  let outside = 0;
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      if (!opaqueAt(px, py)) continue;
      const u = Math.abs(px + 0.5 - image.width / 2) / (image.width / 2);
      const v = Math.abs(py + 0.5 - image.height / 2) / (image.height * 0.75);
      if (u + v > 1) outside++;
    }
  expect(outside).toBe(0);
  expect(opaqueAt(2, 2)).toBe(false);
  expect(opaqueAt(image.width - 3, image.height - 3)).toBe(false);
  expect(opaqueAt(image.width / 2, image.height / 2)).toBe(true);
  // A heap, not a floor: separate chunks, stacked so the crown rises well
  // above the ground the pile spreads over.
  expect(rubbleChunks().length).toBeGreaterThanOrEqual(12);
  let crown = image.height;
  for (let py = 0; py < image.height && crown === image.height; py++)
    for (let px = 0; px < image.width; px++)
      if (opaqueAt(px, py)) {
        crown = py;
        break;
      }
  expect(RUBBLE_BED.y - RUBBLE_BED.ry - crown).toBeGreaterThan(30);
  const m = measure(image);
  // The plate is smaller than one 128 px measuring window in height, so the
  // span is read across the widest row of windows it can hold.
  expect(m.span).toBeLessThan(1.25);
  expect(m.opaque).toBeGreaterThan(20_000);
});
