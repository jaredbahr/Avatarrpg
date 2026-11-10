/**
 * Adding a board is a config and a baker (#461): a stub board, written here with nothing but the
 * library's exports, packs into the same three files every board ships and passes the same seating
 * and shadow checks, with no edit to the library.
 */
import { describe, expect, it } from 'vitest';
import type { MapScene } from '../../../../src/core/types';
import type { TopDownObject } from '../../../../src/content/topdownLayout';
import { seatingTable, shadowTable } from '../ground-checks';
import {
  ASSETS,
  CLASS,
  packBoard,
  sceneFile,
  type Baked,
  type Placed,
  type TopDownBoard,
} from './board';
import { groundObject, seatFringe, shadowOptions, standingUprights } from './grounding';
import { blank, draw, load } from './raster';
import { cleanSprite } from './sprites';

/** A 4x3-cell meadow (a cell of margin round it) with one barrel standing in cell (2, 1). */
const ORIGIN = { x: -40, y: -40 };
const W = 6 * 40,
  H = 5 * 40;
const BARREL: TopDownObject = {
  id: 'barrel',
  sprite: 'barrel',
  kind: 'prop',
  x: 100,
  base: 76,
  footprint: [{ x: 2, y: 1 }],
  solid: true,
  depth: { x: 2.5, y: 1.9 },
};

function bakeStub(): Baked {
  const grass = load(`${ASSETS}/tiles/gc32/c0000.png`);
  const g = blank(W, H);
  for (let y = 0; y < H; y += 32) for (let x = 0; x < W; x += 32) draw(g, grass, x, y);
  const classes = new Uint8Array(W * H).fill(CLASS.G);
  const clean = { width: W, height: H, data: new Uint8ClampedArray(g.data) };
  const bare = { width: W, height: H, data: new Uint8ClampedArray(g.data) };
  const img = cleanSprite(load(`${ASSETS}/objects12/barrel.png`));
  const base = BARREL.base - ORIGIN.y;
  const p: Placed = {
    o: BARREL,
    img,
    x: Math.round(BARREL.x - ORIGIN.x - img.width / 2),
    y: base - img.height,
    w: img.width,
    h: img.height,
    base,
  };
  const { record, fringe } = groundObject(g, p, classes, true, shadowOptions(p));
  const fringes = new Map<Placed, typeof g>();
  if (fringe) {
    seatFringe(fringe, p, record.m, classes, 1, g);
    fringes.set(p, fringe);
  }
  const { cover, uprights } = standingUprights([p], fringes, g, ORIGIN);
  return {
    origin: ORIGIN,
    ground: g,
    clean,
    bare,
    classes,
    cover,
    shadows: [record],
    bridgeShadows: [],
    uprights,
    placed: [p],
  };
}

const STUB: TopDownBoard = {
  id: 'fixture.stub-board',
  out: 'public/art/topdown/stub',
  url: 'art/topdown/stub',
  bake: bakeStub,
  scene: (_baked, uprights): MapScene => ({
    ground: [
      { url: 'art/topdown/stub/ground.webp', x: ORIGIN.x, y: ORIGIN.y, width: W, height: H },
    ],
    scenery: uprights.map((u) => ({
      id: `stub.${u.id}`,
      url: 'art/topdown/stub/uprights.webp',
      sourceRect: u.sourceRect,
      x: u.x,
      y: u.y,
      width: u.width,
      height: u.height,
      footprint: BARREL.footprint,
      depth: BARREL.depth,
    })),
  }),
};

describe('a board is a config and a baker', () => {
  it('packs a stub board into its plate, its upright atlas and its scene', async () => {
    const files = await packBoard(STUB);
    expect([...files.keys()]).toEqual([
      'public/art/topdown/stub/ground.webp',
      'public/art/topdown/stub/uprights.webp',
      sceneFile(STUB),
    ]);
    const scene = JSON.parse(String(files.get(sceneFile(STUB)))) as MapScene;
    expect(scene.scenery).toHaveLength(1);
    expect(scene.scenery[0]?.sourceRect).toMatchObject({ x: 1, y: 1 });
  });

  it('holds the stub to the same seating and shadow checks as every board', () => {
    const baked = bakeStub();
    const seats = seatingTable(baked);
    expect(seats).toHaveLength(1);
    expect(seats[0]).toMatchObject({ gap: [], weak: [], loose: 0 });
    expect(seats[0]?.foot).toBeGreaterThan(10);
    const rows = shadowTable(baked);
    expect(rows.every((r) => r.darker >= r.needed)).toBe(true);
  });
});
