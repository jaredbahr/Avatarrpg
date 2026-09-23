import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init } from '@jsquash/webp/decode.js';
import { beforeAll, describe, expect, it } from 'vitest';
import type { MapScene } from '../../core/types';
import { AMBUSH_ROAD, QUARRY_FLOOR } from '../maps/combat';
import { rubbleHeap } from './forestRoad';
import {
  CUTTING_POOL_PATCH,
  CUTTING_RUBBLE_CELLS,
  CUTTING_SCENE,
  CUTTING_WATER_CELLS,
  DRILLER_FLOOR_SCENE,
  DRILLER_RUBBLE_CELLS,
  DRILLER_FLOOR_WALL_CELLS,
  DRILLER_REAR_LOADING_CELLS,
  DRILLER_REAR_LOADING_SCENERY,
} from './quarryProjected';

const routeScenes = [
  { map: AMBUSH_ROAD, scene: CUTTING_SCENE },
  { map: QUARRY_FLOOR, scene: DRILLER_FLOOR_SCENE },
] as const;
const decoded: {
  scene: (typeof routeScenes)[number]['scene'];
  piece: MapScene['ground'][number];
  image: ImageData;
}[] = [];

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  await init(
    await WebAssembly.compile(
      readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm')),
    ),
  );
  for (const { scene } of routeScenes)
    for (const piece of scene.ground.slice(2)) {
      const bytes = readFileSync(`public/${piece.url}`);
      decoded.push({
        scene,
        piece,
        image: await decode(
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        ),
      });
    }
});

const point = (x: number, y: number) => ({ x: 768 + (x - y) * 64, y: (x + y) * 32 });
function alpha(scene: MapScene, world: { x: number; y: number }): number {
  let value = 0;
  for (const entry of decoded) {
    if (
      entry.scene !== scene ||
      world.x < entry.piece.x ||
      world.y < entry.piece.y ||
      world.x >= entry.piece.x + entry.piece.width ||
      world.y >= entry.piece.y + entry.piece.height
    )
      continue;
    const x = Math.min(
      entry.image.width - 1,
      Math.floor(((world.x - entry.piece.x) * entry.image.width) / entry.piece.width),
    );
    const y = Math.min(
      entry.image.height - 1,
      Math.floor(((world.y - entry.piece.y) * entry.image.height) / entry.piece.height),
    );
    value = Math.max(value, entry.image.data[(y * entry.image.width + x) * 4 + 3] ?? 0);
  }
  return value;
}

function pieceAlpha(piece: MapScene['ground'][number], world: { x: number; y: number }): number {
  const entry = decoded.find((candidate) => candidate.piece === piece);
  if (!entry) return 0;
  const x = Math.floor(world.x - piece.x),
    y = Math.floor(world.y - piece.y);
  if (x < 0 || y < 0 || x >= entry.image.width || y >= entry.image.height) return 0;
  return entry.image.data[(y * entry.image.width + x) * 4 + 3] ?? 0;
}

describe('projected quarry scenes', () => {
  it('covers authored centers and boundaries, including the ground under a spill and the pool', () => {
    for (const { map, scene } of routeScenes)
      for (let y = 0; y < map.height; y++)
        for (let x = 0; x < map.width; x++) {
          const key = map.rows[y]?.[x];
          const value = alpha(scene, point(x + 0.5, y + 0.5));
          // Every walkable cell is painted. Oil and mud are opaque ground with
          // the live surface drawn over it; the Cutting's pool is its own bed
          // and bank plate, which the live water film tints, as the forest
          // pond's is.
          if (key !== '#') expect(value, `${map.id} ground ${x},${y}`).toBeGreaterThan(240);
          if (key === '#' || key === '~') continue;
          for (const [dx, dy] of [
            [1, 0],
            [0, 1],
          ] as const) {
            const neighbor = map.rows[y + dy]?.[x + dx];
            if (!neighbor || neighbor === '#' || neighbor === '~') continue;
            for (const inset of [-0.02, 0.02])
              expect(
                alpha(scene, point(x + 0.5 + dx * (0.5 + inset), y + 0.5 + dy * (0.5 + inset))),
                `${map.id} boundary ${x},${y}`,
              ).toBeGreaterThan(240);
          }
        }
  });

  it('paints the quarry floor stone under every oil slick and the dirt under every mud patch', () => {
    for (const [key, terrain] of [
      ['o', 'stone'],
      ['m', 'dirt'],
    ] as const) {
      const pieces = DRILLER_FLOOR_SCENE.ground.filter((piece) =>
        piece.url.includes(terrain === 'stone' ? '/stone.webp' : '/dirt-'),
      );
      expect(pieces.length, `${key} pieces`).toBeGreaterThan(0);
      let cells = 0;
      for (let y = 0; y < QUARRY_FLOOR.height; y++)
        for (let x = 0; x < QUARRY_FLOOR.width; x++) {
          if (QUARRY_FLOOR.rows[y]?.[x] !== key) continue;
          cells++;
          expect(
            pieces.some((piece) => pieceAlpha(piece, point(x + 0.5, y + 0.5)) > 240),
            `${key} ${x},${y}`,
          ).toBe(true);
        }
      expect(cells, `${key} cells`).toBeGreaterThan(0);
    }
  });
  it('shares only the exterior surround underneath the two live floors', () => {
    expect(CUTTING_SCENE.ground.slice(0, 2)).toEqual(DRILLER_FLOOR_SCENE.ground.slice(0, 2));
    expect(CUTTING_SCENE.ground.slice(0, 2).map((piece) => piece.url)).toEqual([
      'art/maps/quarry-surround/west.webp',
      'art/maps/quarry-surround/east.webp',
    ]);
  });
  it('overlaps the two dirt pages by two whole cells across the x=10 split', () => {
    for (const { map, scene } of routeScenes) {
      const west = scene.ground.find((piece) => piece.url.endsWith('/dirt-west.webp'));
      const east = scene.ground.find((piece) => piece.url.endsWith('/dirt-east.webp'));
      if (!west || !east) throw new Error('Missing dirt split');
      // The pages are compressed independently, so where only their edges met
      // the procedural grass showed through as a seam (DL-2 W5 gate). Now the
      // west page is opaque across both columns either side of the line and
      // the east page fades in over the middle of them, so nowhere between
      // x=9 and x=11 does the board depend on two edges agreeing.
      let checked = 0;
      for (let y = 0; y < map.height; y++) {
        if (![9, 10].every((x) => ['.', ','].includes(map.rows[y]?.[x] ?? ''))) continue;
        for (let gx = 9.02; gx < 11; gx += 0.08) {
          const at = point(gx, y + 0.5);
          expect(pieceAlpha(west, at), `${map.id} west ${gx.toFixed(2)},${y}`).toBeGreaterThan(240);
          expect(alpha(scene, at)).toBeGreaterThan(240);
        }
        // East takes over across the middle of the overlap and owns x=11 on.
        expect(pieceAlpha(east, point(9.1, y + 0.5))).toBeLessThan(20);
        expect(pieceAlpha(east, point(10, y + 0.5))).toBeGreaterThan(20);
        expect(pieceAlpha(east, point(10, y + 0.5))).toBeLessThan(235);
        expect(pieceAlpha(east, point(10.9, y + 0.5))).toBeGreaterThan(240);
        checked++;
      }
      expect(checked, `${map.id} rows crossing the split`).toBeGreaterThan(3);
    }
  });

  it('stands the route heap on every cover cell and lays the pool over every water cell', () => {
    const cells = (map: typeof AMBUSH_ROAD, key: string) =>
      map.rows.flatMap((row, y) => [...row].flatMap((v, x) => (v === key ? [{ x, y }] : [])));
    expect(CUTTING_RUBBLE_CELLS).toEqual(cells(AMBUSH_ROAD, 'r'));
    expect(DRILLER_RUBBLE_CELLS).toEqual(cells(QUARRY_FLOOR, 'r'));
    expect(CUTTING_WATER_CELLS).toEqual(cells(AMBUSH_ROAD, '~'));
    for (const [scene, heaps] of [
      [CUTTING_SCENE, CUTTING_RUBBLE_CELLS],
      [DRILLER_FLOOR_SCENE, DRILLER_RUBBLE_CELLS],
    ] as const) {
      // The heap's own ink marks the hazard, so the live wash stands down under
      // it, exactly as on the forest road.
      expect(scene.paintedRubble).toEqual(heaps);
      const pages = scene.ground.filter((piece) => /\/(dirt-|road|stone|pool)/.test(piece.url));
      const lastPage = Math.max(...pages.map((page) => scene.ground.indexOf(page)));
      for (const cell of heaps) {
        const heap = rubbleHeap(cell);
        const index = scene.ground.findIndex(
          (piece) => JSON.stringify(piece) === JSON.stringify(heap),
        );
        // Drawn after every page, so no page covers the heap.
        expect(index, `heap on ${cell.x},${cell.y}`).toBeGreaterThan(lastPage);
        // Centred in its cell's diamond.
        const centre = point(cell.x + 0.5, cell.y + 0.5);
        expect(heap.x + heap.width / 2).toBeCloseTo(centre.x);
        expect(heap.y + heap.height / 2).toBeCloseTo(centre.y);
      }
    }
    for (const { x, y } of CUTTING_WATER_CELLS)
      for (const [u, v] of [
        [0.5, 0.5],
        [0.02, 0.5],
        [0.98, 0.5],
        [0.5, 0.02],
        [0.5, 0.98],
      ] as const) {
        const at = point(x + u, y + v);
        expect(at.x).toBeGreaterThan(CUTTING_POOL_PATCH.x);
        expect(at.x).toBeLessThan(CUTTING_POOL_PATCH.x + CUTTING_POOL_PATCH.width);
        expect(at.y).toBeGreaterThan(CUTTING_POOL_PATCH.y);
        expect(at.y).toBeLessThan(CUTTING_POOL_PATCH.y + CUTTING_POOL_PATCH.height);
      }
  });
  it('opts The Cutting into local material regions and its exterior rim', () => {
    expect(AMBUSH_ROAD.projection).toBe('oblique');
    expect(AMBUSH_ROAD.scene).toBe(CUTTING_SCENE);
    expect(CUTTING_SCENE.groundMode).toBe('partial');
    expect(CUTTING_SCENE.ground.slice(2).map((piece) => piece.url)).toEqual([
      'art/maps/cutting-scene/dirt-west.webp',
      'art/maps/cutting-scene/dirt-east.webp',
      'art/maps/cutting-scene/road.webp',
      'art/maps/cutting-scene/stone.webp',
      'art/maps/cutting-scene/pool-bank.webp',
      ...CUTTING_RUBBLE_CELLS.map(() => 'art/maps/forest-scene/rubble.webp'),
    ]);
    expect(CUTTING_SCENE.scenery).toHaveLength(3);
    expect(CUTTING_SCENE.paintedWater).toBeUndefined();
  });

  it('opts the Driller floor into local material regions while preserving the rear gap', () => {
    expect(QUARRY_FLOOR.projection).toBe('oblique');
    expect(QUARRY_FLOOR.scene).toBe(DRILLER_FLOOR_SCENE);
    expect(DRILLER_FLOOR_SCENE.groundMode).toBe('partial');
    expect(DRILLER_FLOOR_SCENE.ground.slice(2).map((piece) => piece.url)).toEqual([
      'art/maps/driller-floor-scene/dirt-west.webp',
      'art/maps/driller-floor-scene/dirt-east.webp',
      'art/maps/driller-floor-scene/stone.webp',
      ...DRILLER_RUBBLE_CELLS.map(() => 'art/maps/forest-scene/rubble.webp'),
    ]);
    expect(DRILLER_FLOOR_SCENE.scenery).toHaveLength(3);
    expect(DRILLER_FLOOR_SCENE.scenery.slice(0, 2).map((piece) => piece.footprint[0])).toEqual(
      DRILLER_FLOOR_WALL_CELLS,
    );
    expect(DRILLER_FLOOR_SCENE.scenery.slice(0, 2).map((piece) => piece.url)).toEqual([
      'art/maps/quarry-gate-scene/wall-end.webp',
      'art/maps/quarry-gate-scene/wall-end.webp',
    ]);
    for (const [index, piece] of DRILLER_FLOOR_SCENE.scenery.slice(0, 2).entries()) {
      const cell = DRILLER_FLOOR_WALL_CELLS[index];
      expect(cell).toBeDefined();
      if (!cell) continue;
      expect(piece).toMatchObject({
        x: 768 + (cell.x - cell.y) * 64 - 64,
        y: (cell.x + cell.y + 1) * 32 - 144,
        width: 128,
        height: 176,
        footprint: [cell],
        depth: { x: cell.x + 0.5, y: cell.y + 0.5 },
        wall: true,
        fadeWhenOccluding: true,
      });
    }
    expect(DRILLER_REAR_LOADING_CELLS).toEqual([
      { x: 14, y: -1 },
      { x: 15, y: -1 },
      { x: 16, y: -1 },
      { x: 17, y: -1 },
      { x: 18, y: -1 },
      { x: 19, y: -1 },
    ]);
    expect(DRILLER_REAR_LOADING_SCENERY).toEqual([
      {
        id: 'driller-rear-loading',
        url: 'art/maps/driller-floor-scene/rear-loading.webp',
        x: 1652,
        y: 382,
        width: 370,
        height: 249,
        footprint: DRILLER_REAR_LOADING_CELLS,
        depth: { x: 16.5, y: -0.5 },
        exterior: true,
      },
    ]);
    expect(DRILLER_FLOOR_SCENE.paintedWater).toBeUndefined();
  });
});
