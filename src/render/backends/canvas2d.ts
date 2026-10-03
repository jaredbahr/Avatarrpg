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

import type { Grid, SceneFlock, SceneImage, Vec2 } from '../../core/types';
import { SQUARE_FOOTPRINTS, footprintCells } from '../../core/rules/footprint';
import { authoredForBothSides } from '../../content/assets/clips';
import { resolveAsset } from '../../content/assets/manifest';
import { Camera, TILE } from '../camera';
import type { Viewport } from '../camera';
import type { TileRelief } from '../geometry/board';
import { boardRelief, decorSignature, seamMaterial, surfaceEdges } from '../geometry/board';
import { aimArcPoints, arcHeading, arrowheadPolygon } from '../geometry/arc';
import {
  actorReticleX,
  actorSilhouetteGeometry,
  actorShadowDensity,
  healthBarCap,
} from '../geometry/actorSilhouette';
import { resolveActorEmitters } from '../geometry/actorAttachments';
import { liftAlong, liftAt } from '../geometry/elevation';
import { contourLoops } from '../geometry/contour';
import type { Curve } from '../geometry/curve';
import {
  clip,
  identity,
  liftCost,
  liftPlan,
  markedCells,
  marksSchedule,
  polyBounds,
} from '../geometry/lift';
import type { LiftPlan, Pt, Rect } from '../geometry/lift';
import { sampleAt, smoothPath } from '../geometry/curve';
import { CanvasFxLayer } from '../fx/canvasFx';
import { steamPuffCanvas, steamSeed } from '../fx/steamPuff';
import { drawBendFx } from '../fx/bendFxDraw';
import { backdrops } from '../backdrops';
import { sceneForGrid, sceneImage, drawSceneImage, sceneryOpacities } from '../scene';
import type { GroundingCanvas } from '../groundingLayer';
import { sceneGrounding } from '../groundingLayer';
import { GROUNDING_GRAIN } from '../grounding';
import { flockAt, flockFrame, flushElapsed, sway } from '../living/wind';
import { surfaceIsPainted } from '../sceneSurfaces';
import { HP_CAP, HP_COLORS, OVERLAY, STATUS_BADGE, hpFill } from '../palettes';
import { paintElevationBase, paintTileDecor, paintTileSeams } from '../painters/board';
import { paintFloatingNumber, paintPathArrow, paintPathDot } from '../painters/fx';
import { FOOT_LINE } from '../sheets/bake';
import { placeFrame } from '../sheets/placement';
import { idlePhase, sheets } from '../sheets/store';
import {
  paintExitMarker,
  paintGridLine,
  paintOverlay,
  paintSurface,
  paintTerrain,
} from '../painters/tiles';
import { npcPose, sprites } from '../spriteCache';
import {
  fallenAlpha,
  floaterScale,
  unitMarkerGroundPoint,
  type AimArc,
  type MapView,
  type OverlayKind,
  type OverlayLayer,
  type RenderUnit,
} from '../view';
import type { BackendCapabilities, RenderBackend } from './backend';
import { renderFoot } from '../renderFoot';
import {
  CAST_SHADOW_ALPHA,
  FALLEN_SHADOW_ALPHA,
  SHADOW_COLOR,
  castShadowStrength,
  structureShadowPolygons,
  tileShadowCell,
  silhouetteProjection,
} from '../lighting';

/** The rounded square a hovered tile gets, in tile units from its corner. */
const HOVER_LOOP = contourLoops([{ x: 0, y: 0 }])[0] ?? [];

/** Canvas ordering point, exported so parity can be tested without a drawing context. */
export function canvasActorDepth(
  camera: Camera,
  pos: Vec2,
  size: 1 | 2,
  square = SQUARE_FOOTPRINTS,
): number {
  return camera.groundPoint(renderFoot(pos, size, square, camera.projection)).y;
}

/** How far in from the board's edge the shading reaches, in tiles. */
export const EDGE_SHADE_TILES = 1.4;
export const EDGE_SHADE_ALPHA = 0.42;
export const VIGNETTE_ALPHA = 0.3;

export class Canvas2DBackend implements RenderBackend {
  readonly capabilities: BackendCapabilities = { name: 'canvas', shaders: false, particles: false };

  private ctx: CanvasRenderingContext2D;
  /**
   * Contours per overlay layer and the curve per path, keyed by identity: the
   * scene memoises its overlays, so the same objects come back frame after
   * frame until something changes, and a WeakMap forgets them with it.
   */
  private loops = new WeakMap<OverlayLayer, Vec2[][]>();
  /** Steam regions are memoised by the view's stable obscuring-cell array. */
  private obscuringLoops = new WeakMap<readonly Vec2[], Vec2[][]>();
  private curve: { path: readonly Vec2[]; from: Vec2; curve: Curve } | null = null;
  private fx = new CanvasFxLayer();
  /** White silhouettes of unit art, for the hit flash; forgotten with the source. */
  private masks = new WeakMap<HTMLCanvasElement | HTMLImageElement, HTMLCanvasElement>();
  /** One union mask, rebuilt each frame from every upright silhouette. */
  private shadowLayer: HTMLCanvasElement | null = null;
  /** Cliffs, rims and wall outlines, rebuilt only when a tile's footing changes. */
  private relief: ReadonlyMap<number, TileRelief> = new Map();
  private reliefSignature = '';
  /** The oblique board, where raised ground is lifted rather than banded. */
  private lifted = false;
  /** The raised blocks as drawn, cropped to them, and what they were drawn for. */
  private liftLayer: HTMLCanvasElement | null = null;
  private liftKey = '';
  /** While set, the tile painters draw only these cells (a mark on one top). */
  private only: { x0: number; y0: number; x1: number; y1: number } | null = null;
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
    this.dropLiftLayer();
  }

  draw(view: MapView, camera: Camera): void {
    const { ctx } = this;
    const dpr = camera.viewport.dpr;
    view = {
      ...view,
      scene: view.scene ? sceneForGrid(view.scene, view.grid) : undefined,
      emitters: resolveActorEmitters(
        view.emitters,
        view.grid,
        camera.projection,
        camera.toScreen({ x: 0, y: 0 }).size * dpr,
      ),
    };

    this.lifted = camera.projection === 'oblique';
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
    const compatible =
      camera.projection === 'oblique'
        ? view.backdrop?.projection === 'oblique'
        : !view.backdrop?.projection;
    const partialScene = camera.projection === 'oblique' && view.scene?.groundMode === 'partial';
    const painting =
      !partialScene && compatible && view.backdrop ? backdrops.get(view.backdrop.url) : null;
    if (painting) this.drawBackdrop(painting, view, camera);
    let sceneGround = false;
    let grounding: GroundingCanvas | null = null;
    let sceneGroundPieces: { piece: SceneImage; image: HTMLImageElement | null }[] = [];
    if (camera.projection === 'oblique' && view.scene) {
      const ground = view.scene.ground.map((piece) => ({
        piece,
        image: sceneImage(piece),
      }));
      sceneGroundPieces = ground;
      sceneGround =
        ground.length > 0 &&
        ground.every(({ image }) => image !== null) &&
        view.scene.scenery.every((piece) => sceneImage(piece) !== null);
      if (sceneGround && !partialScene) {
        for (const { piece, image } of ground) {
          if (image)
            drawSceneImage(
              ctx,
              image,
              piece,
              piece.x * camera.scale - camera.offsetX,
              piece.y * camera.scale - camera.offsetY,
              piece.width * camera.scale,
              piece.height * camera.scale,
            );
        }
      }
      if (sceneGround)
        grounding = sceneGrounding(view.scene, {
          toWorld: (pos) => camera.groundPoint(pos),
        });
      if (sceneGround && !partialScene) drawGrounding(ctx, grounding, camera);
    }
    if (camera.projection === 'oblique') {
      // Ground receives one affine transform. Upright scenery and actors never do.
      const ground = new Camera(
        { width: view.grid.width * 64, height: view.grid.height * 64, dpr },
        camera.grid,
      );
      const m = camera.groundMatrix();
      const painted = view.scene ? sceneGround : painting !== null;
      const plan = liftPlan(
        view.grid,
        camera,
        sceneGround ? (view.scene?.reliefLift ?? 0) : 0,
        Boolean(view.crispOverlays),
      );
      // The ground, then its marks: the ones that change only with the ground
      // (surfaces, seams and rule markers over art), then the live ones.
      const onGround = (draw: () => void) => {
        this.ctx.save();
        this.ctx.transform(m.a, m.b, m.c, m.d, m.tx, m.ty);
        draw();
        this.ctx.restore();
      };
      if (partialScene) {
        // A local authored region is an overlay, so the grid's procedural
        // terrain must be painted first and remain visible outside it.
        onGround(() => {
          this.drawGround(view, ground, false, true, false);
          // A complete normal partial scene keeps raised rule terrain below its
          // authored ground and live surfaces. Full decor handles fallbacks and
          // High contrast later in the pass.
          if (sceneGround && !view.crispOverlays) this.drawElevationBase(view, ground);
        });
        for (const { piece, image } of sceneGroundPieces) {
          if (!image) continue;
          drawSceneImage(
            ctx,
            image,
            piece,
            piece.x * camera.scale - camera.offsetX,
            piece.y * camera.scale - camera.offsetY,
            piece.width * camera.scale,
            piece.height * camera.scale,
          );
        }
        drawGrounding(ctx, grounding, camera);
      } else if (!painted) {
        onGround(() => {
          this.drawGround(view, ground, false);
          this.drawDecor(view, ground);
        });
      }
      const staticMarks =
        partialScene || painted
          ? () => {
              if (partialScene) {
                this.drawGround(view, ground, sceneGround, false, true);
                // A complete partial scene owns its local ground art; accessibility
                // and unavailable pieces still need all procedural rule markers.
                if (!sceneGround || view.crispOverlays) this.drawDecor(view, ground);
                else this.drawSeams(view, ground, sceneGround);
              } else {
                this.drawGround(view, ground, true);
                if (view.crispOverlays) this.drawDecor(view, ground);
              }
            }
          : null;
      const liveMarks = () => {
        this.drawOverlays(view, ground);
        this.drawPath(view, ground);
        if (view.aimArc) this.drawAimArc(view.aimArc, ground);
        this.drawFxLayer(view, ground, 'under', true);
        this.drawExit(view, ground);
      };
      // The lift layer copies the flat ground, so it is brought up to date
      // before any mark is drawn over it.
      const layer = plan.bounds
        ? this.syncLiftLayer(view, camera, plan, {
            key: [
              identity(view.grid),
              // Not the scene: it is copied whenever its scenery is filtered.
              identity(view.scene?.ground),
              identity(grounding?.canvas),
              sceneGround,
              sceneGroundPieces.filter(({ image }) => image).length,
              painting?.src,
              view.hatch,
              view.gridLines,
              view.obscuringTiles !== undefined,
            ].join('|'),
            marks: staticMarks && (() => onGround(staticMarks)),
          })
        : this.dropLiftLayer();
      onGround(() => {
        staticMarks?.();
        liveMarks();
      });
      if (layer && plan.bounds) this.drawLift(view, camera, plan, layer, () => onGround(liveMarks));
      this.drawSteamPuffs(view, camera);
      this.drawClimbMarkers(view, camera);
      this.drawCastShadows(view, camera);
      this.drawUnitRings(view, camera);
      drawBendFx(ctx, view.bendFx ?? [], camera, false);
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
        ...view.units.map((unit) => ({
          pos: renderFoot(
            unit.renderPos ?? unit.pos,
            unit.size,
            this.squareFootprints,
            camera.projection,
          ),
          draw: () => this.drawUnits({ ...view, units: [unit] }, camera),
        })),
      ].sort((a, b) => camera.groundPoint(a.pos).y - camera.groundPoint(b.pos).y);
      for (const occupant of occupants) occupant.draw();
      this.drawTargetReticle(view, camera);
      this.drawFlock(view, camera);
      drawBendFx(ctx, view.bendFx ?? [], camera, true);
      ctx.save();
      ctx.transform(m.a, m.b, m.c, m.d, m.tx, m.ty);
      this.drawFxLayer(view, ground, 'over', true);
      ctx.restore();
    } else {
      this.dropLiftLayer();
      this.drawGround(view, camera, painting !== null);
      if (!painting || view.crispOverlays) this.drawDecor(view, camera);
      if (view.atmosphere) this.drawShade(view, camera);
      this.drawOverlays(view, camera);
      this.drawSteamPuffs(view, camera);
      this.drawPath(view, camera);
      if (view.aimArc) this.drawAimArc(view.aimArc, camera);
      this.drawFxLayer(view, camera, 'under');
      this.drawExit(view, camera);
      this.drawClimbMarkers(view, camera);
      this.drawCastShadows(view, camera);
      this.drawUnitRings(view, camera);
      drawBendFx(ctx, view.bendFx ?? [], camera, false);
      this.drawNpcs(view, camera);
      this.drawProps(view, camera);
      this.drawUnits(view, camera);
      this.drawTargetReticle(view, camera);
      drawBendFx(ctx, view.bendFx ?? [], camera, true);
      this.drawFxLayer(view, camera, 'over');
    }
    this.drawFloaters(view, camera);

    ctx.restore();
  }

  /* ---------------------------------------------------------------- */

  /** The painting over the whole board's rectangle: one draw, scaled to the camera. */
  private drawBackdrop(image: HTMLImageElement, view: MapView, camera: Camera): void {
    if (camera.projection === 'oblique') {
      const padding = view.backdrop?.padding;
      const scale = (camera.scale * 64) / (view.backdrop?.pixelsPerTile ?? 64);
      this.ctx.drawImage(
        image,
        -camera.offsetX - (padding?.left ?? 0) * camera.scale,
        -camera.offsetY - (padding?.top ?? 0) * camera.scale,
        image.naturalWidth * scale,
        image.naturalHeight * scale,
      );
      return;
    }
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
        if (drawSurfaces && !surfaceIsPainted(view, painted, tile, pos))
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

  /**
   * The lift layer (ADR 0065): every raised block drawn once, on a canvas no
   * bigger than the blocks on screen, and redrawn only when the plan (camera,
   * viewport, footing) or the ground it copies changes. Its tops and faces
   * are copied from the flat ground this frame has just drawn, a block's box
   * at a time; its static marks are drawn straight onto each top, lifted.
   */
  private syncLiftLayer(
    view: MapView,
    camera: Camera,
    plan: LiftPlan,
    ground: { key: string; marks: (() => void) | null },
  ): HTMLCanvasElement | null {
    const rect = plan.bounds;
    if (!rect) return this.dropLiftLayer();
    const key = `${plan.key}|${ground.key}`;
    if (this.liftLayer && key === this.liftKey) return this.liftLayer;
    const dpr = camera.viewport.dpr;
    const layer = (this.liftLayer ??= document.createElement('canvas'));
    const width = Math.round(rect.w * dpr);
    const height = Math.round(rect.h * dpr);
    if (layer.width !== width || layer.height !== height) {
      layer.width = width;
      layer.height = height;
    }
    // A fresh canvas asked only ever for 2D always has one.
    const out = layer.getContext('2d') as CanvasRenderingContext2D;
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.clearRect(0, 0, width, height);
    out.setTransform(dpr, 0, 0, dpr, -rect.x * dpr, -rect.y * dpr);
    out.imageSmoothingEnabled = true;
    out.lineCap = 'round';
    this.liftKey = key;
    liftCost.layerBuilds++;
    liftCost.heldPx = width * height;

    // The board canvas holds the flat ground, shaken; the layer is not.
    const tilePx = TILE * camera.scale;
    const nudge = { x: view.cameraNudge.x * tilePx, y: view.cameraNudge.y * tilePx };
    for (const cell of plan.cells)
      for (const op of cell.ops) {
        if (op.kind === 'overlay') {
          if (!ground.marks) continue;
          out.save();
          traceInto(out, op.poly);
          out.clip();
          out.translate(0, -op.shift);
          this.drawOnly(out, cell, ground.marks);
          out.restore();
        } else if ('shift' in op) {
          out.save();
          traceInto(out, op.poly);
          out.clip();
          copyRect(out, this.canvas, polyBounds(op.poly, 0), dpr, nudge.x, nudge.y + op.shift);
          out.restore();
        } else if (op.kind === 'fill') {
          out.globalAlpha = op.alpha;
          out.fillStyle = op.color;
          traceInto(out, op.poly);
          out.fill();
          out.globalAlpha = 1;
        } else {
          out.globalAlpha = op.alpha;
          out.strokeStyle = op.color;
          out.lineWidth = op.width;
          out.beginPath();
          out.moveTo(op.a.x, op.a.y);
          out.lineTo(op.b.x, op.b.y);
          out.stroke();
          out.globalAlpha = 1;
        }
      }
    return layer;
  }

  /** Lets the lift layer go: nothing raised is on screen, or the board is gone. */
  private dropLiftLayer(): null {
    if (this.liftLayer) {
      // Zero the backing store: iOS frees canvas memory on that, not on GC.
      this.liftLayer.width = 0;
      this.liftLayer.height = 0;
    }
    this.liftLayer = null;
    this.liftKey = '';
    liftCost.heldPx = 0;
    return null;
  }

  /** Draws `draw` into `ctx`, with the tile painters kept to the cells round `cell`. */
  private drawOnly(ctx: CanvasRenderingContext2D, cell: Vec2, draw: () => void): void {
    const own = this.ctx;
    this.ctx = ctx;
    this.only = { x0: cell.x - 2, y0: cell.y - 2, x1: cell.x + 2, y1: cell.y + 2 };
    draw();
    this.only = null;
    this.ctx = own;
  }

  /**
   * Raised ground as blocks (ADR 0065). The layer goes over the flat ground
   * and its marks in one copy, covering each raised block's flat marks; then
   * the tops with a live mark near them take the marks again, lifted.
   */
  private drawLift(
    view: MapView,
    camera: Camera,
    plan: LiftPlan,
    layer: HTMLCanvasElement,
    liveMarks: () => void,
  ): void {
    const { ctx } = this;
    const rect = plan.bounds;
    if (!rect) return;
    const dpr = camera.viewport.dpr;
    liftCost.frames++;
    // The ctx carries the shake, and the layer's rect is in camera space.
    ctx.drawImage(layer, rect.x, rect.y, rect.w, rect.h);
    liftCost.copies++;
    liftCost.copiedPx += layer.width * layer.height;
    const steps = marksSchedule(plan, view.grid, markedCells(view.grid, view));
    for (const { cell, recover, marks } of steps) {
      const box = recover && cell.blockBounds && clip(cell.blockBounds, rect);
      if (box) {
        ctx.save();
        ctx.beginPath();
        for (const poly of cell.block) traceInto(ctx, poly, false);
        ctx.clip();
        copyRect(ctx, layer, box, dpr, -rect.x, -rect.y);
        ctx.restore();
      }
      if (!marks || !cell.top) continue;
      liftCost.markedTops++;
      ctx.save();
      traceInto(ctx, cell.top);
      ctx.clip();
      ctx.translate(0, -cell.shift);
      this.drawOnly(ctx, cell, liveMarks);
      ctx.restore();
    }
  }

  /** The cells the tile painters visit: those on screen, or only those round one top. */
  private tileBounds(view: MapView, camera: Camera) {
    const all = camera.visibleBounds(view.grid);
    const only = this.only;
    if (!only) return all;
    return {
      x0: Math.max(all.x0, only.x0),
      y0: Math.max(all.y0, only.y0),
      x1: Math.min(all.x1, only.x1),
      y1: Math.min(all.y1, only.y1),
    };
  }

  /** The relief painters read, rebuilt only when the footing or the projection changes. */
  private syncRelief(grid: Grid): void {
    const signature = decorSignature(grid) + (this.lifted ? '|lifted' : '');
    if (signature === this.reliefSignature) return;
    this.reliefSignature = signature;
    this.relief = boardRelief(grid, this.lifted);
  }

  /** Cliffs, canopies, walls, cover and decals: a second pass so overhangs land on neighbours. */
  private drawElevationBase(view: MapView, camera: Camera): void {
    const { ctx } = this;
    this.syncRelief(view.grid);
    const bounds = this.tileBounds(view, camera);
    for (let y = bounds.y0; y <= bounds.y1; y++)
      for (let x = bounds.x0; x <= bounds.x1; x++) {
        const index = y * view.grid.width + x;
        const tile = view.grid.tiles[index];
        if (!tile) continue;
        paintElevationBase(ctx, camera.toScreen({ x, y }), tile, { x, y }, this.relief.get(index));
      }
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
   * Ground joins over a complete authored scene.
   *
   * An authored ground region is painted art, so it has no procedural decor to
   * carry the join; its material edges are as straight as the tiles under it.
   * This pass draws only the joins, from the rules grid, so the road still
   * ends under grass and the pond keeps its bank over the picture.
   */
  private drawSeams(view: MapView, camera: Camera, ready: boolean): void {
    const { ctx } = this;
    this.syncRelief(view.grid);
    const bounds = this.tileBounds(view, camera);
    for (let y = bounds.y0; y <= bounds.y1; y++) {
      for (let x = bounds.x0; x <= bounds.x1; x++) {
        const index = y * view.grid.width + x;
        const tile = view.grid.tiles[index];
        if (!tile) continue;
        const pos = { x, y };
        if (surfaceIsPainted(view, ready, tile, pos)) continue;
        paintTileSeams(
          ctx,
          camera.toScreen(pos),
          pos,
          seamMaterial(tile),
          this.relief.get(index)?.seams ?? null,
          true,
        );
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
    this.drawObscurement(view, camera);
    if (view.crispOverlays) {
      this.drawCrispOverlays(view, camera);
    } else {
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
      const base = box.y + box.size * 0.78 - liftAt(view.grid, pos, camera.projection) * box.size;
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

  /** Upright ground cues: projected anchors, but no oblique ground transform. */
  private drawClimbMarkers(view: MapView, camera: Camera): void {
    const ctx = this.ctx;
    const size = camera.toScreen({ x: 0, y: 0 }).size;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const marker of view.climbMarkers ?? []) {
      const box = camera.toScreen(marker.pos);
      const cx = box.x + box.size * 0.4;
      const cy =
        box.y - liftAt(view.grid, marker.pos, camera.projection) * box.size + box.size * 0.72;
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
    const ctx = this.ctx;
    const size = camera.toScreen({ x: 0, y: 0 }).size;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const cue = view.targetReticle;
    if (cue) {
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
      const lift = liftAlong(view.grid, pos, camera.projection);
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
              box.size * camera.viewport.dpr * scale,
              target.size,
              target.meleeDirection,
              heightTiles,
            )
          : null;
      const silhouette = actorSilhouetteGeometry(
        { x: box.x, y: box.y - lift * box.size, size: box.size },
        heightTiles,
        this.squareFootprints ? (frame?.headroom ?? null) : null,
        scale,
      );
      const cy = this.squareFootprints
        ? silhouette.reticleY
        : box.y - lift * box.size - box.size * 0.04;
      ctx.fillStyle = OVERLAY.reticleCue;
      ctx.strokeStyle = OVERLAY.pathUnder;
      ctx.lineWidth = Math.max(3, size * 0.065);
      if (cue.elevation) {
        const direction = cue.elevation === 'above' ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.13, cy - direction * size * 0.08);
        ctx.lineTo(cx, cy + direction * size * 0.13);
        ctx.lineTo(cx + size * 0.13, cy - direction * size * 0.08);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      }
      if (cue.obscured) {
        const x = cx + size * 0.27;
        const y = cy;
        ctx.beginPath();
        ctx.arc(x - size * 0.06, y, size * 0.07, Math.PI, 0);
        ctx.arc(x + size * 0.04, y - size * 0.015, size * 0.09, Math.PI, 0);
        ctx.lineTo(x + size * 0.12, y + size * 0.06);
        ctx.lineTo(x - size * 0.13, y + size * 0.06);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      }
    }
    ctx.restore();
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
    ctx.lineWidth = Math.max(2, size * OVERLAY.pathUnderWidth);
    ctx.stroke();
    ctx.strokeStyle = OVERLAY.path;
    ctx.lineWidth = Math.max(1, size * OVERLAY.pathWidth);
    // A slow crawl along the route, so the line reads as a direction of travel.
    ctx.setLineDash([size * 0.22, size * 0.16]);
    ctx.lineDashOffset = -((view.time / 30) % (size * 0.38));
    ctx.stroke();
    ctx.setLineDash([]);

    // The arrowhead sits on the last tangent, pointing the way the walk ends.
    const end = sampleAt(curve, curve.length);
    const tip = { x: origin.x + end.pos.x * size, y: origin.y + end.pos.y * size };
    this.fillPolygon(
      arrowheadPolygon(tip, end.tangent, size * OVERLAY.pathArrowScale),
      OVERLAY.path,
    );
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
      box.y -= liftAlong(view.grid, at, camera.projection) * box.size;
      const entry = resolveAsset(npc.sprite);
      const scale = npc.scale ?? 1;
      const alpha = npc.alpha ?? 1;
      if (alpha <= 0 || !uprightSpriteVisible(box, camera.viewport, width, scale)) continue;
      const footX = box.x + (width * box.size) / 2;
      const footY = box.y + FOOT_LINE * box.size;
      // The walk bob lifts the figure; its contact shadow stays on the ground.
      const lift = (npc.offset?.y ?? 0) * box.size;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (entry.kind === 'image') {
        const s = box.size * scale;
        const density = actorShadowDensity(view.grid, at, true, width, false);
        ctx.drawImage(sprites.shadow(s * dpr, density), footX - s / 2, footY - 0.86 * s, s, s);
      }
      const squash = npc.squash ?? 0;
      ctx.translate(footX, footY + lift);
      ctx.rotate(npc.lean ?? 0);
      ctx.scale(scale * (npc.facing ?? 1) * (1 + 0.02 * squash), scale * (1 - 0.03 * squash));
      ctx.translate(-footX, -footY);
      const frame =
        entry.kind === 'sheet'
          ? sheets.frame(
              npc.sprite,
              npc.walking ? 'walk' : 'idle',
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
        );
      } else {
        const sprite = sprites.get(npc.sprite, box.size * dpr * scale, npcPose(npc), width);
        ctx.drawImage(sprite, box.x, box.y, box.size * width, box.size);
      }

      ctx.restore();
      if (npc.quiet) continue;
      // A small "talk" pip so a child can tell an NPC from scenery.
      ctx.save();
      ctx.globalAlpha = alpha * (0.55 + 0.35 * ((Math.sin(view.time / 500) + 1) / 2));
      ctx.fillStyle = '#f0c674';
      ctx.beginPath();
      ctx.arc(
        box.x + box.size * width * 0.5,
        footY + lift - box.size * (FOOT_LINE - 0.08) * scale,
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
      const box = camera.spriteBox(prop.pos);
      box.y -= liftAt(view.grid, prop.pos, camera.projection) * box.size;
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

  /** Cast every upright alpha silhouette into one mask, then tint once. */
  private drawCastShadows(view: MapView, camera: Camera): void {
    const width = Math.ceil(camera.viewport.width);
    const height = Math.ceil(camera.viewport.height);
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
    layer.clearRect(0, 0, width, height);
    this.drawStructureShadowMask(layer, view, camera);

    // Scenery and still props are drawn straight into the union each frame:
    // a cached mask only covered the viewport it was built for (so a pan lost
    // pieces) and was frozen before streamed scene art had arrived.
    if (view.scene && camera.projection === 'oblique') {
      this.drawSceneryShadowMask(layer, view, camera);
      this.drawPropShadowMask(
        layer,
        view.props.filter((prop) => !prop.burning),
        view,
        camera,
      );
    }
    this.drawLiveShadowMask(layer, view, camera);
    layer.globalCompositeOperation = 'source-in';
    layer.fillStyle = SHADOW_COLOR;
    layer.fillRect(0, 0, width, height);
    layer.globalCompositeOperation = 'source-over';
    this.ctx.save();
    this.ctx.globalAlpha = CAST_SHADOW_ALPHA;
    this.clipShadowGround(this.ctx, view, camera);
    this.ctx.drawImage(this.shadowLayer, 0, 0);
    this.ctx.restore();
  }

  /** Procedural wall blocks and raised tiers have no bitmap silhouette. */
  private drawStructureShadowMask(
    target: CanvasRenderingContext2D,
    view: MapView,
    camera: Camera,
  ): void {
    if (camera.projection !== 'oblique') return;
    target.save();
    target.fillStyle = '#ffffff';
    const authored = new Set(
      (view.scene?.scenery ?? []).flatMap((piece) =>
        (piece.footprint ?? []).map((cell) => `${cell.x},${cell.y}`),
      ),
    );
    for (const prop of view.props) authored.add(`${prop.pos.x},${prop.pos.y}`);
    for (const { points } of structureShadowPolygons(
      view.grid.width,
      view.grid.height,
      (x, y) => tileShadowCell(view.grid.tiles[y * view.grid.width + x]),
      (point) => camera.project(point),
      authored,
      TILE * camera.scale,
    )) {
      target.beginPath();
      points.forEach((point, index) =>
        index ? target.lineTo(point.x, point.y) : target.moveTo(point.x, point.y),
      );
      target.closePath();
      target.fill();
    }
    target.restore();
  }

  private clipShadowGround(ctx: CanvasRenderingContext2D, view: MapView, camera: Camera): void {
    const ring = camera.clampRingTiles;
    const corners = [
      { x: -ring.left, y: -ring.top },
      { x: view.grid.width + ring.right, y: -ring.top },
      { x: view.grid.width + ring.right, y: view.grid.height + ring.bottom },
      { x: -ring.left, y: view.grid.height + ring.bottom },
    ].map((point) => camera.project(point));
    ctx.beginPath();
    corners.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.clip();
  }

  private projectMask(
    target: CanvasRenderingContext2D,
    source: CanvasImageSource,
    src: { x: number; y: number; w: number; h: number } | null,
    dest: { x: number; y: number; w: number; h: number },
    foot: { x: number; y: number },
    alpha = 1,
    flip = false,
  ): void {
    const m = silhouetteProjection(foot.x, foot.y);
    target.save();
    target.globalAlpha = alpha;
    target.transform(m.a, m.b, m.c, m.d, m.e, m.f);
    if (flip) {
      target.translate(foot.x * 2, 0);
      target.scale(-1, 1);
    }
    if (src) target.drawImage(source, src.x, src.y, src.w, src.h, dest.x, dest.y, dest.w, dest.h);
    else target.drawImage(source, dest.x, dest.y, dest.w, dest.h);
    target.restore();
  }

  private drawSceneryShadowMask(
    target: CanvasRenderingContext2D,
    view: MapView,
    camera: Camera,
  ): void {
    for (const piece of view.scene?.scenery ?? []) {
      if (piece.castShadow === false) continue;
      const image = sceneImage(piece);
      if (!image) continue;
      const x = piece.x * camera.scale - camera.offsetX;
      const y = piece.y * camera.scale - camera.offsetY;
      const w = piece.width * camera.scale;
      const h = piece.height * camera.scale;
      const foot = { x: x + w / 2, y: y + h };
      const m = silhouetteProjection(foot.x, foot.y);
      target.save();
      target.globalAlpha = castShadowStrength(piece.castShadow);
      target.transform(m.a, m.b, m.c, m.d, m.e, m.f);
      if (piece.flip) {
        target.translate(x + w, 0);
        target.scale(-1, 1);
        target.translate(-x, 0);
      }
      drawSceneImage(target, image, piece, x, y, w, h);
      target.restore();
    }
  }

  private drawLiveShadowMask(
    target: CanvasRenderingContext2D,
    view: MapView,
    camera: Camera,
  ): void {
    const dpr = camera.viewport.dpr;
    for (const npc of view.npcs) {
      const at = npc.renderPos ?? npc.pos;
      const width = this.npcWidth(npc.sprite);
      const box = camera.spriteBox(at, width, false);
      box.y -= liftAlong(view.grid, at, camera.projection) * box.size;
      const scale = npc.scale ?? 1;
      const foot = { x: box.x + (width * box.size) / 2, y: box.y + FOOT_LINE * box.size };
      const frame = sheets.frame(
        npc.sprite,
        npc.walking ? 'walk' : 'idle',
        npc.clipTime ?? 0,
        undefined,
        box.size * dpr * scale,
        width,
      );
      if (frame) {
        const placed = placeFrame(frame, foot.x, foot.y, box.size * scale);
        this.projectMask(target, frame.source, frame.frame, placed, foot, npc.alpha ?? 1);
      } else {
        const sprite = sprites.get(npc.sprite, box.size * dpr * scale, npcPose(npc), width);
        this.projectMask(
          target,
          sprite,
          null,
          { x: box.x, y: box.y, w: box.size * width, h: box.size },
          foot,
          npc.alpha ?? 1,
        );
      }
    }
    this.drawPropShadowMask(
      target,
      camera.projection === 'oblique' && view.scene
        ? view.props.filter((prop) => Boolean(prop.burning))
        : view.props,
      view,
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
      box.y -= liftAlong(view.grid, pos, camera.projection) * box.size;
      const scale = unit.scale ?? 1;
      const heightTiles = this.squareFootprints ? unit.size : 1;
      const width = unit.size === 2 ? box.size * 2 : box.size;
      const foot = { x: box.x + width / 2, y: box.y + FOOT_LINE * box.size };
      const bend = unit.bend && sheets.bendFrame(unit.sprite, unit.bend.heading, unit.bend.index);
      const frame =
        bend ||
        sheets.frame(
          unit.sprite,
          unit.clip ?? 'idle',
          unit.clipTime ?? view.time + idlePhase(unit.id),
          unit.clipFrame,
          box.size * dpr * scale,
          unit.size,
          unit.meleeDirection,
          heightTiles,
        );
      if (frame) {
        const placed = placeFrame(frame, foot.x, foot.y, box.size * scale);
        const f = frame.frame;
        this.projectMask(
          target,
          frame.source,
          f,
          placed,
          foot,
          (unit.fallen ? FALLEN_SHADOW_ALPHA : 1) * castShadowStrength(unit.castShadow),
          !bend && (unit.facing ?? (unit.faction === 'enemy' ? -1 : 1)) === -1,
        );
      } else {
        const sprite = sprites.get(
          unit.sprite,
          box.size * dpr * scale,
          { facing: unit.facing ?? (unit.faction === 'enemy' ? -1 : 1) },
          unit.size,
          heightTiles,
        );
        const dest = {
          x: box.x + (width - width * scale) / 2,
          y: box.y + FOOT_LINE * (box.size - box.size * heightTiles * scale),
          w: width * scale,
          h: box.size * heightTiles * scale,
        };
        this.projectMask(
          target,
          sprite,
          null,
          dest,
          foot,
          (unit.fallen ? FALLEN_SHADOW_ALPHA : 1) * castShadowStrength(unit.castShadow),
        );
      }
    }
  }

  private drawPropShadowMask(
    target: CanvasRenderingContext2D,
    props: MapView['props'],
    view: MapView,
    camera: Camera,
  ): void {
    const dpr = camera.viewport.dpr;
    for (const prop of props) {
      if (prop.castShadow === false) continue;
      const box = camera.spriteBox(prop.pos);
      box.y -= liftAt(view.grid, prop.pos, camera.projection) * box.size;
      const sprite = sprites.get(prop.sprite, box.size * dpr, { facing: 1 });
      this.projectMask(
        target,
        sprite,
        null,
        { x: box.x, y: box.y, w: box.size, h: box.size },
        { x: box.x + box.size / 2, y: box.y + FOOT_LINE * box.size },
        castShadowStrength(prop.castShadow),
      );
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
        liftAlong(view.grid, unit.renderPos ?? unit.pos, camera.projection),
        unit.meleeDirection ? unit.offset : undefined,
      );
      const footprint = this.squareFootprints ? unit.size : 1;
      const width = box.size * unit.size;
      const centreLift = (footprint - 1) * box.size * 0.5;
      // Active-unit ring, drawn under the sprite.
      if (unit.id === view.activeUnitId) {
        ctx.save();
        ctx.strokeStyle = OVERLAY.active;
        ctx.lineWidth = Math.max(2, box.size * 0.06);
        ctx.globalAlpha = 0.75 + 0.25 * ((Math.sin(view.time / 300) + 1) / 2);
        ctx.beginPath();
        ctx.ellipse(
          marker.x + width / 2,
          marker.y + box.size * 0.86 - centreLift,
          width * 0.42,
          box.size * footprint * 0.14,
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
          marker.x + width / 2,
          marker.y + box.size * 0.86 - centreLift,
          width * 0.4,
          box.size * footprint * 0.12,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.restore();
      }
    }
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
      box.y -= liftAlong(view.grid, pos, camera.projection) * box.size;
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
      const shadowDensity = actorShadowDensity(
        view.grid,
        pos,
        unit.shadow === true,
        unit.size,
        this.squareFootprints,
      );
      if (shadowDensity > 0) {
        // On the ground, not on the bob: the tile's foot line, less the ledge.
        const footprint = this.squareFootprints ? unit.size : 1;
        // A square unit's ground contact is its rules footprint. Presentation
        // compensation (the Driller in oblique) enlarges the upright cel only.
        const shadowScale = this.squareFootprints && unit.size === 2 ? 1 : scale;
        const s = box.size * shadowScale * footprint;
        const footX = box.x - (unit.offset?.x ?? 0) * box.size + width / 2;
        const footY =
          box.y -
          (unit.offset?.y ?? 0) * box.size +
          0.86 * box.size -
          (footprint - 1) * box.size * 0.5;
        ctx.globalAlpha = alpha;
        ctx.drawImage(
          sprites.shadow(s * dpr, shadowDensity),
          footX - s / 2,
          footY - 0.86 * s,
          s,
          s,
        );
      }
      ctx.globalAlpha = alpha;
      // The frame comes from the unit's sheet, real or baked from its painter
      // at device resolution (ADR 0003); the anchor stands on the foot line.
      // A bend cel (ADR 0055) stands by its heading's own anchor and is never mirrored.
      const bend = unit.bend && sheets.bendFrame(unit.sprite, unit.bend.heading, unit.bend.index);
      const frame =
        bend ||
        sheets.frame(
          unit.sprite,
          unit.clip ?? 'idle',
          unit.clipTime ?? view.time + idlePhase(unit.id),
          unit.clipFrame,
          box.size * dpr * scale,
          unit.size,
          unit.meleeDirection,
          heightTiles,
        );
      const silhouette = actorSilhouetteGeometry(
        { x: box.x, y: box.y, size: box.size, width },
        heightTiles,
        frame?.headroom ?? null,
        scale,
      );
      if (frame) {
        const ax = box.x + width / 2;
        const ay = box.y + FOOT_LINE * box.size;
        const { x: drawX, y: drawY, w: fw, h: fh } = placeFrame(frame, ax, ay, box.size * scale);
        if (drawFacing === -1 && !bend) {
          ctx.translate(ax, 0);
          ctx.scale(-1, 1);
          ctx.translate(-ax, 0);
        }
        const f = frame.frame;
        ctx.drawImage(frame.source, f.x, f.y, f.w, f.h, drawX, drawY, fw, fh);
        // The white mask is a copy of the whole page: never for a bend page.
        if (unit.flash && unit.flash > 0 && !bend) {
          ctx.globalAlpha *= Math.min(1, unit.flash);
          ctx.drawImage(this.mask(frame.source), f.x, f.y, f.w, f.h, drawX, drawY, fw, fh);
        }
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
          this.drawHealthBar(unit, silhouette.bar, box.x, view.hatch);
        }
        this.drawStatusBadges(unit, box.x, width, box.size, silhouette.badgeY);
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

  private drawHealthBar(
    unit: RenderUnit,
    bar: ReturnType<typeof actorSilhouetteGeometry>['bar'],
    actorX: number,
    hatch: boolean,
  ): void {
    const { ctx } = this;
    const fraction = Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
    const { x: barX, y: barY, width: barWidth, height: barHeight } = bar;
    const fill = hpFill(unit.faction, fraction, hatch);

    // An ink-framed track, filled in the unit's side colour (pixi.ts matches).
    ctx.fillStyle = HP_COLORS.back;
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = fill;
    ctx.fillRect(barX, barY, barWidth * fraction, barHeight);
    ctx.strokeStyle = HP_COLORS.frame;
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 0.5, barY - 0.5, barWidth + 1, barHeight + 1);

    // The side's cap, so the bar reads by shape as well as colour.
    const cap = healthBarCap(bar, HP_CAP[unit.faction], actorX);
    if (cap.length === 0) return;
    ctx.beginPath();
    for (let i = 0; i < cap.length; i += 2) ctx.lineTo(cap[i] ?? 0, cap[i + 1] ?? 0);
    ctx.closePath();
    ctx.fillStyle = hpFill(unit.faction, 1, hatch);
    ctx.fill();
    ctx.stroke();
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

  private drawFxLayer(
    view: MapView,
    camera: Camera,
    layer: 'under' | 'over',
    oblique = false,
  ): void {
    if (view.emitters.length === 0) return;
    const origin = camera.toScreen({ x: 0, y: 0 });
    this.fx.draw(this.ctx, view.emitters, layer, origin, origin.size, oblique);
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
      paintFloatingNumber(
        ctx,
        box,
        floater.text,
        floater.color,
        floater.progress,
        floaterScale(floater.progress, floater.emphasis),
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

/** Adds a closed polygon in screen pixels to `ctx`'s path, a fresh one unless `begin` is false. */
function traceInto(ctx: CanvasRenderingContext2D, poly: readonly Pt[], begin = true): void {
  if (begin) ctx.beginPath();
  poly.forEach((p, index) => (index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

/**
 * Copies `box` (camera pixels) from `from`, a device-pixel canvas whose pixel
 * for camera point q is (q + (dx, dy)) × dpr, reading only what `from` has:
 * a bounded copy, never the whole source for a small clip.
 */
function copyRect(
  ctx: CanvasRenderingContext2D,
  from: HTMLCanvasElement,
  box: Rect,
  dpr: number,
  dx: number,
  dy: number,
): void {
  const x0 = Math.max(0, (box.x + dx) * dpr);
  const y0 = Math.max(0, (box.y + dy) * dpr);
  const x1 = Math.min(from.width, (box.x + box.w + dx) * dpr);
  const y1 = Math.min(from.height, (box.y + box.h + dy) * dpr);
  if (x1 <= x0 || y1 <= y0) return;
  ctx.drawImage(
    from,
    x0,
    y0,
    x1 - x0,
    y1 - y0,
    x0 / dpr - dx,
    y0 / dpr - dy,
    (x1 - x0) / dpr,
    (y1 - y0) / dpr,
  );
  liftCost.copies++;
  liftCost.copiedPx += (x1 - x0) * (y1 - y0);
}

/** A grounding raster at its scene rectangle, texel-sharp like the scenery it seats. */
function drawGrounding(
  ctx: CanvasRenderingContext2D,
  layer: GroundingCanvas | null | undefined,
  camera: Camera,
): void {
  if (!layer) return;
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    layer.canvas,
    layer.x * camera.scale - camera.offsetX,
    layer.y * camera.scale - camera.offsetY,
    layer.canvas.width * GROUNDING_GRAIN * camera.scale,
    layer.canvas.height * GROUNDING_GRAIN * camera.scale,
  );
  ctx.imageSmoothingEnabled = smoothing;
}
