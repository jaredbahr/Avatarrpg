import { describe, expect, it, vi } from 'vitest';
import { attachPointer } from './pointer';

/** Only the DOM surface the adapter uses; events still use real EventTarget dispatch. */
class PointerTarget extends EventTarget {
  readonly captures: number[] = [];
  readonly releases: number[] = [];
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
