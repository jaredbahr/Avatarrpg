import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../content';
import { RIVERSIDE_ENTRY } from '../content/maps/riverside';
import { createGame } from '../core/state/createGame';
import { apply } from '../core/state/reducer';
import { App } from './App';
import { AudioBus } from './audio/bus';
import { Session } from './session';
import { PauseMenu } from './ui/PauseMenu';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Native audio stand-in; scheduling and cancellation remain the real bus's. */
class AudioContextStub {
  static instances: AudioContextStub[] = [];
  state = 'running';
  currentTime = 10;
  destination = {};
  sampleRate = 48_000;
  starts: number[] = [];
  decodes: ReturnType<typeof deferred<AudioBuffer>>[] = [];

  constructor() {
    AudioContextStub.instances.push(this);
  }

  createGain() {
    return {
      gain: {
        value: 0,
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
    };
  }

  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }

  createBiquadFilter() {
    return {
      Q: { value: 0 },
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      loop: false,
      playbackRate: { value: 1 },
      connect() {},
      start: (at: number) => this.starts.push(at),
      stop() {},
    };
  }

  decodeAudioData() {
    const decoded = deferred<AudioBuffer>();
    this.decodes.push(decoded);
    return decoded.promise;
  }

  async close() {
    this.state = 'closed';
  }
}

async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

function freshExplore() {
  const state = createGame(CONTENT, {
    seed: 'audio-state-reset',
    party: [{ characterId: 'kaya' }],
    startNode: RIVERSIDE_ENTRY,
  });
  return apply(CONTENT, state, { type: 'enterNode', nodeId: RIVERSIDE_ENTRY }).state;
}

function makeApp(volume: number) {
  const app = Object.create(App.prototype) as App;
  const audio = new AudioBus({ volume: () => volume });
  Object.assign(app as unknown as Record<string, unknown>, {
    content: CONTENT,
    state: freshExplore(),
    session: new Session([{ name: 'Kaya', unitId: 'p0' }]),
    storyEntry: RIVERSIDE_ENTRY,
    previewSnapshot: null,
    routeTimer: null,
    animator: { clear: vi.fn() },
    residents: { reset: vi.fn() },
    audio,
    dispatch: vi.fn(),
    showScene: vi.fn(),
    routeToState: vi.fn(),
    closePause: vi.fn(),
    dismissRewardDialog: vi.fn(),
    offerLevelUpIfPending: vi.fn(),
    toasts: { show: vi.fn(), clear: vi.fn() },
  });
  return { app, audio };
}

const resets = [
  {
    name: 'load a save',
    reset: (app: App) => app.adoptSave(freshExplore(), undefined),
  },
  {
    name: 'start a new game',
    reset: (app: App) =>
      app.newGame([{ name: 'Kaya', unitId: 'p0' }], [{ characterId: 'kaya' }], 'new-audio-state'),
  },
  {
    name: 'enter the village preview',
    reset: (app: App) => app.startVillagePreview(),
  },
  {
    name: 'leave the village preview',
    reset: (app: App) => {
      Object.assign(app as unknown as Record<string, unknown>, {
        previewSnapshot: { state: freshExplore(), session: app.session.toMeta() },
      });
      app.endVillagePreview();
    },
  },
] as const;

describe('audio at whole-state animation resets', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    AudioContextStub.instances = [];
    vi.stubGlobal('window', { AudioContext: AudioContextStub });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(resets)(
    '$name retires future cues and cold decodes while fresh audio still works',
    async ({ reset }) => {
      const { app, audio } = makeApp(0.7);
      audio.unlock();
      const old = AudioContextStub.instances[0]!;
      const buffer = {} as AudioBuffer;
      // Warm the step sample, then schedule a future step on the old state's clock.
      audio.play([{ key: 'step', at: 0, seed: 1 }], 0);
      await flush();
      old.decodes[0]!.resolve(buffer);
      await flush();
      audio.play([{ key: 'step', at: 2000, seed: 1 }], 0);
      expect(old.starts).toEqual([10, 12]);
      // A different sample is still decoding when the state is replaced.
      audio.play([{ key: 'tap', at: 2500, seed: 1 }], 0);
      await flush();
      expect(old.decodes).toHaveLength(2);

      reset(app);

      expect(app.animator.clear).toHaveBeenCalledOnce();
      expect(AudioContextStub.instances).toHaveLength(2);
      const current = AudioContextStub.instances[1]!;
      expect(audio.ready).toBe(true);
      await vi.advanceTimersByTimeAsync(40);
      expect(old.state, 'the discarded context must close before its future step').toBe('closed');
      old.decodes[1]!.resolve(buffer);
      await flush();
      expect(old.starts, 'an old decode cannot add a source after replacement').toEqual([10, 12]);

      // The same key must neither coalesce against the old future cue nor inherit its pending load.
      audio.play([{ key: 'tap', at: 500, seed: 1 }], 0);
      await flush();
      expect(current.decodes).toHaveLength(1);
      current.decodes[0]!.resolve(buffer);
      await flush();
      expect(current.starts).toEqual([10.5]);
      audio.play([{ key: 'tap', at: 1000, seed: 1 }], 0);
      expect(current.starts).toEqual([10.5, 11]);
    },
  );

  it.each(resets)('$name keeps Sound Off from opening a context', ({ reset }) => {
    const { app, audio } = makeApp(0);
    reset(app);
    audio.play([{ key: 'tap', at: 0, seed: 1 }], 0);
    expect(app.animator.clear).toHaveBeenCalledOnce();
    expect(AudioContextStub.instances).toHaveLength(0);
    expect(audio.ready).toBe(false);
  });
});

describe('quitting to title retires the departing game audio', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    AudioContextStub.instances = [];
    vi.stubGlobal('window', { AudioContext: AudioContextStub });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('closes the old context and queued cues before title, then waits for the next gesture', async () => {
    const { app, audio } = makeApp(0.7);
    audio.unlock();
    const old = AudioContextStub.instances[0]!;
    const buffer = {} as AudioBuffer;
    audio.play([{ key: 'step', at: 0, seed: 1 }], 0);
    await flush();
    old.decodes[0]!.resolve(buffer);
    await flush();
    audio.play([{ key: 'step', at: 2000, seed: 1 }], 0);
    audio.play([{ key: 'tap', at: 2500, seed: 1 }], 0);
    await flush();
    expect(old.starts).toEqual([10, 12]);
    expect(old.decodes).toHaveLength(2);

    const events: string[] = [];
    const menu = new PauseMenu(app, vi.fn());
    vi.spyOn(menu, 'close').mockImplementation(() => events.push('close'));
    vi.mocked(app.animator.clear).mockImplementation(() => events.push('clear'));
    const closeAudio = audio.close.bind(audio);
    vi.spyOn(audio, 'close').mockImplementation(() => {
      events.push('audio');
      closeAudio();
    });
    vi.spyOn(app, 'start').mockImplementation(() => {
      events.push('title');
      expect(app.state).toBeNull();
      expect(audio.ready).toBe(false);
      expect(AudioContextStub.instances).toHaveLength(1);
    });

    (menu as unknown as { quit(): void }).quit();

    expect(events).toEqual(['close', 'clear', 'audio', 'title']);
    await vi.advanceTimersByTimeAsync(40);
    expect(old.state).toBe('closed');
    old.decodes[1]!.resolve(buffer);
    await flush();
    expect(old.starts).toEqual([10, 12]);
    audio.play([{ key: 'tap', at: 0, seed: 1 }], 0);
    expect(AudioContextStub.instances).toHaveLength(1);

    audio.unlock();
    expect(AudioContextStub.instances).toHaveLength(2);
    const current = AudioContextStub.instances[1]!;
    audio.play([{ key: 'tap', at: 500, seed: 1 }], 0);
    await flush();
    expect(current.decodes).toHaveLength(1);
    current.decodes[0]!.resolve(buffer);
    await flush();
    expect(current.starts).toEqual([10.5]);
  });

  it('keeps Sound Off from creating a context on quit or return to play', () => {
    const { app, audio } = makeApp(0);
    const menu = new PauseMenu(app, vi.fn());
    vi.spyOn(menu, 'close').mockImplementation(() => undefined);
    vi.spyOn(app, 'start').mockImplementation(() => undefined);

    (menu as unknown as { quit(): void }).quit();
    audio.unlock();
    audio.play([{ key: 'tap', at: 0, seed: 1 }], 0);

    expect(app.animator.clear).toHaveBeenCalledOnce();
    expect(app.state).toBeNull();
    expect(AudioContextStub.instances).toHaveLength(0);
    expect(audio.ready).toBe(false);
  });
});
