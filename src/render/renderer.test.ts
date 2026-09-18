import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Camera } from './camera';
import type { MapView } from './view';

const backend = vi.hoisted(() => ({
  capabilities: { name: 'canvas' as const, shaders: false, particles: false },
  resize: vi.fn(),
  draw: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock('./backends/canvas2d', () => ({
  Canvas2DBackend: class {
    constructor() {
      return backend;
    }
  },
}));
vi.mock('./backends/pixi', () => ({
  PixiBackend: class {
    static isSupported() {
      return false;
    }
  },
}));
vi.mock('./spriteCache', () => ({ sprites: { clear: vi.fn() } }));

import { Renderer } from './renderer';

let deliver: () => void;
const disconnect = vi.fn();
const observe = vi.fn();
let box = { width: 800, height: 600 };
let framebuffer = false;
const view = { time: 123 } as MapView;
const canvas = { getBoundingClientRect: () => box } as HTMLCanvasElement;

beforeEach(() => {
  vi.clearAllMocks();
  box = { width: 800, height: 600 };
  framebuffer = false;
  backend.resize.mockImplementation(() => {
    framebuffer = false;
  });
  backend.draw.mockImplementation(() => {
    framebuffer = true;
  });
  vi.stubGlobal('window', { devicePixelRatio: 1, location: { search: '?renderer=canvas' } });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        deliver = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  vi.stubGlobal('requestAnimationFrame', vi.fn());
});

afterEach(() => vi.unstubAllGlobals());

describe('renderer observer repaint', () => {
  it('restores pixels before observer return using the resized viewport and post-refit camera', () => {
    const renderer = new Renderer(canvas, { width: 20, height: 12 });
    renderer.draw(view);
    const events: string[] = [];
    backend.resize.mockImplementation(() => {
      framebuffer = false;
      events.push('resize');
    });
    renderer.onViewportChange = () => {
      expect(framebuffer).toBe(false);
      expect(renderer.viewport).toEqual({ width: 800, height: 720, dpr: 1 });
      renderer.camera.offsetY = 93;
      renderer.camera.scale = 1.5;
      events.push('refit');
    };
    backend.draw.mockImplementation((drawn: MapView, camera: Camera) => {
      expect(drawn).toBe(view);
      expect(camera.viewport.height).toBe(720);
      expect(camera.offsetY).toBe(93);
      expect(camera.scale).toBe(1.5);
      framebuffer = true;
      events.push('draw');
    });
    box.height = 720;
    deliver();
    expect(events).toEqual(['resize', 'refit', 'draw']);
    expect(framebuffer).toBe(true);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    renderer.destroy();
  });

  it('ignores unchanged dimensions but reacts to device-pixel-ratio changes', () => {
    const renderer = new Renderer(canvas, { width: 20, height: 12 });
    renderer.draw(view);
    deliver();
    expect(backend.resize).not.toHaveBeenCalled();
    expect(backend.draw).toHaveBeenCalledTimes(1);
    window.devicePixelRatio = 2;
    deliver();
    expect(backend.resize).toHaveBeenCalledWith({ width: 800, height: 600, dpr: 2 });
    expect(backend.draw).toHaveBeenCalledTimes(2);
    expect(framebuffer).toBe(true);
    renderer.destroy();
  });

  it('measures initial layout without drawing an absent view, then caches only the latest view', () => {
    const renderer = new Renderer(canvas, { width: 20, height: 12 });
    const changed = vi.fn();
    renderer.onViewportChange = changed;
    box.height = 500;
    deliver();
    expect(changed).toHaveBeenCalledOnce();
    expect(backend.draw).not.toHaveBeenCalled();
    renderer.draw(view);
    const latest = { ...view, time: 456 };
    renderer.draw(latest);
    box.height = 550;
    deliver();
    expect(backend.draw).toHaveBeenLastCalledWith(latest, renderer.camera);
    renderer.destroy();
  });

  it('disconnects and prevents stale observer or scene callbacks from repainting after destruction', () => {
    const renderer = new Renderer(canvas, { width: 20, height: 12 });
    renderer.draw(view);
    renderer.destroy();
    renderer.destroy();
    box.height = 700;
    deliver();
    renderer.draw(view);
    renderer.resize();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(backend.destroy).toHaveBeenCalledOnce();
    expect(backend.resize).not.toHaveBeenCalled();
    expect(backend.draw).toHaveBeenCalledOnce();
  });

  it('does not redraw if the viewport callback destroys the scene', () => {
    const renderer = new Renderer(canvas, { width: 20, height: 12 });
    renderer.draw(view);
    renderer.onViewportChange = () => renderer.destroy();
    box.height = 700;
    deliver();
    expect(backend.draw).toHaveBeenCalledOnce();
    expect(backend.destroy).toHaveBeenCalledOnce();
  });
});
