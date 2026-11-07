import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropInstance, Unit, Vec2 } from '../../core/types';
import { unitAt } from '../../core/rules/grid';
import { CONTENT } from '../../content';
import { Camera } from '../../render/camera';
import type { SheetClips } from '../../render/sheets/store';
import { Animator } from '../animator';
import { TOPDOWN_PRESENTATION_TIMING } from '../anim/choreography';
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
  actingTurnCopy,
} from './CombatScene';
import { beginVictoryBeat } from './victoryBeat';
import { PresentationClock } from './presentationClock';

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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('acting-turn card copy', () => {
  it('names the actor and distinctly labels an allied turn', () => {
    expect(actingTurnCopy({ faction: 'enemy', name: 'Bandit' })).toBe('Bandit is acting');
    expect(actingTurnCopy({ faction: 'ally', name: 'Sura' })).toBe('Ally turn · Sura is acting');
  });

  it('cancels and dismisses an AP confirmation handle without clearing other messages', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
    const handle = Symbol('ap confirmation');
    let dismissed: (() => void) | undefined;
    const show = vi.fn((_text: string, _kind: string, _ms: number, onDismiss?: () => void) => {
      dismissed = onDismiss;
      return handle;
    });
    const dismiss = vi.fn();
    const toasts = { show, dismiss };
    const scene = Object.create(CombatScene.prototype) as unknown as {
      app: { toasts: typeof toasts };
      confirmedEndTurn: boolean;
      endTurnConfirmation: symbol | null;
      endTurnConfirmationTimer: number | null;
      endTurn(unit: Unit): void;
      clearEndTurnConfirmation(): void;
    };
    scene.app = { toasts };
    scene.confirmedEndTurn = false;
    scene.endTurnConfirmation = null;
    scene.endTurnConfirmationTimer = null;

    scene.endTurn(unit('hero', { x: 0, y: 0 }));
    expect(show).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);

    dismissed?.();
    expect(dismiss).toHaveBeenCalledWith(handle);
    expect(scene.confirmedEndTurn).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not arm a confirmation whose toast was suppressed', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
    const show = vi.fn(() => null);
    const scene = Object.create(CombatScene.prototype) as unknown as {
      app: { toasts: { show: typeof show; dismiss: () => void } };
      confirmedEndTurn: boolean;
      endTurnConfirmation: symbol | null;
      endTurnConfirmationTimer: number | null;
      endTurn(unit: Unit): void;
    };
    scene.app = { toasts: { show, dismiss: vi.fn() } };
    scene.confirmedEndTurn = false;
    scene.endTurnConfirmation = null;
    scene.endTurnConfirmationTimer = null;

    scene.endTurn(unit('hero', { x: 0, y: 0 }));
    expect(show).toHaveBeenCalledOnce();
    expect(scene.confirmedEndTurn).toBe(false);
    expect(scene.endTurnConfirmationTimer).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels the AP confirmation during scene unmount', () => {
    const clearConfirmation = vi.fn();
    const scene = Object.create(CombatScene.prototype) as unknown as {
      clearEndTurnConfirmation: () => void;
      stopAiTimer: () => void;
      frame: number;
      suspended: boolean;
      aiHeld: boolean;
      battleOpening: null;
      freshBattleEntry: boolean;
      moreDismiss: null;
      moreOpen: boolean;
      topBarKey: string;
      detach: null;
      inspector: null;
      renderer: null;
      canvas: null;
      host: null;
      unmount(): void;
    };
    scene.clearEndTurnConfirmation = clearConfirmation;
    scene.stopAiTimer = vi.fn();
    scene.frame = 0;
    scene.suspended = false;
    scene.aiHeld = false;
    scene.battleOpening = null;
    scene.freshBattleEntry = false;
    scene.moreDismiss = null;
    scene.moreOpen = false;
    scene.topBarKey = '';
    scene.detach = null;
    scene.inspector = null;
    scene.renderer = null;
    scene.canvas = null;
    scene.host = null;

    scene.unmount();
    expect(clearConfirmation).toHaveBeenCalledOnce();
  });
});

describe('scene-owned top-down playback', () => {
  it('intercepts event playback into its own clock domain and leaves oblique dispatch to App', () => {
    const push = vi.fn();
    const scene = Object.assign(Object.create(CombatScene.prototype) as object, {
      sceneAnimator: { push, finishesAt: 900 },
      presentationClock: new PresentationClock(100),
      battle: () => ({ phase: 'active' }),
      topdownBlowPoints: [],
      topdownBlowEndsAt: 0,
    }) as unknown as CombatScene;
    const events = [{ type: 'turnEnded', unitId: 'hero' }] as const;
    const unitsBefore = [unit('hero', { x: 1, y: 1 })];

    expect(scene.onEvents(events, 150, unitsBefore)).toBe(true);
    expect(push).toHaveBeenCalledWith(150, events, unitsBefore);

    const oblique = Object.assign(Object.create(CombatScene.prototype) as object, {
      sceneAnimator: null,
      presentationClock: null,
      battle: () => ({ phase: 'active' }),
    }) as unknown as CombatScene;
    expect(oblique.onEvents(events, 150, unitsBefore)).toBe(false);
  });

  it('holds both attacker and target focus through a blow, including wind-up', () => {
    const scene = Object.assign(Object.create(CombatScene.prototype) as object, {
      sceneAnimator: { push: vi.fn(), finishesAt: 900 },
      presentationClock: new PresentationClock(100),
      battle: () => ({ phase: 'active' }),
      topdownBlowPoints: [],
      topdownBlowEndsAt: 0,
    }) as unknown as {
      onEvents: CombatScene['onEvents'];
      topdownBlowPoints: Vec2[];
      topdownBlowEndsAt: number;
    };
    const attacker = unit('attacker', { x: 2, y: 3 }, { size: 2 });
    const target = unit('target', { x: 7, y: 4 });

    scene.onEvents(
      [
        {
          type: 'abilityUsed',
          unitId: attacker.id,
          abilityId: 'slam',
          target: target.pos,
          tiles: [target.pos],
        },
      ],
      150,
      [attacker, target],
    );

    expect(scene.topdownBlowPoints).toEqual([
      { x: 3, y: 4 },
      { x: 7.5, y: 4.5 },
    ]);
    expect(scene.topdownBlowEndsAt).toBe(900);
  });

  it('sets one 200 ms enemy deadline after the top-down strike tail', () => {
    const attacker = unit('attacker', { x: 5, y: 3 }, { faction: 'enemy', sprite: 'unit.enemy.thug' });
    const target = unit('target', { x: 1, y: 3 }, { sprite: 'unit.fire.kaya' });
    const animator = new Animator(CONTENT, {
      motionReduced: () => false,
      timingProfile: TOPDOWN_PRESENTATION_TIMING,
      actionQueue: true,
    });
    animator.setProjection('topdown');
    const scene = Object.assign(Object.create(CombatScene.prototype) as object, {
      sceneAnimator: animator,
      presentationClock: new PresentationClock(1000),
      battle: () => ({ phase: 'active' }),
      active: () => attacker,
      suspended: false,
      aiHeld: false,
      presentationHeld: false,
      battleOpening: null,
      aiDueAt: null,
      aiDueUnitId: null,
      aiScheduled: false,
      aiTimer: null,
      topdownBlowPoints: [],
      topdownBlowEndsAt: 0,
    }) as unknown as {
      onEvents: CombatScene['onEvents'];
      maybeRunAi: () => void;
      aiDueAt: number | null;
    };
    scene.onEvents(
      [
        {
          type: 'abilityUsed',
          unitId: attacker.id,
          abilityId: 'fire_jab',
          target: target.pos,
          tiles: [target.pos],
        },
        {
          type: 'damaged',
          unitId: target.id,
          amount: 4,
          crit: false,
          damageType: 'fire',
          sourceId: attacker.id,
        },
      ],
      1000,
      [target, attacker],
    );
    scene.maybeRunAi();

    expect(animator.actionReadyAt).toBeCloseTo(1384.1961538461537, 8);
    expect(animator.finishesAt).toBeCloseTo(2219.1961538461537, 8);
    expect(scene.aiDueAt).toBeCloseTo(1584.1961538461537, 8);
    expect(animator.floaters(animator.actionReadyAt).length).toBeGreaterThan(0);
  });

  it('keeps floaters visual-only and settles only the same actor before its next move', () => {
    const attacker = unit('attacker', { x: 5, y: 3 }, { faction: 'enemy', sprite: 'unit.enemy.thug' });
    const target = unit('target', { x: 1, y: 3 }, { sprite: 'unit.fire.kaya' });
    const other = unit('other', { x: 3, y: 8 });
    const longHit = {
      hit: { frames: ['hit-0', 'hit-1'], fps: 1, loop: false, frameMs: [1000] },
    } as unknown as SheetClips;
    const makeAnimator = () => {
      const animator = new Animator(CONTENT, {
        actionQueue: true,
        motionReduced: () => false,
        timingProfile: TOPDOWN_PRESENTATION_TIMING,
        sheetClips: () => longHit,
      });
      animator.setProjection('topdown');
      animator.push(
        1000,
        [
          {
            type: 'abilityUsed',
            unitId: attacker.id,
            abilityId: 'fire_jab',
            target: target.pos,
            tiles: [target.pos],
          },
          {
            type: 'damaged',
            unitId: target.id,
            amount: 4,
            crit: false,
            damageType: 'fire',
            sourceId: attacker.id,
          },
        ],
        [attacker, target, other],
      );
      return animator;
    };

    const otherActorAnimator = makeAnimator();
    const actionReady = otherActorAnimator.actionReadyAt;
    expect(otherActorAnimator.finishesAt).toBeGreaterThan(actionReady);
    expect(otherActorAnimator.floaters(actionReady).length).toBeGreaterThan(0);
    otherActorAnimator.push(
      actionReady,
      [{ type: 'unitMoved', unitId: other.id, path: [{ x: 4, y: 8 }], cost: 1 }],
      [attacker, target, other],
    );
    expect(otherActorAnimator.renderPos(actionReady + 1, other.id)).toBeDefined();
    expect(otherActorAnimator.floaters(actionReady + 1).length).toBeGreaterThan(0);

    const sameActorAnimator = makeAnimator();
    const settled = sameActorAnimator.actorFinishesAt(target.id);
    expect(settled).toBeGreaterThan(sameActorAnimator.actionReadyAt);
    sameActorAnimator.push(
      sameActorAnimator.actionReadyAt,
      [{ type: 'unitMoved', unitId: target.id, path: [{ x: 2, y: 3 }], cost: 1 }],
      [attacker, target, other],
    );
    const heldAtPriorPosition = sameActorAnimator.renderPos(settled - 1, target.id);
    expect(heldAtPriorPosition).toBeDefined();
    expect(sameActorAnimator.renderPos(settled + 1, target.id)).not.toEqual(heldAtPriorPosition);
  });

  it('holds future virtual sound cues until their presentation deadline', () => {
    const play = vi.fn();
    const scene = Object.assign(Object.create(CombatScene.prototype) as object, {
      sceneAnimator: {},
      app: { audio: { play } },
      topdownSoundQueue: [
        { key: 'hit', at: 90, seed: 1 },
        { key: 'crit', at: 120, seed: 2 },
      ],
    }) as unknown as {
      deliverTopdownSounds: (presentationNow: number, wallNow: number) => void;
      topdownSoundQueue: { key: string; at: number; seed: number }[];
    };

    scene.deliverTopdownSounds(100, 500);

    expect(play).toHaveBeenCalledWith([{ key: 'hit', at: 500, seed: 1 }], 500);
    expect(scene.topdownSoundQueue).toEqual([{ key: 'crit', at: 120, seed: 2 }]);
  });

  it('skip settles the current animation while leaving the enemy gap deadline intact', () => {
    vi.stubGlobal('performance', { now: () => 100 });
    const clock = new PresentationClock(0);
    const scene = Object.assign(Object.create(CombatScene.prototype) as object, {
      presentationClock: clock,
      sceneAnimator: {
        busy: () => true,
        actionBusy: () => true,
        finishesAt: 900,
        actionReadyAt: 500,
        actorFinishesAt: () => 0,
      },
      active: () => ({ id: 'enemy' }),
      aiDueAt: 700,
    }) as unknown as {
      skipPresentation: () => void;
      presentationClock: PresentationClock;
      aiDueAt: number;
    };

    scene.skipPresentation();

    expect(clock.now(100)).toBe(500);
    expect(scene.aiDueAt).toBe(700);
  });

  it('keeps victory Continue behind visual KO completion after action-ready', () => {
    const busy = vi.fn(() => true);
    const startVictoryBeat = vi.fn();
    const scene = Object.assign(Object.create(CombatScene.prototype) as object, {
      sceneAnimator: {
        busy,
        actionBusy: () => false,
        finishesAt: 2000,
        actionReadyAt: 1200,
        actorFinishesAt: () => 0,
      },
      presentationClock: new PresentationClock(0),
      battle: () => ({ phase: 'victory' }),
      victoryPending: true,
      victoryBeat: null,
      suspended: false,
      presentationHeld: false,
      paintingStill: false,
      startVictoryBeat,
    }) as unknown as {
      updateVictoryBeat: (now: number) => void;
      sceneAnimator: { busy: ReturnType<typeof vi.fn> };
      startVictoryBeat: ReturnType<typeof vi.fn>;
    };

    scene.updateVictoryBeat(1500);
    expect(scene.startVictoryBeat).not.toHaveBeenCalled();
    expect(scene.sceneAnimator.busy(1500)).toBe(true);

    busy.mockReturnValue(false);
    scene.updateVictoryBeat(2000);
    expect(scene.startVictoryBeat).toHaveBeenCalledOnce();
  });

  it('does not dispatch from suspend() forced still paint and rearms once on resume', () => {
    let wallNow = 0;
    vi.stubGlobal('performance', { now: () => wallNow });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const enemy = unit('enemy', { x: 3, y: 3 }, { faction: 'enemy' });
    const dispatch = vi.fn();
    const clock = new PresentationClock(0);
    const scene = Object.assign(Object.create(CombatScene.prototype) as object, {
      presentationClock: clock,
      sceneAnimator: { finishesAt: 0, actionReadyAt: 0, actorFinishesAt: () => 0 },
      presentationHeld: false,
      suspended: false,
      paintingStill: false,
      aiHeld: false,
      aiTimer: null,
      aiScheduled: false,
      aiDueAt: null,
      aiDueUnitId: null,
      battleOpening: null,
      frame: 0,
      victoryBeat: null,
      app: {
        state: { battle: { phase: 'active' } },
        animator: { finishesAt: 0, busy: () => false },
        dispatch,
      },
      battle: () => ({ phase: 'active' }),
      active: () => enemy,
      loop: () => undefined,
    }) as unknown as {
      presentationClock: PresentationClock;
      aiDueAt: number | null;
      suspend: () => void;
      resume: () => void;
      loop: () => void;
      maybeRunAi: () => void;
      advanceTopdownAi: (now: number) => void;
      app: { dispatch: ReturnType<typeof vi.fn> };
    };
    scene.loop = () => scene.advanceTopdownAi(scene.presentationClock.now(wallNow));
    scene.maybeRunAi();
    expect(scene.aiDueAt).toBe(200);

    // suspend paints synchronously before flipping suspended=true; this call
    // used to dispatch because the old deadline was already due.
    wallNow = 250;
    scene.suspend();
    expect(dispatch).not.toHaveBeenCalled();
    expect(scene.aiDueAt).toBeNull();

    scene.resume();
    expect(scene.aiDueAt).toBe(450);
    scene.advanceTopdownAi(649);
    expect(dispatch).not.toHaveBeenCalled();
    scene.advanceTopdownAi(650);
    expect(dispatch).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});

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
  // #333's victory branches read the battle on refit; this harness has none.
  Object.assign(scene, { app: { state: null } });
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
    // #326's AP-confirmation state, which unmount() now clears.
    Object.assign(scene, {
      confirmedEndTurn: false,
      endTurnConfirmation: null,
      endTurnConfirmationTimer: null,
    });

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

describe('victory result lifecycle', () => {
  afterEach(() => vi.unstubAllGlobals());

  class FakeElement {
    className = '';
    textContent = '';
    type = '';
    disabled = false;
    readonly children: FakeElement[] = [];
    readonly listeners = new Map<string, () => void>();

    get firstChild(): FakeElement | null {
      return this.children[0] ?? null;
    }

    appendChild(child: FakeElement): FakeElement {
      this.children.push(child);
      return child;
    }

    removeChild(child: FakeElement): FakeElement {
      this.children.splice(this.children.indexOf(child), 1);
      return child;
    }

    addEventListener(name: string, listener: () => void): void {
      this.listeners.set(name, listener);
    }
  }

  class FakeButton extends FakeElement {}

  function resultHarness(reducedMotion = false) {
    vi.stubGlobal('HTMLInputElement', class {});
    vi.stubGlobal('HTMLButtonElement', FakeButton);
    vi.stubGlobal('document', {
      documentElement: { dataset: { reduceMotion: reducedMotion ? 'on' : 'off' } },
      createElement: (tag: string) => (tag === 'button' ? new FakeButton() : new FakeElement()),
    });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });

    const hud = new FakeElement();
    const overlays = new FakeElement();
    const battle = { phase: 'victory', units: [unit('survivor', { x: 2, y: 3 })] };
    const result = new FakeElement();
    result.className = 'result-panel';
    const scene = Object.assign(Object.create(CombatScene.prototype) as object, {
      host: {
        querySelector: (selector: string) =>
          selector === '.hud' ? hud : selector === '.combat-overlays' ? overlays : null,
      },
      battle: () => battle,
      active: () => null,
      app: { animator: { busy: vi.fn(() => false) } },
      renderer: null,
      inspector: null,
      moreOpen: false,
      victoryPending: false,
      victoryBeat: null,
      victoryFocus: null,
      lastActiveId: null,
      resultShown: false,
      suspended: false,
      presentationHeld: false,
      paintingStill: false,
      setVictoryBeatMarker: vi.fn(),
      renderTopBar: vi.fn(),
      renderTurnStrip: vi.fn(),
      resizeAfterHud: vi.fn(),
      maybeStartBattleOpening: vi.fn(),
      maybeRunAi: vi.fn(),
      setMoreOpen: vi.fn(),
      resultPanel: vi.fn(() => result),
    }) as unknown as {
      victoryPending: boolean;
      victoryBeat: ReturnType<typeof beginVictoryBeat> | null;
      app: { animator: { busy: ReturnType<typeof vi.fn> } };
      sync: () => void;
      renderHud: () => void;
      refit: () => void;
      updateVictoryBeat: (now: number) => void;
      startVictoryBeat: (battle: object, now: number) => void;
      resultPanel: ReturnType<typeof vi.fn>;
    };
    return { scene, battle, hud, overlays, result };
  }

  it('keeps the actual result overlay hidden through final playback and the timed beat', () => {
    const { scene, overlays, result } = resultHarness();
    scene.app.animator.busy.mockReturnValue(true);

    scene.sync();
    expect(scene.victoryPending).toBe(true);
    scene.updateVictoryBeat(100);
    expect(overlays.children).toEqual([]);
    expect(scene.resultPanel).not.toHaveBeenCalled();

    scene.app.animator.busy.mockReturnValue(false);
    scene.updateVictoryBeat(200);
    expect(overlays.children[0]?.className).toBe('victory-beat-overlay');
    expect(scene.resultPanel).not.toHaveBeenCalled();

    scene.updateVictoryBeat(1200);
    expect(overlays.children).toEqual([result]);
    expect(scene.resultPanel).toHaveBeenCalledOnce();
  });

  it('lets a tap on the beat overlay reveal the result immediately', () => {
    const { scene, overlays, result } = resultHarness();
    scene.victoryBeat = beginVictoryBeat(100, 1000);
    scene.renderHud();
    expect(overlays.children[0]?.className).toBe('victory-beat-overlay');

    overlays.children[0]?.listeners.get('click')?.();

    expect(scene.victoryBeat).toBeNull();
    expect(overlays.children).toEqual([result]);
  });

  for (const [label, reducedMotion, pending] of [
    ['final-hit playback', false, true],
    ['reduced-motion result', true, false],
  ] as const) {
    it(`preserves camera scale and offsets through HUD growth during ${label}`, () => {
      const { scene } = resultHarness(reducedMotion);
      const camera = new Camera({ width: 900, height: 500, dpr: 1 }, { width: 20, height: 12 });
      camera.fit();
      camera.centre();
      const before = { scale: camera.scale, x: camera.offsetX, y: camera.offsetY };
      const recentre = vi.fn();
      Object.assign(scene, {
        victoryPending: pending,
        renderer: { camera },
        recentre,
        syncRecentre: vi.fn(),
      });
      camera.viewport = { width: 1200, height: 700, dpr: 1 };

      scene.refit();

      expect(camera.scale).toBe(before.scale);
      expect(camera.offsetX).toBe(before.x);
      expect(camera.offsetY).toBe(before.y);
      expect(recentre).not.toHaveBeenCalled();
    });
  }

  it('keeps the camera still under reduced motion, then reveals the card after playback', () => {
    const { scene, overlays, result, battle } = resultHarness(true);
    scene.victoryPending = true;
    const frame = vi.spyOn(scene, 'startVictoryBeat');
    const frameParty = vi.fn();
    Object.assign(scene, { renderer: { camera: {} }, frameVictoryParty: frameParty });
    scene.app.animator.busy.mockReturnValue(true);
    scene.updateVictoryBeat(100);
    expect(frame).not.toHaveBeenCalled();

    scene.app.animator.busy.mockReturnValue(false);
    scene.updateVictoryBeat(200);
    expect(frame).toHaveBeenCalledWith(battle, 200);
    expect(frameParty).not.toHaveBeenCalled();
    expect(scene.victoryBeat).toBeNull();
    expect(overlays.children).toEqual([result]);
  });

  it('cancels the presentation beat if the battle leaves victory', () => {
    const scene = Object.assign(Object.create(CombatScene.prototype) as object, {
      victoryBeat: beginVictoryBeat(100, 700),
      victoryFocus: { x: 3, y: 4 },
      battle: () => ({ phase: 'active' }),
      setVictoryBeatMarker: vi.fn(),
      renderTopBar: vi.fn(),
      renderHud: vi.fn(),
    }) as unknown as {
      victoryBeat: ReturnType<typeof beginVictoryBeat> | null;
      victoryFocus: Vec2 | null;
      updateVictoryBeat: (now: number) => void;
      setVictoryBeatMarker: ReturnType<typeof vi.fn>;
      renderTopBar: ReturnType<typeof vi.fn>;
      renderHud: ReturnType<typeof vi.fn>;
    };

    scene.updateVictoryBeat(150);

    expect(scene.victoryBeat).toBeNull();
    expect(scene.victoryFocus).toBeNull();
    expect(scene.setVictoryBeatMarker).toHaveBeenCalledWith(false);
    expect(scene.renderHud).toHaveBeenCalledOnce();
  });

  it('clears the pending beat when the combat scene unmounts', () => {
    const scene = Object.assign(Object.create(CombatScene.prototype) as object, {
      aiTimer: null,
      frame: 0,
      suspended: false,
      aiHeld: false,
      aiScheduled: false,
      aiDueAt: 500,
      aiDueUnitId: 'enemy',
      presentationClock: new PresentationClock(0),
      presentationHeld: false,
      sceneAnimator: { clear: vi.fn() },
      topdownSoundQueue: [{ key: 'hit', at: 250, seed: 1 }],
      topdownBlowPoints: [{ x: 2, y: 2 }],
      topdownBlowEndsAt: 300,
      battleOpening: null,
      victoryBeat: beginVictoryBeat(100, 700),
      victoryFocus: { x: 3, y: 4 },
      // #326's AP confirmation and #327's glide, which unmount() also clears.
      confirmedEndTurn: false,
      endTurnConfirmation: null,
      endTurnConfirmationTimer: null,
      cameraGlide: null,
      freshBattleEntry: false,
      recentreButton: null,
      actorButton: null,
      moreDismiss: null,
      moreOpen: false,
      topBarKey: '',
      detach: null,
      inspector: null,
      renderer: null,
      canvas: null,
      host: null,
      setVictoryBeatMarker: vi.fn(),
    }) as unknown as {
      victoryBeat: ReturnType<typeof beginVictoryBeat> | null;
      victoryFocus: Vec2 | null;
      unmount: () => void;
      setVictoryBeatMarker: ReturnType<typeof vi.fn>;
      sceneAnimator: { clear: ReturnType<typeof vi.fn> };
      topdownSoundQueue: unknown[];
      topdownBlowPoints: Vec2[];
      aiDueAt: number | null;
      aiDueUnitId: string | null;
    };

    scene.unmount();

    expect(scene.victoryBeat).toBeNull();
    expect(scene.victoryFocus).toBeNull();
    expect(scene.setVictoryBeatMarker).toHaveBeenCalledWith(false);
    expect(scene.sceneAnimator.clear).toHaveBeenCalledOnce();
    expect(scene.topdownSoundQueue).toEqual([]);
    expect(scene.topdownBlowPoints).toEqual([]);
    expect(scene.aiDueAt).toBeNull();
    expect(scene.aiDueUnitId).toBeNull();
  });

  it('pauses presentation separately from the AI dispatch hold', () => {
    const scene = Object.assign(Object.create(CombatScene.prototype) as object, {
      aiTimer: null,
      aiScheduled: false,
      aiHeld: false,
      presentationHeld: false,
      victoryBeat: beginVictoryBeat(100, 700),
      maybeRunAi: vi.fn(),
    }) as unknown as {
      aiHeld: boolean;
      presentationHeld: boolean;
      victoryBeat: ReturnType<typeof beginVictoryBeat>;
      holdAi: () => void;
      releaseAi: () => void;
      pausePresentation: () => void;
      resumePresentation: () => void;
      maybeRunAi: ReturnType<typeof vi.fn>;
    };

    scene.holdAi();
    expect(scene.aiHeld).toBe(true);
    expect(scene.presentationHeld).toBe(false);
    expect(scene.victoryBeat.lastAt).toBe(100);

    scene.pausePresentation();
    expect(scene.presentationHeld).toBe(true);
    expect(scene.victoryBeat.lastAt).toBeNull();
    scene.resumePresentation();
    expect(scene.presentationHeld).toBe(false);
    expect(scene.victoryBeat.lastAt).toBeNull();
    expect(scene.maybeRunAi).toHaveBeenCalledOnce();

    scene.releaseAi();
    expect(scene.maybeRunAi).toHaveBeenCalledTimes(2);
  });
});
