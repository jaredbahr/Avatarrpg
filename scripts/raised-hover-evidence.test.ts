import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { initializeRaisedHoverObserver, RaisedHoverEvidence } from '../e2e/raised-hover-evidence';

type Sample = Parameters<RaisedHoverEvidence['receive']>[0];
type Ack = ReturnType<RaisedHoverEvidence['receive']>;
const expected = { hover: { x: 5, y: 1 }, drawn: { x: 5, y: 1 } };

function sample(overrides: Partial<Sample> = {}): Sample {
  return {
    sequence: 1,
    generation: 1,
    acknowledgedAfterDraw: 1,
    draw: 2,
    input: {
      sequence: 1,
      afterDraw: 0,
      clientX: 640,
      clientY: 286.5,
      trusted: true,
      targetMatches: true,
      pointerType: 'mouse',
      unixMs: 0,
    },
    identity: true,
    actual: structuredClone(expected),
    error: null,
    ...overrides,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('raised hover Node evidence gate (no browser acceptance)', () => {
  it('rejects pre-input, queued pre-poll, obsolete and non-successor samples', () => {
    const gate = new RaisedHoverEvidence(
      () => 0,
      () => 0,
    );
    gate.intendPointer(640, 286.5);
    gate.receive(sample({ generation: 0 }));
    expect(gate.readForPoll()).toBeNull();
    gate.receive(sample({ sequence: 2, draw: 3, generation: 0 }));
    expect(gate.readForPoll()).toBeNull();
    gate.receive(sample({ sequence: 3, draw: 4, input: null }));
    expect(gate.readForPoll()).toBeNull();
    gate.receive(sample({ sequence: 4, draw: 5, acknowledgedAfterDraw: 5 }));
    expect(gate.readForPoll()).toBeNull();
    gate.receive(sample({ sequence: 5, draw: 6 }));
    expect(gate.readForPoll()).toEqual(expected);
  });

  it.each([
    'coords',
    'pre-command',
    'untrusted',
    'touch',
    'target',
    'identity',
    'source',
    'error',
    'order',
  ])('invalidates previous matching evidence on bad %s; does not latch success', (kind) => {
    const gate = new RaisedHoverEvidence(
      () => 0,
      () => 0,
    );
    gate.intendPointer(640, 286.5);
    gate.readForPoll();
    gate.receive(sample());
    expect(gate.readForPoll()).toEqual(expected);
    const invalid = sample({ sequence: 2, draw: 3 });
    if (kind === 'coords') invalid.input!.clientX++;
    if (kind === 'pre-command') invalid.input!.unixMs = -1;
    if (kind === 'untrusted') invalid.input!.trusted = false;
    if (kind === 'touch') invalid.input!.pointerType = 'touch';
    if (kind === 'target') invalid.input!.targetMatches = false;
    if (kind === 'identity') invalid.identity = false;
    if (kind === 'error') invalid.error = 'original draw failed';
    if (kind === 'order') invalid.sequence = 1;
    gate.receive(invalid, kind !== 'source');
    expect(gate.readForPoll()).toBeNull();
  });

  it('preserves complete actual fields and publishes wrong states to the exact matcher', () => {
    const gate = new RaisedHoverEvidence(
      () => 0,
      () => 0,
    );
    gate.intendPointer(640, 286.5);
    gate.readForPoll();
    const extra = sample({ actual: { hover: { x: 5, y: 1, extra: true }, drawn: { x: 5, y: 1 } } });
    gate.receive(extra);
    expect(gate.readForPoll()).toEqual(extra.actual);
    expect(gate.readForPoll()).not.toEqual(expected);
    const wrong = sample({ sequence: 2, draw: 3, actual: { hover: null, drawn: { x: 4, y: 1 } } });
    gate.receive(wrong);
    expect(gate.readForPoll()).toEqual(wrong.actual);
    expect(gate.readForPoll()).not.toEqual(expected);
  });

  it('expires evidence at the unchanged 10s boundary and rejects after close', () => {
    let now = 0;
    const gate = new RaisedHoverEvidence(
      () => now,
      () => 0,
    );
    gate.intendPointer(640, 286.5);
    gate.readForPoll();
    gate.receive(sample());
    now = 10_000;
    expect(gate.readForPoll()).toBeNull();
    gate.receive(sample({ sequence: 2, draw: 3 }));
    expect(gate.readForPoll()).toBeNull();
    gate.close();
    expect(gate.receive(sample({ sequence: 3, draw: 4 })).closed).toBe(true);
    expect(gate.readForPoll()).toBeNull();
  });
});

/** Synthetic host exercises the observer protocol and delegation, never UI behavior. */
function host() {
  const gate = new RaisedHoverEvidence(
    () => 0,
    () => 0,
  );
  gate.intendPointer(640, 286.5);
  const listeners = new Set<(event: PointerEvent) => void>();
  const canvas = {
    isConnected: true,
    addEventListener: vi.fn((_type, fn: (event: PointerEvent) => void, options) => {
      expect(options).toEqual({ passive: true });
      listeners.add(fn);
    }),
    removeEventListener: vi.fn((_type, fn: (event: PointerEvent) => void) => listeners.delete(fn)),
  };
  const view = { hoverTile: { x: 5, y: 1 } };
  const result = Symbol('original draw result');
  const failure = new Error('original draw failure');
  let shouldThrow = false;
  const original = vi.fn(function (this: unknown, actualView: typeof view, ..._args: unknown[]) {
    if (shouldThrow) throw failure;
    expect(this).toBe(renderer);
    renderer.lastView = actualView;
    return result;
  });
  const renderer = { draw: original, lastView: view };
  const scene = { hover: { x: 5, y: 1 }, renderer };
  const deliveries: { sample: Sample; resolve(ack: Ack): void }[] = [];
  const runtime = {
    fnt: { app: { scene } },
    raisedHoverEvidenceBinding: vi.fn(
      (evidence: Sample) =>
        new Promise<Ack>((resolve) => deliveries.push({ sample: evidence, resolve })),
    ),
  } as unknown as Window;
  vi.stubGlobal('window', runtime);
  vi.stubGlobal('document', { querySelector: () => canvas });
  initializeRaisedHoverObserver();
  runtime.raisedHoverObserver!.install(scene, canvas as unknown as HTMLCanvasElement);
  return {
    gate,
    canvas,
    renderer,
    scene,
    original,
    view,
    result,
    failure,
    deliveries,
    runtime,
    listeners,
    throwNext: () => {
      shouldThrow = true;
    },
    pointer: (overrides: Partial<PointerEvent> = {}) => {
      for (const listener of listeners)
        listener({
          clientX: 640,
          clientY: 286.5,
          isTrusted: true,
          pointerType: 'mouse',
          timeStamp: 0,
          target: canvas,
          ...overrides,
        } as unknown as PointerEvent);
    },
    async deliver() {
      const next = deliveries.shift();
      if (!next) throw new Error('No pending delivery');
      const ack = gate.receive(next.sample);
      next.resolve(ack);
      await Promise.resolve();
      return next.sample;
    },
  };
}

describe('actual-draw bridge protocol in a synthetic host', () => {
  it('serializes with browser globals alone and requires a successor draw after acknowledgment', async () => {
    const h = host();
    h.runtime.raisedHoverObserver!.dispose();
    runInNewContext(`(${initializeRaisedHoverObserver.toString()})()`, {
      window: h.runtime,
      document: { querySelector: () => h.canvas },
      structuredClone,
      performance,
    });
    h.runtime.raisedHoverObserver!.install(h.scene, h.canvas as unknown as HTMLCanvasElement);
    h.pointer();
    h.gate.readForPoll();
    h.renderer.draw(h.view);
    await h.deliver();
    expect(h.gate.readForPoll()).toBeNull();
    h.renderer.draw(h.view);
    await h.deliver();
    expect(h.gate.readForPoll()).toEqual(expected);
  });

  it('requires input, generation acknowledgment, then a subsequent delegated draw; never retags', async () => {
    const h = host();
    h.pointer();
    expect(h.renderer.draw(h.view, 'extra argument')).toBe(h.result);
    expect(h.original).toHaveBeenLastCalledWith(h.view, 'extra argument');
    const old = h.deliveries[0]!.sample;
    h.gate.readForPoll();
    h.renderer.draw(h.view); // While the old message is in flight, no second send/queue.
    expect(h.deliveries).toHaveLength(1);
    await h.deliver();
    expect(old.generation).toBe(0);
    expect(h.gate.readForPoll()).toBeNull();
    expect(h.deliveries).toHaveLength(0); // Ack alone cannot publish old state.
    h.renderer.draw(h.view);
    const fresh = await h.deliver();
    expect(fresh.generation).toBe(1);
    expect(fresh.draw).toBeGreaterThan(fresh.acknowledgedAfterDraw);
    expect(h.gate.readForPoll()).toEqual(expected);
  });

  it('reports original draw errors after backpressure without replacing their thrown identity', async () => {
    const h = host();
    h.pointer();
    h.gate.readForPoll();
    h.renderer.draw(h.view);
    h.throwNext();
    let thrown: unknown;
    try {
      h.renderer.draw(h.view);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(h.failure);
    expect(h.deliveries).toHaveLength(1);
    await h.deliver();
    expect(h.deliveries).toHaveLength(1); // Pending error is delivered even if no later draw runs.
    const error = await h.deliver();
    expect(error.actual).toBeNull();
    expect(error.error).toContain('original draw failure');
    expect(h.gate.readForPoll()).toBeNull();
  });

  it('rejects pre-input and changed scene identities, and clones complete source values', async () => {
    const h = host();
    h.gate.readForPoll();
    h.renderer.draw(h.view);
    await h.deliver();
    expect(h.gate.readForPoll()).toBeNull();
    h.pointer();
    h.renderer.draw(h.view);
    const captured = h.deliveries[0]!.sample;
    h.scene.hover.x = 4;
    expect(captured.actual).toEqual(expected); // A complete clone, not a later reference read.
    await h.deliver();
    (h.runtime.fnt!.app as unknown as { scene: unknown }).scene = {};
    h.renderer.draw(h.view);
    expect((await h.deliver()).identity).toBe(false);
    expect(h.gate.readForPoll()).toBeNull();
  });

  it('stops late deliveries, restores only its own wrapper and removes its listener', async () => {
    const h = host();
    h.pointer();
    h.gate.readForPoll();
    h.renderer.draw(h.view);
    h.gate.close();
    h.runtime.raisedHoverObserver!.dispose();
    expect(h.renderer.draw).toBe(h.original);
    expect(h.listeners.size).toBe(0);
    await h.deliver();
    h.renderer.draw(h.view);
    expect(h.deliveries).toHaveLength(0);
    expect(h.gate.readForPoll()).toBeNull();
  });

  it('does not restore over a later wrapper owned by another observer', () => {
    const h = host();
    const later = vi.fn(() => h.result);
    h.renderer.draw = later;
    h.runtime.raisedHoverObserver!.dispose();
    expect(h.renderer.draw).toBe(later);
    expect(h.listeners.size).toBe(0);
  });

  it('invalidates evidence when the draw did not install its own view or canvas', async () => {
    const h = host();
    h.pointer();
    h.gate.readForPoll();
    h.renderer.draw(h.view);
    await h.deliver();
    h.original.mockImplementationOnce(() => h.result);
    h.renderer.draw({ hoverTile: { x: 4, y: 1 } });
    expect((await h.deliver()).identity).toBe(false);
    expect(h.gate.readForPoll()).toBeNull();
    h.canvas.isConnected = false;
    h.renderer.draw(h.view);
    expect((await h.deliver()).identity).toBe(false);
    expect(h.gate.readForPoll()).toBeNull();
  });
});
