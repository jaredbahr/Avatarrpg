/**
 * The camera.
 *
 * Combat maps auto-fit: the whole 20x12 grid is on screen with the HUD docked,
 * because a tactics fight where you have to scroll to see the enemy is a
 * tactics fight nobody can plan. Two things bend that rule, both on purpose:
 *
 *  - A viewport too narrow to show a tile at fingertip size (an iPad held in
 *    portrait, a phone) fits the map at the smallest tappable tile instead and
 *    lets it pan, centring on whoever is acting. Missing the enemy by scrolling
 *    is recoverable; missing the tile you meant to tap costs a turn.
 *  - The player can pinch or wheel in to look closer, and pan while zoomed.
 *    "Recentre" in the HUD puts the whole board back.
 *
 * The top-down board (ADR 0104, owner's answer 1) bends it further: combat
 * there may scroll. Its tiles are 40 world px and it draws on integer zoom
 * at N >= dpr device px per world px, so a tile is never under `MIN_TILE_PX`;
 * a 20x12 fight at a readable zoom is wider than most screens, so the camera
 * follows the action and pans. Recentre zooms out to the whole board, at the
 * largest whole scale that shows it, and only where that would drop a tile
 * under a fingertip does it stop at N = dpr, centre on whoever is acting and
 * pan. The orthographic board keeps the rule above.
 *
 * Explore maps are larger than the viewport and pan by drag, clamped so the
 * map edge never leaves the frame.
 */

import type { Grid, Vec2 } from '../core/types';
import { SQUARE_FOOTPRINTS, footprintFoot } from '../core/rules/footprint';
import { TILE, tileSize } from './projection';
import type { Projection } from './projection';

/**
 * Logical tile size before the fit scale is applied, on the orthographic
 * board. Anything that may meet a top-down board reads
 * `Camera.tile` (or `tileSize(projection)`) instead.
 */
export { TILE };

/**
 * Smallest tile worth fitting to, in CSS pixels. Below this a fingertip covers
 * more than one tile; `--tap` is 48px for buttons, but a tile has the confirm
 * step behind it, so it can be a little smaller.
 */
export const MIN_TILE_PX = 40;

export interface Viewport {
  readonly width: number;
  readonly height: number;
  /** devicePixelRatio, so the canvas is crisp on a Surface. */
  readonly dpr: number;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** How to put a continuous scale on the integer device-pixel grid. */
export type ScaleSnap = 'nearest' | 'floor' | 'ceil';

/** Float slack when testing a product like `scale * dpr` for a whole number. */
const WHOLE_EPSILON = 1e-6;

/** True when `deviceScale` is a whole number of device pixels per world pixel. */
export function isWholeScale(deviceScale: number): boolean {
  return Math.abs(deviceScale - Math.round(deviceScale)) <= WHOLE_EPSILON && deviceScale >= 1;
}

/**
 * The whole number of device pixels per world pixel for a CSS `scale` at
 * `dpr`, never under 1. `nearest` rounds by ratio rather than difference
 * (k and k + 1 meet at sqrt(k (k + 1))), so a pinch steps in and out
 * symmetrically and a preferred 1.5 at 1 dpr goes to 2 (x1.33), not 1 (x0.67).
 */
export function wholeDeviceScale(scale: number, dpr: number, mode: ScaleSnap): number {
  const device = scale * dpr;
  let whole: number;
  if (mode === 'floor') whole = Math.floor(device + WHOLE_EPSILON);
  else if (mode === 'ceil') whole = Math.ceil(device - WHOLE_EPSILON);
  else {
    const below = Math.floor(device + WHOLE_EPSILON);
    whole = below >= 1 && device >= Math.sqrt(below * (below + 1)) ? below + 1 : below;
  }
  return Math.max(1, whole);
}

function clampOffset(offset: number, slack: number): number {
  return slack <= 0 ? slack / 2 : Math.max(0, Math.min(slack, offset));
}

export class Camera {
  /** Screen (CSS) pixels per world pixel; a tile is `tile * scale` CSS pixels. */
  scale = 1;
  /**
   * Top-left of the viewport in scaled world space, as exact as the gestures
   * that moved it. `offsetX` / `offsetY` read it back on the device-pixel grid
   * under integer zoom; nothing else changes with the snap.
   */
  private rawX = 0;
  private rawY = 0;
  /**
   * The continuous scale a pinch or the wheel is asking for, beside the scale
   * it last produced. Under integer zoom a small step changes nothing until
   * the request crosses the next whole device-pixel scale, so the request has
   * to outlive the step. Forgotten as soon as anything else sets the scale.
   */
  private zoomIntent: { scale: number; intent: number } | null = null;

  /**
   * Integer zoom (ADR 0088): every fit, refit and zoom lands on a whole number
   * of device pixels per world pixel, and the offsets on the device-pixel
   * grid, so pixel art drawn at one art pixel per world pixel covers exactly
   * N x N device pixels. Set for the top-down pixel-art board; the
   * orthographic board keeps its continuous fit.
   */
  integerZoom = false;

  private minScale = 0.35;
  private maxScale = 2.5;

  constructor(
    public viewport: Viewport,
    public grid: { width: number; height: number },
    public projection: Projection = 'orthographic',
  ) {}

  /**
   * World pixels per tile for this camera's projection (`tileSize`): 40 on the
   * top-down board, 64 otherwise. Every tile-to-pixel conversion reads it.
   */
  get tile(): number {
    return tileSize(this.projection);
  }

  /** Top-left of the viewport in scaled world space; whole device pixels under integer zoom. */
  get offsetX(): number {
    return this.onDeviceGrid(this.rawX);
  }

  set offsetX(value: number) {
    this.rawX = value;
  }

  get offsetY(): number {
    return this.onDeviceGrid(this.rawY);
  }

  set offsetY(value: number) {
    this.rawY = value;
  }

  private onDeviceGrid(offset: number): number {
    if (!this.integerZoom) return offset;
    const dpr = this.viewport.dpr;
    // `+ 0` folds a rounded -0 into 0, so a centred board reads as untouched.
    return Math.round(offset * dpr) / dpr + 0;
  }

  /** Device pixels per world pixel: a whole number under integer zoom, once settled. */
  get deviceScale(): number {
    return this.scale * this.viewport.dpr;
  }

  /** True when the current scale puts a world pixel on a whole number of device pixels. */
  get onWholeDevicePixels(): boolean {
    return isWholeScale(this.deviceScale);
  }

  /**
   * `scale` moved to the device-pixel grid by `mode`, never below one device
   * pixel per world pixel. Unchanged when integer zoom is off.
   */
  snapScale(scale: number, mode: ScaleSnap = 'nearest'): number {
    if (!this.integerZoom) return scale;
    return wholeDeviceScale(scale, this.viewport.dpr, mode) / this.viewport.dpr;
  }

  /**
   * The largest whole device scale: the one at or above `maxScale`, so a 1 dpr
   * screen still has a step in past the 2x a view may open at.
   */
  private get maxDeviceScale(): number {
    return wholeDeviceScale(this.maxScale, this.viewport.dpr, 'ceil');
  }

  /** The smallest whole device scale at which a tile is still a fingertip (`MIN_TILE_PX`). */
  private get tappableDeviceScale(): number {
    return wholeDeviceScale(MIN_TILE_PX / this.tile, this.viewport.dpr, 'ceil');
  }

  /**
   * The smallest whole device scale any integer-zoom stop may take. The
   * top-down board never goes under a fingertip (N >= dpr, ADR 0104), so a
   * pinch out stops there.
   */
  private get floorDeviceScale(): number {
    return this.tappableDeviceScale;
  }

  /** The smallest whole device scale that keeps the view inside `viewExtent` (1 without one). */
  private get extentDeviceScale(): number {
    return this.viewExtent
      ? wholeDeviceScale(this.minContinuousExtentScale, this.viewport.dpr, 'ceil')
      : 1;
  }

  /** True when `resnap` should leave the scale alone: a whole device scale. */
  private get onIntegerStop(): boolean {
    return this.onWholeDevicePixels;
  }

  /** Sets a CSS scale anchored on a screen point. */
  private setScaleAt(scale: number, at: ScreenPoint): void {
    const ratio = scale / this.scale;
    if (ratio === 1) return;
    // Anchored on what is drawn (the snapped offsets), so the ground under the
    // pointer moves by at most the new snap: half a device pixel.
    this.rawX = (at.x + this.offsetX) * ratio - at.x;
    this.rawY = (at.y + this.offsetY) * ratio - at.y;
    this.scale = scale;
  }

  /** The integer-zoom stop nearest a continuous `scale` (by ratio): a whole device scale inside the limits. */
  private integerStop(scale: number): number {
    const dpr = this.viewport.dpr;
    const low = Math.max(
      wholeDeviceScale(Math.min(this.fitScale(), this.maxScale), dpr, 'floor'),
      this.extentDeviceScale,
      this.floorDeviceScale,
    );
    const high = Math.max(low, this.maxDeviceScale);
    return Math.max(low, Math.min(high, wholeDeviceScale(scale, dpr, 'nearest'))) / dpr;
  }

  /**
   * Puts a scale left between whole device scales (a dpr change, a tween
   * stopped part way) on the nearest integer-zoom stop about
   * the view centre, then clamps. A no-op when integer zoom is off or the
   * scale is already on a stop.
   */
  resnap(): void {
    if (!this.integerZoom || this.onIntegerStop) return;
    this.zoomIntent = null;
    this.setScaleAt(this.integerStop(this.scale), {
      x: this.viewport.width / 2,
      y: this.viewport.height / 2,
    });
    this.clampToPanBounds();
  }

  /**
   * Raises a zoomed-out board back to its fit after the viewport grew, keeping
   * a closer zoom as it is. Under integer zoom the fit is the whole scale at or
   * under the continuous one (so the board still fits), never under a fingertip.
   */
  raiseToFit(): void {
    const fit = this.integerZoom
      ? Math.max(
          this.snapScale(this.fitScale(), 'floor'),
          this.floorDeviceScale / this.viewport.dpr,
        )
      : this.fitScale();
    if (this.scale < fit) {
      this.zoomIntent = null;
      this.scale = fit;
    }
    this.resnap();
    this.clampToPanBounds();
  }

  /** When present, keeps the viewport centre inside the map plus this tile margin. */
  centreMargin?: number;
  /**
   * A scene's painted rectangle in world pixels. When set, the whole view stays inside it (so the edge of
   * the art is never on screen), zoom-out stops where the view just fits it, and a viewport larger than
   * it in either axis is centred on it. Unset, the usual bounds apply.
   */
  viewExtent?: { x: number; y: number; width: number; height: number };

  get worldWidth(): number {
    return this.grid.width * this.tile * this.scale;
  }

  get worldHeight(): number {
    return this.grid.height * this.tile * this.scale;
  }

  /** The scale at which the whole grid fits inside the viewport with a margin. */
  fitScale(margin = 12): number {
    const usableWidth = Math.max(1, this.viewport.width - margin * 2);
    const usableHeight = Math.max(1, this.viewport.height - margin * 2);
    const scaleX = usableWidth / (this.grid.width * this.tile);
    const scaleY = usableHeight / (this.grid.height * this.tile);
    return Math.max(this.minScale, Math.min(this.maxScale, Math.min(scaleX, scaleY)));
  }

  /** True while the whole grid is on screen, i.e. nothing is hidden by zoom. */
  get fitted(): boolean {
    return this.scale <= this.fitScale() + 1e-6;
  }

  /**
   * Scales so the entire grid fits inside the viewport, then centres it. Used
   * for every combat map on every resize. When fitting would make a tile
   * smaller than a fingertip, fits to the smallest tappable tile instead and
   * lets the map pan (see the header).
   */
  fit(margin = 12): void {
    const fitScale = this.fitScale(margin);
    const tappable = MIN_TILE_PX / this.tile;
    this.zoomIntent = null;
    if (this.integerZoom) {
      // The whole device scale at or under the fit, so the board still fits,
      // unless that is under a fingertip: then the tappable one, and pan.
      const device = Math.max(
        wholeDeviceScale(fitScale, this.viewport.dpr, 'floor'),
        this.tappableDeviceScale,
        this.extentDeviceScale,
      );
      this.scale = Math.min(device, this.maxDeviceScale) / this.viewport.dpr;
    } else
      this.scale = Math.max(this.minScale, Math.min(this.maxScale, Math.max(fitScale, tappable)));
    this.centre();
  }

  /**
   * Scales so a tile is comfortably tappable even if that means the map is
   * larger than the viewport, then clamps. Used for explore maps.
   */
  fitExplore(preferredTilePx = 48, margin = 12, snap: ScaleSnap = 'nearest'): void {
    const wanted = preferredTilePx / this.tile;
    const usableWidth = Math.max(1, this.viewport.width - margin * 2);
    const usableHeight = Math.max(1, this.viewport.height - margin * 2);
    const fitScale = Math.min(
      usableWidth / (this.grid.width * this.tile),
      usableHeight / (this.grid.height * this.tile),
    );
    this.zoomIntent = null;
    if (this.integerZoom) {
      // The whole device scale `snap` gives for the preferred tile (nearest by
      // ratio, so 1.5 CSS at 1 dpr is 2; combat floors, so the fight it was
      // tuned to show stays in view), a small board's fit if that is larger,
      // and never under a fingertip. A pinch reaches the rest.
      const dpr = this.viewport.dpr;
      const device = Math.max(
        wholeDeviceScale(wanted, dpr, snap),
        wholeDeviceScale(fitScale, dpr, 'floor'),
        this.tappableDeviceScale,
        this.extentDeviceScale,
      );
      this.scale = Math.min(device, this.maxDeviceScale) / dpr;
    } else
      this.scale = Math.max(this.minScale, Math.min(this.maxScale, Math.max(wanted, fitScale)));
    this.centre();
  }

  centre(): void {
    this.rawX = (this.worldWidth - this.viewport.width) / 2;
    this.rawY = (this.worldHeight - this.viewport.height) / 2;
    this.clamp();
  }

  /** Keeps the grid inside the frame; centres a smaller board. */
  clamp(): void {
    if (this.clampCentre()) {
      this.clampToExtent();
      return;
    }
    const slackX = this.worldWidth - this.viewport.width;
    const slackY = this.worldHeight - this.viewport.height;
    this.rawX = clampOffset(this.rawX, slackX);
    this.rawY = clampOffset(this.rawY, slackY);
    this.clampToExtent();
  }

  /** The clamp after a manual gesture (a pan, a pinch, the wheel): the same bounds as `clamp`. */
  clampToPanBounds(): void {
    this.clamp();
  }

  /**
   * The smallest scale at which the view still fits inside `viewExtent` (0 when
   * there is none); under integer zoom, the whole device scale at or above it.
   */
  get minExtentScale(): number {
    if (!this.viewExtent) return 0;
    return this.integerZoom
      ? this.extentDeviceScale / this.viewport.dpr
      : this.minContinuousExtentScale;
  }

  private get minContinuousExtentScale(): number {
    const extent = this.viewExtent;
    if (!extent) return 0;
    return Math.min(
      this.maxScale,
      Math.max(this.viewport.width / extent.width, this.viewport.height / extent.height),
    );
  }

  /** Keeps the view inside `viewExtent`, zooming in about the view centre if it would be larger. */
  private clampToExtent(): void {
    const extent = this.viewExtent;
    if (!extent) return;
    const floor = this.minExtentScale;
    if (this.scale < floor) {
      const ratio = floor / this.scale;
      this.rawX = (this.rawX + this.viewport.width / 2) * ratio - this.viewport.width / 2;
      this.rawY = (this.rawY + this.viewport.height / 2) * ratio - this.viewport.height / 2;
      this.scale = floor;
    }
    const fitAxis = (offset: number, start: number, size: number, view: number) => {
      const lo = start * this.scale;
      const span = size * this.scale - view;
      return span <= 0 ? lo + span / 2 : Math.max(lo, Math.min(lo + span, offset));
    };
    this.rawX = fitAxis(this.rawX, extent.x, extent.width, this.viewport.width);
    this.rawY = fitAxis(this.rawY, extent.y, extent.height, this.viewport.height);
  }

  private clampCentre(): boolean {
    const margin = this.centreMargin;
    if (margin === undefined) return false;
    const screen = { x: this.viewport.width / 2, y: this.viewport.height / 2 };
    const centre = this.unproject(screen);
    const clamped = this.project({
      x: Math.max(-margin, Math.min(this.grid.width + margin, centre.x)),
      y: Math.max(-margin, Math.min(this.grid.height + margin, centre.y)),
    });
    this.rawX += clamped.x - screen.x;
    this.rawY += clamped.y - screen.y;
    return true;
  }

  panBy(dx: number, dy: number): void {
    this.rawX -= dx;
    this.rawY -= dy;
    this.clampToPanBounds();
  }

  /**
   * Multiplies the scale by `factor`, keeping whatever is under `at` (a screen
   * point) where it is, which is what makes a pinch feel anchored to the
   * fingers. Zooming out stops at the fitted board: further out shows nothing
   * new, just a smaller map.
   */
  zoomAt(at: ScreenPoint, factor: number): void {
    if (this.integerZoom) {
      this.zoomIntegerAt(at, factor);
      return;
    }
    const lower = Math.max(Math.min(this.fitScale(), this.maxScale), this.minExtentScale);
    const next = Math.max(lower, Math.min(this.maxScale, this.scale * factor));
    const ratio = next / this.scale;
    if (ratio === 1) return;
    this.rawX = (at.x + this.rawX) * ratio - at.x;
    this.rawY = (at.y + this.rawY) * ratio - at.y;
    this.scale = next;
    this.clampToPanBounds();
  }

  /**
   * Integer-zoom pinch and wheel: the gesture moves a continuous request, and
   * the board steps to the whole device scale nearest it (by ratio), anchored
   * on the pointer. Out stops at the whole scale that still shows the fitted
   * board, and never under a fingertip.
   */
  private zoomIntegerAt(at: ScreenPoint, factor: number): void {
    const dpr = this.viewport.dpr;
    const low =
      Math.max(
        wholeDeviceScale(Math.min(this.fitScale(), this.maxScale), dpr, 'floor'),
        this.extentDeviceScale,
        this.floorDeviceScale,
      ) / dpr;
    const high = Math.max(low, this.maxDeviceScale / dpr);
    const from =
      this.zoomIntent && this.zoomIntent.scale === this.scale ? this.zoomIntent.intent : this.scale;
    const intent = Math.max(low, Math.min(high, from * factor));
    this.setScaleAt(this.integerStop(intent), at);
    this.zoomIntent = { scale: this.scale, intent };
    this.clampToPanBounds();
  }

  /** Scrolls so a tile sits in the middle of the viewport, where possible. */
  centreOn(pos: Vec2, footprint: 1 | 2 = 1, square = SQUARE_FOOTPRINTS): void {
    const centre = square
      ? { x: pos.x + (footprint - 1) / 2, y: pos.y + (footprint - 1) / 2 }
      : pos;
    const ground = this.groundPoint({ x: centre.x + 0.5, y: centre.y + 0.5 });
    const px = ground.x * this.scale;
    const py = ground.y * this.scale;
    this.rawX = px - this.viewport.width / 2;
    this.rawY = py - this.viewport.height / 2;
    this.clamp();
  }

  /** Continuous logical ground coordinate -> unscaled world pixels. */
  groundPoint(pos: Vec2): ScreenPoint {
    const tile = this.tile;
    return { x: pos.x * tile, y: pos.y * tile };
  }

  /** A point in board units (tiles) -> unscaled world pixels; the same as `groundPoint`. */
  boardPoint(point: Vec2): ScreenPoint {
    return this.groundPoint(point);
  }

  /** The single forward transform shared by rendering, markers and pointer tests. */
  project(pos: Vec2): ScreenPoint {
    const point = this.groundPoint(pos);
    return { x: point.x * this.scale - this.offsetX, y: point.y * this.scale - this.offsetY };
  }

  unproject(pos: ScreenPoint): Vec2 {
    return {
      x: (pos.x + this.offsetX) / (this.tile * this.scale),
      y: (pos.y + this.offsetY) / (this.tile * this.scale),
    };
  }

  /** Affine transform of logical world pixels, not of upright art. */
  groundMatrix() {
    const s = this.scale;
    const origin = this.project({ x: 0, y: 0 });
    return { a: s, b: 0, c: 0, d: s, tx: origin.x, ty: origin.y };
  }

  /** A centre-compatible box. For ground geometry use project(), not its square bounds. */
  toScreen(pos: Vec2): { x: number; y: number; size: number } {
    const size = this.tile * this.scale;
    const center = this.project({ x: pos.x + 0.5, y: pos.y + 0.5 });
    return { x: center.x - size / 2, y: center.y - size / 2, size };
  }

  /** Upright art stands at the logical footprint centre, never at a skewed sprite corner. */
  spriteBox(
    pos: Vec2,
    footprint: 1 | 2 = 1,
    square = SQUARE_FOOTPRINTS,
  ): { x: number; y: number; size: number } {
    return this.toScreen(
      square ? { x: pos.x, y: footprintFoot(pos, footprint, true).y - 0.5 } : pos,
    );
  }

  /** The tile under a pointer. Every tap, hover and long press goes through this. */
  toTile(screenX: number, screenY: number): Vec2 {
    const point = this.unproject({ x: screenX, y: screenY });
    return { x: Math.floor(point.x), y: Math.floor(point.y) };
  }

  /**
   * The tile drawn under a pointer: `toTile`, now that no board lifts its tiers (ADR 0104 T7). The
   * grid argument is kept for the callers that still pass one.
   */
  pickTile(screenX: number, screenY: number, _grid?: Grid | null): Vec2 {
    return this.toTile(screenX, screenY);
  }

  /** True when any part of the tile is on screen. Used to skip drawing. */
  isVisible(pos: Vec2): boolean {
    const { x, y, size } = this.toScreen(pos);
    return x + size >= 0 && y + size >= 0 && x <= this.viewport.width && y <= this.viewport.height;
  }

  /** Inclusive tile bounds currently on screen, clipped to the grid. */
  visibleBounds(grid: Grid): { x0: number; y0: number; x1: number; y1: number } {
    const corners = [
      this.toTile(0, 0),
      this.toTile(this.viewport.width, 0),
      this.toTile(0, this.viewport.height),
      this.toTile(this.viewport.width, this.viewport.height),
    ];
    return {
      x0: Math.max(0, Math.min(...corners.map((p) => p.x)) - 2),
      y0: Math.max(0, Math.min(...corners.map((p) => p.y)) - 2),
      x1: Math.min(grid.width - 1, Math.max(...corners.map((p) => p.x)) + 2),
      y1: Math.min(grid.height - 1, Math.max(...corners.map((p) => p.y)) + 2),
    };
  }
}
