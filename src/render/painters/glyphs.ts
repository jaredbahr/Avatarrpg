/**
 * Element glyphs: one small mark per element for the action bar.
 *
 * Drawn with the same rules as everything else on the board (ink outline,
 * two flat tones) so a button reads as part of the world rather than as a
 * label. Each glyph is one shape a thumb can name at a glance: a flame, a
 * wave, a slab, a spiral, a fist.
 */

import type { ElementId } from '../../core/types';
import type { Palette } from '../palettes';
import type { Box, Ctx } from './shapes';
import { circle, polygon, roundedRect } from './shapes';

export function paintElementGlyph(ctx: Ctx, box: Box, palette: Palette, element: ElementId): void {
  const s = box.size;
  const cx = box.x + s / 2;
  const cy = box.y + s / 2;
  const inkW = Math.max(1, s * 0.07);
  const fillInk = (fill: string): void => {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = inkW;
    ctx.strokeStyle = palette.ink;
    ctx.stroke();
  };

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (element) {
    case 'fire': {
      // A flame: a teardrop leaning right with a paler lick inside it.
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.02, cy - s * 0.42);
      ctx.bezierCurveTo(
        cx + s * 0.34,
        cy - s * 0.18,
        cx + s * 0.36,
        cy + s * 0.22,
        cx,
        cy + s * 0.4,
      );
      ctx.bezierCurveTo(
        cx - s * 0.38,
        cy + s * 0.22,
        cx - s * 0.3,
        cy - s * 0.1,
        cx - s * 0.02,
        cy - s * 0.42,
      );
      ctx.closePath();
      fillInk(palette.base);
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.02, cy - s * 0.08);
      ctx.bezierCurveTo(
        cx + s * 0.18,
        cy + s * 0.04,
        cx + s * 0.14,
        cy + s * 0.22,
        cx,
        cy + s * 0.26,
      );
      ctx.bezierCurveTo(
        cx - s * 0.16,
        cy + s * 0.2,
        cx - s * 0.1,
        cy + s * 0.02,
        cx + s * 0.02,
        cy - s * 0.08,
      );
      ctx.closePath();
      ctx.fillStyle = palette.accent;
      ctx.fill();
      break;
    }
    case 'water': {
      // A wave: a swell curling over at the crest, a foam line along its back.
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.42, cy + s * 0.3);
      ctx.bezierCurveTo(
        cx - s * 0.3,
        cy - s * 0.1,
        cx - s * 0.05,
        cy - s * 0.42,
        cx + s * 0.28,
        cy - s * 0.3,
      );
      ctx.bezierCurveTo(
        cx + s * 0.44,
        cy - s * 0.24,
        cx + s * 0.4,
        cy - s * 0.02,
        cx + s * 0.2,
        cy + s * 0.02,
      );
      ctx.bezierCurveTo(
        cx + s * 0.32,
        cy - s * 0.1,
        cx + s * 0.2,
        cy - s * 0.2,
        cx + s * 0.06,
        cy - s * 0.12,
      );
      ctx.bezierCurveTo(
        cx - s * 0.1,
        cy - s * 0.02,
        cx - s * 0.16,
        cy + s * 0.14,
        cx + s * 0.4,
        cy + s * 0.3,
      );
      ctx.closePath();
      fillInk(palette.base);
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.3, cy + s * 0.18);
      ctx.bezierCurveTo(
        cx - s * 0.2,
        cy - s * 0.04,
        cx,
        cy - s * 0.24,
        cx + s * 0.22,
        cy - s * 0.22,
      );
      ctx.lineWidth = Math.max(1, s * 0.06);
      ctx.strokeStyle = palette.accent;
      ctx.stroke();
      break;
    }
    case 'earth': {
      // A slab: a block with a lit top face, a dark side and a crack.
      polygon(ctx, [
        [cx - s * 0.4, cy + s * 0.34],
        [cx - s * 0.3, cy - s * 0.2],
        [cx + s * 0.1, cy - s * 0.38],
        [cx + s * 0.4, cy - s * 0.08],
        [cx + s * 0.34, cy + s * 0.34],
      ]);
      fillInk(palette.base);
      polygon(ctx, [
        [cx + s * 0.1, cy - s * 0.38],
        [cx + s * 0.4, cy - s * 0.08],
        [cx + s * 0.34, cy + s * 0.34],
        [cx + s * 0.12, cy + s * 0.34],
        [cx + s * 0.08, cy - s * 0.1],
      ]);
      ctx.fillStyle = palette.dark;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.16, cy - s * 0.08);
      ctx.lineTo(cx - s * 0.06, cy + s * 0.06);
      ctx.lineTo(cx - s * 0.14, cy + s * 0.2);
      ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.strokeStyle = palette.ink;
      ctx.stroke();
      break;
    }
    case 'air': {
      // A spiral: two and a half turns, ink under a pale stroke.
      const turns = 2.4;
      const steps = 48;
      const path = (): void => {
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const angle = t * turns * Math.PI * 2 - Math.PI * 0.6;
          const r = s * (0.04 + 0.36 * t);
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r * 0.9;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      };
      path();
      ctx.lineWidth = Math.max(1, s * 0.12) + inkW * 2;
      ctx.strokeStyle = palette.ink;
      ctx.stroke();
      path();
      ctx.lineWidth = Math.max(1, s * 0.12);
      ctx.strokeStyle = palette.light;
      ctx.stroke();
      break;
    }
    default: {
      // A fist: the palm, the thumb across it, three knuckles along the top.
      roundedRect(ctx, cx - s * 0.36, cy - s * 0.26, s * 0.7, s * 0.56, s * 0.16);
      fillInk(palette.base);
      roundedRect(ctx, cx - s * 0.36, cy + s * 0.02, s * 0.5, s * 0.2, s * 0.1);
      fillInk(palette.dark);
      for (const x of [-0.2, 0, 0.2]) {
        circle(ctx, cx + s * x, cy - s * 0.24, s * 0.09);
        fillInk(palette.light);
      }
      break;
    }
  }

  ctx.restore();
}
