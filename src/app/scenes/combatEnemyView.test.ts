import { describe, expect, it } from 'vitest';
import { Camera } from '../../render/camera';
import { frameCombatEnemyView } from './combatEnemyView';

describe('frameCombatEnemyView', () => {
  it.each([
    { width: 1280, height: 600, dpr: 1 },
    { width: 760, height: 900, dpr: 2 },
  ])('keeps every target inside a $width by $height view', (viewport) => {
    const camera = new Camera(viewport, { width: 26, height: 13 }, 'oblique');
    camera.integerZoom = true;
    const targets = [
      { x: 3, y: 4 },
      { x: 12, y: 6 },
      { x: 20, y: 8 },
      { x: 13, y: 6 },
    ];

    expect(frameCombatEnemyView(camera, targets)).toBe(true);
    for (const tile of targets) {
      const point = camera.project({ x: tile.x + 0.5, y: tile.y + 0.5 });
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(viewport.width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(viewport.height);
    }
  });

  it('leaves the camera unchanged when there are no living targets', () => {
    const camera = new Camera(
      { width: 1280, height: 600, dpr: 1 },
      { width: 26, height: 13 },
      'oblique',
    );
    const before = { scale: camera.scale, x: camera.offsetX, y: camera.offsetY };

    expect(frameCombatEnemyView(camera, [])).toBe(false);
    expect({ scale: camera.scale, x: camera.offsetX, y: camera.offsetY }).toEqual(before);
  });
});
