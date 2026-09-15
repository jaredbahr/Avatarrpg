/**
 * What a rendering backend has to do.
 *
 * The `Renderer` facade owns the camera and picks one of these at construction:
 * WebGL where it is available, Canvas 2D otherwise. Neither backend reads game
 * state — both are handed a `MapView` and draw it.
 */

import type { Camera, Viewport } from '../camera';
import type { MapView } from '../view';

export interface RenderBackend {
  /** Resizes the backing store. The camera's viewport is already updated. */
  resize(viewport: Viewport): void;
  /** Draws one frame. Called on every state change and animation tick. */
  draw(view: MapView, camera: Camera): void;
  /** Releases GPU resources. */
  destroy(): void;
}
