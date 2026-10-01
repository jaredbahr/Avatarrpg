import { describe, expect, it, vi } from 'vitest';
import type { Unit, Vec2 } from '../../core/types';
import { unitAt } from '../../core/rules/grid';
import { Camera } from '../../render/camera';
import {
  CombatScene,
  combatFocusPosition,
  moveHoverFootprint,
  occupiedUnitAt,
  overlayMemoHoverKey,
} from './CombatScene';

function unit(id: string, pos: Vec2, extra: Partial<Unit> = {}): Unit {
  return {
    id,
    name: id,
    faction: 'party',
    element: 'fire',
    characterId: null,
    enemyId: null,
    disciplineId: null,
    level: 1,
    xp: 0,
    pos,
    size: 1,
    hp: 10,
    ap: 2,
    move: 3,
    bankedAp: 0,
    pendingAp: 0,
    base: { maxHp: 10, maxAp: 2, maxMove: 3, power: 1, defense: 1, speed: 1, focus: 1 },
    abilities: [],
    cooldowns: {},
    statuses: [],
    ai: 'none',
    temporary: false,
    sprite: 'unit.test',
    ...extra,
  };
}

describe('combat overlay memo key', () => {
  it('tracks hover after a non-target tap, but pins a valid pending target', () => {
    const hover = { x: 4, y: 3 };
    expect(overlayMemoHoverKey(true, false, hover)).toBe('4,3');
    expect(overlayMemoHoverKey(true, true, hover)).toBe('');
    expect(overlayMemoHoverKey(false, false, hover)).toBe('');
  });

  it('invalidates a gated 2x2 move ghost when hover changes', () => {
    expect(overlayMemoHoverKey(false, false, { x: 4, y: 3 }, true)).toBe('4,3');
    expect(overlayMemoHoverKey(false, false, { x: 5, y: 3 }, true)).toBe('5,3');
    expect(overlayMemoHoverKey(false, false, { x: 4, y: 3 })).toBe('');
    expect(moveHoverFootprint({ x: 4, y: 3 }, 2, true)).toEqual([
      { x: 4, y: 3 },
      { x: 5, y: 3 },
      { x: 4, y: 4 },
      { x: 5, y: 4 },
    ]);
    expect(moveHoverFootprint({ x: 4, y: 3 }, 2, false)).toEqual([
      { x: 4, y: 3 },
      { x: 5, y: 3 },
    ]);
  });

  it('preserves the legacy size-2 focus midpoint until square footprints are enabled', () => {
    const unit = { pos: { x: 4, y: 3 }, size: 2 as const };
    expect(combatFocusPosition(unit, false)).toEqual({ x: 4.5, y: 3 });
    expect(combatFocusPosition(unit, true)).toEqual(unit.pos);
  });
});

describe('long-press unit lookup', () => {
  it('finds a defeated unit that the living-unit lookup skips', () => {
    const tile = { x: 4, y: 2 };
    const units = [unit('hero', { x: 1, y: 1 }), unit('fallen', tile, { hp: 0 })];
    // Holding on a body is how a player reads its sheet; `unitAt` never sees it.
    expect(unitAt(units, tile)).toBeUndefined();
    expect(occupiedUnitAt(units, tile)?.id).toBe('fallen');
  });

  it('opens the living unit standing where another fell', () => {
    const tile = { x: 4, y: 2 };
    // The body comes first in the list: array order must not pick it.
    const units = [unit('fallen', tile, { hp: 0 }), unit('standing', tile)];
    expect(occupiedUnitAt(units, tile)?.id).toBe('standing');
  });

  it('picks a size-2 unit on a cell other than its anchor', () => {
    const big = unit('big', { x: 5, y: 3 }, { size: 2 });
    expect(occupiedUnitAt([big], { x: 6, y: 3 })?.id).toBe('big');
    expect(occupiedUnitAt([big], { x: 7, y: 3 })).toBeUndefined();
  });
});

describe('pending move reveal after a viewport reflow', () => {
  it('keeps every cell inside the padded viewport from each reachable-set boundary', () => {
    const viewport = { width: 1194, height: 540, dpr: 1 };
    const grid = { width: 20, height: 12 };
    const directions = [
      [1, 0],
      [2, 1],
      [1, 1],
      [1, 2],
      [0, 1],
      [-1, 2],
      [-1, 1],
      [-2, 1],
      [-1, 0],
      [-2, -1],
      [-1, -1],
      [-1, -2],
      [0, -1],
      [1, -2],
      [1, -1],
      [2, -1],
    ] as const;

    let fallbacks = 0;
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        for (const [dx, dy] of directions) {
          const camera = new Camera(viewport, grid, 'oblique');
          camera.scale = 1.5;
          camera.centre();
          camera.clampToProgrammaticReachableSet = true;
          // Pan to an M-boundary vertex/edge before the reflow reveal.
          camera.panBy(dx * 100_000, dy * 100_000);
          vi.spyOn(camera, 'centreOn').mockImplementation((...args) => {
            fallbacks += 1;
            Camera.prototype.centreOn.call(camera, ...args);
          });

          type RevealHarness = {
            renderer: { camera: Camera };
            pending: Vec2;
            mode: { kind: 'move' };
            lastPendingMoveReveal: null;
            revealPendingMoveAfterViewportChange: () => void;
          };
          const scene = Object.create(CombatScene.prototype) as RevealHarness;
          scene.renderer = { camera };
          scene.pending = { x, y };
          scene.mode = { kind: 'move' };
          scene.lastPendingMoveReveal = null;
          scene.revealPendingMoveAfterViewportChange();

          const point = camera.project({ x: x + 0.5, y: y + 0.5 });
          const padding = Math.min(16, viewport.width / 2, viewport.height / 2);
          expect(point.x, `${x},${y} from ${dx},${dy}`).toBeGreaterThanOrEqual(padding);
          expect(point.x, `${x},${y} from ${dx},${dy}`).toBeLessThanOrEqual(
            viewport.width - padding,
          );
          expect(point.y, `${x},${y} from ${dx},${dy}`).toBeGreaterThanOrEqual(padding);
          expect(point.y, `${x},${y} from ${dx},${dy}`).toBeLessThanOrEqual(
            viewport.height - padding,
          );
        }
      }
    }
    expect(fallbacks).toBeGreaterThan(0);
  });
});
