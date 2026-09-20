import { describe, expect, it } from 'vitest';
import { Camera } from './camera';
import { groundBounds, projectGround, unprojectGround } from './projection';

describe('oblique ground contract', () => {
  it('maps the authored axes and negative ground bounds without losing rule coordinates', () => {
    expect(projectGround({ x: 1, y: 0 }, 'oblique')).toEqual({ x: 1, y: 0.5 });
    expect(projectGround({ x: 0, y: 1 }, 'oblique')).toEqual({ x: -1, y: 0.5 });
    expect(groundBounds(24, 16, 'oblique')).toEqual({ minX: -16, minY: 0, width: 40, height: 20 });
    for (const x of [-1, 0, 0.125, 7.5, 24])
      for (const y of [-1, 0, 3.25, 16]) {
        expect(unprojectGround(projectGround({ x, y }, 'oblique'), 'oblique')).toEqual({ x, y });
      }
  });

  it('picks both sides of a projected tile edge, including outside the diamond', () => {
    const camera = new Camera(
      { width: 1000, height: 700, dpr: 2 },
      { width: 24, height: 16 },
      'oblique',
    );
    camera.scale = 1.5;
    camera.offsetX = 237;
    camera.offsetY = 109;
    for (const x of [-0.001, 0.001, 3.999, 4.001, 23.999, 24.001]) {
      const screen = camera.project({ x, y: 7.5 });
      expect(camera.toTile(screen.x, screen.y)).toEqual({ x: Math.floor(x), y: 7 });
    }
  });

  it('preserves a fractional ground point during zoom and resize recentering', () => {
    const camera = new Camera(
      { width: 1000, height: 700, dpr: 1 },
      { width: 24, height: 16 },
      'oblique',
    );
    camera.fitExplore(96);
    camera.centreOn({ x: 12, y: 8 });
    const finger = { x: 480, y: 310 };
    const before = camera.unproject(finger);
    camera.zoomAt(finger, 1.2);
    const after = camera.unproject(finger);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
    const scale = camera.scale;
    camera.viewport = { width: 834, height: 900, dpr: 2 };
    camera.centreOn({ x: 12, y: 8 });
    expect(camera.scale).toBe(scale);
    expect(camera.project({ x: 12.5, y: 8.5 })).toEqual({ x: 417, y: 450 });
  });

  it('anchors a two-cell boss at its true footprint midpoint', () => {
    const camera = new Camera(
      { width: 1000, height: 700, dpr: 1 },
      { width: 20, height: 12 },
      'oblique',
    );
    const box = camera.spriteBox({ x: 8, y: 5 }, 2);
    const midpoint = camera.project({ x: 9, y: 5.5 });
    expect(box.x + box.size).toBe(midpoint.x);
    expect(box.y + box.size * 0.86).toBe(midpoint.y);
    expect(camera.toTile(midpoint.x, midpoint.y)).toEqual({ x: 9, y: 5 });
  });
});
