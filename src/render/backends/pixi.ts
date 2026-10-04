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
  RenderTexture,
  Sprite,
  Text,
  TextStyle,
  Texture,
  UniformGroup,
} from 'pixi.js';

import type { MapScene, SceneFlock, SceneImage, TerrainId, Tile, Vec2 } from '../../core/types';
import { SQUARE_FOOTPRINTS, footprintCells } from '../../core/rules/footprint';
import { authoredForBothSides } from '../../content/assets/clips';
import { resolveAsset } from '../../content/assets/manifest';
import { backdrops } from '../backdrops';
import { sceneForGrid, sceneImage, sceneryOpacities } from '../scene';
import {
  firstGustCrest,
  flockAt,
  flockFrame,
  flushElapsed,
  GUST_LENGTH,
  sway,
} from '../living/wind';
import { SceneTextures } from './sceneTextures';
import { sceneryZ, shadowZ } from './depthOrder';
import { renderFoot } from '../renderFoot';
import type { GroundingCanvas } from '../groundingLayer';
import { sceneGrounding } from '../groundingLayer';
import { GROUNDING_GRAIN } from '../grounding';
import {
  DRY_PATCH_TERRAIN_OFFSET,
  SURFACE_INDEX,
  paintedWaterIsDry,
  surfaceIsPainted,
  surfaceTexel,
} from '../sceneSurfaces';
import { TILE } from '../camera';
import type { Camera, Viewport } from '../camera';
import { DecorSheets } from '../decorSheets';
import { ParticleLayer } from '../fx/particleLayer';
import { steamPuffCanvas, steamSeed } from '../fx/steamPuff';
import { bendFxSource } from '../fx/bendFxDraw';
import { syncBendFx } from '../fx/bendFxPixi';
import { aimArcPoints, arcHeading, arrowheadPolygon } from '../geometry/arc';
import {
  actorReticleX,
  actorSilhouetteGeometry,
  actorShadowDensity,
  healthBarCap,
  HealthBarStagger,
} from '../geometry/actorSilhouette';
import type { HealthBarPlacement } from '../geometry/actorSilhouette';
import { DECOR_CHUNK, decorChunks } from '../geometry/board';
import {
  clip,
  identity,
  liftCost,
  liftPlan,
  markedCells,
  marksSchedule,
  polyBounds,
  snapOut,
  clusters,
} from '../geometry/lift';
import type { LiftPlan, Pt, Rect } from '../geometry/lift';
import { contourLoops, isHole } from '../geometry/contour';
import type { Curve } from '../geometry/curve';
import { sampleAt, smoothPath } from '../geometry/curve';
import { HP_CAP, HP_COLORS, OVERLAY, STATUS_BADGE, hpFill } from '../palettes';
import { FOOT_LINE } from '../sheets/bake';
import { resolveActorEmitters } from '../geometry/actorAttachments';
import type { ResolvedFrame } from '../sheets/store';
import { placeFrame } from '../sheets/placement';
import { idlePhase, sheets } from '../sheets/store';
import { MAX_SPRITE_PX, npcPose, sprites } from '../spriteCache';
import {
  fallenAlpha,
  floaterScale,
  unitMarkerGroundPoint,
  type AimArc,
  type BendFxSprite,
  type MapView,
  type OverlayLayer,
  type RenderUnit,
} from '../view';
import type { BackendCapabilities, RenderBackend } from './backend';
import { EDGE_SHADE_ALPHA, EDGE_SHADE_TILES, VIGNETTE_ALPHA, overlayColors } from './canvas2d';
import { liftAlong, liftAt } from '../geometry/elevation';
import { FILTER_VERTEX, GROUND_FRAGMENT } from './shaders';
import {
  CAST_SHADOW_ALPHA,
  FALLEN_SHADOW_ALPHA,
  SHADOW_RGB,
  castShadowStrength,
  structureShadowPolygons,
  tileShadowCell,
  silhouetteProjection,
} from '../lighting';

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

/** Cast silhouettes need edges, not full sprite colour; half device resolution is sufficient. */
const SHADOW_RESOLUTION = 0.5;

const SHADOW_RGB_GLSL = SHADOW_RGB.map((channel) => (channel / 255).toFixed(5)).join(', ');

/** The mask's max-unioned coverage is tinted once, so overlaps cannot darken twice. */
const CAST_SHADOW_FRAGMENT = `#version 300 es
precision highp float;

in vec2 vTextureCoord;
uniform sampler2D uTexture;
out vec4 fragColor;

void main(void) {
  float alpha = texture(uTexture, vTextureCoord).a * ${CAST_SHADOW_ALPHA.toFixed(5)};
  fragColor = vec4(vec3(${SHADOW_RGB_GLSL}) * alpha, alpha);
}`;

/**
 * How far round it a surface the ground shader animates keeps moving: water
 * ripples and fire rolls and lights its neighbours. Steam is upright, so it
 * does not invalidate the lifted ground cache.
 */
const MOVING_SURFACE = (tile: Tile): number =>
  tile.surface?.id === 'fire' ? 2 : tile.surface?.id === 'water' ? 1 : 0;

/** How far firelight reaches, in tiles. */
const GLOW_RADIUS = 2;

/** Pooled climb labels share immutable typography instead of allocating a style per label. */
const CLIMB_LABEL_STYLE = new TextStyle({
  fontFamily: 'sans-serif',
  fontWeight: '600',
  fontSize: Math.max(10, TILE * 0.2),
  fill: OVERLAY.climb,
  stroke: { color: OVERLAY.pathUnder, width: Math.max(2, TILE * 0.045) },
});

/** Half-widths of the grass band's three nested stripes, widest first, in scene pixels. */
const BREEZE_HALVES = [260, 175, 90] as const;

/** A wind plate's add-blended stripes; `used` counts those drawn this frame. */
interface BreezePool {
  stripes: Sprite[];
  used: number;
}

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

/** Pixi ordering point, exported so backend parity is testable without WebGL. */
export function pixiActorDepth(
  camera: Camera,
  pos: Vec2,
  size: 1 | 2,
  square = SQUARE_FOOTPRINTS,
): number {
  return camera.groundPoint(renderFoot(pos, size, square, camera.projection)).y;
}

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
  /**
   * Everything drawn flat on the ground, painting to paths. The lift pass
   * (ADR 0065) renders parts of it, cropped, into targets of its own.
   */
  private groundStack = new Container();
  /**
   * The raised blocks, rendered once into a target cropped to them and shown
   * over the flat ground until the plan or the ground under them changes.
   */
  private liftLayer: RenderTexture | null = null;
  private liftSprite = new Sprite(Texture.EMPTY);
  private liftKey = '';
  /** The flat ground and static marks the layer is built from, kept only while it keeps changing. */
  private liftSources: RenderTexture[] = [];
  private liftBuild = new Graphics();
  /** The live marks near raised tops, cropped, and the tops that show them. */
  private marksTargets: RenderTexture[] = [];
  private marksGfx = new Graphics();
  private marksKey = '';
  /** The oblique board, where raised ground is lifted rather than banded. */
  private lifted = false;
  /** Projected world pixels; actors and labels remain upright. */
  private upright = new Container();
  private labels = new Container();
  private groundTransform = new Matrix();
  private sceneGround = new Container();
  private groundChunks = new Map<string, Sprite>();
  private scenerySprites = new Map<string, Sprite>();
  /** Contact shadow and wear under the scenery (grounding.ts), above the ground chunks. */
  private groundingSprite: Sprite | null = null;
  private groundingCanvas: HTMLCanvasElement | null = null;
  private groundingTexture: Texture | null = null;
  /** A gust's light on the grass: slices of the wind ground added back onto it. */
  private breeze = new Container();
  /** Each wind plate's breeze stripes, kept from frame to frame. */
  private breezePools = new Map<string, BreezePool>();
  /** The flock whose page was last asked for, so a scene change asks once. */
  private flock: SceneFlock | undefined;
  /** The birds a fight flushes out of the trees, over every upright. */
  private flockLayer = new Container();
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
  /** The mode and seam readiness the decor chunks were baked for. */
  private decorMode = '';
  private elevationBasePx = 0;
  /** Edge shading along the board's four sides and the vignette over the view. */
  private shadeLayer = new Container();
  private shadeSprites: Sprite[] = [];
  private overlayGfx = new Graphics();
  /** Upright vapour below actors; sprites and their shared texture are reused. */
  private steamLayer = new Container();
  private steamPuffs: Sprite[] = [];
  private pathGfx = new Graphics();
  private decorGfx = new Graphics();
  private groundRings = new Graphics();
  private unitLayer = new Container();
  /** World-space projected silhouettes; rendered to one viewport union mask per frame. */
  private shadowMaskSources = new Container();
  private structureShadowGfx = new Graphics();
  private shadowComposite = new Sprite(Texture.EMPTY);
  /** Everything outside the board; erased from the union mask (no Pixi mask: its pipe is not in the production build). */
  private shadowOutside = new Graphics();
  private shadowOutsideRoot = new Container();
  private shadowMask: RenderTexture | null = null;
  private shadowFilter: Filter | null = null;
  private castSprites = new Map<string, Sprite>();
  private castLive = new Set<string>();
  /** Painted bend effects under and over the actors (ADR 0055). */
  private bendUnder = new Container();
  private bendOver = new Container();
  private climbCues = new Container();
  private climbGfx = new Graphics();
  private fxGfx = new Graphics();
  private climbLabelLayer = new Container();
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
    uSteamRegion: { value: 0, type: 'f32' },
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
    uSteamRegion: { value: 0, type: 'f32' },
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
  private healthBarStagger = new HealthBarStagger();
  private unitSprites = new Map<string, Sprite>();
  private textureCache = new Map<HTMLCanvasElement | HTMLImageElement, Texture>();
  private frameTextures = new Map<string, Texture>();
  private climbLabels: Text[] = [];
  private floaters: Text[] = [];
  private badgeText: Text[] = [];

  /**
   * Contours per overlay layer and the curve per path, keyed by identity: the
   * scene memoises its overlays, so the same objects come back frame after
   * frame until something changes, and a WeakMap forgets them with it.
   */
  private loops = new WeakMap<OverlayLayer, Vec2[][]>();
  private obscuringLoops = new WeakMap<readonly Vec2[], Vec2[][]>();
  private curve: { path: readonly Vec2[]; from: Vec2; curve: Curve } | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private readonly squareFootprints = SQUARE_FOOTPRINTS,
  ) {
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
    this.shadowFilter = new Filter({
      glProgram: GlProgram.from({ vertex: FILTER_VERTEX, fragment: CAST_SHADOW_FRAGMENT }),
      padding: 0,
    });
    this.sceneGround.addChild(this.breeze);
    this.groundSprite.filters = [this.groundFilter];
    this.groundOverlaySprite.filters = [this.groundOverlayFilter];

    // The ground quad is screen-sized and sits OUTSIDE the camera transform:
    // its shader derives tile coordinates from the camera uniforms instead.
    // The painting sits under it, placed from the same camera numbers.
    this.backdropSprite.visible = false;
    this.groundOverlaySprite.visible = false;
    this.groundStack.addChild(
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
    // Opaque structure polygons need no advanced blend equation: ordinary
    // source-over is already an opaque union. Keep the `max` path confined to
    // translucent silhouette sprites, where it is semantically required.
    this.structureShadowGfx.blendMode = 'normal';
    this.shadowMaskSources.addChild(this.structureShadowGfx);
    this.shadowComposite.visible = false;
    this.shadowComposite.filters = [this.shadowFilter];
    this.shadowOutside.blendMode = 'erase';
    this.shadowOutsideRoot.addChild(this.shadowOutside);
    this.upright.addChild(
      this.steamLayer,
      this.groundRings,
      this.bendUnder,
      this.unitLayer,
      this.flockLayer,
      this.bendOver,
    );
    this.climbCues.addChild(this.climbGfx, this.climbLabelLayer);
    this.labels.addChild(this.fxGfx, this.floaterLayer);
    this.groundStack.addChild(this.root);
    this.liftSprite.visible = false;
    app.stage.addChild(
      this.groundStack,
      this.liftSprite,
      this.marksGfx,
      this.shadowComposite,
      this.climbCues,
      this.upright,
      this.fxOver.container,
      this.labels,
    );

    if (this.pending) {
      const { view, camera } = this.pending;
      this.pending = null;
      this.draw(view, camera);
    }
  }

  resize(viewport: Viewport): void {
    sprites.clear();
    sheets.clear();
    // Cast sprites retain cached texture sources. Detach them before those
    // sources and the renderer backing store are invalidated by a resize.
    this.dropCastShadows();
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
    this.shadowComposite.filters = null;
    this.shadowOutsideRoot.destroy({ children: true });
    this.shadowFilter?.destroy();
    this.dropCastShadows();
    this.dropLift();
    this.liftBuild.destroy();
    this.app?.stage.destroy({ children: true });
    this.app?.renderer.destroy(false);
    this.app = null;
    this.groundFilter = null;
    this.groundOverlayFilter = null;
    this.shadowFilter = null;
    this.dropTextures();
    this.unitSprites.clear();
    this.breezePools.clear();
    this.sceneTextures.clear();
    this.groundChunks.clear();
    this.scenerySprites.clear();
    this.groundingSprite = null;
    this.groundingTexture?.destroy(true);
    this.groundingTexture = null;
    this.groundingCanvas = null;
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

    this.lifted = camera.projection === 'oblique';
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
    for (const layer of [
      this.sceneGround,
      this.shadowMaskSources,
      this.climbCues,
      this.upright,
      this.labels,
    ]) {
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
    this.syncDecor(view, camera, decorMode, painted);
    this.syncShade(view, camera, scenePainted);
    this.drawOverlays(view);
    this.drawPath(view);
    this.drawDecor(view);
    this.drawClimbMarkers(view, camera);
    this.drawUnits(view, camera);
    try {
      this.syncCastShadows(view, camera);
    } catch {
      // A supplementary mask must never prevent the already-built map frame
      // from reaching the stage (notably while a WebGL context is resizing).
      this.shadowComposite.visible = false;
      this.shadowComposite.texture = Texture.EMPTY;
    }
    this.drawSteamPuffs(view, camera);
    this.drawTargetReticle(view, camera);
    const bendFx = view.bendFx ?? [];
    const bendTexture = (sprite: BendFxSprite) => {
      const source = bendFxSource(sprite);
      return source ? this.frameTexture({ source: source.image, frame: source.frame }) : null;
    };
    syncBendFx(
      this.bendUnder,
      bendFx.filter((s) => s.z !== 'overActor'),
      camera,
      bendTexture,
    );
    syncBendFx(
      this.bendOver,
      bendFx.filter((s) => s.z === 'overActor'),
      camera,
      bendTexture,
    );
    const emitters = resolveActorEmitters(
      view.emitters,
      view.grid,
      camera.projection,
      TILE * camera.scale * camera.viewport.dpr,
    );
    const oblique = camera.projection === 'oblique';
    this.fxUnder.draw(emitters, oblique);
    this.fxOver.draw(emitters, oblique);
    this.drawFloaters(view, camera);
    // The marks over the ground and its art, which the lift pass moves by a
    // raised cell's whole lift: those that change only with the ground (the
    // decor over art), and the live ones. Procedural ground lifts its own.
    const live: Container[] = [
      this.groundOverlaySprite,
      this.overlayGfx,
      this.pathGfx,
      this.fxUnder.container,
      this.decorGfx,
    ];
    if (painted && !partialScene) live.push(this.groundSprite);
    this.syncLift(view, camera, oblique && scenePainted ? (view.scene?.reliefLift ?? 0) : 0, {
      static: painted ? [this.decorLayer] : [],
      live,
      // The surfaces the shader draws over art are on the live side.
      surfaces:
        painted || partialScene
          ? (tile, pos) => (surfaceIsPainted(view, painted, tile, pos) ? 0 : 1)
          : null,
      ground: [
        identity(view.grid),
        // Not the scene: it is copied whenever its scenery is filtered.
        identity(view.scene?.ground),
        scenePainted,
        backdropPainted,
        partialScene,
        this.backdropSprite.visible && this.backdropSprite.texture.uid,
        [...this.groundChunks.values()].map((s) => (s.visible ? s.texture.uid : 0)).join(','),
        this.groundingSprite?.visible && this.groundingSprite.texture.uid,
        this.decorLayer.visible && `${this.decorMode}@${this.decorPx}`,
        this.elevationBaseLayer.visible && this.elevationBasePx,
        this.shadeLayer.visible,
        view.hatch,
        view.gridLines,
        view.obscuringTiles !== undefined,
        // Bare procedural ground carries its surfaces, which move every frame.
        !painted && !partialScene && view.time,
      ].join('|'),
    });

    app.renderer.render(app.stage);
  }

  /**
   * Raised ground as blocks (ADR 0065), from the same plan the Canvas 2D
   * backend draws. The blocks are rendered once into a target cropped to
   * them, from cropped renders of the flat ground and its static marks, and
   * shown over the flat ground; the live marks go on the tops that have one
   * near them, from a cropped target rendered only when they change.
   */
  private syncLift(
    view: MapView,
    camera: Camera,
    artLift: number | readonly number[],
    marks: {
      static: Container[];
      live: Container[];
      surfaces: ((tile: Tile, pos: Vec2) => number) | null;
      ground: string;
    },
  ): void {
    const app = this.app;
    if (!app) return;
    const plan = this.lifted
      ? liftPlan(view.grid, camera, artLift, Boolean(view.crispOverlays))
      : null;
    const rect = plan?.bounds;
    if (!plan || !rect) {
      this.dropLift();
      return;
    }
    liftCost.frames++;
    const tilePx = TILE * camera.scale;
    // The stack is drawn shaken; the layer and the marks target are not.
    const nx = view.cameraNudge.x * tilePx;
    const ny = view.cameraNudge.y * tilePx;
    const key = `${plan.key}|${marks.ground}`;
    const layer =
      this.liftLayer && key === this.liftKey
        ? this.releaseSources(this.liftLayer)
        : this.buildLift(plan, rect, key, nx, ny, marks);
    this.liftSprite.texture = layer;
    this.liftSprite.position.set(rect.x + nx, rect.y + ny);
    this.liftSprite.visible = true;

    const drawn = marks.surfaces ?? undefined;
    const steps = marksSchedule(
      plan,
      view.grid,
      markedCells(view.grid, view, { surfaces: drawn, gridLines: view.gridLines }),
    );
    // Where each marked top reads its marks from, grouped so that tops far
    // apart get a small target each rather than one spanning the board.
    const screen = { x: 0, y: 0, w: this.viewport.width, h: this.viewport.height };
    const reads = steps.map(({ cell, marks: shown }) =>
      shown && cell.top ? clip(polyBounds(cell.top, cell.shift), screen) : null,
    );
    const marked = reads.flatMap((r, step) => (r ? [{ r, step }] : []));
    const groupOf = new Map<number, number>();
    const groups = clusters(marked.map(({ r }) => r)).map(({ rect: r, members }, group) => {
      for (const k of members) groupOf.set(marked[k]?.step ?? -1, group);
      return { rect: snapOut(r, this.viewport.dpr) ?? r };
    });
    // What moves by itself (a pulse, a spray, water and fire, and firelight
    // round it) re-renders the target every frame, but only while it is on a
    // marked top; the rest waits for a change.
    const still = { overlays: [], hoverTile: null, path: [], pathFrom: null, aimArc: null };
    const moving = markedCells(
      view.grid,
      { ...still, exit: view.exit, exits: view.exits, emitters: view.emitters },
      {
        surfaces: drawn && ((tile, pos) => (drawn(tile, pos) ? MOVING_SURFACE(tile) : 0)),
      },
    );
    const w = view.grid.width;
    const animated = steps.some((s) => s.marks && moving?.[s.cell.y * w + s.cell.x] === 1);
    const liveKey = [
      this.liftKey,
      steps.map((s) => `${s.cell.x},${s.cell.y}${s.recover ? 'r' : ''}${s.marks ? 'm' : ''}`),
      view.overlays.map(identity),
      view.hoverTile && `${view.hoverTile.x},${view.hoverTile.y}`,
      identity(view.path),
      view.pathFrom && `${view.pathFrom.x},${view.pathFrom.y}`,
      view.aimArc && JSON.stringify(view.aimArc),
      identity(view.obscuringTiles),
      view.weatherIntensity,
      view.crispOverlays,
      (animated || (!view.reducedMotion && (view.weatherIntensity ?? 0) > 0)) && view.time,
    ].join('|');
    this.marksGfx.position.set(nx, ny);
    if (liveKey === this.marksKey) return;
    this.marksKey = liveKey;

    const g = this.marksGfx;
    g.clear();
    for (const extra of this.marksTargets.splice(groups.length)) extra.destroy(true);
    const targets = groups.map(({ rect: r }, i) => {
      const target = this.target(this.marksTargets[i] ?? null, r);
      this.marksTargets[i] = target;
      this.renderStack(target, r, nx, ny, (layer) => marks.live.includes(layer));
      return { rect: r, target };
    });
    const flat = (poly: readonly Pt[]) => poly.flatMap((p) => [p.x, p.y]);
    for (const [index, { cell, recover, marks: shown }] of steps.entries()) {
      // A taller block in front of a marked top: the layer again, over it.
      if (recover)
        for (const poly of cell.block)
          g.poly(flat(poly)).fill({
            texture: layer,
            matrix: new Matrix(1, 0, 0, 1, rect.x, rect.y),
            textureSpace: 'global',
          });
      const from = targets[groupOf.get(index) ?? -1];
      if (!shown || !cell.top || !from) continue;
      liftCost.markedTops++;
      // Global texture space maps a point through the inverse of `matrix`:
      // this one reads the target at the top's flat place, `shift` below.
      g.poly(flat(cell.top)).fill({
        texture: from.target,
        matrix: new Matrix(1, 0, 0, 1, from.rect.x, from.rect.y - cell.shift),
        textureSpace: 'global',
      });
    }
    this.countHeld();
  }

  /** Draws the plan's ops into the lift layer, copying from cropped renders of the stack. */
  private buildLift(
    plan: LiftPlan,
    rect: Rect,
    key: string,
    nx: number,
    ny: number,
    marks: { static: Container[]; live: Container[] },
  ): RenderTexture {
    const app = this.app as NonNullable<PixiBackend['app']>;
    this.liftKey = key;
    // A new layer shows new blocks; any marks on the old one go with it.
    this.marksKey = '';
    liftCost.layerBuilds++;
    const from = plan.sources ?? rect;
    const [groundSource, marksSource] = this.liftSources;
    const ground = this.target(groundSource ?? null, from);
    const hideMarks = [...marks.static, ...marks.live];
    this.renderStack(ground, from, nx, ny, (layer) => !hideMarks.includes(layer), true);
    const hasMarks = marks.static.some((layer) => layer.visible);
    const statics = hasMarks ? this.target(marksSource ?? null, from) : null;
    if (statics) this.renderStack(statics, from, nx, ny, (layer) => marks.static.includes(layer));
    this.liftSources = statics ? [ground, statics] : [ground];
    if (!statics) marksSource?.destroy(true);

    const g = this.liftBuild;
    g.clear();
    const flat = (poly: readonly Pt[]) => poly.flatMap((p) => [p.x, p.y]);
    // Global texture space maps a point through the inverse of `matrix`: this
    // one reads the cropped source at the flat place, `shift` further down.
    const read = (texture: RenderTexture, shift: number) => ({
      texture,
      matrix: new Matrix(1, 0, 0, 1, from.x, from.y - shift),
      textureSpace: 'global' as const,
    });
    for (const cell of plan.cells)
      for (const op of cell.ops) {
        if (op.kind === 'overlay') {
          if (statics) g.poly(flat(op.poly)).fill(read(statics, op.shift));
        } else if ('shift' in op) {
          g.poly(flat(op.poly)).fill(read(ground, op.shift));
        } else if (op.kind === 'fill') {
          g.poly(flat(op.poly)).fill({ color: op.color, alpha: op.alpha });
        } else {
          g.moveTo(op.a.x, op.a.y)
            .lineTo(op.b.x, op.b.y)
            .stroke({ color: op.color, alpha: op.alpha, width: op.width, cap: 'round' });
        }
      }
    const layer = (this.liftLayer = this.target(this.liftLayer, rect));
    app.renderer.render({
      container: g,
      target: layer,
      clear: true,
      transform: new Matrix(1, 0, 0, 1, -rect.x, -rect.y),
    });
    liftCost.targetRenders++;
    liftCost.targetPx += layer.source.pixelWidth * layer.source.pixelHeight;
    this.countHeld();
    return layer;
  }

  /** A render target of `rect`'s size, reusing `texture` when it has one. */
  private target(texture: RenderTexture | null, rect: Rect): RenderTexture {
    // A resize to the size a texture already has does nothing.
    return (texture ?? RenderTexture.create({ dynamic: true })).resize(
      rect.w,
      rect.h,
      this.viewport.dpr,
    ) as RenderTexture;
  }

  /**
   * Renders the ground stack's `keep` layers, cropped to `rect` of the
   * unshaken screen, into `target`. The ground quads work out their tiles
   * from where their pixels land, so their origin moves with the crop.
   */
  private renderStack(
    target: RenderTexture,
    rect: Rect,
    nx: number,
    ny: number,
    keep: (layer: Container) => boolean,
    still = false,
  ): void {
    const app = this.app;
    if (!app) return;
    const dx = nx + rect.x;
    const dy = ny + rect.y;
    const hidden = [...this.groundStack.children, ...this.root.children].filter(
      (layer) => layer !== this.root && layer.renderable && !keep(layer),
    );
    // The breeze is a moving light on the grass: it stays on the flat pass.
    if (still && this.breeze.renderable) hidden.push(this.breeze);
    for (const layer of hidden) layer.renderable = false;
    this.moveGroundOrigin(-dx, -dy);
    app.renderer.render({
      container: this.groundStack,
      target,
      clear: true,
      transform: new Matrix(1, 0, 0, 1, -dx, -dy),
    });
    this.moveGroundOrigin(dx, dy);
    for (const layer of hidden) layer.renderable = true;
    liftCost.targetRenders++;
    liftCost.targetPx += target.source.pixelWidth * target.source.pixelHeight;
  }

  private moveGroundOrigin(dx: number, dy: number): void {
    for (const group of [this.groundUniforms, this.groundOverlayUniforms]) {
      const origin = (group.uniforms as { uGroundOrigin: Float32Array }).uGroundOrigin;
      origin[0] = (origin[0] ?? 0) + dx;
      origin[1] = (origin[1] ?? 0) + dy;
      group.update();
    }
  }

  /** The layer has held for a frame: the sources it was built from can go. */
  private releaseSources(layer: RenderTexture): RenderTexture {
    if (this.liftSources.length) {
      for (const source of this.liftSources) source.destroy(true);
      this.liftSources = [];
      this.countHeld();
    }
    return layer;
  }

  /** No raised ground on screen, or the board is going: let every lift target go. */
  private dropLift(): void {
    if (!this.liftSprite.visible && !this.liftLayer && !this.marksTargets.length) return;
    this.liftSprite.visible = false;
    this.liftSprite.texture = Texture.EMPTY;
    this.marksGfx.clear();
    for (const texture of [this.liftLayer, ...this.marksTargets, ...this.liftSources])
      texture?.destroy(true);
    this.liftLayer = null;
    this.marksTargets = [];
    this.liftSources = [];
    this.liftKey = '';
    this.marksKey = '';
    this.countHeld();
  }

  private countHeld(): void {
    liftCost.heldPx = [this.liftLayer, ...this.marksTargets, ...this.liftSources].reduce(
      (sum, t) => sum + (t ? t.source.pixelWidth * t.source.pixelHeight : 0),
      0,
    );
  }

  /* ---------------------------------------------------------------- */
  /* Cast shadows                                                      */
  /* ---------------------------------------------------------------- */

  /**
   * Copies an upright sprite's current alpha silhouette through the shared
   * foot-anchored projection. `max` blending makes the render target a union
   * mask: overlap retains the stronger coverage instead of accumulating it.
   */
  private projectSilhouette(
    target: Sprite,
    source: Sprite,
    foot: { x: number; y: number },
    strength: number,
  ): void {
    target.texture = source.texture;
    target.anchor.copyFrom(source.anchor);
    const s = source.localTransform;
    const p = silhouetteProjection(foot.x, foot.y);
    target.setFromMatrix(
      new Matrix(
        p.a * s.a + p.c * s.b,
        p.b * s.a + p.d * s.b,
        p.a * s.c + p.c * s.d,
        p.b * s.c + p.d * s.d,
        p.a * s.tx + p.c * s.ty + p.e,
        p.b * s.tx + p.d * s.ty + p.f,
      ),
    );
    target.alpha = Math.max(0, Math.min(1, strength));
    target.blendMode = 'max';
    target.visible = source.visible && target.alpha > 0;
  }

  /** Adds this frame's actor or moving-prop silhouette to the dynamic union. */
  private projectDynamicShadow(
    key: string,
    source: Sprite,
    foot: { x: number; y: number },
    strength: number,
  ): void {
    this.castLive.add(key);
    let shadow = this.castSprites.get(key);
    if (!shadow) {
      shadow = new Sprite();
      this.castSprites.set(key, shadow);
      this.shadowMaskSources.addChild(shadow);
    }
    this.projectSilhouette(shadow, source, foot, strength);
  }

  /**
   * Adds scenery and still-prop silhouettes to the frame's union. They are
   * drawn straight into the viewport mask each frame: a few dozen sprites into
   * a half-resolution target costs less than a cached world-space texture, and
   * the cache's size and offset bookkeeping drew the wrong region once the
   * scene finished loading.
   */
  private syncSceneryShadows(view: MapView): void {
    for (const item of view.scene?.scenery ?? []) {
      if (item.castShadow === false) continue;
      const source = this.scenerySprites.get(item.id);
      if (!source?.visible) continue;
      this.projectDynamicShadow(
        `scene:${item.id}`,
        source,
        { x: item.x + item.width / 2, y: item.y + item.height },
        castShadowStrength(item.castShadow),
      );
    }
    for (const prop of view.props) {
      if (prop.burning || prop.castShadow === false) continue;
      const source = this.unitSprites.get(`prop:${prop.id}`);
      if (!source?.visible) continue;
      this.projectDynamicShadow(
        `prop:${prop.id}`,
        source,
        { x: source.x + TILE / 2, y: source.y + FOOT_LINE * TILE },
        castShadowStrength(prop.castShadow),
      );
    }
  }

  /** Unions cached static and current-frame silhouettes, then exposes one tinted layer. */
  private syncCastShadows(view: MapView, camera: Camera): void {
    const app = this.app;
    if (!app) return;
    const hasStructure = this.syncStructureShadows(view, camera);
    if (camera.projection === 'oblique') this.syncSceneryShadows(view);
    for (const [key, sprite] of this.castSprites)
      if (!this.castLive.has(key)) sprite.visible = false;
    const hasDynamic = [...this.castSprites.values()].some((sprite) => sprite.visible);
    this.castLive.clear();
    if (!hasDynamic && !hasStructure) {
      this.shadowComposite.visible = false;
      return;
    }

    const resolution = Math.max(0.5, this.viewport.dpr * SHADOW_RESOLUTION);
    this.shadowMask = (this.shadowMask ?? RenderTexture.create({ dynamic: true })).resize(
      this.viewport.width,
      this.viewport.height,
      resolution,
    ) as RenderTexture;
    const ring = camera.clampRingTiles;
    const nx = view.cameraNudge.x * TILE * camera.scale;
    const ny = view.cameraNudge.y * TILE * camera.scale;
    const corners = [
      { x: -ring.left, y: -ring.top },
      { x: view.grid.width + ring.right, y: -ring.top },
      { x: view.grid.width + ring.right, y: view.grid.height + ring.bottom },
      { x: -ring.left, y: view.grid.height + ring.bottom },
    ].map((point) => {
      const screen = camera.project(point);
      return [screen.x + nx, screen.y + ny];
    });
    app.renderer.render({
      container: this.shadowMaskSources,
      target: this.shadowMask,
      clear: true,
    });
    // The complement of the (convex) board quad, as one outward slab per edge.
    // Graphics holes (`cut`) erased the whole mask here, so none are used.
    const out = this.shadowOutside.clear();
    const cx = corners.reduce((sum, c) => sum + (c[0] ?? 0), 0) / corners.length;
    const cy = corners.reduce((sum, c) => sum + (c[1] ?? 0), 0) / corners.length;
    const reach = 8000;
    corners.forEach((from, index) => {
      const to = corners[(index + 1) % corners.length];
      if (!from || !to) return;
      const ex = (to[0] ?? 0) - (from[0] ?? 0);
      const ey = (to[1] ?? 0) - (from[1] ?? 0);
      const length = Math.hypot(ex, ey) || 1;
      let ox = ey / length;
      let oy = -ex / length;
      if (((from[0] ?? 0) - cx) * ox + ((from[1] ?? 0) - cy) * oy < 0) {
        ox = -ox;
        oy = -oy;
      }
      out
        .poly([
          from[0] ?? 0,
          from[1] ?? 0,
          to[0] ?? 0,
          to[1] ?? 0,
          (to[0] ?? 0) + ox * reach,
          (to[1] ?? 0) + oy * reach,
          (from[0] ?? 0) + ox * reach,
          (from[1] ?? 0) + oy * reach,
        ])
        .fill({ color: 0xffffff });
    });
    app.renderer.render({
      container: this.shadowOutsideRoot,
      target: this.shadowMask,
      clear: false,
    });
    this.shadowComposite.texture = this.shadowMask;
    this.shadowComposite.anchor.set(0, 0);
    this.shadowComposite.position.set(0, 0);
    this.shadowComposite.width = this.viewport.width;
    this.shadowComposite.height = this.viewport.height;
    this.shadowComposite.visible = true;
  }

  /** Procedural wall blocks and raised tiers have no bitmap silhouette. */
  private syncStructureShadows(view: MapView, camera: Camera): boolean {
    const g = this.structureShadowGfx;
    g.clear();
    if (camera.projection !== 'oblique') return false;
    const flat = (poly: readonly { x: number; y: number }[]) => poly.flatMap((p) => [p.x, p.y]);
    const local = (point: { x: number; y: number }) => ({
      x: (point.x + camera.offsetX) / camera.scale,
      y: (point.y + camera.offsetY) / camera.scale,
    });
    const authored = new Set(
      (view.scene?.scenery ?? []).flatMap((piece) =>
        (piece.footprint ?? []).map((cell) => `${cell.x},${cell.y}`),
      ),
    );
    for (const prop of view.props) authored.add(`${prop.pos.x},${prop.pos.y}`);
    const polygons = structureShadowPolygons(
      view.grid.width,
      view.grid.height,
      (x, y) => tileShadowCell(view.grid.tiles[y * view.grid.width + x]),
      (point) => local(camera.project(point)),
      authored,
    );
    for (const { points } of polygons) g.poly(flat(points)).fill({ color: 0xffffff });
    return polygons.length > 0;
  }

  private dropCastShadows(): void {
    this.shadowComposite.visible = false;
    this.shadowComposite.texture = Texture.EMPTY;
    this.shadowMask?.destroy(true);
    this.shadowMask = null;
    for (const sprite of this.castSprites.values()) sprite.destroy();
    this.castSprites.clear();
    this.castLive.clear();
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
        // Chunks stay under the breeze, whenever they first load.
        this.sceneGround.addChildAt(sprite, this.sceneGround.getChildIndex(this.breeze));
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
    const opacities = sceneryOpacities(scene?.scenery ?? [], view, camera, this.squareFootprints);
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
      // Wind leans the crown about the foot; the trunk's base never moves.
      // A mirrored piece anchors on its texture's right edge, which the
      // negative scale lays on the box's left.
      sprite.anchor.set(item.flip ? 1 : 0, 1);
      sprite.position.set(item.x, item.y + item.height);
      sprite.width = item.width;
      sprite.height = item.height;
      sprite.scale.x = Math.abs(sprite.scale.x) * (item.flip ? -1 : 1);
      sprite.skew.x = item.wind && !view.reducedMotion ? -sway(view.time, item) : 0;
      // A figure level with a piece of frontage stands in front of it, as on
      // Canvas 2D (depthOrder.ts).
      sprite.zIndex = sceneryZ(camera.groundPoint(item.depth).y);
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
    this.syncGrounding(complete ? scene : undefined, camera);
    this.syncBreeze(scene?.ground ?? [], view);
    this.syncFlock(scene, view);
    this.sceneTextures.end();
    return complete;
  }

  private textureForGrounding(layer: GroundingCanvas): Texture {
    if (this.groundingCanvas !== layer.canvas || !this.groundingTexture) {
      this.groundingTexture?.destroy(true);
      // Never Pixi's global cache: the canvas belongs to groundingLayer's.
      this.groundingCanvas = layer.canvas;
      this.groundingTexture = Texture.from(layer.canvas, true);
      this.groundingTexture.source.scaleMode = 'nearest';
    }
    return this.groundingTexture;
  }

  /** Contact shadow, ambient occlusion, and wear between ground and scenery. */
  private syncGrounding(scene: MapScene | undefined, camera: Camera): void {
    const grounding = scene
      ? sceneGrounding(scene, { toWorld: (pos) => camera.groundPoint(pos) })
      : null;
    const contact = grounding;
    if (contact) {
      let sprite = this.groundingSprite;
      if (!sprite) {
        sprite = new Sprite();
        this.groundingSprite = sprite;
      }
      // Over every chunk, under the breeze, whenever a chunk arrived.
      if (
        sprite.parent !== this.sceneGround ||
        this.sceneGround.getChildIndex(sprite) !== this.sceneGround.getChildIndex(this.breeze) - 1
      ) {
        sprite.removeFromParent();
        this.sceneGround.addChildAt(sprite, this.sceneGround.getChildIndex(this.breeze));
      }
      sprite.texture = this.textureForGrounding(contact);
      sprite.position.set(contact.x, contact.y);
      sprite.width = contact.canvas.width * GROUNDING_GRAIN;
      sprite.height = contact.canvas.height * GROUNDING_GRAIN;
      sprite.visible = true;
    } else if (this.groundingSprite) this.groundingSprite.visible = false;
    if (!contact && this.groundingTexture) {
      this.groundingTexture.destroy(true);
      this.groundingTexture = null;
      this.groundingCanvas = null;
    }
  }

  /**
   * WebGL only: the grass brightens under each gust crest as it crosses the
   * board. Three nested stripes each add a little of the grass back onto
   * itself, so the band's edge steps down softly. A stripe is a slice of the
   * plate, never a masked copy: a sprite mask composites offscreen and drops
   * the add, and a stencil mask broke the particle layers' batches.
   */
  private syncBreeze(ground: readonly SceneImage[], view: MapView): void {
    for (const pool of this.breezePools.values()) pool.used = 0;
    for (const piece of view.reducedMotion ? [] : ground) {
      const image = piece.wind && !piece.sourceRect ? sceneImage(piece) : null;
      const plate = image && this.sceneTextures.get(piece);
      // The same page limit a sourceRect crop has (sceneSourceRect).
      if (!image || !plate || Math.max(image.naturalWidth, image.naturalHeight) > 2048) continue;
      let pool = this.breezePools.get(piece.url);
      if (!pool) this.breezePools.set(piece.url, (pool = { stripes: [], used: 0 }));
      const scale = image.naturalWidth / piece.width;
      const end = piece.x + piece.width + BREEZE_HALVES[0];
      for (
        let crest = firstGustCrest(view.time, piece.x - BREEZE_HALVES[0]);
        crest <= end;
        crest += GUST_LENGTH
      )
        for (const half of BREEZE_HALVES) {
          const from = Math.round(Math.max(0, crest - half - piece.x) * scale);
          const to = Math.round(Math.min(piece.width, crest + half - piece.x) * scale);
          if (to <= from) continue;
          const stripe = this.breezeStripe(pool, plate);
          const { texture } = stripe;
          texture.frame.x = from;
          texture.frame.width = to - from;
          texture.update();
          stripe.visible = true;
          stripe.position.set(piece.x + from / scale, piece.y);
          stripe.width = (to - from) / scale;
          stripe.height = piece.height;
        }
    }
    for (const pool of this.breezePools.values())
      for (let i = pool.used; i < pool.stripes.length; i++) {
        const stripe = pool.stripes[i];
        if (stripe) stripe.visible = false;
      }
  }

  /**
   * The next stripe of a plate's pool. Each owns a full-height crop Texture on
   * the plate's source and moves its frame in place, so a frame builds no GPU
   * texture: one is made only when the pool first grows or the plate's page
   * reloads. The crop is a plain view, so the one it replaces goes with the
   * page's destroyed source and needs no destroy of its own.
   */
  private breezeStripe(pool: BreezePool, plate: Texture): Sprite {
    let stripe = pool.stripes[pool.used++];
    if (!stripe) {
      stripe = new Sprite();
      stripe.blendMode = 'add';
      stripe.alpha = 0.05;
      this.breeze.addChild(stripe);
      pool.stripes.push(stripe);
    }
    if (stripe.texture.source !== plate.source)
      stripe.texture = new Texture({
        source: plate.source,
        frame: new Rectangle(0, 0, 1, plate.height),
        dynamic: true,
      });
    return stripe;
  }

  /** The flush over every upright, only while a bird is still in the air. */
  private syncFlock(scene: MapScene | undefined, view: MapView): void {
    const flock = scene?.flock;
    // The page is asked for once per scene, so it is in by the time a fight opens.
    if (flock !== this.flock) {
      this.flock = flock;
      if (flock) sceneImage(flockFrame(flock, 0));
    }
    const elapsed = flushElapsed(view);
    const birds =
      flock && elapsed >= 0
        ? flockAt(
            flock,
            scene.scenery.filter((piece) => piece.wind),
            elapsed,
          )
        : [];
    while (this.flockLayer.children.length < birds.length) {
      const sprite = new Sprite();
      sprite.anchor.set(0.5);
      this.flockLayer.addChild(sprite);
    }
    this.flockLayer.children.forEach((child, index) => {
      const bird = birds[index];
      const texture = bird && flock ? this.sceneTextures.get(flockFrame(flock, bird.frame)) : null;
      child.visible = Boolean(texture);
      if (!bird || !flock || !texture || !(child instanceof Sprite)) return;
      child.texture = texture;
      child.position.set(bird.x, bird.y);
      child.width = child.height = flock.size;
      child.rotation = bird.angle;
      child.alpha = bird.alpha;
    });
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
    const stack = this.groundStack;
    const first = stack.getChildIndex(this.backdropSprite) + 1;
    for (const [offset, layer] of layers.entries()) stack.setChildIndex(layer, first + offset);
  }

  /** Both baked passes share a grid cache, so one grid change invalidates both sprite buckets. */
  private syncDecorGrid(grid: MapView['grid']): boolean {
    const changed = this.decor.sync(grid, this.lifted);
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
      uSteamRegion: number;
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
    uniforms.uSteamRegion = view.obscuringTiles !== undefined ? 1 : 0;
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
    overlay.uSteamRegion = uniforms.uSteamRegion;
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
    const dry = grid.tiles.map((tile, i) =>
      paintedWaterIsDry(view, painted, tile, { x: i % grid.width, y: Math.floor(i / grid.width) }),
    );
    const bits = (flags: boolean[]) => flags.map((value) => (value ? '1' : '0')).join('');
    let signature = `${grid.width}x${grid.height}:${bits(baked)}:${bits(dry)}`;
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
      image.data[o] =
        ((TERRAIN_INDEX[tile.terrain] ?? 0) + (dry[i] ? DRY_PATCH_TERRAIN_OFFSET : 0)) * 8 +
        surface;
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

  private syncDecor(
    view: MapView,
    camera: Camera,
    mode: 'none' | 'full' | 'seams',
    ready: boolean,
  ): void {
    this.decorLayer.visible = mode !== 'none';
    if (mode === 'none') return;
    const grid = view.grid;
    // A seams bake drops the cells whose art is painted, and the accessibility
    // overlays bring their joins back, so both key the chunks as the mode does.
    const bake = `${mode}|${ready && !view.hatch ? 1 : 0}`;
    const changed = this.syncDecorGrid(grid) || this.decorMode !== bake;
    this.decorMode = bake;
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
        sprite.texture = this.texture(this.decor.get(grid, cx, cy, px, mode, view, ready));
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
    this.drawObscurement(view, g);

    if (!view.crispOverlays) {
      this.drawContourOverlays(view);
    } else
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
    this.drawCliffCues(view);
  }

  /** Warm, ground-hugging tactical veil and board-bounded sand weather. */
  private drawObscurement(view: MapView, g: Graphics): void {
    const tiles = view.obscuringTiles;
    if (tiles && tiles.length > 0) {
      let loops = this.obscuringLoops.get(tiles);
      if (!loops) {
        loops = contourLoops(tiles);
        this.obscuringLoops.set(tiles, loops);
      }
      const fill = view.crispOverlays ? OVERLAY.obscurementVeilContrast : OVERLAY.obscurementVeil;
      const edge = view.crispOverlays ? OVERLAY.obscurementEdgeContrast : OVERLAY.obscurementEdge;
      const holes = loops.filter(isHole);
      for (const outer of loops.filter((loop) => !isHole(loop))) {
        g.poly(flatten(outer), true);
        for (const hole of holes) {
          const probe = hole[0];
          if (probe && insideLoop(probe, outer)) g.poly(flatten(hole), true).cut();
        }
        g.fill({ color: fill });
      }
      for (const loop of loops) {
        for (let band = 3; band >= 1; band--) {
          g.poly(flatten(loop), true).stroke({
            width: TILE * band * 0.04,
            color: edge,
            alpha: 0.12,
            join: 'round',
          });
        }
        g.poly(flatten(loop), true).stroke({
          width: Math.max(1, TILE * (view.crispOverlays ? 0.032 : 0.018)),
          color: edge,
          join: 'round',
        });
      }
    }
    const moving = view.reducedMotion ? 0 : view.time * 0.000018;
    const weather = view.weatherIntensity ?? 0;
    if (weather > 0) {
      const width = view.grid.width * TILE;
      const height = view.grid.height * TILE;
      g.rect(0, 0, width, height).fill({
        color: OVERLAY.sandHaze,
        alpha: weather === 2 ? 1 : 0.58,
      });
      const count = weather === 2 ? 96 : 52;
      for (let i = 0; i < count; i++) {
        const phase = i * 0.754877666;
        const x = ((((phase + moving * (weather + 1)) % 1) + 1) % 1) * (width - TILE * 0.32);
        const travel = (moving * (weather + 1) * width * 0.22) / height;
        const y =
          TILE * 0.08 + ((((i * 0.56984029 - travel) % 1) + 1) % 1) * (height - TILE * 0.16);
        const length = TILE * (0.11 + ((i * 7) % 5) * 0.018);
        g.moveTo(x, y).lineTo(x + length, y - length * 0.22);
        g.moveTo(x + length * 0.3, y + TILE * 0.035).lineTo(x + length * 0.4, y + TILE * 0.032);
      }
      g.stroke({
        width: Math.max(1, TILE * 0.022),
        color: OVERLAY.sandWisp,
        alpha: weather === 2 ? 1 : 0.66,
      });
    }
  }

  /** A capped sprite pool using the one cached procedural puff shared with Canvas. */
  private drawSteamPuffs(view: MapView, camera: Camera): void {
    const tiles = view.obscuringTiles ?? [];
    const count = Math.min(128, tiles.length * 4);
    const texture = count > 0 ? this.texture(steamPuffCanvas()) : Texture.EMPTY;
    while (this.steamPuffs.length < count) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      this.steamPuffs.push(sprite);
      this.steamLayer.addChild(sprite);
    }
    const clock = view.reducedMotion ? 0 : view.time * 0.000035;
    for (let i = 0; i < this.steamPuffs.length; i++) {
      const sprite = this.steamPuffs[i];
      const tile = tiles[Math.floor(i / 4)];
      if (!sprite || !tile || i >= count) {
        if (sprite) sprite.visible = false;
        continue;
      }
      const j = i % 4;
      const seed = steamSeed(tile.x, tile.y, j);
      const phase = (seed + clock) % 1;
      // Same footprint projection as Camera, without temporary points per puff.
      const oblique = camera.projection === 'oblique';
      const cx = (oblique ? tile.x - tile.y + view.grid.height : tile.x + 0.5) * TILE;
      const cy = (oblique ? (tile.x + tile.y + 1) / 2 : tile.y + 0.5) * TILE;
      const rise = 0.02 + (j % 2) * 0.08 + seed * 0.05;
      const drift = view.reducedMotion ? 0 : (phase - 0.5) * TILE * 0.12;
      const size = TILE * (0.66 + seed * 0.24);
      const height = size * (0.9 + seed * 0.15);
      // The soft base sits on this cell; only the upper billows rise above it.
      sprite.texture = texture;
      sprite.position.set(
        cx + TILE * (-0.26 + j * 0.17 + (seed - 0.5) * 0.16) + drift,
        cy +
          TILE * 0.28 -
          liftAt(view.grid, tile, camera.projection) * TILE -
          height * 0.38 -
          rise * TILE -
          (view.reducedMotion ? 0 : (phase - 0.5) * TILE * 0.16),
      );
      sprite.width = size;
      sprite.height = height;
      sprite.alpha = view.reducedMotion
        ? view.crispOverlays
          ? 0.9
          : 0.65
        : (view.crispOverlays ? 0.95 : 0.72) * Math.sin(phase * Math.PI);
      sprite.visible = true;
    }
  }

  private drawCliffCues(view: MapView): void {
    const g = this.overlayGfx;
    const tangent = TILE * 0.08;
    const normal = TILE * 0.1;
    const inset = TILE * 0.03;
    for (const edge of view.cliffEdges ?? []) {
      const horizontal = edge.side === 'north' || edge.side === 'south';
      const x = edge.pos.x * TILE + (edge.side === 'east' ? TILE : 0);
      const y = edge.pos.y * TILE + (edge.side === 'south' ? TILE : 0);
      for (let step = 0.1; step < 1; step += 0.2) {
        if (horizontal) {
          // The hatch belongs to the higher tile's lip. Keep its normal
          // component on that tile instead of spilling onto the lower ground.
          const inward = edge.side === 'south' ? -1 : 1;
          g.moveTo(x + TILE * step - tangent, y + inward * inset).lineTo(
            x + TILE * step + tangent,
            y + inward * (inset + normal),
          );
        } else {
          const inward = edge.side === 'east' ? -1 : 1;
          g.moveTo(x + inward * inset, y + TILE * step - tangent).lineTo(
            x + inward * (inset + normal),
            y + TILE * step + tangent,
          );
        }
      }
    }
    g.stroke({ width: Math.max(2, TILE * 0.045), color: OVERLAY.cliffHatch });
  }

  /** Upright ground cues, projected but never ground-skewed. */
  private drawClimbMarkers(view: MapView, camera: Camera): void {
    const g = this.climbGfx;
    g.clear();
    const climbMarkers = view.climbMarkers ?? [];
    climbMarkers.forEach((marker, index) => {
      // Start from the tile box, like Canvas; spriteBox is an actor-foot
      // anchor and sits substantially higher on the oblique board.
      const top = camera.toScreen(marker.pos);
      const box = {
        x: (top.x + camera.offsetX) / camera.scale,
        y: (top.y + camera.offsetY) / camera.scale,
      };
      const cx = box.x + TILE * 0.4;
      const cy = box.y - liftAt(view.grid, marker.pos, camera.projection) * TILE + TILE * 0.72;
      const arrow = [
        cx - TILE * 0.1,
        cy + TILE * 0.07,
        cx,
        cy - TILE * 0.1,
        cx + TILE * 0.1,
        cy + TILE * 0.07,
      ];
      g.poly(arrow, true)
        .stroke({
          width: Math.max(3 / camera.scale, TILE * 0.065),
          color: OVERLAY.pathUnder,
        })
        .fill({ color: OVERLAY.climb });
      const label = this.climbLabel(index);
      const text = `+${marker.surcharge}`;
      if (label.text !== text) label.text = text;
      label.position.set(cx + TILE * 0.2, cy);
      label.visible = true;
    });
    for (let i = climbMarkers.length; i < this.climbLabels.length; i++) {
      const label = this.climbLabels[i];
      if (label) label.visible = false;
    }
  }

  /** The target cue stays in the post-unit labels pass. */
  private drawTargetReticle(view: MapView, camera: Camera): void {
    const g = this.fxGfx;
    const cue = view.targetReticle;
    if (!cue) return;
    const target = view.units.find((unit) =>
      footprintCells(unit.pos, unit.size, this.squareFootprints).some(
        (cell) => cell.x === cue.pos.x && cell.y === cue.pos.y,
      ),
    );
    const pos = target?.renderPos ?? target?.pos ?? cue.pos;
    const screen = camera.spriteBox(pos, target?.size ?? 1, this.squareFootprints);
    const heightTiles = this.squareFootprints ? (target?.size ?? 1) : 1;
    const scale = target?.scale ?? 1;
    const frame =
      this.squareFootprints && target
        ? (target.bend
            ? sheets.bendFrame(target.sprite, target.bend.heading, target.bend.index)
            : null) ||
          sheets.frame(
            target.sprite,
            target.clip ?? 'idle',
            target.clipTime ?? view.time + idlePhase(target.id),
            target.clipFrame,
            this.spritePx(camera) * scale,
            target.size,
            target.meleeDirection,
            heightTiles,
          )
        : null;
    const box = {
      x: (screen.x + camera.offsetX) / camera.scale,
      y: (screen.y + camera.offsetY) / camera.scale,
    };
    const cx = actorReticleX(
      { ...box, size: TILE, width: (target?.size ?? 1) * TILE },
      scale,
      target?.size ?? 1,
    );
    const lift = liftAlong(view.grid, pos, camera.projection);
    const silhouette = actorSilhouetteGeometry(
      { x: box.x, y: box.y - lift * TILE, size: TILE },
      heightTiles,
      this.squareFootprints ? (frame?.headroom ?? null) : null,
      scale,
    );
    const cy = this.squareFootprints ? silhouette.reticleY : box.y - lift * TILE - TILE * 0.04;
    const outline = Math.max(3 / camera.scale, TILE * 0.065);
    if (cue.elevation) {
      const direction = cue.elevation === 'above' ? -1 : 1;
      g.poly(
        [
          cx - TILE * 0.13,
          cy - direction * TILE * 0.08,
          cx,
          cy + direction * TILE * 0.13,
          cx + TILE * 0.13,
          cy - direction * TILE * 0.08,
        ],
        true,
      )
        .stroke({ width: outline, color: OVERLAY.pathUnder })
        .fill({ color: OVERLAY.reticleCue });
    }
    if (cue.obscured) {
      const cloudX = cx + TILE * 0.27;
      const cloudY = cy;
      g.circle(cloudX - TILE * 0.06, cloudY, TILE * 0.075)
        .circle(cloudX + TILE * 0.03, cloudY - TILE * 0.025, TILE * 0.095)
        .circle(cloudX + TILE * 0.12, cloudY, TILE * 0.065)
        .rect(cloudX - TILE * 0.12, cloudY, TILE * 0.25, TILE * 0.07)
        .stroke({ width: outline, color: OVERLAY.pathUnder })
        .fill({ color: OVERLAY.reticleCue });
    }
  }

  private climbLabel(index: number): Text {
    let text = this.climbLabels[index];
    if (!text) {
      text = new Text({
        text: '',
        style: CLIMB_LABEL_STYLE,
      });
      text.anchor.set(0.5);
      this.climbLabels[index] = text;
      this.climbLabelLayer.addChild(text);
    }
    return text;
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
  private frameTexture(frame: Pick<ResolvedFrame, 'source' | 'frame'>): Texture {
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
    const depth = (pos: Vec2, footprint: 1 | 2 = 1, square = this.squareFootprints) =>
      pixiActorDepth(camera, pos, footprint, square);
    const ordered = [...view.units].sort(
      (a, b) => depth(a.renderPos ?? a.pos, a.size) - depth(b.renderPos ?? b.pos, b.size),
    );
    const box = (pos: Vec2, footprint: 1 | 2 = 1) => {
      const screen = camera.spriteBox(pos, footprint, this.squareFootprints);
      return {
        x: (screen.x + camera.offsetX) / camera.scale,
        y: (screen.y + camera.offsetY) / camera.scale,
      };
    };

    let badgeIndex = 0;
    const pendingHealthBars: (HealthBarPlacement & {
      readonly unit: RenderUnit;
      readonly actorX: number;
    })[] = [];

    for (const npc of view.npcs) {
      // Keyed by who, not where: a walking resident keeps one sprite (ADR 0047 §7).
      const key = `npc:${npc.id}`;
      const alpha = npc.alpha ?? 1;
      if (alpha <= 0) continue;
      live.add(key);
      const sprite = this.unitSprite(key);
      const entry = resolveAsset(npc.sprite);
      const width = entry.kind === 'sheet' && entry.footprint.w === 2 ? 2 : 1;
      const scale = npc.scale ?? 1;
      const poseScale = npc.poseScale ?? 1;
      const facing = npc.facing ?? 1;
      const at = npc.renderPos ?? npc.pos;
      const frame =
        entry.kind === 'sheet'
          ? sheets.frame(
              npc.sprite,
              npc.walking ? 'walk' : 'idle',
              npc.clipTime ?? 0,
              undefined,
              px * scale,
              width,
            )
          : null;
      const screen = camera.spriteBox(at, width, false);
      const anchor = {
        x: (screen.x + camera.offsetX) / camera.scale,
        y: (screen.y + camera.offsetY) / camera.scale,
      };
      const x = anchor.x;
      const ground = anchor.y - liftAlong(view.grid, at, camera.projection) * TILE;
      // The walk bob lifts the figure; its contact shadow stays on the ground.
      const rawLift = (npc.offset?.y ?? 0) * TILE;
      const liftScale = camera.scale * this.viewport.dpr;
      const y = ground + Math.round(rawLift * liftScale) / liftScale;
      const footX = x + (width * TILE) / 2;
      sprite.zIndex = depth(at, width, false);
      if (frame) {
        sprite.texture = this.frameTexture(frame);
        sprite.anchor.set(frame.anchor.x, frame.anchor.y);
        sprite.position.set(footX, y + FOOT_LINE * TILE);
        sprite.width = (frame.frame.w / frame.pixelsPerTile) * TILE * scale * poseScale;
        sprite.height = (frame.frame.h / frame.pixelsPerTile) * TILE * scale * poseScale;
      } else {
        sprite.texture = this.texture(sprites.get(npc.sprite, px * scale, npcPose(npc), width));
        sprite.anchor.set(0.5, FOOT_LINE);
        sprite.position.set(footX, y + FOOT_LINE * TILE);
        sprite.width = width * TILE * scale * poseScale;
        sprite.height = TILE * scale * poseScale;
      }
      sprite.scale.x = Math.abs(sprite.scale.x) * facing;
      sprite.rotation = npc.lean ?? 0;
      sprite.alpha = alpha;
      sprite.visible = true;
      this.projectDynamicShadow(
        `npc:${npc.id}`,
        sprite,
        { x: footX, y: y + FOOT_LINE * TILE },
        alpha,
      );
      if (entry.kind === 'image') {
        const shadowKey = `shadow:${npc.id}`;
        live.add(shadowKey);
        const shadow = this.unitSprite(shadowKey);
        const density = actorShadowDensity(view.grid, at, true, width, false);
        shadow.texture = this.texture(sprites.shadow(px * scale, density));
        shadow.anchor.set(0.5, 0.86);
        shadow.position.set(footX, ground + FOOT_LINE * TILE);
        shadow.width = shadow.height = TILE * scale;
        shadow.alpha = alpha;
        shadow.zIndex = shadowZ(sprite.zIndex);
        shadow.visible = true;
      }

      // A small "talk" pip so a child can tell an NPC from scenery.
      if (!npc.quiet)
        g.circle(
          x + TILE * width * 0.5,
          y + TILE * (FOOT_LINE - (FOOT_LINE - 0.08) * scale),
          TILE * 0.07,
        ).fill({
          color: '#f0c674',
          alpha: alpha * (0.55 + 0.35 * ((Math.sin(view.time / 500) + 1) / 2)),
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
        anchor.y - liftAt(view.grid, prop.pos, camera.projection) * TILE,
      );
      sprite.zIndex = depth(prop.pos);
      sprite.width = TILE;
      sprite.height = TILE;
      sprite.alpha = 1;
      sprite.visible = true;
      if (prop.burning && castShadowStrength(prop.castShadow) > 0)
        this.projectDynamicShadow(
          `prop:${prop.id}`,
          sprite,
          { x: anchor.x + TILE / 2, y: sprite.y + FOOT_LINE * TILE },
          castShadowStrength(prop.castShadow),
        );

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
      const lift = liftAlong(view.grid, pos, camera.projection);
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
      const heightTiles = this.squareFootprints ? unit.size : 1;
      const facing = unit.facing ?? (unit.faction === 'enemy' ? -1 : 1);
      const asset = resolveAsset(unit.sprite);
      const locomotion = unit.clip ?? 'idle';
      const drawFacing =
        asset.kind === 'sheet' && asset.facing === 'both' && authoredForBothSides(locomotion)
          ? 1
          : facing;

      live.add(unit.id);
      const sprite = this.unitSprite(unit.id);
      // A pose scales about the feet; the fallen fade sits on top of any alpha.
      const alpha = (unit.alpha ?? 1) * fallenAlpha(unit);
      const shadowDensity = actorShadowDensity(
        view.grid,
        pos,
        unit.shadow === true,
        unit.size,
        this.squareFootprints,
      );
      if (shadowDensity > 0) {
        // On the ground, not on the bob (explore maps, ADR 0015; grass, canvas2d.ts).
        const key = `shadow:${unit.id}`;
        live.add(key);
        const shadow = this.unitSprite(key);
        shadow.texture = this.texture(sprites.shadow(px * (unit.scale ?? 1), shadowDensity));
        shadow.anchor.set(0.5, 0.86);
        const footprint = this.squareFootprints ? unit.size : 1;
        shadow.position.set(
          anchor.x + width / 2,
          anchor.y + (0.86 - lift - (footprint - 1) * 0.5) * TILE,
        );
        // Keep a square unit's contact shadow on its rules footprint even when
        // its upright cel has projection-specific presentation compensation.
        const shadowScale = this.squareFootprints && unit.size === 2 ? 1 : (unit.scale ?? 1);
        shadow.width = shadow.height = TILE * shadowScale * footprint;
        shadow.alpha = alpha;
        shadow.zIndex = shadowZ(depth(pos, unit.size));
        shadow.visible = true;
      }
      const scale = unit.scale ?? 1;
      // The frame comes from the unit's sheet, real or baked from its painter
      // at the zoom's bucket (ADR 0003); the anchor stands on the foot line.
      // A bend cel (ADR 0055) stands by its heading's own anchor and is never mirrored.
      const bend = unit.bend && sheets.bendFrame(unit.sprite, unit.bend.heading, unit.bend.index);
      const frame =
        bend ||
        sheets.frame(
          unit.sprite,
          unit.clip ?? 'idle',
          unit.clipTime ?? view.time + idlePhase(unit.id),
          unit.clipFrame,
          px * scale,
          unit.size,
          unit.meleeDirection,
          heightTiles,
        );
      const silhouette = actorSilhouetteGeometry(
        { x, y, size: TILE, width },
        heightTiles,
        frame?.headroom ?? null,
        scale,
        26 / camera.scale,
      );
      if (frame) {
        sprite.texture = this.frameTexture(frame);
        sprite.anchor.set(frame.anchor.x, frame.anchor.y);
        sprite.position.set(x + width / 2, y + FOOT_LINE * TILE);
        const placed = placeFrame(frame, 0, 0, TILE * scale);
        sprite.width = placed.w;
        sprite.height = placed.h;
        sprite.scale.x = Math.abs(sprite.scale.x) * (bend ? 1 : drawFacing);
      } else {
        sprite.texture = this.texture(
          sprites.get(unit.sprite, px * scale, { facing }, unit.size, heightTiles),
        );
        sprite.anchor.set(0, 0);
        const drawWidth = width * scale;
        const drawHeight = TILE * heightTiles * scale;
        sprite.position.set(x + (width - drawWidth) / 2, y + FOOT_LINE * (TILE - drawHeight));
        sprite.width = drawWidth;
        sprite.height = drawHeight;
        sprite.scale.x = Math.abs(sprite.scale.x);
      }
      sprite.alpha = alpha;
      sprite.visible = true;
      sprite.zIndex = depth(pos, unit.size);
      const castStrength = castShadowStrength(unit.castShadow);
      if (castStrength > 0)
        this.projectDynamicShadow(
          `unit:${unit.id}`,
          sprite,
          { x: x + width / 2, y: y + FOOT_LINE * TILE },
          castStrength * (unit.alpha ?? 1) * (unit.fallen ? FALLEN_SHADOW_ALPHA : 1),
        );

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
          .ellipse(
            marker.x + width / 2,
            marker.y + (0.86 - (heightTiles - 1) * 0.5) * TILE,
            width * 0.42,
            TILE * heightTiles * 0.14,
          )
          .stroke({
            width: Math.max(2, TILE * 0.06),
            color: OVERLAY.active,
            alpha: 0.75 + 0.25 * ((Math.sin(view.time / 300) + 1) / 2),
          });
      } else if (unit.id === view.selectedUnitId) {
        rings
          .ellipse(
            marker.x + width / 2,
            marker.y + (0.86 - (heightTiles - 1) * 0.5) * TILE,
            width * 0.4,
            TILE * heightTiles * 0.12,
          )
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

      if (unit.showHealth !== false)
        pendingHealthBars.push({ id: unit.id, unit, bar: silhouette.bar, actorX: x });
      badgeIndex = this.drawStatusBadges(g, unit, x, width, badgeIndex, silhouette.badgeY);
    }

    for (const [key, sprite] of this.unitSprites) {
      if (!live.has(key)) sprite.visible = false;
    }
    for (let i = badgeIndex; i < this.badgeText.length; i++) {
      const text = this.badgeText[i];
      if (text) text.visible = false;
    }
    const placements = this.healthBarStagger.place(pendingHealthBars);
    for (const candidate of pendingHealthBars) {
      const bar = placements.get(candidate.id);
      if (bar)
        this.drawHealthBar(g, candidate.unit, bar, candidate.actorX, view.hatch, camera.scale);
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
    bar: ReturnType<typeof actorSilhouetteGeometry>['bar'],
    actorX: number,
    hatch: boolean,
    /** CSS px per world unit (the camera scale), so the cap keeps its minimum. */
    cssScale: number,
  ): void {
    const fraction = Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
    const { x: barX, y: barY, width: barWidth, height: barHeight } = bar;

    // An ink-framed track, filled in the unit's side colour (canvas2d.ts matches).
    g.rect(barX, barY, barWidth, barHeight).fill({ color: HP_COLORS.back });
    g.rect(barX, barY, barWidth * fraction, barHeight).fill({
      color: hpFill(unit.faction, fraction, hatch),
    });
    g.rect(barX - 0.5, barY - 0.5, barWidth + 1, barHeight + 1).stroke({
      width: 1,
      color: HP_COLORS.frame,
    });

    // The side's cap, so the bar reads by shape as well as colour.
    const cap = healthBarCap(bar, HP_CAP[unit.faction], actorX, 1 / cssScale);
    if (cap.length === 0) return;
    g.poly(cap)
      .fill({ color: hpFill(unit.faction, 1, hatch) })
      .stroke({ width: 1, color: HP_COLORS.frame });
  }

  private drawStatusBadges(
    g: Graphics,
    unit: RenderUnit,
    x: number,
    width: number,
    startIndex: number,
    badgeY: number,
  ): number {
    if (unit.statuses.length === 0) return startIndex;
    const radius = Math.max(4, TILE * 0.09);
    const shown = unit.statuses.slice(0, 4);
    const totalWidth = shown.length * radius * 2.2;
    let bx = x + width / 2 - totalWidth / 2 + radius;
    const by = badgeY;
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
      // Scaled rather than re-sized, so the pop never rebuilds the glyphs.
      text.scale.set(floaterScale(floater.progress, floater.emphasis));
      text.visible = true;
    });

    for (let i = view.floaters.length; i < this.floaters.length; i++) {
      const text = this.floaters[i];
      if (text) text.visible = false;
    }
  }
}
