import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombatScene } from './CombatScene';
import { ExploreScene } from './ExploreScene';

interface LifecycleHarness {
  frame: number;
  suspended: boolean;
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

    scene.suspend();
    scene.suspend();
    expect(cancel).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledWith(41);
    expect(request).not.toHaveBeenCalled();

    scene.resume();
    scene.resume();
    expect(request).toHaveBeenCalledOnce();
    expect(scene.frame).toBe(42);
  });
});
