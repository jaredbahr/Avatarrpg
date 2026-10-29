import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../../content';
import type { BattleState, Unit } from '../../core/types';
import { CombatScene } from './CombatScene';

class FakeElement {
  className = '';
  dataset: Record<string, string> = {};
  attrs = new Map<string, string>();
  parentElement: FakeElement | null = null;
  width = 0;
  height = 0;
  style = { setProperty: vi.fn(), removeProperty: vi.fn(), width: '', height: '' };
  private ownText = '';
  readonly children: FakeElement[] = [];
  readonly classList = {
    add: (name: string) => {
      if (!this.className.split(' ').includes(name))
        this.className = `${this.className} ${name}`.trim();
    },
  };

  get firstChild(): FakeElement | null {
    return this.children[0] ?? null;
  }

  get isConnected(): boolean {
    return true;
  }

  get textContent(): string {
    return `${this.ownText}${this.children.map((child) => child.textContent).join('')}`;
  }

  set textContent(text: string) {
    this.ownText = text;
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: FakeElement): FakeElement {
    this.children.splice(this.children.indexOf(child), 1);
    child.parentElement = null;
    return child;
  }

  remove(): void {
    this.parentElement?.removeChild(this);
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  getContext(): null {
    return null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const className = selector.startsWith('.') ? selector.slice(1) : '';
    return this.children.flatMap((child) => [
      ...(child.className.split(' ').includes(className) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
}

function actor(faction: Unit['faction'], name: string): Unit {
  return {
    id: name,
    name,
    faction,
    element: 'fire',
    characterId: null,
    enemyId: null,
    disciplineId: null,
    level: 1,
    xp: 0,
    pos: { x: 0, y: 0 },
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
    sprite: 'unit.bandit',
  };
}

afterEach(() => vi.unstubAllGlobals());

it('announces one matching actor message per active turn change', () => {
  vi.useFakeTimers();
  vi.stubGlobal('window', {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  });
  const messages: string[] = [];
  const liveRegion = {
    set textContent(message: string) {
      messages.push(message);
    },
  };
  vi.stubGlobal('document', {
    createElement: () => new FakeElement(),
    documentElement: { dataset: {}, style: { removeProperty: vi.fn() } },
    getElementById: () => liveRegion,
    body: { appendChild: vi.fn() },
  });
  const enemy = actor('enemy', 'Bandit');
  const ally = actor('ally', 'Riko');
  const battleModel = {
    phase: 'active',
    units: [enemy, ally],
    order: [enemy.id, ally.id],
    turnIndex: 0,
  };
  const battle = battleModel as unknown as BattleState;
  const scene = Object.create(CombatScene.prototype) as unknown as {
    app: {
      state: { battle: BattleState };
      session: { labelFor: (unit: Unit) => string; solo: boolean };
      animator: { renderPos: () => undefined };
      toasts: { dismiss: (handle: symbol) => void };
    };
    lastActiveId: string | null;
    battleOpening: null;
    inspector: null;
    renderer: null;
    cameraFollow: { kind: string };
    followSuspended: boolean;
    confirmedEndTurn: boolean;
    endTurnConfirmation: symbol | null;
    endTurnConfirmationTimer: number | null;
    setMoreOpen: ReturnType<typeof vi.fn>;
    centreOnActiveUnit: ReturnType<typeof vi.fn>;
    renderTopBar: ReturnType<typeof vi.fn>;
    renderTurnStrip: ReturnType<typeof vi.fn>;
    renderHud: ReturnType<typeof vi.fn>;
    resizeAfterHud: ReturnType<typeof vi.fn>;
    maybeStartBattleOpening: ReturnType<typeof vi.fn>;
    maybeRunAi: ReturnType<typeof vi.fn>;
    sync(): void;
  };
  scene.app = {
    state: { battle },
    session: { labelFor: (unit) => unit.name, solo: true },
    animator: { renderPos: () => undefined },
    toasts: { dismiss: vi.fn() },
  };
  const handle = Symbol('ap confirmation');
  scene.lastActiveId = 'previous actor';
  scene.confirmedEndTurn = true;
  scene.endTurnConfirmation = handle;
  scene.endTurnConfirmationTimer = window.setTimeout(() => {}, 4000);
  scene.battleOpening = null;
  scene.inspector = null;
  scene.renderer = null;
  scene.cameraFollow = { kind: 'idle' };
  scene.followSuspended = false;
  scene.setMoreOpen = vi.fn();
  scene.centreOnActiveUnit = vi.fn();
  scene.renderTopBar = vi.fn();
  scene.renderTurnStrip = vi.fn();
  scene.renderHud = vi.fn();
  scene.resizeAfterHud = vi.fn();
  scene.maybeStartBattleOpening = vi.fn();
  scene.maybeRunAi = vi.fn();

  scene.sync();
  scene.sync();
  expect(messages).toEqual(['Bandit is acting']);
  expect(scene.app.toasts.dismiss).toHaveBeenCalledWith(handle);
  expect(vi.getTimerCount()).toBe(0);
  battleModel.turnIndex = 1;
  scene.sync();
  scene.sync();
  expect(messages).toEqual(['Bandit is acting', 'Ally turn · Riko is acting']);
});

describe('non-party combat acting card', () => {
  it.each([
    ['enemy', 'Bandit', 'Bandit is acting'],
    ['ally', 'Riko', 'Ally turn · Riko is acting'],
  ] as const)('shows %s as %s without player controls', (faction, name, label) => {
    const hud = new FakeElement();
    const overlays = new FakeElement();
    const host = {
      querySelector: (selector: string) => (selector === '.hud' ? hud : overlays),
    };
    vi.stubGlobal('document', {
      createElement: () => new FakeElement(),
      documentElement: { dataset: {}, style: { removeProperty: vi.fn() } },
      querySelector: () => null,
    });
    vi.stubGlobal('HTMLInputElement', class extends FakeElement {});
    vi.stubGlobal('HTMLButtonElement', class extends FakeElement {});
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    vi.stubGlobal('getComputedStyle', () => ({ fontSize: '16px' }));

    const unit = actor(faction, name);
    const battle = {
      phase: 'active',
      units: [unit],
      order: [unit.id],
      turnIndex: 0,
    } as unknown as BattleState;
    const scene = Object.create(CombatScene.prototype) as unknown as {
      app: { state: { battle: BattleState }; content: typeof CONTENT };
      host: HTMLElement;
      battleOpening: null;
      mode: { kind: string };
      pending: null;
      needsHandoff(): boolean;
      renderHud(): void;
    };
    scene.app = { state: { battle }, content: CONTENT };
    scene.host = host as unknown as HTMLElement;
    scene.battleOpening = null;
    scene.mode = { kind: 'idle' };
    scene.pending = null;
    scene.needsHandoff = () => false;

    scene.renderHud();

    expect(hud.textContent).toContain(label);
    expect(hud.textContent).not.toContain('Move');
    expect(hud.textContent).not.toContain('choose an action');
    expect(hud.querySelectorAll('.action-button')).toHaveLength(0);
    expect(hud.querySelectorAll('.enemy-turn-card')).toHaveLength(1);
    expect(hud.querySelectorAll('.enemy-turn-portrait')).toHaveLength(1);
    expect(hud.querySelectorAll('.enemy-turn-card')[0]?.getAttribute('aria-hidden')).toBe('true');
    expect(overlays.children).toHaveLength(0);
  });
});
