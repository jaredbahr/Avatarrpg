import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../content/maps/combat';
import { buildGrid, tileAt } from '../core/rules/grid';
import { surfaceIsPainted } from './sceneSurfaces';

it('replaces only registered permanent rubble and restores all dynamic/accessibility/fallback overlays', () => {
  const pos = { x: 7, y: 3 };
  const tile = tileAt(buildGrid(FOREST_ROAD), pos);
  if (!tile) throw new Error('Missing authored cover');
  const scene = FOREST_ROAD.scene;
  if (!scene) throw new Error('Missing authored scene');
  const view = { scene, hatch: false, crispOverlays: false };
  expect(tile.surface?.id).toBe('rubble');
  expect(surfaceIsPainted(view, true, tile, pos)).toBe(true);
  expect(
    surfaceIsPainted({ ...view, scene: { ...view.scene, groundMode: 'partial' } }, true, tile, pos),
  ).toBe(false);
  expect(surfaceIsPainted(view, false, tile, pos)).toBe(false);
  expect(surfaceIsPainted({ ...view, hatch: true }, true, tile, pos)).toBe(false);
  expect(surfaceIsPainted({ ...view, crispOverlays: true }, true, tile, pos)).toBe(false);
  expect(surfaceIsPainted(view, true, tile, { x: 6, y: 3 })).toBe(false);
  for (const id of ['rubble', 'fire', 'mud', 'ice'] as const) {
    const changed = { ...tile, surface: { id, duration: 3, spread: 0 } };
    expect(surfaceIsPainted(view, true, changed, pos)).toBe(false);
  }
  expect(surfaceIsPainted(view, true, { ...tile, surface: null }, pos)).toBe(false);
});
