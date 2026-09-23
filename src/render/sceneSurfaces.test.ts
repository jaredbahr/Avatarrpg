import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../content/maps/combat';
import { BA_DAN_VILLAGE } from '../content/maps/village';
import { buildGrid, tileAt } from '../core/rules/grid';
import { surfaceIsPainted, surfaceIsSeated } from './sceneSurfaces';

it('replaces only registered permanent rubble and restores all dynamic/accessibility/fallback overlays', () => {
  const pos = { x: 7, y: 3 };
  const tile = tileAt(buildGrid(FOREST_ROAD), pos);
  if (!tile) throw new Error('Missing authored cover');
  const scene = FOREST_ROAD.scene;
  if (!scene) throw new Error('Missing authored scene');
  const view = { scene, hatch: false, crispOverlays: false };
  expect(tile.surface?.id).toBe('rubble');
  expect(scene.groundMode).toBe('partial');
  expect(surfaceIsPainted(view, true, tile, pos)).toBe(false);
  expect(
    surfaceIsPainted({ ...view, scene: { ...view.scene, groundMode: undefined } }, true, tile, pos),
  ).toBe(true);
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

it('keeps Ba Dan permanent water painted only in legacy complete mode', () => {
  const pos = { x: 10, y: 6 };
  const tile = tileAt(buildGrid(BA_DAN_VILLAGE), pos);
  if (!tile || !BA_DAN_VILLAGE.scene) throw new Error('Missing Ba Dan pond');
  const scene = { ...BA_DAN_VILLAGE.scene, groundMode: undefined, paintedWater: true };
  const view = { scene, hatch: false, crispOverlays: false };
  expect(tile.surface?.id).toBe('water');
  expect(surfaceIsPainted(view, true, tile, pos)).toBe(true);
  expect(
    surfaceIsPainted({ ...view, scene: { ...view.scene, groundMode: 'partial' } }, true, tile, pos),
  ).toBe(false);
  expect(
    surfaceIsPainted(
      view,
      true,
      { ...tile, surface: { id: 'water', duration: 3, spread: 0 } },
      pos,
    ),
  ).toBe(false);
});

it('seats only registered permanent rubble in a partial scene, never a plain overlay', () => {
  const pos = { x: 7, y: 3 };
  const tile = tileAt(buildGrid(FOREST_ROAD), pos);
  const scene = FOREST_ROAD.scene;
  if (!tile || !scene) throw new Error('Missing authored cover');
  const view = { scene, hatch: false, crispOverlays: false };
  // Forest Road's heaps keep a live wash (not painted over) but a seated one.
  expect(surfaceIsSeated(view, true, tile, pos)).toBe(true);
  expect(surfaceIsPainted(view, true, tile, pos)).toBe(false);
  // Missing art, hatch and high contrast get the full wash and its bank back.
  expect(surfaceIsSeated(view, false, tile, pos)).toBe(false);
  expect(surfaceIsSeated({ ...view, hatch: true }, true, tile, pos)).toBe(false);
  expect(surfaceIsSeated({ ...view, crispOverlays: true }, true, tile, pos)).toBe(false);
  // A complete scene paints the heap instead; an unregistered cell has no heap.
  const complete = { ...view, scene: { ...scene, groundMode: undefined } };
  expect(surfaceIsSeated(complete, true, tile, pos)).toBe(false);
  expect(surfaceIsSeated(view, true, tile, { x: 6, y: 3 })).toBe(false);
  // Ability rubble, spreading rubble and any other material keep their bank.
  expect(
    surfaceIsSeated(
      view,
      true,
      { ...tile, surface: { id: 'rubble', duration: 3, spread: 0 } },
      pos,
    ),
  ).toBe(false);
  expect(
    surfaceIsSeated(
      view,
      true,
      { ...tile, surface: { id: 'rubble', duration: -1, spread: 1 } },
      pos,
    ),
  ).toBe(false);
  expect(
    surfaceIsSeated(
      view,
      true,
      { ...tile, surface: { id: 'water', duration: -1, spread: 0 } },
      pos,
    ),
  ).toBe(false);
});
