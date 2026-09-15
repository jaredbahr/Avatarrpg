/**
 * Canvas primitives shared by every painter.
 *
 * Painters draw into a unit box — an (x, y, size) square in screen pixels —
 * using fractions of that size, never absolute pixels. That way the same
 * routine works at a 28px explore tile and a 64px combat tile, and the whole
 * thing keeps working when someone turns on Large text.
 */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export type Ctx = CanvasRenderingContext2D;

export function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function circle(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2);
  ctx.closePath();
}

export function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
  ctx.closePath();
}

export function polygon(ctx: Ctx, points: readonly (readonly [number, number])[]): void {
  if (points.length === 0) return;
  ctx.beginPath();
  const [first, ...rest] = points;
  if (!first) return;
  ctx.moveTo(first[0], first[1]);
  for (const [px, py] of rest) ctx.lineTo(px, py);
  ctx.closePath();
}

/** Soft contact shadow so a figure sits on the tile rather than floating. */
export function groundShadow(ctx: Ctx, box: Box, width = 0.46): void {
  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = '#000000';
  ellipse(
    ctx,
    box.x + box.size / 2,
    box.y + box.size * 0.86,
    box.size * width * 0.5,
    box.size * 0.09,
  );
  ctx.fill();
  ctx.restore();
}

/**
 * Deterministic pseudo-random in [0, 1) from two integers.
 *
 * Terrain detail (grass tufts, stone flecks) must be identical every frame or
 * the whole map shimmers. Seeding from the tile coordinate gives each tile a
 * stable personality with no state to store.
 */
export function tileNoise(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Stroke helper that keeps line width proportional to the box. */
export function outline(ctx: Ctx, box: Box, color: string, width = 0.035): void {
  ctx.lineWidth = Math.max(1, box.size * width);
  ctx.strokeStyle = color;
  ctx.stroke();
}
