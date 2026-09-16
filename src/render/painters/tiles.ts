/**
 * Terrain and surface painting.
 *
 * Each tile is: a terrain fill, a deterministic scatter of detail so the
 * ground is not flat colour, an optional surface wash, and an optional hatch
 * pattern when the colourblind setting is on. Everything that stands on the
 * ground (cliff faces, walls, canopies, cover stones, decals) is the board
 * decor in `board.ts`, drawn in a second pass over the whole visible board so
 * a canopy can overhang its neighbours.
 */

import type { Tile, Vec2 } from '../../core/types';
import type { Edges } from '../geometry/board';
import { SURFACE_STYLES, TERRAIN_STYLES } from '../palettes';
import type { Box, Ctx } from './shapes';
import { circle, polygon, tileNoise } from './shapes';

export function paintTerrain(ctx: Ctx, box: Box, tile: Tile, pos: Vec2): void {
  const style = TERRAIN_STYLES[tile.terrain];
  const s = box.size;

  ctx.fillStyle = style.fill;
  ctx.fillRect(box.x, box.y, s + 1, s + 1);

  // Deterministic detail. The same tile always gets the same flecks, so the
  // map does not shimmer between frames.
  const count = tile.terrain === 'grass' ? 4 : tile.terrain === 'stone' ? 3 : 2;
  ctx.fillStyle = style.detail;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < count; i++) {
    const nx = tileNoise(pos.x, pos.y, i * 3 + 1);
    const ny = tileNoise(pos.x, pos.y, i * 3 + 2);
    const nr = tileNoise(pos.x, pos.y, i * 3 + 3);
    if (tile.terrain === 'grass') {
      const x = box.x + nx * s;
      const y = box.y + ny * s;
      ctx.fillRect(x, y - s * 0.06, Math.max(1, s * 0.02), s * 0.08 + nr * s * 0.04);
    } else {
      circle(ctx, box.x + nx * s, box.y + ny * s, s * (0.02 + nr * 0.03));
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * The surface wash, rimmed only where it meets something else (`edges`), so
 * a puddle four tiles wide is one pool with a bank round it and not four
 * squares with a border each.
 */
export function paintSurface(
  ctx: Ctx,
  box: Box,
  tile: Tile,
  pos: Vec2,
  hatch: boolean,
  edges: Edges,
): void {
  if (!tile.surface) return;
  const style = SURFACE_STYLES[tile.surface.id];
  const s = box.size;

  ctx.save();
  ctx.globalAlpha = style.alpha;
  ctx.fillStyle = style.fill;
  // Snapped to whole pixels rather than overlapped by one: a translucent
  // fill that overlaps its neighbour shows the seam as a darker line.
  const x0 = Math.round(box.x);
  const y0 = Math.round(box.y);
  ctx.fillRect(x0, y0, Math.round(box.x + s) - x0, Math.round(box.y + s) - y0);

  // The bank: a wide faint band inside the edge under a thin bright line.
  const inset = Math.max(1, s * 0.03);
  const band = s * 0.12;
  const sides: [boolean, number, number, number, number][] = [
    [edges.n, box.x, box.y, s + 1, band],
    [edges.s, box.x, box.y + s - band, s + 1, band],
    [edges.w, box.x, box.y, band, s + 1],
    [edges.e, box.x + s - band, box.y, band, s + 1],
  ];
  ctx.fillStyle = style.edge;
  ctx.globalAlpha = style.alpha * 0.22;
  for (const [on, x, y, w, h] of sides) if (on) ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = style.alpha * 0.75;
  ctx.strokeStyle = style.edge;
  ctx.lineWidth = inset;
  ctx.beginPath();
  if (edges.n) {
    ctx.moveTo(box.x, box.y + inset / 2);
    ctx.lineTo(box.x + s, box.y + inset / 2);
  }
  if (edges.s) {
    ctx.moveTo(box.x, box.y + s - inset / 2);
    ctx.lineTo(box.x + s, box.y + s - inset / 2);
  }
  if (edges.w) {
    ctx.moveTo(box.x + inset / 2, box.y);
    ctx.lineTo(box.x + inset / 2, box.y + s);
  }
  if (edges.e) {
    ctx.moveTo(box.x + s - inset / 2, box.y);
    ctx.lineTo(box.x + s - inset / 2, box.y + s);
  }
  ctx.stroke();

  // A surface about to expire is drawn faintly, so "two rounds left" is
  // visible without anyone reading a number.
  if (tile.surface.duration >= 0 && tile.surface.duration <= 1) {
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000000';
    ctx.fillRect(box.x, box.y, s + 1, s + 1);
  }

  if (hatch) paintHatch(ctx, box, style.hatch, style.edge, pos);
  ctx.restore();
}

/**
 * Pattern overlay for colourblind play. Every surface gets a distinct texture,
 * so fire and mud are distinguishable by shape and not only by tint.
 */
function paintHatch(
  ctx: Ctx,
  box: Box,
  pattern: (typeof SURFACE_STYLES)[keyof typeof SURFACE_STYLES]['hatch'],
  color: string,
  pos: Vec2,
): void {
  const s = box.size;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, s, s);
  ctx.clip();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, s * 0.035);

  const step = s / 4;
  switch (pattern) {
    case 'diagonal':
      for (let i = -4; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(box.x + i * step, box.y);
        ctx.lineTo(box.x + i * step + s, box.y + s);
        ctx.stroke();
      }
      break;
    case 'cross':
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(box.x + i * step, box.y);
        ctx.lineTo(box.x + i * step, box.y + s);
        ctx.moveTo(box.x, box.y + i * step);
        ctx.lineTo(box.x + s, box.y + i * step);
        ctx.stroke();
      }
      break;
    case 'vertical':
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(box.x + i * step + step / 2, box.y);
        ctx.lineTo(box.x + i * step + step / 2, box.y + s);
        ctx.stroke();
      }
      break;
    case 'dots':
      for (let iy = 0; iy < 3; iy++) {
        for (let ix = 0; ix < 3; ix++) {
          circle(ctx, box.x + s * (0.22 + ix * 0.28), box.y + s * (0.22 + iy * 0.28), s * 0.045);
          ctx.fill();
        }
      }
      break;
    case 'wave':
      for (let iy = 0; iy < 3; iy++) {
        const y = box.y + s * (0.25 + iy * 0.25);
        ctx.beginPath();
        ctx.moveTo(box.x, y);
        ctx.quadraticCurveTo(box.x + s * 0.25, y - s * 0.09, box.x + s * 0.5, y);
        ctx.quadraticCurveTo(box.x + s * 0.75, y + s * 0.09, box.x + s, y);
        ctx.stroke();
      }
      break;
    case 'none':
    default:
      break;
  }

  void pos;
  ctx.restore();
}

/** Thin grid line. Drawn last so it sits above surfaces but under units. */
export function paintGridLine(ctx: Ctx, box: Box, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.size, box.size);
}

/** Highlight wash plus border, used for move range, targets and blast areas. */
export function paintOverlay(
  ctx: Ctx,
  box: Box,
  fill: string,
  edge: string | null,
  edges: { top: boolean; right: boolean; bottom: boolean; left: boolean } | null,
): void {
  const s = box.size;
  ctx.fillStyle = fill;
  ctx.fillRect(box.x, box.y, s + 1, s + 1);

  if (!edge) return;
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(2, s * 0.05);

  if (!edges) {
    ctx.strokeRect(box.x + 1, box.y + 1, s - 2, s - 2);
    return;
  }

  // Only draw the outside of a contiguous region, so a move range reads as one
  // shape rather than a grid of boxes.
  ctx.beginPath();
  if (edges.top) {
    ctx.moveTo(box.x, box.y);
    ctx.lineTo(box.x + s, box.y);
  }
  if (edges.right) {
    ctx.moveTo(box.x + s, box.y);
    ctx.lineTo(box.x + s, box.y + s);
  }
  if (edges.bottom) {
    ctx.moveTo(box.x + s, box.y + s);
    ctx.lineTo(box.x, box.y + s);
  }
  if (edges.left) {
    ctx.moveTo(box.x, box.y + s);
    ctx.lineTo(box.x, box.y);
  }
  ctx.stroke();
}

/** The exit marker on an explore map: a chevron pointing off the edge. */
export function paintExitMarker(ctx: Ctx, box: Box, color: string, pulse: number): void {
  const s = box.size;
  const cx = box.x + s / 2;
  const cy = box.y + s / 2;
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.35 * pulse;
  ctx.fillStyle = color;
  polygon(ctx, [
    [cx - s * 0.18, cy - s * 0.26],
    [cx + s * 0.16, cy],
    [cx - s * 0.18, cy + s * 0.26],
    [cx - s * 0.06, cy],
  ]);
  ctx.fill();
  ctx.restore();
}
