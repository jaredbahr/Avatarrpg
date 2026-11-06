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
import { DATA, OUT, bake, dehalo, packBaDanGround } from './pack-ground';

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
