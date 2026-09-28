import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { RIVERSIDE } from '../../src/content/maps/riverside';
import { buildGrid, tileAt } from '../../src/core/rules/grid';
import { pixelAt, readImage } from './lib/image';
import type { Bounds } from './lib/trim';
import {
  CUTOUT_ORIGINS,
  EDGE_STOPS,
  GROUND_PATCHES,
  RIVERSIDE_OUTPUT,
  RIVERSIDE_PX,
  RIVERSIDE_SOURCE,
  bakeEdgeProps,
  bakeRiverside,
  castShadow,
  insidePolygon,
  patchBounds,
  patchLight,
  readCutouts,
  spriteOrigin,
  stopSprite,
} from './riverside-edge-props';
import type { CutoutId, Cutouts } from './riverside-edge-props';

const grid = buildGrid(RIVERSIDE);
const walkable = (x: number, y: number) => tileAt(grid, { x, y })?.blocked === false;

it('ships a reproducible bake of the unmodified painting', async () => {
  const { image, bytes } = await bakeRiverside();
  expect({ width: image.width, height: image.height }).toEqual({
    width: RIVERSIDE.width * RIVERSIDE_PX,
    height: RIVERSIDE.height * RIVERSIDE_PX,
  });
  expect(RIVERSIDE.backdrop?.pixelsPerTile).toBe(RIVERSIDE_PX);
  expect(Buffer.from(bytes)).toEqual(readFileSync(RIVERSIDE_OUTPUT));
}, 60_000);

it("cuts every prop from the painting's own pixels", () => {
  const source = readImage(RIVERSIDE_SOURCE);
  const cutouts = readCutouts();
  for (const id of Object.keys(CUTOUT_ORIGINS) as CutoutId[]) {
    const cutout = cutouts[id];
    const origin = CUTOUT_ORIGINS[id];
    let visible = 0;
    for (let y = 0; y < cutout.height; y++)
      for (let x = 0; x < cutout.width; x++) {
        const [r, g, b, a] = pixelAt(cutout, x, y);
        if (a === 0) continue;
        visible++;
        expect([r, g, b], `${id} at ${x},${y}`).toEqual(
          pixelAt(source, origin.x + x, origin.y + y).slice(0, 3),
        );
      }
    expect(visible, id).toBeGreaterThan(cutout.width * cutout.height * 0.3);
  }
});

it('stands each stop on the blocked cell it explains, seen from open ground', () => {
  const cutouts = readCutouts();
  for (const stop of EDGE_STOPS) {
    for (const cell of stop.cells) expect(walkable(cell.x, cell.y), stop.id).toBe(false);
    // The prop's base stands on one of its own blocked cells (the R1 rule).
    const base = {
      x: Math.floor(stop.foot.x / RIVERSIDE_PX),
      y: Math.floor((stop.foot.y - 1) / RIVERSIDE_PX),
    };
    expect(stop.cells, stop.id).toContainEqual(base);
    // A party member can walk up to it.
    expect(walkable(stop.from.x, stop.from.y), stop.id).toBe(true);
    expect(
      stop.cells.some(
        (cell) => Math.max(Math.abs(cell.x - stop.from.x), Math.abs(cell.y - stop.from.y)) === 1,
      ),
      stop.id,
    ).toBe(true);
    // Nothing is stretched: a stop is the cutout, cropped or mirrored at most.
    const sprite = stopSprite(cutouts[stop.cutout], stop);
    expect(sprite.height, stop.id).toBe(cutouts[stop.cutout].height);
  }
});

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const boxOf = (b: Bounds): Box => ({ x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height });
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function stopBoxes(cutouts: Cutouts): Box[] {
  return EDGE_STOPS.map((stop) => {
    const sprite = stopSprite(cutouts[stop.cutout], stop);
    const at = spriteOrigin(sprite, stop);
    const pad = stop.shadow ? castShadow(sprite, stop.shadow.strength, stop.shadow.reach).pad : 0;
    return {
      x0: at.x - pad,
      y0: at.y - pad,
      x1: at.x + sprite.width + pad,
      y1: at.y + sprite.height + pad,
    };
  });
}

it('paints the opened garden rock out with light-matched ground from the painting', () => {
  const source = readImage(RIVERSIDE_SOURCE);
  const cutouts = readCutouts();
  const baked = bakeEdgeProps(source, cutouts);
  const stops = stopBoxes(cutouts);
  const patches = GROUND_PATCHES.map((patch) => boxOf(patchBounds(patch, 4)));
  expect(GROUND_PATCHES.map((patch) => patch.cell)).toContainEqual({ x: 8, y: 21 });
  for (const patch of GROUND_PATCHES) {
    // The cell is open now; the patch is centred on it.
    expect(walkable(patch.cell.x, patch.cell.y), patch.id).toBe(true);
    const box = patchBounds(patch);
    expect(
      {
        x: Math.floor((box.x + box.width / 2) / RIVERSIDE_PX),
        y: Math.floor((box.y + box.height / 2) / RIVERSIDE_PX),
      },
      patch.id,
    ).toEqual(patch.cell);
    // The donor is untouched ground: no patch, no stop and not itself.
    const donor = boxOf(patchBounds(patch, 4));
    const moved = {
      x0: donor.x0 + patch.offset.x,
      y0: donor.y0 + patch.offset.y,
      x1: donor.x1 + patch.offset.x,
      y1: donor.y1 + patch.offset.y,
    };
    for (const other of [...patches, ...stops])
      expect(overlaps(moved, other), patch.id).toBe(false);
    // The light only nudges: the donor is ground of the same kind and light.
    const light = patchLight(source, patch);
    for (const ratio of light) expect(Math.abs(ratio - 1), patch.id).toBeLessThan(0.1);
    // Two pixels inside the trace, the mask is solid: every pixel is the donor's.
    let interior = 0;
    for (let y = box.y; y < box.y + box.height; y++)
      for (let x = box.x; x < box.x + box.width; x++) {
        let solid = true;
        for (let dy = -2; dy <= 2 && solid; dy++)
          for (let dx = -2; dx <= 2 && solid; dx++)
            solid = insidePolygon(patch.points, x + dx + 0.5, y + dy + 0.5);
        if (!solid) continue;
        interior++;
        const from = pixelAt(source, x + patch.offset.x, y + patch.offset.y);
        expect(pixelAt(baked, x, y).slice(0, 3), `${patch.id} at ${x},${y}`).toEqual(
          [0, 1, 2].map((c) => Math.round(Math.min(255, (from[c] ?? 0) * (light[c] ?? 1)))),
        );
      }
    expect(interior, patch.id).toBeGreaterThan(300);
  }
  // The rock itself is gone from (8,21): almost none of its pixels remain.
  const rock = cutouts['rock-small'];
  const origin = CUTOUT_ORIGINS['rock-small'];
  let visible = 0;
  let kept = 0;
  for (let y = 0; y < rock.height; y++)
    for (let x = 0; x < rock.width; x++) {
      if (pixelAt(rock, x, y)[3] !== 255) continue;
      visible++;
      const [r, g, b] = pixelAt(baked, origin.x + x, origin.y + y);
      const [sr, sg, sb] = pixelAt(rock, x, y);
      if (Math.abs(r - sr) + Math.abs(g - sg) + Math.abs(b - sb) < 12) kept++;
    }
  expect(kept / visible).toBeLessThan(0.05);
});

it('changes the painting only where a stop and its shadow stand, or a patch', () => {
  const source = readImage(RIVERSIDE_SOURCE);
  const cutouts = readCutouts();
  const baked = bakeEdgeProps(source, cutouts);
  // The patch mask's two blurs spread it two pixels past the trace.
  const boxes = [
    ...stopBoxes(cutouts),
    ...GROUND_PATCHES.map((patch) => boxOf(patchBounds(patch, 2))),
  ];
  let changed = 0;
  for (let y = 0; y < source.height; y++)
    for (let x = 0; x < source.width; x++) {
      const i = (y * source.width + x) * 4;
      if (
        source.data[i] === baked.data[i] &&
        source.data[i + 1] === baked.data[i + 1] &&
        source.data[i + 2] === baked.data[i + 2]
      )
        continue;
      changed++;
      expect(
        boxes.some((b) => x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1),
        `${x},${y}`,
      ).toBe(true);
    }
  expect(changed).toBeGreaterThan(0);
});
