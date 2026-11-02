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
}

interface Contact {
  readonly pointerType: 'pen' | 'touch' | 'mouse';
  readonly button: number;
  readonly buttons: number;
}

function fire(
  target: PointerTarget,
  type: 'pointerdown' | 'pointerup',
  contact: Contact,
  pointerId = 7,
): void {
  target.dispatchEvent(
    Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
      ...contact,
      pointerId,
      isPrimary: true,
      clientX: 130,
      clientY: 240,
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
