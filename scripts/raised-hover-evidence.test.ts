import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import type { Page } from '@playwright/test';
import {
  initializeRaisedHoverObserver,
  prepareRaisedHoverEvidence,
  RaisedHoverEvidence,
} from '../e2e/raised-hover-evidence';

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
    const gate = new RaisedHoverEvidence(() => 0);
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

  it.each(['coords', 'untrusted', 'touch', 'target', 'identity', 'source', 'order'])(
    'invalidates previous matching evidence on bad %s; does not latch success',
    (kind) => {
      const gate = new RaisedHoverEvidence(() => 0);
      gate.intendPointer(640, 286.5);
      gate.readForPoll();
      gate.receive(sample());
      expect(gate.readForPoll()).toEqual(expected);
      const invalid = sample({ sequence: 2, draw: 3 });
      if (kind === 'coords') invalid.input!.clientX++;
      if (kind === 'untrusted') invalid.input!.trusted = false;
      if (kind === 'touch') invalid.input!.pointerType = 'touch';
      if (kind === 'target') invalid.input!.targetMatches = false;
      if (kind === 'identity') invalid.identity = false;
      if (kind === 'order') invalid.sequence = 1;
      gate.receive(invalid, kind !== 'source');
      expect(gate.readForPoll()).toBeNull();
    },
  );

  it('keeps the first observer error across later good evidence and later errors', () => {
    const gate = new RaisedHoverEvidence(() => 0);
    gate.intendPointer(640, 286.5);
    gate.readForPoll();
    gate.receive(sample({ error: 'first observer failure' }));
    const readError = () => {
      try {
        return gate.readForPoll();
      } catch (error) {
        return error;
      }
    };
    const first = readError();
    expect(first).toBeInstanceOf(Error);
    expect(String(first)).toContain('first observer failure');
    gate.receive(sample({ sequence: 2, draw: 3 }));
    expect(readError()).toBe(first);
    gate.receive(sample({ sequence: 3, draw: 4, error: 'later observer failure' }));
    expect(readError()).toBe(first);
  });

  it('preserves complete actual fields and publishes wrong states to the exact matcher', () => {
    const gate = new RaisedHoverEvidence(() => 0);
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
    const gate = new RaisedHoverEvidence(() => now);
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
  const gate = new RaisedHoverEvidence(() => 0);
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
  const deliveries: { sample: Sample; resolve(ack: Ack): void; reject(error: unknown): void }[] =
    [];
  const runtime = {
    fnt: { app: { scene } },
    raisedHoverEvidenceBinding: vi.fn(
      (evidence: Sample) =>
        new Promise<Ack>((resolve, reject) =>
          deliveries.push({ sample: evidence, resolve, reject }),
        ),
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
    recover: () => {
      shouldThrow = false;
    },
    pointer: (overrides: Partial<PointerEvent> = {}) => {
      for (const listener of listeners)
        listener({
          clientX: 640,
          clientY: 286.5,
          isTrusted: true,
          pointerType: 'mouse',
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
    h.recover();
    h.renderer.draw(h.view); // A later successful draw must not wash out the pending error.
    h.original.mockImplementationOnce(() => {
      throw new Error('later observer failure');
    });
    expect(() => h.renderer.draw(h.view)).toThrow('later observer failure');
    expect(h.deliveries).toHaveLength(1);
    await h.deliver();
    expect(h.deliveries).toHaveLength(1); // Pending error is delivered even if no later draw runs.
    const error = await h.deliver();
    expect(error.actual).toBeNull();
    expect(error.error).toContain('original draw failure');
    expect(() => h.gate.readForPoll()).toThrow('original draw failure');
    h.renderer.draw(h.view);
    expect(h.deliveries).toHaveLength(0); // One sticky error report, never a resend loop.
    expect(() => h.gate.readForPoll()).toThrow('original draw failure');
  });

  it('does not retry a rejected binding or publish later apparently good evidence', async () => {
    const h = host();
    h.pointer();
    h.gate.readForPoll();
    h.renderer.draw(h.view);
    const delivery = h.deliveries.shift()!;
    delivery.reject(new Error('uncertain binding loss'));
    await Promise.resolve();
    h.renderer.draw(h.view);
    h.renderer.draw(h.view);
    expect(h.runtime.raisedHoverEvidenceBinding).toHaveBeenCalledTimes(1);
    expect(h.deliveries).toHaveLength(0);
    // The lost channel cannot report its own loss; no fresh evidence reaches Node.
    expect(h.gate.readForPoll()).toBeNull();
  });

  it('preserves production returns when the binding throws and never retries it', () => {
    const h = host();
    h.pointer();
    h.gate.readForPoll();
    h.runtime.raisedHoverEvidenceBinding = vi.fn(() => {
      throw new Error('binding unavailable');
    });
    expect(h.renderer.draw(h.view)).toBe(h.result);
    expect(h.renderer.draw(h.view)).toBe(h.result);
    expect(h.runtime.raisedHoverEvidenceBinding).toHaveBeenCalledTimes(1);
    expect(h.gate.readForPoll()).toBeNull();
  });

  it('cannot revoke an already delivered Node match through a subsequently lost binding', async () => {
    const h = host();
    h.pointer();
    h.gate.readForPoll();
    h.renderer.draw(h.view);
    await h.deliver(); // Generation acknowledgment; no accepted post-poll state yet.
    h.renderer.draw(h.view);
    const delivery = h.deliveries.shift()!;
    h.gate.receive(delivery.sample); // Node received fresh evidence before its reply was lost.
    expect(h.gate.readForPoll()).toEqual(expected);
    delivery.reject(new Error('reply lost after Node accepted evidence'));
    await Promise.resolve();
    h.renderer.draw(h.view);
    expect(h.deliveries).toHaveLength(0);
    expect(h.runtime.raisedHoverEvidenceBinding).toHaveBeenCalledTimes(2);
    // Explicit negative control: transport loss alone cannot revoke this valid match.
    expect(h.gate.readForPoll()).toEqual(expected);
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
    expect(() => h.gate.readForPoll()).toThrow('identity changed');
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

  it.each(['view', 'canvas'])(
    'makes a changed %s identity a sticky observer error',
    async (kind) => {
      const h = host();
      h.pointer();
      h.gate.readForPoll();
      h.renderer.draw(h.view);
      await h.deliver();
      if (kind === 'view') {
        h.original.mockImplementationOnce(() => h.result);
        h.renderer.draw({ hoverTile: { x: 4, y: 1 } });
      } else {
        h.canvas.isConnected = false;
        h.renderer.draw(h.view);
      }
      expect((await h.deliver()).identity).toBe(false);
      expect(() => h.gate.readForPoll()).toThrow('identity changed');
    },
  );
});

describe('raised observer cleanup before native captures', () => {
  it('closes Node first, performs browser cleanup once, and preserves a poll failure', async () => {
    const frame = {};
    let receive!: (source: { page: Page; frame: unknown }, sample: Sample) => Ack;
    let rejectCleanup!: (error: unknown) => void;
    const pendingCleanup = new Promise<void>((_resolve, reject) => {
      rejectCleanup = reject;
    });
    const evaluate = vi.fn(() => pendingCleanup);
    const page = {
      exposeBinding: vi.fn(async (_name: string, callback: typeof receive) => {
        receive = callback;
      }),
      addInitScript: vi.fn(async () => {}),
      evaluate,
      mainFrame: () => frame,
    } as unknown as Page;
    const observation = await prepareRaisedHoverEvidence(page);
    const original = new Error('original hover poll failure');
    const execution = (async () => {
      try {
        throw original;
      } finally {
        await observation.close();
      }
    })();
    const fallback = observation.close();
    expect(receive({ page, frame }, sample()).closed).toBe(true);
    expect(evaluate).toHaveBeenCalledTimes(1);
    rejectCleanup(new Error('browser cleanup unavailable'));
    await expect(execution).rejects.toBe(original);
    await fallback;
    expect(observation.readForPoll()).toBeNull();
    expect(evaluate).toHaveBeenCalledTimes(1);
  });
});
