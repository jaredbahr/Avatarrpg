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

export class Camera {
  /** World-space pixels per logical tile, after fitting. */
  scale = 1;
  /** Top-left of the viewport in world space. */
  offsetX = 0;
  offsetY = 0;

  private minScale = 0.35;
  private maxScale = 2.5;

  constructor(
    public viewport: Viewport,
    public grid: { width: number; height: number },
  ) {}

  get worldWidth(): number {
    return this.grid.width * TILE * this.scale;
  }

  get worldHeight(): number {
    return this.grid.height * TILE * this.scale;
  }

  /** The scale at which the whole grid fits inside the viewport with a margin. */
  fitScale(margin = 12): number {
    const usableWidth = Math.max(1, this.viewport.width - margin * 2);
    const usableHeight = Math.max(1, this.viewport.height - margin * 2);
    const scaleX = usableWidth / (this.grid.width * TILE);
    const scaleY = usableHeight / (this.grid.height * TILE);
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
      usableWidth / (this.grid.width * TILE),
      usableHeight / (this.grid.height * TILE),
    );
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, Math.max(wanted, fitScale)));
    this.centre();
  }

  centre(): void {
    this.offsetX = (this.worldWidth - this.viewport.width) / 2;
    this.offsetY = (this.worldHeight - this.viewport.height) / 2;
    this.clamp();
  }

  /** Keeps the map inside the frame; centres on whichever axis is smaller. */
  clamp(): void {
    const slackX = this.worldWidth - this.viewport.width;
    const slackY = this.worldHeight - this.viewport.height;
    this.offsetX = slackX <= 0 ? slackX / 2 : Math.max(0, Math.min(slackX, this.offsetX));
    this.offsetY = slackY <= 0 ? slackY / 2 : Math.max(0, Math.min(slackY, this.offsetY));
  }

  panBy(dx: number, dy: number): void {
    this.offsetX -= dx;
    this.offsetY -= dy;
    this.clamp();
  }

  /**
   * Multiplies the scale by `factor`, keeping whatever is under `at` (a screen
   * point) where it is, which is what makes a pinch feel anchored to the
   * fingers. Zooming out stops at the fitted board: further out shows nothing
   * new, just a smaller map.
   */
  zoomAt(at: ScreenPoint, factor: number): void {
    const lower = Math.min(this.fitScale(), this.maxScale);
    const next = Math.max(lower, Math.min(this.maxScale, this.scale * factor));
    const ratio = next / this.scale;
    if (ratio === 1) return;
    this.offsetX = (at.x + this.offsetX) * ratio - at.x;
    this.offsetY = (at.y + this.offsetY) * ratio - at.y;
    this.scale = next;
    this.clamp();
  }

  /** Scrolls so a tile sits in the middle of the viewport, where possible. */
  centreOn(pos: Vec2): void {
    const px = (pos.x + 0.5) * TILE * this.scale;
    const py = (pos.y + 0.5) * TILE * this.scale;
    this.offsetX = px - this.viewport.width / 2;
    this.offsetY = py - this.viewport.height / 2;
    this.clamp();
  }

  /** Tile coordinate -> top-left screen pixel of that tile. */
  toScreen(pos: Vec2): { x: number; y: number; size: number } {
    const size = TILE * this.scale;
    return {
      x: pos.x * size - this.offsetX,
      y: pos.y * size - this.offsetY,
      size,
    };
  }

  /** Screen pixel -> tile coordinate. May be outside the grid; callers check. */
  toTile(screenX: number, screenY: number): Vec2 {
    const size = TILE * this.scale;
    return {
      x: Math.floor((screenX + this.offsetX) / size),
      y: Math.floor((screenY + this.offsetY) / size),
    };
  }

  /** True when any part of the tile is on screen. Used to skip drawing. */
  isVisible(pos: Vec2): boolean {
    const { x, y, size } = this.toScreen(pos);
    return x + size >= 0 && y + size >= 0 && x <= this.viewport.width && y <= this.viewport.height;
  }

  /** Inclusive tile bounds currently on screen, clipped to the grid. */
  visibleBounds(grid: Grid): { x0: number; y0: number; x1: number; y1: number } {
    const topLeft = this.toTile(0, 0);
    const bottomRight = this.toTile(this.viewport.width, this.viewport.height);
    return {
      x0: Math.max(0, topLeft.x - 1),
      y0: Math.max(0, topLeft.y - 1),
      x1: Math.min(grid.width - 1, bottomRight.x + 1),
      y1: Math.min(grid.height - 1, bottomRight.y + 1),
    };
  }
}
