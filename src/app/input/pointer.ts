/**
 * Pointer handling for the canvas.
 *
 * Touch and mouse go through the same Pointer Events path, with the
 * distinctions that actually matter on a Surface:
 *
 *  - A *tap* is a press and release inside a small radius. Anything that
 *    travels further is a drag, so panning the village never accidentally
 *    walks the party somewhere.
 *  - A *long press* is the touch equivalent of right-click, and opens the unit
 *    inspector. It fires while the finger is still down, with a short vibration
 *    where that is supported, so it is discoverable.
 *  - Hover only exists for a mouse. Reporting a phantom hover from a finger
 *    would leave a highlight stuck on the last tile touched.
 */

export interface PointerPoint {
  readonly x: number;
  readonly y: number;
}

export interface PointerHandlers {
  onTap?(point: PointerPoint): void;
  onLongPress?(point: PointerPoint): void;
  onDragStart?(point: PointerPoint): void;
  onDrag?(delta: PointerPoint, point: PointerPoint): void;
  onDragEnd?(point: PointerPoint): void;
  onHover?(point: PointerPoint | null): void;
}

/** Movement beyond this many CSS pixels turns a press into a drag. */
const DRAG_THRESHOLD = 10;
const LONG_PRESS_MS = 480;

export function attachPointer(target: HTMLElement, handlers: PointerHandlers): () => void {
  let activeId: number | null = null;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let dragging = false;
  let longPressed = false;
  let longPressTimer: number | null = null;

  const local = (event: PointerEvent): PointerPoint => {
    const rect = target.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const cancelLongPress = () => {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (activeId !== null) return;
    activeId = event.pointerId;
    target.setPointerCapture(event.pointerId);

    const point = local(event);
    startX = point.x;
    startY = point.y;
    lastX = point.x;
    lastY = point.y;
    dragging = false;
    longPressed = false;

    if (handlers.onLongPress) {
      longPressTimer = window.setTimeout(() => {
        if (dragging || activeId === null) return;
        longPressed = true;
        // A short buzz makes long-press discoverable without a tutorial.
        navigator.vibrate?.(12);
        handlers.onLongPress?.({ x: lastX, y: lastY });
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    const point = local(event);

    if (activeId !== event.pointerId) {
      if (event.pointerType === 'mouse') handlers.onHover?.(point);
      return;
    }

    const totalDx = point.x - startX;
    const totalDy = point.y - startY;

    if (!dragging && Math.hypot(totalDx, totalDy) > DRAG_THRESHOLD) {
      dragging = true;
      cancelLongPress();
      handlers.onDragStart?.({ x: startX, y: startY });
    }

    if (dragging) {
      handlers.onDrag?.({ x: point.x - lastX, y: point.y - lastY }, point);
    }

    lastX = point.x;
    lastY = point.y;
  };

  const finish = (event: PointerEvent) => {
    if (activeId !== event.pointerId) return;
    cancelLongPress();

    const point = local(event);
    if (dragging) handlers.onDragEnd?.(point);
    else if (!longPressed) handlers.onTap?.(point);

    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    activeId = null;
    dragging = false;
    longPressed = false;
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (activeId !== event.pointerId) return;
    cancelLongPress();
    activeId = null;
    dragging = false;
    longPressed = false;
  };

  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') handlers.onHover?.(null);
  };

  // Stops the browser's own long-press menu fighting the inspector.
  const onContextMenu = (event: Event) => {
    event.preventDefault();
    if (event instanceof MouseEvent && handlers.onLongPress) {
      const rect = target.getBoundingClientRect();
      handlers.onLongPress({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
  };

  target.addEventListener('pointerdown', onPointerDown);
  target.addEventListener('pointermove', onPointerMove);
  target.addEventListener('pointerup', finish);
  target.addEventListener('pointercancel', onPointerCancel);
  target.addEventListener('pointerleave', onPointerLeave);
  target.addEventListener('contextmenu', onContextMenu);

  return () => {
    cancelLongPress();
    target.removeEventListener('pointerdown', onPointerDown);
    target.removeEventListener('pointermove', onPointerMove);
    target.removeEventListener('pointerup', finish);
    target.removeEventListener('pointercancel', onPointerCancel);
    target.removeEventListener('pointerleave', onPointerLeave);
    target.removeEventListener('contextmenu', onContextMenu);
  };
}
