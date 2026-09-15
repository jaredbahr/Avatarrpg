/**
 * Portrait painter.
 *
 * One routine draws every face: a bust inside a round frame, with hair, skin,
 * collar and one accessory chosen deterministically from the variant name.
 * Hashing the name means Elder Mira looks the same every time you talk to her
 * without anyone having to author her, and adding a character needs no art.
 */

import type { Palette } from '../palettes';
import type { Box, Ctx } from './shapes';
import { circle, ellipse, outline, roundedRect } from './shapes';

/** Stable 32-bit hash of the variant name — the seed for every choice below. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const SKIN = ['#e8bd93', '#d8a273', '#bd845a', '#9c6740', '#7b4f31', '#f0d0ad'];
const HAIR = ['#2b1d15', '#402a1c', '#6b4a2c', '#8a6a3f', '#1a1a1e', '#5a5550', '#c9b28a'];

export interface PortraitOptions {
  readonly variant?: string;
  /** Draws the round frame. Off for inline chips in the log. */
  readonly frame?: boolean;
}

export function paintPortrait(
  ctx: Ctx,
  box: Box,
  palette: Palette,
  options: PortraitOptions = {},
): void {
  const name = options.variant ?? 'unknown';
  const seed = hash(name);
  const pick = <T>(list: readonly T[], shift: number): T => {
    const value = list[(seed >>> shift) % list.length];
    if (value === undefined) throw new Error('portrait: empty palette list');
    return value;
  };

  const s = box.size;
  const cx = box.x + s / 2;
  const cy = box.y + s / 2;

  ctx.save();

  if (options.frame !== false) {
    circle(ctx, cx, cy, s * 0.48);
    ctx.fillStyle = palette.dark;
    ctx.fill();
    outline(ctx, box, palette.accent, 0.035);
  }

  // Clip everything else to the frame so the bust never spills.
  circle(ctx, cx, cy, s * 0.45);
  ctx.clip();

  // Backdrop wash in the nation colour.
  ctx.fillStyle = palette.base;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(box.x, box.y, s, s);
  ctx.globalAlpha = 1;

  const skin = pick(SKIN, 3);
  const hair = pick(HAIR, 11);

  // Shoulders, then a V-neck collar drawn as two strokes rather than a filled
  // triangle — filled, it reads as a beard at portrait size.
  roundedRect(ctx, cx - s * 0.34, cy + s * 0.2, s * 0.68, s * 0.4, s * 0.12);
  ctx.fillStyle = palette.dark;
  ctx.fill();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = Math.max(1.5, s * 0.035);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.13, cy + s * 0.21);
  ctx.lineTo(cx, cy + s * 0.34);
  ctx.lineTo(cx + s * 0.13, cy + s * 0.21);
  ctx.stroke();

  // Neck and head.
  roundedRect(ctx, cx - s * 0.07, cy + s * 0.02, s * 0.14, s * 0.22, s * 0.05);
  ctx.fillStyle = skin;
  ctx.fill();

  ellipse(ctx, cx, cy - s * 0.05, s * 0.19, s * 0.22);
  ctx.fillStyle = skin;
  ctx.fill();

  // Hair: one of three silhouettes, chosen by the same seed.
  const style = (seed >>> 17) % 3;
  ctx.fillStyle = hair;
  if (style === 0) {
    // Swept back.
    ellipse(ctx, cx, cy - s * 0.15, s * 0.21, s * 0.16);
    ctx.fill();
  } else if (style === 1) {
    // Long, past the shoulders.
    roundedRect(ctx, cx - s * 0.24, cy - s * 0.24, s * 0.48, s * 0.46, s * 0.18);
    ctx.fill();
    ellipse(ctx, cx, cy - s * 0.02, s * 0.175, s * 0.2);
    ctx.fillStyle = skin;
    ctx.fill();
  } else {
    // Topknot.
    ellipse(ctx, cx, cy - s * 0.16, s * 0.2, s * 0.13);
    ctx.fill();
    circle(ctx, cx, cy - s * 0.3, s * 0.07);
    ctx.fill();
  }

  // Eyes: two dashes. Deliberately minimal — a mouth at this size reads as a
  // smudge, and a blank, calm face ages better than a bad expression.
  ctx.fillStyle = '#21180f';
  const eyeY = cy - s * 0.04;
  roundedRect(ctx, cx - s * 0.11, eyeY, s * 0.07, s * 0.022, s * 0.011);
  ctx.fill();
  roundedRect(ctx, cx + s * 0.04, eyeY, s * 0.07, s * 0.022, s * 0.011);
  ctx.fill();

  /*
   * One distinguishing mark per face, picked from the same hash. Without this
   * the two characters of an element are near-identical: the hair silhouette
   * alone is not enough to tell Kaya from Tenzo across a table, which defeats
   * the point of picking one.
   */
  const mark = (seed >>> 23) % 4;
  ctx.strokeStyle = hair;
  ctx.lineWidth = Math.max(1.2, s * 0.022);
  if (mark === 0) {
    // Heavy brows.
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.12, eyeY - s * 0.035);
    ctx.lineTo(cx - s * 0.03, eyeY - s * 0.05);
    ctx.moveTo(cx + s * 0.03, eyeY - s * 0.05);
    ctx.lineTo(cx + s * 0.12, eyeY - s * 0.035);
    ctx.stroke();
  } else if (mark === 1) {
    // A headband in the nation colour.
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = Math.max(1.5, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.2, cy - s * 0.12);
    ctx.lineTo(cx + s * 0.2, cy - s * 0.12);
    ctx.stroke();
  } else if (mark === 2) {
    // A scar across one eye.
    ctx.strokeStyle = 'rgba(120, 70, 55, 0.8)';
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.03, eyeY - s * 0.06);
    ctx.lineTo(cx + s * 0.12, eyeY + s * 0.06);
    ctx.stroke();
  } else {
    // A side braid.
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.19, cy - s * 0.06);
    ctx.quadraticCurveTo(cx - s * 0.26, cy + s * 0.06, cx - s * 0.2, cy + s * 0.18);
    ctx.lineWidth = Math.max(1.8, s * 0.045);
    ctx.stroke();
  }

  ctx.restore();
}
