import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Command, GameEvent, GameState, PendingChoice } from '../core/types';
import { CONTENT } from '../content';
import { createGame } from '../core/state/createGame';
import { apply } from '../core/state/reducer';
import { RIVERSIDE_ENTRY } from '../content/maps/riverside';
import { App, isAutosaveCheckpoint } from './App';
import { Session } from './session';

/**
 * These tests run in the node environment, where the reward dialogs and the
 * pause menu have no DOM to open into. Capturing their construction and open
 * calls is enough to assert the App's wiring: which pick is offered, when, and
 * whether the scene is suspended.
 */
interface ChoiceLike {
  readonly unitId: string;
  readonly options: readonly string[];
}

const { opened, pauseMenus } = vi.hoisted(() => ({
  opened: [] as Array<{ kind: 'ability' | 'discipline'; choice: ChoiceLike }>,
  pauseMenus: [] as Array<{ onDismiss: () => void; close(): void }>,
}));

vi.mock('./ui/LevelUpDialog', () => ({
  LevelUpDialog: class {
    constructor(
      _app: unknown,
      public readonly choice: ChoiceLike,
      public readonly done: () => void,
    ) {}
    open(): void {
      opened.push({ kind: 'ability', choice: this.choice });
    }
    close(): void {
      this.done();
    }
  },
}));

vi.mock('./ui/DisciplineDialog', () => ({
  DisciplineDialog: class {
    constructor(
      _app: unknown,
      public readonly choice: ChoiceLike,
      public readonly done: () => void,
    ) {}
    open(): void {
      opened.push({ kind: 'discipline', choice: this.choice });
    }
    close(): void {
      this.done();
    }
  },
}));

vi.mock('./ui/PauseMenu', () => ({
  PauseMenu: class {
    constructor(
      _app: unknown,
      public readonly onDismiss: () => void,
    ) {
      pauseMenus.push(this);
    }
    open(): void {}
    close(): void {
      this.onDismiss();
    }
  },
}));

interface AppInternals {
  state: GameState | null;
  saveTo: ReturnType<typeof vi.fn>;
  offerLevelUpIfPending: ReturnType<typeof vi.fn>;
  routeToState: ReturnType<typeof vi.fn>;
  autosaveIfWorthIt: (
    command: Command,
    events: readonly GameEvent[],
    choiceConsumed: boolean,
  ) => void;
}

function internals(app: App): AppInternals {
  return app as unknown as AppInternals;
}

function makeApp(overrides: Record<string, unknown> = {}): App {
  const app = Object.create(App.prototype) as App;
  Object.assign(app as unknown as Record<string, unknown>, {
    overlayHost: { id: 'overlay-host' },
    scene: null,
    pause: null,
    levelUp: null,
    previewSnapshot: null,
    routeTimer: null,
    resolving: false,
    freshCombatEntry: false,
    animator: { push: vi.fn(), clear: vi.fn(), busy: vi.fn(() => false), finishesAt: 0 },
    residents: { reset: vi.fn() },
    toasts: { show: vi.fn() },
    session: new Session(),
    audio: { play: vi.fn(), close: vi.fn(), unlock: vi.fn() },
    content: CONTENT,
    state: null,
    routeToState: vi.fn(),
    saveTo: vi.fn(() => true),
    ...overrides,
  });
  return app;
}

function freshExplore(): GameState {
  const fresh = createGame(CONTENT, {
    seed: 'app-rewards',
    party: [{ characterId: 'kaya' }],
    startNode: RIVERSIDE_ENTRY,
  });
  return apply(CONTENT, fresh, { type: 'enterNode', nodeId: RIVERSIDE_ENTRY }).state;
}

function atLevel(state: GameState, level: number): GameState {
  return { ...state, party: state.party.map((unit) => ({ ...unit, level })) };
}

function abilityDebt(state: GameState, abilityId: string): GameState {
  const unit = state.party[0];
  if (!unit) throw new Error('test party is empty');
  const choice: PendingChoice = {
    unitId: unit.id,
    level: unit.level,
    kind: 'ability',
    options: [abilityId],
  };
  return { ...state, pendingChoices: [choice] };
}

describe('reward choices on load (F2)', () => {
  beforeEach(() => {
    opened.length = 0;
  });

  it('opens the ability dialog for a loaded save without a dispatch', () => {
    const app = makeApp();
    app.adoptSave(abilityDebt(freshExplore(), 'flame_arc'), undefined);

    expect(opened).toHaveLength(1);
    expect(opened[0]?.kind).toBe('ability');
    expect(opened[0]?.choice.options).toContain('flame_arc');
  });

  it('opens the discipline dialog for debt reconciliation adds to the save', () => {
    const app = makeApp();
    app.adoptSave(atLevel(freshExplore(), 5), undefined);

    expect(opened).toHaveLength(1);
    expect(opened[0]?.kind).toBe('discipline');
    expect(opened[0]?.choice.options).toContain('flame_shaping');
  });

  it('keeps a mid-battle save deferred until the fight resolves', () => {
    const app = makeApp();
    const started = apply(CONTENT, freshExplore(), {
      type: 'startBattle',
      encounterId: 'enc_forest_road',
    }).state;

    app.adoptSave(abilityDebt(started, 'flame_arc'), undefined);

    expect(app.state?.screen).toBe('combat');
    expect(opened).toHaveLength(0);

    // The dispatch that resolves the fight leaves combat and then offers the
    // choice; simulating that state is enough to prove the deferral clears.
    app.state = { ...app.state!, screen: 'explore', battle: null };
    app.offerLevelUpIfPending();
    expect(opened).toHaveLength(1);
  });

  it('drops the replaced state\u2019s dialog without re-offering it', () => {
    const app = makeApp();
    app.state = abilityDebt(freshExplore(), 'flame_arc');
    app.offerLevelUpIfPending();
    expect(opened).toHaveLength(1);
    expect(opened[0]?.choice.options).toContain('flame_arc');

    app.adoptSave(abilityDebt(freshExplore(), 'fire_blast'), undefined);

    // One offer for the loaded save only; a stale close that answered for the
    // replaced state would push a second, wrong entry first.
    expect(opened).toHaveLength(2);
    expect(opened[1]?.choice.options).toContain('fire_blast');
  });
});

describe('reward picks are autosave checkpoints (F3)', () => {
  beforeEach(() => {
    opened.length = 0;
  });

  it('checkpoints a victory and then the ability it earns', () => {
    const app = makeApp();
    const save = abilityDebt(freshExplore(), 'flame_arc');
    app.state = save;
    const saved: GameState[] = [];
    internals(app).saveTo = vi.fn(() => {
      if (app.state) saved.push(app.state);
      return true;
    });

    internals(app).autosaveIfWorthIt({ type: 'resolveBattle' }, [], true);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.pendingChoices).toHaveLength(1);

    app.dispatch({ type: 'chooseLevelUp', unitId: save.party[0]!.id, abilityId: 'flame_arc' });

    expect(saved).toHaveLength(2);
    expect(saved[1]?.pendingChoices).toHaveLength(0);
    expect(saved[1]?.party[0]?.abilities).toContain('flame_arc');
  });

  it('checkpoints each of several chained choices', () => {
    const app = makeApp();
    const base = freshExplore();
    const unit = base.party[0]!;
    app.state = {
      ...base,
      pendingChoices: [
        { unitId: unit.id, level: unit.level, kind: 'ability', options: ['fire_blast'] },
        { unitId: unit.id, level: unit.level, kind: 'ability', options: ['fire_step'] },
      ],
    };
    const saveTo = vi.fn(() => true);
    internals(app).saveTo = saveTo;
    internals(app).offerLevelUpIfPending = vi.fn();

    app.dispatch({ type: 'chooseLevelUp', unitId: unit.id, abilityId: 'fire_blast' });
    app.dispatch({ type: 'chooseLevelUp', unitId: unit.id, abilityId: 'fire_step' });

    expect(saveTo).toHaveBeenCalledTimes(2);
  });

  it('does not checkpoint a refused locked discipline', () => {
    const app = makeApp();
    const base = atLevel(freshExplore(), 5);
    const unit = base.party[0]!;
    app.state = {
      ...base,
      pendingChoices: [
        {
          unitId: unit.id,
          level: 5,
          kind: 'discipline',
          options: ['flame_shaping', 'lightning_path'],
        },
      ],
    };
    const saveTo = vi.fn(() => true);
    internals(app).saveTo = saveTo;
    internals(app).offerLevelUpIfPending = vi.fn();

    app.dispatch({ type: 'chooseDiscipline', unitId: unit.id, disciplineId: 'lightning_path' });

    expect(saveTo).not.toHaveBeenCalled();
    expect(app.state?.pendingChoices).toHaveLength(1);
  });
});

describe('isAutosaveCheckpoint', () => {
  it('treats a consumed reward pick as a checkpoint', () => {
    expect(
      isAutosaveCheckpoint({ type: 'chooseLevelUp', unitId: 'u', abilityId: 'a' }, [], true),
    ).toBe(true);
    expect(
      isAutosaveCheckpoint({ type: 'chooseDiscipline', unitId: 'u', disciplineId: 'd' }, [], true),
    ).toBe(true);
  });

  it('does not checkpoint a refused pick', () => {
    expect(
      isAutosaveCheckpoint(
        { type: 'chooseLevelUp', unitId: 'u', abilityId: 'a' },
        [{ type: 'message', text: 'no' }],
        false,
      ),
    ).toBe(false);
    expect(
      isAutosaveCheckpoint(
        { type: 'chooseDiscipline', unitId: 'u', disciplineId: 'd' },
        [{ type: 'message', text: 'no' }],
        false,
      ),
    ).toBe(false);
  });

  it('keeps the victory, story and explore checkpoints and ignores movement', () => {
    expect(isAutosaveCheckpoint({ type: 'resolveBattle' }, [], false)).toBe(true);
    expect(
      isAutosaveCheckpoint(
        { type: 'move', unitId: 'u', path: [] },
        [{ type: 'storyNodeEntered', nodeId: 'n' }],
        false,
      ),
    ).toBe(true);
    expect(
      isAutosaveCheckpoint(
        { type: 'move', unitId: 'u', path: [] },
        [{ type: 'screenChanged', screen: 'explore' }],
        false,
      ),
    ).toBe(true);
    expect(
      isAutosaveCheckpoint(
        { type: 'move', unitId: 'u', path: [] },
        [{ type: 'screenChanged', screen: 'dialogue' }],
        false,
      ),
    ).toBe(false);
    expect(isAutosaveCheckpoint({ type: 'move', unitId: 'u', path: [] }, [], false)).toBe(false);
  });
});

describe('pause owns combat progression (F5)', () => {
  beforeEach(() => {
    pauseMenus.length = 0;
  });

  function combatScene() {
    return { name: 'combat', suspend: vi.fn(), resume: vi.fn() };
  }

  it('suspends a fight on pause and resumes it once the pause is gone', () => {
    const scene = combatScene();
    const app = makeApp({ scene, state: freshExplore() });

    app.openPause();
    expect(scene.suspend).toHaveBeenCalledOnce();
    expect(scene.resume).not.toHaveBeenCalled();

    // A nested Save or Settings dialog does not close the pause, so reopening
    // is a no-op and the fight stays frozen.
    app.openPause();
    expect(scene.suspend).toHaveBeenCalledOnce();
    expect(scene.resume).not.toHaveBeenCalled();

    pauseMenus.at(-1)?.close();
    expect(scene.resume).toHaveBeenCalledOnce();
  });

  it('leaves an explore scene running', () => {
    const scene = { name: 'explore', suspend: vi.fn(), resume: vi.fn() };
    const app = makeApp({ scene, state: freshExplore() });

    app.openPause();
    expect(scene.suspend).not.toHaveBeenCalled();

    pauseMenus.at(-1)?.close();
    expect(scene.resume).not.toHaveBeenCalled();
  });

  it('closes the pause and force-routes on a load, dropping the frozen scene', () => {
    const scene = combatScene();
    const app = makeApp({ scene, state: freshExplore() });
    app.openPause();
    expect(scene.suspend).toHaveBeenCalledOnce();

    app.adoptSave(abilityDebt(freshExplore(), 'flame_arc'), undefined);

    expect(scene.resume).toHaveBeenCalledOnce();
    expect(internals(app).routeToState).toHaveBeenCalledWith(true);
  });
});
