/**
 * Prop painters — code-drawn placeholders, same contract as the unit painters.
 *
 * The job here is silhouette recognition at a 40px tile. A child scanning the
 * battlefield needs to answer "is that a thing I can break, and roughly what
 * will happen if I do" in about a quarter of a second, so each prop is drawn as
 * one unmistakable shape on its element's palette: barrels are round and blue,
 * the brazier is a glowing bowl, the cart is a box on wheels with green on top.
 *
 * Every one is replaceable by pointing the manifest key at an image.
 */

import type { Palette } from '../palettes';
import type { Box, Ctx } from './shapes';
import { circle, groundShadow, outline, polygon, roundedRect } from './shapes';
import type { PainterOptions, UnitPainter } from './units';

function barrel(ctx: Ctx, box: Box, palette: Palette): void {
  const { x, y, size } = box;
  groundShadow(ctx, box, 0.5);

  const w = size * 0.52;
  const h = size * 0.56;
  const bx = x + (size - w) / 2;
  const by = y + size * 0.3;

  ctx.fillStyle = palette.dark;
  roundedRect(ctx, bx, by, w, h, size * 0.08);
  ctx.fill();
  outline(ctx, box, palette.ink);

  // Two hoops, so it reads as a barrel and not a crate.
  ctx.fillStyle = palette.light;
  ctx.fillRect(bx, by + h * 0.24, w, size * 0.045);
  ctx.fillRect(bx, by + h * 0.62, w, size * 0.045);

  // Open top, full of water.
  ctx.fillStyle = palette.accent;
  roundedRect(ctx, bx + w * 0.1, by - size * 0.03, w * 0.8, size * 0.1, size * 0.04);
  ctx.fill();
}

function flask(ctx: Ctx, box: Box, palette: Palette): void {
  const { x, y, size } = box;
  groundShadow(ctx, box, 0.34);

  const cx = x + size / 2;
  ctx.fillStyle = palette.dark;
  circle(ctx, cx, y + size * 0.64, size * 0.2);
  ctx.fill();
  outline(ctx, box, palette.ink);

  // Neck and stopper.
  ctx.fillStyle = palette.base;
  ctx.fillRect(cx - size * 0.06, y + size * 0.36, size * 0.12, size * 0.14);
  ctx.fillStyle = palette.ink;
  roundedRect(ctx, cx - size * 0.08, y + size * 0.31, size * 0.16, size * 0.07, size * 0.02);
  ctx.fill();
}

function brazier(ctx: Ctx, box: Box, palette: Palette): void {
  const { x, y, size } = box;
  groundShadow(ctx, box, 0.42);

  const cx = x + size / 2;

  // Tripod legs.
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = Math.max(1, size * 0.045);
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.16, y + size * 0.86);
  ctx.lineTo(cx, y + size * 0.6);
  ctx.lineTo(cx + size * 0.16, y + size * 0.86);
  ctx.stroke();

  // Bowl.
  ctx.fillStyle = palette.dark;
  polygon(ctx, [
    [cx - size * 0.24, y + size * 0.44],
    [cx + size * 0.24, y + size * 0.44],
    [cx + size * 0.16, y + size * 0.62],
    [cx - size * 0.16, y + size * 0.62],
  ]);
  ctx.fill();
  outline(ctx, box, palette.ink);

  // Coals.
  ctx.fillStyle = palette.accent;
  circle(ctx, cx, y + size * 0.42, size * 0.13);
  ctx.fill();
  ctx.fillStyle = palette.light;
  circle(ctx, cx - size * 0.05, y + size * 0.4, size * 0.05);
  ctx.fill();
}

function hay(ctx: Ctx, box: Box, palette: Palette): void {
  const { x, y, size } = box;
  groundShadow(ctx, box, 0.54);

  const w = size * 0.62;
  const h = size * 0.44;
  const bx = x + (size - w) / 2;
  const by = y + size * 0.42;

  ctx.fillStyle = palette.base;
  roundedRect(ctx, bx, by, w, h, size * 0.06);
  ctx.fill();
  outline(ctx, box, palette.ink);

  // Binding twine, and a few loose stalks so it is obviously flammable.
  ctx.strokeStyle = palette.dark;
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.beginPath();
  ctx.moveTo(bx + w * 0.3, by);
  ctx.lineTo(bx + w * 0.3, by + h);
  ctx.moveTo(bx + w * 0.7, by);
  ctx.lineTo(bx + w * 0.7, by + h);
  ctx.stroke();
}

function rubble(ctx: Ctx, box: Box, palette: Palette): void {
  const { x, y, size } = box;
  groundShadow(ctx, box, 0.58);

  const cx = x + size / 2;
  ctx.fillStyle = palette.dark;
  polygon(ctx, [
    [cx - size * 0.3, y + size * 0.84],
    [cx - size * 0.14, y + size * 0.46],
    [cx + size * 0.06, y + size * 0.56],
    [cx + size * 0.22, y + size * 0.4],
    [cx + size * 0.32, y + size * 0.84],
  ]);
  ctx.fill();
  outline(ctx, box, palette.ink);

  ctx.fillStyle = palette.light;
  circle(ctx, cx - size * 0.1, y + size * 0.66, size * 0.06);
  ctx.fill();
  circle(ctx, cx + size * 0.14, y + size * 0.7, size * 0.05);
  ctx.fill();
}

function cart(ctx: Ctx, box: Box, palette: Palette): void {
  const { x, y, size } = box;
  groundShadow(ctx, box, 0.6);

  const w = size * 0.64;
  const bx = x + (size - w) / 2;
  const by = y + size * 0.46;
  const h = size * 0.28;

  // Cart body.
  ctx.fillStyle = palette.dark;
  roundedRect(ctx, bx, by, w, h, size * 0.04);
  ctx.fill();
  outline(ctx, box, palette.ink);

  // Stacked far too high, which is the entire joke.
  ctx.fillStyle = '#6fbf73';
  for (const [dx, dy, r] of [
    [0.18, -0.1, 0.1],
    [0.42, -0.16, 0.11],
    [0.66, -0.09, 0.1],
    [0.3, -0.26, 0.09],
    [0.55, -0.27, 0.09],
  ] as const) {
    circle(ctx, bx + w * dx, by + size * dy, size * r);
    ctx.fill();
  }

  // Wheels.
  ctx.fillStyle = palette.ink;
  circle(ctx, bx + w * 0.22, by + h + size * 0.04, size * 0.07);
  ctx.fill();
  circle(ctx, bx + w * 0.78, by + h + size * 0.04, size * 0.07);
  ctx.fill();
}

function crate(ctx: Ctx, box: Box, palette: Palette): void {
  const { x, y, size } = box;
  groundShadow(ctx, box, 0.5);
  ctx.fillStyle = palette.dark;
  roundedRect(ctx, x + size * 0.26, y + size * 0.36, size * 0.48, size * 0.48, size * 0.05);
  ctx.fill();
  outline(ctx, box, palette.ink);
}

const SHAPES: Record<string, (ctx: Ctx, box: Box, palette: Palette) => void> = {
  barrel,
  flask,
  brazier,
  hay,
  rubble,
  cart,
  crate,
};

/** Single entry point registered as the `prop` painter. */
export const paintProp: UnitPainter = (
  ctx: Ctx,
  box: Box,
  palette: Palette,
  options: PainterOptions,
) => {
  const shape = SHAPES[options.variant ?? 'crate'] ?? crate;
  ctx.save();
  shape(ctx, box, palette);
  ctx.restore();
};
