/**
 * The top-down ground packer (ADR 0104 §3): every registered board ships exactly what it bakes to,
 * and every bake holds the measurable rules of `docs/art-lessons.md` (every static shadow at least
 * 25 % darker than the clean ground beside it where that ground allows it, no halo pixel on any
 * object's foot, no terrain edge that looks straight for more than two tiles, and every object
 * seated). Ba Dan ships its ground alone (ADR 0120) until its set pieces stand on it, so it has none to seat yet.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeWebp, isLosslessWebp } from '../lib/webp';
import { measureStyle } from '../lib/colours';
import { haloPixels, seatingTable, shadowTable, straightEdge, terrainEdge } from './ground-checks';
import { BOARDS } from './boards/index';
import { packBoard, type Baked, type TopDownBoard } from './lib/board';
import { bakedDisc, bakedMound, dehalo } from './lib/sprites';

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

// Ba Dan's own object checks (the bridge cap and cast, the ford pool, the stripped discs and mounds, the seat of its
// houses) went with its old plates; its ground is baked again (ADR 0120, `ground.test.ts`), and they return with its
// set pieces at stage 5. The old baker is in the history.
describe('the ground checks', () => {
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
