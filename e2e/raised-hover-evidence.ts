import type { Page } from '@playwright/test';

type Input = {
  sequence: number;
  afterDraw: number;
  clientX: number;
  clientY: number;
  trusted: boolean;
  targetMatches: boolean;
  pointerType: string;
  unixMs: number;
};
type Evidence = {
  sequence: number;
  generation: number;
  acknowledgedAfterDraw: number;
  draw: number;
  input: Input | null;
  identity: boolean;
  actual: { hover: unknown; drawn: unknown } | null;
  error: string | null;
};
type Ack = { generation: number; closed: boolean };
type Renderer = { draw(...args: unknown[]): unknown; lastView: { hoverTile?: unknown } | null };
type Scene = { hover: unknown; renderer: Renderer };
type Observer = { install(scene: unknown, canvas: HTMLCanvasElement): void; dispose(): void };

declare global {
  interface Window {
    raisedHoverObserver?: Observer;
    raisedHoverEvidenceBinding?: (sample: Evidence) => Promise<Ack>;
  }
}

/** Node's original poll reads this gate; a binding reply never constitutes evidence. */
export class RaisedHoverEvidence {
  private generation = 0;
  private deadline = 0;
  private closed = false;
  private lastSequence = 0;
  private lastDraw = 0;
  private pointer: { clientX: number; clientY: number; notBeforeUnixMs: number } | null = null;
  private actual: unknown = null;

  constructor(
    private readonly now = () => performance.now(),
    private readonly epochNow = () => Date.now(),
  ) {}

  intendPointer(clientX: number, clientY: number): void {
    this.pointer = { clientX, clientY, notBeforeUnixMs: this.epochNow() };
    this.actual = null;
  }

  readForPoll(): unknown {
    if (!this.generation && !this.closed) {
      this.generation = 1;
      // Evidence expires too; the unchanged expect.poll owns the actual timeout.
      this.deadline = this.now() + 10_000;
      this.actual = null;
    }
    if (this.closed || this.now() >= this.deadline) this.actual = null;
    return this.actual;
  }

  receive(sample: Evidence, sourceMatches = true): Ack {
    // Invalid messages invalidate earlier success, including out-of-order delivery.
    this.actual = null;
    const ordered =
      Number.isSafeInteger(sample.sequence) &&
      sample.sequence > this.lastSequence &&
      Number.isSafeInteger(sample.draw) &&
      sample.draw > this.lastDraw;
    this.lastSequence = Math.max(this.lastSequence, sample.sequence);
    this.lastDraw = Math.max(this.lastDraw, sample.draw);
    const input = sample.input;
    if (
      sourceMatches &&
      ordered &&
      !this.closed &&
      this.generation > 0 &&
      this.now() < this.deadline &&
      sample.generation === this.generation &&
      Number.isSafeInteger(sample.acknowledgedAfterDraw) &&
      sample.acknowledgedAfterDraw >= 0 &&
      sample.draw > sample.acknowledgedAfterDraw &&
      input &&
      Number.isSafeInteger(input.sequence) &&
      input.sequence > 0 &&
      Number.isSafeInteger(input.afterDraw) &&
      input.afterDraw >= 0 &&
      sample.draw > input.afterDraw &&
      input.trusted === true &&
      input.targetMatches === true &&
      input.pointerType === 'mouse' &&
      this.pointer &&
      input.clientX === this.pointer.clientX &&
      input.clientY === this.pointer.clientY &&
      Number.isFinite(input.unixMs) &&
      input.unixMs >= this.pointer.notBeforeUnixMs &&
      sample.identity === true &&
      !sample.error &&
      sample.actual
    ) {
      // Preserve all actual fields so the existing exact matcher can reject extras.
      this.actual = structuredClone(sample.actual);
    }
    return { generation: this.generation, closed: this.closed };
  }

  close(): void {
    this.closed = true;
    this.actual = null;
  }
}

/** Serialized by addInitScript: deliberately has no imported runtime dependencies. */
export function initializeRaisedHoverObserver(): void {
  let dispose = () => {};
  window.raisedHoverObserver = {
    install(value, canvas) {
      dispose();
      const scene = value as Scene;
      const renderer = scene.renderer;
      const original = renderer.draw;
      let closed = false;
      let inFlight = false;
      let sequence = 0;
      let draw = 0;
      let generation = 0;
      let acknowledgedAfterDraw = 0;
      let input: Input | null = null;
      let inputSequence = 0;
      let pendingError: string | null = null;
      const onPointerMove = (event: PointerEvent) => {
        input = {
          sequence: ++inputSequence,
          afterDraw: draw,
          clientX: event.clientX,
          clientY: event.clientY,
          trusted: event.isTrusted,
          targetMatches: event.target === canvas,
          pointerType: event.pointerType,
          // Correlate input with the original Node mouse command, not its timeout.
          unixMs: performance.timeOrigin + event.timeStamp,
        };
      };
      canvas.addEventListener('pointermove', onPointerMove, { passive: true });
      const publish = (actual: Evidence['actual'], identity: boolean, error: string | null) => {
        if (closed) return;
        if (error) pendingError = error;
        if (inFlight) return; // Drop this draw; never queue or retag a captured state.
        const binding = window.raisedHoverEvidenceBinding;
        if (!binding) return;
        const sample: Evidence = {
          sequence: ++sequence,
          generation,
          acknowledgedAfterDraw,
          draw,
          input: input ? { ...input } : null,
          identity,
          actual,
          error: pendingError,
        };
        pendingError = null;
        inFlight = true;
        void binding(sample).then(
          (ack) => {
            inFlight = false;
            if (closed) return;
            if (ack.closed) {
              stop();
              return;
            }
            if (ack.generation > generation) {
              generation = ack.generation;
              acknowledgedAfterDraw = draw;
            }
            if (pendingError) publish(null, false, pendingError);
            // Only a subsequent original draw may publish under the new generation.
          },
          (error: unknown) => {
            inFlight = false;
            pendingError = String(error);
          },
        );
      };
      const wrapped = function (this: Renderer, ...args: unknown[]): unknown {
        draw++;
        let result: unknown;
        try {
          result = original.apply(this, args);
        } catch (error) {
          try {
            publish(null, false, String(error));
          } catch {
            // Observation must never replace the production draw's thrown value.
          }
          throw error;
        }
        try {
          const current = window.fnt?.app as unknown as { scene?: Scene } | undefined;
          const identity =
            this === renderer &&
            current?.scene === scene &&
            scene.renderer === renderer &&
            renderer.lastView === args[0] &&
            canvas.isConnected &&
            document.querySelector('.map-canvas') === canvas;
          const actual = structuredClone({
            hover: scene.hover,
            drawn: renderer.lastView?.hoverTile ?? null,
          });
          publish(actual, identity, identity ? null : 'Raised hover draw identity changed');
        } catch (error) {
          try {
            publish(null, false, String(error));
          } catch {
            // Preserve the successful production draw even if observation fails.
          }
        }
        return result;
      };
      renderer.draw = wrapped;
      const stop = () => {
        closed = true;
        canvas.removeEventListener('pointermove', onPointerMove);
        if (renderer.draw === wrapped) renderer.draw = original;
      };
      dispose = stop;
    },
    dispose() {
      dispose();
    },
  };
}

export async function prepareRaisedHoverEvidence(page: Page) {
  const evidence = new RaisedHoverEvidence();
  await page.exposeBinding('raisedHoverEvidenceBinding', (source, sample: Evidence) =>
    evidence.receive(sample, source.page === page && source.frame === page.mainFrame()),
  );
  await page.addInitScript(initializeRaisedHoverObserver);
  return {
    intendPointer: (clientX: number, clientY: number) => evidence.intendPointer(clientX, clientY),
    readForPoll: () => evidence.readForPoll(),
    async close() {
      evidence.close(); // Reject already queued deliveries before awaiting browser cleanup.
      await page.evaluate(() => window.raisedHoverObserver?.dispose()).catch(() => {});
    },
  };
}
