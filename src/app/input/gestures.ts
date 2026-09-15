/**
 * Gesture recognition, with no DOM in it.
 *
 * `attachPointer` feeds raw pointer events in here and this decides what they
 * mean: a tap, a long press, a one-finger drag, a two-finger pinch, or a mouse
 * hovering. Keeping the state machine free of the DOM is what lets vitest drive
 * it with synthetic events, which matters because Playwright cannot synthesise
 * a real pinch.
 *
 * The rules a Surface or an iPad player feels:
 *
 *  - A *tap* is a press and release inside a small radius. Anything that
 *    travels further is a drag, so panning the village never accidentally
 *    walks the party somewhere.
 *  - A *long press* is the touch equivalent of right-click. It fires while the
 *    finger is still down.
 *  - A second finger turns whatever was happening into a *pinch*. The pinch
 *    reports both the spread (zoom) and the centre's travel (pan). When one
 *    finger lifts, the other keeps panning and never counts as a tap.
 *  - *Hover* only exists for a mouse or a pen. A finger reporting hover would
 *    leave a highlight stuck on the last tile touched.
 */

export interface GesturePoint {
  readonly x: number;
  readonly y: number;
}

export type PointerKind = 'mouse' | 'pen' | 'touch';

export interface PinchGesture {
  readonly centre: GesturePoint;
  /** Current spread divided by the spread when the pinch began. */
  readonly scale: number;
  /** Spread relative to the previous sample: multiply the zoom by this. */
  readonly step: number;
  /** How far the centre travelled since the previous sample. */
  readonly delta: GesturePoint;
}

export interface GestureHandlers {
  onTap?(point: GesturePoint): void;
  onLongPress?(point: GesturePoint): void;
  onDragStart?(point: GesturePoint): void;
  onDrag?(delta: GesturePoint, point: GesturePoint): void;
  onDragEnd?(point: GesturePoint): void;
  onPinchStart?(centre: GesturePoint): void;
  onPinch?(gesture: PinchGesture): void;
  onPinchEnd?(): void;
  onHover?(point: GesturePoint | null): void;
}

export interface GestureConfig {
  /** Movement beyond this many CSS pixels turns a press into a drag. */
  readonly dragThreshold: number;
  readonly longPressMs: number;
}

/** The two timer calls the recogniser needs, injectable so a test owns the clock. */
export interface GestureScheduler {
  schedule(callback: () => void, ms: number): unknown;
  cancel(handle: unknown): void;
}

export const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  dragThreshold: 10,
  longPressMs: 480,
};

const REAL_SCHEDULER: GestureScheduler = {
  schedule: (callback, ms) => setTimeout(callback, ms),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

interface Tracked {
  readonly id: number;
  point: GesturePoint;
}

type Phase =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'pressed';
      readonly id: number;
      start: GesturePoint;
      last: GesturePoint;
      longPressed: boolean;
    }
  | { readonly kind: 'dragging'; readonly id: number; last: GesturePoint }
  | {
      readonly kind: 'pinching';
      readonly a: Tracked;
      readonly b: Tracked;
      readonly startSpread: number;
      lastSpread: number;
      lastCentre: GesturePoint;
    };

const distance = (a: GesturePoint, b: GesturePoint): number => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: GesturePoint, b: GesturePoint): GesturePoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export class GestureRecognizer {
  private phase: Phase = { kind: 'idle' };
  private longPressTimer: unknown = null;

  constructor(
    private readonly handlers: GestureHandlers,
    private readonly config: GestureConfig = DEFAULT_GESTURE_CONFIG,
    private readonly scheduler: GestureScheduler = REAL_SCHEDULER,
  ) {}

  /** What the recogniser currently thinks is happening. Exposed for tests. */
  get state(): Phase['kind'] {
    return this.phase.kind;
  }

  down(id: number, point: GesturePoint, _kind: PointerKind = 'touch'): void {
    const { phase } = this;
    switch (phase.kind) {
      case 'idle':
        this.phase = { kind: 'pressed', id, start: point, last: point, longPressed: false };
        this.armLongPress(id);
        return;
      case 'pressed':
        if (id === phase.id) return;
        this.cancelLongPress();
        this.beginPinch({ id: phase.id, point: phase.last }, { id, point });
        return;
      case 'dragging':
        if (id === phase.id) return;
        this.handlers.onDragEnd?.(phase.last);
        this.beginPinch({ id: phase.id, point: phase.last }, { id, point });
        return;
      case 'pinching':
        // A third finger changes nothing; two is all a pinch needs.
        return;
    }
  }

  move(id: number, point: GesturePoint, kind: PointerKind = 'touch'): void {
    const { phase } = this;
    switch (phase.kind) {
      case 'idle':
        if (kind !== 'touch') this.handlers.onHover?.(point);
        return;
      case 'pressed': {
        if (id !== phase.id) return;
        const travelled = distance(point, phase.start);
        if (travelled > this.config.dragThreshold) {
          this.cancelLongPress();
          const last = phase.last;
          this.phase = { kind: 'dragging', id, last: point };
          this.handlers.onDragStart?.(phase.start);
          this.handlers.onDrag?.({ x: point.x - last.x, y: point.y - last.y }, point);
        } else {
          phase.last = point;
        }
        return;
      }
      case 'dragging': {
        if (id !== phase.id) return;
        const last = phase.last;
        phase.last = point;
        this.handlers.onDrag?.({ x: point.x - last.x, y: point.y - last.y }, point);
        return;
      }
      case 'pinching': {
        if (id === phase.a.id) phase.a.point = point;
        else if (id === phase.b.id) phase.b.point = point;
        else return;

        const spread = Math.max(1, distance(phase.a.point, phase.b.point));
        const centre = midpoint(phase.a.point, phase.b.point);
        this.handlers.onPinch?.({
          centre,
          scale: spread / phase.startSpread,
          step: spread / phase.lastSpread,
          delta: { x: centre.x - phase.lastCentre.x, y: centre.y - phase.lastCentre.y },
        });
        phase.lastSpread = spread;
        phase.lastCentre = centre;
        return;
      }
    }
  }

  up(id: number, point: GesturePoint): void {
    const { phase } = this;
    switch (phase.kind) {
      case 'idle':
        return;
      case 'pressed':
        if (id !== phase.id) return;
        this.cancelLongPress();
        this.phase = { kind: 'idle' };
        if (!phase.longPressed) this.handlers.onTap?.(point);
        return;
      case 'dragging':
        if (id !== phase.id) return;
        this.phase = { kind: 'idle' };
        this.handlers.onDragEnd?.(point);
        return;
      case 'pinching':
        this.endPinch(id);
        return;
    }
  }

  /** The browser took the pointer away (a system gesture, a palm). No tap, no drag end. */
  cancel(id: number): void {
    const { phase } = this;
    switch (phase.kind) {
      case 'idle':
        return;
      case 'pressed':
      case 'dragging':
        if (id !== phase.id) return;
        this.cancelLongPress();
        this.phase = { kind: 'idle' };
        return;
      case 'pinching':
        this.endPinch(id);
        return;
    }
  }

  /** The pointer left the element. Only a hovering mouse or pen cares. */
  leave(kind: PointerKind): void {
    if (kind !== 'touch') this.handlers.onHover?.(null);
  }

  reset(): void {
    this.cancelLongPress();
    this.phase = { kind: 'idle' };
  }

  /* ---------------------------------------------------------------- */

  private beginPinch(a: Tracked, b: Tracked): void {
    const spread = Math.max(1, distance(a.point, b.point));
    const centre = midpoint(a.point, b.point);
    this.phase = {
      kind: 'pinching',
      a,
      b,
      startSpread: spread,
      lastSpread: spread,
      lastCentre: centre,
    };
    this.handlers.onPinchStart?.(centre);
  }

  /**
   * One of the two pinching fingers lifted. The other carries on as a drag so
   * the map keeps following it, and its eventual release is never a tap.
   */
  private endPinch(id: number): void {
    const { phase } = this;
    if (phase.kind !== 'pinching') return;
    const remaining = id === phase.a.id ? phase.b : id === phase.b.id ? phase.a : null;
    if (!remaining) return;
    this.phase = { kind: 'dragging', id: remaining.id, last: remaining.point };
    this.handlers.onPinchEnd?.();
    this.handlers.onDragStart?.(remaining.point);
  }

  private armLongPress(id: number): void {
    if (!this.handlers.onLongPress) return;
    this.longPressTimer = this.scheduler.schedule(() => {
      this.longPressTimer = null;
      const { phase } = this;
      if (phase.kind !== 'pressed' || phase.id !== id) return;
      phase.longPressed = true;
      this.handlers.onLongPress?.(phase.last);
    }, this.config.longPressMs);
  }

  private cancelLongPress(): void {
    if (this.longPressTimer === null) return;
    this.scheduler.cancel(this.longPressTimer);
    this.longPressTimer = null;
  }
}
