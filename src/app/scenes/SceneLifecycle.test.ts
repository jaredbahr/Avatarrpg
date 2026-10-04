import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombatScene } from './CombatScene';
import { ExploreScene } from './ExploreScene';
import { App, type Scene } from '../App';

interface LifecycleHarness {
  frame: number;
  suspended: boolean;
  paintingStill: boolean;
  loop: ReturnType<typeof vi.fn>;
  aiTimer: number | null;
  aiScheduled: boolean;
  renderer: null;
  life: null;
  app: {
    state: null;
    audio: { clearEnvironment: ReturnType<typeof vi.fn> };
    residents: { tick: ReturnType<typeof vi.fn> };
  };
  suspend(): void;
  resume(): void;
}

function harness(kind: 'explore' | 'combat'): LifecycleHarness {
  const prototype = kind === 'explore' ? ExploreScene.prototype : CombatScene.prototype;
  const scene = Object.create(prototype) as LifecycleHarness;
  scene.frame = 41;
  scene.suspended = false;
  scene.paintingStill = false;
  scene.aiTimer = null;
  scene.aiScheduled = false;
  scene.renderer = null;
  scene.life = null;
  scene.app = {
    state: null,
    audio: { clearEnvironment: vi.fn() },
    residents: { tick: vi.fn() },
  };
  return scene;
}

afterEach(() => vi.unstubAllGlobals());

describe.each(['explore', 'combat'] as const)('%s retained-scene lifecycle', (kind) => {
  it('requests no frames while suspended and resumes its loop exactly once', () => {
    const request = vi.fn(() => 42);
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const scene = harness(kind);
    let stillPaints = 0;
    scene.loop = vi.fn(() => {
      if (scene.paintingStill) {
        stillPaints += 1;
        return;
      }
      scene.frame = request();
    });

    scene.suspend();
    scene.suspend();
    expect(cancel).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledWith(41);
    expect(request).not.toHaveBeenCalled();
    expect(stillPaints).toBe(1);
    expect(scene.loop).toHaveBeenCalledOnce();

    scene.resume();
    scene.resume();
    expect(scene.loop).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledOnce();
    expect(scene.frame).toBe(42);
  });
});

class FakeElement {
  className = '';
  dataset: Record<string, string> = {};
  inert = false;
  parent: FakeElement | null = null;
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();

  get firstChild(): FakeElement | null {
    return this.children[0] ?? null;
  }

  get firstElementChild(): FakeElement | null {
    return this.firstChild;
  }

  readonly classList = {
    add: (name: string) => {
      if (!this.className.split(' ').includes(name))
        this.className = `${this.className} ${name}`.trim();
    },
    remove: (name: string) => {
      this.className = this.className
        .split(' ')
        .filter((item) => item && item !== name)
        .join(' ');
    },
    contains: (name: string) => this.className.split(' ').includes(name),
  };

  appendChild(child: FakeElement): FakeElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: FakeElement): FakeElement {
    this.children.splice(this.children.indexOf(child), 1);
    child.parent = null;
    return child;
  }

  remove(): void {
    this.parent?.removeChild(this);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
}

function fakeScene(name: string) {
  const stage = new FakeElement();
  stage.className = `stage stage-${name}`;
  const scene = {
    name,
    stage,
    mount: vi.fn((host: FakeElement) => host.appendChild(stage)),
    unmount: vi.fn(),
    sync: vi.fn(),
    suspend: vi.fn(),
    resume: vi.fn(),
  };
  return scene;
}

function appHarness(initial: ReturnType<typeof fakeScene>) {
  vi.stubGlobal('HTMLElement', FakeElement);
  vi.stubGlobal('document', { createElement: () => new FakeElement() });
  const sceneHost = new FakeElement();
  sceneHost.appendChild(initial.stage);
  const app = Object.create(App.prototype) as App;
  Object.assign(app as unknown as Record<string, unknown>, {
    host: new FakeElement(),
    sceneHost,
    scene: initial,
    dialogueBackdrop: null,
    dialogueHost: null,
    routeTimer: null,
    state: null,
    content: { maps: new Map(), story: new Map() },
    curtain: { reveal: vi.fn() },
  });
  return { app, sceneHost };
}

describe('dialogue layer ownership', () => {
  it('replaces dialogue in one layer while retaining one refreshed world scene', () => {
    const world = fakeScene('explore');
    const first = fakeScene('dialogue');
    const second = fakeScene('dialogue');
    const { app, sceneHost } = appHarness(world);

    app.showScene(first as unknown as Scene);
    app.showScene(second as unknown as Scene);

    expect(world.sync).toHaveBeenCalledOnce();
    expect(world.suspend).toHaveBeenCalledOnce();
    expect(world.unmount).not.toHaveBeenCalled();
    expect(first.unmount).toHaveBeenCalledOnce();
    expect(sceneHost.children).toHaveLength(2);
    expect(sceneHost.children[1]?.className).toBe('dialogue-layer');
    expect(sceneHost.children[1]?.children).toEqual([second.stage]);
  });

  it.each(['explore', 'combat'])('removes the layer and resumes %s exactly once', (kind) => {
    const world = fakeScene(kind);
    const dialogue = fakeScene('dialogue');
    const { app, sceneHost } = appHarness(world);

    app.showScene(dialogue as unknown as Scene);
    app.showScene(world as unknown as Scene);

    expect(dialogue.unmount).toHaveBeenCalledOnce();
    expect(world.resume).toHaveBeenCalledOnce();
    expect(world.unmount).not.toHaveBeenCalled();
    expect(sceneHost.children).toEqual([world.stage]);
  });

  it('force-replaces a loaded dialogue without leaving its stale layer', () => {
    const world = fakeScene('explore');
    const stale = fakeScene('dialogue');
    const loaded = fakeScene('dialogue');
    const { app, sceneHost } = appHarness(world);

    app.showScene(stale as unknown as Scene);
    app.showScene(loaded as unknown as Scene, true);

    expect(stale.unmount).toHaveBeenCalledOnce();
    expect(world.unmount).toHaveBeenCalledOnce();
    expect(sceneHost.children).toEqual([loaded.stage]);
    expect(sceneHost.children.some((child) => child.className === 'dialogue-layer')).toBe(false);
  });
});
