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
 *   upper-left light, over a tighter ring of ambient occlusion. Authored ground
 *   packs add their material-specific wear beneath this shared layer.
 * Both are pixel art on the restyle's two-world-pixel grain: flat bands, never
 * a gradient or an ordered screen. The rasters are pure data; the backends
 * turn them into a canvas or a texture and draw them with nearest sampling.
 */
import type { SceneScenery, Vec2 } from '../core/types';

/** World pixels per texel, the grain of the restyled scenery and the garden. */
export const GROUNDING_GRAIN = 2;
/** Bible ink, the shadow colour. */
const INK = [27, 20, 16] as const;
/** How far the cast shadow falls, in tiles, toward +x (screen down-right) and +y. */
const CAST = { x: 0.14, y: 0.05 } as const;
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
 * Signed distance in tiles from a ground point to the nearest footprint cell:
 * negative inside. A single-cell contour is inset to match its narrower foot.
 */
export function footprintDistance(shape: Contour, p: Vec2, inset = shape.inset): number {
  let best = Infinity;
  const half = 0.5 - inset;
  for (const cell of shape.list) {
    best = Math.min(
      best,
      Math.max(Math.abs(p.x - cell.x - 0.5), Math.abs(p.y - cell.y - 0.5)) - half,
    );
  }
  return best;
}

/** Straight-alpha ink over the optional wear already in a texel. */
function ink(data: Uint8ClampedArray, i: number, alpha: number): void {
  const a0 = (data[i + 3] ?? 0) / 255;
  const a = alpha + a0 * (1 - alpha);
  if (a <= 0) return;
  for (let c = 0; c < 3; c++)
    data[i + c] = Math.round(((INK[c] ?? 0) * alpha + (data[i + c] ?? 0) * a0 * (1 - alpha)) / a);
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
      // The outermost band is flat and faint, the mean of the half-covered
      // ordered screen it replaces: a screen read as a checkerboard on the
      // painted ground, a faint band reads as the shadow's soft edge.
      const shadow = s < 0 ? 0.42 : s < 0.1 ? 0.34 : s < 0.2 ? 0.24 : s < 0.3 ? 0.07 : 0;
      const occlusion = d < 0.05 ? 0.36 : d < 0.12 ? 0.2 : 0;
      const alpha = 1 - (1 - shadow) * (1 - occlusion);
      if (alpha > 0) ink(data, at, alpha);
    }
  }
  return { x: x0 * g, y: y0 * g, width, height, data };
}
