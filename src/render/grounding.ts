/**
 * Seats upright scenery on the ground it stands on.
 *
 * Authored scenery is drawn exactly as painted, so a house, a stall or a tree
 * used to meet the ground with nothing between them: no shade under the
 * plinth, no wear where feet and rain gather, no grass over the foot. It read
 * as a sticker laid on the board. Everything here is keyed by the footprint
 * each piece already declares, so any map's scene gets it with no new data:
 *
 * - **Contact layer** (drawn with the ground, under every figure): a stepped
 *   contact shadow cast a little down-right, away from the art's warm
 *   upper-left light, over a tighter ring of ambient occlusion; and a ring of
 *   trodden earth where the piece meets grass.
 * - **Front tufts** (drawn just after their piece, still under a figure at
 *   the tie): a few blades along the footprint's two viewer-facing edges
 *   wherever grass meets it, overlapping the foot of the art. Their colours
 *   are stepped from the grass they grow from, so they belong to any map.
 *
 * Both are pixel art on the restyle's two-world-pixel grain: flat bands and an
 * ordered dither, never a gradient. The rasters are pure data; the backends
 * turn them into a canvas or a texture and draw them with nearest sampling.
 */
import type { SceneScenery, Vec2 } from '../core/types';

/** World pixels per texel, the grain of the restyled scenery and the garden. */
export const GROUNDING_GRAIN = 2;
/** Bible ink, the shadow colour. */
const INK = [27, 20, 16] as const;
/** Trodden-earth tones: the art bible's packed-earth road and grass-verge wear. */
const WEAR = [
  [0x8e, 0x70, 0x49],
  [0xb3, 0x90, 0x64],
] as const;
/** How far the cast shadow falls, in tiles, toward +x (screen down-right) and +y. */
const CAST = { x: 0.14, y: 0.05 } as const;
/** Shadow bands: [outer distance from the footprint in tiles, opacity]. */
const SHADOW_BANDS = [
  [0, 0.42],
  [0.1, 0.34],
  [0.2, 0.24],
  [0.3, 0.13],
] as const;
/** Ambient occlusion right at the foot, uncast: [outer distance, opacity]. */
const OCCLUSION_BANDS = [
  [0.05, 0.36],
  [0.12, 0.2],
] as const;
/** Trodden earth: [outer distance, share of texels dithered in]. */
const WEAR_BANDS = [
  [0.06, 0.8],
  [0.14, 0.45],
  [0.22, 0.15],
] as const;
const WEAR_OPACITY = 0.5;
/** A footprint's corners are rounded this much, in tiles. */
const ROUNDING = 0.22;
/**
 * A single-cell piece — a tree, a post — stands narrower than its cell, so
 * its foot (wear, occlusion, tufts) is drawn this far inside the cell's
 * edges. Its cast shadow still takes the whole cell: a canopy's shade is
 * wider than its trunk.
 */
const SINGLE_CELL_INSET = 0.24;
/** How far past its footprint a piece's grounding can reach, in tiles. */
const REACH = 0.5;

export interface Affine {
  /** Logical ground point (tiles) -> scene world pixels. */
  readonly toWorld: (pos: Vec2) => { x: number; y: number };
}

/** What lies at a logical ground point: grass takes wear and tufts, and its colour tints them. */
export type GroundSampler = (pos: Vec2) => { grass: boolean; rgb: readonly number[] } | null;

export interface GroundingRaster {
  /** Scene world pixels of the raster's top-left texel corner. */
  readonly x: number;
  readonly y: number;
  /** Texels. Each covers `GROUNDING_GRAIN` world pixels square. */
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

interface Inverse {
  readonly toWorld: (pos: Vec2) => { x: number; y: number };
  readonly toGround: (x: number, y: number) => Vec2;
}

/** The ground projection is affine; invert it from three points. */
function invert(affine: Affine): Inverse {
  const o = affine.toWorld({ x: 0, y: 0 });
  const ex = affine.toWorld({ x: 1, y: 0 });
  const ey = affine.toWorld({ x: 0, y: 1 });
  const a = ex.x - o.x;
  const b = ex.y - o.y;
  const c = ey.x - o.x;
  const d = ey.y - o.y;
  const det = a * d - b * c;
  return {
    toWorld: affine.toWorld,
    toGround: (x, y) => {
      const dx = x - o.x;
      const dy = y - o.y;
      return { x: (d * dx - c * dy) / det, y: (a * dy - b * dx) / det };
    },
  };
}

interface Contour {
  readonly cells: ReadonlySet<string>;
  readonly list: readonly Vec2[];
  readonly inset: number;
  readonly min: Vec2;
  readonly max: Vec2;
}

function contour(piece: SceneScenery): Contour {
  const list = piece.footprint;
  const xs = list.map((c) => c.x);
  const ys = list.map((c) => c.y);
  return {
    cells: new Set(list.map((c) => `${c.x},${c.y}`)),
    list,
    inset: list.length === 1 ? SINGLE_CELL_INSET : 0,
    min: { x: Math.min(...xs), y: Math.min(...ys) },
    max: { x: Math.max(...xs) + 1, y: Math.max(...ys) + 1 },
  };
}

/**
 * Signed distance in tiles from a ground point to a footprint drawn as
 * rounded boxes: negative inside. Cells are unit squares, each shrunk by the
 * contour's inset; corners round by `ROUNDING`.
 */
export function footprintDistance(shape: Contour, p: Vec2, inset = shape.inset): number {
  let best = Infinity;
  const half = 0.5 - inset - ROUNDING;
  for (const cell of shape.list) {
    const qx = Math.abs(p.x - (cell.x + 0.5)) - half;
    const qy = Math.abs(p.y - (cell.y + 0.5)) - half;
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
    const inside = Math.min(Math.max(qx, qy), 0);
    best = Math.min(best, outside + inside - ROUNDING);
  }
  return best;
}

/** 4x4 ordered-dither threshold in (0, 1), on the world texel lattice. */
export function bayer(tx: number, ty: number): number {
  const m = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  return ((m[(ty & 3) * 4 + (tx & 3)] ?? 0) + 0.5) / 16;
}

function bandOf(bands: readonly (readonly [number, number])[], distance: number): number {
  for (const [edge, value] of bands) if (distance < edge) return value;
  return 0;
}

/** Straight-alpha "over" of one colour onto a texel. */
function over(data: Uint8ClampedArray, i: number, rgb: readonly number[], alpha: number): void {
  const a0 = (data[i + 3] ?? 0) / 255;
  const a = alpha + a0 * (1 - alpha);
  if (a <= 0) return;
  for (let c = 0; c < 3; c++)
    data[i + c] = Math.round(((rgb[c] ?? 0) * alpha + (data[i + c] ?? 0) * a0 * (1 - alpha)) / a);
  data[i + 3] = Math.round(a * 255);
}

function worldBounds(inverse: Inverse, min: Vec2, max: Vec2) {
  const corners = [
    { x: min.x, y: min.y },
    { x: max.x, y: min.y },
    { x: min.x, y: max.y },
    { x: max.x, y: max.y },
  ].map(inverse.toWorld);
  const g = GROUNDING_GRAIN;
  return {
    x0: Math.floor(Math.min(...corners.map((p) => p.x)) / g),
    y0: Math.floor(Math.min(...corners.map((p) => p.y)) / g),
    x1: Math.ceil(Math.max(...corners.map((p) => p.x)) / g),
    y1: Math.ceil(Math.max(...corners.map((p) => p.y)) / g),
  };
}

/**
 * The contact layer for a whole scene: one raster under all its pieces. Two
 * pieces that stand together share one shadow rather than doubling it.
 */
export function contactRaster(
  scenery: readonly SceneScenery[],
  affine: Affine,
  sampler: GroundSampler,
): GroundingRaster | null {
  const pieces = scenery.filter((piece) => piece.footprint.length > 0).map(contour);
  if (pieces.length === 0) return null;
  const inverse = invert(affine);
  const reach = REACH + CAST.x + CAST.y;
  const boxes = pieces.map((shape) =>
    worldBounds(
      inverse,
      { x: shape.min.x - reach, y: shape.min.y - reach },
      { x: shape.max.x + reach, y: shape.max.y + reach },
    ),
  );
  const x0 = Math.min(...boxes.map((b) => b.x0));
  const y0 = Math.min(...boxes.map((b) => b.y0));
  const width = Math.max(...boxes.map((b) => b.x1)) - x0;
  const height = Math.max(...boxes.map((b) => b.y1)) - y0;
  // Nearest footprint distance, straight and cast, per texel.
  const straight = new Float32Array(width * height).fill(Infinity);
  const cast = new Float32Array(width * height).fill(Infinity);
  const g = GROUNDING_GRAIN;
  pieces.forEach((shape, index) => {
    const box = boxes[index];
    if (!box) return;
    for (let ty = box.y0; ty < box.y1; ty++) {
      for (let tx = box.x0; tx < box.x1; tx++) {
        const p = inverse.toGround((tx + 0.5) * g, (ty + 0.5) * g);
        const i = (ty - y0) * width + (tx - x0);
        straight[i] = Math.min(straight[i] ?? Infinity, footprintDistance(shape, p));
        cast[i] = Math.min(
          cast[i] ?? Infinity,
          footprintDistance(shape, { x: p.x - CAST.x, y: p.y - CAST.y }, 0),
        );
      }
    }
  });
  const data = new Uint8ClampedArray(width * height * 4);
  for (let ty = y0; ty < y0 + height; ty++) {
    for (let tx = x0; tx < x0 + width; tx++) {
      const i = (ty - y0) * width + (tx - x0);
      const d = straight[i] ?? Infinity;
      const s = cast[i] ?? Infinity;
      if (d > REACH && s > REACH) continue;
      const at = i * 4;
      const ground = d < 0.3 ? sampler(inverse.toGround((tx + 0.5) * g, (ty + 0.5) * g)) : null;
      if (ground?.grass && d >= 0 && bayer(tx, ty) < bandOf(WEAR_BANDS, d)) {
        const tone = WEAR[(tx * 7 + ty * 3) % 5 === 0 ? 1 : 0] ?? WEAR[0];
        over(data, at, tone, WEAR_OPACITY);
      }
      // The outermost band is dithered, so the shadow's edge breaks into
      // texels instead of reading as a drawn line.
      const shadow = s >= 0.2 && bayer(tx + 2, ty + 1) >= 0.5 ? 0 : bandOf(SHADOW_BANDS, s);
      const occlusion = bandOf(OCCLUSION_BANDS, d);
      const alpha = 1 - (1 - shadow) * (1 - occlusion);
      if (alpha > 0) over(data, at, INK, alpha);
    }
  }
  return { x: x0 * g, y: y0 * g, width, height, data };
}

/**
 * Grass tufts along a piece's two viewer-facing footprint edges, where grass
 * meets them. Null when nothing grows there.
 */
export function tuftRaster(
  piece: SceneScenery,
  affine: Affine,
  sampler: GroundSampler,
): GroundingRaster | null {
  if (piece.footprint.length === 0) return null;
  const shape = contour(piece);
  const inverse = invert(affine);
  const g = GROUNDING_GRAIN;
  // Roots along the front edges: +x and +y faces with no footprint beyond.
  const roots: { tx: number; ty: number; tones: (readonly number[])[] }[] = [];
  for (const cell of shape.list) {
    const faces = [
      { beyond: { x: cell.x + 1, y: cell.y }, from: { x: 1, y: 0 }, along: { x: 0, y: 1 } },
      { beyond: { x: cell.x, y: cell.y + 1 }, from: { x: 0, y: 1 }, along: { x: 1, y: 0 } },
    ];
    for (const [f, face] of faces.entries()) {
      if (shape.cells.has(`${face.beyond.x},${face.beyond.y}`)) continue;
      for (let k = 0; k < 4; k++) {
        const seed = tuftHash(cell.x, cell.y, f * 4 + k);
        if (seed > 0.75) continue;
        const t = shape.inset + (k + 0.2 + 0.6 * tuftHash(cell.x, cell.y, 9 + f * 4 + k)) *
          ((1 - 2 * shape.inset) / 4);
        const edge = {
          x: cell.x + face.from.x * (1 - shape.inset) + face.along.x * t,
          y: cell.y + face.from.y * (1 - shape.inset) + face.along.y * t,
        };
        // Sample just outside the edge: that is where the tuft grows from.
        const out = { x: edge.x + face.from.x * 0.12, y: edge.y + face.from.y * 0.12 };
        const ground = sampler(out);
        if (!ground?.grass) continue;
        const world = inverse.toWorld(edge);
        roots.push({
          tx: Math.floor(world.x / g),
          ty: Math.floor(world.y / g),
          tones: [0.62, 0.8, 1.14].map((k) =>
            ground.rgb.slice(0, 3).map((v) => Math.min(255, Math.round((v ?? 0) * k))),
          ),
        });
      }
    }
  }
  if (roots.length === 0) return null;
  // Texel rows from the root upward: [dx, tone index].
  const glyph: readonly (readonly [number, number][])[] = [
    [
      [-1, 0],
      [0, 0],
      [1, 0],
    ],
    [
      [-1, 0],
      [0, 1],
      [1, 0],
    ],
    [
      [-2, 1],
      [0, 1],
      [1, 1],
    ],
    [
      [-2, 1],
      [0, 2],
      [2, 1],
    ],
    [
      [-3, 2],
      [0, 2],
      [2, 2],
    ],
    [[-3, 2]],
  ];
  const x0 = Math.min(...roots.map((r) => r.tx)) - 3;
  const y0 = Math.min(...roots.map((r) => r.ty)) - glyph.length;
  const width = Math.max(...roots.map((r) => r.tx)) + 4 - x0;
  const height = Math.max(...roots.map((r) => r.ty)) + 2 - y0;
  const data = new Uint8ClampedArray(width * height * 4);
  for (const root of roots) {
    glyph.forEach((row, lift) => {
      for (const [dx, tone] of row) {
        const x = root.tx + dx - x0;
        const y = root.ty - lift - y0;
        const rgb = root.tones[tone];
        if (!rgb || x < 0 || y < 0 || x >= width || y >= height) continue;
        const i = (y * width + x) * 4;
        data[i] = rgb[0] ?? 0;
        data[i + 1] = rgb[1] ?? 0;
        data[i + 2] = rgb[2] ?? 0;
        data[i + 3] = 255;
      }
    });
  }
  return { x: x0 * g, y: y0 * g, width, height, data };
}

function tuftHash(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + (salt + 91) * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
