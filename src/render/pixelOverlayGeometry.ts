import { TILE, type Camera } from './camera';
import type { OverlayKind } from './view';
import type { G1Bounds, G1Point, PixelMarkSpec, PixelOperation } from './pixelMarks';
import { snapWorldPoints } from './pixelMarks';

export interface PixelOverlayCue {
  readonly id: string;
  readonly spec: PixelMarkSpec;
  /** Optional snapped placement for geometry authored around local origin. */
  readonly anchor?: G1Point;
  /** Animation and actor fade stay outside the cached G1 source. */
  readonly alpha?: number;
}

export type OverlayPalette = (kind: OverlayKind) => [string, string | null];

/** Screen point to its stable board-pixel coordinate, before camera scale. */
export function screenToBoardPixel(camera: Camera, point: { x: number; y: number }): G1Point {
  return snapWorldPoints([
    {
      x: (point.x + camera.offsetX) / camera.scale,
      y: (point.y + camera.offsetY) / camera.scale,
    },
  ])[0] as G1Point;
}

export function pixelMark(
  id: string,
  operations: readonly PixelOperation[],
  palette: Readonly<Record<string, string>>,
  alpha = 1,
  padding = 2,
  anchor?: G1Point,
): PixelOverlayCue {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const operation of operations) {
    for (const point of operationPoints(operation)) {
      left = Math.min(left, point.x);
      top = Math.min(top, point.y);
      right = Math.max(right, point.x);
      bottom = Math.max(bottom, point.y);
    }
  }
  if (!Number.isFinite(left)) throw new Error('A pixel overlay mark needs geometry');
  left -= padding;
  top -= padding;
  right += padding + 1;
  bottom += padding + 1;
  const bounds: G1Bounds = {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
  return { id, spec: { bounds, palette, operations }, alpha, anchor };
}

/** A 1 px-per-world-pixel filled talk marker. */
export function talkPipMark(anchor: G1Point, alpha: number): PixelOverlayCue {
  return pixelMark(
    'talk',
    [{ kind: 'circle', color: 'gold', centre: { x: 0, y: 0 }, radius: 4, fill: true }],
    { gold: '#f0c674' },
    alpha,
    1,
    anchor,
  );
}

/** One helper shared by route and aim geometry so both snap at the same G1 stops. */
export function projectedPoints(
  camera: Camera,
  points: readonly { x: number; y: number }[],
): G1Point[] {
  return snapWorldPoints(points.map((point) => camera.groundPoint(point)));
}

export function boardPixelFromTile(camera: Camera, point: { x: number; y: number }): G1Point {
  return snapWorldPoints([camera.groundPoint(point)])[0] as G1Point;
}

/** The board-aligned world-pixel size used by tile-authored overlay geometry. */
export const WORLD_TILE_PIXELS = TILE;

function operationPoints(operation: PixelOperation): G1Point[] {
  if (operation.kind === 'circle') {
    return [
      { x: operation.centre.x - operation.radius, y: operation.centre.y - operation.radius },
      { x: operation.centre.x + operation.radius, y: operation.centre.y + operation.radius },
    ];
  }
  return [
    ...operation.points,
    ...(operation.kind === 'polygon' ? (operation.holes ?? []).flat() : []),
  ];
}

export function overlayPixelMarks(
  id: string,
  kind: OverlayKind,
  loops: readonly (readonly { x: number; y: number }[])[],
  camera: Camera,
  colors: OverlayPalette,
): PixelOverlayCue[] {
  const paths = loops.map((source) => ({ source, points: projectedPoints(camera, source) }));
  const outers = paths.filter(({ source }) => !isHolePath(source));
  const holes = paths.filter(({ source }) => isHolePath(source));
  const [fill, edge] = colors(kind);
  const marks: PixelOverlayCue[] = [];

  if (fill) {
    const operations: PixelOperation[] = outers.map(({ source, points }) => ({
      kind: 'polygon',
      color: 'fill',
      points,
      holes: holes
        .filter((hole) => {
          const probe = hole.source[0];
          return probe !== undefined && inside(probe, source);
        })
        .map((hole) => hole.points),
    }));
    if (operations.length) marks.push(pixelMark(`${id}:fill`, operations, { fill }, 1, 1));
  }

  if (edge) {
    const operations: PixelOperation[] = paths.map(({ points }) => ({
      kind: 'line',
      color: 'edge',
      points: points.length ? [...points, points[0] as G1Point] : [],
      width: 1,
    }));
    if (operations.length) marks.push(pixelMark(`${id}:edge`, operations, { edge }, 1, 2));
  }
  return marks;
}

function isHolePath(loop: readonly { x: number; y: number }[]): boolean {
  let area = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    if (a && b) area += a.x * b.y - b.x * a.y;
  }
  return area < 0;
}

function inside(
  point: { x: number; y: number },
  loop: readonly { x: number; y: number }[],
): boolean {
  let value = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i];
    const b = loop[j];
    if (
      a &&
      b &&
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      value = !value;
    }
  }
  return value;
}
