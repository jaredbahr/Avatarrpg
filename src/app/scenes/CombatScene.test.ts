import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropInstance, Unit, Vec2 } from '../../core/types';
import { unitAt } from '../../core/rules/grid';
import { Camera } from '../../render/camera';
import {
  combatCameraFollowDecision,
  combatCameraGlidePoint,
  type CombatCameraGlide,
} from './combatCameraFollow';
import {
  CombatScene,
  combatFocusPosition,
  fallenFacing,
  inspectTargetAt,
  moveHoverFootprint,
  overlayMemoInputKey,
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

interface CameraSceneHarness {
  renderer: { camera: Camera; destroy?: () => void };
  host?: HTMLElement | null;
  frame?: number;
  suspended?: boolean;
  aiHeld?: boolean;
  freshBattleEntry?: boolean;
  topBarKey?: string;
  recentreButton?: HTMLButtonElement | null;
  actorButton?: HTMLButtonElement | null;
  moreDismiss?: (() => void) | null;
  detach?: (() => void) | null;
  inspector?: { close: () => void } | null;
  canvas?: HTMLCanvasElement | null;
  stopAiTimer?: () => void;
  cameraGlide: CombatCameraGlide | null;
  manualCamera: boolean;
  followSuspended: boolean;
  battleOpening: null;
  pending: null;
  mode: { kind: 'idle' };
  moreOpen: boolean;
  skipBattleOpening: () => boolean;
  setCameraGlideMarker: (active: boolean) => void;
  syncRecentre: () => void;
  active: () => Unit;
  centreOnActiveUnit: (unit: Unit | undefined, camera?: Camera, animate?: boolean) => void;
  zoomBy: (factor: number, at: Vec2) => void;
  pan: (dx: number, dy: number) => void;
  recentre: () => void;
  refit: () => void;
  cancelCameraGlide: () => void;
  updateCameraGlide: (now: number, camera?: Camera) => void;
  unmount: () => void;
}

function cameraSceneHarness(): CameraSceneHarness {
  const camera = new Camera(
    { width: 420, height: 320, dpr: 1.5 },
    { width: 6, height: 6 },
    'orthographic',
  );
  camera.fit();
  camera.zoomAt({ x: 210, y: 160 }, 1.8);
  const scene = Object.create(CombatScene.prototype) as CameraSceneHarness;
  scene.renderer = { camera };
  scene.cameraGlide = null;
  scene.manualCamera = false;
  scene.followSuspended = false;
  scene.battleOpening = null;
  scene.pending = null;
  scene.mode = { kind: 'idle' };
  scene.moreOpen = false;
  scene.skipBattleOpening = () => false;
  scene.syncRecentre = () => undefined;
  scene.active = () => unit('active', { x: 4, y: 4 });
  return scene;
}

describe('combat camera glide ownership', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { documentElement: { dataset: {} } });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
  });
  afterEach(() => vi.unstubAllGlobals());

  const glide = {
    from: { x: 20, y: 30 },
    to: { x: 200, y: 220 },
    startedAt: 100,
    duration: 420,
  };

  it('keeps fitted boards unchanged when a turn asks for centring', () => {
    const scene = cameraSceneHarness();
    scene.renderer.camera.fit();
    const before = {
      x: scene.renderer.camera.offsetX,
      y: scene.renderer.camera.offsetY,
      scale: scene.renderer.camera.scale,
    };
    scene.centreOnActiveUnit(scene.active(), scene.renderer.camera, true);
    expect(scene.cameraGlide).toBeNull();
    expect(scene.renderer.camera.offsetX).toBe(before.x);
    expect(scene.renderer.camera.offsetY).toBe(before.y);
    expect(scene.renderer.camera.scale).toBe(before.scale);
  });

  it('cuts directly to the actor under reduced motion', () => {
    const scene = cameraSceneHarness();
    (document.documentElement.dataset as Record<string, string>).reduceMotion = 'on';
    const expected = new Camera(
      { width: 420, height: 320, dpr: 1.5 },
      { width: 6, height: 6 },
      'orthographic',
    );
    expected.fit();
    expected.zoomAt({ x: 210, y: 160 }, 1.8);
    expected.centreOn(scene.active().pos, scene.active().size);

    scene.centreOnActiveUnit(scene.active(), scene.renderer.camera, true);

    expect(scene.cameraGlide).toBeNull();
    expect(scene.renderer.camera.offsetX).toBe(expected.offsetX);
    expect(scene.renderer.camera.offsetY).toBe(expected.offsetY);
  });

  it('cancels an active glide on pan, pinch zoom, and explicit Recentre', () => {
    const scene = cameraSceneHarness();
    scene.cameraGlide = { ...glide, startedAt: performance.now() };
    scene.renderer.camera.panBy(1_000_000, 1_000_000);
    const panStop = {
      x: scene.renderer.camera.offsetX,
      y: scene.renderer.camera.offsetY,
    };
    scene.manualCamera = false;
    scene.followSuspended = false;
    scene.cameraGlide = { ...glide, startedAt: performance.now() };
    scene.pan(1_000_000, 1_000_000);
    expect(scene.renderer.camera.offsetX).toBe(panStop.x);
    expect(scene.renderer.camera.offsetY).toBe(panStop.y);
    expect(scene.cameraGlide).toBeNull();
    expect(scene.manualCamera).toBe(true);
    expect(scene.followSuspended).toBe(true);
    scene.updateCameraGlide(performance.now() + 1000, scene.renderer.camera);
    expect(scene.renderer.camera.offsetX).toBe(panStop.x);
    expect(scene.renderer.camera.offsetY).toBe(panStop.y);

    scene.renderer.camera.scale = 2.5;
    scene.renderer.camera.clamp();
    const zoomStop = {
      x: scene.renderer.camera.offsetX,
      y: scene.renderer.camera.offsetY,
      scale: scene.renderer.camera.scale,
    };
    scene.manualCamera = false;
    scene.followSuspended = false;
    scene.cameraGlide = { ...glide, startedAt: performance.now() };
    scene.zoomBy(2, { x: 210, y: 160 });
    expect(scene.renderer.camera.offsetX).toBe(zoomStop.x);
    expect(scene.renderer.camera.offsetY).toBe(zoomStop.y);
    expect(scene.renderer.camera.scale).toBe(zoomStop.scale);
    expect(scene.cameraGlide).toBeNull();
    expect(scene.manualCamera).toBe(true);
    expect(scene.followSuspended).toBe(true);
    scene.updateCameraGlide(performance.now() + 1000, scene.renderer.camera);
    expect(scene.renderer.camera.offsetX).toBe(zoomStop.x);
    expect(scene.renderer.camera.offsetY).toBe(zoomStop.y);
    expect(scene.renderer.camera.scale).toBe(zoomStop.scale);

    scene.manualCamera = false;
    scene.followSuspended = false;
    scene.renderer.camera.fit();
    scene.cameraGlide = glide;
    scene.recentre();
    expect(scene.cameraGlide).toBeNull();
    expect(scene.manualCamera).toBe(false);
    expect(scene.followSuspended).toBe(false);
  });

  it('retargets on HUD reflow without snapping the active glide to its actor', () => {
    const scene = cameraSceneHarness();
    scene.cameraGlide = { ...glide, startedAt: performance.now() };
    const before = {
      x: scene.renderer.camera.offsetX,
      y: scene.renderer.camera.offsetY,
    };
    scene.refit();
    expect(scene.cameraGlide).not.toBeNull();
    expect(scene.cameraGlide?.from).toEqual(before);
    expect(scene.renderer.camera.offsetX).toBe(before.x);
    expect(scene.renderer.camera.offsetY).toBe(before.y);
  });

  it('updates offset frames to the exact target without scaling, and motion changes cut it', () => {
    const scene = cameraSceneHarness();
    const camera = scene.renderer.camera;
    const combatRoot = { dataset: {} as Record<string, string> };
    scene.host = { querySelector: () => combatRoot } as unknown as HTMLElement;
    const from = { x: camera.offsetX, y: camera.offsetY };
    camera.centreOn(scene.active().pos, scene.active().size);
    const to = { x: camera.offsetX, y: camera.offsetY };
    camera.offsetX = from.x;
    camera.offsetY = from.y;
    const scale = camera.scale;
    const glide = { from, to, startedAt: 1000, duration: 420 };
    scene.cameraGlide = glide;
    scene.setCameraGlideMarker(true);

    scene.updateCameraGlide(1210, camera);
    expect(camera.offsetX).toBe(combatCameraGlidePoint(glide, 1210).x);
    expect(camera.offsetY).toBe(combatCameraGlidePoint(glide, 1210).y);
    expect(camera.scale).toBe(scale);
    expect(combatRoot.dataset.cameraGlide).toBe('active');

    scene.updateCameraGlide(1420, camera);
    expect(camera.offsetX).toBe(to.x);
    expect(camera.offsetY).toBe(to.y);
    expect(camera.scale).toBe(scale);
    expect(scene.cameraGlide).toBeNull();
    expect(combatRoot.dataset.cameraGlide).toBeUndefined();

    camera.centreOn({ x: 0, y: 0 }, 1);
    const reducedTo = { x: camera.offsetX, y: camera.offsetY };
    const reducedFrom = { x: reducedTo.x + 20, y: reducedTo.y + 15 };
    camera.offsetX = reducedFrom.x;
    camera.offsetY = reducedFrom.y;
    scene.cameraGlide = { from: reducedFrom, to: reducedTo, startedAt: 2000, duration: 420 };
    scene.setCameraGlideMarker(true);
    (document.documentElement.dataset as Record<string, string>).reduceMotion = 'on';

    scene.updateCameraGlide(2100, camera);

    expect(camera.offsetX).toBe(reducedTo.x);
    expect(camera.offsetY).toBe(reducedTo.y);
    expect(camera.scale).toBe(scale);
    expect(scene.cameraGlide).toBeNull();
    expect(combatRoot.dataset.cameraGlide).toBeUndefined();
  });

  it('clamps to the fitted frame and cancels when a resize makes the board fit', () => {
    const scene = cameraSceneHarness();
    const camera = scene.renderer.camera;
    scene.cameraGlide = { ...glide, startedAt: performance.now() };
    camera.viewport = { width: 800, height: 600, dpr: 1.5 };
    const expected = new Camera(camera.viewport, camera.grid, camera.projection);
    expected.scale = camera.scale;
    expected.offsetX = camera.offsetX;
    expected.offsetY = camera.offsetY;
    expected.clamp();

    scene.refit();

    expect(scene.cameraGlide).toBeNull();
    expect(camera.offsetX).toBe(expected.offsetX);
    expect(camera.offsetY).toBe(expected.offsetY);
  });

  it('lets follow own the frame, then glides on the release hand-off', () => {
    const state = { kind: 'following', unitId: 'boss' } as const;
    const following = combatCameraFollowDecision(state, {
      animatedUnitId: 'boss',
      activeUnitId: 'hero',
      followSuspended: false,
      reducedMotion: false,
    });
    expect(following.owner).toBe('follow');

    const scene = cameraSceneHarness();
    scene.cameraGlide = glide;
    scene.cancelCameraGlide();
    expect(scene.cameraGlide).toBeNull();

    const released = combatCameraFollowDecision(following.state, {
      animatedUnitId: null,
      activeUnitId: 'hero',
      followSuspended: false,
      reducedMotion: false,
    });
    expect(released.owner).toBe('recentre');
    scene.centreOnActiveUnit(scene.active(), scene.renderer.camera, true);
    expect(scene.cameraGlide?.duration).toBe(420);
  });

  it('clears the active marker and glide state during teardown', () => {
    const scene = cameraSceneHarness();
    const combatRoot = { dataset: { cameraGlide: 'active' } };
    scene.cameraGlide = { ...glide, startedAt: performance.now() };
    scene.host = {
      querySelector: () => combatRoot,
    } as unknown as HTMLElement;
    scene.frame = 0;
    scene.stopAiTimer = () => undefined;
    scene.renderer.destroy = () => undefined;
    scene.suspended = false;
    scene.aiHeld = false;
    scene.freshBattleEntry = false;
    scene.topBarKey = '';
    scene.recentreButton = null;
    scene.actorButton = null;
    scene.moreDismiss = null;
    scene.detach = null;
    scene.inspector = null;
    scene.canvas = null;

    scene.unmount();

    expect(scene.cameraGlide).toBeNull();
    expect(combatRoot.dataset.cameraGlide).toBeUndefined();
  });
});

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

  it('keys protected tiles by mode, ability, pending tile, and active unit', () => {
    const pending = { x: 4, y: 3 };
    const first = overlayMemoInputKey({ kind: 'aim', abilityId: 'first' }, pending, 'hero');
    expect(overlayMemoInputKey({ kind: 'move' }, pending, 'hero')).not.toBe(first);
    expect(overlayMemoInputKey({ kind: 'aim', abilityId: 'second' }, pending, 'hero')).not.toBe(
      first,
    );
    expect(
      overlayMemoInputKey({ kind: 'aim', abilityId: 'first' }, { x: 5, y: 3 }, 'hero'),
    ).not.toBe(first);
    expect(overlayMemoInputKey({ kind: 'aim', abilityId: 'first' }, pending, 'other')).not.toBe(
      first,
    );
  });

  it('focuses the shipped 2x2 at its anchor and retains explicit legacy focus', () => {
    const unit = { pos: { x: 4, y: 3 }, size: 2 as const };
    expect(combatFocusPosition(unit)).toEqual(unit.pos);
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

  it('lets every cell of a gate-on 2x2 win on tap and hold', () => {
    const big = unit('big', tile, { size: 2 });
    for (const cell of [
      tile,
      { x: tile.x + 1, y: tile.y },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x + 1, y: tile.y + 1 },
    ]) {
      const underneath = prop('barrel', cell);
      expect(inspectTargetAt([big], [underneath], cell, false)).toMatchObject({
        kind: 'unit',
        unit: { id: 'big' },
      });
      expect(inspectTargetAt([big], [underneath], cell, true)).toMatchObject({
        kind: 'unit',
        unit: { id: 'big' },
      });
    }
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

describe('battle opening input hand-off', () => {
  it('lets any battlefield tap skip the establishing frame before normal input checks', () => {
    const scene = Object.create(CombatScene.prototype) as {
      renderer: object;
      battleOpening: object;
      battle: () => object;
      skipBattleOpening: ReturnType<typeof vi.fn>;
      onTap: (x: number, y: number) => void;
    };
    scene.renderer = {};
    scene.battle = () => ({}) as object;
    scene.battleOpening = {};
    scene.skipBattleOpening = vi.fn(() => true);

    scene.onTap(10, 10);

    expect(scene.skipBattleOpening).toHaveBeenCalledOnce();
  });
});
