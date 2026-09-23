import { describe, expect, it } from 'vitest';
import { CONTENT } from '../content';
import { FOREST_ROAD } from '../content/maps/combat';
import { BA_DAN_VILLAGE } from '../content/maps/village';
import { buildGrid, tileAt, withSurface } from '../core/rules/grid';
import { applyImpact, paintSurface } from '../core/rules/surfaces';
import type { Grid, Vec2 } from '../core/types';
import { surfaceEdges, type Edges } from './geometry/board';
import { GROUND_FRAGMENT } from './backends/shaders';
import { SURFACE_INDEX, surfaceIsPainted, surfaceTexel } from './sceneSurfaces';

it('replaces only registered permanent rubble and restores all dynamic/accessibility/fallback overlays', () => {
  const pos = { x: 7, y: 3 };
  const tile = tileAt(buildGrid(FOREST_ROAD), pos);
  if (!tile) throw new Error('Missing authored cover');
  const scene = FOREST_ROAD.scene;
  if (!scene) throw new Error('Missing authored scene');
  const view = { scene, hatch: false, crispOverlays: false };
  expect(tile.surface?.id).toBe('rubble');
  expect(scene.groundMode).toBe('partial');
  expect(surfaceIsPainted(view, true, tile, pos)).toBe(true);
  expect(
    surfaceIsPainted({ ...view, scene: { ...view.scene, paintedRubble: [] } }, true, tile, pos),
  ).toBe(false);
  expect(
    surfaceIsPainted({ ...view, scene: { ...view.scene, groundMode: undefined } }, true, tile, pos),
  ).toBe(true);
  expect(surfaceIsPainted(view, false, tile, pos)).toBe(false);
  expect(surfaceIsPainted({ ...view, hatch: true }, true, tile, pos)).toBe(false);
  expect(surfaceIsPainted({ ...view, crispOverlays: true }, true, tile, pos)).toBe(false);
  expect(surfaceIsPainted(view, true, tile, { x: 6, y: 3 })).toBe(false);
  for (const id of ['rubble', 'fire', 'mud', 'ice'] as const) {
    const changed = { ...tile, surface: { id, duration: 3, spread: 0 } };
    expect(surfaceIsPainted(view, true, changed, pos)).toBe(false);
  }
  expect(surfaceIsPainted(view, true, { ...tile, surface: null }, pos)).toBe(false);
});

it('keeps Ba Dan permanent water painted only in legacy complete mode', () => {
  const pos = { x: 10, y: 6 };
  const tile = tileAt(buildGrid(BA_DAN_VILLAGE), pos);
  if (!tile || !BA_DAN_VILLAGE.scene) throw new Error('Missing Ba Dan pond');
  const scene = { ...BA_DAN_VILLAGE.scene, groundMode: undefined, paintedWater: true };
  const view = { scene, hatch: false, crispOverlays: false };
  expect(tile.surface?.id).toBe('water');
  expect(surfaceIsPainted(view, true, tile, pos)).toBe(true);
  expect(
    surfaceIsPainted({ ...view, scene: { ...view.scene, groundMode: 'partial' } }, true, tile, pos),
  ).toBe(false);
  expect(
    surfaceIsPainted(
      view,
      true,
      { ...tile, surface: { id: 'water', duration: 3, spread: 0 } },
      pos,
    ),
  ).toBe(false);
});

describe('ability rubble beside a registered heap', () => {
  const scene = FOREST_ROAD.scene!;
  const view = { scene, hatch: false, crispOverlays: false };
  const HEAP = { x: 7, y: 3 };
  const WEST = { x: 6, y: 3 };
  const SOUTH = { x: 7, y: 4 };
  const rubble = (grid: Grid, cells: Vec2[]) =>
    paintSurface(CONTENT, grid, cells, 'rubble', -1).grid;

  /** Canvas banks a side where the grid's surface ids differ (`surfaceEdges`). */
  const canvasEdges = (grid: Grid, pos: Vec2): Edges => surfaceEdges(grid, pos);
  /**
   * WebGL banks a side where the map texel's surface slot differs, reading
   * exactly what `uploadMap` packs through `surfaceTexel`; off the map is -1.
   */
  const webglEdges = (grid: Grid, ready: boolean, pos: Vec2): Edges => {
    const slot = ({ x, y }: Vec2): number => {
      const tile = x < 0 || y < 0 || x >= grid.width ? undefined : tileAt(grid, { x, y });
      return tile ? surfaceTexel(tile, surfaceIsPainted(view, ready, tile, { x, y }))[0] : -1;
    };
    const own = slot(pos);
    if (own === 0) return { n: false, e: false, s: false, w: false };
    return {
      n: slot({ x: pos.x, y: pos.y - 1 }) !== own,
      e: slot({ x: pos.x + 1, y: pos.y }) !== own,
      s: slot({ x: pos.x, y: pos.y + 1 }) !== own,
      w: slot({ x: pos.x - 1, y: pos.y }) !== own,
    };
  };
  /** Every cell either backend draws a surface on gets the same four sides. */
  const expectParity = (grid: Grid, ready: boolean) => {
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++)
        expect(webglEdges(grid, ready, { x, y }), `${x},${y}`).toEqual(canvasEdges(grid, { x, y }));
  };

  it('keeps the WebGL bank test to the texel slot, as the parity below assumes', () => {
    for (const [dx, dy] of [
      ['0.0', '1.0'],
      ['1.0', '0.0'],
    ])
      for (const sign of ['-', '+'])
        expect(GROUND_FRAGMENT).toContain(
          `if (surfaceAt(cell ${sign} vec2(${dx}, ${dy})) != surface) edgeDistance`,
        );
  });

  it('meets the heap without a bank on both backends', () => {
    const grid = rubble(buildGrid(FOREST_ROAD), [WEST, SOUTH]);
    const heap = tileAt(grid, HEAP)!;
    // The heap's own art stands in for its wash and bank...
    expect(surfaceIsPainted(view, true, heap, HEAP)).toBe(true);
    expect(surfaceTexel(heap, true)).toEqual([SURFACE_INDEX.rubble, 0]);
    // ...while the ability rubble beside it draws in full.
    expect(surfaceIsPainted(view, true, tileAt(grid, WEST)!, WEST)).toBe(false);
    expect(surfaceTexel(tileAt(grid, WEST)!, false)).toEqual([SURFACE_INDEX.rubble, 1]);
    // Its bank stops at the heap: the heap's ink outline is the edge there.
    expect(canvasEdges(grid, WEST)).toMatchObject({ e: false, n: true, w: true, s: true });
    expect(canvasEdges(grid, SOUTH)).toMatchObject({ n: false });
    expect(webglEdges(grid, true, WEST)).toEqual(canvasEdges(grid, WEST));
    expect(webglEdges(grid, true, SOUTH)).toEqual(canvasEdges(grid, SOUTH));
    expectParity(grid, true);
    // A failed load keeps the heap's wash, and still no bank between them.
    expect(surfaceTexel(heap, surfaceIsPainted(view, false, heap, HEAP))).toEqual([
      SURFACE_INDEX.rubble,
      1,
    ]);
    expectParity(grid, false);
  });

  it('banks the shared edge once the heap is cleared, and not after it is re-rubbled', () => {
    let grid = rubble(buildGrid(FOREST_ROAD), [WEST]);
    grid = applyImpact(CONTENT, grid, [HEAP], 'water').grid;
    expect(tileAt(grid, HEAP)?.surface?.id).toBe('mud');
    expect(canvasEdges(grid, WEST).e).toBe(true);
    expectParity(grid, true);
    // The mud's expiry: its duration runs out and the cell is bare.
    grid = withSurface(grid, HEAP, null);
    expect(canvasEdges(grid, WEST).e).toBe(true);
    expectParity(grid, true);
    grid = rubble(grid, [HEAP]);
    expect(surfaceIsPainted(view, true, tileAt(grid, HEAP)!, HEAP)).toBe(true);
    expect(canvasEdges(grid, WEST).e).toBe(false);
    expectParity(grid, true);
  });
});
