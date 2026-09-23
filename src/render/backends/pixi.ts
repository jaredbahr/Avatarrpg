/**
 * The WebGL backend.
 *
 * Ground marks share the camera affine; actors and text use projected world
 * positions in a separate upright root. Ground art is never skewed underneath
 * unchanged actor placement or picking.
 *
 * The ground is one draw call: a quad carrying a shader that reads per-tile
 * terrain and surface state out of a small data texture. That is what lets fire
 * burn, water ripple and light spill onto neighbouring tiles without the CPU
 * touching a tile between frames.
 *
 * Unit art is unchanged â€” `spriteCache` already rasterises the painters into
 * canvases, and a canvas uploads as a texture.
 */

import {
  WebGLRenderer,
  Container,
  Filter,
  GlProgram,
  Graphics,
  Matrix,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  Texture,
  UniformGroup,
} from 'pixi.js';

import type { TerrainId, Vec2 } from '../../core/types';
import { resolveAsset } from '../../content/assets/manifest';
import { backdrops } from '../backdrops';
import { sceneForGrid, sceneryOpacities } from '../scene';
import { SceneTextures } from './sceneTextures';
import { SURFACE_INDEX, surfaceIsPainted, surfaceTexel } from '../sceneSurfaces';
import { TILE } from '../camera';
import type { Camera, Viewport } from '../camera';
import { DecorSheets } from '../decorSheets';
import { ParticleLayer } from '../fx/particleLayer';
import { aimArcPoints, arcHeading, arrowheadPolygon } from '../geometry/arc';
import { actorHealthBar } from '../geometry/actorSilhouette';
import { DECOR_CHUNK, decorChunks } from '../geometry/board';
import { contourLoops, isHole } from '../geometry/contour';
import type { Curve } from '../geometry/curve';
import { sampleAt, smoothPath } from '../geometry/curve';
import { FACTION_RING, OVERLAY, STATUS_BADGE, hpColor } from '../palettes';
import { FOOT_LINE } from '../sheets/bake';
import { resolveActorEmitters } from '../geometry/actorAttachments';
import type { ResolvedFrame } from '../sheets/store';
import { idlePhase, sheets } from '../sheets/store';
import { MAX_SPRITE_PX, sprites } from '../spriteCache';
import {
  unitMarkerGroundPoint,
  type AimArc,
  type MapView,
  type OverlayLayer,
  type RenderUnit,
} from '../view';
import type { BackendCapabilities, RenderBackend } from './backend';
import {
  EDGE_SHADE_ALPHA,
  EDGE_SHADE_TILES,
  ELEVATION_LIFT,
  VIGNETTE_ALPHA,
  elevationAt,
  overlayColors,
} from './canvas2d';
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

/**
 * Sprite textures are rasterised for the zoom actually on screen, in steps this
 * coarse (device pixels per tile), so a pinch repaints the board's sprites a
 * handful of times rather than on every frame of the gesture.
 */
const SPRITE_BUCKET = 32;

/** Textures kept alive; older ones are destroyed rather than left on the GPU. */
const MAX_TEXTURES = 128;
/** Frame views onto those textures (one per pose per sheet); cheap, but bounded all the same. */
const MAX_FRAME_TEXTURES = 512;

/** The rounded square a hovered tile gets, in tile units from its corner. */
const HOVER_LOOP = contourLoops([{ x: 0, y: 0 }])[0] ?? [];

/**
 * A small canvas holding a black gradient, for the board's edge shading and
 * the vignette: one texture each, stretched over whatever it has to cover.
 * `side` is which edge of the canvas the dark end sits on.
 */
function gradientCanvas(kind: 'n' | 's' | 'w' | 'e' | 'radial', alpha: number): HTMLCanvasElement {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const dark = `rgba(0,0,0,${alpha})`;
  const clear = 'rgba(0,0,0,0)';
  let g: CanvasGradient;
  if (kind === 'radial') {
    const r = Math.hypot(size / 2, size / 2);
    g = ctx.createRadialGradient(size / 2, size / 2, r * 0.45, size / 2, size / 2, r);
  } else {
    const ends: Record<typeof kind, [number, number, number, number]> = {
      n: [0, 0, 0, size],
      s: [0, size, 0, 0],
      w: [0, 0, size, 0],
      e: [size, 0, 0, 0],
    };
    const [x0, y0, x1, y1] = ends[kind];
    g = ctx.createLinearGradient(x0, y0, x1, y1);
  }
  g.addColorStop(0, kind === 'radial' ? clear : dark);
  g.addColorStop(1, kind === 'radial' ? dark : clear);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** Tile-unit points to the flat pixel list Graphics wants. */
function flatten(points: readonly Vec2[]): number[] {
  const out: number[] = [];
  for (const p of points) out.push(p.x * TILE, p.y * TILE);
  return out;
}

/** Even-odd point-in-polygon, for pairing a hole with the outer loop it sits in. */
function insideLoop(point: Vec2, loop: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i];
    const b = loop[j];
    if (!a || !b) continue;
    const crosses = a.y > point.y !== b.y > point.y;
    if (crosses && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export class PixiBackend implements RenderBackend {
  readonly capabilities: BackendCapabilities = { name: 'webgl', shaders: true, particles: false };

  private app: { renderer: WebGLRenderer; stage: Container } | null = null;
  private destroyed = false;

  /** Latest view, drawn as soon as the async init finishes. */
  private pending: { view: MapView; camera: Camera } | null = null;

  /** Logical ground pixels; all ground marks share the camera affine. */
  private root = new Container();
  /** Projected world pixels; actors and labels remain upright. */
  private upright = new Container();
  private labels = new Container();
  private groundTransform = new Matrix();
  private sceneGround = new Container();
  private groundChunks = new Map<string, Sprite>();
  private scenerySprites = new Map<string, Sprite>();
  /** Scene textures live only as long as their manifest, independently of actor LRU. */
  private sceneTextures = new SceneTextures();
  /**
   * The map's painting (ADR 0009), a screen-space sprite under the ground
   * quad so the ground pass lays its surfaces over it. Its texture is made
   * from the loaded image here and destroyed when the painting changes, never
   * through `Texture.from`'s global cache.
   */
  private backdropSprite = new Sprite(Texture.EMPTY);
  private backdrop: { image: HTMLImageElement; texture: Texture } | null = null;
  private groundSprite = new Sprite(Texture.WHITE);
  /** Raised stone bases sit above procedural ground but below live surfaces. */
  private elevationBaseLayer = new Container();
  private elevationBaseSprites = new Map<string, Sprite>();
  /** A second ground pass is used only for partial authored scenes. */
  private groundOverlaySprite = new Sprite(Texture.WHITE);
  /**
   * Cliffs, canopies, walls, cover and decals, baked by the same painters the
   * Canvas 2D backend draws with, one sprite per chunk of the board.
   */
  private decorLayer = new Container();
  private decorSprites = new Map<string, Sprite>();
  private decor = new DecorSheets();
  private decorPx = 0;
  private decorMode: 'full' | 'seams' = 'full';
  private elevationBasePx = 0;
  /** Edge shading along the board's four sides and the vignette over the view. */
  private shadeLayer = new Container();
  private shadeSprites: Sprite[] = [];
  private overlayGfx = new Graphics();
  private pathGfx = new Graphics();
  private decorGfx = new Graphics();
  private groundRings = new Graphics();
  private unitLayer = new Container();
  private fxGfx = new Graphics();
  private floaterLayer = new Container();
  /** Particles and strokes: ground-level ones under the units, the rest over them. */
  private fxUnder = new ParticleLayer('under');
  private fxOver = new ParticleLayer('over');

  private groundUniforms = new UniformGroup({
    uGrid: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    uGroundOrigin: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
    uGroundInverse: { value: new Float32Array([1, 0, 0, 1]), type: 'vec4<f32>' },
    uTileSize: { value: TILE, type: 'f32' },
    uTime: { value: 0, type: 'f32' },
    uHatch: { value: 0, type: 'f32' },
    uGridLines: { value: 0, type: 'f32' },
    uSurfaces: { value: 1, type: 'f32' },
    uBackdrop: { value: 0, type: 'f32' },
  });
  private groundOverlayUniforms = new UniformGroup({
    uGrid: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    uGroundOrigin: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
    uGroundInverse: { value: new Float32Array([1, 0, 0, 1]), type: 'vec4<f32>' },
    uTileSize: { value: TILE, type: 'f32' },
    uTime: { value: 0, type: 'f32' },
    uHatch: { value: 0, type: 'f32' },
    uGridLines: { value: 0, type: 'f32' },
    uSurfaces: { value: 1, type: 'f32' },
    uBackdrop: { value: 1, type: 'f32' },
  });
  private groundFilter: Filter | null = null;
  private groundOverlayFilter: Filter | null = null;

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
  private textureCache = new Map<HTMLCanvasElement | HTMLImageElement, Texture>();
  private frameTextures = new Map<string, Texture>();
  private floaters: Text[] = [];
  private badgeText: Text[] = [];

  /**
   * Contours per overlay layer and the curve per path, keyed by identity: the
   * scene memoises its overlays, so the same objects come back frame after
   * frame until something changes, and a WeakMap forgets them with it.
   */
  private loops = new WeakMap<OverlayLayer, Vec2[][]>();
  private curve: { path: readonly Vec2[]; from: Vec2; curve: Curve } | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.mapCanvas.width = 1;
    this.mapCanvas.height = 1;
    this.mapTexture = Texture.from(this.mapCanvas);
    this.mapTexture.source.scaleMode = 'nearest';
    void this.init();
  }

  /**
   * WebGL being *present* is not the question â€” whether it is accelerated is.
   *
   * Measured on this project: with a real GPU the shader path is what the whole
   * move is for, but against a software rasteriser (SwiftShader, llvmpipe) the
   * board runs at 6fps where Canvas 2D holds 60. That is not this shader being
   * expensive â€” dropping it entirely changed nothing â€” it is software GL being
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
    // The facade already chose WebGL. Avoid shipping Pixi's second backend
    // chooser (and unused WebGPU/Canvas engines) or creating another ticker.
    const app = { renderer: new WebGLRenderer(), stage: new Container() };
    await app.renderer.init({
      canvas: this.canvas,
      // Transparent, so the page's mood wash shows round the board (ADR 0008).
      backgroundAlpha: 0,
      antialias: false,
      width: this.viewport.width,
      height: this.viewport.height,
      resolution: this.viewport.dpr,
      // The app's own CSS sizes the canvas; Pixi must not write inline styles
      // over it, which is also how the Canvas 2D backend behaves.
      autoDensity: false,
    });

    // `destroy()` can land while init is still in flight.
    if (this.destroyed) {
      app.stage.destroy({ children: true });
      app.renderer.destroy(true);
      return;
    }

    this.app = app;

    this.groundFilter = new Filter({
      glProgram: GlProgram.from({ vertex: FILTER_VERTEX, fragment: GROUND_FRAGMENT }),
      resources: { groundUniforms: this.groundUniforms, uMap: this.mapTexture.source },
      padding: 0,
      /*
       * The ground is procedural texture and soft gradients, so running the
       * pass at half resolution and letting it upscale is close to invisible â€”
       * and it quarters the per-frame pixel cost, which is the single biggest
       * lever on machines without a GPU.
       */
      resolution: GROUND_RESOLUTION,
    });
    this.groundOverlayFilter = new Filter({
      glProgram: GlProgram.from({ vertex: FILTER_VERTEX, fragment: GROUND_FRAGMENT }),
      resources: {
        groundUniforms: this.groundOverlayUniforms,
        uMap: this.mapTexture.source,
      },
      padding: 0,
      resolution: GROUND_RESOLUTION,
    });
    this.groundSprite.filters = [this.groundFilter];
    this.groundOverlaySprite.filters = [this.groundOverlayFilter];

    // The ground quad is screen-sized and sits OUTSIDE the camera transform:
    // its shader derives tile coordinates from the camera uniforms instead.
    // The painting sits under it, placed from the same camera numbers.
    this.backdropSprite.visible = false;
    this.groundOverlaySprite.visible = false;
    app.stage.addChild(
      this.backdropSprite,
      this.groundSprite,
      this.elevationBaseLayer,
      this.sceneGround,
      this.groundOverlaySprite,
    );

    // Any resize that arrived during init was dropped; apply the latest now.
    this.applyViewport();

    for (const kind of ['n', 's', 'w', 'e'] as const) {
      const sprite = new Sprite(Texture.from(gradientCanvas(kind, EDGE_SHADE_ALPHA), true));
      this.shadeSprites.push(sprite);
      this.shadeLayer.addChild(sprite);
    }
    const vignette = new Sprite(Texture.from(gradientCanvas('radial', VIGNETTE_ALPHA), true));
    this.shadeSprites.push(vignette);
    this.shadeLayer.addChild(vignette);

    this.root.addChild(
      this.decorLayer,
      this.shadeLayer,
      this.overlayGfx,
      this.pathGfx,
      this.fxUnder.container,
      this.decorGfx,
    );
    this.unitLayer.sortableChildren = true;
    this.upright.addChild(this.groundRings, this.unitLayer);
    this.labels.addChild(this.fxGfx, this.floaterLayer);
    app.stage.addChild(this.root, this.upright, this.fxOver.container, this.labels);

    if (this.pending) {
      const { view, camera } = this.pending;
      this.pending = null;
      this.draw(view, camera);
    }
  }

  resize(viewport: Viewport): void {
    sprites.clear();
    sheets.clear();
    this.dropTextures();
    this.decor.clear();
    this.decorPx = 0;
    this.elevationBasePx = 0;
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
    this.groundOverlaySprite.position.set(0, 0);
    this.groundOverlaySprite.width = this.viewport.width;
    this.groundOverlaySprite.height = this.viewport.height;
  }

  destroy(): void {
    this.destroyed = true;
    this.fxUnder.destroy();
    this.fxOver.destroy();
    // Detach the painting while its sprite is alive: Pixi clears the sprite's
    // scale on destruction, and assigning a texture still updates its size.
    this.dropBackdrop();
    this.groundSprite.filters = null;
    this.groundOverlaySprite.filters = null;
    // Both filters are built from the renderer's cached program source; let
    // the renderer own the shared GPU program and release only filter state.
    this.groundFilter?.destroy();
    this.groundOverlayFilter?.destroy();
    this.app?.stage.destroy({ children: true });
    this.app?.renderer.destroy(false);
    this.app = null;
    this.groundFilter = null;
    this.groundOverlayFilter = null;
    this.dropTextures();
    this.unitSprites.clear();
    this.sceneTextures.clear();
    this.groundChunks.clear();
    this.scenerySprites.clear();
    this.mapTexture.destroy(true);
  }

  draw(view: MapView, camera: Camera): void {
    const app = this.app;
    view = {
      ...view,
      scene: view.scene ? sceneForGrid(view.scene, view.grid) : undefined,
    };
    if (!app) {
      // Still initialising: keep only the newest frame.
      this.pending = { view, camera };
      return;
    }

    // The shake moves the world: a knocked camera shows the margin, as a fit does.
    const nudge = TILE * camera.scale;
    const m = camera.groundMatrix();
    this.groundTransform.set(
      m.a,
      m.b,
      m.c,
      m.d,
      m.tx + view.cameraNudge.x * nudge,
      m.ty + view.cameraNudge.y * nudge,
    );
    this.root.setFromMatrix(this.groundTransform);
    this.elevationBaseLayer.setFromMatrix(this.groundTransform);
    this.fxOver.container.setFromMatrix(this.groundTransform);
    for (const layer of [this.sceneGround, this.upright, this.labels]) {
      layer.position.set(
        -camera.offsetX + view.cameraNudge.x * nudge,
        -camera.offsetY + view.cameraNudge.y * nudge,
      );
      layer.scale.set(camera.scale);
    }

    // A painting takes the terrain's place; the decor that marks footing
    // over it comes back only under High contrast, where the rules must read
    // without the picture.
    const partialScene = camera.projection === 'oblique' && view.scene?.groundMode === 'partial';
    const backdropPainted = this.syncBackdrop(view, camera, partialScene);
    const scenePainted = this.syncScene(view, camera);
    // An incomplete authored scene must keep its collision-marking fallback.
    const painted = camera.projection === 'oblique' && view.scene ? scenePainted : backdropPainted;
    this.setPartialGroundOrder(partialScene);
    this.groundOverlaySprite.visible = partialScene;
    this.syncGround(view, painted, partialScene);
    // A complete partial scene needs only raised stone underlay here. Missing
    // art and High contrast still require every procedural rule marker.
    this.syncElevationBase(view, camera, partialScene && scenePainted && !view.crispOverlays);
    // A complete authored scene keeps its picture and gets the ground joins
    // drawn over it, because the rules grid owns where the materials meet.
    const decorMode = partialScene
      ? !scenePainted || view.crispOverlays
        ? 'full'
        : 'seams'
      : !painted || view.crispOverlays
        ? 'full'
        : 'none';
    this.syncDecor(view, camera, decorMode);
    this.syncShade(view, camera, scenePainted);
    this.drawOverlays(view);
    this.drawPath(view);
    this.drawDecor(view);
    this.drawUnits(view, camera);
    const emitters = resolveActorEmitters(
      view.emitters,
      view.grid,
      camera.projection,
      TILE * camera.scale * camera.viewport.dpr,
    );
    this.fxUnder.draw(emitters);
    this.fxOver.draw(emitters);
    this.drawFloaters(view, camera);

    app.renderer.render(app.stage);
  }

  /* ---------------------------------------------------------------- */
  /* Ground                                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Shows the map's painting under the ground pass once it has loaded, at the
   * board's rectangle in screen space: the same offset and tile size the
   * shader reconstructs its tiles from, so the surfaces land on the painting
   * exactly where the painting's tiles are. Returns whether one is showing.
   */
  private syncBackdrop(view: MapView, camera: Camera, partialScene = false): boolean {
    const compatible =
      camera.projection === 'oblique'
        ? view.backdrop?.projection === 'oblique'
        : view.backdrop?.projection !== 'oblique';
    const image =
      !partialScene && view.backdrop && compatible ? backdrops.get(view.backdrop.url) : null;
    if (!image) {
      this.backdropSprite.visible = false;
      this.dropBackdrop();
      return false;
    }
    if (this.backdrop?.image !== image) {
      this.dropBackdrop();
      const texture = Texture.from(image, true);
      this.backdrop = { image, texture };
      this.backdropSprite.texture = texture;
    }
    const size = TILE * camera.scale;
    this.backdropSprite.visible = true;
    const padding = view.backdrop?.padding;
    const left = padding?.left ?? 0;
    const top = padding?.top ?? 0;
    const right = padding?.right ?? 0;
    const bottom = padding?.bottom ?? 0;
    this.backdropSprite.position.set(
      -camera.offsetX - left * camera.scale + view.cameraNudge.x * size,
      -camera.offsetY - top * camera.scale + view.cameraNudge.y * size,
    );
    this.backdropSprite.width = camera.worldWidth + (left + right) * camera.scale;
    this.backdropSprite.height = camera.worldHeight + (top + bottom) * camera.scale;
    return true;
  }

  /** Already-projected ground chunks and upright objects use only pan/zoom. */
  private syncScene(view: MapView, camera: Camera): boolean {
    const scene = camera.projection === 'oblique' ? view.scene : undefined;
    this.sceneTextures.begin();
    const groundKeys = new Set<string>();
    const sceneryKeys = new Set<string>();
    let complete = Boolean(scene?.ground.length);
    for (const [index, chunk] of (scene?.ground ?? []).entries()) {
      const key = String(index);
      groundKeys.add(key);
      let sprite = this.groundChunks.get(key);
      if (!sprite) {
        sprite = new Sprite();
        this.sceneGround.addChild(sprite);
        this.groundChunks.set(key, sprite);
      }
      const texture = this.sceneTextures.get(chunk);
      sprite.visible = Boolean(texture);
      if (!texture) {
        complete = false;
        continue;
      }
      sprite.texture = texture;
      sprite.position.set(chunk.x, chunk.y);
      sprite.width = chunk.width;
      sprite.height = chunk.height;
    }
    const opacities = sceneryOpacities(scene?.scenery ?? [], view, camera);
    for (const item of scene?.scenery ?? []) {
      sceneryKeys.add(item.id);
      let sprite = this.scenerySprites.get(item.id);
      if (!sprite) {
        sprite = new Sprite();
        this.unitLayer.addChild(sprite);
        this.scenerySprites.set(item.id, sprite);
      }
      const texture = this.sceneTextures.get(item);
      sprite.visible = Boolean(texture);
      if (!texture) {
        // Ground alone cannot explain a missing building's blocked footprint.
        // Keep procedural terrain/decor until every required scene piece loads.
        complete = false;
        continue;
      }
      sprite.texture = texture;
      sprite.position.set(item.x, item.y);
      sprite.width = item.width;
      sprite.height = item.height;
      sprite.zIndex = camera.groundPoint(item.depth).y;
      sprite.alpha = opacities.get(item) ?? 1;
    }
    for (const [key, sprite] of this.groundChunks) {
      if (!groundKeys.has(key)) {
        sprite.destroy();
        this.groundChunks.delete(key);
      }
    }
    for (const [key, sprite] of this.scenerySprites) {
      if (!sceneryKeys.has(key)) {
        sprite.destroy();
        this.scenerySprites.delete(key);
      }
    }
    this.sceneTextures.end();
    return complete;
  }

  private dropBackdrop(): void {
    if (!this.backdrop) return;
    this.backdropSprite.texture = Texture.EMPTY;
    this.backdrop.texture.destroy(true);
    this.backdrop = null;
  }

  /** Keep the historical complete-scene order; partial scenes need their
   * procedural base below localized scene ground and surfaces above it. */
  private setPartialGroundOrder(partial: boolean): void {
    const app = this.app;
    if (!app) return;
    // Put the raised base between the procedural ground and localized art in
    // partial mode. Reorder every participant each switch: moving only two
    // layers leaves the base above scene art after a complete-scene visit.
    const layers = partial
      ? [this.groundSprite, this.elevationBaseLayer, this.sceneGround, this.groundOverlaySprite]
      : [this.sceneGround, this.groundSprite, this.elevationBaseLayer, this.groundOverlaySprite];
    const first = app.stage.getChildIndex(this.backdropSprite) + 1;
    for (const [offset, layer] of layers.entries()) app.stage.setChildIndex(layer, first + offset);
  }

  /** Both baked passes share a grid cache, so one grid change invalidates both sprite buckets. */
  private syncDecorGrid(grid: MapView['grid']): boolean {
    const changed = this.decor.sync(grid);
    if (changed) {
      this.decorPx = 0;
      this.elevationBasePx = 0;
    }
    return changed;
  }

  private syncGround(view: MapView, painted: boolean, partialScene: boolean): void {
    const { grid } = view;
    // `surfaceIsPainted` decides per cell which permanent surfaces the art replaces.
    this.uploadMap(view, painted);

    const uniforms = this.groundUniforms.uniforms as {
      uGrid: Float32Array;
      uGroundOrigin: Float32Array;
      uGroundInverse: Float32Array;
      uTileSize: number;
      uTime: number;
      uHatch: number;
      uGridLines: number;
      uSurfaces: number;
      uBackdrop: number;
    };
    uniforms.uGrid[0] = grid.width;
    uniforms.uGrid[1] = grid.height;
    const m = this.groundTransform;
    const det = m.a * m.d - m.b * m.c;
    uniforms.uGroundOrigin[0] = m.tx;
    uniforms.uGroundOrigin[1] = m.ty;
    uniforms.uGroundInverse.set([m.d / det, -m.c / det, -m.b / det, m.a / det]);
    uniforms.uTileSize = TILE;
    uniforms.uTime = view.time / 1000;
    uniforms.uHatch = view.hatch ? 1 : 0;
    uniforms.uGridLines = view.gridLines ? 1 : 0;
    uniforms.uSurfaces = partialScene ? 0 : 1;
    uniforms.uBackdrop = partialScene ? 0 : painted ? 1 : 0;

    /*
     * UniformGroup.uniforms is a plain object, not a proxy: neither assigning a
     * field nor mutating an array in place marks the group dirty, and without
     * this call nothing above is ever uploaded. It fails silently and totally â€”
     * every uniform keeps its constructor default, which left uGrid at [1,1] and
     * rendered the whole board black.
     */
    this.groundUniforms.update();

    if (!partialScene) return;
    const overlay = this.groundOverlayUniforms.uniforms as typeof uniforms;
    overlay.uGrid[0] = grid.width;
    overlay.uGrid[1] = grid.height;
    overlay.uGroundOrigin[0] = m.tx;
    overlay.uGroundOrigin[1] = m.ty;
    overlay.uGroundInverse.set([m.d / det, -m.c / det, -m.b / det, m.a / det]);
    overlay.uTileSize = TILE;
    overlay.uTime = view.time / 1000;
    overlay.uHatch = view.hatch ? 1 : 0;
    overlay.uGridLines = view.gridLines ? 1 : 0;
    overlay.uSurfaces = 1;
    overlay.uBackdrop = 1;
    this.groundOverlayUniforms.update();
  }

  /**
   * Writes per-tile state into the data texture, but only when it has actually
   * changed â€” a signature comparison is far cheaper than a GPU upload every
   * frame, and most frames change nothing on the ground.
   */
  private uploadMap(view: MapView, painted: boolean): void {
    const grid = view.grid;
    const baked = grid.tiles.map((tile, i) =>
      surfaceIsPainted(view, painted, tile, {
        x: i % grid.width,
        y: Math.floor(i / grid.width),
      }),
    );
    let signature = `${grid.width}x${grid.height}:${baked.map((value) => (value ? '1' : '0')).join('')}`;
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
      const [surface, intensity] = surfaceTexel(tile, baked[i] === true);
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

  /**
   * The marks a player plans by â€” high ground, walls, cover â€” and the decor
   * round them, drawn by the same painters as the Canvas 2D backend
   * (`painters/board.ts`) because a fight has to read the same on both. The
   * shader knows nothing of them: they are baked into chunk textures at the
   * zoom's sprite bucket and re-baked only when the footing or the bucket
   * changes.
   */
  private syncElevationBase(view: MapView, camera: Camera, shown: boolean): void {
    this.elevationBaseLayer.visible = shown;
    if (!shown) return;
    const grid = view.grid;
    const changed = this.syncDecorGrid(grid);
    const px = this.spritePx(camera);
    if (!changed && px === this.elevationBasePx) return;
    this.elevationBasePx = px;

    const { cols, rows } = decorChunks(grid);
    const live = new Set<string>();
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const key = `${cx},${cy}`;
        live.add(key);
        let sprite = this.elevationBaseSprites.get(key);
        if (!sprite) {
          sprite = new Sprite();
          this.elevationBaseLayer.addChild(sprite);
          this.elevationBaseSprites.set(key, sprite);
        }
        sprite.texture = this.texture(this.decor.get(grid, cx, cy, px, 'elevation'));
        sprite.position.set(cx * DECOR_CHUNK * TILE, cy * DECOR_CHUNK * TILE);
        sprite.width = DECOR_CHUNK * TILE;
        sprite.height = DECOR_CHUNK * TILE;
        sprite.visible = true;
      }
    }
    for (const [key, sprite] of this.elevationBaseSprites) {
      if (!live.has(key)) sprite.visible = false;
    }
  }

  private syncDecor(view: MapView, camera: Camera, mode: 'none' | 'full' | 'seams'): void {
    this.decorLayer.visible = mode !== 'none';
    if (mode === 'none') return;
    const grid = view.grid;
    const changed = this.syncDecorGrid(grid) || this.decorMode !== mode;
    this.decorMode = mode;
    const px = this.spritePx(camera);
    if (!changed && px === this.decorPx) return;
    this.decorPx = px;

    const { cols, rows } = decorChunks(grid);
    const live = new Set<string>();
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const key = `${cx},${cy}`;
        live.add(key);
        let sprite = this.decorSprites.get(key);
        if (!sprite) {
          sprite = new Sprite();
          this.decorLayer.addChild(sprite);
          this.decorSprites.set(key, sprite);
        }
        sprite.texture = this.texture(this.decor.get(grid, cx, cy, px, mode));
        sprite.position.set(cx * DECOR_CHUNK * TILE, cy * DECOR_CHUNK * TILE);
        sprite.width = DECOR_CHUNK * TILE;
        sprite.height = DECOR_CHUNK * TILE;
        sprite.visible = true;
      }
    }
    for (const [key, sprite] of this.decorSprites) {
      if (!live.has(key)) sprite.visible = false;
    }
  }

  /**
   * The board's edges fall off into the dark and the corners of the view dim:
   * four gradient sprites along the board's sides and one radial across the
   * viewport, in world units so they ride the camera like everything else.
   */
  private syncShade(view: MapView, camera: Camera, scenePainted: boolean): void {
    // Layered paintings extend beyond the logical diamond and carry their own
    // lighting; board-edge gradients cut a dark diagonal through that scenery.
    this.shadeLayer.visible = view.atmosphere && !scenePainted;
    if (!this.shadeLayer.visible) return;
    const [n, s, w, e, vignette] = this.shadeSprites;
    if (!n || !s || !w || !e || !vignette) return;
    const width = view.grid.width * TILE;
    const height = view.grid.height * TILE;
    const reach = EDGE_SHADE_TILES * TILE;
    n.position.set(0, 0);
    n.width = width;
    n.height = reach;
    s.position.set(0, height - reach);
    s.width = width;
    s.height = reach;
    w.position.set(0, 0);
    w.width = reach;
    w.height = height;
    e.position.set(width - reach, 0);
    e.width = reach;
    e.height = height;
    // A screen-space vignette cannot inherit the oblique ground affine.
    vignette.visible = camera.projection === 'orthographic';
    // The viewport, in world units: undo the root's camera transform.
    vignette.position.set(camera.offsetX / camera.scale, camera.offsetY / camera.scale);
    vignette.width = this.viewport.width / camera.scale;
    vignette.height = this.viewport.height / camera.scale;
  }

  /* ---------------------------------------------------------------- */
  /* Overlays, path, decor                                             */
  /* ---------------------------------------------------------------- */

  private drawOverlays(view: MapView): void {
    const g = this.overlayGfx;
    g.clear();

    if (!view.crispOverlays) {
      this.drawContourOverlays(view);
      return;
    }

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

  /**
   * Overlays as rounded contours (ADR 0007). Each layer's loops are traced
   * once per layer object; holes are cut from the outer loop they sit in.
   */
  private drawContourOverlays(view: MapView): void {
    const g = this.overlayGfx;

    for (const layer of view.overlays) {
      if (layer.tiles.length === 0) continue;
      let loops = this.loops.get(layer);
      if (!loops) {
        loops = contourLoops(layer.tiles);
        this.loops.set(layer, loops);
      }
      const [fill, edge] = overlayColors(layer.kind);

      const outers = loops.filter((loop) => !isHole(loop));
      const holes = loops.filter(isHole);
      for (const outer of outers) {
        g.poly(flatten(outer), true);
        for (const hole of holes) {
          const probe = hole[0];
          if (probe && insideLoop(probe, outer)) g.poly(flatten(hole), true).cut();
        }
        g.fill({ color: fill });
      }

      if (edge) {
        for (const loop of loops) {
          g.poly(flatten(loop), true).stroke({
            width: TILE * OVERLAY.softWidth,
            color: edge,
            alpha: OVERLAY.softAlpha,
            join: 'round',
          });
          g.poly(flatten(loop), true).stroke({
            width: Math.max(2, TILE * OVERLAY.edgeWidth),
            color: edge,
            join: 'round',
          });
        }
      }
    }

    if (view.hoverTile) {
      const { x, y } = view.hoverTile;
      g.poly(
        HOVER_LOOP.flatMap((p) => [(x + p.x) * TILE, (y + p.y) * TILE]),
        true,
      ).fill({ color: OVERLAY.hover });
    }
  }

  private drawPath(view: MapView): void {
    const g = this.pathGfx;
    g.clear();

    if (view.path.length > 0) {
      if (view.pathFrom && !view.crispOverlays) {
        this.drawCurvedPath(view, view.pathFrom);
      } else {
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
    }

    if (view.aimArc) this.drawAimArc(view.aimArc);
  }

  /**
   * The throw being aimed: the flight's own curve as dots in the element's
   * light tone over an ink line, with an arrowhead where it lands. The same
   * points the Canvas 2D backend draws (ADR 0002: a preview is board truth).
   */
  private drawAimArc(arc: AimArc): void {
    const g = this.pathGfx;
    const points = aimArcPoints(arc.from, arc.to, arc.arc);
    g.poly(flatten(points), false).stroke({
      width: Math.max(4, TILE * 0.1),
      color: OVERLAY.pathUnder,
      cap: 'round',
      join: 'round',
    });
    for (let i = 0; i < points.length - 1; i += 2) {
      const p = points[i];
      if (p) g.circle(p.x * TILE, p.y * TILE, TILE * 0.05).fill({ color: arc.color });
    }
    const last = points[points.length - 1];
    if (!last) return;
    const tip = { x: last.x * TILE, y: last.y * TILE };
    g.poly(arrowheadPolygon(tip, arcHeading(points), TILE), true).fill({ color: arc.color });
  }

  /** The route as one curve through the tile centres, with an arrowhead on its last tangent. */
  private drawCurvedPath(view: MapView, from: Vec2): void {
    const g = this.pathGfx;
    if (!this.curve || this.curve.path !== view.path || this.curve.from !== from) {
      this.curve = { path: view.path, from, curve: smoothPath(from, view.path) };
    }
    const curve = this.curve.curve;
    const points = flatten(curve.points);

    g.poly(points, false).stroke({
      width: Math.max(2, TILE * OVERLAY.pathUnderWidth),
      color: OVERLAY.pathUnder,
      cap: 'round',
      join: 'round',
    });
    g.poly(points, false).stroke({
      width: Math.max(1, TILE * OVERLAY.pathWidth),
      color: OVERLAY.path,
      cap: 'round',
      join: 'round',
    });

    const end = sampleAt(curve, curve.length);
    const tip = { x: end.pos.x * TILE, y: end.pos.y * TILE };
    g.poly(arrowheadPolygon(tip, end.tangent, TILE * OVERLAY.pathArrowScale), true).fill({
      color: OVERLAY.path,
    });
  }

  private drawDecor(view: MapView): void {
    const g = this.decorGfx;
    g.clear();

    for (const exit of view.exits ?? (view.exit ? [view.exit] : [])) {
      const pulse = (Math.sin(view.time / 420) + 1) / 2;
      const cx = exit.pos.x * TILE + TILE / 2;
      const cy = exit.pos.y * TILE + TILE / 2;
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

  /**
   * A texture per cached sprite canvas, least-recently-used first out. The
   * global Pixi cache is skipped: it keys by the canvas object, and a texture
   * destroyed here must not be handed back for the same canvas later.
   */
  private texture(canvas: HTMLCanvasElement | HTMLImageElement): Texture {
    const cached = this.textureCache.get(canvas);
    if (cached) {
      this.textureCache.delete(canvas);
      this.textureCache.set(canvas, cached);
      return cached;
    }
    const texture = Texture.from(canvas, true);
    this.textureCache.set(canvas, texture);
    while (this.textureCache.size > MAX_TEXTURES) {
      const oldest = this.textureCache.keys().next().value;
      if (!oldest) break;
      this.textureCache.get(oldest)?.destroy(true);
      this.textureCache.delete(oldest);
    }
    return texture;
  }

  private dropTextures(): void {
    for (const texture of this.frameTextures.values()) texture.destroy(false);
    this.frameTextures.clear();
    for (const texture of this.textureCache.values()) texture.destroy(true);
    this.textureCache.clear();
  }

  /**
   * One frame of a sheet as a texture: a view onto the sheet's texture with
   * the frame rectangle, never a copy of the pixels. Keyed by the source
   * texture's id so a re-uploaded sheet gets fresh views.
   */
  private frameTexture(frame: ResolvedFrame): Texture {
    const base = this.texture(frame.source);
    const f = frame.frame;
    const key = `${base.uid}|${f.x},${f.y},${f.w},${f.h}`;
    const cached = this.frameTextures.get(key);
    if (cached && !cached.destroyed && !base.source.destroyed) {
      this.frameTextures.delete(key);
      this.frameTextures.set(key, cached);
      return cached;
    }
    const texture = new Texture({ source: base.source, frame: new Rectangle(f.x, f.y, f.w, f.h) });
    this.frameTextures.set(key, texture);
    while (this.frameTextures.size > MAX_FRAME_TEXTURES) {
      const oldest = this.frameTextures.keys().next().value;
      if (!oldest) break;
      this.frameTextures.get(oldest)?.destroy(false);
      this.frameTextures.delete(oldest);
    }
    return texture;
  }

  /**
   * Device pixels per tile to rasterise sprites at for the current zoom. The
   * sprite itself stays TILE wide in world units; only the texture behind it
   * gains pixels, which is what keeps a zoomed-in board crisp on a retina
   * display instead of magnifying a 64px painting.
   */
  private spritePx(camera: Camera): number {
    const wanted = TILE * camera.scale * this.viewport.dpr;
    const bucketed = Math.max(SPRITE_BUCKET, Math.ceil(wanted / SPRITE_BUCKET) * SPRITE_BUCKET);
    return Math.min(MAX_SPRITE_PX, bucketed);
  }

  private drawUnits(view: MapView, camera: Camera): void {
    const g = this.fxGfx;
    g.clear();
    const rings = this.groundRings;
    rings.clear();
    const px = this.spritePx(camera);

    const live = new Set<string>();
    // Back to front, so a unit lower on the map overlaps one above it.
    const depth = (pos: Vec2, footprint = 1) =>
      camera.groundPoint({
        x: pos.x + footprint / 2,
        y: pos.y + 0.5,
      }).y;
    const ordered = [...view.units].sort(
      (a, b) => depth(a.renderPos ?? a.pos, a.size) - depth(b.renderPos ?? b.pos, b.size),
    );
    const box = (pos: Vec2, footprint = 1) => {
      const screen = camera.spriteBox(pos, footprint);
      return {
        x: (screen.x + camera.offsetX) / camera.scale,
        y: (screen.y + camera.offsetY) / camera.scale,
      };
    };

    let badgeIndex = 0;

    for (const npc of view.npcs) {
      const key = `npc:${npc.pos.x},${npc.pos.y}`;
      live.add(key);
      const sprite = this.unitSprite(key);
      const entry = resolveAsset(npc.sprite);
      const width = entry.kind === 'sheet' && entry.footprint.w === 2 ? 2 : 1;
      const scale = npc.scale ?? 1;
      const frame =
        entry.kind === 'sheet' ? sheets.frame(npc.sprite, 'idle', 0, 0, px * scale, width) : null;
      const anchor = box(npc.pos, width);
      const x = anchor.x;
      const y = anchor.y - elevationAt(view.grid, npc.pos) * ELEVATION_LIFT * TILE;
      sprite.zIndex = depth(npc.pos, width);
      if (frame) {
        sprite.texture = this.frameTexture(frame);
        sprite.anchor.set(frame.anchor.x, frame.anchor.y);
        sprite.position.set(x + (width * TILE) / 2, y + FOOT_LINE * TILE);
        sprite.width = (frame.frame.w / frame.pixelsPerTile) * TILE * scale;
        sprite.height = (frame.frame.h / frame.pixelsPerTile) * TILE * scale;
      } else {
        sprite.texture = this.texture(sprites.get(npc.sprite, px * scale, { facing: 1 }, width));
        sprite.anchor.set(0, 0);
        sprite.position.set(
          x + (width * TILE * (1 - scale)) / 2,
          y + FOOT_LINE * TILE * (1 - scale),
        );
        sprite.width = width * TILE * scale;
        sprite.height = TILE * scale;
      }
      sprite.scale.x = Math.abs(sprite.scale.x);
      sprite.alpha = 1;
      sprite.visible = true;

      // A small "talk" pip so a child can tell an NPC from scenery.
      g.circle(
        x + TILE * width * 0.5,
        y + TILE * (FOOT_LINE - (FOOT_LINE - 0.08) * scale),
        TILE * 0.07,
      ).fill({
        color: '#f0c674',
        alpha: 0.55 + 0.35 * ((Math.sin(view.time / 500) + 1) / 2),
      });
    }

    for (const prop of view.props) {
      const key = `prop:${prop.id}`;
      live.add(key);
      const sprite = this.unitSprite(key);
      sprite.texture = this.texture(sprites.get(prop.sprite, px, { facing: 1 }));
      const anchor = box(prop.pos);
      sprite.anchor.set(0, 0);
      sprite.position.set(
        anchor.x,
        anchor.y - elevationAt(view.grid, prop.pos) * ELEVATION_LIFT * TILE,
      );
      sprite.zIndex = depth(prop.pos);
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
      const x = anchor.x + (TILE - w) / 2;
      const y = sprite.y + TILE * 0.9;
      const h = Math.max(2, TILE * 0.05);
      g.rect(x, y, w, h).fill({ color: 'rgba(0,0,0,0.55)' });
      g.rect(x, y, (w * prop.hp) / prop.maxHp, h).fill({ color: '#d9a441' });
    }

    for (const unit of ordered) {
      const pos = unit.renderPos ?? unit.pos;
      // The bob lifts the drawing, never the sort: zIndex stays on the tile.
      // So does the ground: a unit on a ledge stands a little higher on screen.
      const lift = elevationAt(view.grid, unit.pos) * ELEVATION_LIFT;
      const anchor = box(pos, unit.size);
      const x = anchor.x + (unit.offset?.x ?? 0) * TILE;
      const y = anchor.y + ((unit.offset?.y ?? 0) - lift) * TILE;
      const marker = unitMarkerGroundPoint(
        anchor,
        TILE,
        lift,
        unit.meleeDirection ? unit.offset : undefined,
      );
      const width = unit.size === 2 ? TILE * 2 : TILE;
      const facing = unit.facing ?? (unit.faction === 'enemy' ? -1 : 1);

      live.add(unit.id);
      const sprite = this.unitSprite(unit.id);
      // A pose scales about the feet; the fallen fade sits on top of any alpha.
      const scale = unit.scale ?? 1;
      // The frame comes from the unit's sheet, real or baked from its painter
      // at the zoom's bucket (ADR 0003); the anchor stands on the foot line.
      const frame = sheets.frame(
        unit.sprite,
        unit.clip ?? 'idle',
        unit.clipTime ?? view.time + idlePhase(unit.id),
        unit.clipFrame,
        px * scale,
        unit.size,
        unit.meleeDirection,
      );
      let headroom = 0;
      if (frame) {
        headroom = frame.headroom;
        sprite.texture = this.frameTexture(frame);
        sprite.anchor.set(frame.anchor.x, frame.anchor.y);
        sprite.position.set(x + width / 2, y + FOOT_LINE * TILE);
        sprite.width = (frame.frame.w / frame.pixelsPerTile) * TILE * scale;
        sprite.height = (frame.frame.h / frame.pixelsPerTile) * TILE * scale;
        sprite.scale.x = Math.abs(sprite.scale.x) * facing;
      } else {
        sprite.texture = this.texture(sprites.get(unit.sprite, px * scale, { facing }, unit.size));
        sprite.anchor.set(0, 0);
        const drawWidth = width * scale;
        const drawHeight = TILE * scale;
        sprite.position.set(x + (width - drawWidth) / 2, y + FOOT_LINE * (TILE - drawHeight));
        sprite.width = drawWidth;
        sprite.height = drawHeight;
        sprite.scale.x = Math.abs(sprite.scale.x);
      }
      sprite.alpha = (unit.alpha ?? 1) * (unit.fallen ? 0.35 : 1);
      sprite.visible = true;
      sprite.zIndex = depth(pos, unit.size);

      // The hit flash: the same sprite again, white and additive, over the top.
      const flash = unit.flash ?? 0;
      if (flash > 0) {
        const key = `flash:${unit.id}`;
        live.add(key);
        const glow = this.unitSprite(key);
        glow.texture = sprite.texture;
        glow.anchor.copyFrom(sprite.anchor);
        glow.position.copyFrom(sprite.position);
        glow.scale.copyFrom(sprite.scale);
        glow.tint = 0xffffff;
        glow.blendMode = 'add';
        glow.alpha = Math.min(1, flash) * 0.9;
        glow.visible = true;
        glow.zIndex = sprite.zIndex + 0.001;
      }

      if (unit.id === view.activeUnitId) {
        rings
          .ellipse(marker.x + width / 2, marker.y + 0.86 * TILE, width * 0.42, TILE * 0.14)
          .stroke({
            width: Math.max(2, TILE * 0.06),
            color: OVERLAY.active,
            alpha: 0.75 + 0.25 * ((Math.sin(view.time / 300) + 1) / 2),
          });
      } else if (unit.id === view.selectedUnitId) {
        rings
          .ellipse(marker.x + width / 2, marker.y + 0.86 * TILE, width * 0.4, TILE * 0.12)
          .stroke({
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

      if (unit.showHealth !== false) this.drawHealthBar(g, unit, x, y, width, scale, headroom);
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

  private drawHealthBar(
    g: Graphics,
    unit: RenderUnit,
    x: number,
    y: number,
    width: number,
    scale: number,
    headroom: number,
  ): void {
    const fraction = Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
    const {
      x: barX,
      y: barY,
      width: barWidth,
      height: barHeight,
    } = actorHealthBar(x, y, width, TILE, scale, headroom);

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

  private drawFloaters(view: MapView, camera: Camera): void {
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
      const center = camera.groundPoint({ x: floater.pos.x + 0.5, y: floater.pos.y + 0.5 });
      text.position.set(center.x, center.y - TILE * 0.1 - floater.progress * TILE * 0.7);
      text.alpha = 1 - floater.progress;
      text.visible = true;
    });

    for (let i = view.floaters.length; i < this.floaters.length; i++) {
      const text = this.floaters[i];
      if (text) text.visible = false;
    }
  }
}
