/**
 * The Canvas 2D backend.
 *
 * This is the original renderer, kept as the fallback for anywhere WebGL is
 * unavailable. It is no longer where new drawing work goes — see `pixi.ts` —
 * but it must keep working, because a black screen mid-fight is a worse
 * outcome than a plainer one.
 *
 * It holds the only CanvasRenderingContext2D in the game; painters receive a
 * context, they never own one.
 */

import type { Vec2 } from '../../core/types';
import type { Camera, Viewport } from '../camera';
import { contourLoops } from '../geometry/contour';
import type { Curve } from '../geometry/curve';
import { sampleAt, smoothPath } from '../geometry/curve';
import { FACTION_RING, OVERLAY, STATUS_BADGE, hpColor } from '../palettes';
import { paintFloatingNumber, paintImpact, paintPathArrow, paintPathDot } from '../painters/fx';
import {
  paintExitMarker,
  paintGridLine,
  paintOverlay,
  paintSurface,
  paintTerrain,
} from '../painters/tiles';
import { paletteForAsset } from '../painters/registry';
import { sprites } from '../spriteCache';
import type { MapView, OverlayKind, OverlayLayer, RenderUnit } from '../view';
import type { BackendCapabilities, RenderBackend } from './backend';

/** The rounded square a hovered tile gets, in tile units from its corner. */
const HOVER_LOOP = contourLoops([{ x: 0, y: 0 }])[0] ?? [];

export class Canvas2DBackend implements RenderBackend {
  readonly capabilities: BackendCapabilities = { name: 'canvas', shaders: false, particles: false };

  private ctx: CanvasRenderingContext2D;
  /**
   * Contours per overlay layer and the curve per path, keyed by identity: the
   * scene memoises its overlays, so the same objects come back frame after
   * frame until something changes, and a WeakMap forgets them with it.
   */
  private loops = new WeakMap<OverlayLayer, Vec2[][]>();
  private curve: { path: readonly Vec2[]; from: Vec2; curve: Curve } | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available in this browser');
    this.ctx = ctx;
  }

  resize(viewport: Viewport): void {
    this.canvas.width = Math.round(viewport.width * viewport.dpr);
    this.canvas.height = Math.round(viewport.height * viewport.dpr);
    sprites.clear();
  }

  destroy(): void {
    sprites.clear();
  }

  draw(view: MapView, camera: Camera): void {
    const { ctx } = this;
    const dpr = camera.viewport.dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;

    ctx.fillStyle = '#120d0a';
    ctx.fillRect(0, 0, camera.viewport.width, camera.viewport.height);

    this.drawGround(view, camera);
    this.drawOverlays(view, camera);
    this.drawPath(view, camera);
    this.drawExit(view, camera);
    this.drawNpcs(view, camera);
    this.drawProps(view, camera);
    this.drawUnits(view, camera);
    this.drawFx(view, camera);
    this.drawFloaters(view, camera);

    ctx.restore();
  }

  /* ---------------------------------------------------------------- */

  private drawGround(view: MapView, camera: Camera): void {
    const { ctx } = this;
    const bounds = camera.visibleBounds(view.grid);
    for (let y = bounds.y0; y <= bounds.y1; y++) {
      for (let x = bounds.x0; x <= bounds.x1; x++) {
        const tile = view.grid.tiles[y * view.grid.width + x];
        if (!tile) continue;
        const pos = { x, y };
        const box = camera.toScreen(pos);
        paintTerrain(ctx, box, tile, pos);
        paintSurface(ctx, box, tile, pos, view.hatch);
        if (view.gridLines) paintGridLine(ctx, box, 'rgba(0,0,0,0.18)');
      }
    }
  }

  private drawOverlays(view: MapView, camera: Camera): void {
    if (view.crispOverlays) {
      this.drawCrispOverlays(view, camera);
      return;
    }

    const { ctx } = this;
    const origin = camera.toScreen({ x: 0, y: 0 });
    const size = origin.size;

    for (const layer of view.overlays) {
      if (layer.tiles.length === 0) continue;
      let loops = this.loops.get(layer);
      if (!loops) {
        loops = contourLoops(layer.tiles);
        this.loops.set(layer, loops);
      }
      const [fill, edge] = overlayColors(layer.kind);

      ctx.save();
      ctx.beginPath();
      for (const loop of loops) tracePolygon(ctx, loop, origin, size);
      ctx.fillStyle = fill;
      ctx.fill('evenodd');
      if (edge) {
        // A wide faint stroke under a thin crisp one: a soft edge with no blur.
        ctx.lineJoin = 'round';
        ctx.strokeStyle = edge;
        ctx.globalAlpha = OVERLAY.softAlpha;
        ctx.lineWidth = size * OVERLAY.softWidth;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = Math.max(2, size * OVERLAY.edgeWidth);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (view.hoverTile) {
      const box = camera.toScreen(view.hoverTile);
      ctx.save();
      ctx.beginPath();
      tracePolygon(ctx, HOVER_LOOP, box, box.size);
      ctx.fillStyle = OVERLAY.hover;
      ctx.fill();
      ctx.restore();
    }
  }

  /** The pre-contour look, kept for High contrast: a square per tile, hard edges. */
  private drawCrispOverlays(view: MapView, camera: Camera): void {
    const { ctx } = this;

    for (const layer of view.overlays) {
      if (layer.tiles.length === 0) continue;
      const members = new Set(layer.tiles.map((p) => `${p.x},${p.y}`));
      const [fill, edge] = overlayColors(layer.kind);

      for (const pos of layer.tiles) {
        const box = camera.toScreen(pos);
        if (!camera.isVisible(pos)) continue;
        // Only the outside of the region gets a border, so a move range reads
        // as one shape instead of a grid of boxes.
        paintOverlay(ctx, box, fill, edge, {
          top: !members.has(`${pos.x},${pos.y - 1}`),
          right: !members.has(`${pos.x + 1},${pos.y}`),
          bottom: !members.has(`${pos.x},${pos.y + 1}`),
          left: !members.has(`${pos.x - 1},${pos.y}`),
        });
      }
    }

    if (view.hoverTile) {
      const box = camera.toScreen(view.hoverTile);
      paintOverlay(ctx, box, OVERLAY.hover, null, null);
    }
  }

  private drawPath(view: MapView, camera: Camera): void {
    if (view.path.length === 0) return;
    const { ctx } = this;

    if (!view.pathFrom || view.crispOverlays) {
      view.path.forEach((pos: Vec2, index: number) => {
        const box = camera.toScreen(pos);
        if (index === view.path.length - 1) paintPathArrow(ctx, box, OVERLAY.path);
        else paintPathDot(ctx, box, OVERLAY.path);
      });
      return;
    }

    const from = view.pathFrom;
    if (!this.curve || this.curve.path !== view.path || this.curve.from !== from) {
      this.curve = { path: view.path, from, curve: smoothPath(from, view.path) };
    }
    const curve = this.curve.curve;
    const origin = camera.toScreen({ x: 0, y: 0 });
    const size = origin.size;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    curve.points.forEach((p, index) => {
      const x = origin.x + p.x * size;
      const y = origin.y + p.y * size;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = OVERLAY.pathUnder;
    ctx.lineWidth = Math.max(4, size * 0.11);
    ctx.stroke();
    ctx.strokeStyle = OVERLAY.path;
    ctx.lineWidth = Math.max(2, size * 0.05);
    // A slow crawl along the route, so the line reads as a direction of travel.
    ctx.setLineDash([size * 0.22, size * 0.16]);
    ctx.lineDashOffset = -((view.time / 30) % (size * 0.38));
    ctx.stroke();
    ctx.setLineDash([]);

    // The arrowhead sits on the last tangent, pointing the way the walk ends.
    const end = sampleAt(curve, curve.length);
    const tip = { x: origin.x + end.pos.x * size, y: origin.y + end.pos.y * size };
    const back = size * 0.22;
    const half = size * 0.14;
    const tx = end.tangent.x;
    const ty = end.tangent.y;
    ctx.fillStyle = OVERLAY.path;
    ctx.beginPath();
    ctx.moveTo(tip.x + tx * back * 0.45, tip.y + ty * back * 0.45);
    ctx.lineTo(tip.x - tx * back + ty * half, tip.y - ty * back - tx * half);
    ctx.lineTo(tip.x - tx * back * 0.55, tip.y - ty * back * 0.55);
    ctx.lineTo(tip.x - tx * back - ty * half, tip.y - ty * back + tx * half);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawExit(view: MapView, camera: Camera): void {
    if (!view.exit) return;
    const box = camera.toScreen(view.exit.pos);
    const pulse = (Math.sin(view.time / 420) + 1) / 2;
    paintExitMarker(this.ctx, box, '#f0c674', pulse);
  }

  private drawNpcs(view: MapView, camera: Camera): void {
    const { ctx } = this;
    const { dpr } = camera.viewport;
    for (const npc of view.npcs) {
      const box = camera.toScreen(npc.pos);
      if (!camera.isVisible(npc.pos)) continue;
      const sprite = sprites.get(npc.sprite, box.size * dpr, { facing: 1 });
      ctx.drawImage(sprite, box.x, box.y, box.size, box.size);

      // A small "talk" pip so a child can tell an NPC from scenery.
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.35 * ((Math.sin(view.time / 500) + 1) / 2);
      ctx.fillStyle = '#f0c674';
      ctx.beginPath();
      ctx.arc(box.x + box.size * 0.5, box.y + box.size * 0.08, box.size * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawProps(view: MapView, camera: Camera): void {
    const { ctx } = this;
    const { dpr } = camera.viewport;

    for (const prop of view.props) {
      if (!camera.isVisible(prop.pos)) continue;
      const box = camera.toScreen(prop.pos);
      const sprite = sprites.get(prop.sprite, box.size * dpr, { facing: 1 });
      ctx.drawImage(sprite, box.x, box.y, box.size, box.size);

      /*
       * A damage bar only once it has been hit. Showing a full bar on every
       * barrel would read as "these are enemies"; showing a dented one reads as
       * "this is nearly open", which is the only thing worth communicating.
       */
      if (prop.hp >= prop.maxHp || prop.maxHp <= 0) continue;
      const w = box.size * 0.6;
      const x = box.x + (box.size - w) / 2;
      const y = box.y + box.size * 0.9;
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(x, y, w, Math.max(2, box.size * 0.05));
      ctx.fillStyle = '#d9a441';
      ctx.fillRect(x, y, (w * prop.hp) / prop.maxHp, Math.max(2, box.size * 0.05));
      ctx.restore();
    }
  }

  private drawUnits(view: MapView, camera: Camera): void {
    const { ctx } = this;
    const { dpr } = camera.viewport;

    // Draw back to front so a unit lower on the map overlaps one above it.
    const ordered = [...view.units].sort(
      (a, b) => (a.renderPos ?? a.pos).y - (b.renderPos ?? b.pos).y,
    );

    for (const unit of ordered) {
      const pos = unit.renderPos ?? unit.pos;
      const box = camera.toScreen(pos);
      const width = unit.size === 2 ? box.size * 2 : box.size;

      if (!camera.isVisible(pos) && !camera.isVisible({ x: pos.x + unit.size - 1, y: pos.y })) {
        continue;
      }

      // The bob lifts the drawing, never the sort: it is applied after ordering.
      if (unit.offset) {
        box.x += unit.offset.x * box.size;
        box.y += unit.offset.y * box.size;
      }
      const facing = unit.facing ?? (unit.faction === 'enemy' ? -1 : 1);

      // Active-unit ring, drawn under the sprite.
      if (unit.id === view.activeUnitId) {
        ctx.save();
        ctx.strokeStyle = OVERLAY.active;
        ctx.lineWidth = Math.max(2, box.size * 0.06);
        ctx.globalAlpha = 0.75 + 0.25 * ((Math.sin(view.time / 300) + 1) / 2);
        ctx.beginPath();
        ctx.ellipse(
          box.x + width / 2,
          box.y + box.size * 0.86,
          width * 0.42,
          box.size * 0.14,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.restore();
      } else if (unit.id === view.selectedUnitId) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = Math.max(1, box.size * 0.03);
        ctx.beginPath();
        ctx.ellipse(
          box.x + width / 2,
          box.y + box.size * 0.86,
          width * 0.4,
          box.size * 0.12,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      if (unit.fallen) ctx.globalAlpha = 0.35;
      // Painted at device resolution, drawn at CSS size under the dpr transform.
      const sprite = sprites.get(unit.sprite, box.size * dpr, { facing }, unit.size);
      ctx.drawImage(sprite, box.x, box.y, width, box.size);
      ctx.restore();

      if (!unit.fallen) {
        if (unit.showHealth !== false) {
          this.drawHealthBar(unit, box.x, box.y, width, box.size);
        }
        this.drawStatusBadges(unit, box.x, box.y, width, box.size);
      } else {
        // A fallen unit gets a clear cross rather than just fading out.
        ctx.save();
        ctx.strokeStyle = 'rgba(226,88,74,0.85)';
        ctx.lineWidth = Math.max(2, box.size * 0.06);
        ctx.beginPath();
        ctx.moveTo(box.x + width * 0.3, box.y + box.size * 0.35);
        ctx.lineTo(box.x + width * 0.7, box.y + box.size * 0.75);
        ctx.moveTo(box.x + width * 0.7, box.y + box.size * 0.35);
        ctx.lineTo(box.x + width * 0.3, box.y + box.size * 0.75);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawHealthBar(unit: RenderUnit, x: number, y: number, width: number, size: number): void {
    const { ctx } = this;
    const fraction = Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
    const barWidth = width * 0.72;
    const barHeight = Math.max(3, size * 0.075);
    const barX = x + (width - barWidth) / 2;
    const barY = y + size * 0.06;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
    ctx.fillStyle = hpColor(fraction);
    ctx.fillRect(barX, barY, barWidth * fraction, barHeight);
    ctx.strokeStyle = FACTION_RING[unit.faction];
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 0.5, barY - 0.5, barWidth + 1, barHeight + 1);
  }

  private drawStatusBadges(
    unit: RenderUnit,
    x: number,
    y: number,
    width: number,
    size: number,
  ): void {
    if (unit.statuses.length === 0) return;
    const { ctx } = this;
    const radius = Math.max(4, size * 0.09);
    const shown = unit.statuses.slice(0, 4);
    const totalWidth = shown.length * radius * 2.2;
    let bx = x + width / 2 - totalWidth / 2 + radius;
    const by = y + size * 0.97;

    ctx.save();
    ctx.font = `700 ${Math.round(radius * 1.2)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const status of shown) {
      const badge = STATUS_BADGE[status];
      ctx.beginPath();
      ctx.arc(bx, by, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(12,9,6,0.85)';
      ctx.fill();
      ctx.strokeStyle = badge.color;
      ctx.lineWidth = Math.max(1, radius * 0.25);
      ctx.stroke();
      ctx.fillStyle = badge.color;
      ctx.fillText(badge.letter, bx, by + radius * 0.05);
      bx += radius * 2.2;
    }
    ctx.restore();
  }

  private drawFx(view: MapView, camera: Camera): void {
    const { ctx } = this;
    for (const fx of view.fx) {
      const box = camera.toScreen(fx.pos);
      if (!camera.isVisible(fx.pos)) continue;
      paintImpact(ctx, box, paletteForAsset(fx.assetKey), {
        variant: fx.assetKey.split('.')[2],
        progress: fx.progress,
      });
    }
  }

  private drawFloaters(view: MapView, camera: Camera): void {
    const { ctx } = this;
    for (const floater of view.floaters) {
      const box = camera.toScreen(floater.pos);
      paintFloatingNumber(ctx, box, floater.text, floater.color, floater.progress);
    }
  }
}

/** Adds a closed loop, in tile units, to the current path at screen scale. */
function tracePolygon(
  ctx: CanvasRenderingContext2D,
  loop: readonly Vec2[],
  origin: { x: number; y: number },
  size: number,
): void {
  loop.forEach((p, index) => {
    const x = origin.x + p.x * size;
    const y = origin.y + p.y * size;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

export function overlayColors(kind: OverlayKind): [string, string | null] {
  switch (kind) {
    case 'move':
      return [OVERLAY.move, OVERLAY.moveEdge];
    case 'target':
      return [OVERLAY.target, OVERLAY.targetEdge];
    case 'area':
      return [OVERLAY.area, OVERLAY.areaEdge];
    case 'hover':
      return [OVERLAY.hover, null];
  }
}
