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
import type { RenderBackend } from './backends/backend';
import { sprites } from './spriteCache';
import type { MapView } from './view';

/*
 * Re-exported so `src/app` keeps importing view types from one place. Moving
 * them to `view.ts` was a file split, not an API change.
 */
export type {
  Floater,
  FxInstance,
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

  constructor(
    private canvas: HTMLCanvasElement,
    grid: { width: number; height: number },
  ) {
    this.camera = new Camera(this.measure(), grid);
    this.backend = Renderer.createBackend(canvas);
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
    return this.backend instanceof PixiBackend ? 'webgl' : 'canvas';
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
    const viewport = this.measure();
    this.camera.viewport = viewport;
    if (grid) this.camera.grid = grid;
    this.backend.resize(viewport);
  }

  get viewport(): Viewport {
    return this.camera.viewport;
  }

  draw(view: MapView): void {
    this.backend.draw(view, this.camera);
  }

  /** Releases GPU resources. Safe to call more than once. */
  destroy(): void {
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
