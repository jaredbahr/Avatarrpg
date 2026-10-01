import { describe, expect, it, vi } from 'vitest';
import type { PropInstance, Unit, Vec2 } from '../../core/types';
import { unitAt } from '../../core/rules/grid';
import { Camera } from '../../render/camera';
import {
  CombatScene,
  combatFocusPosition,
  fallenFacing,
  inspectTargetAt,
  moveHoverFootprint,
  occupiedUnitAt,
  overlayMemoHoverKey,
} from './CombatScene';

function prop(id: string, pos: Vec2): PropInstance {
  return {
    id,
    propId: 'water_barrel',
    pos,
    hp: 6,
    previous: {
      terrain: 'road',
      elevation: 0,
      blocked: false,
      blocksSight: false,
      cover: false,
      surface: null,
    },
  };
}

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

describe('held knockout facing', () => {
  it("keeps a mirrored sheet's bare knockout the way the unit fell", () => {
    expect(fallenFacing('ko', -1)).toBe(-1);
    expect(fallenFacing('ko', 1)).toBe(1);
  });

  it('never mirrors a knockout authored per heading', () => {
    expect(fallenFacing('koSouthWest', -1)).toBe(1);
  });
});

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

    let feasibleFallbacks = 0;
    let blockedStarts = 0;
    let blockedFallbacks = 0;
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        for (const [dx, dy] of directions) {
          const camera = new Camera(viewport, grid, 'oblique');
          camera.scale = 1.5;
          camera.centre();
          camera.clampToProgrammaticReachableSet = true;
          // Pan to an M-boundary vertex/edge before the reflow reveal.
          camera.panBy(dx * 100_000, dy * 100_000);
          const start = { x: camera.offsetX, y: camera.offsetY };
          const pointBefore = camera.project({ x: x + 0.5, y: y + 0.5 });
          const padding = Math.min(16, viewport.width / 2, viewport.height / 2);
          const desiredX = Math.min(viewport.width - padding, Math.max(padding, pointBefore.x));
          const desiredY = Math.min(viewport.height - padding, Math.max(padding, pointBefore.y));
          camera.panBy(desiredX - pointBefore.x, desiredY - pointBefore.y);
          const minimallyRevealed = camera.project({ x: x + 0.5, y: y + 0.5 });
          const blocked =
            minimallyRevealed.x < padding - 0.5 ||
            minimallyRevealed.x > viewport.width - padding + 0.5 ||
            minimallyRevealed.y < padding - 0.5 ||
            minimallyRevealed.y > viewport.height - padding + 0.5;
          camera.offsetX = start.x;
          camera.offsetY = start.y;
          if (blocked) blockedStarts += 1;
          vi.spyOn(camera, 'centreOn').mockImplementation((...args) => {
            if (blocked) blockedFallbacks += 1;
            else feasibleFallbacks += 1;
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
          expect(point.x, `${x},${y} from ${dx},${dy}`).toBeGreaterThanOrEqual(padding - 0.5);
          expect(point.x, `${x},${y} from ${dx},${dy}`).toBeLessThanOrEqual(
            viewport.width - padding + 0.5,
          );
          expect(point.y, `${x},${y} from ${dx},${dy}`).toBeGreaterThanOrEqual(padding - 0.5);
          expect(point.y, `${x},${y} from ${dx},${dy}`).toBeLessThanOrEqual(
            viewport.height - padding + 0.5,
          );
        }
      }
    }
    expect(feasibleFallbacks).toBe(0);
    expect(blockedStarts).toBeGreaterThan(0);
    expect(blockedFallbacks).toBe(blockedStarts);
  });
});

describe('battlefield inspect selection', () => {
  const tile = { x: 4, y: 2 };

  it('lets a living unit anchor win on tap', () => {
    const target = inspectTargetAt([unit('hero', tile)], [prop('barrel', tile)], tile, false);
    expect(target).toMatchObject({ kind: 'unit', unit: { id: 'hero' } });
  });

  it('opens a prop under a fallen unit on tap but the body on hold', () => {
    const fallen = unit('fallen', tile, { hp: 0 });
    expect(inspectTargetAt([fallen], [prop('barrel', tile)], tile, false)).toMatchObject({
      kind: 'prop',
      prop: { id: 'barrel' },
    });
    expect(inspectTargetAt([fallen], [prop('barrel', tile)], tile, true)).toMatchObject({
      kind: 'unit',
      unit: { id: 'fallen' },
    });
  });

  it('lets a size-2 unit win on a non-anchor cell for tap and hold', () => {
    const big = unit('big', tile, { size: 2 });
    const second = { x: tile.x + 1, y: tile.y };
    const underneath = prop('barrel', second);
    expect(inspectTargetAt([big], [underneath], second, false)).toMatchObject({
      kind: 'unit',
      unit: { id: 'big' },
    });
    expect(inspectTargetAt([big], [underneath], second, true)).toMatchObject({
      kind: 'unit',
      unit: { id: 'big' },
    });
  });

  it('chooses a prop when no unit occupies its tile', () => {
    const target = inspectTargetAt([], [prop('barrel', tile)], tile, true);
    expect(target?.kind).toBe('prop');
    expect(target?.kind === 'prop' && target.prop.id).toBe('barrel');
  });

  it('returns nothing for an empty tile', () => {
    expect(inspectTargetAt([], [], tile, true)).toBeUndefined();
  });
});
