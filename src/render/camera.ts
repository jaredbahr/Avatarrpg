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
 * Explore maps are larger than the viewport and pan by drag, clamped so the
 * map edge never leaves the frame.
 */

import type { Grid, Vec2 } from '../core/types';
import { SQUARE_FOOTPRINTS, footprintFoot } from '../core/rules/footprint';
import { groundBounds, projectGround, unprojectGround } from './projection';
import type { Projection } from './projection';
import { pickCell } from './geometry/elevation';
import { renderFoot } from './renderFoot';

/** Logical tile size before the fit scale is applied. */
export const TILE = 64;

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

/** A convex polygon in screen/world coordinates, closed implicitly. */
export type ConvexPolygon = readonly ScreenPoint[];

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

const PAN_FOCUS_MARGIN_TILES = 0.5;
const OFFSET_WRITE_EPSILON = 1e-6;

function clampOffset(offset: number, slack: number): number {
  return slack <= 0 ? slack / 2 : Math.max(0, Math.min(slack, offset));
}

function cross(a: ScreenPoint, b: ScreenPoint, point: ScreenPoint): number {
  return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
}

function convexHull(points: readonly ScreenPoint[]): ScreenPoint[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const unique = sorted.filter(
    (point, index) =>
      index === 0 || point.x !== sorted[index - 1]?.x || point.y !== sorted[index - 1]?.y,
  );
  if (unique.length <= 1) return unique;

  const half = (ordered: readonly ScreenPoint[]) => {
    const result: ScreenPoint[] = [];
    for (const point of ordered) {
      while (
        result.length >= 2 &&
        cross(result[result.length - 2] ?? point, result[result.length - 1] ?? point, point) <= 0
      )
        result.pop();
      result.push(point);
    }
    return result;
  };
  const lower = half(unique);
  const upper = half([...unique].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function nearestPointOnSegment(
  point: ScreenPoint,
  start: ScreenPoint,
  end: ScreenPoint,
): ScreenPoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared
    ? Math.max(
        0,
        Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
      )
    : 0;
  return { x: start.x + dx * t, y: start.y + dy * t };
}

function clampToConvexHull(point: ScreenPoint, hull: ConvexPolygon): ScreenPoint {
  const first = hull[0];
  if (!first) return point;
  if (hull.length === 1) return first;
  const second = hull[1];
  if (!second) return first;
  if (hull.length === 2) {
    // A fitted axis makes M an axis-aligned segment. Keep the free coordinate
    // on clampOffset's arithmetic path so this face is bit-identical to clamp().
    if (first.x === second.x)
      return { x: first.x, y: clampOffset(point.y - first.y, second.y - first.y) + first.y };
    if (first.y === second.y)
      return { x: clampOffset(point.x - first.x, second.x - first.x) + first.x, y: first.y };
    return nearestPointOnSegment(point, first, second);
  }
  if (
    hull.every((start, index) => cross(start, hull[(index + 1) % hull.length] ?? start, point) >= 0)
  )
    return point;

  let nearest = first;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < hull.length; index += 1) {
    const start = hull[index];
    const end = hull[(index + 1) % hull.length];
    if (!start || !end) continue;
    const candidate = nearestPointOnSegment(point, start, end);
    const distance = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2;
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export interface CameraClampRing {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

const NO_CLAMP_RING: CameraClampRing = { top: 0, right: 0, bottom: 0, left: 0 };

export class Camera {
  /** Screen (CSS) pixels per world pixel; a tile is `TILE * scale` CSS pixels. */
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
   * N x N device pixels. Set for the oblique pixel-art boards; the
   * orthographic boards keep their continuous fit.
   */
  integerZoom = false;

  private minScale = 0.35;
  private maxScale = 2.5;

  constructor(
    public viewport: Viewport,
    public grid: { width: number; height: number },
    public projection: Projection = 'orthographic',
    /** Painted ground outside the grid that may remain visible while panning. */
    public clampRingTiles: CameraClampRing = NO_CLAMP_RING,
  ) {}

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

  /** The largest whole device scale `maxScale` allows, and never less than one. */
  private get maxDeviceScale(): number {
    return Math.max(1, wholeDeviceScale(this.maxScale, this.viewport.dpr, 'floor'));
  }

  /** The smallest whole device scale at which a tile is still a fingertip (`MIN_TILE_PX`). */
  private get tappableDeviceScale(): number {
    return wholeDeviceScale(MIN_TILE_PX / TILE, this.viewport.dpr, 'ceil');
  }

  /** The smallest whole device scale that keeps the view inside `viewExtent` (1 without one). */
  private get extentDeviceScale(): number {
    return this.viewExtent
      ? wholeDeviceScale(this.minContinuousExtentScale, this.viewport.dpr, 'ceil')
      : 1;
  }

  /** Sets a whole device scale, anchored on a screen point, inside the scale limits. */
  private setDeviceScale(device: number, at: ScreenPoint): void {
    const next = Math.max(this.extentDeviceScale, Math.min(this.maxDeviceScale, device));
    const scale = next / this.viewport.dpr;
    const ratio = scale / this.scale;
    if (ratio === 1) return;
    // Anchored on what is drawn (the snapped offsets), so the ground under the
    // pointer moves by at most the new snap: half a device pixel.
    this.rawX = (at.x + this.offsetX) * ratio - at.x;
    this.rawY = (at.y + this.offsetY) * ratio - at.y;
    this.scale = scale;
  }

  /**
   * Puts a scale left off the grid (a dpr change, a tween stopped part way)
   * back on the nearest whole device scale about the view centre, then clamps.
   * A no-op when integer zoom is off or the scale is already whole.
   */
  resnap(): void {
    if (!this.integerZoom || this.onWholeDevicePixels) return;
    this.zoomIntent = null;
    this.setDeviceScale(wholeDeviceScale(this.scale, this.viewport.dpr, 'nearest'), {
      x: this.viewport.width / 2,
      y: this.viewport.height / 2,
    });
    this.clampToPanBounds();
  }

  /**
   * Raises a zoomed-out board back to its fit after the viewport grew, keeping
   * a closer zoom as it is; the integer grid's fit is the whole scale at or
   * under the continuous one, so the board still fits.
   */
  raiseToFit(): void {
    const fit = this.snapScale(this.fitScale(), 'floor');
    if (this.scale < fit) {
      this.zoomIntent = null;
      this.scale = fit;
    }
    this.resnap();
    this.clampToPanBounds();
  }

  /** Opts irregular maps into the manual-pan hull reachable by programmatic centring. */
  clampToProgrammaticReachableSet = false;
  /** When present, keeps the viewport centre inside the map plus this tile margin. */
  centreMargin?: number;
  /**
   * A scene's painted rectangle in world pixels. When set, the whole view stays inside it (so the edge of
   * the art is never on screen), zoom-out stops where the view just fits it, and a viewport larger than
   * it in either axis is centred on it. Unset, the usual bounds apply.
   */
  viewExtent?: { x: number; y: number; width: number; height: number };

  private get bounds() {
    return groundBounds(this.grid.width, this.grid.height, this.projection);
  }

  get worldWidth(): number {
    return this.bounds.width * TILE * this.scale;
  }

  get worldHeight(): number {
    return this.bounds.height * TILE * this.scale;
  }

  /** The scale at which the whole grid fits inside the viewport with a margin. */
  fitScale(margin = 12): number {
    const usableWidth = Math.max(1, this.viewport.width - margin * 2);
    const usableHeight = Math.max(1, this.viewport.height - margin * 2);
    const scaleX = usableWidth / (this.bounds.width * TILE);
    const scaleY = usableHeight / (this.bounds.height * TILE);
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
    const tappable = MIN_TILE_PX / TILE;
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
  fitExplore(preferredTilePx = 48, margin = 12): void {
    const wanted = preferredTilePx / TILE;
    const usableWidth = Math.max(1, this.viewport.width - margin * 2);
    const usableHeight = Math.max(1, this.viewport.height - margin * 2);
    const fitScale = Math.min(
      usableWidth / (this.bounds.width * TILE),
      usableHeight / (this.bounds.height * TILE),
    );
    this.zoomIntent = null;
    if (this.integerZoom) {
      // The whole device scale nearest the preferred tile (by ratio, so 1.5
      // CSS at 1 dpr is 2, not 1), a small board's fit if that is larger, and
      // never under a fingertip: the explore and combat views are both read
      // up close, and a pinch reaches the rest.
      const dpr = this.viewport.dpr;
      const device = Math.max(
        wholeDeviceScale(wanted, dpr, 'nearest'),
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

  /** Manual gestures may expose authored paint, but only on an overflowing axis. */
  clampToPanBounds(): void {
    if (this.clampCentre()) {
      this.clampToExtent();
      return;
    }
    const slackX = this.worldWidth - this.viewport.width;
    const slackY = this.worldHeight - this.viewport.height;
    if (this.clampToProgrammaticReachableSet) {
      this.clampToReachableSet();
      this.clampToExtent();
      return;
    }
    const pixels = (tiles: number) => Math.max(0, tiles) * TILE * this.scale;
    this.rawX =
      slackX <= 0
        ? slackX / 2
        : Math.max(
            -pixels(this.clampRingTiles.left),
            Math.min(slackX + pixels(this.clampRingTiles.right), this.rawX),
          );
    this.rawY =
      slackY <= 0
        ? slackY / 2
        : Math.max(
            -pixels(this.clampRingTiles.top),
            Math.min(slackY + pixels(this.clampRingTiles.bottom), this.rawY),
          );
    this.clampToExtent();
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

  /** Exact convex hull of offsets reachable by programmatic focus within F. */
  programmaticReachableHull(): ConvexPolygon {
    const slackX = this.worldWidth - this.viewport.width;
    const slackY = this.worldHeight - this.viewport.height;
    const focus = [
      { x: PAN_FOCUS_MARGIN_TILES, y: PAN_FOCUS_MARGIN_TILES },
      { x: this.grid.width - PAN_FOCUS_MARGIN_TILES, y: PAN_FOCUS_MARGIN_TILES },
      {
        x: this.grid.width - PAN_FOCUS_MARGIN_TILES,
        y: this.grid.height - PAN_FOCUS_MARGIN_TILES,
      },
      { x: PAN_FOCUS_MARGIN_TILES, y: this.grid.height - PAN_FOCUS_MARGIN_TILES },
    ].map((point) => this.groundPoint(point));
    const candidates = focus.map((point) => ({
      x: clampOffset(point.x * this.scale - this.viewport.width / 2, slackX),
      y: clampOffset(point.y * this.scale - this.viewport.height / 2, slackY),
    }));
    const emitBreakCrossings = (axis: 'x' | 'y', breakLine: number, brokenOffset: number) => {
      for (let index = 0; index < focus.length; index += 1) {
        const start = focus[index];
        const end = focus[(index + 1) % focus.length];
        if (!start || !end) continue;
        if (!(
          (start[axis] < breakLine && end[axis] > breakLine) ||
          (start[axis] > breakLine && end[axis] < breakLine)
        ))
          continue;
        const t = (breakLine - start[axis]) / (end[axis] - start[axis]);
        const crossing = {
          x: start.x + (end.x - start.x) * t,
          y: start.y + (end.y - start.y) * t,
        };
        candidates.push(
          axis === 'x'
            ? {
                x: brokenOffset,
                y: clampOffset(crossing.y * this.scale - this.viewport.height / 2, slackY),
              }
            : {
                x: clampOffset(crossing.x * this.scale - this.viewport.width / 2, slackX),
                y: brokenOffset,
              },
        );
      }
    };

    if (slackX > 0) {
      emitBreakCrossings('x', this.viewport.width / (2 * this.scale), 0);
      emitBreakCrossings(
        'x',
        this.bounds.width * TILE - this.viewport.width / (2 * this.scale),
        slackX,
      );
    }
    if (slackY > 0) {
      emitBreakCrossings('y', this.viewport.height / (2 * this.scale), 0);
      emitBreakCrossings(
        'y',
        this.bounds.height * TILE - this.viewport.height / (2 * this.scale),
        slackY,
      );
    }

    // T clamps each coordinate independently. Its affine subdivision of F has
    // vertices not only on F's boundary, but also where an x and y break line
    // meet inside F. Their images are required for exactly conv(T(F)); without
    // them the hull can lose a real corner as a break line enters/leaves F.
    const xBreaks =
      slackX > 0
        ? [
            this.viewport.width / (2 * this.scale),
            this.bounds.width * TILE - this.viewport.width / (2 * this.scale),
          ]
        : [];
    const yBreaks =
      slackY > 0
        ? [
            this.viewport.height / (2 * this.scale),
            this.bounds.height * TILE - this.viewport.height / (2 * this.scale),
          ]
        : [];
    for (const x of xBreaks)
      for (const y of yBreaks) {
        const point = { x, y };
        if (
          focus.every(
            (start, index) =>
              cross(start, focus[(index + 1) % focus.length] ?? start, point) >= -1e-9,
          )
        )
          candidates.push({
            x: clampOffset(x * this.scale - this.viewport.width / 2, slackX),
            y: clampOffset(y * this.scale - this.viewport.height / 2, slackY),
          });
      }

    return convexHull(candidates);
  }

  private clampToReachableSet(): void {
    const next = clampToConvexHull(
      { x: this.rawX, y: this.rawY },
      this.programmaticReachableHull(),
    );
    if (Math.hypot(next.x - this.rawX, next.y - this.rawY) <= OFFSET_WRITE_EPSILON) return;
    this.rawX = next.x;
    this.rawY = next.y;
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
   * board, never under one device pixel per world pixel.
   */
  private zoomIntegerAt(at: ScreenPoint, factor: number): void {
    const dpr = this.viewport.dpr;
    const low = Math.max(
      wholeDeviceScale(Math.min(this.fitScale(), this.maxScale), dpr, 'floor'),
      this.extentDeviceScale,
    );
    const high = Math.max(low, this.maxDeviceScale);
    const from =
      this.zoomIntent && this.zoomIntent.scale === this.scale ? this.zoomIntent.intent : this.scale;
    const intent = Math.max(low / dpr, Math.min(high / dpr, from * factor));
    const device = Math.max(low, Math.min(high, wholeDeviceScale(intent, dpr, 'nearest')));
    this.setDeviceScale(device, at);
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

  /** Continuous logical ground coordinate -> unscaled projected world pixels. */
  groundPoint(pos: Vec2): ScreenPoint {
    return this.boardPoint(projectGround(pos, this.projection));
  }

  /** A point already in board units (projected tiles) -> unscaled world pixels. */
  boardPoint(point: Vec2): ScreenPoint {
    return { x: (point.x - this.bounds.minX) * TILE, y: (point.y - this.bounds.minY) * TILE };
  }

  /** The single forward transform shared by rendering, markers and pointer tests. */
  project(pos: Vec2): ScreenPoint {
    const point = this.groundPoint(pos);
    return { x: point.x * this.scale - this.offsetX, y: point.y * this.scale - this.offsetY };
  }

  unproject(pos: ScreenPoint): Vec2 {
    return unprojectGround(
      {
        x: (pos.x + this.offsetX) / (TILE * this.scale) + this.bounds.minX,
        y: (pos.y + this.offsetY) / (TILE * this.scale) + this.bounds.minY,
      },
      this.projection,
    );
  }

  /** Affine transform of logical world pixels, not of upright art. */
  groundMatrix() {
    const s = this.scale;
    const origin = this.project({ x: 0, y: 0 });
    return this.projection === 'oblique'
      ? { a: s, b: s / 2, c: -s, d: s / 2, tx: origin.x, ty: origin.y }
      : { a: s, b: 0, c: 0, d: s, tx: origin.x, ty: origin.y };
  }

  /** A centre-compatible box. For ground geometry use project(), not its square bounds. */
  toScreen(pos: Vec2): { x: number; y: number; size: number } {
    const size = TILE * this.scale;
    const center = this.project({ x: pos.x + 0.5, y: pos.y + 0.5 });
    return { x: center.x - size / 2, y: center.y - size / 2, size };
  }

  /** Upright art stands at the logical footprint centre, never at a skewed sprite corner. */
  spriteBox(
    pos: Vec2,
    footprint: 1 | 2 = 1,
    square = SQUARE_FOOTPRINTS,
  ): { x: number; y: number; size: number } {
    if (this.projection === 'orthographic') {
      return this.toScreen(
        square ? { x: pos.x, y: footprintFoot(pos, footprint, true).y - 0.5 } : pos,
      );
    }
    const size = TILE * this.scale;
    const foot = this.project(renderFoot(pos, footprint, square, this.projection));
    return { x: foot.x - (size * footprint) / 2, y: foot.y - size * 0.86, size };
  }

  toTile(screenX: number, screenY: number): Vec2 {
    const point = this.unproject({ x: screenX, y: screenY });
    return { x: Math.floor(point.x), y: Math.floor(point.y) };
  }

  /**
   * The tile drawn under a pointer: like `toTile`, but a raised tile's lifted
   * top and faces pick that tile rather than the flat one they cover
   * (`pickCell`). Every tap, hover and long press goes through this.
   */
  pickTile(screenX: number, screenY: number, grid: Grid | null | undefined): Vec2 {
    const point = this.unproject({ x: screenX, y: screenY });
    return grid
      ? pickCell(grid, point, this.projection)
      : { x: Math.floor(point.x), y: Math.floor(point.y) };
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
