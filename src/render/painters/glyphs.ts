/**
 * Action glyphs — the small marks on an action button and a status chip.
 *
 * These exist because the action bar was a wall of same-sized words. A player
 * choosing between "Fire Blast", "Flame Arc" and "Fire Step" reads three
 * near-identical labels; a nine-year-old reads none of them and taps the first
 * one. A mark in front of the label is the difference between scanning and
 * reading, and it is the only thing in the HUD that can be told apart at a
 * glance across the table.
 *
 * The shapes are the art bible's own grammar, not invented here: fire as
 * ribbons and licks, water as whips and sheets, earth as slabs and shards, air
 * as spirals and arcs, non-benders as tools. Drawing each element the way its
 * effects are drawn means the glyph and the bending it launches read as the
 * same language.
 *
 * Bible rules that apply to a 24-pixel mark as much as to a sprite: a uniform
 * brown ink outline and never black, two tones per material plus a rim light,
 * no gradients. `size * fraction` throughout, so one routine serves the 1.4rem
 * button mark and the 2.4rem chip alike, at any Large-text setting.
 *
 * Keyed `glyph.<name>` through the asset manifest like everything else, so a
 * drawn icon set can replace the lot by changing entries rather than code.
 */

import type { Palette } from '../palettes';
import type { Box, Ctx } from './shapes';
import { circle, polygon } from './shapes';

export interface GlyphOptions {
  readonly variant?: string;
}

/** Stroke weight that stays a line rather than a smudge at 24 px. */
function ink(ctx: Ctx, size: number, palette: Palette, weight = 0.07): void {
  ctx.lineWidth = Math.max(1, size * weight);
  ctx.strokeStyle = palette.ink;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Fill, ink, then a rim light on the lit (upper-left) edge. */
function cel(ctx: Ctx, size: number, palette: Palette, fill: string, rim = true): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ink(ctx, size, palette);
  if (!rim) return;
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = palette.light;
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.stroke();
  ctx.restore();
}

/* A lick of flame: a ribbon that leans, with a second tongue inside it. */
function fire(ctx: Ctx, cx: number, cy: number, s: number, palette: Palette): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.4);
  ctx.bezierCurveTo(
    cx + s * 0.3,
    cy - s * 0.1,
    cx + s * 0.26,
    cy + s * 0.12,
    cx + s * 0.1,
    cy + s * 0.3,
  );
  ctx.bezierCurveTo(
    cx - s * 0.02,
    cy + s * 0.4,
    cx - s * 0.3,
    cy + s * 0.34,
    cx - s * 0.26,
    cy + s * 0.06,
  );
  ctx.bezierCurveTo(cx - s * 0.22, cy - s * 0.12, cx - s * 0.06, cy - s * 0.18, cx, cy - s * 0.4);
  ctx.closePath();
  cel(ctx, s, palette, palette.base);

  ctx.beginPath();
  ctx.moveTo(cx + s * 0.02, cy - s * 0.06);
  ctx.bezierCurveTo(
    cx + s * 0.16,
    cy + s * 0.08,
    cx + s * 0.08,
    cy + s * 0.24,
    cx - s * 0.02,
    cy + s * 0.26,
  );
  ctx.bezierCurveTo(
    cx - s * 0.14,
    cy + s * 0.24,
    cx - s * 0.14,
    cy + s * 0.04,
    cx + s * 0.02,
    cy - s * 0.06,
  );
  ctx.closePath();
  ctx.fillStyle = palette.light;
  ctx.fill();
}

/* A whip of water: a crescent sheet trailing into a bead. */
function water(ctx: Ctx, cx: number, cy: number, s: number, palette: Palette): void {
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.32, cy - s * 0.24);
  ctx.bezierCurveTo(
    cx + s * 0.08,
    cy - s * 0.36,
    cx + s * 0.32,
    cy - s * 0.04,
    cx + s * 0.2,
    cy + s * 0.28,
  );
  ctx.bezierCurveTo(
    cx + s * 0.16,
    cy + s * 0.06,
    cx - s * 0.04,
    cy - s * 0.12,
    cx - s * 0.32,
    cy - s * 0.24,
  );
  ctx.closePath();
  cel(ctx, s, palette, palette.base);

  // The bead the whip is about to throw.
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.16, cy + s * 0.12);
  ctx.bezierCurveTo(
    cx - s * 0.02,
    cy + s * 0.22,
    cx - s * 0.02,
    cy + s * 0.4,
    cx - s * 0.16,
    cy + s * 0.4,
  );
  ctx.bezierCurveTo(
    cx - s * 0.3,
    cy + s * 0.4,
    cx - s * 0.3,
    cy + s * 0.22,
    cx - s * 0.16,
    cy + s * 0.12,
  );
  ctx.closePath();
  cel(ctx, s, palette, palette.light, false);
}

/* Slabs and shards: two blocks, the near one lit, the far one in shadow. */
function earth(ctx: Ctx, cx: number, cy: number, s: number, palette: Palette): void {
  polygon(ctx, [
    [cx - s * 0.04, cy - s * 0.34],
    [cx + s * 0.34, cy - s * 0.16],
    [cx + s * 0.34, cy + s * 0.18],
    [cx - s * 0.04, cy],
  ]);
  cel(ctx, s, palette, palette.dark, false);

  polygon(ctx, [
    [cx - s * 0.36, cy - s * 0.12],
    [cx + s * 0.02, cy + s * 0.06],
    [cx + s * 0.02, cy + s * 0.4],
    [cx - s * 0.36, cy + s * 0.22],
  ]);
  cel(ctx, s, palette, palette.base);
}

/* Spirals and arcs: three sweeps that read as moving air, not as a cloud. */
function air(ctx: Ctx, cx: number, cy: number, s: number, palette: Palette): void {
  const arcs: readonly (readonly [number, number, number, number])[] = [
    [-0.22, 0.34, 0.2, 1.5],
    [-0.02, 0.28, 0.6, 1.2],
    [0.2, 0.2, 1.1, 1.0],
  ];
  for (const [dy, radius, from, sweep] of arcs) {
    ctx.beginPath();
    ctx.arc(cx, cy + s * dy, s * radius, Math.PI * from, Math.PI * (from + sweep));
    ctx.lineWidth = Math.max(1, s * 0.11);
    ctx.strokeStyle = palette.ink;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineWidth = Math.max(1, s * 0.07);
    ctx.strokeStyle = palette.base;
    ctx.stroke();
  }
}

/* A tool, per the bible's non-bender note: a haft and a struck head. */
function tool(ctx: Ctx, cx: number, cy: number, s: number, palette: Palette): void {
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.26, cy + s * 0.34);
  ctx.lineTo(cx + s * 0.14, cy - s * 0.1);
  ctx.lineWidth = Math.max(1, s * 0.17);
  ctx.strokeStyle = palette.ink;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineWidth = Math.max(1, s * 0.1);
  ctx.strokeStyle = palette.dark;
  ctx.stroke();

  polygon(ctx, [
    [cx + s * 0.02, cy - s * 0.24],
    [cx + s * 0.34, cy - s * 0.36],
    [cx + s * 0.38, cy - s * 0.04],
    [cx + s * 0.1, cy + s * 0.04],
  ]);
  cel(ctx, s, palette, palette.base);
}

/* A walked path: a dashed track turning into an arrowhead. */
function move(ctx: Ctx, cx: number, cy: number, s: number, palette: Palette): void {
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.34, cy + s * 0.3);
  ctx.quadraticCurveTo(cx - s * 0.06, cy + s * 0.26, cx + s * 0.04, cy - s * 0.06);
  ctx.setLineDash([s * 0.12, s * 0.1]);
  ctx.lineWidth = Math.max(1, s * 0.12);
  ctx.strokeStyle = palette.ink;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.strokeStyle = palette.light;
  ctx.stroke();
  ctx.setLineDash([]);

  polygon(ctx, [
    [cx + s * 0.06, cy - s * 0.38],
    [cx + s * 0.3, cy - s * 0.04],
    [cx - s * 0.1, cy - s * 0.06],
  ]);
  cel(ctx, s, palette, palette.base);
}

/* End turn: a chevron running into the bar it stops at. */
function endTurn(ctx: Ctx, cx: number, cy: number, s: number, palette: Palette): void {
  polygon(ctx, [
    [cx - s * 0.34, cy - s * 0.3],
    [cx + s * 0.04, cy],
    [cx - s * 0.34, cy + s * 0.3],
  ]);
  cel(ctx, s, palette, palette.base);

  ctx.beginPath();
  ctx.moveTo(cx + s * 0.2, cy - s * 0.3);
  ctx.lineTo(cx + s * 0.2, cy + s * 0.3);
  ctx.lineWidth = Math.max(1, s * 0.16);
  ctx.strokeStyle = palette.ink;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineWidth = Math.max(1, s * 0.09);
  ctx.strokeStyle = palette.light;
  ctx.stroke();
}

/* The mark nothing else claimed: a ring, so an unknown key is still legible. */
function unknown(ctx: Ctx, cx: number, cy: number, s: number, palette: Palette): void {
  circle(ctx, cx, cy, s * 0.26);
  cel(ctx, s, palette, palette.base);
}

const GLYPHS: Readonly<
  Record<string, (ctx: Ctx, cx: number, cy: number, s: number, palette: Palette) => void>
> = {
  fire,
  water,
  earth,
  air,
  nonbender: tool,
  tool,
  move,
  end: endTurn,
};

/**
 * Draws one glyph, centred in the box and inset so the ink never clips.
 *
 * The variant is the element for an ability mark (`glyph.fire`) or an action
 * name for the two the action bar owns (`glyph.move`, `glyph.end`). Anything
 * unrecognised draws the ring rather than nothing, because a button with an
 * empty square beside it looks broken where a plain ring looks deliberate.
 */
export function paintGlyph(ctx: Ctx, box: Box, palette: Palette, options: GlyphOptions = {}): void {
  const draw = GLYPHS[options.variant ?? ''] ?? unknown;
  const s = box.size;
  ctx.save();
  draw(ctx, box.x + s / 2, box.y + s / 2, s * 0.86, palette);
  ctx.restore();
}
