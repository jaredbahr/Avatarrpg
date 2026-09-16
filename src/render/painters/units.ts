/**
 * Unit painters — code-drawn placeholders on nation palettes.
 *
 * These are silhouettes, not portraits: at a 40px tile with six of them on
 * screen, what matters is that a player can tell at a glance which one is
 * theirs, which side it is on, and roughly what it does. Colour carries the
 * element, shape carries the role, and a small held prop carries the weapon.
 *
 * Every one of these is replaceable by a bitmap: point the key at an image in
 * `src/content/assets/manifest.ts` and none of this runs.
 */

import type { ClipName } from '../../content/assets/clips';
import type { Palette } from '../palettes';
import type { Box, Ctx } from './shapes';
import { circle, ellipse, groundShadow, outline, polygon, roundedRect } from './shapes';

export interface PainterOptions {
  readonly variant?: string;
  /** Enemies are drawn facing left, the party facing right. */
  readonly facing?: 1 | -1;
  /** Dimmed when the unit is down. */
  readonly fallen?: boolean;
  /**
   * Which key pose to draw, when the sheet baker asks for one (ADR 0003).
   * A painter that ignores it draws its one figure into every frame.
   */
  readonly pose?: { readonly clip: ClipName; readonly index: number };
}

export type UnitPainter = (ctx: Ctx, box: Box, palette: Palette, options: PainterOptions) => void;

interface Build {
  /** Body width as a fraction of the tile. */
  readonly width: number;
  /** Shoulder height as a fraction of the tile, measured from the top. */
  readonly shoulder: number;
  readonly headRadius: number;
}

function buildFor(variant: string | undefined): Build {
  switch (variant) {
    case 'lean':
      return { width: 0.34, shoulder: 0.42, headRadius: 0.11 };
    case 'broad':
      return { width: 0.48, shoulder: 0.4, headRadius: 0.13 };
    case 'robed':
      return { width: 0.42, shoulder: 0.44, headRadius: 0.115 };
    default:
      return { width: 0.4, shoulder: 0.42, headRadius: 0.12 };
  }
}

/** The common figure: robe, shoulders, head. Props are drawn on top. */
function figure(ctx: Ctx, box: Box, palette: Palette, options: PainterOptions): Build {
  const build = buildFor(options.variant);
  const s = box.size;
  const cx = box.x + s / 2;
  const hemY = box.y + s * 0.87;
  const shoulderY = box.y + s * build.shoulder;

  groundShadow(ctx, box, build.width + 0.08);

  // Robe: a trapezoid, wider at the hem.
  const topHalf = s * build.width * 0.5;
  const hemHalf = s * (build.width + 0.1) * 0.5;
  polygon(ctx, [
    [cx - topHalf, shoulderY],
    [cx + topHalf, shoulderY],
    [cx + hemHalf, hemY],
    [cx - hemHalf, hemY],
  ]);
  ctx.fillStyle = palette.base;
  ctx.fill();
  outline(ctx, box, palette.dark, 0.03);

  // A lit edge on the facing side gives the flat shape some form.
  const facing = options.facing ?? 1;
  ctx.save();
  ctx.globalAlpha = 0.5;
  polygon(ctx, [
    [cx, shoulderY],
    [cx + topHalf * facing, shoulderY],
    [cx + hemHalf * facing, hemY],
    [cx, hemY],
  ]);
  ctx.fillStyle = palette.light;
  ctx.fill();
  ctx.restore();

  // Head.
  const headY = shoulderY - s * build.headRadius * 1.15;
  circle(ctx, cx, headY, s * build.headRadius);
  ctx.fillStyle = palette.light;
  ctx.fill();
  outline(ctx, box, palette.dark, 0.028);

  return build;
}

/** A coloured sash across the chest — the clearest element tell at small size. */
function sash(ctx: Ctx, box: Box, palette: Palette, build: Build): void {
  const s = box.size;
  const cx = box.x + s / 2;
  const top = box.y + s * build.shoulder + s * 0.03;
  ctx.save();
  ctx.globalAlpha = 0.95;
  polygon(ctx, [
    [cx - s * build.width * 0.5, top],
    [cx + s * build.width * 0.5, top],
    [cx + s * build.width * 0.5, top + s * 0.07],
    [cx - s * build.width * 0.5, top + s * 0.07],
  ]);
  ctx.fillStyle = palette.accent;
  ctx.fill();
  ctx.restore();
}

export const paintBender: UnitPainter = (ctx, box, palette, options) => {
  const build = figure(ctx, box, palette, options);
  sash(ctx, box, palette, build);

  // A raised hand with a small elemental mote: "this one bends".
  const s = box.size;
  const facing = options.facing ?? 1;
  const handX = box.x + s / 2 + facing * s * 0.26;
  const handY = box.y + s * (build.shoulder + 0.06);
  circle(ctx, handX, handY, s * 0.055);
  ctx.fillStyle = palette.accent;
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.55;
  circle(ctx, handX, handY, s * 0.09);
  ctx.fillStyle = palette.light;
  ctx.fill();
  ctx.restore();
};

export const paintBandit: UnitPainter = (ctx, box, palette, options) => {
  const build = figure(ctx, box, palette, options);
  const s = box.size;
  const cx = box.x + s / 2;
  const facing = options.facing ?? 1;

  // Hood: a wedge over the head, so a bandit reads as a bandit at any size.
  const headY = box.y + s * build.shoulder - s * build.headRadius * 1.15;
  polygon(ctx, [
    [cx - s * build.headRadius * 1.3, headY + s * 0.02],
    [cx, headY - s * build.headRadius * 1.5],
    [cx + s * build.headRadius * 1.3, headY + s * 0.02],
  ]);
  ctx.fillStyle = palette.dark;
  ctx.fill();

  if (options.variant === 'club' || options.variant === 'broad') {
    // Club: a thick bar held out to the side.
    const x = cx + facing * s * 0.28;
    ctx.save();
    ctx.translate(x, box.y + s * 0.55);
    ctx.rotate(facing * 0.5);
    roundedRect(ctx, -s * 0.04, -s * 0.22, s * 0.08, s * 0.44, s * 0.03);
    ctx.fillStyle = '#6b4f33';
    ctx.fill();
    ctx.restore();
  } else if (options.variant === 'sling') {
    // Sling: a loop of cord with a stone.
    const x = cx + facing * s * 0.26;
    ctx.beginPath();
    ctx.arc(x, box.y + s * 0.46, s * 0.12, 0, Math.PI * 1.4);
    ctx.strokeStyle = '#d8c9a8';
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.stroke();
    circle(ctx, x + s * 0.1, box.y + s * 0.55, s * 0.04);
    ctx.fillStyle = '#9a958d';
    ctx.fill();
  } else if (options.variant === 'bender') {
    sash(ctx, box, palette, build);
  }
};

export const paintMercenary: UnitPainter = (ctx, box, palette, options) => {
  const build = figure(ctx, box, palette, options);
  const s = box.size;
  const cx = box.x + s / 2;
  const facing = options.facing ?? 1;

  // Pauldrons: two hard shoulders that read as armour.
  const shoulderY = box.y + s * build.shoulder;
  for (const side of [-1, 1]) {
    ellipse(ctx, cx + side * s * build.width * 0.5, shoulderY, s * 0.075, s * 0.05);
    ctx.fillStyle = palette.dark;
    ctx.fill();
  }

  if (options.variant === 'crossbow') {
    const x = cx + facing * s * 0.22;
    const y = box.y + s * 0.52;
    roundedRect(ctx, x - s * 0.02, y - s * 0.16, s * 0.04, s * 0.32, s * 0.01);
    ctx.fillStyle = '#4a3a2c';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - s * 0.12, y - s * 0.1);
    ctx.quadraticCurveTo(x + s * 0.06, y, x - s * 0.12, y + s * 0.1);
    ctx.strokeStyle = '#8d7d69';
    ctx.lineWidth = Math.max(1, s * 0.022);
    ctx.stroke();
  } else {
    // Blade: a narrow triangle held point-up.
    const x = cx + facing * s * 0.26;
    polygon(ctx, [
      [x - s * 0.025, box.y + s * 0.62],
      [x + s * 0.025, box.y + s * 0.62],
      [x, box.y + s * 0.26],
    ]);
    ctx.fillStyle = '#d5d2cb';
    ctx.fill();
    outline(ctx, box, '#6f6b63', 0.02);
  }

  if (options.variant === 'sergeant') {
    // Crest: rank, visible from across the table.
    const headY = box.y + s * build.shoulder - s * build.headRadius * 1.15;
    polygon(ctx, [
      [cx - s * 0.06, headY - s * build.headRadius],
      [cx + s * 0.06, headY - s * build.headRadius],
      [cx, headY - s * build.headRadius - s * 0.1],
    ]);
    ctx.fillStyle = palette.accent;
    ctx.fill();
  }
};

export const paintVillager: UnitPainter = (ctx, box, palette, options) => {
  const build = figure(ctx, box, palette, { ...options, variant: options.variant ?? 'robed' });
  const s = box.size;
  const cx = box.x + s / 2;
  const headY = box.y + s * build.shoulder - s * build.headRadius * 1.15;

  switch (options.variant) {
    case 'elder': {
      // A staff and a stoop.
      roundedRect(ctx, cx + s * 0.22, box.y + s * 0.3, s * 0.025, s * 0.56, s * 0.012);
      ctx.fillStyle = '#6b4f33';
      ctx.fill();
      ctx.save();
      ctx.globalAlpha = 0.9;
      polygon(ctx, [
        [cx - s * 0.1, headY],
        [cx + s * 0.1, headY],
        [cx + s * 0.07, headY - s * 0.1],
        [cx - s * 0.07, headY - s * 0.1],
      ]);
      ctx.fillStyle = '#e8e2d4';
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'kid': {
      // Smaller, rounder, drawn from the same routine at reduced scale.
      break;
    }
    case 'guard': {
      polygon(ctx, [
        [cx - s * 0.14, box.y + s * 0.46],
        [cx - s * 0.02, box.y + s * 0.42],
        [cx - s * 0.02, box.y + s * 0.72],
        [cx - s * 0.14, box.y + s * 0.68],
      ]);
      ctx.fillStyle = palette.dark;
      ctx.fill();
      break;
    }
    default:
      break;
  }

  // Everyone in the village gets a little apron of shading.
  ctx.save();
  ctx.globalAlpha = 0.25;
  polygon(ctx, [
    [cx - s * 0.12, box.y + s * 0.6],
    [cx + s * 0.12, box.y + s * 0.6],
    [cx + s * 0.14, box.y + s * 0.86],
    [cx - s * 0.14, box.y + s * 0.86],
  ]);
  ctx.fillStyle = palette.dark;
  ctx.fill();
  ctx.restore();
};

/**
 * The boss. Occupies two tiles, so the box passed in is twice as wide as it is
 * tall and everything is measured against the *height*.
 */
export const paintDriller: UnitPainter = (ctx, box, palette) => {
  const s = box.size;
  const w = s * 2;
  const left = box.x;
  const top = box.y;

  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = '#000000';
  ellipse(ctx, left + w / 2, top + s * 0.9, w * 0.4, s * 0.1);
  ctx.fill();
  ctx.restore();

  // Treads.
  roundedRect(ctx, left + w * 0.08, top + s * 0.66, w * 0.84, s * 0.2, s * 0.06);
  ctx.fillStyle = '#2f2b26';
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const x = left + w * (0.12 + i * 0.11);
    roundedRect(ctx, x, top + s * 0.69, w * 0.035, s * 0.14, s * 0.02);
    ctx.fillStyle = '#4a443c';
    ctx.fill();
  }

  // Hull.
  roundedRect(ctx, left + w * 0.16, top + s * 0.3, w * 0.58, s * 0.38, s * 0.07);
  ctx.fillStyle = palette.base;
  ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.strokeStyle = palette.dark;
  ctx.stroke();

  // Cab and viewport.
  roundedRect(ctx, left + w * 0.2, top + s * 0.16, w * 0.24, s * 0.18, s * 0.05);
  ctx.fillStyle = palette.dark;
  ctx.fill();
  roundedRect(ctx, left + w * 0.23, top + s * 0.2, w * 0.18, s * 0.08, s * 0.03);
  ctx.fillStyle = '#ffb648';
  ctx.fill();

  // Drill arm: the thing you are meant to stay out of the way of.
  const drillX = left + w * 0.74;
  polygon(ctx, [
    [drillX, top + s * 0.36],
    [drillX, top + s * 0.62],
    [left + w * 0.98, top + s * 0.49],
  ]);
  ctx.fillStyle = '#b9b3a8';
  ctx.fill();
  ctx.strokeStyle = '#6f6b63';
  ctx.stroke();
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    ctx.beginPath();
    ctx.moveTo(drillX + (left + w * 0.98 - drillX) * t, top + s * (0.36 + 0.13 * t));
    ctx.lineTo(drillX + (left + w * 0.98 - drillX) * t, top + s * (0.62 - 0.13 * t));
    ctx.strokeStyle = '#8a857c';
    ctx.lineWidth = Math.max(1, s * 0.015);
    ctx.stroke();
  }

  // Exhaust stack, because it is always smoking.
  roundedRect(ctx, left + w * 0.5, top + s * 0.12, w * 0.05, s * 0.2, s * 0.02);
  ctx.fillStyle = '#3a352f';
  ctx.fill();
};

export const UNIT_PAINTERS: Record<string, UnitPainter> = {
  bender: paintBender,
  bandit: paintBandit,
  mercenary: paintMercenary,
  villager: paintVillager,
  driller: paintDriller,
};
