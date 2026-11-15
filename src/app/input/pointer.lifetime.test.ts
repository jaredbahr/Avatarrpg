import { describe, expect, it } from 'vitest';
import { attachPointer } from './pointer';

/**
 * A map scene attaches the pointer adapter when it mounts and detaches it when it unmounts, some
 * hundreds of times in a long sitting; two of its listeners sit on the document, which outlives
 * every scene (#525). This counts what is still registered, as the browser would hold it.
 */
class Ledger {
  private readonly held = new Map<string, Set<unknown>>();

  addEventListener(type: string, listener: unknown, options?: boolean | { capture?: boolean }) {
    this.bucket(type, options).add(listener);
  }

  removeEventListener(type: string, listener: unknown, options?: boolean | { capture?: boolean }) {
    this.bucket(type, options).delete(listener);
  }

  /** Listeners still registered, as `type` or `type (capture)` to their number. */
  outstanding(): Record<string, number> {
    return Object.fromEntries(
      [...this.held].filter(([, set]) => set.size > 0).map(([key, set]) => [key, set.size]),
    );
  }

  private bucket(type: string, options?: boolean | { capture?: boolean }): Set<unknown> {
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
    const key = capture ? `${type} (capture)` : type;
    const set = this.held.get(key) ?? new Set<unknown>();
    this.held.set(key, set);
    return set;
  }
}

class Canvas extends Ledger {
  readonly ownerDocument = new Ledger();
}

describe('the pointer adapter over many scenes', () => {
  it('registers on the canvas and the document, and takes every listener back', () => {
    const canvas = new Canvas();
    const detach = attachPointer(canvas as unknown as HTMLElement, { onTap: () => undefined });
    expect(Object.keys(canvas.outstanding())).toHaveLength(8);
    expect(canvas.ownerDocument.outstanding()).toEqual({
      'pointerdown (capture)': 1,
      'click (capture)': 1,
    });
    detach();
    expect(canvas.outstanding()).toEqual({});
    expect(canvas.ownerDocument.outstanding()).toEqual({});
  });

  it('leaves nothing on the document after two hundred mounts', () => {
    const page = new Ledger();
    for (let mount = 0; mount < 200; mount++) {
      // Each scene has a canvas of its own; they all share the one document.
      const canvas = Object.assign(new Ledger(), { ownerDocument: page });
      const detach = attachPointer(canvas as unknown as HTMLElement, {});
      detach();
      expect(canvas.outstanding()).toEqual({});
    }
    expect(page.outstanding()).toEqual({});
  });
});
