/**
 * The top-down ground packer (ADR 0104 §3): every registered board ships exactly what it bakes to,
 * and every bake holds the measurable rules of `docs/art-lessons.md` (every static shadow at least
 * 25 % darker than the clean ground beside it where that ground allows it, no halo pixel on any
 * object's foot, no terrain edge that looks straight for more than two tiles, and every object
 * seated). Ba Dan's own pieces (the ford, the bridge, the plants it strips) follow.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { decodeWebp, isLosslessWebp } from '../lib/webp';
import { measureStyle } from '../lib/colours';
import {
  haloPixels,
  moundPixels,
  rimEdge,
  seatingTable,
  shadowTable,
  straightEdge,
  terrainEdge,
} from './ground-checks';
import { BOARDS } from './boards/index';
import { BA_DAN_BOARD, bridgeCast, pavedCells } from './boards/baDan';
import { ASSETS, CLASS, packBoard, sceneFile, type Baked, type TopDownBoard } from './lib/board';
import { bakedDisc, bakedMound, dehalo } from './lib/sprites';
import type { MapScene } from '../../../src/core/types';
import { readPng } from '../lib/image';
import { PLATE_W } from '../../../src/content/scenes/baDan.topdown.terrain';

vi.setConfig({ testTimeout: 300_000, hookTimeout: 300_000 });

interface Packed {
  readonly board: TopDownBoard;
  readonly baked: Baked;
  readonly files: Map<string, Uint8Array | string>;
}
const PACKED: readonly Packed[] = await Promise.all(
  BOARDS.map(async (board) => {
    const baked = board.bake();
    return { board, baked, files: await packBoard(board, baked) };
  }),
);
const BA_DAN = PACKED.find((p) => p.board === BA_DAN_BOARD) as Packed;
const bytesOf = (c: Uint8Array | string | undefined): Buffer =>
  typeof c === 'string' ? Buffer.from(c) : Buffer.from(c ?? []);

describe.each(PACKED.map((p) => [p.board.id, p] as const))('the %s board', (_id, packed) => {
  const { board, baked, files } = packed;
  // a board baked as its ground alone (the quarry's, #470, until its object layout lands) has no
  // object to shade, seat or strip yet
  const grounded = baked.placed.length > 0;

  it('bakes byte for byte the same twice', async () => {
    const again = await packBoard(board, board.bake());
    expect([...again.keys()]).toEqual([...files.keys()]);
    for (const [path, content] of files)
      expect(bytesOf(content).equals(bytesOf(again.get(path))), path).toBe(true);
  });

  it('ships exactly what the layout bakes to (`pack-ground.ts --check`)', () => {
    for (const [path, content] of files)
      expect(
        bytesOf(content).equals(readFileSync(path)),
        `${path} is stale: run pack-ground.ts`,
      ).toBe(true);
    const shipped = readdirSync(board.out).map((name) => `${board.out}/${name}`);
    expect(shipped.sort()).toEqual([...files.keys()].sort());
  });

  it('ships a few lossless pages with hard alpha', async () => {
    const pages = [...files].filter(([path]) => path.endsWith('.webp'));
    expect(pages.length).toBeLessThanOrEqual(4);
    for (const [path, content] of pages) {
      if (typeof content === 'string') throw new Error(path);
      expect(isLosslessWebp(content), path).toBe(true);
      expect(measureStyle(await decodeWebp(content)).soft, path).toBe(0);
    }
  });

  it.runIf(grounded)(
    'casts every visible static shadow at least 25 % darker where the ground allows',
    () => {
      const rows = shadowTable(baked).filter((r) => r.visible >= 20);
      expect(rows.length).toBeGreaterThan(0);
      const weak = rows.filter((r) => r.darker < r.needed);
      expect(weak, JSON.stringify(weak)).toEqual([]);
    },
  );

  it('leaves no halo pixel, baked disc or baked mound on any object', () => {
    const halos = baked.placed
      .map((p) => [p.o.id, haloPixels(p.img)] as const)
      .filter(([, n]) => n);
    expect(halos).toEqual([]);
    expect(baked.placed.filter((p) => bakedDisc(p.img).length).map((p) => p.o.id)).toEqual([]);
    expect(baked.placed.filter((p) => bakedMound(p.img)).map((p) => p.o.id)).toEqual([]);
  });

  it.runIf(grounded)(
    'seats every object: no gap, a full contact, a joined cast and no hover (owner, 2026-11-07)',
    () => {
      // "Shadows need to be seated so that objects look like they're a part of the world, not floating."
      const rows = seatingTable(baked);
      expect(rows.length).toBeGreaterThan(0);
      const failures = rows
        .filter((r) => r.gap.length || r.weak.length || r.loose || r.hover > 1)
        .map((r) => ({ id: r.id, gap: r.gap, weak: r.weak, loose: r.loose, hover: r.hover }));
      expect(failures, JSON.stringify(failures)).toEqual([]);
    },
  );

  it('keeps every terrain edge under two tiles straight, as the eye sees it', () => {
    expect(terrainEdge(baked).tiles).toBeLessThanOrEqual(2);
  });
});

describe("Ba Dan's top-down ground", () => {
  const { baked } = BA_DAN;

  it('shades most of the village at the full 25 %', () => {
    const rows = shadowTable(baked).filter((r) => r.visible >= 20);
    expect(rows.length).toBeGreaterThan(50);
    // Most of the village's ground allows the full 25 %; the floor only bends on dark ground.
    expect(rows.filter((r) => r.needed >= 0.25).length).toBeGreaterThan(rows.length / 2);
  });

  it("gives the scene the paved cells the bake laid, so a feet blob's strength matches the ground", () => {
    const paved = pavedCells(baked);
    const scene = JSON.parse(readFileSync(sceneFile(BA_DAN_BOARD), 'utf8')) as MapScene;
    expect(scene.pavedCells).toEqual(paved);
    // The lanes, the courts and the squares: a good share of the village, but not all of it.
    expect(paved.length).toBeGreaterThan(60);
    expect(paved.length).toBeLessThan(24 * 16 * 0.6);
  });

  it("draws the ford as a pool over the game's ford cells, clear of the open road beside it", () => {
    const at = (x: number, y: number) =>
      baked.classes[(y - baked.origin.y) * PLATE_W + x - baked.origin.x];
    // (0, 7) and (0, 8), at their centres, are water; (1, 7) and (1, 8), where a figure stands, are not
    for (const cy of [7, 8]) {
      expect(at(20, cy * 40 + 20)).toBe(CLASS.W);
      for (const [dx, dy] of [
        [0, 0],
        [-12, 0],
        [12, 0],
        [0, -8],
        [0, 8],
      ] as const)
        expect(at(60 + dx, cy * 40 + 20 + dy)).not.toBe(CLASS.W);
    }
  });

  it('strips the dark disc a sprite bakes under itself, and nothing else', () => {
    // v12's banner pole stands on a black ellipse; the bake grounds it instead.
    const raw = readPng(`${ASSETS}/objects12/banner_pole.png`);
    const pole = { width: raw.width, height: raw.height, data: new Uint8ClampedArray(raw.data) };
    expect(bakedDisc(pole).length).toBeGreaterThan(100);
    const discs = baked.placed
      .map((p) => [p.o.id, bakedDisc(p.img).length] as const)
      .filter(([, n]) => n);
    expect(discs).toEqual([]);
    // the pole keeps its own pixels: only the ring round it went
    const kept = baked.placed.find((p) => p.o.id === 'banner-north')?.img;
    let opaque = 0;
    for (let i = 3; i < (kept?.data.length ?? 0); i += 4) if (kept?.data[i]) opaque++;
    let before = 0;
    for (let i = 3; i < pole.data.length; i += 4) if (pole.data[i]) before++;
    expect(before - opaque).toBe(bakedDisc(pole).length);
  });

  it('measures the seat of the houses, trees, props and the bridge', () => {
    const rows = seatingTable(baked);
    const kinds = new Set(rows.map((r) => r.kind));
    for (const k of ['house', 'tree', 'prop', 'bridge']) expect(kinds.has(k), k).toBe(true);
    expect(rows.length).toBeGreaterThan(70);
    // most feet show; one hidden whole behind a piece in front (a rim bush behind a tree, the crate
    // under the south-east roof) is not seen, so not measured
    expect(rows.filter((r) => r.foot > 0).length).toBeGreaterThan(rows.length * 0.85);
  });

  it('strips the light mound a plant bakes under itself, and nothing else', () => {
    const raw = readPng(`${ASSETS}/objects12/bush.png`);
    expect(
      bakedMound({ width: raw.width, height: raw.height, data: new Uint8ClampedArray(raw.data) }),
    ).not.toBeNull();
    const mounds = baked.placed.filter((p) => bakedMound(p.img)).map((p) => p.o.id);
    expect(mounds).toEqual([]);
  });

  it('leaves no pixel of a baked mound or stump plate under any plant (owner, 2026-11-07)', () => {
    // the first strip kept the mound inside the root flare's columns: a brown plate with tan in it
    const raw = readPng(`${ASSETS}/objects12/bush.png`);
    expect(
      moundPixels({ width: raw.width, height: raw.height, data: new Uint8ClampedArray(raw.data) }),
    ).toBeGreaterThan(100);
    const plants = baked.placed.filter((p) => p.o.kind === 'tree');
    expect(new Set(plants.map((p) => p.o.sprite))).toEqual(
      new Set(['tree', 'tree_blossom', 'bush']),
    );
    const kept = plants.map((p) => [p.o.id, moundPixels(p.img)] as const).filter(([, n]) => n);
    expect(kept).toEqual([]);
    // and the stripped bush stands on its trunk alone: its foot is no wider than the trunk above it
    const bush = baked.placed.find((p) => p.o.sprite === 'bush')?.img;
    if (!bush) throw new Error('no bush');
    const span = (y: number): number => {
      let l = bush.width,
        r = -1;
      for (let x = 0; x < bush.width; x++)
        if ((bush.data[(y * bush.width + x) * 4 + 3] ?? 0) >= 128) {
          l = Math.min(l, x);
          r = Math.max(r, x);
        }
      return r - l + 1;
    };
    expect(span(bush.height - 1)).toBeLessThanOrEqual(span(bush.height - 4));
  });

  it('casts the bridge on the water to its lower right, as one hard shape', () => {
    const p = baked.placed.find((q) => q.o.kind === 'bridge');
    if (!p) throw new Error('no bridge');
    const m = bridgeCast(p, baked.classes);
    let n = 0,
      east = 0;
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < m.width; x++) {
        const v = m.alpha[y * m.width + x];
        if (!v) continue;
        n++;
        expect(v).toBe(125);
        expect(baked.classes[(p.y + y) * PLATE_W + p.x + x]).toBe(CLASS.W);
        if (x >= p.w) east++;
      }
    expect(n).toBeGreaterThan(100);
    expect(east).toBeGreaterThan(n / 3);
  });

  it("lays each prop's cast down as one shape, without streaks", () => {
    // a gap of up to 10 px between two shaded pixels in a row is a streak; the cast closes it
    for (const r of baked.shadows) {
      const p = baked.placed.find((q) => q.o.id === r.id);
      if (p?.o.kind !== 'prop') continue;
      const { width: W, height: H, alpha: A } = r.m;
      for (let y = 0; y < H; y++) {
        let last = -1;
        for (let x = 0; x < W; x++) {
          if (!A[y * W + x]) continue;
          const gap = last < 0 ? 0 : x - last - 1;
          expect(gap > 0 && gap <= 10, `${r.id} row ${y}`).toBe(false);
          last = x;
        }
      }
      let cast = 0;
      for (const v of A) if (v === 125) cast++;
      expect(cast, r.id).toBeGreaterThan(20);
    }
  });

  it('recolours a pale outline pixel on a foot, and only the outline', () => {
    // A 3x3 dark block with a pale grey pixel on its bottom edge and another in its middle.
    const data = new Uint8ClampedArray(9 * 4);
    for (let i = 0; i < 9; i++) data.set([60, 50, 40, 255], i * 4);
    data.set([200, 200, 195, 255], 7 * 4);
    data.set([200, 200, 195, 255], 4 * 4);
    const img = { width: 3, height: 3, data };
    expect(haloPixels(img)).toBe(1);
    const fixed = dehalo(img);
    expect(haloPixels(fixed)).toBe(0);
    expect([...fixed.data.slice(16, 20)]).toEqual([200, 200, 195, 255]);
  });

  it('keeps every rim edge under two tiles straight, as the eye sees it', () => {
    expect(rimEdge(baked).tiles).toBeLessThanOrEqual(2);
  });

  it('measures straightness as chains within 3 px, not exact runs', () => {
    // A 100 px boundary that steps by one pixel every 10 columns: no exact run passes 10 px, but it
    // reads ruler straight and must count as one edge.
    const W = 100,
      H = 12,
      cls = new Uint8Array(W * H);
    for (let x = 0; x < W; x++)
      for (let y = 0; y < H; y++) cls[y * W + x] = y > 4 + Math.floor(x / 40) ? 1 : 0;
    expect(straightEdge(cls, new Uint8Array(W * H), W, H).px).toBe(100);
    // A boundary that wanders 4 px every 8 columns breaks into short pieces.
    for (let x = 0; x < W; x++)
      for (let y = 0; y < H; y++) cls[y * W + x] = y > 2 + ((x >> 3) & 1) * 5 ? 1 : 0;
    expect(straightEdge(cls, new Uint8Array(W * H), W, H).px).toBeLessThan(20);
  });
});
