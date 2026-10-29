import { describe, expect, it } from 'vitest';
import {
  PIXEL_MARK_MAX_SIDE,
  PixelMarkRasterCache,
  pixelMarkChunks,
  pixelMarkRasterKey,
  placePixelMark,
  rasterizePixelMark,
  snapWorldPixel,
  snapWorldPoints,
} from './pixelMarks';
import type { PixelMarkSpec } from './pixelMarks';
import { PixelMarkDrawableCache } from './pixelMarkDrawables';
import { pixelMarkChunkPlans } from './pixelMarks';
import { talkPipMark } from './pixelOverlayGeometry';

const COLORS = {
  gold: 'rgba(240, 198, 116, 0.6)',
  ink: '#1b1410',
  rust: 'rgba(226, 88, 74, 0.9)',
} as const;

const MARK: PixelMarkSpec = {
  bounds: { left: -4, top: -4, width: 9, height: 9 },
  palette: COLORS,
  operations: [
    {
      kind: 'polygon',
      color: 'gold',
      points: [
        { x: -3, y: -2 },
        { x: 2, y: -2 },
        { x: 0, y: 2 },
      ],
      outline: { color: 'ink', width: 1 },
    },
    {
      kind: 'line',
      color: 'rust',
      points: [
        { x: 3, y: -3 },
        { x: 3, y: 3 },
      ],
      width: 2,
      dash: { on: 2, off: 1, phase: 1 },
    },
    {
      kind: 'circle',
      color: 'ink',
      centre: { x: -2, y: 3 },
      radius: 1,
      fill: true,
    },
  ],
};

function rgbaColors(data: Uint8ClampedArray): Set<string> {
  const colors = new Set<string>();
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) > 0) {
      colors.add(`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`);
    }
  }
  return colors;
}

describe('G1 pixel marks', () => {
  it('rasterizes deterministically with hard alpha and only flat palette colours', () => {
    const first = rasterizePixelMark(MARK);
    const second = rasterizePixelMark(MARK);

    expect(second.data).toEqual(first.data);
    expect(first.width).toBe(9);
    expect(first.height).toBe(9);
    const alphas = new Set<number>();
    for (let i = 3; i < first.data.length; i += 4) {
      const alpha = first.data[i] ?? 0;
      if (alpha > 0) alphas.add(alpha);
    }
    expect([...alphas].sort((a, b) => a - b)).toEqual([153, 230, 255]);
    expect(rgbaColors(first.data)).toEqual(
      new Set(['240,198,116,153', '27,20,16,255', '226,88,74,230']),
    );
  });

  it('keeps the semantic anchor fixed when a small mask is placed at whole-pixel zoom', () => {
    const raster = rasterizePixelMark(MARK);
    const placement = placePixelMark(raster, { x: 128.4, y: 192.2 });

    expect(placement.anchor).toEqual({ x: 128, y: 192 });
    expect(placement.x - raster.left).toBe(placement.anchor.x);
    expect(placement.y - raster.top).toBe(placement.anchor.y);
    expect(snapWorldPixel(-2.5)).toBe(-3);
    expect(
      snapWorldPoints([
        { x: 0.4, y: 4.5 },
        { x: -2.5, y: -0.1 },
      ]),
    ).toEqual([
      { x: 0, y: 5 },
      { x: -3, y: 0 },
    ]);
  });

  it('keeps a moving talk pip on one anchor-independent raster source', () => {
    const first = talkPipMark({ x: 100, y: 120 }, 0.7);
    const moved = talkPipMark({ x: 101, y: 120 }, 0.4);

    expect(moved.spec).toEqual(first.spec);
    expect(moved.anchor).toEqual({ x: 101, y: 120 });
    expect(pixelMarkRasterKey(moved.spec)).toBe(pixelMarkRasterKey(first.spec));
  });

  it('rejects fractional coordinates, strokes outside 1–2 px, and oversized masks', () => {
    expect(() => rasterizePixelMark({ ...MARK, bounds: { ...MARK.bounds, left: 0.5 } })).toThrow(
      /integer/,
    );
    expect(() =>
      rasterizePixelMark({
        ...MARK,
        bounds: { ...MARK.bounds, width: PIXEL_MARK_MAX_SIDE + 1 },
      }),
    ).toThrow(/1\.\.256/);
    expect(() =>
      rasterizePixelMark({
        ...MARK,
        operations: [
          {
            kind: 'line',
            color: 'ink',
            points: [
              { x: -3, y: -3 },
              { x: 3, y: 3 },
            ],
            width: 3 as 1 | 2,
          },
        ],
      }),
    ).toThrow(/1 or 2 px/);
    expect(() =>
      rasterizePixelMark({
        ...MARK,
        bounds: { left: 0, top: 0, width: 4, height: 4 },
        operations: [
          {
            kind: 'line',
            color: 'ink',
            points: [
              { x: 0, y: 0 },
              { x: 4, y: 4 },
            ],
            width: 1,
          },
        ],
      }),
    ).toThrow(/stroke falls outside/);
  });

  it('reuses masks and evicts the least recently used entry within both bounds', () => {
    const cache = new PixelMarkRasterCache(1024 * 1024, 2);
    const a = cache.get(MARK);
    const bSpec = { ...MARK, operations: [MARK.operations[0]!] };
    const b = cache.get(bSpec);
    expect(cache.get(MARK)).toBe(a);

    const cSpec = { ...MARK, operations: [MARK.operations[2]!] };
    const c = cache.get(cSpec);
    expect(cache.size).toBe(2);
    expect(cache.byteLength).toBe(a.byteLength + c.byteLength);
    expect(cache.get(bSpec)).not.toBe(b);
  });

  it('does not cache an entry that would exceed its byte budget', () => {
    const raster = rasterizePixelMark(MARK);
    const cache = new PixelMarkRasterCache(raster.byteLength - 1);

    expect(cache.get(MARK).data).toEqual(raster.data);
    expect(cache.size).toBe(0);
    expect(cache.byteLength).toBe(0);
  });

  it('partitions long dashed paths and contours without seams or double alpha', () => {
    const longMark: PixelMarkSpec = {
      bounds: { left: -8, top: -8, width: 18, height: 18 },
      palette: COLORS,
      operations: [
        {
          kind: 'line',
          color: 'rust',
          points: [
            { x: -8, y: -6 },
            { x: -1, y: -1 },
            { x: 3, y: 2 },
            { x: 8, y: 6 },
          ],
          width: 2,
          dash: { on: 3, off: 2, phase: 1 },
        },
        {
          kind: 'polygon',
          color: 'gold',
          points: [
            { x: -7, y: -5 },
            { x: 6, y: -5 },
            { x: 6, y: 6 },
            { x: -7, y: 6 },
          ],
          outline: { color: 'ink', width: 1 },
        },
      ],
    };
    const reference = rasterizePixelMark(longMark);
    const chunks = [...pixelMarkChunks(longMark, longMark.bounds, 5)];
    const combined = new Uint8ClampedArray(reference.data.length);
    const coverage = new Uint8Array(reference.width * reference.height);

    for (const chunk of chunks) {
      const raster = chunk.raster;
      for (let y = 0; y < raster.height; y++) {
        for (let x = 0; x < raster.width; x++) {
          const targetX = raster.left - reference.left + x;
          const targetY = raster.top - reference.top + y;
          const targetPixel = targetY * reference.width + targetX;
          coverage[targetPixel] = (coverage[targetPixel] ?? 0) + 1;
          const from = (y * raster.width + x) * 4;
          const to = targetPixel * 4;
          combined.set(raster.data.slice(from, from + 4), to);
        }
      }
    }

    expect(chunks.every(({ raster }) => raster.width <= 5 && raster.height <= 5)).toBe(true);
    expect([...coverage].every((times) => times === 1)).toBe(true);
    expect(combined).toEqual(reference.data);
  });

  it('keeps chunk origins and raster objects stable when the visible clip pans by one pixel', () => {
    const cache = new PixelMarkRasterCache();
    const first = [
      ...pixelMarkChunks(longPathSpec(), { left: -8, top: -8, width: 8, height: 8 }, 5, cache),
    ];
    const panned = [
      ...pixelMarkChunks(longPathSpec(), { left: -7, top: -7, width: 8, height: 8 }, 5, cache),
    ];

    expect(first.map(({ raster }) => raster.key)).toEqual(panned.map(({ raster }) => raster.key));
    for (let i = 0; i < first.length; i++) {
      expect(panned[i]?.raster).toBe(first[i]?.raster);
      const raster = first[i]?.raster;
      if (raster) {
        expect(pixelMarkRasterKey(longPathSpec(), raster)).toBe(raster.key);
      }
    }
    expect(first[1]?.clip).not.toEqual(panned[1]?.clip);
  });

  it('visits only stable chunks that intersect the requested visible clip', () => {
    const visible = { left: 0, top: 0, width: 1, height: 1 };
    const chunks = [...pixelMarkChunks(longPathSpec(), visible, 1)];

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.raster).toMatchObject({ left: 0, top: 0, width: 1, height: 1 });
    expect(chunks[0]?.clip).toEqual(visible);
  });

  it('retains renderer sources for a visible set larger than the CPU raster LRU', () => {
    const spec: PixelMarkSpec = {
      bounds: { left: 0, top: 0, width: 1800, height: 900 },
      palette: { gold: COLORS.gold },
      operations: [
        {
          kind: 'polygon',
          color: 'gold',
          points: [
            { x: 0, y: 0 },
            { x: 1800, y: 0 },
            { x: 1800, y: 900 },
            { x: 0, y: 900 },
          ],
        },
      ],
    };
    let creates = 0;
    const cache = new PixelMarkDrawableCache((raster) => {
      creates += 1;
      return { rasterKey: raster.key };
    }, 1024);
    const draws = (visible = spec.bounds) => {
      const result = new Map<string, { rasterKey: string }>();
      cache.beginFrame();
      for (const plan of pixelMarkChunkPlans(spec, visible)) {
        const source = cache.get(spec, plan.bounds);
        if (source.drawable) {
          result.set(plan.key, source.drawable);
        }
      }
      cache.endFrame();
      return result;
    };

    const first = draws();
    const firstCount = creates;
    const repeated = draws();
    expect(first.size).toBeGreaterThan(16);
    for (const [key, source] of first) expect(repeated.get(key)).toBe(source);
    expect(creates).toBe(firstCount);
    expect(cache.rasterizationCount).toBe(firstCount);

    const panned = draws({ left: 1, top: 1, width: 510, height: 510 });
    const interiorKey = [...panned.keys()][0] ?? '';
    expect(panned.get(interiorKey)).toBe(first.get(interiorKey));
    expect(creates).toBe(firstCount);
  });
});

function longPathSpec(): PixelMarkSpec {
  return {
    bounds: { left: -8, top: -8, width: 18, height: 18 },
    palette: COLORS,
    operations: [
      {
        kind: 'line',
        color: 'rust',
        points: [
          { x: -8, y: -6 },
          { x: -1, y: -1 },
          { x: 3, y: 2 },
          { x: 8, y: 6 },
        ],
        width: 2,
        dash: { on: 3, off: 2, phase: 1 },
      },
    ],
  };
}
