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
  STONE_REACH,
  looseStones,
  packRubble,
  rubbleChunks,
} from './forest-rubble';
import { measure } from './forest-ground-measure';
import { FOREST_GRASS_PACKS, packGrassRegion } from './forest-grass-regions';
import { FOREST_ROUTE_GROUND, packRouteGround } from './forest-route-ground';
import type { Image } from './lib/image';

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
  // The amended heap stays warmer than the former cold-grey spoil base
  // (`#a89880`, R-B 40) even after its ink and contact shadow are included.
  expect((red - blue) / opaque).toBeGreaterThan(0xa8 - 0x80);
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
