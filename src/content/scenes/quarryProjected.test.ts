import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init } from '@jsquash/webp/decode.js';
import { beforeAll, describe, expect, it } from 'vitest';
import type { MapScene } from '../../core/types';
import { AMBUSH_ROAD, QUARRY_FLOOR } from '../maps/combat';
import {
  CUTTING_SCENE,
  DRILLER_FLOOR_SCENE,
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
  it('covers dry authored centers and boundaries while leaving live surface interiors transparent', () => {
    for (const { map, scene } of routeScenes)
      for (let y = 0; y < map.height; y++)
        for (let x = 0; x < map.width; x++) {
          const key = map.rows[y]?.[x];
          const value = alpha(scene, point(x + 0.5, y + 0.5));
          if (key === '~' || key === 'o' || key === 'm')
            expect(value, `${map.id} live ${x},${y}`).toBeLessThan(8);
          else if (key !== '#') expect(value, `${map.id} dry ${x},${y}`).toBeGreaterThan(240);
          if (key === '#' || key === '~' || key === 'o' || key === 'm') continue;
          for (const [dx, dy] of [
            [1, 0],
            [0, 1],
          ] as const) {
            const neighbor = map.rows[y + dy]?.[x + dx];
            if (
              !neighbor ||
              neighbor === '#' ||
              neighbor === '~' ||
              neighbor === 'o' ||
              neighbor === 'm'
            )
              continue;
            for (const inset of [-0.02, 0.02])
              expect(
                alpha(scene, point(x + 0.5 + dx * (0.5 + inset), y + 0.5 + dy * (0.5 + inset))),
                `${map.id} boundary ${x},${y}`,
              ).toBeGreaterThan(240);
          }
        }
  });
  it('shares only the exterior surround underneath the two live floors', () => {
    expect(CUTTING_SCENE.ground.slice(0, 2)).toEqual(DRILLER_FLOOR_SCENE.ground.slice(0, 2));
    expect(CUTTING_SCENE.ground.slice(0, 2).map((piece) => piece.url)).toEqual([
      'art/maps/quarry-surround/west.webp',
      'art/maps/quarry-surround/east.webp',
    ]);
  });
  it('softens the independently compressed dirt-page handoff without exposing dry floor', () => {
    for (const { scene } of routeScenes) {
      const west = scene.ground.find((piece) => piece.url.endsWith('/dirt-west.webp'));
      const east = scene.ground.find((piece) => piece.url.endsWith('/dirt-east.webp'));
      if (!west || !east) throw new Error('Missing dirt split');
      // x=10 is the authored split. East is translucent there over the opaque
      // west bleed, rather than replacing it with a separately compressed edge.
      const seam = point(10, 1);
      expect(pieceAlpha(west, seam)).toBeGreaterThan(240);
      expect(pieceAlpha(east, seam)).toBeGreaterThan(20);
      expect(pieceAlpha(east, seam)).toBeLessThan(235);
      expect(alpha(scene, seam)).toBeGreaterThan(240);
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
