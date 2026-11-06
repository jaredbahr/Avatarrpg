/**
 * Ba Dan's top-down ground (ADR 0104 T3) ships exactly what the layout bakes to, and the bake holds
 * the measurable rules of `docs/art-lessons.md`: every static shadow at least 25 % darker than the
 * clean ground beside it where that ground allows it, no halo pixel on any object's foot, and no
 * terrain or rim edge that looks straight for more than two tiles.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { decodeWebp, isLosslessWebp } from '../lib/webp';
import { measureStyle } from '../lib/colours';
import { haloPixels, rimEdge, shadowTable, straightEdge, terrainEdge } from './ground-checks';
import {
  ASSETS,
  CLASS,
  DATA,
  OUT,
  bake,
  bakedDisc,
  bridgeCast,
  dehalo,
  packBaDanGround,
} from './pack-ground';
import { readPng } from '../lib/image';
import { PLATE_W } from '../../../src/content/scenes/baDan.topdown.terrain';

vi.setConfig({ testTimeout: 300_000, hookTimeout: 300_000 });

const baked = bake();
const files = await packBaDanGround(baked);

describe("Ba Dan's top-down ground", () => {
  it('bakes byte for byte the same twice', async () => {
    const again = await packBaDanGround(bake());
    expect([...again.keys()]).toEqual([...files.keys()]);
    for (const [path, content] of files) {
      const other = again.get(path);
      const a = typeof content === 'string' ? Buffer.from(content) : Buffer.from(content);
      const b = typeof other === 'string' ? Buffer.from(other) : Buffer.from(other ?? []);
      expect(a.equals(b), path).toBe(true);
    }
  });

  it('ships exactly what the layout bakes to (`pack-ground.ts --check`)', () => {
    for (const [path, content] of files) {
      const bytes = typeof content === 'string' ? Buffer.from(content) : Buffer.from(content);
      expect(bytes.equals(readFileSync(path)), `${path} is stale: run pack-ground.ts`).toBe(true);
    }
    const shipped = readdirSync(OUT).map((name) => `${OUT}/${name}`);
    expect(shipped.sort()).toEqual([...files.keys()].filter((path) => path !== DATA).sort());
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

  it('casts every visible static shadow at least 25 % darker where the ground allows', () => {
    const rows = shadowTable(baked).filter((r) => r.visible >= 20);
    expect(rows.length).toBeGreaterThan(50);
    const weak = rows.filter((r) => r.darker < r.needed);
    expect(weak, JSON.stringify(weak)).toEqual([]);
    // Most of the village's ground allows the full 25 %; the floor only bends on dark ground.
    expect(rows.filter((r) => r.needed >= 0.25).length).toBeGreaterThan(rows.length / 2);
  });

  it('leaves no halo pixel on any object', () => {
    const halos = baked.placed
      .map((p) => [p.o.id, haloPixels(p.img)] as const)
      .filter(([, n]) => n);
    expect(halos).toEqual([]);
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

  it('keeps every terrain and rim edge under two tiles straight, as the eye sees it', () => {
    expect(terrainEdge(baked).tiles).toBeLessThanOrEqual(2);
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
