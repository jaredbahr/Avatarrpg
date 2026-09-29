import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init } from '@jsquash/webp/decode.js';
import { expect, it } from 'vitest';
import { beforeAll } from 'vitest';
import { QUARRY_GATE } from '../maps/combat';
import {
  QUARRY_GATE_BAND_ROWS,
  QUARRY_GATE_GATE_CELLS,
  QUARRY_GATE_GROUND_REGIONS,
  QUARRY_GATE_SCENE,
  QUARRY_GATE_WALL_CELLS,
  quarryWallVariant,
} from './quarryGate';
import { QUARRY_SURROUND } from './quarryProjected';
import { QUARRY_WEST_FRAMES } from './quarryWestFrames';

const shippedGround: { piece: (typeof QUARRY_GATE_SCENE.ground)[number]; image: ImageData }[] = [];

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const wasm = readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'));
  await init(await WebAssembly.compile(wasm));
  for (const piece of QUARRY_GATE_SCENE.ground.filter(
    (entry) => !entry.url.endsWith('cover-timber.webp'),
  )) {
    const bytes = readFileSync(`public/${piece.url}`);
    shippedGround.push({
      piece,
      image: await decode(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      ),
    });
  }
});

const groundClass = (x: number, y: number) => {
  const key = QUARRY_GATE.rows[y]?.[x] ?? '.';
  return key === '=' ? 'road' : key === '^' || key === 'o' || key === 'X' ? 'limestone' : 'earth';
};
const worldPoint = (x: number, y: number) => ({
  x: 768 + (x - y) * 64,
  y: (x + y) * 32,
});

function groundAlphaAt(world: { x: number; y: number }): number {
  let alpha = 0;
  for (const { piece, image } of shippedGround) {
    if (
      world.x < piece.x ||
      world.x >= piece.x + piece.width ||
      world.y < piece.y ||
      world.y >= piece.y + piece.height
    )
      continue;
    const x = Math.min(
      image.width - 1,
      Math.floor(((world.x - piece.x) * image.width) / piece.width),
    );
    const y = Math.min(
      image.height - 1,
      Math.floor(((world.y - piece.y) * image.height) / piece.height),
    );
    alpha = Math.max(alpha, image.data[(y * image.width + x) * 4 + 3] ?? 0);
  }
  return alpha;
}

it('centers four low cover decals on the actual passable cover cells', () => {
  const cells = QUARRY_GATE.rows.flatMap((row, y) =>
    [...row].flatMap((key, x) => (key === 'c' ? [{ x, y }] : [])),
  );
  const decals = QUARRY_GATE_SCENE.ground.filter((piece) =>
    piece.url.endsWith('cover-timber.webp'),
  );
  expect(decals).toHaveLength(cells.length);
  for (const [index, cell] of cells.entries()) {
    const decal = decals[index];
    expect(decal).toMatchObject({
      x: 768 + (cell.x - cell.y) * 64 - 56,
      y: (cell.x + cell.y + 1) * 32 - 24,
      width: 112,
      height: 48,
    });
  }
});

it('uses bounded material regions over the procedural partial-ground base', () => {
  expect(QUARRY_GATE_SCENE.groundMode).toBe('partial');
  const regions = QUARRY_GATE_SCENE.ground.filter(
    (piece) =>
      !piece.url.endsWith('cover-timber.webp') &&
      !QUARRY_SURROUND.some((surround) => surround.url === piece.url),
  );
  expect(regions).toEqual(
    QUARRY_GATE_GROUND_REGIONS.map(({ name, ...region }) => ({
      url: `art/maps/quarry-gate-scene/${name}.webp`,
      ...region,
    })),
  );
  expect(regions.map((piece) => piece.url)).not.toContain(
    'art/maps/quarry-gate-scene/ground-west.webp',
  );
  expect(regions.map((piece) => piece.url)).not.toContain(
    'art/maps/quarry-gate-scene/ground-east.webp',
  );
  for (const region of regions) {
    expect(region.width).toBeLessThan(2304);
    expect(region.height).toBeLessThan(1280);
  }
});

it('carries the quarry surround beneath the local gatehouse materials', () => {
  // The gate is the quarry's own entrance: without the exterior mass the
  // board's diamond edge floats on bare backdrop. It must paint first so the
  // local earth, road and limestone still own every playable cell.
  const urls = QUARRY_GATE_SCENE.ground.map((piece) => piece.url);
  expect(QUARRY_GATE_SCENE.ground.slice(0, QUARRY_SURROUND.length)).toEqual([...QUARRY_SURROUND]);
  expect(urls.indexOf('art/maps/quarry-surround/west.webp')).toBeLessThan(
    urls.indexOf('art/maps/quarry-gate-scene/limestone.webp'),
  );
});

it('ships opaque material coverage at every ground center and material boundary', () => {
  for (let y = 0; y < QUARRY_GATE.height; y++)
    for (let x = 0; x < QUARRY_GATE.width; x++)
      expect(groundAlphaAt(worldPoint(x + 0.5, y + 0.5)), `center ${x},${y}`).toBeGreaterThan(240);

  for (let y = 0; y < QUARRY_GATE.height; y++)
    for (let x = 0; x < QUARRY_GATE.width; x++) {
      const current = groundClass(x, y);
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ] as const) {
        const neighbor = groundClass(x + dx, y + dy);
        if (neighbor === current || x + dx >= QUARRY_GATE.width || y + dy >= QUARRY_GATE.height)
          continue;
        for (const fraction of [0.25, 0.5, 0.75]) {
          const point =
            dx === 1 ? worldPoint(x + 1, y + fraction) : worldPoint(x + fraction, y + 1);
          expect(groundAlphaAt(point), `boundary ${x},${y} to ${x + dx},${y + dy}`).toBeGreaterThan(
            240,
          );
        }
      }
    }
});

it('uses exactly the existing 32 blocked wall cells and keeps their projected feet/depth aligned', () => {
  const cells = QUARRY_GATE.rows.flatMap((row, y) =>
    [...row].flatMap((key, x) => (key === '#' ? [{ x, y }] : [])),
  );
  expect(QUARRY_GATE_WALL_CELLS).toEqual(cells);
  const walls = QUARRY_GATE_SCENE.scenery.filter((piece) => piece.id.startsWith('quarry-wall-'));
  expect(walls).toHaveLength(32);
  expect(QUARRY_GATE.legend['#']).toMatchObject({ blocked: true, blocksSight: true });
  for (const wall of walls) {
    expect(wall.footprint).toHaveLength(1);
    const cell = wall.footprint[0];
    if (!cell) throw new Error('Missing wall footprint');
    const western = QUARRY_WEST_FRAMES.find((piece) => piece.id === wall.id);
    if (western) {
      expect(wall).toEqual(western);
      expect(western.fadeGroup).toBe('quarry-west-structure');
      expect(western.sourceRect.x + western.sourceRect.width).toBeLessThanOrEqual(1024);
      expect(western.sourceRect.y + western.sourceRect.height).toBeLessThanOrEqual(1543);
      const left = 768 + (cell.x - cell.y) * 64 - 64;
      expect(wall.x).toBeGreaterThanOrEqual(left);
      expect(wall.x + wall.width).toBeLessThanOrEqual(left + 128);
      expect(wall.y + wall.height).toBeLessThanOrEqual((cell.x + cell.y + 2) * 32);
      expect(wall.depth).toEqual({ x: cell.x + 0.5, y: cell.y + 0.5 });
    } else {
      expect([wall.width, wall.height]).toEqual([128, 176]);
      expect(wall.x + 64).toBe(768 + (cell.x - cell.y) * 64);
      expect(wall.y + 144).toBe((cell.x + cell.y + 1) * 32);
      expect((wall.depth.x + wall.depth.y) * 32).toBe(wall.y + 144);
    }
    expect(wall.fadeWhenOccluding).toBe(true);
  }
  expect(QUARRY_GATE.legend['^']?.blocked).not.toBe(true);
  expect(QUARRY_GATE.legend.c).toMatchObject({ terrain: 'wood', cover: true });
  expect(QUARRY_GATE.legend.c?.blocked).not.toBe(true);
});

it('stands a barred gate on every G cell and nowhere else', () => {
  const cells = QUARRY_GATE.rows.flatMap((row, y) =>
    [...row].flatMap((key, x) => (key === 'G' ? [{ x, y }] : [])),
  );
  expect(QUARRY_GATE_GATE_CELLS).toEqual(cells);
  expect(QUARRY_GATE.legend.G).toMatchObject({ terrain: 'wood', blocked: true, blocksSight: true });
  const posts = QUARRY_GATE_SCENE.scenery.filter((piece) =>
    piece.id.startsWith('quarry-gate-post-'),
  );
  const standing = new Set(posts.flatMap((post) => post.footprint.map(({ x, y }) => `${x},${y}`)));
  expect([...standing].sort()).toEqual(cells.map(({ x, y }) => `${x},${y}`).sort());
  for (const post of posts) {
    // The gatehouse's own jamb post, so the gate is its timber and iron.
    expect(post.url).toBe('art/maps/quarry-gate-scene/west-structure.webp');
    expect(post.sourceRect).toBeDefined();
    const cell = post.footprint[0];
    if (!cell) throw new Error('Missing gate footprint');
    // Each post stands on its own cell's centre line and sorts by its foot.
    expect(post.depth.y).toBe(cell.y + 0.5);
    expect(Math.floor(post.depth.x)).toBe(cell.x);
    const footY = (post.depth.x + post.depth.y) * 32;
    expect(post.y + post.height).toBeGreaterThanOrEqual(footY);
    expect(post.y + post.height).toBeLessThanOrEqual(footY + 8);
    expect(post.fadeWhenOccluding).toBe(true);
    // A gate is wood, not wall: the `wall` guard would hide it on every grid.
    expect(post.wall).toBeUndefined();
  }
});

it('dresses every declared rim band from existing exterior pieces, off the playable diamond', () => {
  const bands = (QUARRY_GATE.edges ?? []).map(({ side, span }) => `${side} ${span.join('-')}`);
  expect(bands.sort()).toEqual(
    QUARRY_GATE_BAND_ROWS.flatMap((top) =>
      ['west', 'east'].map((side) => `${side} ${top}-${top + 1}`),
    ).sort(),
  );
  const pieces = QUARRY_GATE_SCENE.scenery.filter(
    (piece) =>
      piece.id.startsWith('quarry-gate-cribbing-') || piece.id.startsWith('quarry-gate-curtain-'),
  );
  for (const top of QUARRY_GATE_BAND_ROWS)
    for (const y of [top, top + 1]) {
      // West: the cribbed bank stands on the x=0 edge; east: the curtain on x=20.
      expect(
        pieces.some((p) => p.footprint.some((c) => c.x === -1 && c.y === y)),
        `west ${y}`,
      ).toBe(true);
      expect(
        pieces.some((p) => p.footprint.some((c) => c.x === 20 && c.y === y)),
        `east ${y}`,
      ).toBe(true);
    }
  for (const piece of pieces) {
    expect(piece.exterior).toBe(true);
    for (const cell of piece.footprint)
      expect(cell.x < 0 || cell.x >= QUARRY_GATE.width, `${piece.id} is off the board`).toBe(true);
  }
  // The cribbing's base runs down its two rows of the x=0 edge exactly.
  for (const top of QUARRY_GATE_BAND_ROWS) {
    const bank = pieces.find((p) => p.id === `quarry-gate-cribbing-${top}`);
    if (!bank) throw new Error(`no cribbing at ${top}`);
    expect({ x: bank.x, right: bank.x + bank.width }).toEqual({
      x: worldPoint(0, top + 2).x,
      right: worldPoint(0, top).x,
    });
    expect(bank.flip).toBe(true);
  }
});

it('selects bonded interiors, exposed ends and corners from actual cardinal wall adjacency', () => {
  expect(quarryWallVariant({ x: 5, y: 0 })).toBe('interior');
  expect(quarryWallVariant({ x: 4, y: 0 })).toBe('corner');
  expect(quarryWallVariant({ x: 4, y: 1 })).toBe('end');
  expect(quarryWallVariant({ x: 17, y: 10 })).toBe('end');
  expect(quarryWallVariant({ x: 17, y: 11 })).toBe('corner');
});
