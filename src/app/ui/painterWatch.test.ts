import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fitAssetToBox } from './assetCanvas';
import { painterCanvas } from './dom';
import { resetPainterWatch } from './painterWatch';

/**
 * Portrait canvases under a fake page (#525): one observer for all of them, and a canvas that has
 * left the page gives its pixels back instead of holding them until the collector comes.
 */
interface FakeCanvas {
  width: number;
  height: number;
  isConnected: boolean;
  box: number;
  className: string;
  style: Record<string, string>;
  dataset: Record<string, string>;
  getContext(): unknown;
  getBoundingClientRect(): { width: number };
}

class FakeObserver {
  static made: FakeObserver[] = [];
  readonly targets = new Set<FakeCanvas>();
  constructor(readonly callback: (entries: { target: FakeCanvas }[]) => void) {
    FakeObserver.made.push(this);
  }
  observe(target: FakeCanvas): void {
    this.targets.add(target);
  }
  unobserve(target: FakeCanvas): void {
    this.targets.delete(target);
  }
  disconnect(): void {
    this.targets.clear();
  }
  /** What the browser does after a layout: report the watched canvases. */
  deliver(targets: readonly FakeCanvas[] = [...this.targets]): void {
    this.callback(targets.map((target) => ({ target })));
  }
}

let canvases: FakeCanvas[] = [];
let paints = 0;
const draw = (): void => {
  paints += 1;
};
const held = (): number => canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0);

beforeEach(() => {
  canvases = [];
  paints = 0;
  FakeObserver.made = [];
  resetPainterWatch();
  vi.stubGlobal('ResizeObserver', FakeObserver);
  vi.stubGlobal('window', { devicePixelRatio: 2 });
  vi.stubGlobal('getComputedStyle', () => ({ fontSize: '16px' }));
  // `el` asks whether the node is an input or a button; no fake canvas is.
  vi.stubGlobal('HTMLInputElement', class {});
  vi.stubGlobal('HTMLButtonElement', class {});
  vi.stubGlobal('document', {
    documentElement: {},
    createElement: () => {
      const canvas: FakeCanvas = {
        width: 300,
        height: 150,
        isConnected: false,
        box: 0,
        className: '',
        style: {},
        dataset: {},
        getContext: () => ({}),
        getBoundingClientRect: () => ({ width: canvas.box }),
      };
      canvases.push(canvas);
      return canvas;
    },
  });
});
afterEach(() => {
  resetPainterWatch();
  vi.unstubAllGlobals();
});

function portrait(rem = 15): FakeCanvas {
  return painterCanvas('portrait.kaya', rem, draw) as unknown as FakeCanvas;
}

describe('painter canvases', () => {
  it('are all watched by one observer, however long the conversation', () => {
    for (let line = 0; line < 200; line++) {
      fitAssetToBox(portrait() as unknown as HTMLCanvasElement);
    }
    // An observer per portrait, only disconnected if the canvas had been laid out before it was
    // replaced, left ten more observing after every game in the soak.
    expect(FakeObserver.made).toHaveLength(1);
  });

  it('give their pixels back once they have left the page', () => {
    const observer = () => FakeObserver.made[0];
    // A conversation of forty lines, each line's 480 px portrait replacing the last.
    let previous: FakeCanvas | null = null;
    for (let line = 0; line < 40; line++) {
      const canvas = portrait();
      canvas.isConnected = true;
      canvas.box = 240;
      if (previous) previous.isConnected = false;
      observer()?.deliver();
      previous = canvas;
      // Only the portrait on screen is held: 480 x 480, not forty of them.
      expect(held()).toBe(480 * 480);
    }
  });

  it('leave a canvas alone until it has been on the page', () => {
    const canvas = portrait();
    FakeObserver.made[0]?.deliver();
    expect(canvas.width).toBe(480);
  });

  it('repaint a canvas that is put back', () => {
    const canvas = portrait(4);
    canvas.isConnected = true;
    FakeObserver.made[0]?.deliver();
    canvas.isConnected = false;
    FakeObserver.made[0]?.deliver();
    expect(canvas.width).toBe(0);
    const before = paints;
    canvas.isConnected = true;
    FakeObserver.made[0]?.deliver();
    expect([canvas.width, canvas.height]).toEqual([128, 128]);
    expect(paints).toBe(before + 1);
  });

  it('size a fitted portrait to the box CSS gives it, on whole device pixels (#651)', () => {
    const canvas = fitAssetToBox(
      portrait() as unknown as HTMLCanvasElement,
    ) as unknown as FakeCanvas;
    canvas.isConnected = true;
    canvas.box = 80.4;
    const before = paints;
    FakeObserver.made[0]?.deliver();
    expect([canvas.width, canvas.height]).toEqual([161, 161]);
    expect(paints).toBe(before + 1);
    // The same box again repaints nothing.
    FakeObserver.made[0]?.deliver();
    expect(paints).toBe(before + 1);
  });
});
