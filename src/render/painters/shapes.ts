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

/** How far down-screen the contact shadow falls, as a fraction of the box. */
const SHADOW_FALL = 0.025;

/**
 * Soft contact shadow so a figure sits on the tile rather than floating.
 *
 * The anchor is the one every painter, the sprite cache and the baked sheets
 * already share — the object's foot at `0.86` of its box — so a baked frame
 * and a live sprite still stand on the same line. Two things changed. The old
 * flat black ellipse ended on a hard rim that read as a dark sticker, and it
 * was narrow enough that the rim sat under the object, where a shadow can
 * ground nothing. Now a radial gradient holds its density at the contact and
 * feathers across the outer half of the radius, the ellipse falls a hair
 * down-screen the way the board's ledge and cliff shadows do, and callers size
 * `width` to their art so the feathered rim shows around the base. The fade
 * still finishes inside the footprint, so a sprite never paints outside the
 * box it was given.
 */
export function groundShadow(ctx: Ctx, box: Box, width = 0.46): void {
  const rx = (box.size * width) / 2;
  const ry = box.size * 0.09;
  if (!(rx > 0) || !(ry > 0)) return;

  ctx.save();
  ctx.translate(box.x + box.size / 2, box.y + box.size * (0.86 + SHADOW_FALL));
  ctx.scale(1, ry / rx);
  const shade = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  shade.addColorStop(0, 'rgba(0,0,0,0.34)');
  shade.addColorStop(0.5, 'rgba(0,0,0,0.26)');
  shade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shade;
  circle(ctx, 0, 0, rx);
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
