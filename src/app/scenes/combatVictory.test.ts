import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleState, Unit } from '../../core/types';
import { CombatScene, COMBAT_VICTORY_BEAT_MS } from './CombatScene';

class Element {
  className = '';
  textContent = '';
  dataset: Record<string, string> = {};
  children: Element[] = [];
  listeners = new Map<string, (event: { stopPropagation(): void }) => void>();
  get firstChild(): Element | null {
    return this.children[0] ?? null;
  }
  appendChild(child: Element): Element {
    this.children.push(child);
    return child;
  }
  removeChild(child: Element): void {
    this.children.splice(this.children.indexOf(child), 1);
  }
  setAttribute(): void {}
  addEventListener(name: string, listener: (event: { stopPropagation(): void }) => void): void {
    this.listeners.set(name, listener);
  }
  querySelector(selector: string): Element | null {
    for (const child of this.children) {
      if (child.className.split(' ').includes(selector.slice(1))) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
}

type Presentation =
  | { kind: 'waiting' }
  | { kind: 'holding'; startedAt: number; durationMs: number }
  | { kind: 'shown'; partyFrame: boolean }
  | null;

interface VictoryScene {
  host: Element | null;
  renderer: { camera: { clamp: ReturnType<typeof vi.fn> } } | null;
  canvas: null;
  frame: number;
  aiTimer: null;
  lastActiveId: null;
  battleOpening: null;
  suspended: boolean;
  resultPresentation: Presentation;
  app: {
    animator: { busy: ReturnType<typeof vi.fn>; finishesAt: number };
    curtainBusy: boolean;
    resolveBattle: ReturnType<typeof vi.fn>;
  };
  battle(): BattleState;
  active(): Unit | undefined;
  frameStandingParty: ReturnType<typeof vi.fn>;
  centreOnActiveUnit: ReturnType<typeof vi.fn>;
  recentre: ReturnType<typeof vi.fn>;
  resolvePointer: ReturnType<typeof vi.fn>;
  resultPanel(): Element;
  sync(): void;
  renderHud(): void;
  updateResultPresentation(now: number): void;
  onTap(x: number, y: number): void;
  refit(): void;
  unmount(): void;
  mount(host: Element): void;
  suspend(): void;
  resume(): void;
}

function harness(phase: BattleState['phase'] = 'victory') {
  const battle = { phase, props: [] } as unknown as BattleState;
  const host = new Element();
  const root = host.appendChild(new Element());
  root.className = 'combat-scene';
  const hud = root.appendChild(new Element());
  hud.className = 'hud';
  const overlays = root.appendChild(new Element());
  overlays.className = 'combat-overlays';
  const panel = new Element();
  panel.className = 'result-panel';
  const scene = Object.create(CombatScene.prototype) as VictoryScene;
  Object.assign(scene, {
    host,
    renderer: null,
    canvas: null,
    frame: 0,
    aiTimer: null,
    lastActiveId: null,
    battleOpening: null,
    resultPresentation: null,
    app: {
      animator: { busy: vi.fn(() => true), finishesAt: 500 },
      curtainBusy: false,
      resolveBattle: vi.fn(),
    },
    battle: () => battle,
    active: () => undefined,
    frameStandingParty: vi.fn(),
    centreOnActiveUnit: vi.fn(),
    recentre: vi.fn(),
    syncRecentre: vi.fn(),
    resolvePointer: vi.fn(),
    resultPanel: () => panel,
    renderTopBar: vi.fn(),
    renderTurnStrip: vi.fn(),
    resizeAfterHud: vi.fn(),
    maybeStartBattleOpening: vi.fn(),
    maybeRunAi: vi.fn(),
    setupRenderer: vi.fn(),
    loop: vi.fn(),
  });
  return { scene, battle, host, root, overlays, panel };
}

describe('combat victory presentation', () => {
  beforeEach(() => {
    vi.stubGlobal('HTMLInputElement', class {});
    vi.stubGlobal('HTMLButtonElement', Element);
    vi.stubGlobal('document', {
      createElement: () => new Element(),
      documentElement: { dataset: {} },
    });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '1000ms' }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the panel absent through final playback, then holds a full visible beat', () => {
    const { scene, overlays, panel, root } = harness();
    scene.sync();
    scene.updateResultPresentation(300);
    expect(overlays.children).toEqual([]);
    expect(scene.frameStandingParty).not.toHaveBeenCalled();
    scene.app.animator.busy.mockReturnValue(false);
    scene.updateResultPresentation(400);
    expect(overlays.children).toEqual([]);
    scene.app.curtainBusy = true;
    scene.updateResultPresentation(10_000);
    expect(overlays.children).toEqual([]);
    scene.app.curtainBusy = false;
    scene.updateResultPresentation(10_000);
    expect(scene.resultPresentation).toEqual({
      kind: 'holding',
      startedAt: 10_000,
      durationMs: COMBAT_VICTORY_BEAT_MS,
    });
    expect(root.dataset.victoryBeat).toBe('active');
    expect(overlays.children[0]?.className).toBe('victory-beat-skip');
    expect(scene.frameStandingParty).toHaveBeenCalledOnce();
    scene.sync();
    scene.updateResultPresentation(10_000 + COMBAT_VICTORY_BEAT_MS - 1);
    expect(overlays.children).not.toContain(panel);
    scene.updateResultPresentation(10_000 + COMBAT_VICTORY_BEAT_MS);
    expect(overlays.children).toEqual([panel]);
    expect(root.dataset.victoryBeat).toBeUndefined();
    scene.sync();
    expect(overlays.children).toEqual([panel]);
    expect(scene.frameStandingParty).toHaveBeenCalledOnce();
  });

  it('consumes the explicit skip activation without resolving the battle', () => {
    const { scene, overlays, panel } = harness();
    scene.app.animator.busy.mockReturnValue(false);
    scene.sync();
    scene.updateResultPresentation(500);
    const stopPropagation = vi.fn();
    overlays.children[0]?.listeners.get('click')?.({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(overlays.children).toEqual([panel]);
    expect(scene.app.resolveBattle).not.toHaveBeenCalled();
  });

  it('uses the CSS duration token sampled when the hold starts', () => {
    const { scene, overlays, panel } = harness();
    const token = vi.fn(() => '1.2s');
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: token }));
    scene.app.animator.busy.mockReturnValue(false);
    scene.sync();
    scene.updateResultPresentation(500);
    token.mockReturnValue('0ms');
    scene.updateResultPresentation(1699);
    expect(overlays.children).not.toContain(panel);
    scene.updateResultPresentation(1700);
    expect(overlays.children).toEqual([panel]);
    expect(token).toHaveBeenCalledOnce();
    expect(token).toHaveBeenCalledWith('--dur-combat-victory');
  });

  it('ignores board taps through final playback and never treats them as a skip', () => {
    const { scene, overlays } = harness();
    scene.renderer = { camera: { clamp: vi.fn() } };
    scene.sync();
    scene.onTap(100, 100);
    expect(scene.resultPresentation).toEqual({ kind: 'waiting' });
    scene.app.animator.busy.mockReturnValue(false);
    scene.onTap(100, 100);
    expect(scene.resultPresentation).toEqual({ kind: 'waiting' });
    expect(scene.resolvePointer).not.toHaveBeenCalled();
    expect(overlays.children).toEqual([]);
  });

  it('leaves the final choreography frame alone when the terminal update changes actor', () => {
    const { scene } = harness();
    Object.assign(scene, { active: () => ({ id: 'last-actor', faction: 'party' }) });
    scene.sync();
    expect(scene.centreOnActiveUnit).not.toHaveBeenCalled();
    expect(scene.frameStandingParty).not.toHaveBeenCalled();
  });

  it('waits for playback under reduced motion, without framing or a hold', () => {
    const { scene, overlays, panel } = harness();
    document.documentElement.dataset.reduceMotion = 'on';
    scene.sync();
    scene.updateResultPresentation(500);
    expect(overlays.children).toEqual([]);
    scene.app.animator.busy.mockReturnValue(false);
    scene.updateResultPresentation(500);
    expect(overlays.children).toEqual([panel]);
    expect(scene.frameStandingParty).not.toHaveBeenCalled();
  });

  it('finishes an existing hold when reduced motion is enabled', () => {
    const { scene, overlays, panel } = harness();
    scene.app.animator.busy.mockReturnValue(false);
    scene.sync();
    scene.updateResultPresentation(500);
    document.documentElement.dataset.reduceMotion = 'on';
    scene.updateResultPresentation(501);
    expect(overlays.children).toEqual([panel]);
    expect(scene.frameStandingParty).toHaveBeenCalledOnce();
  });

  it('keeps the final reduced-motion frame through a result viewport refit', () => {
    const { scene } = harness();
    const clamp = vi.fn();
    scene.renderer = { camera: { clamp } };
    document.documentElement.dataset.reduceMotion = 'on';
    scene.app.animator.busy.mockReturnValue(false);
    scene.sync();
    scene.updateResultPresentation(500);
    scene.refit();
    expect(clamp).toHaveBeenCalledOnce();
    expect(scene.recentre).not.toHaveBeenCalled();
    expect(scene.frameStandingParty).not.toHaveBeenCalled();
  });

  it('shows defeat immediately and does not frame it', () => {
    const { scene, overlays, panel } = harness('defeat');
    scene.sync();
    scene.updateResultPresentation(1000);
    expect(overlays.children).toEqual([panel]);
    expect(scene.frameStandingParty).not.toHaveBeenCalled();
  });

  it('shows a mounted terminal save without replaying a victory hold', () => {
    const { scene } = harness();
    const loadedHost = new Element();
    scene.mount(loadedHost);
    expect(scene.resultPresentation).toEqual({ kind: 'shown', partyFrame: false });
    expect(loadedHost.querySelector('.result-panel')).not.toBeNull();
    expect(scene.frameStandingParty).not.toHaveBeenCalled();
  });

  it('clears a hold on unmount and leaves no callback to affect a replacement scene', () => {
    const { scene, root, overlays } = harness();
    scene.app.animator.busy.mockReturnValue(false);
    scene.sync();
    scene.updateResultPresentation(500);
    const skip = overlays.children[0]?.listeners.get('click');
    scene.unmount();
    expect(scene.resultPresentation).toBeNull();
    expect(root.dataset.victoryBeat).toBeUndefined();
    scene.updateResultPresentation(5000);
    skip?.({ stopPropagation: vi.fn() });
    expect(scene.resultPresentation).toBeNull();
    expect(scene.frameStandingParty).toHaveBeenCalledOnce();
  });

  it('settles a retained hold once when the scene resumes', () => {
    const { scene, root, overlays, panel } = harness();
    scene.app.animator.busy.mockReturnValue(false);
    scene.sync();
    scene.updateResultPresentation(500);
    scene.suspend();
    expect(scene.suspended).toBe(true);
    scene.resume();
    expect(scene.suspended).toBe(false);
    expect(root.dataset.victoryBeat).toBeUndefined();
    expect(overlays.children).toEqual([panel]);
    scene.resume();
    scene.sync();
    expect(overlays.children).toEqual([panel]);
    expect(scene.frameStandingParty).toHaveBeenCalledOnce();
  });
});
