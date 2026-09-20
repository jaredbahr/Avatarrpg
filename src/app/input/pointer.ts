/**
 * Pointer handling for the canvas.
 *
 * Touch, pen and mouse all arrive as Pointer Events and go through one
 * `GestureRecognizer` (see `gestures.ts` for what a tap, a drag and a pinch
 * mean). This file is only the DOM adapter: it captures pointers, converts
 * client coordinates to canvas-local ones, keeps the browser's own long-press
 * menu and page zoom out of the way, and turns a wheel into a zoom request.
 *
 * Two things a Surface or an iPad relies on:
 *
 *  - Pointer capture, so a finger that slides off the canvas mid-drag still
 *    ends the drag here rather than leaving the camera half-panned.
 *  - `wheel` with `passive: false`, because a trackpad pinch arrives as a
 *    ctrl+wheel and the page would zoom instead of the map.
 */

import { DEFAULT_GESTURE_CONFIG, GestureRecognizer } from './gestures';
import type { GestureHandlers, GesturePoint, PointerKind } from './gestures';

export type PointerPoint = GesturePoint;

export interface WheelGesture {
  readonly point: GesturePoint;
  /** Positive scrolls down (zoom out); already normalised to pixels. */
  readonly deltaY: number;
  /** A trackpad pinch on a desktop browser arrives as a wheel with ctrl held. */
  readonly ctrl: boolean;
}

export interface PointerHandlers extends GestureHandlers {
  onWheel?(gesture: WheelGesture): void;
}

/**
 * Zoom multiplier for one wheel event. A mouse notch (about 100 units) is
 * roughly 20%; a trackpad pinch sends many small ctrl+wheel events and wants
 * to be finer per event but quicker overall.
 */
export function wheelZoomFactor(wheel: WheelGesture): number {
  return Math.exp(-wheel.deltaY * (wheel.ctrl ? 0.01 : 0.002));
}

const kindOf = (event: PointerEvent): PointerKind =>
  event.pointerType === 'mouse' ? 'mouse' : event.pointerType === 'pen' ? 'pen' : 'touch';

export function attachPointer(target: HTMLElement, handlers: PointerHandlers): () => void {
  const recognizer = new GestureRecognizer(handlers, DEFAULT_GESTURE_CONFIG);

  const local = (event: { clientX: number; clientY: number }): GesturePoint => {
    const rect = target.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  // Capture can refuse a pointer the browser no longer considers active (a
  // synthetic event, a pointer cancelled mid-flight). Losing capture is
  // harmless; throwing out of the handler is not.
  const capture = (event: PointerEvent) => {
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      /* not capturable */
    }
  };
  const release = (event: PointerEvent) => {
    try {
      if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    // Right and middle mouse buttons are not presses; right-click has its own
    // path through `contextmenu` below.
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    capture(event);
    recognizer.down(event.pointerId, local(event), kindOf(event));
  };

  const onPointerMove = (event: PointerEvent) => {
    recognizer.move(event.pointerId, local(event), kindOf(event));
  };

  const onPointerUp = (event: PointerEvent) => {
    release(event);
    recognizer.up(event.pointerId, local(event));
  };

  const onPointerCancel = (event: PointerEvent) => {
    release(event);
    recognizer.cancel(event.pointerId);
  };

  const onPointerLeave = (event: PointerEvent) => {
    recognizer.leave(kindOf(event));
  };

  // Stops the browser's own long-press menu fighting the inspector, and makes
  // a mouse right-click the same thing as a long press.
  const onContextMenu = (event: Event) => {
    event.preventDefault();
    if (event instanceof MouseEvent && handlers.onLongPress) handlers.onLongPress(local(event));
  };

  const onWheel = (event: WheelEvent) => {
    if (!handlers.onWheel) return;
    event.preventDefault();
    // deltaMode 1 is lines, 2 is pages; both are rare but real on Windows.
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 240 : 1;
    handlers.onWheel({ point: local(event), deltaY: event.deltaY * unit, ctrl: event.ctrlKey });
  };

  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointermove', onPointerMove);
  target.addEventListener('pointerup', onPointerUp);
  target.addEventListener('pointercancel', onPointerCancel);
  target.addEventListener('pointerleave', onPointerLeave);
  target.addEventListener('contextmenu', onContextMenu);
  target.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    recognizer.reset();
    target.removeEventListener('pointerdown', onPointerDown);
    target.removeEventListener('pointermove', onPointerMove);
    target.removeEventListener('pointerup', onPointerUp);
    target.removeEventListener('pointercancel', onPointerCancel);
    target.removeEventListener('pointerleave', onPointerLeave);
    target.removeEventListener('contextmenu', onContextMenu);
    target.removeEventListener('wheel', onWheel);
  };
}
