/**
 * Unit painters — code-drawn placeholders on nation palettes.
 *
 * Every person on the board is the rig in `figure.ts` wearing a spec from
 * `cast.ts`: at a 40px tile with six of them on screen, what matters is that
 * a player can tell at a glance which one is theirs, which side it is on and
 * roughly what it does. Colour carries the element, silhouette carries the
 * character, a held prop carries the weapon, and the pose comes from the
 * frame the sheet baker asks for. The boss is a machine and draws itself.
 *
 * Every one of these is replaceable by a bitmap: point the key at a sheet in
 * `src/content/assets/manifest.ts` and none of this runs.
 */

import type { ClipName } from '../../content/assets/clips';
import type { Palette } from '../palettes';
import { figureFor } from './cast';
import { drawFigure, poseFor } from './figure';
import type { Box, Ctx } from './shapes';
import { ellipse, polygon, roundedRect } from './shapes';

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
  /**
   * Tiles of frame above the box when a sheet frame is being drawn. A figure
   * grows into it, so a placeholder stands as tall as the generated art will.
   */
  readonly headroom?: number;
}

export type UnitPainter = (ctx: Ctx, box: Box, palette: Palette, options: PainterOptions) => void;

/** A painter that draws the rig: the spec from the variant, the pose from the frame. */
function figurePainter(painterName: string): UnitPainter {
  return (ctx, box, palette, options) => {
    const pose = options.pose ? poseFor(options.pose.clip, options.pose.index) : poseFor('idle', 0);
    drawFigure(
      ctx,
      box,
      figureFor(painterName, options.variant, palette),
      pose,
      palette,
      options.facing ?? 1,
      options.headroom ?? 0,
    );
  };
}

export const paintBender: UnitPainter = figurePainter('bender');
export const paintBandit: UnitPainter = figurePainter('bandit');
export const paintMercenary: UnitPainter = figurePainter('mercenary');
export const paintVillager: UnitPainter = figurePainter('villager');

/**
 * The boss. Occupies two tiles, so the box passed in is twice as wide as it is
 * tall and everything is measured against the *height*.
 */
export const paintDriller: UnitPainter = (ctx, box, palette, options) => {
  const s = box.size;
  const w = s * 2;
  const left = box.x;
  // Three tells for a machine: the drill runs out on a cast or a swing, the
  // hull rocks back on a hit, and it sags on its treads when it is done.
  const pose = options.pose;
  const reach =
    pose?.clip === 'cast'
      ? ([0, 0.08, 0.03][pose.index] ?? 0)
      : pose?.clip === 'melee'
        ? ([0.02, 0.07][pose.index] ?? 0)
        : 0;
  const rock = pose?.clip === 'hit' ? -0.05 : 0;
  const sag =
    pose?.clip === 'ko'
      ? 0.06
      : pose?.clip === 'walk'
        ? ([0.012, -0.012][pose.index] ?? 0)
        : pose?.clip === 'idle' && pose.index === 1
          ? -0.006
          : 0;
  const top = box.y + s * sag;

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

  ctx.save();
  ctx.translate(w * rock, 0);

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
  const tip = left + w * (0.98 + reach);
  polygon(ctx, [
    [drillX, top + s * 0.36],
    [drillX, top + s * 0.62],
    [tip, top + s * 0.49],
  ]);
  ctx.fillStyle = '#b9b3a8';
  ctx.fill();
  ctx.strokeStyle = '#6f6b63';
  ctx.stroke();
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    ctx.beginPath();
    ctx.moveTo(drillX + (tip - drillX) * t, top + s * (0.36 + 0.13 * t));
    ctx.lineTo(drillX + (tip - drillX) * t, top + s * (0.62 - 0.13 * t));
    ctx.strokeStyle = '#8a857c';
    ctx.lineWidth = Math.max(1, s * 0.015);
    ctx.stroke();
  }

  // Exhaust stack, because it is always smoking.
  roundedRect(ctx, left + w * 0.5, top + s * 0.12, w * 0.05, s * 0.2, s * 0.02);
  ctx.fillStyle = '#3a352f';
  ctx.fill();
  ctx.restore();
};

export const UNIT_PAINTERS: Record<string, UnitPainter> = {
  bender: paintBender,
  bandit: paintBandit,
  mercenary: paintMercenary,
  villager: paintVillager,
  driller: paintDriller,
};
