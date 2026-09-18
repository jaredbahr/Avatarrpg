import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioBus } from './bus';
import { courtyardEnvironment, environmentSamples } from './environment';
import { BA_DAN_VILLAGE } from '../../content/maps/village';
import { buildGrid } from '../../core/rules/grid';

class Context {
  state = 'running';
  currentTime = 10;
  destination = {};
  sources: {
    buffer: null;
    loop: boolean;
    onended: (() => void) | null;
    connect: () => void;
    disconnect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }[] = [];
  gains: {
    gain: {
      value: number;
      setTargetAtTime: ReturnType<typeof vi.fn>;
      setValueAtTime: ReturnType<typeof vi.fn>;
      linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: () => void;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  createGain() {
    const gain = {
      gain: {
        value: 0,
        setTargetAtTime: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect() {},
      disconnect: vi.fn(),
    };
    this.gains.push(gain);
    return gain;
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    const source = {
      buffer: null,
      loop: false,
      onended: null as (() => void) | null,
      connect() {},
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    this.sources.push(source);
    return source;
  }
  close = vi.fn(async () => {
    this.state = 'closed';
  });
}

function setup(volume = { value: 1 }) {
  const contexts: Context[] = [];
  vi.stubGlobal('window', {
    AudioContext: class extends Context {
      constructor() {
        super();
        contexts.push(this);
      }
    },
  });
  return { bus: new AudioBus({ volume: () => volume.value }), contexts, volume };
}
const active = { courtyard: true, pond: 1 };
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('courtyard lifecycle', () => {
  it('never opens a context without a gesture and never builds layers while Off', () => {
    const { bus, contexts, volume } = setup({ value: 0 });
    bus.updateEnvironment(active);
    bus.unlock();
    expect(contexts).toHaveLength(0);
    volume.value = 1;
    bus.unlock();
    bus.updateEnvironment({ courtyard: false, pond: 0 });
    expect(contexts[0]!.sources).toHaveLength(0);
  });
  it('keeps two sources across frames and smooths live volume and pond changes', () => {
    const { bus, contexts, volume } = setup();
    bus.unlock();
    for (let i = 0; i < 100; i++) bus.updateEnvironment(active);
    const ctx = contexts[0]!;
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.gains[1]!.gain.setTargetAtTime).toHaveBeenCalledTimes(1);
    volume.value = 0.5;
    bus.updateEnvironment({ courtyard: true, pond: 0 });
    expect(ctx.gains[1]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.12, 10, 0.22);
    expect(ctx.gains[2]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 10, 0.22);
    volume.value = 0;
    bus.updateEnvironment(active);
    expect(ctx.gains[1]!.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 10, 0.22);
  });
  it('retires scene sources once and disconnects after their release', () => {
    const { bus, contexts } = setup();
    bus.unlock();
    bus.updateEnvironment(active);
    const ctx = contexts[0]!;
    bus.clearEnvironment();
    bus.clearEnvironment();
    for (const source of ctx.sources) {
      expect(source.stop).toHaveBeenCalledOnce();
      expect(source.stop).toHaveBeenCalledWith(10.6);
      source.onended?.();
      expect(source.disconnect).toHaveBeenCalledOnce();
    }
    expect(ctx.gains[1]!.disconnect).toHaveBeenCalledOnce();
    bus.updateEnvironment(active);
    expect(ctx.sources).toHaveLength(4);
  });
  it('Off releases the old master and On starts fresh layers without reviving it', async () => {
    vi.useFakeTimers();
    const { bus, contexts } = setup();
    bus.unlock();
    bus.updateEnvironment(active);
    const old = contexts[0]!;
    bus.close();
    expect(bus.ready).toBe(false);
    expect(old.gains[0]!.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 10.032);
    bus.unlock();
    bus.updateEnvironment(active);
    expect(contexts[1]!.sources).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(40);
    expect(old.close).toHaveBeenCalledOnce();
    expect(contexts[1]!.close).not.toHaveBeenCalled();
  });
});

describe('map and signal contract', () => {
  it('derives proximity from authored water and gates other maps', () => {
    const grid = buildGrid(BA_DAN_VILLAGE);
    const index = grid.tiles.findIndex(
      (tile) => tile.terrain === 'water_deep' || tile.surface?.id === 'water',
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const listener = { x: index % grid.width, y: Math.floor(index / grid.width) };
    expect(courtyardEnvironment(BA_DAN_VILLAGE.id, grid, listener).pond).toBe(1);
    expect(courtyardEnvironment('road', grid, listener).courtyard).toBe(false);
    const dry = {
      ...grid,
      tiles: grid.tiles.map((tile) => ({ ...tile, terrain: 'stone' as const, surface: null })),
    };
    expect(courtyardEnvironment(BA_DAN_VILLAGE.id, dry, listener).pond).toBe(0);
    expect(courtyardEnvironment(BA_DAN_VILLAGE.id, grid, { x: -100, y: -100 }).pond).toBe(0);
  });
  it.each(['air', 'pond'] as const)(
    '%s source is deterministic, bounded and has quiet loop seams',
    (kind) => {
      const samples = environmentSamples(kind);
      expect(samples).toEqual(environmentSamples(kind));
      let peak = 0;
      let squares = 0;
      for (const sample of samples) {
        peak = Math.max(peak, Math.abs(sample));
        squares += sample * sample;
      }
      expect(peak).toBeLessThan(0.5);
      expect(Math.sqrt(squares / samples.length)).toBeGreaterThan(0.001);
      expect(Math.abs(samples[0]!)).toBeLessThan(0.00001);
      expect(Math.abs(samples[samples.length - 1]!)).toBeLessThan(0.00001);
    },
  );
});
