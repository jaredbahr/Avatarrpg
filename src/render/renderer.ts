/**
 * The renderer.
 *
 * Owns the camera and one backend. Everything it draws arrives as a `MapView`
 * built in `src/app` — it never reads game state, which is what makes the
 * backend swappable.
 *
 * Backends live in `backends/`: WebGL where the browser has it, Canvas 2D
 * otherwise. Callers cannot tell which is running and must not care.
 */

import type { Grid, Tile } from '../core/types';
import { Camera, TILE } from './camera';
import type { Viewport } from './camera';
import { SURFACE_STYLES } from './palettes';
import { Canvas2DBackend } from './backends/canvas2d';
import { PixiBackend } from './backends/pixi';
import type { BackendCapabilities, RenderBackend } from './backends/backend';
import { sprites } from './spriteCache';
import type { MapView } from './view';

/*
 * Re-exported so `src/app` keeps importing view types from one place. Moving
 * them to `view.ts` was a file split, not an API change.
 */
export type {
  AimArc,
  ClipName,
  EmitterInstance,
  Floater,
  MapView,
  NpcMarker,
  OverlayKind,
  OverlayLayer,
  RenderProp,
  RenderUnit,
} from './view';

export class Renderer {
  camera: Camera;
  private backend: RenderBackend;
  private observer: ResizeObserver | null = null;
  private lastView: MapView | null = null;
  private destroyed = false;

  /**
   * Called after the element's box changed and the camera has been re-measured,
   * so the owning scene can adjust the view. Combat refits an unzoomed board;
   * exploration keeps the player's zoom and map focus.
   */
  onViewportChange: (() => void) | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    grid: { width: number; height: number },
  ) {
    this.camera = new Camera(this.measure(), grid);
    this.backend = Renderer.createBackend(canvas);
    this.observe();
  }

  /**
   * Accelerated WebGL where there is a GPU, Canvas 2D otherwise. A construction
   * failure falls back rather than propagating: a plainer board beats a black
   * one, and the game is entirely playable on the 2D path.
   *
   * `?renderer=webgl` or `?renderer=canvas` forces one, which is how the e2e
   * suite covers the WebGL path on runners that have no GPU, and how you can
   * compare the two on a real device.
   */
  private static createBackend(canvas: HTMLCanvasElement): RenderBackend {
    const forced = Renderer.forcedBackend();
    if (forced === 'canvas') return new Canvas2DBackend(canvas);

    if (forced === 'webgl' || PixiBackend.isSupported()) {
      try {
        return new PixiBackend(canvas);
      } catch (error) {
        console.warn('WebGL renderer unavailable; falling back to Canvas 2D.', error);
      }
    }
    return new Canvas2DBackend(canvas);
  }

  private static forcedBackend(): 'webgl' | 'canvas' | null {
    try {
      const value = new URLSearchParams(window.location.search).get('renderer');
      return value === 'webgl' || value === 'canvas' ? value : null;
    } catch {
      return null;
    }
  }

  /** Which backend is actually running. Exposed for the e2e suite and Settings. */
  get backendName(): 'webgl' | 'canvas' {
    return this.backend.capabilities.name;
  }

  /** What the running backend can draw beyond the board itself. */
  get capabilities(): BackendCapabilities {
    return this.backend.capabilities;
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
    if (this.destroyed) return;
    const viewport = this.measure();
    this.camera.viewport = viewport;
    if (grid) this.camera.grid = grid;
    this.backend.resize(viewport);
  }

  /**
   * Re-measures whenever the canvas element's own box changes.
   *
   * A window `resize` event is not enough, and relying on one is what put the
   * hover highlight a tile or two off the cursor. The canvas is `100%` of a
   * flexed wrapper, so its height is whatever the rest of the screen leaves it:
   * the turn strip fills with portraits and the HUD with panels *after* the
   * scene mounts, the log panel toggles, fonts land later still, and the
   * Large-text setting moves all of it again. None of that fires a window
   * resize.
   *
   * A stale measurement is not merely a stale camera. `resize` sizes the
   * backing store from the same numbers, so the browser then scales the frame
   * to the box it actually has — measured here, 830 backing pixels squashed
   * into 622 CSS ones. Every pixel the renderer computes from a pointer
   * coordinate is then drawn somewhere else, by more the further down the map
   * you go, which is why the highlight drifted upwards rather than by a
   * constant amount. Keeping the two in step is the fix; nothing in `toTile`
   * needed changing.
   */
  private observe(): void {
    if (typeof ResizeObserver === 'undefined') return;

    this.observer = new ResizeObserver(() => {
      if (this.destroyed) return;
      const next = this.measure();
      const current = this.camera.viewport;
      if (
        next.width === current.width &&
        next.height === current.height &&
        next.dpr === current.dpr
      ) {
        return;
      }
      this.resize();
      this.onViewportChange?.();
      // An observer can run after this paint's animation callback. Resizing
      // clears the backing store, so redraw synchronously after the scene has
      // corrected its camera instead of exposing an empty frame until next RAF.
      if (!this.destroyed && this.lastView) this.backend.draw(this.lastView, this.camera);
    });
    this.observer.observe(this.canvas);
  }

  get viewport(): Viewport {
    return this.camera.viewport;
  }

  draw(view: MapView): void {
    if (this.destroyed) return;
    this.lastView = view;
    this.backend.draw(view, this.camera);
  }

  /** Releases GPU resources. Safe to call more than once. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.lastView = null;
    this.observer?.disconnect();
    this.observer = null;
    this.onViewportChange = null;
    this.backend.destroy();
    sprites.clear();
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
