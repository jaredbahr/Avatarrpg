import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveSound } from '../../content/sounds';
import type { VoiceDef } from '../../content/sounds';
import { AudioBus } from './bus';

type Automation = {
  kind: 'set' | 'linear' | 'exponential' | 'target';
  value: number;
  at: number;
  constant?: number;
};

/** Schedule on a native clock; .value deliberately does not pretend to hold a future ramp. */
class Param {
  value = 1;
  events: Automation[] = [];
  cancellations: number[] = [];
  setValueAtTime(value: number, at: number) {
    this.events.push({ kind: 'set', value, at });
  }
  linearRampToValueAtTime(value: number, at: number) {
    this.events.push({ kind: 'linear', value, at });
  }
  exponentialRampToValueAtTime(value: number, at: number) {
    this.events.push({ kind: 'exponential', value, at });
  }
  setTargetAtTime(value: number, at: number, constant: number) {
    this.events.push({ kind: 'target', value, at, constant });
  }
  cancelScheduledValues(at: number) {
    this.cancellations.push(at);
    this.events = this.events.filter((event) => event.at < at);
  }
  at(time: number): number {
    let value = this.value;
    let previousAt = 0;
    let target: Automation | null = null;
    for (const event of this.events) {
      if (time < event.at) {
        if (event.kind === 'linear')
          return value + ((event.value - value) * (time - previousAt)) / (event.at - previousAt);
        if (event.kind === 'exponential')
          return value * (event.value / value) ** ((time - previousAt) / (event.at - previousAt));
        break;
      }
      if (target)
        value =
          target.value +
          (value - target.value) * Math.exp(-(event.at - previousAt) / (target.constant ?? 1));
      if (event.kind !== 'target') value = event.value;
      previousAt = event.at;
      target = event.kind === 'target' ? event : null;
    }
    return target
      ? target.value +
          (value - target.value) * Math.exp(-(time - previousAt) / (target.constant ?? 1))
      : value;
  }
}

class Node {
  outputs: Node[] = [];
  connect(output: Node) {
    this.outputs.push(output);
  }
  disconnect = vi.fn();
}
class Gain extends Node {
  gain = new Param();
}
class Filter extends Node {
  type = '';
  Q = { value: 0 };
  frequency = new Param();
}
class Source extends Node {
  buffer: AudioBuffer | null = null;
  playbackRate = { value: 1 };
  loop = false;
  onended: (() => void) | null = null;
  start = vi.fn<(_at?: number) => void>();
  stop = vi.fn<(_at?: number) => void>();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const sampleBuffer = {} as AudioBuffer;
class Context {
  state = 'running';
  currentTime = 10;
  sampleRate = 48_000;
  destination = new Node();
  gains: Gain[] = [];
  sources: Source[] = [];
  filters: Filter[] = [];
  decodes: ReturnType<typeof deferred<AudioBuffer>>[] = [];
  constructor(private cold: boolean) {}
  createGain() {
    const gain = new Gain();
    this.gains.push(gain);
    return gain;
  }
  createBufferSource() {
    const source = new Source();
    this.sources.push(source);
    return source;
  }
  createBiquadFilter() {
    const filter = new Filter();
    this.filters.push(filter);
    return filter;
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  decodeAudioData() {
    const decode = deferred<AudioBuffer>();
    this.decodes.push(decode);
    if (!this.cold) decode.resolve(sampleBuffer);
    return decode.promise;
  }
  close = vi.fn(async () => {
    this.state = 'closed';
  });
}

function setup(initial = 0.7, cold = false) {
  const volume = { value: initial };
  const contexts: Context[] = [];
  vi.stubGlobal('window', {
    AudioContext: class extends Context {
      constructor() {
        super(cold);
        contexts.push(this);
      }
    },
  });
  const bus = new AudioBus({ volume: () => volume.value });
  return { bus, volume, contexts };
}
async function flush() {
  for (let index = 0; index < 12; index++) await Promise.resolve();
}
function path(source: Source): Node[] {
  const nodes: Node[] = [];
  let node: Node | undefined = source;
  while (node) {
    if (nodes.includes(node)) throw new Error('Cyclic audio graph');
    nodes.push(node);
    expect(node.outputs.length).toBeLessThanOrEqual(1);
    node = node.outputs[0];
  }
  return nodes;
}
function level(source: Source, at: number): number {
  return path(source).reduce(
    (gain, node) => gain * (node instanceof Gain ? node.gain.at(at) : 1),
    1,
  );
}
function lastSource(ctx: Context): Source {
  const source = ctx.sources.at(-1);
  if (!source) throw new Error('No real bus source');
  return source;
}
function sampleGain(): number {
  const def = resolveSound('tap');
  if (def?.kind !== 'sample') throw new Error('Missing real tap sample');
  return def.gain;
}
async function warmSample(bus: AudioBus) {
  bus.unlock();
  bus.play([{ key: 'tap', at: 0, seed: 1 }], 0);
  await flush();
}
function checkVoice(ctx: Context, source: Source, def: VoiceDef, when: number, volume: number) {
  expect(source.start).toHaveBeenCalledWith(when);
  expect(source.stop).toHaveBeenCalledOnce();
  expect(source.stop.mock.calls[0]?.[0]).toBeCloseTo(
    when + (def.attack + def.decay) / 1000 + 0.02,
    10,
  );
  const filter = source.outputs[0];
  expect(filter).toBeInstanceOf(Filter);
  if (!(filter instanceof Filter)) throw new Error('Voice lost its filter');
  expect(filter.type).toBe(def.filter);
  expect(filter.Q.value).toBe(def.q);
  expect(filter.frequency.events).toEqual([
    { kind: 'set', value: def.from, at: when },
    {
      kind: 'exponential',
      value: Math.max(20, def.to),
      at: when + def.attack / 1000 + def.decay / 1000,
    },
  ]);
  expect(level(source, when + def.attack / 1000)).toBeCloseTo(def.gain * volume * 0.6, 10);
  if (def.body > 0)
    expect(level(source, when + (def.attack + def.decay * 0.35) / 1000)).toBeCloseTo(
      def.gain * def.body * volume * 0.6,
      10,
    );
  expect(ctx.sources).toContain(source);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('live volume of already queued one-shots', () => {
  it.each([
    [0.7, 0.35],
    [0.35, 0.7],
  ])('changes a warm future sample from %s to %s without dropping it', async (from, to) => {
    const { bus, volume, contexts } = setup(from);
    await warmSample(bus);
    const ctx = contexts[0];
    if (!ctx) throw new Error('Missing unlocked context');
    bus.play([{ key: 'tap', at: 2000, seed: 1 }], 0);
    const future = lastSource(ctx);
    expect(level(future, 12)).toBeCloseTo(sampleGain() * from * 0.6, 10);
    ctx.currentTime = 10.25;
    volume.value = to;
    bus.unlock();
    expect(level(future, 10.266)).toBeCloseTo(sampleGain() * ((from + to) / 2) * 0.6, 10);
    expect(level(future, 12)).toBeCloseTo(sampleGain() * to * 0.6, 10);
    expect(future.start.mock.calls).toEqual([[12]]);
    expect(future.playbackRate.value).toBe(1);
    expect(contexts).toHaveLength(1);
    expect(ctx.sources).toHaveLength(2);
    expect(bus.scheduled).toBe(2);
    expect(ctx.close).not.toHaveBeenCalled();
  });

  it('changes a queued voice and its crack while preserving recipe clocks and filters', () => {
    const { bus, volume, contexts } = setup();
    const def = resolveSound('fx.ice.volume-test');
    if (def?.kind !== 'voice' || !def.crack) throw new Error('Missing real crack voice');
    bus.unlock();
    bus.play([{ key: 'fx.ice.volume-test', at: 2000, seed: 1 }], 0);
    const ctx = contexts[0];
    if (!ctx) throw new Error('Missing unlocked context');
    const [voice, crack] = ctx.sources;
    if (!voice || !crack) throw new Error('Missing voice/crack sources');
    checkVoice(ctx, voice, def, 12, 0.7);
    expect(level(crack, 12)).toBeCloseTo(def.gain * 0.8 * 0.7 * 0.6, 10);
    ctx.currentTime = 10.25;
    volume.value = 0.35;
    bus.unlock();
    checkVoice(ctx, voice, def, 12, 0.35);
    expect(level(crack, 12)).toBeCloseTo(def.gain * 0.8 * 0.35 * 0.6, 10);
    expect(crack.start.mock.calls).toEqual([[12]]);
    expect(crack.stop.mock.calls).toEqual([[12.05]]);
    expect(ctx.sources).toHaveLength(2);
  });

  it('changes every queued layer and still coalesces the whole cue', () => {
    const { bus, volume, contexts } = setup();
    const def = resolveSound('turn');
    if (def?.kind !== 'layers') throw new Error('Missing real layered turn sting');
    bus.unlock();
    bus.play(
      [
        { key: 'turn', at: 2000, seed: 1 },
        { key: 'turn', at: 2010, seed: 2 },
        { key: 'turn', at: 10_001, seed: 3 },
      ],
      0,
    );
    const ctx = contexts[0];
    if (!ctx) throw new Error('Missing unlocked context');
    expect(ctx.sources).toHaveLength(def.voices.length);
    ctx.currentTime = 10.25;
    volume.value = 0.35;
    bus.unlock();
    def.voices.forEach((voice, index) => {
      const source = ctx.sources[index];
      if (!source) throw new Error('Missing material layer');
      checkVoice(ctx, source, voice, 12, 0.35);
    });
    expect(bus.cuesSeen).toBe(3);
    expect(bus.scheduled).toBe(1);
    expect(contexts).toHaveLength(1);
  });

  it('does not restart an unchanged ramp and holds the instantaneous level on rapid replacement', async () => {
    const { bus, volume, contexts } = setup();
    await warmSample(bus);
    const ctx = contexts[0];
    if (!ctx) throw new Error('Missing unlocked context');
    bus.play([{ key: 'tap', at: 2000, seed: 1 }], 0);
    const future = lastSource(ctx);
    ctx.currentTime = 10.1;
    volume.value = 0.35;
    bus.unlock();
    const events = () => ctx.gains.reduce((count, gain) => count + gain.gain.events.length, 0);
    const unchangedCount = events();
    ctx.currentTime = 10.108;
    bus.unlock();
    expect(events()).toBe(unchangedCount);
    expect(level(future, 10.116)).toBeCloseTo(sampleGain() * 0.525 * 0.6, 10);
    ctx.currentTime = 10.116;
    volume.value = 1;
    bus.unlock();
    expect(level(future, 10.116)).toBeCloseTo(sampleGain() * 0.525 * 0.6, 10);
    expect(level(future, 10.132)).toBeCloseTo(sampleGain() * 0.7625 * 0.6, 10);
    expect(level(future, 10.148)).toBeCloseTo(sampleGain() * 0.6, 10);
    ctx.currentTime = 10.132;
    const replacementCount = events();
    bus.unlock();
    expect(events()).toBe(replacementCount);
    expect(ctx.gains.flatMap((gain) => gain.gain.cancellations)).toContain(10.116);
    expect(future.start.mock.calls).toEqual([[12]]);
  });

  it('also refreshes the queued graph when a subsequent cue reads a changed volume', async () => {
    const { bus, volume, contexts } = setup();
    await warmSample(bus);
    const ctx = contexts[0];
    if (!ctx) throw new Error('Missing unlocked context');
    bus.play([{ key: 'tap', at: 2000, seed: 1 }], 0);
    const oldFuture = lastSource(ctx);
    ctx.currentTime = 10.25;
    volume.value = 0.35;
    bus.play([{ key: 'tap', at: 3000, seed: 1 }], 0);
    expect(level(oldFuture, 12)).toBeCloseTo(sampleGain() * 0.35 * 0.6, 10);
    expect(level(lastSource(ctx), 13.25)).toBeCloseTo(sampleGain() * 0.35 * 0.6, 10);
  });

  it('refreshes a cold decode at its deadline without applying volume twice', async () => {
    const { bus, volume, contexts } = setup(0.7, true);
    bus.unlock();
    bus.play([{ key: 'tap', at: 500, seed: 1 }], 0);
    await flush();
    const ctx = contexts[0];
    if (!ctx) throw new Error('Missing unlocked context');
    ctx.currentTime = 10.1;
    volume.value = 0.35;
    ctx.decodes[0]?.resolve(sampleBuffer);
    await flush();
    const future = lastSource(ctx);
    expect(future.start.mock.calls).toEqual([[10.5]]);
    expect(level(future, 10.5)).toBeCloseTo(sampleGain() * 0.35 * 0.6, 10);
    ctx.currentTime = 10.2;
    volume.value = 0.7;
    bus.unlock();
    expect(level(future, 10.5)).toBeCloseTo(sampleGain() * 0.7 * 0.6, 10);
    expect(ctx.sources).toHaveLength(1);
  });

  it('keeps Off/context retirement and stale decode ownership guards intact', async () => {
    const { bus, volume, contexts } = setup(0, true);
    bus.unlock();
    bus.play([{ key: 'tap', at: 500, seed: 1 }], 0);
    expect(contexts).toHaveLength(0);
    volume.value = 0.7;
    bus.unlock();
    bus.play([{ key: 'tap', at: 500, seed: 1 }], 0);
    await flush();
    const old = contexts[0];
    if (!old) throw new Error('Missing original context');
    volume.value = 0;
    bus.close();
    bus.unlock();
    expect(bus.ready).toBe(false);
    expect(contexts).toHaveLength(1);
    expect(old.gains[0]?.gain.events).toContainEqual({ kind: 'linear', value: 0, at: 10.032 });
    volume.value = 0.35;
    bus.unlock();
    bus.play([{ key: 'tap', at: 500, seed: 1 }], 0);
    await flush();
    const current = contexts[1];
    if (!current) throw new Error('Missing replacement context');
    const freshAutomation = current.gains.flatMap((gain) => [...gain.gain.events]);
    old.decodes[0]?.resolve(sampleBuffer);
    await flush();
    expect(old.sources).toHaveLength(0);
    expect(current.sources).toHaveLength(0);
    expect(current.gains.flatMap((gain) => gain.gain.events)).toEqual(freshAutomation);
    current.decodes[0]?.resolve(sampleBuffer);
    await flush();
    expect(level(lastSource(current), 10.5)).toBeCloseTo(sampleGain() * 0.35 * 0.6, 10);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(40);
    expect(old.close).toHaveBeenCalledOnce();
    expect(current.close).not.toHaveBeenCalled();
  });

  it('retires queued warm sources through the original master fade when switched Off', async () => {
    const { bus, volume, contexts } = setup();
    await warmSample(bus);
    const ctx = contexts[0];
    if (!ctx) throw new Error('Missing unlocked context');
    bus.play([{ key: 'tap', at: 2000, seed: 1 }], 0);
    const future = lastSource(ctx);
    volume.value = 0;
    bus.close();
    expect(level(future, 10.032)).toBe(0);
    bus.unlock();
    bus.play([{ key: 'tap', at: 3000, seed: 1 }], 0);
    expect(ctx.sources).toHaveLength(2);
    expect(contexts).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(40);
    expect(ctx.state).toBe('closed');
    expect(bus.ready).toBe(false);
  });

  it('leaves courtyard loops on their existing independently smoothed volume path', async () => {
    const { bus, volume, contexts } = setup();
    bus.unlock();
    bus.updateEnvironment({ courtyard: true, pond: 1 });
    const ctx = contexts[0];
    if (!ctx) throw new Error('Missing unlocked context');
    const loops = [...ctx.sources];
    expect(loops).toHaveLength(2);
    const master = ctx.gains[0];
    if (!master) throw new Error('Missing fixed master');
    for (const loop of loops) {
      expect(loop.loop).toBe(true);
      expect(path(loop).filter((node) => node instanceof Gain)).toHaveLength(2);
    }
    await warmSample(bus);
    const cue = lastSource(ctx);
    ctx.currentTime = 10.25;
    volume.value = 0.35;
    bus.unlock();
    bus.updateEnvironment({ courtyard: true, pond: 1 });
    expect(level(cue, 12)).toBeCloseTo(sampleGain() * 0.35 * 0.6, 10);
    expect(master.gain.value).toBe(0.6);
    expect(master.gain.events).toEqual([]);
    loops.forEach((loop, index) => {
      const gain = loop.outputs[0];
      if (!(gain instanceof Gain)) throw new Error('Missing environment gain');
      expect(gain.outputs).toEqual([master]);
      expect(gain.gain.events.at(-1)).toEqual({
        kind: 'target',
        value: (index === 0 ? 0.24 : 0.13) * 0.35,
        at: 10.25,
        constant: 0.22,
      });
    });
    expect(ctx.sources).toHaveLength(3);
  });
});
