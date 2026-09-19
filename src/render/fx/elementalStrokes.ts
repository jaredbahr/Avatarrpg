/** Bounded silhouettes shared by Canvas and WebGL, sampled on the flight clock. */
import type { Vec2 } from '../../core/types';
import type { StrokeEmitterDef } from '../../content/fx';
import type { Stroke } from './simulate';

/** Flow along the existing whip arc; endpoints and out/return clock stay fixed. */
export function flowingWhip(def: StrokeEmitterDef, t: number, from: Vec2, to: Vec2): Stroke[] {
  const reach = Math.sin(Math.PI * t);
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.001 || reach < 0.001) return [];
  const nx = -dy / distance,
    ny = dx / distance;
  const side = dx <= 0 ? 1 : -1;
  const point = (u: number): number[] => {
    // Two travelling ripples, tapered to zero at the hand and contact point.
    const sway =
      reach *
      (1.2 * side * u * (1 - u) +
        Math.sin(Math.PI * u) * Math.sin(u * Math.PI * 4 - t * Math.PI * 4) * 0.085);
    return [from.x + dx * reach * u + nx * sway, from.y + dy * reach * u + ny * sway];
  };
  const alpha = Math.min(1, (1 - t) * 5);
  const strokes: Stroke[] = [];
  const strand = (start: number, end: number, width: number) => {
    const line: number[] = [];
    for (let i = 0; i <= 32; i++) line.push(...point(start + ((end - start) * i) / 32));
    strokes.push({
      points: taperedRibbon(line, width * reach),
      width: 0.01,
      alpha,
      closed: true,
      fill: true,
    });
  };
  if (def.color === 'accent') {
    // Broken highlights carry flow through the body instead of a solid blade stripe.
    for (let i = 0; i < 3; i++) {
      const start = (i / 3 + t * 0.35) % 1;
      strand(start, Math.min(1, start + 0.19), def.width * 0.5);
    }
  } else {
    strand(0, 1, def.width * 0.5);
    // Three small falling beads follow the stream, never a cloud around the actors.
    for (let i = 0; i < 3; i++) {
      const u = 0.25 + i * 0.22;
      const [x = 0, y = 0] = point(u);
      const fall = 0.06 + Math.sin(Math.PI * t) * (0.07 + i * 0.02);
      const size = 0.022 * reach;
      strokes.push({
        points: [
          x,
          y + fall - size * 2,
          x + size,
          y + fall,
          x,
          y + fall + size,
          x - size,
          y + fall,
        ],
        width: 0.01,
        alpha: alpha * 0.75,
        closed: true,
        fill: true,
      });
    }
  }
  return strokes;
}

/** A ribbon with narrow ends, rather than a constant-width hose with round caps. */
export function taperedRibbon(points: readonly number[], width: number): number[] {
  const count = points.length / 2;
  const edges: number[][] = [[], []];
  for (let i = 0; i < count; i++) {
    const x = points[i * 2] ?? 0,
      y = points[i * 2 + 1] ?? 0;
    const previous = Math.max(0, i - 1) * 2,
      next = Math.min(count - 1, i + 1) * 2;
    const dx = (points[next] ?? x) - (points[previous] ?? x);
    const dy = (points[next + 1] ?? y) - (points[previous + 1] ?? y);
    const span = Math.hypot(dx, dy) || 1;
    const taper = Math.sin((Math.PI * i) / Math.max(1, count - 1)) * width;
    edges[0]?.push(x - (dy / span) * taper, y + (dx / span) * taper);
    edges[1]?.unshift(x + (dy / span) * taper, y - (dx / span) * taper);
  }
  return [...(edges[0] ?? []), ...(edges[1] ?? [])];
}

export function movingElement(
  def: StrokeEmitterDef,
  t: number,
  from: Vec2,
  to: Vec2,
  arc: number,
): Stroke[] {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.001 || t <= 0) return [];
  const length = Math.min(distance * t, def.reach);
  const wind = def.shape === 'gust';
  return Array.from({ length: def.count }, (_, i) => {
    const point = (u: number, sway: number): number[] => {
      const along = t - (length * (1 - u)) / distance;
      return [
        from.x + dx * along - (dy / distance) * sway,
        from.y + dy * along - arc * 4 * along * (1 - along) + (dx / distance) * sway,
      ];
    };
    if (!wind) {
      // A narrow leading point and broken trailing tongues distinguish a
      // flame from a symmetric glowing oval. Nested colours share this edge.
      const width = def.width * Math.min(1, length / 0.25);
      const tongues = [
        [1, 0],
        [0.72, -0.7],
        [0.12, -1],
        [0.32, -0.16],
        [0, -0.3],
        [0.24, 0.32],
        [0.08, 0.8],
        [0.62, 0.75],
      ];
      return {
        points: tongues.flatMap(([u, v]) => point(u ?? 0, (v ?? 0) * width)),
        width: 0.01,
        alpha: 1,
        closed: true,
        fill: true,
      };
    }
    const line: number[] = [];
    for (let step = 0; step <= 16; step++) {
      const u = step / 16;
      const lane = (i - (def.count - 1) / 2) * 0.18;
      const sway =
        lane * (1 - u * 0.7) + Math.sin(Math.PI * u) * Math.sin(u * Math.PI + t * 3) * 0.06;
      line.push(...point(u, sway));
    }
    return {
      points: taperedRibbon(line, def.width * Math.min(1, length / 0.25)),
      width: 0.01,
      alpha: 0.65 * Math.min(1, (1 - t) * 5),
      closed: true,
      fill: true,
    };
  });
}
