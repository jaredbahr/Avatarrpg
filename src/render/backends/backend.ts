/**
 * What a rendering backend has to do.
 *
 * The `Renderer` facade owns the camera and picks one of these at construction:
 * WebGL where it is accelerated, Canvas 2D otherwise. Neither backend reads
 * game state — both are handed a `MapView` and draw it.
 *
 * The parity rule between them: **board-correctness parity is mandatory,
 * fidelity parity is not.** Anything the rules care about — terrain, surfaces,
 * elevation, blocked tiles, cover, units, props, overlays, health, statuses,
 * floating numbers — must read the same on both. Animated water, firelight
 * and particles are fidelity, and the Canvas 2D backend does not owe them;
 * `capabilities` says which it has, so a scene can ask instead of guessing.
 */

import type { Camera, Viewport } from '../camera';
import type { MapView } from '../view';

export interface BackendCapabilities {
  readonly name: 'webgl' | 'canvas';
  /** Animated ground: surfaces that ripple and burn, firelight on neighbours. */
  readonly shaders: boolean;
  /** Particle effects for abilities. */
  readonly particles: boolean;
}

export interface RenderBackend {
  readonly capabilities: BackendCapabilities;
  /** Resizes the backing store. The camera's viewport is already updated. */
  resize(viewport: Viewport): void;
  /** Draws one frame. Called on every state change and animation tick. */
  draw(view: MapView, camera: Camera): void;
  /** Releases GPU resources. */
  destroy(): void;
}
