/**
 * The camera.
 *
 * Combat maps auto-fit: the whole 20x12 grid is always on screen with the HUD
 * docked, because a tactics fight where you have to scroll to see the enemy is
 * a tactics fight nobody can plan. Explore maps are larger than the viewport
 * and pan by drag, clamped so the map edge never leaves the frame.
 */

import type { Grid, Vec2 } from '../core/types';

/** Logical tile size before the fit scale is applied. */
export const TILE = 64;

export interface Viewport {
  readonly width: number;
  readonly height: number;
  /** devicePixelRatio, so the canvas is crisp on a Surface. */
  readonly dpr: number;
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

  /**
   * Scales so the entire grid fits inside the viewport with a small margin,
   * then centres it. Used for every combat map on every resize.
   */
  fit(margin = 12): void {
    const usableWidth = Math.max(1, this.viewport.width - margin * 2);
    const usableHeight = Math.max(1, this.viewport.height - margin * 2);
    const scaleX = usableWidth / (this.grid.width * TILE);
    const scaleY = usableHeight / (this.grid.height * TILE);
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, Math.min(scaleX, scaleY)));
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
