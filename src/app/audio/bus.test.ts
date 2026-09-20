import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioBus } from './bus';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

class TestContext {
  static instances: TestContext[] = [];
  state = 'running';
  currentTime = 10;
  destination = {};
  decoded = deferred<AudioBuffer>();
  starts: number[] = [];
  stops: number[] = [];
  sampleRate = 48000;
  constructor() {
    TestContext.instances.push(this);
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
      playbackRate: { value: 1 },
      connect() {},
      start: (at: number) => this.starts.push(at),
      stop: (at: number) => this.stops.push(at),
    };
  }
  decodeAudioData() {
    return this.decoded.promise;
  }
  async close() {
    this.state = 'closed';
  }
}

async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
const buffer = {} as AudioBuffer;
const cue = { key: 'tap', at: 500, seed: 1 };

describe('sample loading across the audio clock and mute', () => {
  beforeEach(() => {
    TestContext.instances = [];
    vi.stubGlobal('window', { AudioContext: TestContext });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps a future cue on its deadline when a cold sample decodes early', async () => {
    const bus = new AudioBus({ volume: () => 1 });
    bus.unlock();
    bus.play([cue], 0);
    const ctx = TestContext.instances[0]!;
    ctx.decoded.resolve(buffer);
    await flush();
    expect(ctx.starts).toEqual([10.5]);
  });

  it('schedules material layers together and coalesces the whole cue', () => {
    const bus = new AudioBus({ volume: () => 1 });
    bus.unlock();
    const material = { ...cue, key: 'fx.fire.jab' };
    bus.play([material, { ...material, at: 510 }], 0);
    const ctx = TestContext.instances[0]!;
    expect(ctx.starts).toEqual([10.5, 10.5]);
    expect(ctx.stops).toHaveLength(2);
    expect(ctx.stops.every((at) => at > 10.5 && at < 11)).toBe(true);
    expect(bus.scheduled).toBe(1);
  });

  it('does not schedule material layers before unlock or while muted', () => {
    let volume = 1;
    const bus = new AudioBus({ volume: () => volume });
    bus.play([{ ...cue, key: 'fx.earth.rock' }], 0);
    expect(TestContext.instances).toHaveLength(0);
    bus.unlock();
    volume = 0;
    bus.play([{ ...cue, key: 'fx.earth.rock' }], 0);
    expect(TestContext.instances[0]!.starts).toEqual([]);
  });

  it('plays an already elapsed cue at the current clock after a slow decode', async () => {
    const bus = new AudioBus({ volume: () => 1 });
    bus.unlock();
    bus.play([cue], 0);
    const ctx = TestContext.instances[0]!;
    ctx.currentTime = 12;
    ctx.decoded.resolve(buffer);
    await flush();
    expect(ctx.starts).toEqual([12]);
  });

  it('does not revive pending sounds after Off then On or erase the new load', async () => {
    const bus = new AudioBus({ volume: () => 1 });
    bus.unlock();
    bus.play([cue], 0);
    const old = TestContext.instances[0]!;
    bus.close();
    bus.unlock();
    bus.play([cue], 0);
    const current = TestContext.instances[1]!;
    old.decoded.resolve(buffer);
    await flush();
    expect(old.starts).toEqual([]);
    expect(current.starts).toEqual([]);
    bus.play([{ ...cue, at: 1000 }], 0);
    expect(fetch).toHaveBeenCalledTimes(2);
    current.decoded.resolve(buffer);
    await flush();
    expect(current.starts).toEqual([10.5, 11]);
  });

  it('stays silent if muted while decoding without closing the context', async () => {
    let volume = 1;
    const bus = new AudioBus({ volume: () => volume });
    bus.unlock();
    bus.play([cue], 0);
    volume = 0;
    const ctx = TestContext.instances[0]!;
    ctx.decoded.resolve(buffer);
    await flush();
    expect(ctx.starts).toEqual([]);
  });
});
