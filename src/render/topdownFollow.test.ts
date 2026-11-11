import { describe, expect, it } from 'vitest';
import type { MapDef, Vec2 } from '../core/types';
import { buildGrid } from '../core/rules/grid';
import { Camera } from './camera';
import { actorBodyBounds } from './geometry/actorSilhouette';
import { TOPDOWN_FIXTURE } from './topdown.fixture';
import { applyTopdownFollow, topdownFollow } from './topdownFollow';

describe('top-down follow camera', () => {
  const viewport = { width: 800, height: 500, dpr: 1 };
  const body = { left: 390, top: 230, right: 410, bottom: 270 };

  it('holds when the focus and both blow endpoints are inside the CSS-pixel margins', () => {
    const result = topdownFollow({
      focus: { x: 400, y: 250 },
      blowEndpoints: [
        { x: 250, y: 200 },
        { x: 550, y: 300 },
      ],
      body,
      viewport,
      deltaMs: 16,
    });
    expect(result.pan).toEqual({ x: 0, y: 0 });
    expect(result.focusInsideMargins).toBe(true);
    expect(result.bodyContained).toBe(true);
  });

  it('eases outside the margin at 6.5 per second and snaps the result to DPR', () => {
    const result = topdownFollow({
      focus: { x: 780, y: 250 },
      body: { left: 770, top: 230, right: 790, bottom: 270 },
      viewport: { ...viewport, dpr: 1.5 },
      deltaMs: 100,
    });
    const eased = (800 - 64 - 780) * (1 - Math.exp(-0.65));
    expect(result.pan.x).toBeCloseTo(Math.round(eased * 1.5) / 1.5);
    expect(result.pan.x * 1.5).toBeCloseTo(Math.round(result.pan.x * 1.5));
    expect(result.pan.y).toBe(0);
  });

  it('keeps both ends of a blow within the follow margins before it reports settled', () => {
    const result = topdownFollow({
      focus: { x: 400, y: 250 },
      blowEndpoints: [
        { x: 250, y: 250 },
        { x: 780, y: 250 },
      ],
      body,
      viewport,
      deltaMs: 5000,
    });
    expect(result.pan.x).toBeLessThan(0);
    expect(result.focusInsideMargins).toBe(true);
  });

  it('prioritizes full body containment when the soft focus union cannot share the frame', () => {
    const result = topdownFollow({
      focus: { x: 100, y: 250 },
      blowEndpoints: [
        { x: -200, y: 250 },
        { x: 700, y: 250 },
      ],
      body: { left: 760, top: 220, right: 800, bottom: 280 },
      viewport,
      deltaMs: 1000,
    });
    expect(result.pan.x).toBe(0);
    expect(result.focusInsideMargins).toBe(false);
    expect(result.bodyContained).toBe(true);
  });

  it('reports when a body is physically too large to contain at the current zoom', () => {
    const result = topdownFollow({
      focus: { x: 400, y: 250 },
      body: { left: 0, top: 220, right: 900, bottom: 280 },
      viewport,
      deltaMs: 1000,
    });
    expect(result.bodyContained).toBe(false);
    expect(result.pan.x).toBe(-50);
  });

  it.each([
    ['left', { left: -5, top: 220, right: 35, bottom: 280 }, { x: 15, y: 250 }],
    ['right', { left: 765, top: 220, right: 805, bottom: 280 }, { x: 785, y: 250 }],
    ['top', { left: 380, top: -8, right: 420, bottom: 52 }, { x: 400, y: 22 }],
    ['bottom', { left: 380, top: 448, right: 420, bottom: 508 }, { x: 400, y: 478 }],
  ] as const)('hard-clamps the complete body at the %s edge in one frame', (_edge, body, focus) => {
    const edgeViewport = { width: 800, height: 500, dpr: 1.5 };
    const result = topdownFollow({
      focus,
      body,
      viewport: edgeViewport,
      deltaMs: 16,
    });
    const left = body.left + result.pan.x;
    const right = body.right + result.pan.x;
    const top = body.top + result.pan.y;
    const bottom = body.bottom + result.pan.y;
    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(edgeViewport.width);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(bottom).toBeLessThanOrEqual(edgeViewport.height);
    expect(result.bodyContained).toBe(true);
  });

  it('uses device-pixel-snapped pans and keeps inputs immutable', () => {
    const input = {
      focus: { x: 810, y: -10 },
      body: { left: 790, top: -30, right: 830, bottom: 30 },
      viewport: { width: 393, height: 852, dpr: 3 },
      deltaMs: 50,
    } as const;
    const before = structuredClone(input);
    const result = topdownFollow(input);
    expect(result.pan.x * input.viewport.dpr).toBeCloseTo(
      Math.round(result.pan.x * input.viewport.dpr),
    );
    expect(result.pan.y * input.viewport.dpr).toBeCloseTo(
      Math.round(result.pan.y * input.viewport.dpr),
    );
    expect(input).toEqual(before);
  });

  it('keeps a 2x2 body with fallback headroom inside the real camera at every board edge', () => {
    const width = 20;
    const height = 12;
    const map: MapDef = {
      ...TOPDOWN_FIXTURE,
      id: 'fixture.topdown-follow-20x12',
      width,
      height,
      rows: Array.from({ length: height }, () => '.'.repeat(width)),
      legend: { '.': { terrain: 'grass' } },
      partySpawns: [{ x: 1, y: 1 }],
      scene: {
        ground: [],
        scenery: [],
        paintExtent: { x: 0, y: 0, width: width * 40, height: height * 40 },
      },
    };
    const grid = buildGrid(map);
    const viewport = { width: 850, height: 550, dpr: 2 };
    const corners: Vec2[] = [
      { x: 0, y: 0 },
      { x: width - 2, y: 0 },
      { x: 0, y: height - 2 },
      { x: width - 2, y: height - 2 },
    ];

    for (const pos of corners) {
      const camera = new Camera(viewport, { width, height }, 'topdown');
      camera.integerZoom = true;
      camera.fitExplore(40, 12, 'floor');
      camera.zoomAt({ x: viewport.width / 2, y: viewport.height / 2 }, 2);
      const bodyForCurrentCamera = () => {
        const box = camera.spriteBox(pos, 2, true);
        return actorBodyBounds({ ...box, width: box.size * 2 }, 2, null, 1);
      };
      const before = bodyForCurrentCamera();
      const follow = topdownFollow({
        focus: { x: (before.left + before.right) / 2, y: (before.top + before.bottom) / 2 },
        body: before,
        viewport,
        deltaMs: 16,
      });
      applyTopdownFollow(camera, before, follow);

      const after = bodyForCurrentCamera();
      expect(after.left, `left edge at ${pos.x},${pos.y}`).toBeGreaterThanOrEqual(0);
      expect(after.right, `right edge at ${pos.x},${pos.y}`).toBeLessThanOrEqual(viewport.width);
      expect(after.top, `top edge at ${pos.x},${pos.y}`).toBeGreaterThanOrEqual(0);
      expect(after.bottom, `bottom edge at ${pos.x},${pos.y}`).toBeLessThanOrEqual(viewport.height);
      expect(camera.tile * camera.scale).toBeGreaterThanOrEqual(40);
      expect(grid.width).toBe(width);
      expect(grid.height).toBe(height);
      expect(map.scene?.paintExtent).toEqual({
        x: 0,
        y: 0,
        width: width * 40,
        height: height * 40,
      });
    }
  });

  it('keeps the zoom when a tall figure on the edge row is clipped by the board edge', () => {
    const width = 20;
    const height = 12;
    const viewport = { width: 1368, height: 700, dpr: 1 };
    for (const row of [0, height - 1]) {
      const camera = new Camera(viewport, { width, height }, 'topdown');
      camera.integerZoom = true;
      camera.fitExplore(80, 12, 'floor');
      const scale = camera.scale;
      const pos = { x: 10, y: row };
      const box = camera.spriteBox(pos, 1, true);
      // The crossbowman draws at 1.23, so his head runs past the board's top edge on row 0.
      const tall = actorBodyBounds({ ...box, width: box.size }, 1, null, 1.25);
      const follow = topdownFollow({
        focus: { x: (tall.left + tall.right) / 2, y: (tall.top + tall.bottom) / 2 },
        body: tall,
        viewport,
        deltaMs: 16,
      });
      applyTopdownFollow(camera, tall, follow);
      expect(camera.scale, `row ${row}`).toBe(scale);
    }
  });
});
