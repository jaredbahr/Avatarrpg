import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FOREST_RUBBLE_CELLS } from '../../src/content/scenes/forestRoad';
import { toHex } from './lib/image';
import { encodeWebp } from './lib/webp';
import {
  FOREST_GROUND_QUALITY,
  FOREST_INK,
  FOREST_PIECE_TONES,
  loadForestMaterial,
} from './forest-village-material';
import { FOREST_RUBBLE_OUTPUT, FOREST_RUBBLE_PLATE, packRubble, rubbleEdge } from './forest-rubble';
import { measure } from './forest-ground-measure';

const material = await loadForestMaterial();
const image = packRubble(material);

it('ships the rubble plate the packer builds, at its registered size', async () => {
  // The two placements in `forestRoad.ts` scale this plate into their own
  // cells, so its size is registration: changing it would move the diamonds.
  expect({ width: image.width, height: image.height }).toEqual({
    width: FOREST_RUBBLE_PLATE.width,
    height: FOREST_RUBBLE_PLATE.height,
  });
  expect(FOREST_RUBBLE_CELLS).toHaveLength(2);
  expect(Buffer.from(await encodeWebp(image, FOREST_GROUND_QUALITY, true))).toEqual(
    readFileSync(FOREST_RUBBLE_OUTPUT),
  );
});

it('paints only the quarry-spoil key, its chip highlight and the ink', () => {
  const allowed = new Set<string>([FOREST_INK, ...Object.values(FOREST_PIECE_TONES.spoil)]);
  const seen = new Set<string>();
  for (let i = 0; i < image.data.length; i += 4) {
    if ((image.data[i + 3] ?? 0) === 0) continue;
    seen.add(toHex([image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0]));
  }
  expect([...seen].filter((hex) => !allowed.has(hex))).toEqual([]);
  for (const hex of Object.values(FOREST_PIECE_TONES.spoil))
    expect(seen, `${hex} is painted`).toContain(hex);
  expect(seen, 'the silhouette is inked').toContain(FOREST_INK);
});

it('keeps a ragged diamond silhouette and carries no baked gradient', () => {
  // A heap with a ruled edge is the defect the old plate had; the outline
  // wanders, and the plate's corners stay clear so the diamond still reads.
  expect(rubbleEdge(2, 2)).toBeLessThan(0);
  expect(rubbleEdge(FOREST_RUBBLE_PLATE.width - 3, FOREST_RUBBLE_PLATE.height - 3)).toBeLessThan(0);
  expect(rubbleEdge(FOREST_RUBBLE_PLATE.width / 2, FOREST_RUBBLE_PLATE.height / 2)).toBeGreaterThan(
    0,
  );
  const m = measure(image);
  // The plate is smaller than one 128 px measuring window in height, so the
  // span is read across the widest row of windows it can hold.
  expect(m.span).toBeLessThan(1.25);
  expect(m.opaque).toBeGreaterThan(20_000);
});
