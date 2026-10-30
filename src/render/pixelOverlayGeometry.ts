import { TILE, type Camera } from './camera';
import { aimArcPoints, arcHeading, arrowheadPolygon } from './geometry/arc';
import { contourLoops } from './geometry/contour';
import type { Curve } from './geometry/curve';
import { nearestDistanceAlong, sampleAt, smoothPath } from './geometry/curve';
import { OVERLAY } from './palettes';
import type { AimArc, MapView, OverlayKind, TargetReticleCue } from './view';
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
const MAX_MARK_OPERATIONS = 256;

/** Keep the existing opacity rhythm, while holding cues steady for reduced motion. */
export function cueOpacity(
  time: number,
  period: number,
  reducedMotion: boolean | undefined,
  base = 1,
): number {
  const pulse = reducedMotion ? 1 : (Math.sin(time / period) + 1) / 2;
  return base * (0.55 + 0.35 * pulse);
}

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

export function selectedRingMark(
  anchor: G1Point,
  radiusX: number,
  radiusY: number,
): PixelOverlayCue {
  const points = snapWorldPoints(
    Array.from({ length: 32 }, (_, index) => {
      const angle = (index / 32) * Math.PI * 2;
      return { x: Math.cos(angle) * radiusX, y: Math.sin(angle) * radiusY };
    }),
  );
  return pixelMark(
    'selected-ring',
    [
      {
        kind: 'line',
        color: 'ring',
        points: [...points, points[0] as G1Point],
        width: 2,
      },
    ],
    { ring: 'rgba(255,255,255,0.6)' },
    1,
    2,
    anchor,
  );
}

export function koCrossMark(anchor: G1Point, width: number, alpha = 1): PixelOverlayCue {
  const halfWidth = Math.max(1, Math.round(width * 0.2));
  const halfHeight = Math.max(1, Math.round(TILE * 0.2));
  return pixelMark(
    'ko-cross',
    [
      {
        kind: 'line',
        color: 'ko',
        points: [
          { x: -halfWidth, y: -halfHeight },
          { x: halfWidth, y: halfHeight },
        ],
        width: 2,
      },
      {
        kind: 'line',
        color: 'ko',
        points: [
          { x: halfWidth, y: -halfHeight },
          { x: -halfWidth, y: halfHeight },
        ],
        width: 2,
      },
    ],
    { ko: 'rgba(226,88,74,0.85)' },
    alpha,
    2,
    anchor,
  );
}

export function exitMark(anchor: G1Point, alpha: number): PixelOverlayCue {
  return pixelMark(
    'exit',
    [
      {
        kind: 'circle',
        color: 'gold',
        centre: { x: 0, y: 0 },
        radius: 18,
        fill: false,
      },
      {
        kind: 'polygon',
        color: 'gold',
        points: [
          { x: -12, y: -16 },
          { x: 10, y: 0 },
          { x: -12, y: 16 },
          { x: -5, y: 0 },
        ],
      },
    ],
    { gold: '#f0c674' },
    alpha,
    2,
    anchor,
  );
}

/** Decorative enemy faction spike, preserving the existing cap polygon points. */
export function healthBarSpikeMark(
  anchor: G1Point,
  points: readonly G1Point[],
  fill: string,
  frame: string,
): PixelOverlayCue {
  const localPoints = snapWorldPoints(points);
  return pixelMark(
    'enemy-health-spike',
    [
      {
        kind: 'polygon',
        color: 'fill',
        points: localPoints,
        outline: { color: 'frame', width: 1 },
      },
    ],
    { fill, frame },
    1,
    2,
    anchor,
  );
}

export function targetReticleMark(
  anchor: G1Point,
  cue: Pick<TargetReticleCue, 'elevation' | 'obscured'>,
): PixelOverlayCue {
  const operations: PixelOperation[] = [];
  if (cue.elevation) {
    const direction = cue.elevation === 'above' ? -1 : 1;
    operations.push({
      kind: 'polygon',
      color: 'paper',
      points: [
        { x: -8, y: -direction * 5 },
        { x: 0, y: direction * 8 },
        { x: 8, y: -direction * 5 },
      ],
      outline: { color: 'ink', width: 2 },
    });
  }
  if (cue.obscured) {
    const cloudOffsetX = 17;
    operations.push({
      kind: 'polygon',
      color: 'paper',
      points: [
        { x: cloudOffsetX + 8, y: -1 },
        { x: cloudOffsetX + 9, y: 1 },
        { x: cloudOffsetX + 8, y: 4 },
        { x: cloudOffsetX - 8, y: 4 },
        { x: cloudOffsetX - 9, y: 2 },
        { x: cloudOffsetX - 8, y: -1 },
        { x: cloudOffsetX - 5, y: -4 },
        { x: cloudOffsetX - 2, y: -4 },
        { x: cloudOffsetX + 1, y: -6 },
        { x: cloudOffsetX + 5, y: -5 },
      ],
      outline: { color: 'ink', width: 2 },
    });
  }
  if (operations.length === 0) throw new Error('A target reticle mark needs an active cue');
  return pixelMark(
    'target-reticle',
    operations,
    { paper: OVERLAY.reticleCue, ink: OVERLAY.pathUnder },
    1,
    2,
    anchor,
  );
}

export function hoverCalmMark(pos: { x: number; y: number }, camera: Camera): PixelOverlayCue {
  const anchor = boardPixelFromTile(camera, pos);
  const loop = contourLoops([{ x: 0, y: 0 }])[0] ?? [];
  const origin = camera.groundPoint(pos);
  const points = snapWorldPoints(
    loop.map((point) => {
      const projected = camera.groundPoint({ x: pos.x + point.x, y: pos.y + point.y });
      return { x: projected.x - origin.x, y: projected.y - origin.y };
    }),
  );
  return pixelMark(
    'hover-calm',
    [
      {
        kind: 'line',
        color: 'calm',
        points: [...points, points[0] as G1Point],
        width: 2,
      },
    ],
    { calm: OVERLAY.calmPath },
    0.45,
    2,
    anchor,
  );
}

export function pathPixelMarks(
  view: Pick<
    MapView,
    'path' | 'pathFrom' | 'pathOrigin' | 'pathStart' | 'calmPath' | 'crispOverlays'
  >,
  camera: Camera,
  cachedCurve?: Curve,
): PixelOverlayCue[] {
  if (view.path.length === 0) return [];
  if (!view.pathFrom || (view.crispOverlays && !view.calmPath)) {
    return simplePathMarks(view.path, camera);
  }

  const curve = cachedCurve ?? smoothPath(view.pathFrom, view.path);
  const start = view.pathOrigin
    ? nearestDistanceAlong(curve, view.pathOrigin, view.pathStart, view.path.length)
    : 0;
  const first = sampleAt(curve, start).pos;
  const route = [
    first,
    ...curve.points.filter((_, index) => (curve.cumulative[index] ?? 0) > start),
  ];
  const points = projectedPoints(camera, route);
  if (points.length < 2) return simplePathMarks(view.path, camera);
  const calm = Boolean(view.calmPath);
  const marks = [
    pixelMark(
      'route-under',
      [{ kind: 'line', color: 'under', points, width: 2 }],
      { under: calm ? OVERLAY.calmPathUnder : OVERLAY.pathUnder },
      1,
      2,
    ),
    pixelMark(
      'route-line',
      [
        {
          kind: 'line',
          color: 'line',
          points,
          width: 1,
          ...(!calm ? { dash: { on: 14, off: 10, phase: 0 } } : {}),
        },
      ],
      {
        line:
          calm && view.crispOverlays
            ? OVERLAY.calmPathContrast
            : calm
              ? OVERLAY.calmPath
              : OVERLAY.path,
      },
      1,
      2,
    ),
  ];
  const end = sampleAt(curve, curve.length);
  const tip = boardPixelFromTile(camera, end.pos);
  if (calm) {
    marks.push(
      pixelMark(
        'route-end',
        [
          {
            kind: 'circle',
            color: 'line',
            centre: { x: 0, y: 0 },
            radius: Math.max(1, Math.round(TILE * OVERLAY.calmPathMarkerScale)),
            fill: false,
            width: 1,
          },
        ],
        {
          line: view.crispOverlays ? OVERLAY.calmPathContrast : OVERLAY.calmPath,
        },
        1,
        2,
        tip,
      ),
    );
  } else {
    const tangent = projectedTangent(end.tangent, camera);
    const polygon = flatPolygonPoints(
      arrowheadPolygon({ x: 0, y: 0 }, tangent, TILE * OVERLAY.pathArrowScale),
    );
    marks.push(
      pixelMark(
        'route-end',
        [{ kind: 'polygon', color: 'arrow', points: polygon }],
        { arrow: OVERLAY.path },
        1,
        2,
        tip,
      ),
    );
  }
  return marks;
}

export function aimArcPixelMarks(arc: AimArc, camera: Camera): PixelOverlayCue[] {
  const raw = aimArcPoints(arc.from, arc.to, arc.arc);
  const points = projectedPoints(camera, raw);
  if (points.length < 2) return [];
  const operations: PixelOperation[] = [
    { kind: 'line', color: 'under', points, width: 2 },
    ...points
      .filter((_, index) => index % 2 === 0 && index + 1 < points.length)
      .map((centre) => ({
        kind: 'circle' as const,
        color: 'element',
        centre,
        radius: 2,
        fill: true,
      })),
  ];
  const tip = boardPixelFromTile(camera, raw[raw.length - 1] ?? arc.to);
  const arrow = flatPolygonPoints(
    arrowheadPolygon({ x: 0, y: 0 }, projectedTangent(arcHeading(raw), camera), TILE),
  ).map(({ x, y }) => ({ x: x + tip.x, y: y + tip.y }));
  operations.push({
    kind: 'polygon',
    color: 'element',
    points: arrow,
  });
  return [pixelMark('aim-arc', operations, { under: OVERLAY.pathUnder, element: arc.color }, 1, 2)];
}

function simplePathMarks(
  path: readonly { x: number; y: number }[],
  camera: Camera,
): PixelOverlayCue[] {
  const centres = path.map((point) =>
    boardPixelFromTile(camera, { x: point.x + 0.5, y: point.y + 0.5 }),
  );
  const marks: PixelOverlayCue[] = [];
  const dots = centres.slice(0, -1);
  for (let start = 0; start < dots.length; start += MAX_MARK_OPERATIONS) {
    const operations: PixelOperation[] = dots
      .slice(start, start + MAX_MARK_OPERATIONS)
      .map((centre) => ({
        kind: 'circle',
        color: 'path',
        centre,
        radius: 5,
        fill: true,
      }));
    if (operations.length)
      marks.push(pixelMark(`route-dots:${start}`, operations, { path: OVERLAY.path }, 0.9, 6));
  }
  const tip = centres[centres.length - 1];
  if (tip) {
    marks.push(
      pixelMark(
        'route-arrow',
        [
          {
            kind: 'polygon',
            color: 'path',
            points: [
              { x: 0, y: -13 },
              { x: 10, y: 8 },
              { x: 0, y: 3 },
              { x: -10, y: 8 },
            ],
          },
        ],
        { path: OVERLAY.path },
        1,
        2,
        tip,
      ),
    );
  }
  return marks;
}

function flatPolygonPoints(flat: readonly number[]): G1Point[] {
  const points: G1Point[] = [];
  for (let index = 0; index + 1 < flat.length; index += 2) {
    points.push({ x: flat[index] ?? 0, y: flat[index + 1] ?? 0 });
  }
  return snapWorldPoints(points);
}

function projectedTangent(
  tangent: { x: number; y: number },
  camera: Camera,
): { x: number; y: number } {
  const x = camera.projection === 'oblique' ? tangent.x - tangent.y : tangent.x;
  const y = camera.projection === 'oblique' ? (tangent.x + tangent.y) / 2 : tangent.y;
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
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
