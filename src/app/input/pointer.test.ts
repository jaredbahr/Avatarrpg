import { describe, expect, it, vi } from 'vitest';
import { attachPointer } from './pointer';

/** Only the DOM surface the adapter uses; events still use real EventTarget dispatch. */
class PointerTarget extends EventTarget {
  readonly ownerDocument = new EventTarget();
  readonly captures: number[] = [];
  readonly releases: number[] = [];
  loseCaptureOnRelease = false;
  private readonly captured = new Set<number>();

  getBoundingClientRect(): Pick<DOMRect, 'left' | 'top'> {
    return { left: 100, top: 200 };
  }

  setPointerCapture(id: number): void {
    this.captures.push(id);
    this.captured.add(id);
  }

  hasPointerCapture(id: number): boolean {
    return this.captured.has(id);
  }

  releasePointerCapture(id: number): void {
    this.releases.push(id);
    this.captured.delete(id);
    if (this.loseCaptureOnRelease)
      this.loseCapture(id, { pointerType: 'touch', button: 0, buttons: 0 });
  }

  contains(node: Node): boolean {
    return node === (this as unknown as Node);
  }

  /** The browser clears capture before notifying the previous capture target. */
  loseCapture(id: number, contact: Contact): void {
    this.captured.delete(id);
    fire(this, 'lostpointercapture', contact, id);
  }
}

interface Contact {
  readonly pointerType: 'pen' | 'touch' | 'mouse';
  readonly button: number;
  readonly buttons: number;
}

function fire(
  target: PointerTarget,
  type: 'pointerdown' | 'pointerup' | 'pointermove' | 'lostpointercapture',
  contact: Contact,
  pointerId = 7,
  point = { x: 130, y: 240 },
): void {
  target.dispatchEvent(
    Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
      ...contact,
      pointerId,
      isPrimary: true,
      clientX: point.x,
      clientY: point.y,
      buttons: type === 'pointerup' ? 0 : contact.buttons,
    }),
  );
}

const NON_PRIMARY_CONTACTS: readonly Contact[] = [
  { pointerType: 'pen', button: 5, buttons: 32 },
  { pointerType: 'pen', button: 2, buttons: 2 },
  { pointerType: 'mouse', button: 1, buttons: 4 },
  { pointerType: 'mouse', button: 2, buttons: 2 },
];

describe('pointer adapter contact buttons', () => {
  it.each(NON_PRIMARY_CONTACTS)(
    'ignores $pointerType button $button without capturing it or tapping',
    (contact) => {
      const target = new PointerTarget();
      const onTap = vi.fn();
      const detach = attachPointer(target as unknown as HTMLElement, { onTap });

      fire(target, 'pointerdown', contact);
      fire(target, 'pointerup', contact);

      expect(target.captures).toEqual([]);
      expect(target.releases).toEqual([]);
      expect(onTap).not.toHaveBeenCalled();
      detach();
    },
  );

  it.each(['pen', 'touch', 'mouse'] as const)(
    'captures and taps a primary %s contact in canvas-local coordinates',
    (pointerType) => {
      const target = new PointerTarget();
      const onTap = vi.fn();
      const detach = attachPointer(target as unknown as HTMLElement, { onTap });
      const contact = { pointerType, button: 0, buttons: 1 };

      fire(target, 'pointerdown', contact);
      fire(target, 'pointerup', contact);

      expect(target.captures).toEqual([7]);
      expect(target.releases).toEqual([7]);
      expect(onTap).toHaveBeenCalledTimes(1);
      expect(onTap).toHaveBeenCalledWith({ x: 30, y: 40 });
      detach();
    },
  );

  it('keeps a canvas touch click from activating an overlapping control', () => {
    vi.useFakeTimers();
    const canvas = new PointerTarget();
    canvas.loseCaptureOnRelease = true;
    const onTap = vi.fn();
    const detach = attachPointer(canvas as unknown as HTMLElement, { onTap });
    const touch = { pointerType: 'touch', button: 0, buttons: 1 } as const;

    try {
      fire(canvas, 'pointerdown', touch);
      fire(canvas, 'pointerup', touch);
      const retargetedClick = Object.assign(
        new Event('click', { bubbles: true, cancelable: true }),
        { detail: 1, pointerId: 7, pointerType: 'touch' },
      );
      canvas.ownerDocument.dispatchEvent(retargetedClick);

      expect(onTap).toHaveBeenCalledTimes(1);
      expect(retargetedClick.defaultPrevented).toBe(true);
    } finally {
      detach();
      vi.useRealTimers();
    }
  });

  it('does not arm a click after lost capture and pointer ID reuse on a control', () => {
    vi.useFakeTimers();
    const canvas = new PointerTarget();
    const detach = attachPointer(canvas as unknown as HTMLElement, {});
    const touch = { pointerType: 'touch', button: 0, buttons: 1 } as const;

    try {
      fire(canvas, 'pointerdown', touch);
      canvas.loseCapture(7, touch);
      // The same ID starts on a control and ends over the canvas.
      fire(canvas.ownerDocument as unknown as PointerTarget, 'pointerdown', touch);
      fire(canvas, 'pointerup', touch);
      const click = Object.assign(new Event('click', { bubbles: true, cancelable: true }), {
        detail: 1,
        pointerId: 7,
        pointerType: 'touch',
      });
      canvas.ownerDocument.dispatchEvent(click);

      expect(click.defaultPrevented).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      detach();
      vi.useRealTimers();
    }
  });

  it('leaves a reused pointer ID button tap and keyboard activation alone', () => {
    vi.useFakeTimers();
    const canvas = new PointerTarget();
    const detach = attachPointer(canvas as unknown as HTMLElement, {});
    const touch = { pointerType: 'touch', button: 0, buttons: 1 } as const;

    try {
      fire(canvas, 'pointerdown', touch);
      fire(canvas, 'pointerup', touch);
      // This fresh contact reuses the ID but starts on a control, not canvas.
      fire(canvas.ownerDocument as unknown as PointerTarget, 'pointerdown', touch);
      const buttonClick = Object.assign(new Event('click', { bubbles: true, cancelable: true }), {
        detail: 1,
        pointerId: 7,
        pointerType: 'touch',
      });
      canvas.ownerDocument.dispatchEvent(buttonClick);
      const keyboardClick = Object.assign(new Event('click', { bubbles: true, cancelable: true }), {
        detail: 0,
        pointerId: 7,
        pointerType: '',
      });
      canvas.ownerDocument.dispatchEvent(keyboardClick);

      expect(buttonClick.defaultPrevented).toBe(false);
      expect(keyboardClick.defaultPrevented).toBe(false);
    } finally {
      detach();
      vi.useRealTimers();
    }
  });

  it.each(NON_PRIMARY_CONTACTS)(
    'does not let ignored $pointerType button $button poison the next pen-tip contact',
    (contact) => {
      const target = new PointerTarget();
      const onTap = vi.fn();
      const onPinchStart = vi.fn();
      const detach = attachPointer(target as unknown as HTMLElement, { onTap, onPinchStart });
      const tip = { pointerType: 'pen', button: 0, buttons: 1 } as const;

      fire(target, 'pointerdown', contact, 7);
      fire(target, 'pointerdown', tip, 8);
      fire(target, 'pointerup', contact, 7);
      fire(target, 'pointerup', tip, 8);

      expect(target.captures).toEqual([8]);
      expect(target.releases).toEqual([8]);
      expect(onPinchStart).not.toHaveBeenCalled();
      expect(onTap).toHaveBeenCalledTimes(1);
      expect(onTap).toHaveBeenCalledWith({ x: 30, y: 40 });
      detach();
    },
  );
});

describe('pointer adapter capture loss', () => {
  const mouse = { pointerType: 'mouse', button: 0, buttons: 1 } as const;

  it('cancels a pending long press when capture is lost without completing a tap', () => {
    vi.useFakeTimers();
    const target = new PointerTarget();
    const onTap = vi.fn();
    const onLongPress = vi.fn();
    const detach = attachPointer(target as unknown as HTMLElement, { onTap, onLongPress });
    try {
      fire(target, 'pointerdown', mouse);
      vi.advanceTimersByTime(200);
      target.loseCapture(7, mouse);
      vi.advanceTimersByTime(1000);

      expect(target.hasPointerCapture(7)).toBe(false);
      expect(target.releases).toEqual([]);
      expect(onLongPress).not.toHaveBeenCalled();
      expect(onTap).not.toHaveBeenCalled();
    } finally {
      detach();
      vi.useRealTimers();
    }
  });

  it('returns a lost drag to hover and accepts the first subsequent primary contact', () => {
    const target = new PointerTarget();
    const onDrag = vi.fn();
    const onDragEnd = vi.fn();
    const onHover = vi.fn();
    const onTap = vi.fn();
    const detach = attachPointer(target as unknown as HTMLElement, {
      onDrag,
      onDragEnd,
      onHover,
      onTap,
    });

    fire(target, 'pointerdown', mouse);
    fire(target, 'pointermove', mouse, 7, { x: 160, y: 240 });
    expect(onDrag).toHaveBeenCalledTimes(1);
    target.loseCapture(7, mouse);
    // Release occurs outside the canvas, so only the later hover arrives here.
    fire(target, 'pointermove', { ...mouse, button: -1, buttons: 0 }, 7, { x: 180, y: 250 });

    expect(target.hasPointerCapture(7)).toBe(false);
    expect(target.releases).toEqual([]);
    expect(onDrag).toHaveBeenCalledTimes(1);
    expect(onDragEnd).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
    expect(onHover).toHaveBeenCalledWith({ x: 80, y: 50 });

    const tip = { pointerType: 'pen', button: 0, buttons: 1 } as const;
    fire(target, 'pointerdown', tip);
    fire(target, 'pointerup', tip);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith({ x: 30, y: 40 });
    detach();
  });

  it('keeps a normal tap when capture loss follows pointerup dispatch', () => {
    const target = new PointerTarget();
    const onTap = vi.fn();
    const detach = attachPointer(target as unknown as HTMLElement, { onTap });

    fire(target, 'pointerdown', mouse);
    fire(target, 'pointerup', mouse);
    // releasePointerCapture queues the native loss; it is not synchronous inside up.
    target.loseCapture(7, { ...mouse, buttons: 0 });

    expect(target.releases).toEqual([7]);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith({ x: 30, y: 40 });
    detach();
  });

  it('ends a normal captured drag once before its capture-loss notification', () => {
    const target = new PointerTarget();
    const onDragEnd = vi.fn();
    const onTap = vi.fn();
    const detach = attachPointer(target as unknown as HTMLElement, { onDragEnd, onTap });

    fire(target, 'pointerdown', mouse);
    fire(target, 'pointermove', mouse, 7, { x: 160, y: 240 });
    fire(target, 'pointerup', mouse, 7, { x: 160, y: 240 });
    target.loseCapture(7, { ...mouse, buttons: 0 });

    expect(target.releases).toEqual([7]);
    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(onDragEnd).toHaveBeenCalledWith({ x: 60, y: 40 });
    expect(onTap).not.toHaveBeenCalled();
    detach();
  });

  it('ignores another pointer losing capture while a primary contact is pending', () => {
    const target = new PointerTarget();
    const onTap = vi.fn();
    const detach = attachPointer(target as unknown as HTMLElement, { onTap });

    fire(target, 'pointerdown', mouse);
    target.loseCapture(99, mouse);
    expect(target.hasPointerCapture(7)).toBe(true);
    fire(target, 'pointerup', mouse);

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith({ x: 30, y: 40 });
    detach();
  });
});

describe('pointer adapter wheel zoom', () => {
  function wheel(
    target: PointerTarget,
    values: { deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean },
  ): Event {
    const event = Object.assign(new Event('wheel', { bubbles: true, cancelable: true }), {
      clientX: 130,
      clientY: 240,
      ...values,
    });
    target.dispatchEvent(event);
    return event;
  }

  it.each([
    { label: 'horizontal pixels', deltaX: 160, deltaMode: 0, ctrlKey: false },
    { label: 'horizontal ctrl+wheel lines', deltaX: -160, deltaMode: 1, ctrlKey: true },
    { label: 'zero page delta', deltaX: 0, deltaMode: 2, ctrlKey: false },
  ])('prevents $label without delivering a zoom request', ({ deltaX, deltaMode, ctrlKey }) => {
    const target = new PointerTarget();
    const onWheel = vi.fn();
    const detach = attachPointer(target as unknown as HTMLElement, { onWheel });
    try {
      const event = wheel(target, { deltaX, deltaY: 0, deltaMode, ctrlKey });

      expect(event.defaultPrevented).toBe(true);
      expect(onWheel).not.toHaveBeenCalled();
    } finally {
      detach();
    }
  });

  it.each([
    { label: 'pixel zoom out', deltaY: 120, deltaMode: 0, ctrlKey: false, expected: 120 },
    { label: 'ctrl pixel zoom in', deltaY: -40, deltaMode: 0, ctrlKey: true, expected: -40 },
    { label: 'line zoom out', deltaY: 3, deltaMode: 1, ctrlKey: false, expected: 48 },
    { label: 'ctrl page zoom in', deltaY: -1, deltaMode: 2, ctrlKey: true, expected: -240 },
  ])('forwards $label in canvas-local pixels', ({ deltaY, deltaMode, ctrlKey, expected }) => {
    const target = new PointerTarget();
    const onWheel = vi.fn();
    const detach = attachPointer(target as unknown as HTMLElement, { onWheel });
    try {
      const event = wheel(target, { deltaX: 160, deltaY, deltaMode, ctrlKey });

      expect(event.defaultPrevented).toBe(true);
      expect(onWheel).toHaveBeenCalledTimes(1);
      expect(onWheel).toHaveBeenCalledWith({
        point: { x: 30, y: 40 },
        deltaY: expected,
        ctrl: ctrlKey,
      });
    } finally {
      detach();
    }
  });

  it('leaves the browser default alone when there is no zoom handler', () => {
    const target = new PointerTarget();
    const detach = attachPointer(target as unknown as HTMLElement, {});
    try {
      const event = wheel(target, { deltaX: 0, deltaY: 120, deltaMode: 0, ctrlKey: false });

      expect(event.defaultPrevented).toBe(false);
    } finally {
      detach();
    }
  });
});
