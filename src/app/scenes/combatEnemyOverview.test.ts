import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BattleState, PropInstance, Tile, Unit, Vec2 } from '../../core/types';
import { Camera, TILE } from '../../render/camera';
import { sheets } from '../../render/sheets/store';
import { CombatScene } from './CombatScene';
import type { EnemyFrameActor, EnemyFrameProp } from './combatEnemyFrame';

interface OverviewHarness {
  app: {
    state: { battle: BattleState; rng: number };
    settings: { largeText: 'off' };
    animator: { busy: ReturnType<typeof vi.fn>; renderPos: ReturnType<typeof vi.fn> };
    session: { solo: boolean; labelFor(unit: Unit): string };
    dispatch: ReturnType<typeof vi.fn>;
  };
  renderer: { camera: Camera };
  enemyOverview: {
    returnTilePx: number;
    returnActor: Pick<Unit, 'pos' | 'size'>;
  } | null;
  battleOpening: unknown;
  manualCamera: boolean;
  followSuspended: boolean;
  cameraFollow: { kind: 'idle' };
  mode: { kind: 'idle' } | { kind: 'aim'; abilityId: string };
  pending: Vec2 | null;
  recentreButton: HTMLButtonElement | null;
  actorButton: HTMLButtonElement | null;
  resizeAfterHud: ReturnType<typeof vi.fn>;
  revealPendingMoveAfterViewportChange: ReturnType<typeof vi.fn>;
  resolvePointer: ReturnType<typeof vi.fn>;
  showEnemies(): void;
  recentre(): void;
  focusUnit(id: string): void;
  onTap(x: number, y: number): void;
  pan(dx: number, dy: number): void;
  zoomBy(factor: number, at: Vec2): void;
  refit(): void;
  sync(): void;
  centreOnActiveUnit(unit: Unit | undefined, camera?: Camera): void;
  enemyOverviewCells(battle: BattleState): readonly Vec2[];
  enemyOverviewActors(battle: BattleState, camera: Camera): readonly EnemyFrameActor[];
  enemyOverviewProps(battle: BattleState, camera: Camera): readonly EnemyFrameProp[];
  expireEnemyOverview(battle: BattleState): void;
}

function actor(id: string, pos: Vec2, extra: Partial<Unit> = {}): Unit {
  return {
    id,
    name: id,
    pos,
    faction: 'party',
    hp: 10,
    ap: 4,
    size: 1,
    sprite: 'unit.test',
    ...extra,
  } as Unit;
}

function prop(id: string, pos: Vec2, hp = 6): PropInstance {
  return { id, propId: id, pos, hp } as PropInstance;
}

function forestBattle(): BattleState {
  return {
    phase: 'active',
    encounterId: 'enc_forest_road',
    round: 1,
    turnIndex: 0,
    order: ['hero', 'enemy'],
    units: [actor('hero', { x: 1, y: 3 }), actor('enemy', { x: 17, y: 5 }, { faction: 'enemy' })],
    props: [
      prop('water_barrel', { x: 15, y: 3 }),
      prop('oil_flask', { x: 13, y: 6 }),
      prop('hay_bale', { x: 12, y: 5 }),
      prop('second_barrel', { x: 14, y: 4 }),
    ],
    grid: { width: 20, height: 12, tiles: [] },
  } as unknown as BattleState;
}

function overviewScene(): OverviewHarness {
  vi.spyOn(sheets, 'silhouetteHeadroom').mockReturnValue(0.25);
  vi.stubGlobal('window', { innerWidth: 1280, innerHeight: 800, visualViewport: null });
  vi.stubGlobal('document', {
    getElementById: () => ({ textContent: '' }),
    documentElement: { dataset: {} },
  });
  const camera = new Camera(
    { width: 1280, height: 450, dpr: 1 },
    { width: 20, height: 12 },
    'oblique',
  );
  camera.integerZoom = true;
  camera.fitExplore(64, 12, 'floor');
  camera.centreOn({ x: 1, y: 3 });
  return Object.assign(Object.create(CombatScene.prototype), {
    app: {
      state: { battle: forestBattle(), rng: 12345 },
      settings: { largeText: 'off' },
      animator: { busy: vi.fn(() => false), renderPos: vi.fn(() => undefined) },
      session: { solo: false, labelFor: (unit: Unit) => unit.name },
      dispatch: vi.fn(),
    },
    renderer: { camera },
    enemyOverview: null,
    battleOpening: null,
    manualCamera: false,
    followSuspended: false,
    cameraFollow: { kind: 'idle' },
    mode: { kind: 'idle' },
    pending: null,
    preferredCombatTilePx: null,
    preferredCombatFrameKey: null,
    recentreButton: null,
    actorButton: null,
    lastActiveId: 'hero',
    lastPendingMoveReveal: null,
    handedOffTo: null,
    inspector: null,
    host: null,
    aiTimer: null,
    moreOpen: false,
    resizeAfterHud: vi.fn(),
    revealPendingMoveAfterViewportChange: vi.fn(),
    resolvePointer: vi.fn(),
    renderTopBar: vi.fn(),
    renderTurnStrip: vi.fn(),
    renderHud: vi.fn(),
    setMoreOpen: vi.fn(),
    maybeStartBattleOpening: vi.fn(),
    maybeRunAi: vi.fn(),
  }) as OverviewHarness;
}

function frame(camera: Camera): readonly number[] {
  return [camera.scale, camera.offsetX, camera.offsetY];
}

describe('explicit enemy overview', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows every live enemy footprint and intact prop, including the distant oil flask', () => {
    const scene = overviewScene();
    const battle = scene.app.state.battle;
    const large = actor('large', { x: 17, y: 5 }, { faction: 'enemy', size: 2 });
    const targets = scene.enemyOverviewCells({
      ...battle,
      units: [
        actor('hero', { x: 1, y: 3 }),
        large,
        actor('fallen', { x: 0, y: 0 }, { faction: 'enemy', hp: 0 }),
        actor('ally', { x: 2, y: 2 }, { faction: 'ally' }),
      ],
      props: [...battle.props, prop('broken', { x: 0, y: 1 }, 0)],
    });
    expect(targets).toHaveLength(8);
    for (const cell of [
      { x: 17, y: 5 },
      { x: 18, y: 5 },
      { x: 17, y: 6 },
      { x: 18, y: 6 },
      { x: 13, y: 6 },
    ])
      expect(targets).toContainEqual(cell);
    expect(targets).not.toContainEqual({ x: 0, y: 0 });
    expect(targets).not.toContainEqual({ x: 0, y: 1 });
    expect(targets).not.toContainEqual({ x: 2, y: 2 });
    expect(targets).not.toContainEqual({ x: 1, y: 3 });
  });

  it('supplies live upright art with its existing figure scale, measured headroom and terrain lift', () => {
    const scene = overviewScene();
    const battle = scene.app.state.battle;
    const tiles = Array.from(
      { length: battle.grid.width * battle.grid.height },
      () => ({ elevation: 0, blocked: false }) as Tile,
    );
    tiles[6 * battle.grid.width + 6] = { elevation: 2, blocked: false } as Tile;
    const raised = actor(
      'raised',
      { x: 6, y: 6 },
      {
        faction: 'enemy',
        sprite: 'unit.enemy.thug',
      },
    );
    const visuals = scene.enemyOverviewActors(
      {
        ...battle,
        grid: { ...battle.grid, tiles },
        units: [
          actor('hero', { x: 1, y: 3 }),
          raised,
          actor('fallen', { x: 17, y: 7 }, { faction: 'enemy', hp: 0 }),
        ],
      },
      scene.renderer.camera,
    );
    expect(visuals).toEqual([{ pos: raised.pos, size: 1, scale: 1.25, headroom: 0.25, lift: 0.5 }]);
    expect(sheets.silhouetteHeadroom).toHaveBeenCalledWith('unit.enemy.thug');
  });

  it("supplies every intact prop cache square with the renderer's tile lift", () => {
    const scene = overviewScene();
    const battle = scene.app.state.battle;
    const tiles = Array.from(
      { length: battle.grid.width * battle.grid.height },
      () => ({ elevation: 0, blocked: false }) as Tile,
    );
    tiles[3 * battle.grid.width + 15] = { elevation: 2, blocked: false } as Tile;
    tiles[6 * battle.grid.width + 13] = { elevation: 1, blocked: true } as Tile;
    const visuals = scene.enemyOverviewProps(
      {
        ...battle,
        grid: { ...battle.grid, tiles },
        props: [...battle.props, prop('broken', { x: 0, y: 1 }, 0)],
      },
      scene.renderer.camera,
    );
    expect(visuals).toEqual([
      { pos: { x: 15, y: 3 }, lift: 0.5 },
      { pos: { x: 13, y: 6 }, lift: 0 },
      { pos: { x: 12, y: 5 }, lift: 0 },
      { pos: { x: 14, y: 4 }, lift: 0 },
    ]);
  });

  it('keeps a pending action and consumes the return tap before handoff or target resolution', () => {
    const scene = overviewScene();
    const mode = { kind: 'aim', abilityId: 'fire_jab' } as const;
    const pending = { x: 7, y: 4 };
    scene.mode = mode;
    scene.pending = pending;
    const state = scene.app.state;
    const snapshot = structuredClone(state);

    scene.showEnemies();
    expect(scene.enemyOverview).not.toBeNull();
    expect(scene.manualCamera).toBe(true);
    expect(scene.followSuspended).toBe(true);
    expect(scene.mode).toBe(mode);
    expect(scene.pending).toBe(pending);
    scene.onTap(300, 200);

    expect(scene.enemyOverview).toBeNull();
    expect(scene.mode).toBe(mode);
    expect(scene.pending).toBe(pending);
    expect(scene.resolvePointer).not.toHaveBeenCalled();
    expect(scene.app.dispatch).not.toHaveBeenCalled();
    expect(scene.app.state).toBe(state);
    expect(scene.app.state).toEqual(snapshot);
    expect(scene.manualCamera).toBe(false);
    expect(scene.followSuspended).toBe(false);
  });

  it.each(['recentre', 'actor'] as const)(
    'returns readable actor framing through %s',
    (control) => {
      const scene = overviewScene();
      scene.showEnemies();
      const returnTilePx = scene.enemyOverview?.returnTilePx;
      if (control === 'actor') scene.focusUnit('hero');
      else scene.recentre();
      expect(scene.enemyOverview).toBeNull();
      expect(scene.renderer.camera.scale * TILE).toBe(returnTilePx);
      expect(scene.manualCamera).toBe(false);
      expect(scene.followSuspended).toBe(false);
    },
  );

  it('keeps both return controls available even when the overview fits the whole board', () => {
    const scene = overviewScene();
    scene.recentreButton = { hidden: true } as HTMLButtonElement;
    scene.actorButton = { hidden: true } as HTMLButtonElement;
    vi.spyOn(scene.renderer.camera, 'fitted', 'get').mockReturnValue(true);
    scene.showEnemies();
    expect(scene.recentreButton.hidden).toBe(false);
    expect(scene.actorButton.hidden).toBe(false);
    scene.recentre();
    expect(scene.recentreButton.hidden).toBe(true);
    expect(scene.actorButton.hidden).toBe(true);
  });

  it.each(['pan', 'pinch'] as const)(
    'yields ownership to an explicit %s without restoring the actor',
    (gesture) => {
      const scene = overviewScene();
      scene.showEnemies();
      const recentre = vi.spyOn(scene, 'recentre');
      if (gesture === 'pan') scene.pan(50, 0);
      else scene.zoomBy(0.5, { x: 640, y: 225 });
      const manualFrame = frame(scene.renderer.camera);
      scene.refit();
      expect(scene.enemyOverview).toBeNull();
      expect(scene.manualCamera).toBe(true);
      expect(scene.followSuspended).toBe(true);
      expect(recentre).not.toHaveBeenCalled();
      expect(frame(scene.renderer.camera)).toEqual(manualFrame);
    },
  );

  it('retains the overview through a canvas reflow without revealing or changing the pending tile', () => {
    const scene = overviewScene();
    scene.pending = { x: 1, y: 4 };
    const pending = scene.pending;
    scene.showEnemies();
    const overview = scene.enemyOverview;
    const recentre = vi.spyOn(scene, 'recentre');
    scene.renderer.camera.viewport = { width: 820, height: 600, dpr: 2 };
    scene.refit();
    expect(scene.enemyOverview).toBe(overview);
    expect(scene.pending).toBe(pending);
    expect(scene.renderer.camera.onWholeDevicePixels).toBe(true);
    expect(recentre).not.toHaveBeenCalled();
    expect(scene.revealPendingMoveAfterViewportChange).not.toHaveBeenCalled();
  });

  it('restores the outgoing actor before ordinary sync owns the next camera transition', () => {
    const scene = overviewScene();
    scene.showEnemies();
    const returnTilePx = scene.enemyOverview?.returnTilePx;
    const camera = scene.renderer.camera;
    const centres = vi.spyOn(camera, 'centreOn');
    const recentre = vi.spyOn(scene, 'recentre');
    const nextTransition = vi.spyOn(scene, 'centreOnActiveUnit');
    scene.app.state.battle = { ...scene.app.state.battle, turnIndex: 1 };

    scene.sync();

    expect(recentre).not.toHaveBeenCalled();
    expect(centres.mock.calls).toEqual([
      [{ x: 1, y: 3 }, 1],
      [{ x: 17, y: 5 }, 1],
    ]);
    expect(nextTransition).toHaveBeenCalledOnce();
    expect(nextTransition.mock.invocationCallOrder[0]).toBeGreaterThan(
      centres.mock.invocationCallOrder[0] ?? 0,
    );
    expect(camera.scale * TILE).toBe(returnTilePx);
    expect(scene.enemyOverview).toBeNull();
    expect(scene.manualCamera).toBe(false);
    expect(scene.followSuspended).toBe(false);
    scene.sync();
    expect(scene.enemyOverview).toBeNull();
    expect(nextTransition).toHaveBeenCalledOnce();
  });

  it('clears an expired terminal overview without moving the final playback frame', () => {
    const scene = overviewScene();
    scene.showEnemies();
    const camera = scene.renderer.camera;
    const terminalFrame = frame(camera);
    const centres = vi.spyOn(camera, 'centreOn');
    const fit = vi.spyOn(camera, 'fitExplore');
    scene.app.state.battle = { ...scene.app.state.battle, phase: 'victory', turnIndex: 1 };
    scene.expireEnemyOverview(scene.app.state.battle);
    scene.showEnemies();
    expect(scene.enemyOverview).toBeNull();
    expect(frame(camera)).toEqual(terminalFrame);
    expect(centres).not.toHaveBeenCalled();
    expect(fit).not.toHaveBeenCalled();
    expect(scene.app.dispatch).not.toHaveBeenCalled();
  });

  it.each(['busy', 'opening', 'terminal', 'empty'] as const)(
    'ignores a %s activation without taking camera ownership',
    (reason) => {
      const scene = overviewScene();
      if (reason === 'busy') scene.app.animator.busy.mockReturnValue(true);
      if (reason === 'opening') scene.battleOpening = { kind: 'hold' };
      if (reason === 'terminal')
        scene.app.state.battle = { ...scene.app.state.battle, phase: 'defeat' };
      if (reason === 'empty')
        scene.app.state.battle = {
          ...scene.app.state.battle,
          units: [actor('hero', { x: 1, y: 3 })],
          props: [],
        };
      const before = frame(scene.renderer.camera);
      const recentre = vi.spyOn(scene, 'recentre');
      scene.showEnemies();
      expect(scene.enemyOverview).toBeNull();
      expect(frame(scene.renderer.camera)).toEqual(before);
      expect(scene.manualCamera).toBe(false);
      expect(scene.followSuspended).toBe(false);
      expect(recentre).not.toHaveBeenCalled();
      expect(scene.resizeAfterHud).not.toHaveBeenCalled();
    },
  );
});
