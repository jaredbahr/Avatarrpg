/**
 * The renderer.
 *
 * This is the only module in the game that holds a CanvasRenderingContext2D
 * (painters receive one, they do not own one). Everything it draws arrives as
 * a `MapView` built in `src/app` — it never reads game state, which is what
 * makes swapping Canvas 2D for Pixi later a single-file change.
 */

import type { Grid, StatusId, Tile, Vec2 } from '../core/types';
import { Camera, TILE } from './camera';
import type { Viewport } from './camera';
import { OVERLAY, SURFACE_STYLES, hpColor } from './palettes';
import { paintFloatingNumber, paintImpact, paintPathArrow, paintPathDot } from './painters/fx';
import {
  paintExitMarker,
  paintGridLine,
  paintOverlay,
  paintSurface,
  paintTerrain,
} from './painters/tiles';
import { paletteForAsset } from './painters/registry';
import { sprites } from './spriteCache';

export interface RenderUnit {
  readonly id: string;
  readonly pos: Vec2;
  readonly size: 1 | 2;
  readonly sprite: string;
  readonly name: string;
  readonly faction: 'party' | 'enemy' | 'ally';
  readonly hp: number;
  readonly maxHp: number;
  readonly statuses: readonly StatusId[];
  readonly fallen: boolean;
  /** Drawn at this position instead of `pos` while a move animates. */
  readonly renderPos?: Vec2;
  /** Off for the party strolling round a village. Defaults to on. */
  readonly showHealth?: boolean;
}

export type OverlayKind = 'move' | 'target' | 'area' | 'hover';

export interface OverlayLayer {
  readonly kind: OverlayKind;
  readonly tiles: readonly Vec2[];
}

export interface FxInstance {
  readonly pos: Vec2;
  readonly assetKey: string;
  /** 0 to 1 across the effect's lifetime. */
  readonly progress: number;
}

export interface Floater {
  readonly pos: Vec2;
  readonly text: string;
  readonly color: string;
  readonly progress: number;
}

export interface NpcMarker {
  readonly pos: Vec2;
  readonly sprite: string;
  readonly name: string;
}

/**
 * A prop, flattened for drawing.
 *
 * `hp`/`maxHp` rather than a `PropDef`: the renderer never reads content, so the
 * scene resolves the definition and hands over only what gets painted.
 */
export interface RenderProp {
  readonly id: string;
  readonly pos: Vec2;
  readonly sprite: string;
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
}

export interface MapView {
  readonly grid: Grid;
  readonly units: readonly RenderUnit[];
  readonly overlays: readonly OverlayLayer[];
  readonly npcs: readonly NpcMarker[];
  readonly props: readonly RenderProp[];
  readonly path: readonly Vec2[];
  readonly fx: readonly FxInstance[];
  readonly floaters: readonly Floater[];
  readonly activeUnitId: string | null;
  readonly selectedUnitId: string | null;
  readonly hoverTile: Vec2 | null;
  readonly exit: { readonly pos: Vec2; readonly label: string } | null;
  /** Colourblind hatch patterns on surfaces. */
  readonly hatch: boolean;
  /** Milliseconds since start, for idle animation. */
  readonly time: number;
}

const FACTION_RING: Record<RenderUnit['faction'], string> = {
  party: OVERLAY.friendly,
  ally: 'rgba(160, 220, 170, 0.9)',
  enemy: OVERLAY.hostile,
};

/** Short badges drawn under a unit so statuses are visible without a tooltip. */
const STATUS_BADGE: Record<StatusId, { letter: string; color: string }> = {
  burning: { letter: 'B', color: '#e0521f' },
  wet: { letter: 'W', color: '#3e8fb0' },
  chilled: { letter: 'C', color: '#9fd8ea' },
  frozen: { letter: 'F', color: '#cdeefb' },
  shocked: { letter: 'S', color: '#f0c674' },
  stunned: { letter: '!', color: '#f0c674' },
  slowed: { letter: '↓', color: '#bfae97' },
  blinded: { letter: '●', color: '#8d7d69' },
  rooted: { letter: 'R', color: '#7c5d33' },
  chiBlocked: { letter: 'X', color: '#c3a8d8' },
  guarded: { letter: '■', color: '#6fbf73' },
  inspired: { letter: '★', color: '#f0c674' },
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  camera: Camera;

  constructor(
    private canvas: HTMLCanvasElement,
    grid: { width: number; height: number },
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available in this browser');
    this.ctx = ctx;
    this.camera = new Camera(this.measure(), grid);
  }

  private measure(): Viewport {
    const rect = this.canvas.getBoundingClientRect();
    return {
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
      dpr: Math.min(3, window.devicePixelRatio || 1),
    };
  }

  /** Re-reads the element size and resizes the backing store. Call on resize. */
  resize(grid?: { width: number; height: number }): void {
    const viewport = this.measure();
    this.camera.viewport = viewport;
    if (grid) this.camera.grid = grid;
    this.canvas.width = Math.round(viewport.width * viewport.dpr);
    this.canvas.height = Math.round(viewport.height * viewport.dpr);
    sprites.clear();
  }

  get viewport(): Viewport {
    return this.camera.viewport;
  }

  draw(view: MapView): void {
    const { ctx, camera } = this;
    const dpr = camera.viewport.dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;

    ctx.fillStyle = '#120d0a';
    ctx.fillRect(0, 0, camera.viewport.width, camera.viewport.height);

    const bounds = camera.visibleBounds(view.grid);

    this.drawGround(view, bounds);
    this.drawOverlays(view);
    this.drawPath(view);
    this.drawExit(view);
    this.drawNpcs(view);
    this.drawProps(view);
    this.drawUnits(view);
    this.drawFx(view);
    this.drawFloaters(view);

    ctx.restore();
  }

  /* ---------------------------------------------------------------- */

  private drawGround(
    view: MapView,
    bounds: { x0: number; y0: number; x1: number; y1: number },
  ): void {
    const { ctx, camera } = this;
    for (let y = bounds.y0; y <= bounds.y1; y++) {
      for (let x = bounds.x0; x <= bounds.x1; x++) {
        const tile = view.grid.tiles[y * view.grid.width + x];
        if (!tile) continue;
        const pos = { x, y };
        const box = camera.toScreen(pos);
        paintTerrain(ctx, box, tile, pos);
        paintSurface(ctx, box, tile, pos, view.hatch);
        paintGridLine(ctx, box, 'rgba(0,0,0,0.18)');
      }
    }
  }

  private drawOverlays(view: MapView): void {
    const { ctx, camera } = this;

    for (const layer of view.overlays) {
      if (layer.tiles.length === 0) continue;
      const members = new Set(layer.tiles.map((p) => `${p.x},${p.y}`));
      const [fill, edge] = this.overlayColors(layer.kind);

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

  private overlayColors(kind: OverlayKind): [string, string | null] {
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

  private drawPath(view: MapView): void {
    if (view.path.length === 0) return;
    const { ctx, camera } = this;
    view.path.forEach((pos, index) => {
      const box = camera.toScreen(pos);
      if (index === view.path.length - 1) paintPathArrow(ctx, box, OVERLAY.path);
      else paintPathDot(ctx, box, OVERLAY.path);
    });
  }

  private drawExit(view: MapView): void {
    if (!view.exit) return;
    const box = this.camera.toScreen(view.exit.pos);
    const pulse = (Math.sin(view.time / 420) + 1) / 2;
    paintExitMarker(this.ctx, box, '#f0c674', pulse);
  }

  private drawNpcs(view: MapView): void {
    const { ctx, camera } = this;
    for (const npc of view.npcs) {
      const box = camera.toScreen(npc.pos);
      if (!camera.isVisible(npc.pos)) continue;
      const sprite = sprites.get(npc.sprite, box.size, { facing: 1 });
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

  private drawProps(view: MapView): void {
    const { ctx, camera } = this;

    for (const prop of view.props) {
      if (!camera.isVisible(prop.pos)) continue;
      const box = camera.toScreen(prop.pos);
      const sprite = sprites.get(prop.sprite, box.size, { facing: 1 });
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

  private drawUnits(view: MapView): void {
    const { ctx, camera } = this;

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
      const sprite = sprites.get(
        unit.sprite,
        box.size,
        { facing: unit.faction === 'enemy' ? -1 : 1 },
        unit.size,
      );
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

  private drawFx(view: MapView): void {
    const { ctx, camera } = this;
    for (const fx of view.fx) {
      const box = camera.toScreen(fx.pos);
      if (!camera.isVisible(fx.pos)) continue;
      paintImpact(ctx, box, paletteForAsset(fx.assetKey), {
        variant: fx.assetKey.split('.')[2],
        progress: fx.progress,
      });
    }
  }

  private drawFloaters(view: MapView): void {
    const { ctx, camera } = this;
    for (const floater of view.floaters) {
      const box = camera.toScreen(floater.pos);
      paintFloatingNumber(ctx, box, floater.text, floater.color, floater.progress);
    }
  }

  /** Legend entries for the surfaces currently on the map, for the HUD. */
  static surfaceLegend(grid: Grid): { id: string; label: string; color: string }[] {
    const present = new Set<string>();
    for (const tile of grid.tiles as readonly Tile[]) {
      if (tile.surface) present.add(tile.surface.id);
    }
    return [...present].map((id) => {
      const style = SURFACE_STYLES[id as keyof typeof SURFACE_STYLES];
      return { id, label: style.label, color: style.fill };
    });
  }
}

export { TILE };
