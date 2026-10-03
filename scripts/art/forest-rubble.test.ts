import { describe, expect, it } from 'vitest';
import {
  FOREST_RUBBLE_CELLS,
  RUBBLE_HEAP_URLS,
  rubbleHeapUrl,
} from '../../src/content/scenes/forestRoad';
import {
  CUTTING_RUBBLE_CELLS,
  DRILLER_RUBBLE_CELLS,
} from '../../src/content/scenes/quarryProjected';
import { toHex } from './lib/image';
import { expectPackerAlpha, expectShippedPin, readShipped } from './lib/shipped-pin';
import { FOREST_PIECE_TONES, loadForestMaterial } from './forest-village-material';
import {
  CHUNK_INK_PX,
  FOREST_RUBBLE_PLATE,
  INK_PX,
  RUBBLE_VARIANTS,
  STONE_REACH,
  looseStones as stonesOf,
  packRubble,
  rubbleChunks as chunksOf,
  rubbleOutput,
} from './forest-rubble';
import { measure } from './forest-ground-measure';
import { FOREST_GRASS_PACKS, packGrassRegion } from './forest-grass-regions';
import { FOREST_ROUTE_GROUND, packRouteGround } from './forest-route-ground';
import type { Image } from './lib/image';

const material = await loadForestMaterial();

/** Generated 2026-10-03 (see docs/art/forest-rubble.md); not packer output. */
const RUBBLE_PINS: readonly { bytes: number; sha256: string }[] = [
  { bytes: 6798, sha256: '521d90c0b658bc20a738f77733d792f0926934937cdf7b68c99db1a7daf2ae66' },
  { bytes: 6162, sha256: 'b9d3ef4be0ba81b5aee66d925c5b1283eb050439ac55da4ef09f6a6989e2fea9' },
  { bytes: 7032, sha256: '1680bc0818c28e3f7942b9ff72ea80d5b7fc0368b548ba0ffe9ce9cf5846900e' },
];

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

it('inks the heap at the figures’ line weight, not double it', () => {
  // One world pixel: a sprite's two-pixel ink in a 128 px frame drawn one
  // 64 px tile wide. The plate is three plate pixels to a world pixel.
  expect(INK_PX).toBe(FOREST_RUBBLE_PLATE.width / 128);
  expect(CHUNK_INK_PX).toBeLessThan(INK_PX);
});

describe.each(Array.from({ length: RUBBLE_VARIANTS }, (_, v) => v))(
  'heap variant %i',
  (variant) => {
    const image = packRubble(material, variant);
    const opaqueAt = (px: number, py: number): boolean =>
      (image.data[(py * image.width + px) * 4 + 3] ?? 0) > 0;
    const rubbleChunks = () => chunksOf(variant);
    const looseStones = () => stonesOf(variant);

    it('ships the generated rubble plate on the packer footprint, at its registered size', async () => {
      // The placements in `forestRoad.ts` scale this plate into their own
      // cells, so its size is registration: changing it would move the heaps.
      expect({ width: image.width, height: image.height }).toEqual({
        width: FOREST_RUBBLE_PLATE.width,
        height: FOREST_RUBBLE_PLATE.height,
      });
      expect(FOREST_RUBBLE_CELLS).toHaveLength(2);
      expectShippedPin(rubbleOutput(variant), RUBBLE_PINS[variant]!);
      await expectPackerAlpha(rubbleOutput(variant), image);
    });

    it('grounds the shipped heap: ink at its outline, contact shade under its foot', async () => {
      // Visual checks run on the decoded shipped pixels, not the packer's.
      const shipped = await readShipped(rubbleOutput(variant));
      const at = (px: number, py: number) => {
        const i = (py * shipped.width + px) * 4;
        return {
          alpha: shipped.data[i + 3] ?? 0,
          luma:
            0.2126 * (shipped.data[i] ?? 0) +
            0.7152 * (shipped.data[i + 1] ?? 0) +
            0.0722 * (shipped.data[i + 2] ?? 0),
        };
      };
      // Walk each column to its lowest opaque pixel: the foot of the heap.
      let columns = 0,
        footLuma = 0,
        bodyLuma = 0,
        bodyCount = 0;
      for (let px = 0; px < shipped.width; px++) {
        let foot = -1;
        for (let py = shipped.height - 1; py >= 0 && foot < 0; py--)
          if (at(px, py).alpha > 0) foot = py;
        if (foot < 12) continue;
        columns++;
        for (let y = foot - 2; y <= foot; y++) footLuma += at(px, y).luma / 3;
        for (let y = foot - 12; y < foot - 4; y++) {
          bodyLuma += at(px, y).luma;
          bodyCount++;
        }
      }
      expect(columns).toBeGreaterThan(150);
      // The foot is darker than the stone above it: contact and ground shade.
      expect(footLuma / columns).toBeLessThan((bodyLuma / bodyCount) * 0.8);
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
      // above the foot of the pile.
      expect(rubbleChunks().length).toBeGreaterThanOrEqual(12);
      let crown = image.height;
      for (let py = 0; py < image.height && crown === image.height; py++)
        for (let px = 0; px < image.width; px++)
          if (opaqueAt(px, py)) {
            crown = py;
            break;
          }
      const foot = Math.max(...rubbleChunks().map((chunk) => chunk.y + chunk.ry));
      expect(foot - crown).toBeGreaterThan(80);
      // The pile's foot is a mound well inside the cell, not the cell's own
      // diamond: its widest course stays clear of the diamond's side corners, and
      // so does every loose stone, which in a corner reads as a rivet marking the
      // cell's outline.
      for (const chunk of rubbleChunks())
        expect(
          Math.abs(chunk.x - image.width / 2) + chunk.rx,
          'chunk clear of the corners',
        ).toBeLessThan(image.width / 2 - 36);
      for (const stone of looseStones())
        expect(
          Math.abs(stone.x - image.width / 2) + stone.rx,
          'stone clear of the corners',
        ).toBeLessThanOrEqual((image.width / 2) * STONE_REACH);
      // Nothing at all is painted in the corner wedges.
      let cornered = 0;
      for (let py = 0; py < image.height; py++)
        for (let px = 0; px < image.width; px++)
          if (opaqueAt(px, py) && Math.abs(px + 0.5 - image.width / 2) > image.width / 2 - 24)
            cornered++;
      expect(cornered, 'paint in the diamond corners').toBe(0);
      const m = measure(image);
      // The plate is smaller than one 128 px measuring window in height, so the
      // span is read across the widest row of windows it can hold.
      expect(m.span).toBeLessThan(1.25);
      expect(m.opaque).toBeGreaterThan(15_000);
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
