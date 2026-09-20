import { describe, expect, it } from 'vitest';
import { Camera, MIN_TILE_PX, TILE } from './camera';

/** A Surface-sized map area in landscape: the whole 20x12 board fits. */
const LANDSCAPE = { width: 1344, height: 640, dpr: 1 };
/** A phone-sized area: fitting the board would leave tiles far below a fingertip. */
const NARROW = { width: 380, height: 560, dpr: 1 };
const GRID = { width: 20, height: 12 };

describe('Camera.fit', () => {
  it('fits the whole board when a tile stays at fingertip size', () => {
    const camera = new Camera(LANDSCAPE, GRID);
    camera.fit();
    expect(camera.fitted).toBe(true);
    expect(camera.worldWidth).toBeLessThanOrEqual(LANDSCAPE.width);
    expect(camera.worldHeight).toBeLessThanOrEqual(LANDSCAPE.height);
    expect(TILE * camera.scale).toBeGreaterThanOrEqual(MIN_TILE_PX);
  });

  it('prefers a tappable tile over a fitted board on a narrow viewport', () => {
    const camera = new Camera(NARROW, GRID);
    camera.fit();
    expect(TILE * camera.scale).toBeCloseTo(MIN_TILE_PX, 6);
    expect(camera.fitted).toBe(false);
    // The map is wider than the viewport, so it must be pannable and clamped.
    expect(camera.worldWidth).toBeGreaterThan(NARROW.width);
    expect(camera.offsetX).toBeGreaterThanOrEqual(0);
  });

  it('centres on a tile when the board does not fit', () => {
    const camera = new Camera(NARROW, GRID);
    camera.fit();
    camera.centreOn({ x: 19, y: 0 });
    const { x, size } = camera.toScreen({ x: 19, y: 0 });
    expect(x + size).toBeLessThanOrEqual(NARROW.width + 0.5);
    expect(x).toBeGreaterThanOrEqual(-0.5);
  });
});

describe('Camera.zoomAt', () => {
  it('keeps the world point under the finger fixed', () => {
    const camera = new Camera(LANDSCAPE, GRID);
    camera.fit();
    const at = { x: 400, y: 300 };
    const before = worldAt(camera, at);
    camera.zoomAt(at, 1.8);
    const after = worldAt(camera, at);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(camera.fitted).toBe(false);
  });

  it('never zooms out past the fitted board', () => {
    const camera = new Camera(LANDSCAPE, GRID);
    camera.fit();
    const fitted = camera.scale;
    camera.zoomAt({ x: 10, y: 10 }, 0.2);
    expect(camera.scale).toBeCloseTo(fitted, 6);
    expect(camera.fitted).toBe(true);
  });

  it('caps zoom in at the maximum scale and stays clamped to the map', () => {
    const camera = new Camera(LANDSCAPE, GRID);
    camera.fit();
    for (let i = 0; i < 20; i++) camera.zoomAt({ x: 0, y: 0 }, 1.5);
    expect(camera.scale).toBeCloseTo(2.5, 6);
    expect(camera.offsetX).toBeGreaterThanOrEqual(0);
    expect(camera.offsetX).toBeLessThanOrEqual(camera.worldWidth - LANDSCAPE.width);
    expect(camera.offsetY).toBeGreaterThanOrEqual(0);
    expect(camera.offsetY).toBeLessThanOrEqual(camera.worldHeight - LANDSCAPE.height);
  });

  it('pans only while zoomed; a fitted board stays put', () => {
    const camera = new Camera(LANDSCAPE, GRID);
    camera.fit();
    const { offsetX, offsetY } = camera;
    camera.panBy(50, -30);
    expect(camera.offsetX).toBe(offsetX);
    expect(camera.offsetY).toBe(offsetY);

    camera.zoomAt({ x: 600, y: 300 }, 2);
    const zoomed = camera.offsetX;
    camera.panBy(50, 0);
    expect(camera.offsetX).toBe(zoomed - 50);
  });

  it('refits after a resize when the board was fitted, and keeps a zoom otherwise', () => {
    const camera = new Camera(LANDSCAPE, GRID);
    camera.fit();
    expect(camera.fitted).toBe(true);
    camera.viewport = { width: 1000, height: 600, dpr: 1 };
    camera.fit();
    expect(camera.fitted).toBe(true);
    expect(TILE * camera.scale).toBeGreaterThanOrEqual(MIN_TILE_PX);

    camera.zoomAt({ x: 100, y: 100 }, 2);
    const scale = camera.scale;
    camera.viewport = { width: 1100, height: 650, dpr: 1 };
    camera.clamp();
    expect(camera.scale).toBe(scale);
  });
});

function worldAt(camera: Camera, at: { x: number; y: number }): { x: number; y: number } {
  const size = TILE * camera.scale;
  return { x: (at.x + camera.offsetX) / size, y: (at.y + camera.offsetY) / size };
}
