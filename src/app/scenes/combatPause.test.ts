import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BattleState, GameState, Unit } from '../../core/types';
import { CombatScene } from './CombatScene';

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
  holdAi(): void;
  releaseAi(): void;
  skipBattleOpening(): boolean;
  resume(): void;
  unmount(): void;
}

function enemyTurnState(): GameState {
  // `activeUnit` only needs the order, the turn index and the unit's faction.
  const enemy = { id: 'bandit', name: 'Bandit', faction: 'enemy' } as unknown as Unit;
  const battle = {
    phase: 'active',
    order: ['bandit'],
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
