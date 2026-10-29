import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BattleState, GameState, Unit } from '../../core/types';
import { CombatScene } from './CombatScene';
import type { CombatCameraGlide } from './combatCameraFollow';

/**
 * The enemy AI is scheduled on a window timer. Pausing must stop that timer
 * from advancing the fight, and releasing must re-arm exactly one turn.
 */
interface AiScene {
  app: { state: GameState; animator: { finishesAt: number }; dispatch: ReturnType<typeof vi.fn> };
  aiTimer: number | null;
  aiScheduled: boolean;
  aiHeld: boolean;
  suspended: boolean;
  battleOpening: unknown;
  cameraGlide: CombatCameraGlide | null;
  frame: number;
  paintingStill: boolean;
  loop: () => void;
  moreDismiss: null;
  detach: null;
  inspector: null;
  renderer: null;
  moreOpen: boolean;
  topBarKey: string;
  freshBattleEntry: boolean;
  recentreButton: null;
  actorButton: null;
  host: null;
  canvas: null;
  maybeRunAi(): void;
  stopAiTimer(): void;
  cancelCameraGlide(): void;
  holdAi(): void;
  releaseAi(): void;
  skipBattleOpening(): boolean;
  suspend(): void;
  resume(): void;
  unmount(): void;
}

function enemyTurnState(id = 'bandit'): GameState {
  // `activeUnit` only needs the order, the turn index and the unit's faction.
  const enemy = { id, name: 'Bandit', faction: 'enemy' } as unknown as Unit;
  const battle = {
    phase: 'active',
    order: [id],
    turnIndex: 0,
    units: [enemy],
  } as unknown as BattleState;
  return { screen: 'combat', battle } as unknown as GameState;
}

function aiScene(): AiScene {
  const scene = Object.create(CombatScene.prototype) as unknown as AiScene;
  scene.app = { state: enemyTurnState(), animator: { finishesAt: 0 }, dispatch: vi.fn() };
  scene.aiTimer = null;
  scene.aiScheduled = false;
  scene.aiHeld = false;
  scene.suspended = false;
  scene.battleOpening = null;
  scene.cameraGlide = null;
  scene.frame = 0;
  scene.paintingStill = false;
  scene.loop = vi.fn();
  scene.moreDismiss = null;
  scene.detach = null;
  scene.inspector = null;
  scene.renderer = null;
  scene.moreOpen = false;
  scene.topBarKey = '';
  scene.freshBattleEntry = false;
  scene.recentreButton = null;
  scene.actorButton = null;
  scene.host = null;
  scene.canvas = null;
  return scene;
}

function startCameraGlide(scene: AiScene): void {
  scene.cameraGlide = {
    from: { x: 0, y: 0 },
    to: { x: 1000, y: 0 },
    startedAt: performance.now(),
    duration: 420,
  };
}

describe('pause holds enemy AI', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('cancels a queued enemy turn while held and re-arms exactly one on release', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    const scene = aiScene();
    scene.maybeRunAi();
    expect(scene.aiTimer).not.toBeNull();

    scene.holdAi();
    expect(scene.aiHeld).toBe(true);
    expect(scene.aiScheduled).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(scene.app.dispatch).not.toHaveBeenCalled();

    scene.releaseAi();
    vi.advanceTimersByTime(10_000);
    expect(scene.app.dispatch).toHaveBeenCalledTimes(1);
    expect(scene.app.dispatch).toHaveBeenCalledWith({ type: 'runAiTurn' });

    vi.advanceTimersByTime(10_000);
    expect(scene.app.dispatch).toHaveBeenCalledTimes(1);
  });

  it('ignores an AI callback that fires after a hold it did not cancel', () => {
    vi.useFakeTimers();
    const queued: Array<() => void> = [];
    vi.stubGlobal('window', {
      setTimeout: (handler: () => void) => {
        queued.push(handler);
        return 1;
      },
      clearTimeout: () => undefined,
    });
    const scene = aiScene();
    scene.maybeRunAi();
    expect(queued).toHaveLength(1);

    scene.holdAi();
    queued[0]?.();
    expect(scene.app.dispatch).not.toHaveBeenCalled();
  });

  it('leaves no queued enemy turn once the scene unmounts (load or quit)', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    const scene = aiScene();
    scene.maybeRunAi();
    scene.holdAi();
    scene.releaseAi();
    scene.unmount();

    vi.advanceTimersByTime(10_000);
    expect(scene.app.dispatch).not.toHaveBeenCalled();
  });

  it('leaves the battle opening untouched while held', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    const scene = aiScene();
    const opening = { kind: 'hold' };
    scene.battleOpening = opening;
    scene.skipBattleOpening = vi.fn(() => true);

    scene.holdAi();
    scene.releaseAi();

    expect(scene.skipBattleOpening).not.toHaveBeenCalled();
    expect(scene.battleOpening).toBe(opening);
    // The opening already parks the first enemy turn, so a release arms nothing.
    expect(scene.aiTimer).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(scene.app.dispatch).not.toHaveBeenCalled();
  });

  it('does not resume a dialogue-suspended scene when the hold is released', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    const scene = aiScene();
    scene.suspended = true;
    scene.holdAi();

    scene.releaseAi();

    expect(scene.suspended).toBe(true);
    expect(scene.aiTimer).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(scene.app.dispatch).not.toHaveBeenCalled();
  });

  it('arms only when the pause releases, not when a conversation ends', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    const scene = aiScene();
    scene.suspended = true;
    scene.holdAi();

    // The conversation ends: the retained combat scene resumes while paused.
    scene.resume();
    expect(scene.suspended).toBe(false);
    expect(scene.aiTimer).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(scene.app.dispatch).not.toHaveBeenCalled();

    scene.releaseAi();
    vi.advanceTimersByTime(10_000);
    expect(scene.app.dispatch).toHaveBeenCalledTimes(1);
  });
});

describe('camera reveal waits before enemy AI', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('waits for a rendered reveal even after its deadline, then dispatches exactly once', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    const scene = aiScene();
    startCameraGlide(scene);
    scene.maybeRunAi();

    vi.advanceTimersByTime(260);
    expect(scene.app.dispatch).not.toHaveBeenCalled();
    expect(scene.aiScheduled).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    // A delayed render frame has not cleared the reveal yet. Elapsed wall
    // time alone must not let the enemy act before it has appeared.
    vi.advanceTimersByTime(240);
    scene.maybeRunAi();
    expect(scene.app.dispatch).not.toHaveBeenCalled();
    expect(scene.aiScheduled).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    scene.cameraGlide = null;
    vi.advanceTimersByTime(100);
    expect(scene.app.dispatch).toHaveBeenCalledTimes(1);
    expect(scene.app.dispatch).toHaveBeenCalledWith({ type: 'runAiTurn' });
    expect(scene.aiTimer).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(scene.app.dispatch).toHaveBeenCalledTimes(1);
  });

  it('continues once navigation cancels a reveal while its AI retry is queued', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    const scene = aiScene();
    startCameraGlide(scene);
    scene.maybeRunAi();
    vi.advanceTimersByTime(260);
    expect(scene.app.dispatch).not.toHaveBeenCalled();

    scene.cancelCameraGlide();
    vi.advanceTimersByTime(1000);

    expect(scene.app.dispatch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['holdAi', 'suspend', 'unmount'] as const)(
    '%s cancels a queued reveal retry without advancing the fight',
    (stop) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
      vi.stubGlobal('window', { setTimeout, clearTimeout });
      const scene = aiScene();
      startCameraGlide(scene);
      scene.maybeRunAi();
      vi.advanceTimersByTime(260);
      expect(vi.getTimerCount()).toBe(1);

      scene[stop]();

      expect(scene.aiTimer).toBeNull();
      expect(scene.aiScheduled).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(1000);
      expect(scene.app.dispatch).not.toHaveBeenCalled();
    },
  );

  it('keeps the next actor timer owned when a canceled actor retry still fires', () => {
    const queued: Array<() => void> = [];
    const clear = vi.fn();
    vi.stubGlobal('window', {
      setTimeout: (handler: () => void) => {
        queued.push(handler);
        return queued.length;
      },
      clearTimeout: clear,
    });
    const scene = aiScene();
    startCameraGlide(scene);
    scene.maybeRunAi();
    queued[0]?.();
    expect(queued).toHaveLength(2);
    const canceledRetry = scene.aiTimer;

    scene.stopAiTimer();
    scene.app.state = enemyTurnState('next-bandit');
    scene.maybeRunAi();
    const nextTimer = scene.aiTimer;
    expect(nextTimer).not.toBeNull();
    expect(nextTimer).not.toBe(canceledRetry);
    expect(clear).toHaveBeenCalledWith(canceledRetry);

    queued[1]?.();

    expect(scene.aiTimer).toBe(nextTimer);
    expect(scene.aiScheduled).toBe(true);
    expect(scene.app.dispatch).not.toHaveBeenCalled();

    scene.unmount();
    expect(clear).toHaveBeenCalledWith(nextTimer);
    queued[2]?.();
    expect(scene.aiTimer).toBeNull();
    expect(scene.app.dispatch).not.toHaveBeenCalled();
  });
});
