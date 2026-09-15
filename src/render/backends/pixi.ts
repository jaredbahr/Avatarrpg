/**
 * The WebGL backend.
 *
 * Everything sits under one root container whose transform is the camera, so
 * children are positioned in world pixels (tile * TILE) and panning is a single
 * matrix update rather than a per-object recalculation.
 *
 * The ground is one draw call: a quad carrying a shader that reads per-tile
 * terrain and surface state out of a small data texture. That is what lets fire
 * burn, water ripple and light spill onto neighbouring tiles without the CPU
 * touching a tile between frames.
 *
 * Unit art is unchanged — `spriteCache` already rasterises the painters into
 * canvases, and a canvas uploads as a texture.
 */

import {
  Application,
  Container,
  Filter,
  GlProgram,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
  UniformGroup,
} from 'pixi.js';

import type { Grid, SurfaceId, TerrainId, Vec2 } from '../../core/types';
import { TILE } from '../camera';
import type { Camera, Viewport } from '../camera';
import { FACTION_RING, OVERLAY, STATUS_BADGE, hpColor } from '../palettes';
import { sprites } from '../spriteCache';
import type { MapView, RenderUnit } from '../view';
import type { RenderBackend } from './backend';
import { overlayColors } from './canvas2d';
import { FILTER_VERTEX, GROUND_FRAGMENT } from './shaders';

/** Must match terrainBase() in shaders.ts. */
const TERRAIN_INDEX: Record<TerrainId, number> = {
  grass: 0,
  dirt: 1,
  road: 2,
  stone: 3,
  sand: 4,
  wood: 5,
  water_deep: 6,
  wall: 7,
  pit: 8,
};

/** The ground pass renders at this fraction of device resolution. */
const GROUND_RESOLUTION = 0.5;

/** How far firelight reaches, in tiles. */
const GLOW_RADIUS = 2;

/** 0 means no surface. Must match the surface branches in shaders.ts. */
const SURFACE_INDEX: Record<SurfaceId, number> = {
  water: 1,
  ice: 2,
  fire: 3,
  mud: 4,
  steam: 5,
  oil: 6,
  rubble: 7,
};

export class PixiBackend implements RenderBackend {
  private app: Application | null = null;
  private destroyed = false;

  /** Latest view, drawn as soon as the async init finishes. */
  private pending: { view: MapView; camera: Camera } | null = null;

  private root = new Container();
  private groundSprite = new Sprite(Texture.WHITE);
  private overlayGfx = new Graphics();
  private pathGfx = new Graphics();
  private decorGfx = new Graphics();
  private unitLayer = new Container();
  private fxGfx = new Graphics();
  private floaterLayer = new Container();

  private groundUniforms = new UniformGroup({
    uGrid: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    uViewport: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    uOffset: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
    uTileSize: { value: TILE, type: 'f32' },
    uTime: { value: 0, type: 'f32' },
    uHatch: { value: 0, type: 'f32' },
  });
  private groundFilter: Filter | null = null;

  /** Applied once init finishes, since resize can land before the app exists. */
  private viewport: Viewport = { width: 1, height: 1, dpr: 1 };

  /*
   * One persistent data texture, created before the filter so it can be bound
   * at construction. Assigning `filter.resources.uMap` afterwards does not
   * rebuild the bind group, so the sampler would read nothing at all.
   */
  private mapCanvas = document.createElement('canvas');
  private mapTexture: Texture;
  private mapSignature = '';

  /** Sprite pools, keyed so a unit keeps its object across frames. */
  private unitSprites = new Map<string, Sprite>();
  private textureCache = new Map<HTMLCanvasElement, Texture>();
  private floaters: Text[] = [];
  private badgeText: Text[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.mapCanvas.width = 1;
    this.mapCanvas.height = 1;
    this.mapTexture = Texture.from(this.mapCanvas);
    this.mapTexture.source.scaleMode = 'nearest';
    void this.init();
  }

  /**
   * WebGL being *present* is not the question — whether it is accelerated is.
   *
   * Measured on this project: with a real GPU the shader path is what the whole
   * move is for, but against a software rasteriser (SwiftShader, llvmpipe) the
   * board runs at 6fps where Canvas 2D holds 60. That is not this shader being
   * expensive — dropping it entirely changed nothing — it is software GL being
   * an order of magnitude slower at the same work. So a machine without
   * acceleration is better served by the 2D path, and says so here.
   */
  static isSupported(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
      if (!gl) return false;
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      if (!info) return true;
      const renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '');
      return !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
    } catch {
      return false;
    }
  }

  private async init(): Promise<void> {
    const app = new Application();
    await app.init({
      canvas: this.canvas,
      background: '#120d0a',
      antialias: false,
      width: this.viewport.width,
      height: this.viewport.height,
      resolution: this.viewport.dpr,
      // The app's own CSS sizes the canvas; Pixi must not write inline styles
      // over it, which is also how the Canvas 2D backend behaves.
      autoDensity: false,
      preference: 'webgl',
    });

    // `destroy()` can land while init is still in flight.
    if (this.destroyed) {
      app.destroy(true);
      return;
    }

    app.ticker.stop();
    this.app = app;

    this.groundFilter = new Filter({
      glProgram: GlProgram.from({ vertex: FILTER_VERTEX, fragment: GROUND_FRAGMENT }),
      resources: { groundUniforms: this.groundUniforms, uMap: this.mapTexture.source },
      padding: 0,
      /*
       * The ground is procedural texture and soft gradients, so running the
       * pass at half resolution and letting it upscale is close to invisible —
       * and it quarters the per-frame pixel cost, which is the single biggest
       * lever on machines without a GPU.
       */
      resolution: GROUND_RESOLUTION,
    });
    this.groundSprite.filters = [this.groundFilter];

    // The ground quad is screen-sized and sits OUTSIDE the camera transform:
    // its shader derives tile coordinates from the camera uniforms instead.
    app.stage.addChild(this.groundSprite);

    // Any resize that arrived during init was dropped; apply the latest now.
    this.applyViewport();

    this.root.addChild(
      this.overlayGfx,
      this.pathGfx,
      this.decorGfx,
      this.unitLayer,
      this.fxGfx,
      this.floaterLayer,
    );
    app.stage.addChild(this.root);

    if (this.pending) {
      const { view, camera } = this.pending;
      this.pending = null;
      this.draw(view, camera);
    }
  }

  resize(viewport: Viewport): void {
    sprites.clear();
    this.textureCache.clear();
    this.viewport = viewport;
    this.applyViewport();
  }

  /** No-op until init finishes; init calls it again with the stored viewport. */
  private applyViewport(): void {
    const app = this.app;
    if (!app) return;
    app.renderer.resolution = this.viewport.dpr;
    app.renderer.resize(this.viewport.width, this.viewport.height);
    this.groundSprite.position.set(0, 0);
    this.groundSprite.width = this.viewport.width;
    this.groundSprite.height = this.viewport.height;
  }

  destroy(): void {
    this.destroyed = true;
    this.app?.destroy(false, { children: true });
    this.app = null;
    this.textureCache.clear();
    this.unitSprites.clear();
    this.mapTexture.destroy(true);
  }

  draw(view: MapView, camera: Camera): void {
    const app = this.app;
    if (!app) {
      // Still initialising: keep only the newest frame.
      this.pending = { view, camera };
      return;
    }

    this.root.position.set(-camera.offsetX, -camera.offsetY);
    this.root.scale.set(camera.scale);

    this.syncGround(view, camera);
    this.drawOverlays(view);
    this.drawPath(view);
    this.drawDecor(view);
    this.drawUnits(view);
    this.drawFx(view);
    this.drawFloaters(view);

    app.renderer.render(app.stage);
  }

  /* ---------------------------------------------------------------- */
  /* Ground                                                            */
  /* ---------------------------------------------------------------- */

  private syncGround(view: MapView, camera: Camera): void {
    const { grid } = view;
    this.uploadMap(grid);

    const uniforms = this.groundUniforms.uniforms as {
      uGrid: Float32Array;
      uViewport: Float32Array;
      uOffset: Float32Array;
      uTileSize: number;
      uTime: number;
      uHatch: number;
    };
    uniforms.uGrid[0] = grid.width;
    uniforms.uGrid[1] = grid.height;
    uniforms.uViewport[0] = camera.viewport.width;
    uniforms.uViewport[1] = camera.viewport.height;
    uniforms.uOffset[0] = camera.offsetX;
    uniforms.uOffset[1] = camera.offsetY;
    uniforms.uTileSize = TILE * camera.scale;
    uniforms.uTime = view.time / 1000;
    uniforms.uHatch = view.hatch ? 1 : 0;

    /*
     * UniformGroup.uniforms is a plain object, not a proxy: neither assigning a
     * field nor mutating an array in place marks the group dirty, and without
     * this call nothing above is ever uploaded. It fails silently and totally —
     * every uniform keeps its constructor default, which left uGrid at [1,1] and
     * rendered the whole board black.
     */
    this.groundUniforms.update();
  }

  /**
   * Writes per-tile state into the data texture, but only when it has actually
   * changed — a signature comparison is far cheaper than a GPU upload every
   * frame, and most frames change nothing on the ground.
   */
  private uploadMap(grid: Grid): void {
    let signature = `${grid.width}x${grid.height}`;
    for (const tile of grid.tiles) {
      signature += `|${tile.terrain}:${tile.surface?.id ?? ''}:${tile.surface?.duration ?? 0}`;
    }
    if (signature === this.mapSignature) return;
    this.mapSignature = signature;

    const resized = this.mapCanvas.width !== grid.width || this.mapCanvas.height !== grid.height;
    this.mapCanvas.width = grid.width;
    this.mapCanvas.height = grid.height;
    const ctx = this.mapCanvas.getContext('2d');
    if (!ctx) return;

    const image = ctx.createImageData(grid.width, grid.height);
    const intensities = new Float32Array(grid.tiles.length);

    for (let i = 0; i < grid.tiles.length; i++) {
      const tile = grid.tiles[i];
      if (!tile) continue;
      const surface = tile.surface ? (SURFACE_INDEX[tile.surface.id] ?? 0) : 0;
      // Surfaces thin out as they burn down, so a dying fire visibly fades.
      // A negative duration is map-authored and permanent: always full strength.
      const duration = tile.surface?.duration ?? 0;
      const intensity = tile.surface ? (duration < 0 ? 1 : Math.min(1, 0.45 + duration / 6)) : 0;
      intensities[i] = surface === SURFACE_INDEX.fire ? intensity : 0;

      const o = i * 4;
      image.data[o] = (TERRAIN_INDEX[tile.terrain] ?? 0) * 8 + surface;
      image.data[o + 1] = Math.round(255 * intensity);
      image.data[o + 3] = 255;
    }

    // Firelight, accumulated once per map change rather than per pixel per frame.
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        let light = 0;
        for (let dy = -GLOW_RADIUS; dy <= GLOW_RADIUS; dy++) {
          for (let dx = -GLOW_RADIUS; dx <= GLOW_RADIUS; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
            const source = intensities[ny * grid.width + nx];
            if (!source) continue;
            light += source * Math.exp(-Math.hypot(dx, dy) * 0.85);
          }
        }
        image.data[(y * grid.width + x) * 4 + 2] = Math.round(255 * Math.min(1, light * 0.35));
      }
    }

    ctx.putImageData(image, 0, 0);

    // Update the bound source in place rather than swapping in a new texture,
    // which would leave the filter's bind group pointing at the old one.
    if (resized) this.mapTexture.source.resize(grid.width, grid.height);
    this.mapTexture.source.update();
  }

  /* ---------------------------------------------------------------- */
  /* Overlays, path, decor                                             */
  /* ---------------------------------------------------------------- */

  private drawOverlays(view: MapView): void {
    const g = this.overlayGfx;
    g.clear();

    for (const layer of view.overlays) {
      if (layer.tiles.length === 0) continue;
      const members = new Set(layer.tiles.map((p) => `${p.x},${p.y}`));
      const [fill, edge] = overlayColors(layer.kind);

      for (const pos of layer.tiles) {
        g.rect(pos.x * TILE, pos.y * TILE, TILE, TILE).fill({ color: fill });
      }

      // Only the outside of the region gets a border, so a move range reads as
      // one shape instead of a grid of boxes.
      if (edge) {
        for (const pos of layer.tiles) {
          const x = pos.x * TILE;
          const y = pos.y * TILE;
          if (!members.has(`${pos.x},${pos.y - 1}`)) g.moveTo(x, y).lineTo(x + TILE, y);
          if (!members.has(`${pos.x + 1},${pos.y}`))
            g.moveTo(x + TILE, y).lineTo(x + TILE, y + TILE);
          if (!members.has(`${pos.x},${pos.y + 1}`))
            g.moveTo(x, y + TILE).lineTo(x + TILE, y + TILE);
          if (!members.has(`${pos.x - 1},${pos.y}`)) g.moveTo(x, y).lineTo(x, y + TILE);
        }
        g.stroke({ width: 3, color: edge });
      }
    }

    if (view.hoverTile) {
      g.rect(view.hoverTile.x * TILE, view.hoverTile.y * TILE, TILE, TILE).fill({
        color: OVERLAY.hover,
      });
    }
  }

  private drawPath(view: MapView): void {
    const g = this.pathGfx;
    g.clear();
    if (view.path.length === 0) return;

    view.path.forEach((pos: Vec2, index: number) => {
      const cx = pos.x * TILE + TILE / 2;
      const cy = pos.y * TILE + TILE / 2;
      if (index === view.path.length - 1) {
        g.moveTo(cx - TILE * 0.18, cy + TILE * 0.12)
          .lineTo(cx, cy - TILE * 0.18)
          .lineTo(cx + TILE * 0.18, cy + TILE * 0.12)
          .stroke({ width: Math.max(2, TILE * 0.07), color: OVERLAY.path });
      } else {
        g.circle(cx, cy, TILE * 0.07).fill({ color: OVERLAY.path });
      }
    });
  }

  private drawDecor(view: MapView): void {
    const g = this.decorGfx;
    g.clear();

    if (view.exit) {
      const pulse = (Math.sin(view.time / 420) + 1) / 2;
      const cx = view.exit.pos.x * TILE + TILE / 2;
      const cy = view.exit.pos.y * TILE + TILE / 2;
      g.circle(cx, cy, TILE * (0.24 + 0.06 * pulse)).stroke({
        width: Math.max(2, TILE * 0.05),
        color: '#f0c674',
        alpha: 0.5 + 0.4 * pulse,
      });
      g.moveTo(cx - TILE * 0.1, cy)
        .lineTo(cx + TILE * 0.12, cy)
        .moveTo(cx + TILE * 0.02, cy - TILE * 0.1)
        .lineTo(cx + TILE * 0.12, cy)
        .lineTo(cx + TILE * 0.02, cy + TILE * 0.1)
        .stroke({ width: Math.max(2, TILE * 0.05), color: '#f0c674' });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Units                                                             */
  /* ---------------------------------------------------------------- */

  private texture(canvas: HTMLCanvasElement): Texture {
    const cached = this.textureCache.get(canvas);
    if (cached) return cached;
    const texture = Texture.from(canvas);
    this.textureCache.set(canvas, texture);
    return texture;
  }

  private drawUnits(view: MapView): void {
    const g = this.fxGfx;
    g.clear();

    const live = new Set<string>();
    // Back to front, so a unit lower on the map overlaps one above it.
    const ordered = [...view.units].sort(
      (a, b) => (a.renderPos ?? a.pos).y - (b.renderPos ?? b.pos).y,
    );

    let badgeIndex = 0;

    for (const npc of view.npcs) {
      const key = `npc:${npc.pos.x},${npc.pos.y}`;
      live.add(key);
      const sprite = this.unitSprite(key);
      sprite.texture = this.texture(sprites.get(npc.sprite, TILE, { facing: 1 }));
      sprite.position.set(npc.pos.x * TILE, npc.pos.y * TILE);
      sprite.width = TILE;
      sprite.height = TILE;
      sprite.alpha = 1;
      sprite.visible = true;

      // A small "talk" pip so a child can tell an NPC from scenery.
      g.circle(npc.pos.x * TILE + TILE * 0.5, npc.pos.y * TILE + TILE * 0.08, TILE * 0.07).fill({
        color: '#f0c674',
        alpha: 0.55 + 0.35 * ((Math.sin(view.time / 500) + 1) / 2),
      });
    }

    for (const prop of view.props) {
      const key = `prop:${prop.id}`;
      live.add(key);
      const sprite = this.unitSprite(key);
      sprite.texture = this.texture(sprites.get(prop.sprite, TILE, { facing: 1 }));
      sprite.position.set(prop.pos.x * TILE, prop.pos.y * TILE);
      sprite.width = TILE;
      sprite.height = TILE;
      sprite.alpha = 1;
      sprite.visible = true;

      /*
       * A damage bar only once it has been hit. A full bar on every barrel
       * would read as "these are enemies"; a dented one reads as "this is
       * nearly open", which is the only thing worth communicating.
       */
      if (prop.hp >= prop.maxHp || prop.maxHp <= 0) continue;
      const w = TILE * 0.6;
      const x = prop.pos.x * TILE + (TILE - w) / 2;
      const y = prop.pos.y * TILE + TILE * 0.9;
      const h = Math.max(2, TILE * 0.05);
      g.rect(x, y, w, h).fill({ color: 'rgba(0,0,0,0.55)' });
      g.rect(x, y, (w * prop.hp) / prop.maxHp, h).fill({ color: '#d9a441' });
    }

    for (const unit of ordered) {
      const pos = unit.renderPos ?? unit.pos;
      const x = pos.x * TILE;
      const y = pos.y * TILE;
      const width = unit.size === 2 ? TILE * 2 : TILE;

      live.add(unit.id);
      const sprite = this.unitSprite(unit.id);
      sprite.texture = this.texture(
        sprites.get(unit.sprite, TILE, { facing: unit.faction === 'enemy' ? -1 : 1 }, unit.size),
      );
      sprite.position.set(x, y);
      sprite.width = width;
      sprite.height = TILE;
      sprite.alpha = unit.fallen ? 0.35 : 1;
      sprite.visible = true;
      sprite.zIndex = pos.y;

      if (unit.id === view.activeUnitId) {
        g.ellipse(x + width / 2, y + TILE * 0.86, width * 0.42, TILE * 0.14).stroke({
          width: Math.max(2, TILE * 0.06),
          color: OVERLAY.active,
          alpha: 0.75 + 0.25 * ((Math.sin(view.time / 300) + 1) / 2),
        });
      } else if (unit.id === view.selectedUnitId) {
        g.ellipse(x + width / 2, y + TILE * 0.86, width * 0.4, TILE * 0.12).stroke({
          width: Math.max(1, TILE * 0.03),
          color: 'rgba(255,255,255,0.6)',
        });
      }

      if (unit.fallen) {
        // A fallen unit gets a clear cross rather than just fading out.
        g.moveTo(x + width * 0.3, y + TILE * 0.35)
          .lineTo(x + width * 0.7, y + TILE * 0.75)
          .moveTo(x + width * 0.7, y + TILE * 0.35)
          .lineTo(x + width * 0.3, y + TILE * 0.75)
          .stroke({ width: Math.max(2, TILE * 0.06), color: 'rgba(226,88,74,0.85)' });
        continue;
      }

      if (unit.showHealth !== false) this.drawHealthBar(g, unit, x, y, width);
      badgeIndex = this.drawStatusBadges(g, unit, x, y, width, badgeIndex);
    }

    for (const [key, sprite] of this.unitSprites) {
      if (!live.has(key)) sprite.visible = false;
    }
    for (let i = badgeIndex; i < this.badgeText.length; i++) {
      const text = this.badgeText[i];
      if (text) text.visible = false;
    }
  }

  private unitSprite(key: string): Sprite {
    let sprite = this.unitSprites.get(key);
    if (!sprite) {
      sprite = new Sprite();
      this.unitLayer.addChild(sprite);
      this.unitSprites.set(key, sprite);
    }
    return sprite;
  }

  private drawHealthBar(g: Graphics, unit: RenderUnit, x: number, y: number, width: number): void {
    const fraction = Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
    const barWidth = width * 0.72;
    const barHeight = Math.max(3, TILE * 0.075);
    const barX = x + (width - barWidth) / 2;
    const barY = y + TILE * 0.06;

    g.rect(barX - 1, barY - 1, barWidth + 2, barHeight + 2).fill({ color: 'rgba(0,0,0,0.6)' });
    g.rect(barX, barY, barWidth * fraction, barHeight).fill({ color: hpColor(fraction) });
    g.rect(barX - 0.5, barY - 0.5, barWidth + 1, barHeight + 1).stroke({
      width: 1,
      color: FACTION_RING[unit.faction],
    });
  }

  private drawStatusBadges(
    g: Graphics,
    unit: RenderUnit,
    x: number,
    y: number,
    width: number,
    startIndex: number,
  ): number {
    if (unit.statuses.length === 0) return startIndex;
    const radius = Math.max(4, TILE * 0.09);
    const shown = unit.statuses.slice(0, 4);
    const totalWidth = shown.length * radius * 2.2;
    let bx = x + width / 2 - totalWidth / 2 + radius;
    const by = y + TILE * 0.97;
    let index = startIndex;

    for (const status of shown) {
      const badge = STATUS_BADGE[status];
      g.circle(bx, by, radius)
        .fill({ color: 'rgba(12,9,6,0.85)' })
        .stroke({ width: Math.max(1, radius * 0.25), color: badge.color });

      const label = this.badge(index++);
      label.text = badge.letter;
      label.style.fill = badge.color;
      label.style.fontSize = Math.round(radius * 1.2);
      label.anchor.set(0.5);
      label.position.set(bx, by);
      label.visible = true;

      bx += radius * 2.2;
    }
    return index;
  }

  private badge(index: number): Text {
    let text = this.badgeText[index];
    if (!text) {
      text = new Text({
        text: '',
        style: new TextStyle({
          fontFamily: 'system-ui, sans-serif',
          fontWeight: '700',
          fill: 0xffffff,
        }),
      });
      this.badgeText[index] = text;
      this.floaterLayer.addChild(text);
    }
    return text;
  }

  /* ---------------------------------------------------------------- */
  /* Effects                                                           */
  /* ---------------------------------------------------------------- */

  private drawFx(view: MapView): void {
    const g = this.fxGfx;
    for (const fx of view.fx) {
      const cx = fx.pos.x * TILE + TILE / 2;
      const cy = fx.pos.y * TILE + TILE / 2;
      const grow = 0.2 + fx.progress * 0.5;
      const fade = 1 - fx.progress;
      g.circle(cx, cy, TILE * grow).stroke({
        width: Math.max(2, TILE * 0.06 * fade),
        color: '#f0c674',
        alpha: fade * 0.8,
      });
    }
  }

  private drawFloaters(view: MapView): void {
    view.floaters.forEach((floater, index) => {
      let text = this.floaters[index];
      if (!text) {
        text = new Text({
          text: '',
          style: new TextStyle({
            fontFamily: 'system-ui, sans-serif',
            fontWeight: '700',
            fontSize: Math.round(TILE * 0.3),
            fill: 0xffffff,
            stroke: { color: '#120d0a', width: 4 },
          }),
        });
        this.floaters[index] = text;
        this.floaterLayer.addChild(text);
      }
      text.text = floater.text;
      text.style.fill = floater.color;
      text.anchor.set(0.5);
      text.position.set(
        floater.pos.x * TILE + TILE / 2,
        floater.pos.y * TILE + TILE * 0.4 - floater.progress * TILE * 0.7,
      );
      text.alpha = 1 - floater.progress;
      text.visible = true;
    });

    for (let i = view.floaters.length; i < this.floaters.length; i++) {
      const text = this.floaters[i];
      if (text) text.visible = false;
    }
  }
}
