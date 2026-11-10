/**
 * Organic surfaces on top-down boards (#458): deterministic, held within the cap of their cells,
 * never on a blocked, pit or ledge-face cell centre, recomputed only over the dirty rectangle (and
 * then exactly as a whole-board recompute would be), frozen under reduce motion, and cheap enough
 * for an iPad on a full 20x12 board.
 */
import { describe, expect, it } from 'vitest';
import { buildGrid } from '../../core/rules/grid';
import type { Grid, MapDef, SurfaceId, Tile } from '../../core/types';
import { TOPDOWN_FIXTURE } from '../topdown.fixture';
import { CAP, CS, FACE_PX } from './organic';
import { flameCel, glowAlpha, MATERIALS, steamPuff, TopdownSurfaces } from './surfaces';

const map = (rows: string[]): MapDef => ({
  ...TOPDOWN_FIXTURE,
  width: rows[0]?.length ?? 0,
  height: rows.length,
  rows,
  legend: {
    '.': { terrain: 'grass' },
    '#': { terrain: 'wall' },
    o: { terrain: 'pit' },
    H: { terrain: 'stone', elevation: 1 },
  },
});

/** The grid with `surface` laid on each listed cell. */
function withSurfaces(grid: Grid, cells: readonly [number, number, SurfaceId][]): Grid {
  const tiles = grid.tiles.slice();
  for (const [x, y, id] of cells) {
    const i = y * grid.width + x;
    const tile = tiles[i] as Tile;
    tiles[i] = { ...tile, surface: { id, duration: 3, spread: 0 } as Tile['surface'] };
  }
  return { ...grid, tiles };
}

const empty = buildGrid(
  map(['..........', '..........', '..........', '..........', '..........', '..........']),
);
const A = withSurfaces(empty, [
  [1, 1, 'mud'],
  [2, 1, 'mud'],
  [2, 2, 'mud'],
  [6, 1, 'water'],
  [7, 1, 'water'],
  [6, 2, 'water'],
  [7, 2, 'water'],
  [1, 4, 'oil'],
  [2, 4, 'oil'],
  [5, 4, 'ice'],
  [8, 4, 'fire'],
  [8, 3, 'fire'],
  [4, 2, 'steam'],
]);

const fresh = (grid: Grid) => {
  const s = new TopdownSurfaces(grid);
  s.update(grid);
  return s;
};

describe('top-down surfaces', () => {
  it('are deterministic', () => {
    const a = fresh(A).art,
      b = fresh(A).art;
    expect(Buffer.from(a.layer.data).equals(Buffer.from(b.layer.data))).toBe(true);
    expect(a.flames).toEqual(b.flames);
    expect(a.steam).toEqual(b.steam);
    expect(a.flames.length).toBeGreaterThan(0);
    expect(a.steam.length).toBeGreaterThan(0);
  });

  it('paint opaque materials, fire’s char excepted', () => {
    const { layer } = fresh(A).art;
    const W = layer.width;
    const alphaAt = (x: number, y: number) => layer.data[(y * W + x) * 4 + 3];
    for (const [x, y] of [
      [1, 1],
      [6, 1],
      [1, 4],
      [5, 4],
    ] as const)
      expect(alphaAt(x * CS + 20, y * CS + 20), `${x},${y}`).toBe(255);
  });

  it('stay within the cap of their cells', () => {
    const s = fresh(A);
    const { layer } = s.art;
    const W = layer.width;
    const cells = A.tiles.flatMap((t, i) =>
      t.surface && t.surface.id !== 'steam' ? [{ x: i % A.width, y: Math.floor(i / A.width) }] : [],
    );
    for (let y = 0; y < layer.height; y++)
      for (let x = 0; x < W; x++) {
        if (!layer.data[(y * W + x) * 4 + 3]) continue;
        const d = Math.min(
          ...cells.map((c) =>
            Math.hypot(
              Math.max(0, c.x * CS - x, x - (c.x * CS + CS - 1)),
              Math.max(0, c.y * CS - y, y - (c.y * CS + CS - 1)),
            ),
          ),
        );
        // the wandering cap, plus the two majority passes' 2 px
        expect(d).toBeLessThanOrEqual(CAP + 2);
      }
  });

  it('never paint a blocked, pit or ledge-face cell centre', () => {
    const board = buildGrid(
      map(['..........', '..#o......', '..........', '....HH....', '..........']),
    );
    const g = withSurfaces(
      board,
      [
        [1, 1],
        [2, 1],
        [3, 1],
        [4, 1],
        [1, 2],
        [2, 2],
        [3, 2],
        [4, 4],
        [5, 4],
        [4, 3],
      ].map(([x, y]) => [x ?? 0, y ?? 0, 'water'] as [number, number, SurfaceId]),
    );
    const { layer } = fresh(g).art;
    const W = layer.width;
    const a = (x: number, y: number) => layer.data[(y * W + x) * 4 + 3];
    expect(a(2 * CS + 20, CS + 20)).toBe(0); // the wall
    expect(a(3 * CS + 20, CS + 20)).toBe(0); // the pit
    // the face a raised tier hangs over the cell below it
    for (let y = 4 * CS; y < 4 * CS + FACE_PX; y++) expect(a(4 * CS + 20, y)).toBe(0);
    expect(a(4 * CS + 20, 4 * CS + 20)).toBe(255);
  });

  it('recompute only the dirty rectangle, exactly as a fresh board', () => {
    const s = fresh(A);
    const B = withSurfaces(A, [[3, 3, 'mud']]);
    s.update(B);
    expect(s.lastDirty).toEqual({ x0: 2 * CS, y0: 2 * CS, x1: 5 * CS, y1: 5 * CS });
    const whole = fresh(B).art.layer.data;
    expect(Buffer.from(s.art.layer.data).equals(Buffer.from(whole))).toBe(true);
    // nothing changed: nothing recomputed
    const version = s.art.version;
    expect(s.update(B)).toBe(false);
    expect(s.lastDirty).toBeNull();
    expect(s.art.version).toBe(version);
  });

  it('recompute exactly when a surface goes, too', () => {
    const s = fresh(A);
    const tiles = A.tiles.map((t) => (t.surface?.id === 'water' ? { ...t, surface: null } : t));
    const C = { ...A, tiles };
    s.update(C);
    expect(Buffer.from(s.art.layer.data).equals(Buffer.from(fresh(C).art.layer.data))).toBe(true);
  });

  it('freeze under reduce motion', () => {
    const site = fresh(A).art.flames[0];
    if (!site) throw new Error('no flame');
    expect(flameCel(site, null, 8)).toBe(flameCel(site, null, 8));
    expect(new Set([0, 85, 170, 255].map((t) => flameCel(site, t, 8))).size).toBeGreaterThan(1);
    expect(glowAlpha(null)).toBe(0.16);
    for (let t = 0; t < 2000; t += 37) {
      expect(glowAlpha(t)).toBeGreaterThanOrEqual(0.04);
      expect(glowAlpha(t)).toBeLessThanOrEqual(0.2);
    }
    const puff = fresh(A).art.steam[0];
    if (!puff) throw new Error('no steam');
    expect(steamPuff(puff, 0)).toEqual(steamPuff(puff, 0));
  });

  /*
   * The iPad budget. A full recompute of a 20x12 board under a typical heavy load (a pool, a mud
   * patch, an oil slick, ice, a fire and steam: 30 cells, seven masks) measured 50-120 ms warm in
   * Node on the dev container, the high end with the whole test suite running beside it. A recent
   * iPad runs JS at about a desktop core's speed. A recompute happens only when a surface changes
   * (an ability resolves, a round ticks), never per frame, and only over its dirty rectangle, so the
   * threshold is 500 ms: a quarter of a two-second resolve, and four times the loaded measurement,
   * which is the margin. The first run warms the JIT and is not measured.
   */
  it('recompute a full 20x12 board inside the iPad budget', () => {
    const big = buildGrid(map(Array.from({ length: 12 }, () => '.'.repeat(20))));
    const load: [number, number, SurfaceId][] = [];
    const patch = (x0: number, y0: number, w: number, h: number, id: SurfaceId) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) load.push([x, y, id]);
    };
    patch(2, 2, 3, 2, 'water');
    patch(8, 3, 2, 2, 'mud');
    patch(13, 6, 3, 1, 'oil');
    patch(4, 8, 2, 2, 'ice');
    patch(15, 2, 2, 3, 'fire');
    patch(10, 9, 2, 1, 'steam');
    const g = withSurfaces(big, load);
    new TopdownSurfaces(g).update(g);
    const t0 = performance.now();
    const s = new TopdownSurfaces(g);
    s.update(g);
    const ms = performance.now() - t0;
    expect(s.lastDirty).not.toBeNull();
    expect(ms).toBeLessThan(500);
  });

  it('cover every material', () => {
    expect([...MATERIALS]).toEqual(['mud', 'water', 'oil', 'ice', 'fire']);
  });
});
