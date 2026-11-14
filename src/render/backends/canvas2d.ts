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

import type { Grid, MapScene, SceneFlock, SceneImage, Vec2 } from '../../core/types';
import { SQUARE_FOOTPRINTS, footprintCells } from '../../core/rules/footprint';
import { authoredForBothSides, headingClip, type Heading } from '../../content/assets/clips';
import { resolveAsset } from '../../content/assets/manifest';
import { TILE } from '../camera';
import { drawsScene } from '../projection';
import type { Viewport, Camera } from '../camera';
import type { TileRelief } from '../geometry/board';
import { boardRelief, decorSignature, surfaceEdges } from '../geometry/board';
import { contourLoops, traceRegions } from '../geometry/contour';
import {
  activeGroundCue,
  actorReticleX,
  actorSilhouetteGeometry,
  combatActorSilhouetteScreenGeometry,
  fallbackBarTop,
  floaterOwner,
  floaterStartY,
  healthBarCap,
  HealthBarStagger,
} from '../geometry/actorSilhouette';
import type { HealthBarPlacement } from '../geometry/actorSilhouette';
import { resolveActorEmitters } from '../geometry/actorAttachments';
import type { Curve } from '../geometry/curve';
import { smoothPath } from '../geometry/curve';
import { CanvasFxLayer } from '../fx/canvasFx';
import { steamPuffCanvas, steamSeed } from '../fx/steamPuff';
import { drawBendFx } from '../fx/bendFxDraw';
import { backdrops } from '../backdrops';
import { sceneForGrid, sceneImage, drawSceneImage, sceneryOpacities } from '../scene';
import { drawArt } from '../pixelSampling';
import { propShadows, rgbaCanvas, topdownPropArt } from '../topdown/propLayer';
import { drawsWash, washLayer } from '../topdown/wash';
import {
  drawsOrganicSurfaces,
  flameFoot,
  flames,
  organicOwns,
  puffRows,
  surfaceArt,
  surfaceCanvases,
} from '../topdown/surfaceLayer';
import { flameCel, glowAlpha, steamPuff, type SurfaceArt } from '../topdown/surfaces';
import { withStructures } from '../topdown/structures';
import { PixelMarkDrawableCache, pixelMarkCanvas } from '../pixelMarkDrawables';
import { drawCanvasPixelMark, resolvePixelMarkDraws } from '../pixelMarkRendering';
import {
  aimArcPixelMarks,
  boardPixelFromTile,
  cueOpacity,
  exitMark,
  healthBarSpikeMark,
  hoverCalmMark,
  koCrossMark,
  overlayPixelMarks,
  pathPixelMarks,
  screenToBoardPixel,
  selectedRingMark,
  talkPipMark,
  targetReticleMark,
} from '../pixelOverlayGeometry';
import type { PixelOverlayCue } from '../pixelOverlayGeometry';
import { RevealLayer, revealBox, revealsUnit } from '../reveal';
import type { RevealFigure } from '../reveal';
import { flockAt, flockFrame, flushElapsed, sway } from '../living/wind';
import { paintedWaterIsDry, surfaceIsPainted } from '../sceneSurfaces';
import { HP_CAP, HP_COLORS, MAP_MARGIN_COLORS, OVERLAY, STATUS_BADGE, hpFill } from '../palettes';
import { paintTileDecor } from '../painters/board';
import { paintFloatingNumber } from '../painters/fx';
import { FOOT_LINE } from '../sheets/bake';
import { placeFrame } from '../sheets/placement';
import { idlePhase, sheets } from '../sheets/store';
import { paintGridLine, paintSurface, paintTerrain } from '../painters/tiles';
import { npcPose, sprites } from '../spriteCache';
import { npcPipLift } from '../npcPip';
import {
  FLOATER_TEXT_SCALE,
  fallenAlpha,
  floaterScale,
  npcClip,
  unitMarkerGroundPoint,
  type AimArc,
  type MapView,
  type OverlayKind,
  type OverlayLayer,
  type RenderUnit,
} from '../view';
import type { BackendCapabilities, RenderBackend } from './backend';
import { boardDepth, compareRenderedDepth } from './depthOrder';
import { footprintFoot } from '../../core/rules/footprint';
import { groundedCastArt } from '../groundedCastArt';
import {
  TOPDOWN_FEET_WIDTH,
  feetBlobArt,
  figureShadowArt,
  poolOffset,
  soleContactArt,
  topdownFeetLevel,
} from '../figureShadowArt';
import {
  drillerGroundingArt,
  drillerGroundingGeometry,
  drillerGroundingPose,
} from '../drillerGrounding';
import { restingClip } from '../sheets/feet';
import type { ResolvedFrame } from '../sheets/store';
import {
  CONTACT_LINE,
  DEFAULT_ACTOR_GROUNDING,
  FALLEN_SHADOW_ALPHA,
  actorGrounding,
  castShadowStrength,
  contactBand,
  inkColor,
  type ShadowGrid,
  shadowGrid,
} from '../lighting';

/** Canvas ordering point, exported so parity can be tested without a drawing context. */
export function canvasActorDepth(
  camera: Camera,
  pos: Vec2,
  size: 1 | 2,
  square = SQUARE_FOOTPRINTS,
): number {
  return boardDepth(camera.groundPoint(footprintFoot(pos, size, square)), camera.projection);
}

/** How far in from the board's edge the shading reaches, in tiles. */
export const EDGE_SHADE_TILES = 1.4;
export const EDGE_SHADE_ALPHA = 0.42;
export const VIGNETTE_ALPHA = 0.3;

/** The cels a figure's ground shadow reads: the one drawn (its soles' contact) and its heading's resting idle (its pool). */
interface FigureCels {
  readonly drawn: Pick<ResolvedFrame, 'frame' | 'anchor' | 'pixelsPerTile' | 'feet'> | null;
  readonly resting: ResolvedFrame | null;
  /** Whether the body is mirrored about its foot. */
  readonly flip: boolean;
  /** The figure's drawn scale (with any pose scale). */
  readonly scale: number;
  readonly driller?: {
    readonly frame: ResolvedFrame | null;
    readonly heading: Heading;
    readonly mirror: boolean;
  };
}

export class Canvas2DBackend implements RenderBackend {
  readonly capabilities: BackendCapabilities = { name: 'canvas', shaders: false, particles: false };

  private ctx: CanvasRenderingContext2D;
  private pixelMarkDrawables = new PixelMarkDrawableCache(pixelMarkCanvas);
  private healthBarStagger = new HealthBarStagger();
  /** Top edge of each unit's bar this frame (as drawn, staggered): floating numbers start above it. */
  private barTops = new Map<string, number>();
  /** Party frames drawn this pass, for the silhouettes over the pieces that hide them (ADR 0096). */
  private revealFigures: RevealFigure[] = [];
  private reveal: RevealLayer | null = null;
  private pendingHealthBars: (HealthBarPlacement & {
    readonly unit: RenderUnit;
    readonly actorX: number;
    readonly hatch: boolean;
  })[] = [];
  /**
   * Contours per overlay layer and the curve per path, keyed by identity: the
   * scene memoises its overlays, so the same objects come back frame after
   * frame until something changes, and a WeakMap forgets them with it.
   */
  private loops = new WeakMap<OverlayLayer, Vec2[][]>();
  private squareLoops = new WeakMap<OverlayLayer, Vec2[][]>();
  /** Steam regions are memoised by the view's stable obscuring-cell array. */
  private obscuringLoops = new WeakMap<readonly Vec2[], Vec2[][]>();
  private curve: { path: readonly Vec2[]; from: Vec2; curve: Curve } | null = null;
  private fx = new CanvasFxLayer();
  /** White silhouettes of unit art, for the hit flash; forgotten with the source. */
  private masks = new WeakMap<HTMLCanvasElement | HTMLImageElement, HTMLCanvasElement>();
  /** One union mask, rebuilt each frame from every upright silhouette. */
  private shadowLayer: HTMLCanvasElement | null = null;
  /** This frame's shadow mask texels (`drawCastShadows`). */
  private shadowGridNow: ShadowGrid | null = null;
  /** This frame's scene grounding; the union is tinted at its ceiling and casters scale to it. */
  private grounding = DEFAULT_ACTOR_GROUNDING;
  /** True on the top-down board, whose figures stand on `feetBlob` rather than the swept pool. */
  private topdownFigures = false;
  /** This frame draws its surfaces as the top-down organic layer (#458). */
  private organic = false;
  /** The scene's paved cells, where a top-down feet blob is drawn at paving's strength. */
  private pavedCells: readonly Vec2[] | undefined;
  /** One caster at a time, in the exact-max path (see `castInto`). */
  private castScratch: HTMLCanvasElement | null = null;
  /** Cliffs, rims and wall outlines, rebuilt only when a tile's footing changes. */
  private relief: ReadonlyMap<number, TileRelief> = new Map();
  private reliefSignature = '';
  /** The flock whose page was last asked for, so a scene change asks once. */
  private flock: SceneFlock | undefined;

  constructor(
    private canvas: HTMLCanvasElement,
    private readonly squareFootprints = SQUARE_FOOTPRINTS,
  ) {
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
    this.pixelMarkDrawables.clear();
  }

  draw(view: MapView, camera: Camera): void {
    const { ctx } = this;
    this.pendingHealthBars = [];
    this.barTops.clear();
    const dpr = camera.viewport.dpr;
    this.pixelMarkDrawables.beginFrame();
    view = {
      ...view,
      scene: view.scene ? sceneForGrid(view.scene, view.grid) : undefined,
      emitters: resolveActorEmitters(view.emitters, camera.toScreen({ x: 0, y: 0 }).size * dpr),
    };

    this.organic = false;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, camera.viewport.width, camera.viewport.height);
    const marginTone = view.scene?.marginTone;
    if (marginTone && !view.crispOverlays) {
      ctx.fillStyle = MAP_MARGIN_COLORS[marginTone];
      ctx.fillRect(0, 0, camera.viewport.width, camera.viewport.height);
    }

    // The shake moves the world, not the clear: a knocked camera shows the
    // same margin at its edge that the fit leaves anyway.
    const tilePx = camera.toScreen({ x: 0, y: 0 }).size;
    ctx.translate(view.cameraNudge.x * tilePx, view.cameraNudge.y * tilePx);

    // A map's painting takes the terrain's place under everything else, once
    // it has loaded; the decor that marks footing over it comes back only
    // under High contrast, where the rules must read without the picture.
    const painting = view.backdrop ? backdrops.get(view.backdrop.url) : null;
    if (painting) this.drawBackdrop(painting, view, camera);
    // The raised walls and rubble heaps stand as drawings among the figures (#577).
    if (camera.projection === 'topdown') view = withStructures(view);
    // The top-down board (ADR 0104) draws its scene's plates at the identity ground transform:
    // its shadows are baked into the plates. Until every plate and piece has loaded, the
    // procedural terrain stands in.
    const scene = drawsScene(camera.projection) ? view.scene : undefined;
    let painted = painting !== null;
    let scenePainted = false;
    if (scene) {
      const ground = sceneGroundImages(scene);
      painted = sceneArtLoaded(scene, ground);
      scenePainted = painted;
      if (painted) this.drawScenePlates(ground, camera);
    }
    this.organic = drawsOrganicSurfaces(view, camera.projection);
    this.drawGround(view, camera, painted);
    if (!painted || view.crispOverlays) this.drawDecor(view, camera);
    const surfaces = this.organic ? surfaceArt(view, painted) : null;
    if (surfaces) this.drawTopdownSurfaces(surfaces, camera);
    // A painted scene runs past the grid and carries its own light, so the board-edge falloff
    // (clipped to the grid) would cut a straight band through it. Pixi skips it the same way.
    if (view.atmosphere && !scenePainted) this.drawShade(view, camera);
    if (camera.projection === 'topdown') this.drawTopdownPropShadows(view, camera);
    const wash = drawsWash(view, camera.projection);
    if (wash) this.drawTopdownWash(view, camera);
    this.drawOverlays(view, camera, camera, !wash);
    if (!surfaces) this.drawSteamPuffs(view, camera);
    if (!wash) this.drawPath(view, camera);
    if (view.aimArc) this.drawAimArc(view.aimArc, camera, view.cameraNudge);
    this.drawFxLayer(view, camera, 'under');
    this.drawExit(view, camera, view.cameraNudge);
    this.drawClimbMarkers(view, camera);
    this.drawCastShadows(view, camera);
    this.drawUnitRings(view, camera);
    drawBendFx(ctx, view.bendFx ?? [], camera, false);
    // A top-down board sorts its props, walls, flames and figures together even without a scene.
    if (scene || camera.projection === 'topdown') this.drawOccupants(view, camera, surfaces);
    else {
      this.drawNpcs(view, camera);
      this.drawProps(view, camera);
      this.drawUnits(view, camera);
    }
    if (surfaces) this.drawTopdownSteam(surfaces, camera);
    this.flushHealthBars(camera, view.cameraNudge);
    this.drawTargetReticle(view, camera);
    if (scene) this.drawFlock(view, camera);
    drawBendFx(ctx, view.bendFx ?? [], camera, true);
    this.drawFxLayer(view, camera, 'over');
    this.drawFloaters(view, camera);

    ctx.restore();
    this.pixelMarkDrawables.endFrame();
  }

  /**
   * Every upright occupant of a scene board in one depth order (`boardDepth`): the scene's scenery
   * (faded where it hides a figure), NPCs, props and units, then the reveal of party members a
   * piece covers. The top-down board draws through it.
   */
  private drawOccupants(view: MapView, camera: Camera, surfaces: SurfaceArt | null = null): void {
    const { ctx } = this;
    // All upright occupants share depth order, including NPCs and props.
    const opacities = sceneryOpacities(
      view.scene?.scenery ?? [],
      view,
      camera,
      this.squareFootprints,
    );
    const occupants = [
      ...(view.scene?.scenery ?? []).map((piece) => ({
        pos: piece.depth,
        draw: () => {
          const image = sceneImage(piece);
          if (!image) return;
          ctx.save();
          ctx.globalAlpha = opacities.get(piece) ?? 1;
          // Three held drawings of the lean, sheared about the foot.
          const lean = piece.wind && !view.reducedMotion ? sway(view.time, piece, true) : 0;
          ctx.transform(
            1,
            0,
            -lean,
            1,
            piece.x * camera.scale - camera.offsetX,
            (piece.y + piece.height) * camera.scale - camera.offsetY,
          );
          if (piece.flip) {
            // Mirrored inside its own box: the right edge becomes the left.
            ctx.translate(piece.width * camera.scale, 0);
            ctx.scale(-1, 1);
          }
          drawSceneImage(
            ctx,
            image,
            piece,
            0,
            -piece.height * camera.scale,
            piece.width * camera.scale,
            piece.height * camera.scale,
          );
          ctx.restore();
        },
      })),
      ...view.npcs.map((npc) => ({
        pos: {
          x: (npc.renderPos ?? npc.pos).x + this.npcWidth(npc.sprite) / 2,
          y: (npc.renderPos ?? npc.pos).y + 0.5,
        },
        draw: () => this.drawNpcs({ ...view, npcs: [npc] }, camera),
      })),
      ...view.props.map((prop) => ({
        pos: { x: prop.pos.x + 0.5, y: prop.pos.y + 0.5 },
        draw: () => this.drawProps({ ...view, props: [prop] }, camera),
      })),
      ...this.flameOccupants(surfaces, camera),
      ...view.units.map((unit) => ({
        pos: footprintFoot(unit.renderPos ?? unit.pos, unit.size, this.squareFootprints),
        draw: () => this.drawUnits({ ...view, units: [unit] }, camera),
      })),
    ].sort((a, b) =>
      compareRenderedDepth(
        boardDepth(camera.groundPoint(a.pos), camera.projection),
        boardDepth(camera.groundPoint(b.pos), camera.projection),
      ),
    );
    this.revealFigures = [];
    for (const occupant of occupants) occupant.draw();
    this.drawReveal(view, camera);
  }

  /** The scene's ground plates, each at its own world-px rectangle under pan and zoom only. */
  private drawScenePlates(
    ground: readonly { piece: SceneImage; image: HTMLImageElement | null }[],
    camera: Camera,
  ): void {
    for (const { piece, image } of ground) {
      if (!image) continue;
      drawSceneImage(
        this.ctx,
        image,
        piece,
        piece.x * camera.scale - camera.offsetX,
        piece.y * camera.scale - camera.offsetY,
        piece.width * camera.scale,
        piece.height * camera.scale,
      );
    }
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
  private drawGround(
    view: MapView,
    camera: Camera,
    painted: boolean,
    drawTerrain = true,
    drawSurfaces = true,
  ): void {
    const { ctx } = this;
    const bounds = this.tileBounds(view, camera);
    for (let y = bounds.y0; y <= bounds.y1; y++) {
      for (let x = bounds.x0; x <= bounds.x1; x++) {
        const tile = view.grid.tiles[y * view.grid.width + x];
        if (!tile) continue;
        const pos = { x, y };
        const box = camera.toScreen(pos);
        if (drawTerrain && !painted) paintTerrain(ctx, box, tile, pos);
        // A declared pool the rules no longer hold as water: hide the baked plate's water.
        else if (drawSurfaces && paintedWaterIsDry(view, painted, tile, pos))
          paintTerrain(ctx, box, tile, pos);
        if (
          drawSurfaces &&
          !surfaceIsPainted(view, painted, tile, pos) &&
          !organicOwns(this.organic, tile.surface?.id)
        )
          paintSurface(
            ctx,
            box,
            tile,
            pos,
            view.hatch,
            surfaceEdges(view.grid, pos),
            view.obscuringTiles !== undefined,
          );
        if (drawSurfaces && view.gridLines) paintGridLine(ctx, box, 'rgba(0,0,0,0.18)');
      }
    }
  }

  /** The cells the tile painters visit: those on screen. */
  private tileBounds(view: MapView, camera: Camera) {
    return camera.visibleBounds(view.grid);
  }

  /** The relief painters read, rebuilt only when the footing or the projection changes. */
  private syncRelief(grid: Grid): void {
    const signature = decorSignature(grid);
    if (signature === this.reliefSignature) return;
    this.reliefSignature = signature;
    this.relief = boardRelief(grid);
  }

  private drawDecor(view: MapView, camera: Camera): void {
    const { ctx } = this;
    this.syncRelief(view.grid);
    const bounds = this.tileBounds(view, camera);
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

  private drawPixelCues(
    cues: readonly PixelOverlayCue[],
    camera: Camera,
    _plane: 'ground' | 'screen',
    nudge: Vec2 = { x: 0, y: 0 },
  ): void {
    for (const draw of resolvePixelMarkDraws(camera, cues, this.pixelMarkDrawables, nudge)) {
      drawCanvasPixelMark(this.ctx, camera, draw, nudge);
    }
  }

  private drawOverlays(view: MapView, camera: Camera, markCamera = camera, cells = true): void {
    this.drawObscurement(view, camera);
    // The top-down board draws its reach, targets, area and hover as the organic layer instead.
    for (const layer of cells ? view.overlays : []) {
      if (layer.tiles.length === 0) continue;
      const cache = view.crispOverlays ? this.squareLoops : this.loops;
      let loops = cache.get(layer);
      if (!loops) {
        loops = view.crispOverlays ? traceRegions(layer.tiles) : contourLoops(layer.tiles);
        cache.set(layer, loops);
      }
      this.drawPixelCues(
        overlayPixelMarks(`overlay:${layer.kind}`, layer.kind, loops, markCamera, overlayColors),
        markCamera,
        'ground',
        view.cameraNudge,
      );
    }

    if (cells && view.hoverTile) {
      const cues =
        view.crispOverlays && view.calmPath && view.path.length > 0
          ? [hoverCalmMark(view.hoverTile, markCamera)]
          : overlayPixelMarks(
              'hover',
              'hover',
              traceRegions([view.hoverTile]),
              markCamera,
              overlayColors,
            );
      this.drawPixelCues(cues, markCamera, 'ground', view.cameraNudge);
    }
    this.drawCliffCues(view, camera);
  }

  /** Combat-only warm veil traced around the whole steam region. */
  private drawObscurement(view: MapView, camera: Camera): void {
    const ctx = this.ctx;
    const tiles = view.obscuringTiles;
    if (tiles && tiles.length > 0) {
      let loops = this.obscuringLoops.get(tiles);
      if (!loops) {
        loops = contourLoops(tiles);
        this.obscuringLoops.set(tiles, loops);
      }
      const origin = camera.toScreen({ x: 0, y: 0 });
      const size = origin.size;
      ctx.save();
      ctx.beginPath();
      for (const loop of loops) tracePolygon(ctx, loop, origin, size);
      // One rounded footprint, including holes, without internal cell seams.
      ctx.fillStyle = view.crispOverlays
        ? OVERLAY.obscurementVeilContrast
        : OVERLAY.obscurementVeil;
      ctx.fill('evenodd');
      ctx.lineJoin = 'round';
      ctx.strokeStyle = view.crispOverlays
        ? OVERLAY.obscurementEdgeContrast
        : OVERLAY.obscurementEdge;
      for (let band = 3; band >= 1; band--) {
        ctx.globalAlpha = 0.12;
        ctx.lineWidth = size * band * 0.04;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(1, size * (view.crispOverlays ? 0.032 : 0.018));
      ctx.stroke();
      ctx.restore();
    }

    const intensity = view.weatherIntensity ?? 0;
    if (intensity > 0) {
      const origin = camera.toScreen({ x: 0, y: 0 });
      const width = view.grid.width * origin.size;
      const height = view.grid.height * origin.size;
      ctx.save();
      ctx.beginPath();
      ctx.rect(origin.x, origin.y, width, height);
      ctx.clip();
      ctx.fillStyle = OVERLAY.sandHaze;
      ctx.globalAlpha = intensity === 2 ? 1 : 0.58;
      ctx.fillRect(origin.x, origin.y, width, height);

      // Fixed, short diagonal grains suggest one prevailing wind direction.
      // They are built into one path and clipped to the board on every draw.
      const count = Math.min(
        intensity === 2 ? 96 : 52,
        Math.max(
          12,
          Math.ceil(view.grid.width * view.grid.height * (intensity === 2 ? 0.4 : 0.22)),
        ),
      );
      const columns = Math.max(1, Math.ceil(Math.sqrt((count * width) / Math.max(1, height))));
      const rows = Math.max(1, Math.ceil(count / columns));
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = origin.x + ((col + 0.28 + ((i * 13) % 7) * 0.045) / columns) * width;
        const y = origin.y + ((row + 0.28 + ((i * 5) % 7) * 0.045) / rows) * height;
        const length = origin.size * (0.11 + ((i * 7) % 5) * 0.018);
        ctx.moveTo(x, y);
        ctx.lineTo(x + length, y - length * 0.22);
        ctx.moveTo(x - length * 0.45, y + length * 0.6);
        ctx.lineTo(x - length * 0.36, y + length * 0.58);
      }
      ctx.strokeStyle = OVERLAY.sandWisp;
      ctx.globalAlpha = intensity === 2 ? 0.95 : 0.65;
      ctx.lineWidth = Math.max(1, origin.size * 0.024);
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Static upright vapour sprites, drawn before occupants so feet stay legible. */
  private drawSteamPuffs(view: MapView, camera: Camera): void {
    const tiles = view.obscuringTiles ?? [];
    if (tiles.length === 0) return;
    const { ctx } = this;
    const puff = steamPuffCanvas();
    ctx.save();
    for (const pos of tiles) {
      if (!camera.isVisible(pos)) continue;
      const box = camera.toScreen(pos);
      // Match the upright Pixi base while keeping Canvas vapour static.
      const base = box.y + box.size * 0.78;
      for (let j = 0; j < 4; j++) {
        const seed = steamSeed(pos.x, pos.y, j);
        const width = box.size * (0.66 + seed * 0.24);
        const height = width * (0.9 + seed * 0.15);
        const cx = box.x + box.size * (0.24 + j * 0.17 + (seed - 0.5) * 0.16);
        const rise = box.size * (0.02 + (j % 2) * 0.08 + seed * 0.05);
        ctx.globalAlpha = view.crispOverlays ? 0.9 : 0.65;
        ctx.drawImage(puff, cx - width / 2, base - rise - height * 0.88, width, height);
      }
    }
    ctx.restore();
  }

  private drawCliffCues(view: MapView, camera: Camera): void {
    const ctx = this.ctx;
    const size = camera.toScreen({ x: 0, y: 0 }).size;
    ctx.save();
    ctx.strokeStyle = OVERLAY.cliffHatch;
    ctx.lineWidth = Math.max(2, size * 0.045);
    for (const edge of view.cliffEdges ?? []) {
      const box = camera.toScreen(edge.pos);
      const horizontal = edge.side === 'north' || edge.side === 'south';
      const x = horizontal ? box.x : box.x + (edge.side === 'east' ? box.size : 0);
      const y = horizontal ? box.y + (edge.side === 'south' ? box.size : 0) : box.y;
      ctx.beginPath();
      for (let step = 0.1; step < 1; step += 0.2) {
        if (horizontal) {
          const inward = edge.side === 'south' ? -1 : 1;
          const inset = size * 0.03;
          ctx.moveTo(x + size * (step - 0.08), y + inward * inset);
          ctx.lineTo(x + size * (step + 0.08), y + inward * (inset + size * 0.1));
        } else {
          const inward = edge.side === 'east' ? -1 : 1;
          const inset = size * 0.03;
          ctx.moveTo(x + inward * inset, y + size * (step - 0.08));
          ctx.lineTo(x + inward * (inset + size * 0.1), y + size * (step + 0.08));
        }
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Upright ground cues: projected anchors, not the ground transform. */
  private drawClimbMarkers(view: MapView, camera: Camera): void {
    const ctx = this.ctx;
    const size = camera.toScreen({ x: 0, y: 0 }).size;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const marker of view.climbMarkers ?? []) {
      const box = camera.toScreen(marker.pos);
      const cx = box.x + box.size * 0.4;
      const cy = box.y + box.size * 0.72;
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.1, cy + size * 0.07);
      ctx.lineTo(cx, cy - size * 0.1);
      ctx.lineTo(cx + size * 0.1, cy + size * 0.07);
      ctx.closePath();
      ctx.fillStyle = OVERLAY.climb;
      ctx.strokeStyle = OVERLAY.pathUnder;
      ctx.lineWidth = Math.max(3, size * 0.065);
      ctx.stroke();
      ctx.fill();
      ctx.font = `600 ${Math.max(10, size * 0.2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, size * 0.045);
      ctx.strokeText(`+${marker.surcharge}`, cx + size * 0.2, cy);
      ctx.fillText(`+${marker.surcharge}`, cx + size * 0.2, cy);
    }
    ctx.restore();
  }

  /** The target cue stays above units so it remains attached to its target. */
  private drawTargetReticle(view: MapView, camera: Camera): void {
    const cue = view.targetReticle;
    if (cue && (cue.elevation || cue.obscured)) {
      const target = view.units.find((unit) =>
        footprintCells(unit.pos, unit.size, this.squareFootprints).some(
          (cell) => cell.x === cue.pos.x && cell.y === cue.pos.y,
        ),
      );
      const pos = target?.renderPos ?? target?.pos ?? cue.pos;
      const box = camera.spriteBox(pos, target?.size ?? 1, this.squareFootprints);
      const heightTiles = this.squareFootprints ? (target?.size ?? 1) : 1;
      const width = (target?.size ?? 1) * box.size;
      const scale = target?.scale ?? 1;
      const cx = actorReticleX(
        { x: box.x, y: box.y, size: box.size, width },
        scale,
        target?.size ?? 1,
      );
      const frame =
        this.squareFootprints && target
          ? sheets.frame(
              target.sprite,
              target.clip ?? 'idle',
              target.clipTime ?? view.time + idlePhase(target.id),
              target.clipFrame,
              box.size * camera.viewport.dpr * scale,
              target.size,
              target.meleeDirection,
              heightTiles,
            )
          : null;
      const silhouette = actorSilhouetteGeometry(
        { x: box.x, y: box.y, size: box.size },
        heightTiles,
        this.squareFootprints ? (frame?.headroom ?? null) : null,
        scale,
      );
      const cy = this.squareFootprints ? silhouette.reticleY : box.y - box.size * 0.04;
      this.drawPixelCues(
        [targetReticleMark(screenToBoardPixel(camera, { x: cx, y: cy }), cue)],
        camera,
        'screen',
        view.cameraNudge,
      );
    }
  }

  private drawPath(view: MapView, camera: Camera): void {
    if (view.path.length === 0) return;
    if (
      view.pathFrom &&
      (!this.curve || this.curve.path !== view.path || this.curve.from !== view.pathFrom)
    ) {
      this.curve = {
        path: view.path,
        from: view.pathFrom,
        curve: smoothPath(view.pathFrom, view.path),
      };
    }
    this.drawPixelCues(
      pathPixelMarks(view, camera, this.curve?.curve),
      camera,
      'ground',
      view.cameraNudge,
    );
  }

  /** The throw being aimed: the flight's own curve as G1 dots over an ink line. */
  private drawAimArc(arc: AimArc, camera: Camera, nudge: Vec2): void {
    this.drawPixelCues(aimArcPixelMarks(arc, camera), camera, 'ground', nudge);
  }

  private drawExit(view: MapView, camera: Camera, nudge: Vec2): void {
    for (const exit of view.exits ?? (view.exit ? [view.exit] : [])) {
      const anchor = boardPixelFromTile(camera, { x: exit.pos.x + 0.5, y: exit.pos.y + 0.5 });
      this.drawPixelCues(
        [
          exitMark(
            anchor,
            cueOpacity(view.time, 420, view.reducedMotion),
            camera.projection === 'topdown' ? exit.direction : undefined,
          ),
        ],
        camera,
        'ground',
        nudge,
      );
    }
  }

  private npcWidth(sprite: string): 1 | 2 {
    const entry = resolveAsset(sprite);
    return entry.kind === 'sheet' && entry.footprint.w === 2 ? 2 : 1;
  }

  private drawNpcs(view: MapView, camera: Camera): void {
    const { ctx } = this;
    const { dpr } = camera.viewport;
    for (const npc of view.npcs) {
      const width = this.npcWidth(npc.sprite);
      const at = npc.renderPos ?? npc.pos;
      const box = camera.spriteBox(at, width, false);
      const entry = resolveAsset(npc.sprite);
      const scale = npc.scale ?? 1;
      const alpha = npc.alpha ?? 1;
      if (alpha <= 0 || !uprightSpriteVisible(box, camera.viewport, width, scale)) continue;
      const footX = box.x + (width * box.size) / 2;
      const footY = box.y + FOOT_LINE * box.size;
      // The walk bob lifts the figure; its contact shadow stays on the ground.
      const lift = Math.round((npc.offset?.y ?? 0) * box.size * dpr) / dpr;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(footX, footY + lift);
      ctx.rotate(npc.lean ?? 0);
      const poseScale = npc.poseScale ?? 1;
      const clip = npcClip(npc);
      // An eight-way sheet draws its own west and diagonals; only its legacy clips mirror.
      const facing =
        entry.kind === 'sheet' && entry.facing === 'both' && authoredForBothSides(clip)
          ? 1
          : (npc.facing ?? 1);
      ctx.scale(scale * poseScale * facing, scale * poseScale);
      ctx.translate(-footX, -footY);
      const frame =
        entry.kind === 'sheet'
          ? sheets.frame(
              npc.sprite,
              clip,
              npc.clipTime ?? 0,
              undefined,
              box.size * dpr * scale,
              width,
            )
          : null;
      if (frame) {
        const fw = (frame.frame.w / frame.pixelsPerTile) * box.size;
        const fh = (frame.frame.h / frame.pixelsPerTile) * box.size;
        const f = frame.frame;
        drawArt(ctx, f.w, fw, () =>
          ctx.drawImage(
            frame.source,
            f.x,
            f.y,
            f.w,
            f.h,
            footX - frame.anchor.x * fw,
            footY - frame.anchor.y * fh,
            fw,
            fh,
          ),
        );
      } else {
        const sprite = sprites.get(npc.sprite, box.size * dpr * scale, npcPose(npc), width);
        ctx.drawImage(sprite, box.x, box.y, box.size * width, box.size);
      }

      ctx.restore();
      if (npc.quiet) continue;
      // A small "talk" pip so a child can tell an NPC from scenery.
      const anchor = screenToBoardPixel(camera, {
        x: box.x + box.size * width * 0.5,
        y: footY + lift - box.size * npcPipLift(npc.sprite, scale),
      });
      const cue = talkPipMark(anchor, cueOpacity(view.time, 500, view.reducedMotion, alpha));
      for (const draw of resolvePixelMarkDraws(
        camera,
        [cue],
        this.pixelMarkDrawables,
        view.cameraNudge,
      )) {
        drawCanvasPixelMark(ctx, camera, draw, view.cameraNudge);
      }
    }
  }
  /**
   * The top-down props' shadows (#459): one layer from the cached `hardShadowMask` of each loaded
   * drawing, laid on the world-pixel grid with nearest sampling, under every mark and figure.
   */
  private drawTopdownPropShadows(view: MapView, camera: Camera): void {
    const { layer } = propShadows(view.props, view.scene?.pavedCells);
    if (!layer) return;
    const canvas = rgbaCanvas(layer.image);
    if (!canvas) return;
    drawArt(this.ctx, 1, camera.scale, () =>
      this.ctx.drawImage(
        canvas,
        layer.x * camera.scale - camera.offsetX,
        layer.y * camera.scale - camera.offsetY,
        layer.image.width * camera.scale,
        layer.image.height * camera.scale,
      ),
    );
  }

  /**
   * The organic surfaces (#458): the painted layer, then the fire's glow laid 'lighter', both on the
   * world-pixel grid. Canvas 2D draws them still: the glow at the middle of its flicker.
   */
  private drawTopdownSurfaces(surfaces: SurfaceArt, camera: Camera): void {
    const { layer, glow } = surfaceCanvases(surfaces);
    const ctx = this.ctx;
    const place = (canvas: HTMLCanvasElement) =>
      drawArt(ctx, 1, camera.scale, () =>
        ctx.drawImage(
          canvas,
          -camera.offsetX,
          -camera.offsetY,
          surfaces.layer.width * camera.scale,
          surfaces.layer.height * camera.scale,
        ),
      );
    if (layer) place(layer);
    if (!glow) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glowAlpha(null);
    place(glow);
    ctx.restore();
  }

  /** The ground flames as occupants, sorted with the figures by their feet; still on Canvas 2D. */
  private flameOccupants(surfaces: SurfaceArt | null, camera: Camera) {
    const art = surfaces?.flames.length ? flames() : null;
    if (!surfaces || !art) return [];
    const ctx = this.ctx;
    return surfaces.flames.map((site) => ({
      pos: flameFoot(site),
      draw: () => {
        const sheet = art.atlas.sheets[site.sheet];
        const f = sheet.frames[flameCel(site, null, sheet.frames.length)];
        if (!f) return;
        drawArt(ctx, f.w, f.w * camera.scale, () =>
          ctx.drawImage(
            art.image,
            f.x,
            f.y,
            f.w,
            f.h,
            (site.x - sheet.pivot.x) * camera.scale - camera.offsetX,
            (site.y - sheet.pivot.y) * camera.scale - camera.offsetY,
            f.w * camera.scale,
            f.h * camera.scale,
          ),
        );
      },
    }));
  }

  /** Steam's puffs over the figures (`drawSteam`), still on Canvas 2D: each at its own phase. */
  private drawTopdownSteam(surfaces: SurfaceArt, camera: Camera): void {
    const ctx = this.ctx;
    const k = camera.scale;
    for (const site of surfaces.steam) {
      const p = steamPuff(site, 0);
      const fill = (rows: ReturnType<typeof puffRows>, color: string) => {
        ctx.fillStyle = color;
        for (const r of rows)
          ctx.fillRect(r.x * k - camera.offsetX, r.y * k - camera.offsetY, r.w * k, k);
      };
      fill(
        puffRows(p.x, p.y, p.r, Math.max(2, Math.floor(p.r * 0.6))),
        `rgba(232,236,232,${p.alpha})`,
      );
      fill(
        puffRows(p.x - 2, p.y - 2, p.r >> 1, Math.max(1, Math.floor(p.r * 0.3))),
        `rgba(255,255,255,${p.alpha * 0.6})`,
      );
    }
  }

  /** The top-down board's reach, area and target washes, footprints, rings and cover pip (#457). */
  private drawTopdownWash(view: MapView, camera: Camera): void {
    const image = washLayer(view, this.squareFootprints);
    const canvas = image && rgbaCanvas(image);
    if (!image || !canvas) return;
    drawArt(this.ctx, 1, camera.scale, () =>
      this.ctx.drawImage(
        canvas,
        -camera.offsetX,
        -camera.offsetY,
        image.width * camera.scale,
        image.height * camera.scale,
      ),
    );
  }

  private drawProps(view: MapView, camera: Camera): void {
    const { ctx } = this;
    const { dpr } = camera.viewport;

    for (const prop of view.props) {
      if (!camera.isVisible(prop.pos)) continue;
      const box = camera.spriteBox(prop.pos);
      // A top-down board draws the prop's top-down drawing on its own box, once it has loaded.
      const art = camera.projection === 'topdown' ? topdownPropArt(prop) : null;
      if (art) {
        const { box: at } = art;
        drawArt(ctx, at.w, at.w * camera.scale, () =>
          ctx.drawImage(
            art.image,
            at.x * camera.scale - camera.offsetX,
            at.y * camera.scale - camera.offsetY,
            at.w * camera.scale,
            at.h * camera.scale,
          ),
        );
      } else if (prop.sprite) {
        const sprite = sprites.get(prop.sprite, box.size * dpr, { facing: 1 });
        ctx.drawImage(sprite, box.x, box.y, box.size, box.size);
      } else continue;

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

  /**
   * Cast every upright alpha silhouette into one mask, then tint once. The mask
   * is one texel per world pixel on the world-pixel grid (`shadowGrid`, ADR
   * 0093): casters are drawn into it with nearest sampling and it is scaled up
   * nearest, so every shadow is hard-edged and stepped like the art beside it.
   */
  private drawCastShadows(view: MapView, camera: Camera): void {
    const grid = shadowGrid(camera.viewport, camera.scale, camera.offsetX, camera.offsetY);
    this.shadowGridNow = grid;
    const { width, height } = grid;
    if (
      !this.shadowLayer ||
      this.shadowLayer.width !== width ||
      this.shadowLayer.height !== height
    ) {
      this.shadowLayer = document.createElement('canvas');
      this.shadowLayer.width = width;
      this.shadowLayer.height = height;
    }
    const layer = this.shadowLayer.getContext('2d');
    if (!layer) return;
    this.grounding = actorGrounding(view.scene);
    this.topdownFigures = camera.projection === 'topdown';
    this.pavedCells = view.scene?.pavedCells;
    // The union is a grey level per pixel on opaque black; see `castInto`.
    if (
      !this.castScratch ||
      this.castScratch.width !== width ||
      this.castScratch.height !== height
    ) {
      this.castScratch = document.createElement('canvas');
      this.castScratch.width = width;
      this.castScratch.height = height;
    }
    const scratch = this.castScratch.getContext('2d');
    if (scratch) this.toShadowTexels(scratch, grid);
    layer.setTransform(1, 0, 0, 1, 0, 0);
    layer.globalCompositeOperation = 'source-over';
    layer.fillStyle = '#000000';
    layer.fillRect(0, 0, width, height);
    this.toShadowTexels(layer, grid);
    this.drawLiveShadowMask(layer, view, camera);
    layer.setTransform(1, 0, 0, 1, 0, 0);
    this.compositeExactShadow(layer, view, camera, width, height);
  }

  /** A mask context draws in screen CSS px onto world-pixel texels, sampling its casters nearest. */
  private toShadowTexels(target: CanvasRenderingContext2D, grid: ShadowGrid): void {
    target.setTransform(
      1 / grid.texel,
      0,
      0,
      1 / grid.texel,
      -grid.originX / grid.texel,
      -grid.originY / grid.texel,
    );
    target.imageSmoothingEnabled = false;
  }

  /** Lays a world-pixel mask over the screen, each texel a hard block of one world pixel. */
  private drawShadowTexels(source: HTMLCanvasElement, grid: ShadowGrid): void {
    const smoothing = this.ctx.imageSmoothingEnabled;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(
      source,
      grid.originX,
      grid.originY,
      grid.width * grid.texel,
      grid.height * grid.texel,
    );
    this.ctx.imageSmoothingEnabled = smoothing;
  }

  /**
   * Puts one caster into the union at `level`. Casters of different strength mix
   * (every scene has a contact layer, ADR 0093), and ADR 0071 wants an overlap to
   * take the strongest, never to add up: source-over of two 0.5 casts gives 0.75.
   * So the union is a grey level per pixel (white at alpha `a` over black is
   * exactly `a`), combined with `lighten`, a per-channel maximum for opaque
   * sources. Each caster is drawn alone into the
   * scratch (transparent, so the source's colours do not matter), turns that to
   * white at the caster's own alpha on black, scales it by `level` (`multiply`
   * by an opaque grey is exact) and `lighten`s it into the layer. `bounds` is
   * where the caster can have drawn, in screen CSS px; the pixel work is done in
   * the mask's texels.
   */
  private castInto(
    layer: CanvasRenderingContext2D,
    level: number,
    bounds: { x0: number; y0: number; x1: number; y1: number },
    draw: (target: CanvasRenderingContext2D) => void,
  ): void {
    const scratch = this.castScratch?.getContext('2d');
    const grid = this.shadowGridNow;
    if (!scratch || !this.castScratch || !grid) {
      draw(layer);
      return;
    }
    const x0 = Math.max(0, Math.floor((bounds.x0 - grid.originX) / grid.texel) - 1);
    const y0 = Math.max(0, Math.floor((bounds.y0 - grid.originY) / grid.texel) - 1);
    const x1 = Math.min(
      this.castScratch.width,
      Math.ceil((bounds.x1 - grid.originX) / grid.texel) + 1,
    );
    const y1 = Math.min(
      this.castScratch.height,
      Math.ceil((bounds.y1 - grid.originY) / grid.texel) + 1,
    );
    if (x1 <= x0 || y1 <= y0) return;
    scratch.save();
    scratch.setTransform(1, 0, 0, 1, 0, 0);
    scratch.beginPath();
    scratch.rect(x0, y0, x1 - x0, y1 - y0);
    scratch.clip();
    scratch.clearRect(x0, y0, x1 - x0, y1 - y0);
    this.toShadowTexels(scratch, grid);
    draw(scratch);
    scratch.setTransform(1, 0, 0, 1, 0, 0);
    scratch.globalCompositeOperation = 'source-in';
    scratch.fillStyle = '#ffffff';
    scratch.fillRect(x0, y0, x1 - x0, y1 - y0);
    scratch.globalCompositeOperation = 'destination-over';
    scratch.fillStyle = '#000000';
    scratch.fillRect(x0, y0, x1 - x0, y1 - y0);
    scratch.globalCompositeOperation = 'multiply';
    const grey = Math.round(Math.max(0, Math.min(1, level)) * 255);
    scratch.fillStyle = `rgb(${grey}, ${grey}, ${grey})`;
    scratch.fillRect(x0, y0, x1 - x0, y1 - y0);
    scratch.restore();
    this.toShadowTexels(scratch, grid);
    layer.save();
    layer.setTransform(1, 0, 0, 1, 0, 0);
    layer.globalCompositeOperation = 'lighten';
    layer.drawImage(this.castScratch, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    layer.restore();
  }

  /** Turns the grey union into shadow: `scene * (1 - g) + ink * g`, both steps exact on opaque images. */
  private compositeExactShadow(
    layer: CanvasRenderingContext2D,
    view: MapView,
    camera: Camera,
    width: number,
    height: number,
  ): void {
    const scratch = this.castScratch?.getContext('2d');
    const grid = this.shadowGridNow;
    if (!scratch || !this.castScratch || !this.shadowLayer || !grid) return;
    this.ctx.save();
    this.clipShadowGround(this.ctx, view, camera);
    scratch.setTransform(1, 0, 0, 1, 0, 0);
    scratch.globalCompositeOperation = 'source-over';
    scratch.fillStyle = '#ffffff';
    scratch.fillRect(0, 0, width, height);
    scratch.globalCompositeOperation = 'difference';
    scratch.drawImage(this.shadowLayer, 0, 0);
    this.ctx.globalCompositeOperation = 'multiply';
    this.drawShadowTexels(this.castScratch, grid);
    scratch.globalCompositeOperation = 'source-over';
    scratch.fillStyle = inkColor(this.grounding.ink);
    scratch.fillRect(0, 0, width, height);
    scratch.globalCompositeOperation = 'multiply';
    scratch.drawImage(this.shadowLayer, 0, 0);
    scratch.globalCompositeOperation = 'source-over';
    this.ctx.globalCompositeOperation = 'lighter';
    this.drawShadowTexels(this.castScratch, grid);
    this.ctx.restore();
    layer.globalCompositeOperation = 'source-over';
  }

  private clipShadowGround(ctx: CanvasRenderingContext2D, view: MapView, camera: Camera): void {
    const corners = [
      { x: 0, y: 0 },
      { x: view.grid.width, y: 0 },
      { x: view.grid.width, y: view.grid.height },
      { x: 0, y: view.grid.height },
    ].map((point) => camera.project(point));
    ctx.beginPath();
    corners.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.clip();
  }

  /**
   * A figure's ground shadow (ADR 0093's figure amendment): its pool and short cast at the scene's cast
   * level, and the core under its soles at the contact level, one canvas pixel a world pixel, so each
   * lands on one texel of the mask. `foot` is in screen CSS px, `worldPixel` CSS px a world pixel.
   */
  private projectFigureShadow(
    target: CanvasRenderingContext2D,
    foot: { x: number; y: number },
    scale: number,
    widthTiles: number,
    alpha: number,
    worldPixel: number,
    at: Vec2,
    cels?: FigureCels,
  ): void {
    if (cels?.driller) {
      if (alpha <= 0 || !contactBand(this.grounding, 1) || !cels.driller.frame) return;
      const art = drillerGroundingArt(
        cels.driller.frame,
        cels.driller.heading,
        this.grounding.castKey,
        cels.driller.mirror,
      );
      if (!art) return;
      const geometry = drillerGroundingGeometry(
        foot,
        cels.driller.frame,
        art,
        cels.scale,
        worldPixel,
      );
      const draw = (canvas: HTMLCanvasElement, level: number, box: typeof geometry.cast) =>
        this.castInto(
          target,
          level,
          { x0: box.x, y0: box.y, x1: box.x + box.w, y1: box.y + box.h },
          (context) => {
            context.save();
            context.globalAlpha = alpha;
            context.drawImage(canvas, box.x, box.y, box.w, box.h);
            context.restore();
          },
        );
      draw(art.cast, this.grounding.cast, geometry.cast);
      draw(art.blob, this.grounding.contact, geometry.blob);
      return;
    }
    if (alpha <= 0 || !contactBand(this.grounding, 1)) return;
    if (this.topdownFigures) {
      // The top-down board grounds a figure on Imagination's feet blob, centred on its resting soles.
      const blob = feetBlobArt(TOPDOWN_FEET_WIDTH * scale * widthTiles);
      if (!blob) return;
      const tile = TILE * worldPixel * (cels?.scale ?? scale);
      const offset = poolOffset(cels?.resting, cels?.flip ?? false);
      const w = blob.width * worldPixel,
        h = blob.height * worldPixel;
      const x = foot.x + offset.x * tile - w / 2,
        y = foot.y + offset.y * tile - h / 2;
      const level = topdownFeetLevel(this.pavedCells, at);
      this.castInto(target, level, { x0: x, y0: y, x1: x + w, y1: y + h }, (t) => {
        t.save();
        t.globalAlpha = alpha;
        t.drawImage(blob, x, y, w, h);
        t.restore();
      });
      return;
    }
    // A figure tile of the shipped sheets: the swept pool is the orthographic board's
    // grounding, which `feetBlob` replaces on the top-down board (ADR 0104, T4).
    const art = figureShadowArt(TILE * scale, this.grounding.castKey, widthTiles);
    if (!art) return;
    // The pool centres on the resting soles; one figure tile is `tile` CSS px.
    const tile = TILE * worldPixel * (cels?.scale ?? scale);
    const offset = poolOffset(cels?.resting, cels?.flip ?? false);
    const x = foot.x + offset.x * tile - art.footX * worldPixel;
    const y = foot.y + offset.y * tile - art.footY * worldPixel;
    const w = art.cast.width * worldPixel;
    const h = art.cast.height * worldPixel;
    const pool = (canvas: HTMLCanvasElement, level: number) =>
      this.castInto(target, level, { x0: x, y0: y, x1: x + w, y1: y + h }, (t) => {
        t.save();
        t.globalAlpha = alpha;
        t.drawImage(canvas, x, y, w, h);
        t.restore();
      });
    pool(art.cast, this.grounding.cast);
    const drawn = cels?.drawn;
    const soles = drawn?.feet && soleContactArt(drawn.feet, drawn.frame.w);
    if (!drawn || !soles) {
      // No measured soles (a painter figure, a bend): the pool's own core is its contact.
      pool(art.contact, this.grounding.contact);
      return;
    }
    // The contact under each sole, placed exactly as the cel is drawn on the ground point.
    const fw = (drawn.frame.w / drawn.pixelsPerTile) * tile;
    const fh = (drawn.frame.h / drawn.pixelsPerTile) * tile;
    const cx = foot.x - drawn.anchor.x * fw;
    const cy = foot.y - drawn.anchor.y * fh;
    const ch = (soles.height / drawn.frame.h) * fh;
    const x0 = cels.flip ? 2 * foot.x - cx - fw : cx;
    this.castInto(target, this.grounding.contact, { x0, y0: cy, x1: x0 + fw, y1: cy + ch }, (t) => {
      t.save();
      t.globalAlpha = alpha;
      if (cels.flip) {
        t.translate(foot.x * 2, 0);
        t.scale(-1, 1);
      }
      t.drawImage(soles, cx, cy, fw, ch);
      t.restore();
    });
  }

  /**
   * A prop's contact line: its own silhouette `CONTACT_LINE` world pixels lower,
   * at the contact level, so a line that deep shows under every edge it
   * stands on, whatever shape its base is (ADR 0093). It is how the painting's
   * G1 objects meet the ground (`objects.py`); a figure's band is cut from its
   * soles instead, because a figure stands on two small feet.
   */
  private projectContactLine(
    target: CanvasRenderingContext2D,
    source: CanvasImageSource,
    placed: { x: number; y: number; w: number; h: number },
    alpha: number,
    worldPixel: number,
  ): void {
    const y = placed.y + CONTACT_LINE * worldPixel;
    this.castInto(
      target,
      this.grounding.contact,
      { x0: placed.x, y0: y, x1: placed.x + placed.w, y1: y + placed.h },
      (t) => {
        t.save();
        t.globalAlpha = alpha;
        t.drawImage(source, placed.x, y, placed.w, placed.h);
        t.restore();
      },
    );
  }

  private drawLiveShadowMask(
    target: CanvasRenderingContext2D,
    view: MapView,
    camera: Camera,
  ): void {
    const worldPixel = camera.scale;
    for (const npc of view.npcs) {
      const at = npc.renderPos ?? npc.pos;
      const width = this.npcWidth(npc.sprite);
      const box = camera.spriteBox(at, width, false);
      const entry = resolveAsset(npc.sprite);
      const clip = npcClip(npc);
      const scale = npc.scale ?? 1;
      const px = box.size * camera.viewport.dpr * scale;
      const sheet = entry.kind === 'sheet';
      // A resident's pool is steady at its feet; its contact follows the soles it draws (ADR 0093).
      this.projectFigureShadow(
        target,
        { x: box.x + (width * box.size) / 2, y: box.y + FOOT_LINE * box.size },
        scale,
        1,
        npc.alpha ?? 1,
        worldPixel,
        at,
        sheet
          ? {
              drawn: sheets.frame(npc.sprite, clip, npc.clipTime ?? 0, undefined, px, width),
              resting: sheets.frame(npc.sprite, restingClip(clip), 0, undefined, px, width),
              flip:
                !(entry.facing === 'both' && authoredForBothSides(clip)) &&
                (npc.facing ?? 1) === -1,
              scale: scale * (npc.poseScale ?? 1),
            }
          : undefined,
      );
    }
    this.drawPropShadowMask(
      target,
      camera.projection === 'topdown'
        ? // A top-down drawing's shadow is in the props' own layer (`drawTopdownPropShadows`).
          view.props.filter((prop) => prop.sprite && !topdownPropArt(prop))
        : view.props,
      camera,
    );
    for (const unit of view.units) {
      if (unit.castShadow === false) continue;
      const pos = unit.renderPos ?? unit.pos;
      const box = camera.spriteBox(pos, unit.size, this.squareFootprints);
      if (unit.offset) {
        box.x += unit.offset.x * box.size;
        box.y += unit.offset.y * box.size;
      }
      const width = unit.size === 2 ? box.size * 2 : box.size;
      // The foot is the tile's ground, so the walk bob lifts the figure off its shadow
      // instead of dragging the shadow along with it.
      const foot = {
        x: box.x + width / 2,
        y: box.y - (unit.offset?.y ?? 0) * box.size + FOOT_LINE * box.size,
      };
      const scale = unit.scale ?? 1;
      const heightTiles = this.squareFootprints ? unit.size : 1;
      const clip = unit.clip ?? 'idle';
      const asset = resolveAsset(unit.sprite);
      const px = box.size * camera.viewport.dpr * scale;
      const cels =
        asset.kind === 'sheet'
          ? {
              drawn: sheets.frame(
                unit.sprite,
                clip,
                unit.clipTime ?? view.time + idlePhase(unit.id),
                unit.clipFrame,
                px,
                unit.size,
                unit.meleeDirection,
                heightTiles,
              ),
              resting: sheets.frame(
                unit.sprite,
                restingClip(clip),
                0,
                undefined,
                px,
                unit.size,
                undefined,
                heightTiles,
              ),
              flip:
                !(asset.facing === 'both' && authoredForBothSides(clip)) &&
                (unit.facing ?? (unit.faction === 'enemy' ? -1 : 1)) === -1,
              scale,
            }
          : undefined;
      const driller =
        camera.projection === 'topdown' &&
        unit.sprite === 'unit.enemy.driller' &&
        asset.kind === 'sheet' &&
        asset.atlas.startsWith('art/topdown/')
          ? drillerGroundingPose(
              cels?.drawn?.clip ?? clip,
              cels?.flip ?? (unit.facing ?? -1) === -1,
            )
          : undefined;
      const groundingCels = driller
        ? {
            ...(cels ?? { drawn: null, resting: null, flip: driller.mirror, scale }),
            driller: {
              ...driller,
              // The static view (its rest cel): its idle loops the rumble (ADR 0104).
              frame: sheets.frame(
                unit.sprite,
                headingClip('rest', driller.heading),
                0,
                0,
                px,
                unit.size,
                undefined,
                heightTiles,
              ),
            },
          }
        : cels;
      // Its pool is steady at its feet, its contact under the soles it draws (ADR 0093).
      this.projectFigureShadow(
        target,
        foot,
        scale,
        unit.size === 2 ? 2 : 1,
        (unit.alpha ?? 1) *
          (unit.fallen ? FALLEN_SHADOW_ALPHA : 1) *
          castShadowStrength(unit.castShadow),
        worldPixel,
        pos,
        groundingCels,
      );
    }
  }

  private drawPropShadowMask(
    target: CanvasRenderingContext2D,
    props: MapView['props'],
    camera: Camera,
  ): void {
    const dpr = camera.viewport.dpr;
    for (const prop of props) {
      if (prop.castShadow === false) continue;
      const box = camera.spriteBox(prop.pos);
      const sprite = sprites.get(prop.sprite, box.size * dpr, { facing: 1 });
      const placed = { x: box.x, y: box.y, w: box.size, h: box.size };
      const strength = castShadowStrength(prop.castShadow);
      // A prop casts from its own ground, down the scene's key, and meets it on its contact line.
      const cast = strength > 0 ? groundedCastArt(sprite, this.grounding.castKey) : null;
      if (cast) {
        const k = placed.w / Math.max(1, sprite.width);
        const w = cast.width * k;
        const h = cast.height * k;
        this.castInto(
          target,
          this.grounding.cast,
          { x0: placed.x, y0: placed.y, x1: placed.x + w, y1: placed.y + h },
          (t) => {
            t.save();
            t.globalAlpha = strength;
            t.drawImage(cast, placed.x, placed.y, w, h);
            t.restore();
          },
        );
      }
      if (contactBand(this.grounding, strength))
        this.projectContactLine(target, sprite, placed, strength, camera.scale);
    }
  }

  /** The birds a fight flushes out of the trees; the page is asked for once per scene so it is in. */
  private drawFlock(view: MapView, camera: Camera): void {
    const flock = view.scene?.flock;
    if (flock !== this.flock) {
      this.flock = flock;
      if (flock) sceneImage(flockFrame(flock, 0));
    }
    const elapsed = flushElapsed(view);
    if (!flock || !(elapsed >= 0)) return;
    const perches = view.scene?.scenery.filter((piece) => piece.wind) ?? [];
    const size = flock.size * camera.scale;
    for (const bird of flockAt(flock, perches, elapsed)) {
      const frame = flockFrame(flock, bird.frame);
      const image = sceneImage(frame);
      if (!image) continue;
      this.ctx.save();
      this.ctx.globalAlpha = bird.alpha;
      this.ctx.translate(
        bird.x * camera.scale - camera.offsetX,
        bird.y * camera.scale - camera.offsetY,
      );
      this.ctx.rotate(bird.angle);
      drawSceneImage(this.ctx, image, frame, -size / 2, -size / 2, size, size);
      this.ctx.restore();
    }
  }

  /** Ground marks sit beneath every upright actor and scenery piece. */
  private drawUnitRings(view: MapView, camera: Camera): void {
    const { ctx } = this;
    for (const unit of view.units) {
      const box = camera.spriteBox(unit.renderPos ?? unit.pos, unit.size, this.squareFootprints);
      const marker = unitMarkerGroundPoint(
        { x: box.x, y: box.y },
        box.size,
        unit.meleeDirection ? unit.offset : undefined,
      );
      const footprint = this.squareFootprints ? unit.size : 1;
      const width = box.size * unit.size;
      const centreLift = (footprint - 1) * box.size * 0.5;
      // A stepped active-unit frame, drawn under the sprite like the former ring.
      if (unit.id === view.activeUnitId) {
        // Snap in world space, then apply the camera transform. Snapping the
        // screen point to a zero-based grid loses the offset's device-pixel
        // phase (for example, half a CSS pixel at DPR 2) and separates this
        // cue from the Pixi cue and the actor's feet.
        const cue = activeGroundCue(
          (marker.x + width / 2 + camera.offsetX) / camera.scale,
          (marker.y + box.size * 0.86 - centreLift + camera.offsetY) / camera.scale,
          width / camera.scale,
          box.size / camera.scale,
          footprint,
          1,
          view.crispOverlays ? 4 : 3,
        );
        ctx.save();
        ctx.translate(-camera.offsetX, -camera.offsetY);
        ctx.scale(camera.scale, camera.scale);
        ctx.fillStyle = HP_COLORS.frame;
        for (const run of cue.outer) ctx.fillRect(run.x, run.y, run.width, run.height);
        ctx.fillStyle = OVERLAY.active;
        for (const run of cue.inner) ctx.fillRect(run.x, run.y, run.width, run.height);
        ctx.restore();
      } else if (unit.id === view.selectedUnitId) {
        const centre = screenToBoardPixel(camera, {
          x: marker.x + width / 2,
          y: marker.y + box.size * 0.86 - centreLift,
        });
        this.drawPixelCues(
          [
            selectedRingMark(
              centre,
              (width * 0.4) / camera.scale,
              (box.size * footprint * 0.12) / camera.scale,
            ),
          ],
          camera,
          'screen',
          view.cameraNudge,
        );
      }
    }
  }

  /** The covered part of each hidden party member, over the pieces that keep their paint. */
  private drawReveal(view: MapView, camera: Camera): void {
    const scenery = view.scene?.scenery ?? [];
    if (!scenery.some((piece) => piece.revealOccluded)) return;
    this.reveal ??= new RevealLayer();
    const drawn = this.reveal.draw(this.revealFigures, scenery, camera);
    if (!drawn) return;
    const { ctx } = this;
    const width = drawn.width * camera.scale;
    drawArt(ctx, drawn.width, width, () =>
      ctx.drawImage(
        drawn.canvas,
        drawn.x * camera.scale - camera.offsetX,
        drawn.y * camera.scale - camera.offsetY,
        width,
        drawn.height * camera.scale,
      ),
    );
  }

  private drawUnits(view: MapView, camera: Camera): void {
    const { ctx } = this;
    const { dpr } = camera.viewport;

    // Draw back to front so a unit lower on the map overlaps one above it.
    const ordered = [...view.units].sort(
      (a, b) =>
        canvasActorDepth(camera, a.renderPos ?? a.pos, a.size, this.squareFootprints) -
        canvasActorDepth(camera, b.renderPos ?? b.pos, b.size, this.squareFootprints),
    );

    for (const unit of ordered) {
      const pos = unit.renderPos ?? unit.pos;
      const box = camera.spriteBox(pos, unit.size, this.squareFootprints);
      const width = unit.size === 2 ? box.size * 2 : box.size;

      // The bob lifts the drawing, never the sort: it is applied after ordering.
      // So does the ground: a unit on a ledge stands a little higher on screen.
      if (unit.offset) {
        box.x += unit.offset.x * box.size;
        box.y += unit.offset.y * box.size;
      }
      const facing = unit.facing ?? (unit.faction === 'enemy' ? -1 : 1);
      const asset = resolveAsset(unit.sprite);
      const locomotion = unit.clip ?? 'idle';
      const drawFacing =
        asset.kind === 'sheet' && asset.facing === 'both' && authoredForBothSides(locomotion)
          ? 1
          : facing;
      const scale = unit.scale ?? 1;
      const heightTiles = this.squareFootprints ? unit.size : 1;
      if (!uprightSpriteVisible(box, camera.viewport, unit.size, scale, heightTiles)) continue;

      ctx.save();
      // A pose scales about the feet; the fallen fade sits on top of any alpha.
      const alpha = (unit.alpha ?? 1) * fallenAlpha(unit);
      ctx.globalAlpha = alpha;
      // The frame comes from the unit's sheet, real or baked from its painter
      // at device resolution (ADR 0003); the anchor stands on the foot line.
      const frame = sheets.frame(
        unit.sprite,
        unit.clip ?? 'idle',
        unit.clipTime ?? view.time + idlePhase(unit.id),
        unit.clipFrame,
        box.size * dpr * scale,
        unit.size,
        unit.meleeDirection,
        heightTiles,
      );
      const silhouette = combatActorSilhouetteScreenGeometry(
        { x: box.x, y: box.y, size: box.size, width },
        heightTiles,
        frame?.headroom ?? null,
        scale,
        camera.scale,
        camera.offsetX,
        camera.offsetY,
      );
      this.barTops.set(unit.id, silhouette.bar.y);
      if (frame) {
        const ax = box.x + width / 2;
        const ay = box.y + FOOT_LINE * box.size;
        const { x: drawX, y: drawY, w: fw, h: fh } = placeFrame(frame, ax, ay, box.size * scale);
        if (drawFacing === -1) {
          ctx.translate(ax, 0);
          ctx.scale(-1, 1);
          ctx.translate(-ax, 0);
        }
        const f = frame.frame;
        if (revealsUnit(unit) && drawsScene(camera.projection)) {
          const world = (v: number, offset: number) => (v + offset) / camera.scale;
          this.revealFigures.push({
            source: frame.source,
            rect: f,
            ...revealBox(
              {
                x: world(drawX, camera.offsetX),
                y: world(drawY, camera.offsetY),
                w: fw / camera.scale,
                h: fh / camera.scale,
              },
              world(ax, camera.offsetX),
              drawFacing === -1,
            ),
            flip: drawFacing === -1,
            foot: camera.groundPoint(footprintFoot(pos, unit.size, this.squareFootprints)).y,
          });
        }
        // A sheet pixel on a whole block of device pixels draws nearest (ADR 0088).
        drawArt(ctx, f.w, fw, () => {
          ctx.drawImage(frame.source, f.x, f.y, f.w, f.h, drawX, drawY, fw, fh);
          if (unit.flash && unit.flash > 0) {
            ctx.globalAlpha *= Math.min(1, unit.flash);
            ctx.drawImage(this.mask(frame.source), f.x, f.y, f.w, f.h, drawX, drawY, fw, fh);
          }
        });
      } else {
        const drawWidth = width * scale;
        const drawHeight = box.size * heightTiles * scale;
        const drawX = box.x + (width - drawWidth) / 2;
        const drawY = box.y + FOOT_LINE * (box.size - drawHeight);
        // Painted at device resolution, drawn at CSS size under the dpr transform.
        const sprite = sprites.get(
          unit.sprite,
          box.size * dpr * scale,
          { facing },
          unit.size,
          heightTiles,
        );
        ctx.drawImage(sprite, drawX, drawY, drawWidth, drawHeight);
        if (unit.flash && unit.flash > 0) {
          ctx.globalAlpha *= Math.min(1, unit.flash);
          ctx.drawImage(this.mask(sprite), drawX, drawY, drawWidth, drawHeight);
        }
      }
      ctx.restore();

      if (!unit.fallen) {
        if (unit.showHealth !== false) {
          this.pendingHealthBars.push({
            id: unit.id,
            unit,
            bar: silhouette.bar,
            actorX: box.x,
            hatch: view.hatch,
          });
        }
        this.drawStatusBadges(unit, box.x, width, box.size, silhouette.badgeY);
      } else {
        // A fallen unit gets a clear cross rather than just fading out.
        const anchor = screenToBoardPixel(camera, {
          x: box.x + width / 2,
          y: box.y + box.size * 0.55,
        });
        this.drawPixelCues(
          [koCrossMark(anchor, width / camera.scale)],
          camera,
          'screen',
          view.cameraNudge,
        );
      }
    }
  }

  private drawHealthBar(
    unit: RenderUnit,
    bar: ReturnType<typeof actorSilhouetteGeometry>['bar'],
    actorX: number,
    hatch: boolean,
    camera: Camera,
    nudge: Vec2,
  ): void {
    const { ctx } = this;
    const fraction = Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
    const { x: barX, y: barY, width: barWidth, height: barHeight } = bar;
    const fill = hpFill(unit.faction, fraction, hatch);
    const pixel = bar.pixelSize;
    const innerX = barX + pixel;
    const innerY = barY + pixel;
    const innerWidth = Math.max(pixel, barWidth - pixel * 2);
    const innerHeight = Math.max(pixel, barHeight - pixel * 2);
    const fillWidth =
      fraction > 0
        ? Math.min(innerWidth, Math.max(pixel, Math.round((innerWidth * fraction) / pixel) * pixel))
        : 0;

    // The frame and one-pixel upper edge stay sharp at the camera's pixel scale.
    ctx.fillStyle = HP_COLORS.frame;
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = HP_COLORS.back;
    ctx.fillRect(innerX, innerY, innerWidth, innerHeight);
    ctx.fillStyle = fill;
    ctx.fillRect(innerX, innerY, fillWidth, innerHeight);
    ctx.fillStyle = HP_COLORS.highlight;
    ctx.fillRect(innerX, innerY, innerWidth, pixel);

    // The side's cap, so the bar reads by shape as well as colour.
    const cap = healthBarCap(bar, HP_CAP[unit.faction], actorX);
    if (cap.length === 0) return;
    if (HP_CAP[unit.faction] === 'spike') {
      const rawAnchor = { x: cap[0] ?? 0, y: barY + barHeight / 2 };
      const anchor = screenToBoardPixel(camera, rawAnchor);
      const points: Vec2[] = [];
      for (let i = 0; i + 1 < cap.length; i += 2) {
        points.push({
          x: ((cap[i] ?? 0) - rawAnchor.x) / camera.scale,
          y: ((cap[i + 1] ?? 0) - rawAnchor.y) / camera.scale,
        });
      }
      this.drawPixelCues(
        [healthBarSpikeMark(anchor, points, hpFill(unit.faction, 1, hatch), HP_COLORS.frame)],
        camera,
        'screen',
        nudge,
      );
      return;
    }
    ctx.strokeStyle = HP_COLORS.frame;
    ctx.lineWidth = pixel;
    ctx.beginPath();
    for (let i = 0; i < cap.length; i += 2) ctx.lineTo(cap[i] ?? 0, cap[i + 1] ?? 0);
    ctx.closePath();
    ctx.fillStyle = hpFill(unit.faction, 1, hatch);
    ctx.fill();
    ctx.stroke();
  }

  private flushHealthBars(camera: Camera, nudge: Vec2): void {
    const placements = this.healthBarStagger.place(this.pendingHealthBars);
    for (const candidate of this.pendingHealthBars) {
      const bar = placements.get(candidate.id);
      if (!bar) continue;
      this.barTops.set(candidate.id, bar.y);
      this.drawHealthBar(candidate.unit, bar, candidate.actorX, candidate.hatch, camera, nudge);
    }
    this.pendingHealthBars = [];
  }

  private drawStatusBadges(
    unit: RenderUnit,
    x: number,
    width: number,
    size: number,
    badgeY: number,
  ): void {
    if (unit.statuses.length === 0) return;
    const { ctx } = this;
    const radius = Math.max(4, size * 0.09);
    const shown = unit.statuses.slice(0, 4);
    const totalWidth = shown.length * radius * 2.2;
    let bx = x + width / 2 - totalWidth / 2 + radius;
    const by = badgeY;

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
    this.fx.draw(this.ctx, view.emitters, layer, origin, origin.size);
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
      box.x += (floater.offsetX ?? 0) * box.size;
      const textScale =
        FLOATER_TEXT_SCALE *
        (floater.textScale ?? 1) *
        floaterScale(floater.progress, floater.emphasis);
      // The owner's bar top as drawn this frame; a target that is gone from the
      // view reads from the painter-fallback geometry on its own tile.
      const owner = floaterOwner(view.units, floater.pos, this.squareFootprints);
      const barTop =
        (owner && this.barTops.get(owner.id)) ??
        fallbackBarTop({ x: box.x, y: box.y, size: box.size });
      paintFloatingNumber(
        ctx,
        box,
        floater.text,
        floater.color,
        floater.progress,
        textScale,
        floaterStartY(barTop, box.size, textScale),
      );
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
    case 'rangeBonus':
      return [OVERLAY.rangeBonus, OVERLAY.rangeBonusEdge];
    case 'hover':
      return [OVERLAY.hover, null];
  }
}

/** Conservative upright bounds include a 1.5-tile headroom above the base frame. */
export function uprightSpriteVisible(
  box: { x: number; y: number; size: number },
  viewport: Pick<Viewport, 'width' | 'height'>,
  footprint = 1,
  scale = 1,
  heightTiles = 1,
): boolean {
  const footX = box.x + (footprint * box.size) / 2;
  const footY = box.y + FOOT_LINE * box.size;
  const halfWidth = ((footprint + 0.5) * box.size * scale) / 2;
  const top = footY - (FOOT_LINE + Math.max(1.5, heightTiles)) * box.size * scale;
  const bottom = footY + (1 - FOOT_LINE) * box.size * scale;
  return (
    footX + halfWidth >= 0 &&
    footX - halfWidth <= viewport.width &&
    bottom >= 0 &&
    top <= viewport.height
  );
}

/** A scene's ground plates with the image each has loaded, or null while it has not. */
function sceneGroundImages(
  scene: MapScene,
): { piece: SceneImage; image: HTMLImageElement | null }[] {
  return scene.ground.map((piece) => ({ piece, image: sceneImage(piece) }));
}

/** Whether a scene can stand in for the terrain: it has plates, and every plate and piece has loaded. */
function sceneArtLoaded(
  scene: MapScene,
  ground: readonly { image: HTMLImageElement | null }[],
): boolean {
  return (
    ground.length > 0 &&
    ground.every(({ image }) => image !== null) &&
    scene.scenery.every((piece) => sceneImage(piece) !== null)
  );
}
