/**
 * Terrain and surface painting.
 *
 * Each tile is: a terrain fill, a deterministic scatter of detail so the
 * ground is not flat colour, an optional surface wash, and an optional hatch
 * pattern when the colourblind setting is on. Elevation is shown as a lighter
 * top edge and a cast shadow, which is enough to read "high ground" without a
 * second rendering pass.
 */

import type { Tile, Vec2 } from '../../core/types';
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

  // Elevation: a lit top lip and a shadow underneath.
  if (tile.elevation > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(box.x, box.y, s + 1, Math.max(1, s * 0.09 * tile.elevation));
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(box.x, box.y + s - s * 0.1, s + 1, Math.max(1, s * 0.1));
  }

  // Walls get a heavier block so they read as impassable, not just dark.
  if (tile.blocked) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(box.x, box.y, s + 1, s + 1);
    ctx.strokeStyle = style.edge;
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.strokeRect(box.x + s * 0.06, box.y + s * 0.06, s * 0.88, s * 0.88);
  }

  // Cover: three little stones along the bottom edge.
  if (tile.cover && !tile.blocked) {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let i = 0; i < 3; i++) {
      circle(ctx, box.x + s * (0.28 + i * 0.22), box.y + s * 0.78, s * 0.07);
      ctx.fill();
    }
  }
}

export function paintSurface(ctx: Ctx, box: Box, tile: Tile, pos: Vec2, hatch: boolean): void {
  if (!tile.surface) return;
  const style = SURFACE_STYLES[tile.surface.id];
  const s = box.size;

  ctx.save();
  ctx.globalAlpha = style.alpha;
  ctx.fillStyle = style.fill;
  ctx.fillRect(box.x, box.y, s + 1, s + 1);

  // A brighter rim so adjacent surface tiles read as one pool rather than a
  // flat wash over half the map.
  ctx.globalAlpha = style.alpha * 0.6;
  ctx.strokeStyle = style.edge;
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.strokeRect(box.x + 1, box.y + 1, s - 2, s - 2);

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
