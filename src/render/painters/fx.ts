/**
 * Ability effect painters.
 *
 * One routine, shaped by the variant in the asset key (`fx.fire.lightning` ->
 * variant "lightning"). These are drawn over a tile for the duration of the
 * animator's playback, so they are cheap: a few strokes, no particles. Phase 3
 * is where real FX go.
 *
 * `progress` runs 0 to 1 across the effect's playback so a burst can grow and
 * fade rather than pop.
 */

import type { Palette } from '../palettes';
import type { Box, Ctx } from './shapes';
import { circle, polygon } from './shapes';

export interface FxOptions {
  readonly variant?: string;
  readonly progress?: number;
  /** Direction from caster to target, for directional effects. */
  readonly angle?: number;
}

export function paintImpact(ctx: Ctx, box: Box, palette: Palette, options: FxOptions = {}): void {
  const t = Math.max(0, Math.min(1, options.progress ?? 1));
  const s = box.size;
  const cx = box.x + s / 2;
  const cy = box.y + s / 2;
  const variant = options.variant ?? 'impact';

  ctx.save();
  // Grow quickly, fade slowly: reads as an impact rather than a pulse.
  ctx.globalAlpha = Math.max(0, 1 - t * t);

  switch (variant) {
    case 'lightning':
    case 'glove': {
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = Math.max(1.5, s * 0.06 * (1 - t * 0.5));
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.3, cy - s * 0.4);
      ctx.lineTo(cx + s * 0.05, cy - s * 0.05);
      ctx.lineTo(cx - s * 0.1, cy + s * 0.05);
      ctx.lineTo(cx + s * 0.28, cy + s * 0.42);
      ctx.stroke();
      ctx.globalAlpha *= 0.6;
      circle(ctx, cx, cy, s * (0.18 + t * 0.3));
      ctx.fillStyle = palette.light;
      ctx.fill();
      break;
    }

    case 'wall':
    case 'path': {
      ctx.fillStyle = palette.base;
      ctx.globalAlpha *= 0.8;
      ctx.fillRect(
        box.x + s * 0.08,
        box.y + s * (0.5 - 0.42 * (1 - t)),
        s * 0.84,
        s * 0.84 * (1 - t),
      );
      break;
    }

    case 'heal':
    case 'cushion':
    case 'shield':
    case 'stance':
    case 'cover': {
      ctx.strokeStyle = palette.light;
      ctx.lineWidth = Math.max(1.5, s * 0.05);
      circle(ctx, cx, cy - s * 0.1 * t, s * (0.3 + t * 0.12));
      ctx.stroke();
      ctx.globalAlpha *= 0.5;
      circle(ctx, cx, cy - s * 0.1 * t, s * 0.18);
      ctx.fillStyle = palette.accent;
      ctx.fill();
      break;
    }

    case 'smoke':
    case 'gust':
    case 'cyclone':
    case 'tornado': {
      ctx.strokeStyle = palette.light;
      ctx.lineWidth = Math.max(1.2, s * 0.04);
      for (let i = 0; i < 3; i++) {
        const r = s * (0.14 + i * 0.12 + t * 0.15);
        ctx.beginPath();
        ctx.arc(cx, cy, r, t * Math.PI * 2 + i, t * Math.PI * 2 + i + Math.PI * 1.2);
        ctx.stroke();
      }
      break;
    }

    default: {
      // Generic burst: a ring plus four spokes.
      const r = s * (0.16 + t * 0.34);
      ctx.fillStyle = palette.light;
      circle(ctx, cx, cy, r * 0.6);
      ctx.fill();
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = Math.max(1.2, s * 0.05 * (1 - t));
      circle(ctx, cx, cy, r);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
        ctx.lineTo(cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 1.5);
        ctx.stroke();
      }
      break;
    }
  }

  ctx.restore();
}

/** Floating damage / healing number, drawn above a unit during playback. */
export function paintFloatingNumber(
  ctx: Ctx,
  box: Box,
  text: string,
  color: string,
  progress: number,
): void {
  const t = Math.max(0, Math.min(1, progress));
  const s = box.size;
  ctx.save();
  ctx.globalAlpha = 1 - t * t;
  ctx.font = `700 ${Math.round(s * 0.34)}px 'Trebuchet MS', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const x = box.x + s / 2;
  const y = box.y + s * (0.32 - t * 0.35);
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** A dotted trail showing the path a unit is walking. */
export function paintPathDot(ctx: Ctx, box: Box, color: string): void {
  const s = box.size;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = color;
  circle(ctx, box.x + s / 2, box.y + s / 2, s * 0.09);
  ctx.fill();
  ctx.restore();
}

/** Arrowhead marking the final tile of a move preview. */
export function paintPathArrow(ctx: Ctx, box: Box, color: string): void {
  const s = box.size;
  const cx = box.x + s / 2;
  const cy = box.y + s / 2;
  ctx.save();
  ctx.fillStyle = color;
  polygon(ctx, [
    [cx, cy - s * 0.2],
    [cx + s * 0.16, cy + s * 0.12],
    [cx, cy + s * 0.04],
    [cx - s * 0.16, cy + s * 0.12],
  ]);
  ctx.fill();
  ctx.restore();
}
