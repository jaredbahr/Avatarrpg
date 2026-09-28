import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { RIVERSIDE } from '../../src/content/maps/riverside';
import { buildGrid, tileAt } from '../../src/core/rules/grid';
import { pixelAt, readImage } from './lib/image';
import {
  CUTOUT_ORIGINS,
  EDGE_STOPS,
  RIVERSIDE_OUTPUT,
  RIVERSIDE_PX,
  RIVERSIDE_SOURCE,
  bakeEdgeProps,
  bakeRiverside,
  castShadow,
  readCutouts,
  spriteOrigin,
  stopSprite,
} from './riverside-edge-props';
import type { CutoutId } from './riverside-edge-props';

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

it('changes the painting only where a stop and its shadow stand', () => {
  const source = readImage(RIVERSIDE_SOURCE);
  const cutouts = readCutouts();
  const baked = bakeEdgeProps(source, cutouts);
  const boxes = EDGE_STOPS.map((stop) => {
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
