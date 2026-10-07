import { describe, expect, it, vi } from 'vitest';
import {
  FOREST_RUBBLE_CELLS,
  RUBBLE_HEAP_URLS,
  rubbleHeapUrl,
} from '../../src/content/scenes/forestRoad';
import {
  CUTTING_RUBBLE_CELLS,
  DRILLER_RUBBLE_CELLS,
} from '../../src/content/scenes/quarryProjected';
import { readFileSync } from 'node:fs';
import { readImage, toHex } from './lib/image';
import { encodeWebp } from './lib/webp';
import { alphaBounds, lowestOpaqueRow } from './lib/trim';
import {
  FOREST_GROUND_QUALITY,
  FOREST_PIECE_TONES,
  loadForestMaterial,
} from './forest-village-material';
import {
  FOREST_RUBBLE_PLATE,
  RUBBLE_SOURCE_BOUNDS,
  RUBBLE_VARIANTS,
  packRubble,
  packProceduralRubble,
  rubbleOutput,
  rubbleSource,
} from './forest-rubble';
import { measure } from './forest-ground-measure';
import { FOREST_GRASS_PACKS, packGrassRegion } from './forest-grass-regions';
import { FOREST_ROUTE_GROUND, packRouteGround } from './forest-route-ground';
import type { Image } from './lib/image';

// Decoding WebP plates is cheap alone and slow on a busy machine; ci:local timed out the
// 5 s default once. Headroom here, not a raised global timeout.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const material = await loadForestMaterial();

function paintedToneCount(image: Image): number {
  const tones = new Set<number>();
  for (let i = 0; i < image.data.length; i += 4) {
    if ((image.data[i + 3] ?? 0) < 8) continue;
    tones.add(
      ((image.data[i] ?? 0) << 16) | ((image.data[i + 1] ?? 0) << 8) | (image.data[i + 2] ?? 0),
    );
  }
  return tones.size;
}

it('piles three different heaps, and every placement uses one of them', () => {
  const plates = Array.from({ length: RUBBLE_VARIANTS }, (_, v) => packRubble(material, v));
  for (let a = 0; a < plates.length; a++)
    for (let b = a + 1; b < plates.length; b++)
      expect(Buffer.from(plates[a]!.data).equals(Buffer.from(plates[b]!.data))).toBe(false);
  expect(RUBBLE_HEAP_URLS).toHaveLength(RUBBLE_VARIANTS);
  RUBBLE_HEAP_URLS.forEach((url, v) => expect(`public/${url}`).toBe(rubbleOutput(v)));
  // The pick is a hash of the cell: the same cell always draws the same heap.
  expect(rubbleHeapUrl({ x: 7, y: 3 })).toBe(rubbleHeapUrl({ x: 7, y: 3 }));
  // The forest's two heaps differ, and the quarry boards show all three.
  expect(new Set(FOREST_RUBBLE_CELLS.map(rubbleHeapUrl)).size).toBe(2);
  for (const cells of [CUTTING_RUBBLE_CELLS, DRILLER_RUBBLE_CELLS])
    expect(new Set(cells.map(rubbleHeapUrl)).size).toBe(RUBBLE_VARIANTS);
});

describe.each(Array.from({ length: RUBBLE_VARIANTS }, (_, v) => v))(
  'heap variant %i',
  (variant) => {
    const image = packRubble(material, variant);
    it('ships a byte-identical painted plate at its registered size', async () => {
      // The placements in `forestRoad.ts` scale this plate into their own
      // cells, so its size is registration: changing it would move the heaps.
      expect({ width: image.width, height: image.height }).toEqual({
        width: FOREST_RUBBLE_PLATE.width,
        height: FOREST_RUBBLE_PLATE.height,
      });
      expect(FOREST_RUBBLE_CELLS).toHaveLength(2);
      expect(Buffer.from(await encodeWebp(image, FOREST_GROUND_QUALITY, true))).toEqual(
        readFileSync(rubbleOutput(variant)),
      );
    });

    it('keeps the approved alpha bounds, soft edge and foot line', () => {
      const expected = RUBBLE_SOURCE_BOUNDS[variant]!;
      expect(alphaBounds(image)).toEqual({
        x: expected.x,
        y: expected.y,
        width: expected.width,
        height: expected.height,
      });
      expect(lowestOpaqueRow(image)).toBe(expected.foot);
      let soft = 0;
      for (let i = 3; i < image.data.length; i += 4) {
        const alpha = image.data[i] ?? 0;
        if (alpha > 0 && alpha < 255) soft++;
      }
      expect(soft).toBeGreaterThan(15_000);
    });

    it('has fine painted variation rather than the old flat procedural blocks', () => {
      expect(paintedToneCount(image)).toBeGreaterThan(100);
      expect(paintedToneCount(packProceduralRubble(material, variant))).toBeLessThan(20);
      // The approved paintings have different silhouettes, so a shared pixel floor
      // turns the accepted variant 1 (14,611 opaque pixels) into a false failure.
      // Packing is intentionally lossless here: compare each plate with its tracked
      // source instead of inventing a cross-variant threshold.
      const sourceOpaque = measure(readImage(rubbleSource(variant))).opaque;
      expect(measure(image).opaque, `rubble variant ${variant} opaque pixels`).toBe(sourceOpaque);
    });
  },
);

/**
 * The heap stands on ground, not on a hole. The route and grass plates paint
 * both rubble cells — no bare terrain diamond is left round the heap — and what
 * they paint there is the spill the heap has shed, which carries on past the
 * cell's edges into the verge rather than stopping on them.
 */
it('stands on its own spill, with ground laid under the whole cell', () => {
  const layers: { image: Image; x: number; y: number }[] = [
    ...FOREST_GRASS_PACKS.map((pack) => ({
      image: packGrassRegion(material, pack.rows, pack.region),
      x: pack.region.x,
      y: pack.region.y,
    })),
    { image: packRouteGround(material), x: FOREST_ROUTE_GROUND.x, y: FOREST_ROUTE_GROUND.y },
  ];
  const spill = new Set<string>(Object.values(FOREST_PIECE_TONES.spill));
  const sample = (x: number, y: number) => {
    const wx = 768 + (x - y) * 64,
      wy = (x + y) * 32;
    let clear = 1;
    let top: string | null = null;
    for (const layer of layers) {
      const px = Math.floor(wx - layer.x),
        py = Math.floor(wy - layer.y);
      if (px < 0 || py < 0 || px >= layer.image.width || py >= layer.image.height) continue;
      const i = (py * layer.image.width + px) * 4;
      const alpha = (layer.image.data[i + 3] ?? 0) / 255;
      if (alpha === 0) continue;
      clear *= 1 - alpha;
      top = toHex([
        layer.image.data[i] ?? 0,
        layer.image.data[i + 1] ?? 0,
        layer.image.data[i + 2] ?? 0,
      ]);
    }
    return { covered: 1 - clear, top };
  };
  for (const cell of FOREST_RUBBLE_CELLS) {
    let bare = 0,
      spilled = 0,
      all = 0;
    for (let v = 0.01; v < 1; v += 0.02)
      for (let u = 0.01; u < 1; u += 0.02) {
        const { covered, top } = sample(cell.x + u, cell.y + v);
        all++;
        if (covered < 0.999) bare++;
        if (top && spill.has(top)) spilled++;
      }
    expect(bare, `bare terrain in rubble cell ${cell.x},${cell.y}`).toBe(0);
    expect(spilled / all, `spill under ${cell.x},${cell.y}`).toBeGreaterThan(0.6);
    // And the spill carries on past the cell into the verge on its open sides.
    let beyond = 0;
    for (const [u, v] of [
      [-0.08, 0.5],
      [1.08, 0.5],
      [0.5, -0.08],
      [0.5, 1.08],
    ] as const) {
      const { top } = sample(cell.x + u, cell.y + v);
      if (top && spill.has(top)) beyond++;
    }
    expect(beyond, `spill crosses the edges of ${cell.x},${cell.y}`).toBeGreaterThanOrEqual(2);
  }
});
