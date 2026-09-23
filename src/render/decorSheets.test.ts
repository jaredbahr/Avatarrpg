import { afterEach, expect, it, vi } from 'vitest';
import { FOREST_ROAD } from '../content/maps/combat';
import { buildGrid, tileAt } from '../core/rules/grid';
import { DecorSheets } from './decorSheets';
import type { MapView } from './view';

const HEAP = { x: 7, y: 3 };

/** Fills a seams bake lays down for the heap's chunk, with a counting context. */
function bakeFills(view: MapView, ready: boolean): number {
  let fills = 0;
  const ctx = {
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    ellipse: vi.fn(),
    stroke: vi.fn(),
    fill: () => fills++,
    fillRect: vi.fn(),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
  };
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
  });
  const grid = buildGrid(FOREST_ROAD);
  const sheets = new DecorSheets();
  sheets.sync(grid);
  sheets.get(grid, 0, 0, 8, 'seams', view, ready);
  return fills;
}

afterEach(() => vi.unstubAllGlobals());

it('drops the join over a registered painted-rubble cell, and keeps it unready', () => {
  const scene = FOREST_ROAD.scene;
  if (!scene) throw new Error('Missing authored scene');
  const view = { scene, hatch: false, crispOverlays: false } as unknown as MapView;
  expect(tileAt(buildGrid(FOREST_ROAD), HEAP)?.surface?.id).toBe('rubble');
  const painted = bakeFills(view, true);
  const unready = bakeFills(view, false);
  expect(painted).toBeGreaterThan(0);
  expect(painted).toBeLessThan(unready);
  // High contrast brings the cell's join back, as it does its live overlay.
  expect(bakeFills({ ...view, hatch: true } as MapView, true)).toBe(unready);
});
