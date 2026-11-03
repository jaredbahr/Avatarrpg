import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toasts } from './Toasts';

class FakeElement {
  className = '';
  textContent = '';
  parentElement: FakeElement | null = null;
  dataset: Record<string, string> = {};
  style = { setProperty: vi.fn(), removeProperty: vi.fn() };
  readonly children: FakeElement[] = [];
  readonly classList = {
    add: (name: string) => {
      if (!this.className.split(' ').includes(name))
        this.className = `${this.className} ${name}`.trim();
    },
  };

  get childElementCount(): number {
    return this.children.length;
  }

  get firstElementChild(): FakeElement | null {
    return this.children[0] ?? null;
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  querySelectorAll(): FakeElement[] {
    return [];
  }

  remove(): void {
    if (!this.parentElement) return;
    this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
    this.parentElement = null;
  }

  setAttribute(): void {}
}

function setup(): { toasts: Toasts; host: FakeElement } {
  const parent = new FakeElement();
  vi.stubGlobal('document', {
    createElement: () => new FakeElement(),
    querySelector: () => null,
    documentElement: { style: { removeProperty: vi.fn(), setProperty: vi.fn() } },
  });
  vi.stubGlobal('HTMLInputElement', class extends FakeElement {});
  vi.stubGlobal('HTMLButtonElement', class extends FakeElement {});
  vi.stubGlobal('window', {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  });
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const toasts = new Toasts(parent as unknown as HTMLElement);
  return { toasts, host: parent.children[0]! };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('toast ownership and dismissal', () => {
  it('dismisses only its handle, preserving unrelated toasts', () => {
    vi.useFakeTimers();
    const { toasts, host } = setup();
    const confirmation = toasts.show('Spend remaining AP?', 'warn');
    const other = toasts.show('A separate hint');

    expect(confirmation).not.toBeNull();
    expect(other).not.toBeNull();
    toasts.dismiss(confirmation);

    expect(host.childElementCount).toBe(1);
    expect(host.firstElementChild?.textContent).toBe('A separate hint');
  });

  it('does not leave stale fade/dismiss timers after dismissal or clear', () => {
    vi.useFakeTimers();
    const { toasts, host } = setup();
    const handle = toasts.show('Temporary');
    const node = host.firstElementChild!;
    toasts.dismiss(handle);
    vi.advanceTimersByTime(5000);
    expect(host.childElementCount).toBe(0);
    expect(node.className).not.toContain('toast-out');
    expect(vi.getTimerCount()).toBe(0);

    toasts.show('Cleared');
    toasts.clear();
    vi.advanceTimersByTime(5000);
    expect(host.childElementCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns no handle when a duplicate is suppressed', () => {
    vi.useFakeTimers();
    const { toasts } = setup();
    expect(toasts.show('Repeated')).not.toBeNull();
    expect(toasts.show('Repeated')).toBeNull();
  });

  it('notifies its owner after expiry, manual dismissal, clear and stack eviction', () => {
    vi.useFakeTimers();
    const { toasts, host } = setup();
    const expired = vi.fn();
    toasts.show('Expires', 'warn', 100, expired);
    vi.advanceTimersByTime(420);
    expect(expired).toHaveBeenCalledOnce();

    const dismissed = vi.fn();
    const handle = toasts.show('Dismiss during fade', 'warn', 100, dismissed);
    vi.advanceTimersByTime(100);
    toasts.dismiss(handle);
    expect(dismissed).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(500);
    expect(dismissed).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);

    const evicted = vi.fn();
    toasts.show('One', 'info', 5000, evicted);
    toasts.show('Two', 'info', 5000);
    toasts.show('Three', 'info', 5000);
    toasts.show('Four', 'info', 5000);
    toasts.show('Five', 'info', 5000);
    expect(evicted).toHaveBeenCalledOnce();
    expect(host.childElementCount).toBe(4);

    const cleared = vi.fn();
    toasts.show('Clear callback', 'info', 5000, cleared);
    toasts.clear();
    expect(cleared).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
