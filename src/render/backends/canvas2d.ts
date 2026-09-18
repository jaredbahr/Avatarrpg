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

import type { Grid, Vec2 } from '../../core/types';
import { resolveAsset } from '../../content/assets/manifest';
import type { Camera, Viewport } from '../camera';
import type { TileRelief } from '../geometry/board';
import { boardRelief, decorSignature, surfaceEdges } from '../geometry/board';
import { aimArcPoints, arcHeading, arrowheadPolygon } from '../geometry/arc';
import { contourLoops } from '../geometry/contour';
import type { Curve } from '../geometry/curve';
import { sampleAt, smoothPath } from '../geometry/curve';
import { CanvasFxLayer } from '../fx/canvasFx';
import { backdrops } from '../backdrops';
import { FACTION_RING, OVERLAY, STATUS_BADGE, hpColor } from '../palettes';
import { paintTileDecor } from '../painters/board';
import { paintFloatingNumber, paintPathArrow, paintPathDot } from '../painters/fx';
import { FOOT_LINE } from '../sheets/bake';
import { idlePhase, sheets } from '../sheets/store';
import {
  paintExitMarker,
  paintGridLine,
  paintOverlay,
  paintSurface,
  paintTerrain,
} from '../painters/tiles';
import { sprites } from '../spriteCache';
import type { AimArc, MapView, OverlayKind, OverlayLayer, RenderUnit } from '../view';
import type { BackendCapabilities, RenderBackend } from './backend';

/** The rounded square a hovered tile gets, in tile units from its corner. */
const HOVER_LOOP = contourLoops([{ x: 0, y: 0 }])[0] ?? [];

/** How far a unit is drawn up the screen per tier of ground it stands on, in tiles. */
export const ELEVATION_LIFT = 0.06;

/** How far in from the board's edge the shading reaches, in tiles. */
export const EDGE_SHADE_TILES = 1.4;
export const EDGE_SHADE_ALPHA = 0.42;
export const VIGNETTE_ALPHA = 0.3;

/** Elevation under a tile, 0 off the map. */
export function elevationAt(grid: Grid, pos: Vec2): number {
  if (pos.x < 0 || pos.y < 0 || pos.x >= grid.width || pos.y >= grid.height) return 0;
  return grid.tiles[pos.y * grid.width + pos.x]?.elevation ?? 0;
}

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
  private fx = new CanvasFxLayer();
  /** White silhouettes of unit art, for the hit flash; forgotten with the source. */
  private masks = new WeakMap<HTMLCanvasElement | HTMLImageElement, HTMLCanvasElement>();
  /** Cliffs, rims and wall outlines, rebuilt only when a tile's footing changes. */
  private relief: ReadonlyMap<number, TileRelief> = new Map();
  private reliefSignature = '';

  constructor(private canvas: HTMLCanvasElement) {
    // Transparent, so the page's mood wash shows round the board (ADR 0008).
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas 2D is not available in this browser');
    this.ctx = ctx;
  }

  resize(viewport: Viewport): void {
    this.canvas.width = Math.round(viewport.width * viewport.dpr);
    this.canvas.height = Math.round(viewport.height * viewport.dpr);
    sprites.clear();
    sheets.clear();
  }

  destroy(): void {
    sprites.clear();
    sheets.clear();
  }

  draw(view: MapView, camera: Camera): void {
    const { ctx } = this;
    const dpr = camera.viewport.dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, camera.viewport.width, camera.viewport.height);

    // The shake moves the world, not the clear: a knocked camera shows the
    // same margin at its edge that the fit leaves anyway.
    const tilePx = camera.toScreen({ x: 0, y: 0 }).size;
    ctx.translate(view.cameraNudge.x * tilePx, view.cameraNudge.y * tilePx);

    // A map's painting takes the terrain's place under everything else, once
    // it has loaded; the decor that marks footing over it comes back only
    // under High contrast, where the rules must read without the picture.
    const painting = view.backdrop ? backdrops.get(view.backdrop.url) : null;
    if (painting) this.drawBackdrop(painting, view, camera);
    this.drawGround(view, camera, painting !== null);
    if (!painting || view.crispOverlays) this.drawDecor(view, camera);
    if (view.atmosphere) this.drawShade(view, camera);
    this.drawOverlays(view, camera);
    this.drawPath(view, camera);
    if (view.aimArc) this.drawAimArc(view.aimArc, camera);
    this.drawFxLayer(view, camera, 'under');
    this.drawExit(view, camera);
    this.drawNpcs(view, camera);
    this.drawProps(view, camera);
    this.drawUnits(view, camera);
    this.drawFxLayer(view, camera, 'over');
    this.drawFloaters(view, camera);

    ctx.restore();
  }

  /* ---------------------------------------------------------------- */

  /** The painting over the whole board's rectangle: one draw, scaled to the camera. */
  private drawBackdrop(image: HTMLImageElement, view: MapView, camera: Camera): void {
    const origin = camera.toScreen({ x: 0, y: 0 });
    this.ctx.drawImage(
      image,
      origin.x,
      origin.y,
      view.grid.width * origin.size,
      view.grid.height * origin.size,
    );
  }

  /** Terrain, surfaces and tile lines; over a painting the terrain is the painting. */
  private drawGround(view: MapView, camera: Camera, painted: boolean): void {
    const { ctx } = this;
    const bounds = camera.visibleBounds(view.grid);
    for (let y = bounds.y0; y <= bounds.y1; y++) {
      for (let x = bounds.x0; x <= bounds.x1; x++) {
        const tile = view.grid.tiles[y * view.grid.width + x];
        if (!tile) continue;
        const pos = { x, y };
        const box = camera.toScreen(pos);
        if (!painted) paintTerrain(ctx, box, tile, pos);
        paintSurface(ctx, box, tile, pos, view.hatch, surfaceEdges(view.grid, pos));
        if (view.gridLines) paintGridLine(ctx, box, 'rgba(0,0,0,0.18)');
      }
    }
  }

  /** Cliffs, canopies, walls, cover and decals: a second pass so overhangs land on neighbours. */
  private drawDecor(view: MapView, camera: Camera): void {
    const { ctx } = this;
    const signature = decorSignature(view.grid);
    if (signature !== this.reliefSignature) {
      this.reliefSignature = signature;
      this.relief = boardRelief(view.grid);
    }
    const bounds = camera.visibleBounds(view.grid);
    for (let y = bounds.y0; y <= bounds.y1; y++) {
      for (let x = bounds.x0; x <= bounds.x1; x++) {
        const index = y * view.grid.width + x;
        const tile = view.grid.tiles[index];
        if (!tile) continue;
        const pos = { x, y };
        paintTileDecor(ctx, camera.toScreen(pos), tile, pos, this.relief.get(index));
      }
    }
  }

  /**
   * The board's edges fall off into the dark and the corners of the view
   * dim: four gradients along the board's sides and one radial across the
   * viewport, over the ground and under everything that stands on it.
   */
  private drawShade(view: MapView, camera: Camera): void {
    const { ctx } = this;
    const origin = camera.toScreen({ x: 0, y: 0 });
    const size = origin.size;
    const w = view.grid.width * size;
    const h = view.grid.height * size;
    const reach = size * EDGE_SHADE_TILES;
    const dark = `rgba(0,0,0,${EDGE_SHADE_ALPHA})`;
    const clear = 'rgba(0,0,0,0)';

    ctx.save();
    ctx.beginPath();
    ctx.rect(origin.x, origin.y, w, h);
    ctx.clip();
    const sides: [number, number, number, number][] = [
      [origin.x, origin.y, origin.x, origin.y + reach],
      [origin.x, origin.y + h, origin.x, origin.y + h - reach],
      [origin.x, origin.y, origin.x + reach, origin.y],
      [origin.x + w, origin.y, origin.x + w - reach, origin.y],
    ];
    for (const [x0, y0, x1, y1] of sides) {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, dark);
      g.addColorStop(1, clear);
      ctx.fillStyle = g;
      ctx.fillRect(origin.x, origin.y, w, h);
    }
    ctx.restore();

    const { width, height } = camera.viewport;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.hypot(cx, cy);
    const vignette = ctx.createRadialGradient(cx, cy, radius * 0.45, cx, cy, radius);
    vignette.addColorStop(0, clear);
    vignette.addColorStop(1, `rgba(0,0,0,${VIGNETTE_ALPHA})`);
    ctx.save();
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
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
    this.fillPolygon(arrowheadPolygon(tip, end.tangent, size), OVERLAY.path);
    ctx.restore();
  }

  /**
   * The throw being aimed: the flight's own curve as dots in the element's
   * light tone over an ink line, with an arrowhead where it lands. Still,
   * so reduce motion needs nothing; nothing here is on the timeline.
   */
  private drawAimArc(arc: AimArc, camera: Camera): void {
    const { ctx } = this;
    const origin = camera.toScreen({ x: 0, y: 0 });
    const size = origin.size;
    const points = aimArcPoints(arc.from, arc.to, arc.arc).map((p) => ({
      x: origin.x + p.x * size,
      y: origin.y + p.y * size,
    }));

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((p, index) => {
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = OVERLAY.pathUnder;
    ctx.lineWidth = Math.max(4, size * 0.1);
    ctx.stroke();

    ctx.fillStyle = arc.color;
    for (let i = 0; i < points.length - 1; i += 2) {
      const p = points[i];
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.5, size * 0.05), 0, Math.PI * 2);
      ctx.fill();
    }
    const tip = points[points.length - 1];
    if (tip) this.fillPolygon(arrowheadPolygon(tip, arcHeading(points), size), arc.color);
    ctx.restore();
  }

  private fillPolygon(flat: readonly number[], color: string): void {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const x = flat[i] ?? 0;
      const y = flat[i + 1] ?? 0;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawExit(view: MapView, camera: Camera): void {
    for (const exit of view.exits ?? (view.exit ? [view.exit] : [])) {
      const box = camera.toScreen(exit.pos);
      const pulse = (Math.sin(view.time / 420) + 1) / 2;
      paintExitMarker(this.ctx, box, '#f0c674', pulse);
    }
  }

  private drawNpcs(view: MapView, camera: Camera): void {
    const { ctx } = this;
    const { dpr } = camera.viewport;
    for (const npc of view.npcs) {
      const box = camera.toScreen(npc.pos);
      if (!camera.isVisible(npc.pos)) continue;
      box.y -= elevationAt(view.grid, npc.pos) * ELEVATION_LIFT * box.size;
      const entry = resolveAsset(npc.sprite);
      const width = entry.kind === 'sheet' && entry.footprint.w === 2 ? 2 : 1;
      const frame =
        entry.kind === 'sheet'
          ? sheets.frame(npc.sprite, 'idle', 0, 0, box.size * dpr, width)
          : null;
      if (frame) {
        const fw = (frame.frame.w / frame.pixelsPerTile) * box.size;
        const fh = (frame.frame.h / frame.pixelsPerTile) * box.size;
        const f = frame.frame;
        ctx.drawImage(
          frame.source,
          f.x,
          f.y,
          f.w,
          f.h,
          box.x + (width * box.size) / 2 - frame.anchor.x * fw,
          box.y + FOOT_LINE * box.size - frame.anchor.y * fh,
          fw,
          fh,
        );
      } else {
        const sprite = sprites.get(npc.sprite, box.size * dpr, { facing: 1 }, width);
        ctx.drawImage(sprite, box.x, box.y, box.size * width, box.size);
      }

      // A small "talk" pip so a child can tell an NPC from scenery.
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.35 * ((Math.sin(view.time / 500) + 1) / 2);
      ctx.fillStyle = '#f0c674';
      ctx.beginPath();
      ctx.arc(
        box.x + box.size * width * 0.5,
        box.y + box.size * 0.08,
        box.size * 0.07,
        0,
        Math.PI * 2,
      );
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
      box.y -= elevationAt(view.grid, prop.pos) * ELEVATION_LIFT * box.size;
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
      // So does the ground: a unit on a ledge stands a little higher on screen.
      if (unit.offset) {
        box.x += unit.offset.x * box.size;
        box.y += unit.offset.y * box.size;
      }
      box.y -= elevationAt(view.grid, unit.pos) * ELEVATION_LIFT * box.size;
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
      // A pose scales about the feet; the fallen fade sits on top of any alpha.
      const scale = unit.scale ?? 1;
      ctx.globalAlpha = (unit.alpha ?? 1) * (unit.fallen ? 0.35 : 1);
      // The frame comes from the unit's sheet, real or baked from its painter
      // at device resolution (ADR 0003); the anchor stands on the foot line.
      const frame = sheets.frame(
        unit.sprite,
        unit.clip ?? 'idle',
        unit.clipTime ?? view.time + idlePhase(unit.id),
        unit.clipFrame,
        box.size * dpr,
        unit.size,
      );
      let headroom = 0;
      if (frame) {
        headroom = frame.headroom;
        const fw = (frame.frame.w / frame.pixelsPerTile) * box.size * scale;
        const fh = (frame.frame.h / frame.pixelsPerTile) * box.size * scale;
        const ax = box.x + width / 2;
        const ay = box.y + FOOT_LINE * box.size;
        const drawX = ax - frame.anchor.x * fw;
        const drawY = ay - frame.anchor.y * fh;
        if (facing === -1) {
          ctx.translate(ax, 0);
          ctx.scale(-1, 1);
          ctx.translate(-ax, 0);
        }
        const f = frame.frame;
        ctx.drawImage(frame.source, f.x, f.y, f.w, f.h, drawX, drawY, fw, fh);
        if (unit.flash && unit.flash > 0) {
          ctx.globalAlpha *= Math.min(1, unit.flash);
          ctx.drawImage(this.mask(frame.source), f.x, f.y, f.w, f.h, drawX, drawY, fw, fh);
        }
      } else {
        const drawWidth = width * scale;
        const drawHeight = box.size * scale;
        const drawX = box.x + (width - drawWidth) / 2;
        const drawY = box.y + (box.size - drawHeight);
        // Painted at device resolution, drawn at CSS size under the dpr transform.
        const sprite = sprites.get(unit.sprite, box.size * dpr, { facing }, unit.size);
        ctx.drawImage(sprite, drawX, drawY, drawWidth, drawHeight);
        if (unit.flash && unit.flash > 0) {
          ctx.globalAlpha *= Math.min(1, unit.flash);
          ctx.drawImage(this.mask(sprite), drawX, drawY, drawWidth, drawHeight);
        }
      }
      ctx.restore();

      if (!unit.fallen) {
        if (unit.showHealth !== false) {
          this.drawHealthBar(unit, box.x, box.y - headroom * box.size, width, box.size);
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

  private drawFxLayer(view: MapView, camera: Camera, layer: 'under' | 'over'): void {
    if (view.emitters.length === 0) return;
    const origin = camera.toScreen({ x: 0, y: 0 });
    this.fx.draw(this.ctx, view.emitters, layer, { x: origin.x, y: origin.y }, origin.size);
  }

  /** The art as a white silhouette, for the hit flash. */
  private mask(sprite: HTMLCanvasElement | HTMLImageElement): HTMLCanvasElement {
    const existing = this.masks.get(sprite);
    if (existing) return existing;
    const canvas = document.createElement('canvas');
    canvas.width = sprite instanceof HTMLImageElement ? sprite.naturalWidth : sprite.width;
    canvas.height = sprite instanceof HTMLImageElement ? sprite.naturalHeight : sprite.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(sprite, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    this.masks.set(sprite, canvas);
    return canvas;
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
